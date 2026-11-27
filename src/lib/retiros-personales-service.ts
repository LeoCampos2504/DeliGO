// ============================================
// T7-F1 — retiros personales de mercadería desde Caja (servidor)
// ============================================
// Diseño: codex-reports/T7_F1_RETIROS_PERSONALES_DISENO.md.
//
// Un retiro personal es una salida NO comercial de mercadería (empleado, familiar o dueño). Nunca es una venta:
// no crea Venta, CobroVenta, OperacionFinanciera ni MovimientoFinanciero; el efectivo esperado del turno y el
// cierre ciego no cambian. Garantías:
//   - una transacción Serializable (runStockSerializable) con TODO adentro: actor y permiso releídos, beneficiario,
//     precios del catálogo (mismo motor que la venta de Caja), costos conocidos, plan de stock, retiro + líneas,
//     movimientos de inventario (sólo por la autoridad), auditoría y aviso al dueño — o nada;
//   - Idempotency-Key + huella del contenido únicas por negocio: un reintento devuelve el mismo retiro, una clave
//     reutilizada con otro contenido es 409, dos envíos concurrentes terminan en UN retiro;
//   - valores congelados al registrar; costo desconocido = NULL (nunca 0);
//   - decisiones del dueño INFORMATIVAS (no cobran ni descuentan sueldo) y acotadas al valor elegible;
//   - anulaciones/devoluciones auditadas que nunca borran el original ni reingresan stock dos veces.

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { cartTotal, computeSaleFromAuthoritativeProducts, type ServerSaleLineInput } from "@/lib/caja-venta"
import { addMoney, isMoneyInRange, MoneyError, moneyToNumber, round2, saleAmountsExact } from "@/lib/money"
import {
  planificarStockRetiroPersonal,
  registrarStockRetiroPersonal,
  reingresarStockRetiroPersonal,
  runStockSerializable,
  type VentaCajaStockLine,
} from "@/lib/stock-lifecycle"
import { auditLogWithClient } from "@/lib/audit"
import { nombreVisibleEmpleado } from "@/lib/empleado-identidad"
import { resolveAreaOperativaEfectiva } from "@/lib/area-operativa"
import { TURNO_ESTADO_ABIERTO } from "@/lib/caja-turnos-service"
import {
  BENEFICIARIO_TIPOS,
  FAMILIAR_NOMBRE_MAX,
  limpiarNombreFamiliar,
  normalizarNombreFamiliar,
  RETIRO_MAX_LINEAS,
  RETIRO_MOTIVO_MAX,
  RETIRO_OBSERVACIONES_MAX,
  RETIRO_RANGO_MAX_DIAS,
  type BeneficiarioTipo,
} from "@/lib/retiros-personales"

type Db = PrismaClient
type Tx = Prisma.TransactionClient

export const NOTIFICACION_TIPO_RETIRO_PERSONAL = "caja_retiro_personal"
export { BENEFICIARIO_TIPOS, RETIRO_MOTIVO_MAX, type BeneficiarioTipo } from "@/lib/retiros-personales"

export type ActorRetiro = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }
export type BeneficiarioEntrada =
  | { tipo: "EMPLEADO"; empleadoId: string }
  | { tipo: "FAMILIAR"; familiarId: string }
  | { tipo: "FAMILIAR"; nuevoNombre: string }
  | { tipo: "DUENO" }

export type Rechazo = { ok: false; status: 400 | 403 | 404 | 409; error: string; code?: string }
const rechazo = (status: Rechazo["status"], error: string, code?: string): Rechazo => ({ ok: false, status, error, ...(code ? { code } : {}) })

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

/**
 * Costo unitario conocido (4 decimales) o null. Un costo ausente, no finito, negativo o 0 se trata como
 * DESCONOCIDO: el catálogo no distingue «costo 0» de «sin cargar», y un costo desconocido nunca se muestra como 0.
 */
export function costoUnitarioConocido(costo: number | null | undefined): Prisma.Decimal | null {
  if (typeof costo !== "number" || !Number.isFinite(costo) || costo <= 0) return null
  return new Prisma.Decimal(String(costo)).toDecimalPlaces(4, Prisma.Decimal.ROUND_HALF_UP)
}

/**
 * Reparte un importe decidido entre retiros (del más antiguo al más nuevo), sin superar el elegible de ninguno.
 * Devuelve null si el importe supera la suma elegible.
 */
export function asignarImporteDecision(
  retiros: ReadonlyArray<{ id: string; createdAt: Date; elegible: Prisma.Decimal }>,
  importe: Prisma.Decimal
): Array<{ id: string; elegible: Prisma.Decimal; asignado: Prisma.Decimal }> | null {
  const ordenados = [...retiros].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
  const total = addMoney(...ordenados.map((r) => r.elegible))
  if (importe.isNegative() || importe.gt(total)) return null
  let restante = importe
  return ordenados.map((r) => {
    const asignado = Prisma.Decimal.min(restante, r.elegible)
    restante = restante.minus(asignado)
    return { id: r.id, elegible: r.elegible, asignado }
  })
}

/** Importe de dinero (2 decimales, ≥ 0) desde el cuerpo; null si es inválido. */
export function parseImporte(value: unknown): Prisma.Decimal | null {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim().replace(",", ".") : ""
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(raw)) return null
  const d = new Prisma.Decimal(raw)
  return isMoneyInRange(d) ? d : null
}

// ---------------------------------------------------------------------------
// Parseo de entrada (el cliente nunca envía precios, costos, totales de valor ni identidades de registrante)
// ---------------------------------------------------------------------------

export interface RetiroEntrada {
  beneficiario: BeneficiarioEntrada
  lines: ServerSaleLineInput[]
  observaciones: string | null
  totalMostrado?: number
}

export function parseRetiroBody(body: unknown): { ok: true; value: RetiroEntrada } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  if (b.confirmado !== true) return { ok: false, error: "Confirmá el retiro antes de registrarlo." }
  const ben = (b.beneficiario ?? {}) as Record<string, unknown>
  let beneficiario: BeneficiarioEntrada
  if (ben.tipo === "EMPLEADO" && typeof ben.empleadoId === "string" && ben.empleadoId) beneficiario = { tipo: "EMPLEADO", empleadoId: ben.empleadoId }
  else if (ben.tipo === "FAMILIAR" && typeof ben.familiarId === "string" && ben.familiarId) beneficiario = { tipo: "FAMILIAR", familiarId: ben.familiarId }
  else if (ben.tipo === "FAMILIAR" && typeof ben.nuevoNombre === "string") {
    const nombre = limpiarNombreFamiliar(ben.nuevoNombre)
    if (!nombre || nombre.length > FAMILIAR_NOMBRE_MAX) return { ok: false, error: `Indicá el nombre del familiar (hasta ${FAMILIAR_NOMBRE_MAX} caracteres).` }
    beneficiario = { tipo: "FAMILIAR", nuevoNombre: nombre }
  } else if (ben.tipo === "DUENO") beneficiario = { tipo: "DUENO" }
  else return { ok: false, error: "Elegí quién retira la mercadería." }

  if (!Array.isArray(b.items) || b.items.length === 0) return { ok: false, error: "El retiro no tiene productos." }
  if (b.items.length > RETIRO_MAX_LINEAS) return { ok: false, error: "El retiro tiene demasiados productos." }
  const lines: ServerSaleLineInput[] = []
  for (const raw of b.items as unknown[]) {
    const line = (raw ?? {}) as { productoId?: unknown; varianteId?: unknown; cantidad?: unknown }
    if (typeof line.productoId !== "string" || !line.productoId || typeof line.cantidad !== "number") return { ok: false, error: "Cada línea requiere productoId y cantidad." }
    if (line.varianteId !== undefined && line.varianteId !== null && typeof line.varianteId !== "string") return { ok: false, error: "varianteId inválido." }
    lines.push({ productoId: line.productoId, varianteId: (line.varianteId as string | null | undefined) ?? undefined, cantidad: line.cantidad })
  }
  let observaciones: string | null = null
  if (b.observaciones !== undefined && b.observaciones !== null) {
    if (typeof b.observaciones !== "string") return { ok: false, error: "Observaciones inválidas." }
    const t = b.observaciones.trim()
    if (t.length > RETIRO_OBSERVACIONES_MAX) return { ok: false, error: `Las observaciones admiten hasta ${RETIRO_OBSERVACIONES_MAX} caracteres.` }
    observaciones = t || null
  }
  const tm = b.totalMostrado
  if (tm !== undefined && tm !== null && (typeof tm !== "number" || !Number.isFinite(tm) || tm < 0)) return { ok: false, error: "Total inválido." }
  return { ok: true, value: { beneficiario, lines, observaciones, ...(typeof tm === "number" ? { totalMostrado: tm } : {}) } }
}

/** Huella del contenido (beneficiario + líneas + observaciones + registrante): base de la idempotencia. */
export function huellaRetiro(actor: ActorRetiro, entrada: RetiroEntrada): string {
  const b = entrada.beneficiario
  const ben = b.tipo === "EMPLEADO" ? `E:${b.empleadoId}` : b.tipo === "DUENO" ? "D" : "familiarId" in b ? `F:${b.familiarId}` : `N:${normalizarNombreFamiliar(b.nuevoNombre)}`
  const canonical = JSON.stringify({
    actor: actor.tipo === "EMPLEADO" ? `E:${actor.empleadoId}` : "N",
    ben,
    lines: entrada.lines.map((l) => [l.productoId, l.varianteId ?? null, l.cantidad]),
    obs: entrada.observaciones ?? "",
  })
  return createHash("sha256").update(`T7-F1-RETIRO\n${canonical}`).digest("hex")
}

// ---------------------------------------------------------------------------
// Registrante (actor) y permiso — siempre releídos dentro de la transacción
// ---------------------------------------------------------------------------

async function resolverRegistrante(tx: Tx, negocioId: string, actor: ActorRetiro): Promise<{ ok: true; tipo: "NEGOCIO" | "EMPLEADO"; empleadoId: string | null; nombre: string; auditId: string; auditTipo: string } | Rechazo> {
  if (actor.tipo === "NEGOCIO") {
    const n = await tx.negocio.findUnique({ where: { id: negocioId }, select: { nombre: true } })
    if (!n) return rechazo(403, "Acceso denegado")
    return { ok: true, tipo: "NEGOCIO", empleadoId: null, nombre: n.nombre, auditId: negocioId, auditTipo: "negocio" }
  }
  const e = await tx.empleado.findFirst({
    where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false },
    select: { id: true, nombre: true, retiroPersonalHabilitado: true, cuentaOperativa: { select: { nombre: true, eliminado: true } } },
  })
  if (!e) return rechazo(403, "Acceso denegado")
  if (!e.retiroPersonalHabilitado) return rechazo(403, "No tenés permiso para registrar retiros personales. Pedíselo al dueño.", "RETIRO_NO_HABILITADO")
  return { ok: true, tipo: "EMPLEADO", empleadoId: e.id, nombre: nombreVisibleEmpleado(e), auditId: e.id, auditTipo: "empleado" }
}

// ---------------------------------------------------------------------------
// Registro de un retiro
// ---------------------------------------------------------------------------

const RETIRO_INCLUDE = {
  lineas: { orderBy: { orden: "asc" } },
  devoluciones: { include: { lineas: true }, orderBy: { createdAt: "asc" } },
  decisionItems: { where: { vigente: true }, include: { decision: true } },
} satisfies Prisma.RetiroPersonalInclude
export type RetiroCompleto = Prisma.RetiroPersonalGetPayload<{ include: typeof RETIRO_INCLUDE }>

export type RegistrarRetiroResult = { ok: true; replayed: boolean; retiro: RetiroCompleto } | Rechazo

const money = (value: Prisma.Decimal) => `$${moneyToNumber(value).toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const ETIQUETA_TIPO: Record<BeneficiarioTipo, string> = { EMPLEADO: "empleado", FAMILIAR: "familiar", DUENO: "dueño" }

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

function replayORechazo(existente: RetiroCompleto, fingerprint: string): RegistrarRetiroResult {
  if (existente.idempotencyFingerprint !== fingerprint) return rechazo(409, "Esta clave de operación ya se usó para otro retiro. Volvé a intentarlo.", "IDEMPOTENCY_KEY_REUSED")
  return { ok: true, replayed: true, retiro: existente }
}

export async function registrarRetiroPersonal(
  db: Db,
  input: { negocioId: string; actor: ActorRetiro; entrada: RetiroEntrada; idempotencyKey: string }
): Promise<RegistrarRetiroResult> {
  const { negocioId, idempotencyKey } = input
  const fingerprint = huellaRetiro(input.actor, input.entrada)
  try {
    return await runStockSerializable(db, (tx) => registrarRetiroEnTx(tx, { ...input, fingerprint }))
  } catch (error) {
    // Un envío concurrente con la misma clave ganó: devolver ese retiro (o el conflicto), nunca un segundo.
    if (isUniqueViolation(error)) {
      const existente = await db.retiroPersonal.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } }, include: RETIRO_INCLUDE })
      if (existente) return replayORechazo(existente, fingerprint)
    }
    throw error
  }
}

async function registrarRetiroEnTx(
  tx: Tx,
  input: { negocioId: string; actor: ActorRetiro; entrada: RetiroEntrada; idempotencyKey: string; fingerprint: string }
): Promise<RegistrarRetiroResult> {
  const { negocioId, actor, entrada, idempotencyKey, fingerprint } = input

  // 1. Reintento exacto / clave reutilizada — ANTES de validar o escribir nada.
  const existente = await tx.retiroPersonal.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } }, include: RETIRO_INCLUDE })
  if (existente) return replayORechazo(existente, fingerprint)

  // 2. Registrante + permiso (la revocación vale aunque la sesión siga abierta).
  const reg = await resolverRegistrante(tx, negocioId, actor)
  if (!reg.ok) return reg

  // 3. Beneficiario (sólo validación; un familiar nuevo se crea recién cuando nada puede rechazar el retiro).
  const ben = entrada.beneficiario
  let beneficiarioEmpleadoId: string | null = null
  let beneficiarioFamiliarId: string | null = null
  let beneficiarioNombre: string
  let familiarNuevo: { nombre: string; normalizado: string } | null = null
  if (ben.tipo === "EMPLEADO") {
    const e = await tx.empleado.findFirst({ where: { id: ben.empleadoId, negocioId, activo: true, eliminado: false }, select: { id: true, nombre: true, cuentaOperativa: { select: { nombre: true, eliminado: true } } } })
    if (!e) return rechazo(400, "El empleado elegido no está disponible.", "BENEFICIARIO_INVALIDO")
    beneficiarioEmpleadoId = e.id
    beneficiarioNombre = nombreVisibleEmpleado(e)
  } else if (ben.tipo === "FAMILIAR" && "familiarId" in ben) {
    const f = await tx.familiarRetiro.findFirst({ where: { id: ben.familiarId, negocioId, activo: true }, select: { id: true, nombre: true } })
    if (!f) return rechazo(400, "El familiar elegido no está disponible.", "BENEFICIARIO_INVALIDO")
    beneficiarioFamiliarId = f.id
    beneficiarioNombre = f.nombre
  } else if (ben.tipo === "FAMILIAR") {
    const normalizado = normalizarNombreFamiliar(ben.nuevoNombre)
    const previo = await tx.familiarRetiro.findUnique({ where: { negocioId_nombreNormalizado: { negocioId, nombreNormalizado: normalizado } }, select: { id: true, nombre: true } })
    if (previo) {
      beneficiarioFamiliarId = previo.id
      beneficiarioNombre = previo.nombre
    } else {
      familiarNuevo = { nombre: ben.nuevoNombre, normalizado }
      beneficiarioNombre = ben.nuevoNombre
    }
  } else {
    const n = await tx.negocio.findUnique({ where: { id: negocioId }, select: { nombre: true } })
    beneficiarioNombre = n?.nombre ?? "Dueño"
  }

  // 4. Precios del catálogo (mismo motor que la venta de Caja; sin promociones ni descuentos) y costos conocidos.
  const productos = await tx.producto.findMany({ where: { id: { in: entrada.lines.map((l) => l.productoId) }, negocioId, eliminado: false }, include: { variantes: true } })
  const productsById = new Map(productos.map((p) => [p.id, { nombre: p.nombre, precio: p.precio, variantes: new Map(p.variantes.filter((v) => v.activo).map((v) => [v.id, { nombre: v.nombre, precio: v.precio }])) }]))
  const computed = computeSaleFromAuthoritativeProducts(entrada.lines, productsById)
  if (!computed.ok) return rechazo(400, computed.error)
  if (computed.items.some((item) => !(item.precio > 0))) return rechazo(400, "Hay un producto sin precio de venta: cargá el precio antes de registrar el retiro.", "PRODUCTO_SIN_PRECIO")
  let subtotales: Prisma.Decimal[]
  let valorComercial: Prisma.Decimal
  try {
    const importes = saleAmountsExact(computed.items)
    subtotales = importes.subtotales
    valorComercial = importes.total
  } catch (error) {
    if (error instanceof MoneyError) return rechazo(400, "Importe fuera de rango.")
    throw error
  }
  if (!isMoneyInRange(valorComercial) || !subtotales.every((s) => isMoneyInRange(s))) return rechazo(400, "Importe fuera de rango.")
  if (entrada.totalMostrado !== undefined && cartTotal(computed.items).toFixed(2) !== entrada.totalMostrado.toFixed(2)) {
    return rechazo(409, "Los precios de algunos productos cambiaron. Revisá el carrito: ya muestra los precios correctos.", "PRECIOS_CAMBIARON")
  }
  const productoPorId = new Map(productos.map((p) => [p.id, p]))
  const variantePorId = new Map(productos.flatMap((p) => p.variantes.map((v) => [v.id, v] as const)))
  const lineas = computed.items.map((item, i) => {
    const producto = productoPorId.get(item.productoId)!
    const variante = item.varianteId ? variantePorId.get(item.varianteId)! : null
    const costoUnitario = costoUnitarioConocido(variante ? variante.costo : producto.costo)
    return {
      item,
      orden: i,
      subtotal: subtotales[i],
      costoUnitario,
      costoTotal: costoUnitario ? round2(costoUnitario.times(item.cantidad)) : null,
      stock: {
        productoId: item.productoId,
        productoVarianteId: item.varianteId ?? null,
        cantidad: item.cantidad,
        controlStock: variante ? variante.controlStock : producto.controlStock,
        nombre: variante ? `${producto.nombre} — ${variante.nombre}` : producto.nombre,
      } satisfies VentaCajaStockLine,
    }
  })

  // 5. Stock: plan agregado por clave contra el disponible (lanza 409 y revierte todo si no alcanza).
  const plan = await planificarStockRetiroPersonal(tx, { negocioId, lines: lineas.map((l) => l.stock) })
  const clavesMovidas = new Set(plan.map((p) => `${p.productoId}:${p.productoVarianteId ?? ""}`))

  // 6. Desde acá nada puede rechazar: familiar nuevo (reutiliza si otro lo creó en paralelo), retiro, stock.
  if (familiarNuevo) {
    await tx.familiarRetiro.createMany({
      data: [{ negocioId, nombre: familiarNuevo.nombre, nombreNormalizado: familiarNuevo.normalizado, creadoPorTipo: reg.tipo, creadoPorId: reg.auditId }],
      skipDuplicates: true,
    })
    const f = await tx.familiarRetiro.findUniqueOrThrow({ where: { negocioId_nombreNormalizado: { negocioId, nombreNormalizado: familiarNuevo.normalizado } }, select: { id: true, nombre: true } })
    beneficiarioFamiliarId = f.id
    beneficiarioNombre = f.nombre
  }
  const turno = reg.tipo === "EMPLEADO"
    ? await tx.turnoCaja.findFirst({ where: { negocioId, estado: TURNO_ESTADO_ABIERTO, responsableTipo: "EMPLEADO", responsableId: reg.empleadoId! }, select: { id: true } })
    : null
  const costosConocidos = lineas.filter((l) => l.costoTotal).map((l) => l.costoTotal!)
  const creado = await tx.retiroPersonal.create({
    data: {
      negocioId,
      beneficiarioTipo: ben.tipo,
      beneficiarioEmpleadoId,
      beneficiarioFamiliarId,
      beneficiarioNombre,
      registradoPorTipo: reg.tipo,
      registradoPorEmpleadoId: reg.empleadoId,
      registradoPorNombre: reg.nombre,
      turnoCajaId: turno?.id ?? null,
      valorComercialDecimal: valorComercial,
      costoConocidoDecimal: addMoney(...costosConocidos),
      costoCompleto: costosConocidos.length === lineas.length,
      cantidadLineas: lineas.length,
      observaciones: entrada.observaciones,
      idempotencyKey,
      idempotencyFingerprint: fingerprint,
      lineas: {
        create: lineas.map((l) => ({
          negocioId,
          orden: l.orden,
          productoId: l.item.productoId,
          productoVarianteId: l.item.varianteId ?? null,
          nombre: l.item.nombre,
          varianteNombre: l.item.varianteNombre,
          cantidad: l.item.cantidad,
          precioUnitarioDecimal: round2(l.item.precio),
          subtotalDecimal: l.subtotal,
          costoUnitarioDecimal: l.costoUnitario,
          costoTotalDecimal: l.costoTotal,
          movioStock: clavesMovidas.has(`${l.item.productoId}:${l.item.varianteId ?? ""}`),
        })),
      },
    },
    select: { id: true },
  })
  await registrarStockRetiroPersonal(tx, { negocioId, retiroPersonalId: creado.id, plan })

  // 7. Auditoría y aviso al dueño, en la MISMA transacción.
  await auditLogWithClient(tx, {
    userId: reg.auditId,
    userType: reg.auditTipo,
    accion: "retiro_personal.registrado",
    recurso: "retiro_personal",
    recursoId: creado.id,
    detalle: { negocioId, beneficiarioTipo: ben.tipo, beneficiarioNombre, valorComercial: valorComercial.toFixed(2), cantidadLineas: lineas.length, lineasConStock: plan.length, turnoCajaId: turno?.id ?? null },
  })
  if (reg.tipo === "EMPLEADO") {
    await tx.notificacion.create({
      data: {
        userId: negocioId,
        userType: "negocio",
        tipo: NOTIFICACION_TIPO_RETIRO_PERSONAL,
        titulo: "Retiro personal de mercadería",
        cuerpo: `${reg.nombre} registró un retiro de mercadería por ${money(valorComercial)} para ${beneficiarioNombre} (${ETIQUETA_TIPO[ben.tipo]}). No ingresó dinero a Caja.`,
        negocioId,
        datos: JSON.stringify({ navigateTo: { negocio: "administracion" }, retiroPersonalId: creado.id, beneficiarioTipo: ben.tipo }),
      },
    })
  }
  const retiro = await tx.retiroPersonal.findUniqueOrThrow({ where: { id: creado.id }, include: RETIRO_INCLUDE })
  return { ok: true, replayed: false, retiro }
}

// ---------------------------------------------------------------------------
// Valores vigentes (netos de devoluciones) — la base de resúmenes y decisiones
// ---------------------------------------------------------------------------

export interface ValoresRetiro {
  valorVigente: Prisma.Decimal
  costoVigente: Prisma.Decimal
  valorDevuelto: Prisma.Decimal
  /** Importe asignado por la decisión vigente (0 si no hay). */
  asignado: Prisma.Decimal
  decisionVigenteId: string | null
}

export function valoresRetiro(r: Pick<RetiroCompleto, "estado" | "valorComercialDecimal" | "costoConocidoDecimal" | "devoluciones" | "decisionItems">): ValoresRetiro {
  const valorDevuelto = addMoney(...r.devoluciones.map((d) => d.valorDecimal))
  const costoDevuelto = addMoney(...r.devoluciones.map((d) => d.costoConocidoDecimal))
  const item = r.decisionItems.find((i) => i.vigente)
  const valorVigente = r.estado === "ANULADO" ? new Prisma.Decimal(0) : Prisma.Decimal.max(0, r.valorComercialDecimal.minus(valorDevuelto))
  const costoVigente = r.estado === "ANULADO" ? new Prisma.Decimal(0) : Prisma.Decimal.max(0, r.costoConocidoDecimal.minus(costoDevuelto))
  return { valorVigente, costoVigente, valorDevuelto, asignado: item ? item.asignadoDecimal : new Prisma.Decimal(0), decisionVigenteId: item?.decisionId ?? null }
}

/** Respuesta para el cajero: lo que registró, sin costos ni decisiones. */
export function retiroParaCajero(r: RetiroCompleto) {
  return {
    id: r.id,
    createdAt: r.createdAt,
    beneficiarioTipo: r.beneficiarioTipo,
    beneficiarioNombre: r.beneficiarioNombre,
    valorComercial: moneyToNumber(r.valorComercialDecimal),
    cantidadLineas: r.cantidadLineas,
    lineas: r.lineas.map((l) => ({ nombre: l.nombre, varianteNombre: l.varianteNombre, cantidad: l.cantidad, precioUnitario: moneyToNumber(l.precioUnitarioDecimal), subtotal: moneyToNumber(l.subtotalDecimal) })),
  }
}

/** Respuesta para el dueño: todo, con los valores vigentes. */
export function retiroParaDueno(r: RetiroCompleto) {
  const v = valoresRetiro(r)
  const devueltoPorLinea = new Map<string, number>()
  for (const d of r.devoluciones) for (const l of d.lineas) devueltoPorLinea.set(l.retiroLineaId, (devueltoPorLinea.get(l.retiroLineaId) ?? 0) + l.cantidad)
  const decision = r.decisionItems.find((i) => i.vigente)?.decision ?? null
  return {
    id: r.id,
    createdAt: r.createdAt,
    estado: r.estado,
    beneficiarioTipo: r.beneficiarioTipo,
    beneficiarioId: r.beneficiarioEmpleadoId ?? r.beneficiarioFamiliarId ?? null,
    beneficiarioNombre: r.beneficiarioNombre,
    registradoPorTipo: r.registradoPorTipo,
    registradoPorNombre: r.registradoPorNombre,
    turnoCajaId: r.turnoCajaId,
    observaciones: r.observaciones,
    valorComercial: moneyToNumber(r.valorComercialDecimal),
    costoConocido: moneyToNumber(r.costoConocidoDecimal),
    costoCompleto: r.costoCompleto,
    valorVigente: moneyToNumber(v.valorVigente),
    costoVigente: moneyToNumber(v.costoVigente),
    valorDevuelto: moneyToNumber(v.valorDevuelto),
    admiteDecision: r.beneficiarioTipo === "EMPLEADO",
    decision: decision ? { id: decision.id, importeRecuperar: moneyToNumber(decision.importeRecuperarDecimal), asignado: moneyToNumber(v.asignado), motivo: decision.motivo, decididoPorNombre: decision.decididoPorNombre, createdAt: decision.createdAt } : null,
    lineas: r.lineas.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      varianteNombre: l.varianteNombre,
      cantidad: l.cantidad,
      devuelto: devueltoPorLinea.get(l.id) ?? 0,
      precioUnitario: moneyToNumber(l.precioUnitarioDecimal),
      subtotal: moneyToNumber(l.subtotalDecimal),
      costoUnitario: l.costoUnitarioDecimal ? l.costoUnitarioDecimal.toNumber() : null,
      costoTotal: l.costoTotalDecimal ? moneyToNumber(l.costoTotalDecimal) : null,
      movioStock: l.movioStock,
    })),
    devoluciones: r.devoluciones.map((d) => ({ id: d.id, tipo: d.tipo, motivo: d.motivo, registradoPorNombre: d.registradoPorNombre, valor: moneyToNumber(d.valorDecimal), createdAt: d.createdAt })),
  }
}

// ---------------------------------------------------------------------------
// Contexto del formulario (beneficiarios elegibles) y permisos
// ---------------------------------------------------------------------------

export async function contextoRetiro(db: Db, negocioId: string, actor: ActorRetiro) {
  if (actor.tipo === "EMPLEADO") {
    const e = await db.empleado.findFirst({ where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false }, select: { retiroPersonalHabilitado: true } })
    if (!e?.retiroPersonalHabilitado) return { habilitado: false as const, empleados: [], familiares: [], dueno: null }
  }
  const [empleados, familiares, negocio] = await Promise.all([
    db.empleado.findMany({ where: { negocioId, activo: true, eliminado: false }, select: { id: true, nombre: true, cuentaOperativa: { select: { nombre: true, eliminado: true } } }, orderBy: { nombre: "asc" } }),
    db.familiarRetiro.findMany({ where: { negocioId, activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
    db.negocio.findUnique({ where: { id: negocioId }, select: { nombre: true } }),
  ])
  return {
    habilitado: true as const,
    propioEmpleadoId: actor.tipo === "EMPLEADO" ? actor.empleadoId : null,
    empleados: empleados.map((e) => ({ id: e.id, nombre: nombreVisibleEmpleado(e) })),
    familiares,
    dueno: { nombre: negocio?.nombre ?? "Dueño" },
  }
}

/** Empleados de Caja del negocio con el estado de su permiso (para el dueño). */
export async function listarPermisosRetiro(db: Db, negocioId: string) {
  const filas = await db.empleado.findMany({
    where: { negocioId, activo: true, eliminado: false },
    select: { id: true, nombre: true, rol: true, areaOperativa: true, retiroPersonalHabilitado: true, cuentaOperativa: { select: { nombre: true, eliminado: true } } },
    orderBy: { nombre: "asc" },
  })
  return filas
    .filter((e) => resolveAreaOperativaEfectiva({ areaOperativa: e.areaOperativa, rol: e.rol }) === "caja" || e.retiroPersonalHabilitado)
    .map((e) => ({ id: e.id, nombre: nombreVisibleEmpleado(e), habilitado: e.retiroPersonalHabilitado, areaCaja: resolveAreaOperativaEfectiva({ areaOperativa: e.areaOperativa, rol: e.rol }) === "caja" }))
}

export async function guardarPermisoRetiro(db: Db, negocioId: string, input: { empleadoId: string; habilitado: boolean }): Promise<{ ok: true } | Rechazo> {
  return db.$transaction(async (tx) => {
    const e = await tx.empleado.findFirst({ where: { id: input.empleadoId, negocioId, eliminado: false }, select: { id: true, rol: true, areaOperativa: true, retiroPersonalHabilitado: true } })
    if (!e) return rechazo(404, "Empleado no encontrado.")
    if (input.habilitado && resolveAreaOperativaEfectiva({ areaOperativa: e.areaOperativa, rol: e.rol }) !== "caja") return rechazo(409, "Sólo un empleado del área Caja puede registrar retiros.", "EMPLEADO_NO_ES_CAJA")
    if (e.retiroPersonalHabilitado === input.habilitado) return { ok: true as const }
    await tx.empleado.update({ where: { id: e.id }, data: { retiroPersonalHabilitado: input.habilitado } })
    await auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: "empleado.permiso_retiro_personal", recurso: "empleado", recursoId: e.id, detalle: { habilitado: input.habilitado } })
    return { ok: true as const }
  })
}

// ---------------------------------------------------------------------------
// Listado y resumen (dueño)
// ---------------------------------------------------------------------------

export interface FiltroRetiros {
  desde: Date
  hasta: Date
  tipo?: BeneficiarioTipo
  /** "EMPLEADO:<id>" | "FAMILIAR:<id>" | "DUENO" */
  persona?: string
}

export function parseFiltroRetiros(params: URLSearchParams): { ok: true; value: FiltroRetiros } | { ok: false; error: string } {
  const desde = new Date(params.get("desde") ?? "")
  const hasta = new Date(params.get("hasta") ?? "")
  if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime()) || desde >= hasta) return { ok: false, error: "Indicá un período válido." }
  if (hasta.getTime() - desde.getTime() > RETIRO_RANGO_MAX_DIAS * 86_400_000) return { ok: false, error: `El período admite hasta ${RETIRO_RANGO_MAX_DIAS} días.` }
  const tipo = params.get("tipo")
  if (tipo && !(BENEFICIARIO_TIPOS as readonly string[]).includes(tipo)) return { ok: false, error: "Tipo de beneficiario inválido." }
  const persona = params.get("persona")
  if (persona && !/^(EMPLEADO|FAMILIAR):[A-Za-z0-9_-]{1,64}$|^DUENO$/.test(persona)) return { ok: false, error: "Persona inválida." }
  return { ok: true, value: { desde, hasta, ...(tipo ? { tipo: tipo as BeneficiarioTipo } : {}), ...(persona ? { persona } : {}) } }
}

export function claveBeneficiario(r: Pick<RetiroCompleto, "beneficiarioTipo" | "beneficiarioEmpleadoId" | "beneficiarioFamiliarId">): string {
  return r.beneficiarioTipo === "EMPLEADO" ? `EMPLEADO:${r.beneficiarioEmpleadoId}` : r.beneficiarioTipo === "FAMILIAR" ? `FAMILIAR:${r.beneficiarioFamiliarId}` : "DUENO"
}

function wherePersona(persona: string | undefined): Prisma.RetiroPersonalWhereInput {
  if (!persona) return {}
  if (persona === "DUENO") return { beneficiarioTipo: "DUENO" }
  const [tipo, id] = persona.split(":")
  return tipo === "EMPLEADO" ? { beneficiarioTipo: "EMPLEADO", beneficiarioEmpleadoId: id } : { beneficiarioTipo: "FAMILIAR", beneficiarioFamiliarId: id }
}

export async function listarRetiros(db: Db, negocioId: string, f: FiltroRetiros) {
  return db.retiroPersonal.findMany({
    where: { negocioId, createdAt: { gte: f.desde, lt: f.hasta }, ...(f.tipo ? { beneficiarioTipo: f.tipo } : {}), ...wherePersona(f.persona) },
    include: RETIRO_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 2000,
  })
}

export function resumirRetiros(retiros: ReadonlyArray<RetiroCompleto>) {
  const cero = () => new Prisma.Decimal(0)
  const porTipo: Record<BeneficiarioTipo, Prisma.Decimal> = { EMPLEADO: cero(), FAMILIAR: cero(), DUENO: cero() }
  let valor = cero(), costo = cero(), decidido = cero(), pendiente = cero()
  let vigentes = 0, anulados = 0, costoIncompleto = 0
  const personas = new Map<string, { clave: string; tipo: string; nombre: string; cantidad: number; valor: Prisma.Decimal; costo: Prisma.Decimal; decidido: Prisma.Decimal; pendiente: Prisma.Decimal; ultimo: Date }>()
  for (const r of retiros) {
    const v = valoresRetiro(r)
    if (r.estado === "ANULADO") anulados++
    else vigentes++
    if (r.estado !== "ANULADO" && !r.costoCompleto) costoIncompleto++
    valor = valor.plus(v.valorVigente)
    costo = costo.plus(v.costoVigente)
    porTipo[r.beneficiarioTipo as BeneficiarioTipo] = porTipo[r.beneficiarioTipo as BeneficiarioTipo].plus(v.valorVigente)
    const sinDecision = r.beneficiarioTipo === "EMPLEADO" && !v.decisionVigenteId ? v.valorVigente : cero()
    decidido = decidido.plus(v.asignado)
    pendiente = pendiente.plus(sinDecision)
    const clave = claveBeneficiario(r)
    const p = personas.get(clave) ?? { clave, tipo: r.beneficiarioTipo, nombre: r.beneficiarioNombre, cantidad: 0, valor: cero(), costo: cero(), decidido: cero(), pendiente: cero(), ultimo: r.createdAt }
    if (r.createdAt >= p.ultimo) { p.nombre = r.beneficiarioNombre; p.ultimo = r.createdAt }
    if (r.estado !== "ANULADO") p.cantidad++
    p.valor = p.valor.plus(v.valorVigente)
    p.costo = p.costo.plus(v.costoVigente)
    p.decidido = p.decidido.plus(v.asignado)
    p.pendiente = p.pendiente.plus(sinDecision)
    personas.set(clave, p)
  }
  const n = moneyToNumber
  return {
    valorComercial: n(valor),
    costoConocido: n(costo),
    retirosConCostoIncompleto: costoIncompleto,
    cantidadRetiros: vigentes,
    cantidadAnulados: anulados,
    porTipo: { EMPLEADO: n(porTipo.EMPLEADO), FAMILIAR: n(porTipo.FAMILIAR), DUENO: n(porTipo.DUENO) },
    importeDecididoRecuperar: n(decidido),
    importePendienteDecision: n(pendiente),
    /** Esta entrega no registra cobros ni descuentos: no hay importe recuperado (nunca se deduce de la decisión). */
    importeRecuperadoRegistrado: null,
    personas: [...personas.values()]
      .sort((a, b) => b.valor.comparedTo(a.valor) || a.nombre.localeCompare(b.nombre))
      .map((p) => ({ clave: p.clave, tipo: p.tipo, nombre: p.nombre, cantidad: p.cantidad, valor: n(p.valor), costo: n(p.costo), decidido: n(p.decidido), pendiente: n(p.pendiente) })),
  }
}

// ---------------------------------------------------------------------------
// Decisiones de recuperación (dueño; informativas)
// ---------------------------------------------------------------------------

export function parseDecisionBody(body: unknown): { ok: true; value: { empleadoId: string; retiroIds: string[]; importe: Prisma.Decimal; motivo: string | null; reemplazaDecisionId: string | null } } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  if (typeof b.empleadoId !== "string" || !b.empleadoId) return { ok: false, error: "Indicá el empleado." }
  if (!Array.isArray(b.retiroIds) || b.retiroIds.length === 0 || b.retiroIds.length > 500 || !b.retiroIds.every((x) => typeof x === "string" && x)) return { ok: false, error: "Elegí al menos un retiro." }
  const retiroIds = [...new Set(b.retiroIds as string[])]
  if (retiroIds.length !== b.retiroIds.length) return { ok: false, error: "Hay retiros repetidos en la selección." }
  const importe = parseImporte(b.importe)
  if (!importe) return { ok: false, error: "Indicá un importe válido (0 o más)." }
  let motivo: string | null = null
  if (b.motivo !== undefined && b.motivo !== null) {
    if (typeof b.motivo !== "string" || b.motivo.trim().length > RETIRO_MOTIVO_MAX) return { ok: false, error: "Motivo inválido." }
    motivo = b.motivo.trim() || null
  }
  const reemplaza = b.reemplazaDecisionId
  if (reemplaza !== undefined && reemplaza !== null && (typeof reemplaza !== "string" || !reemplaza)) return { ok: false, error: "Decisión a reemplazar inválida." }
  return { ok: true, value: { empleadoId: b.empleadoId, retiroIds, importe, motivo, reemplazaDecisionId: (reemplaza as string | undefined) ?? null } }
}

async function bloquearRetiros(tx: Tx, negocioId: string, ids: string[]) {
  if (ids.length === 0) return
  await tx.$queryRaw`SELECT "id" FROM "retiros_personales" WHERE "negocioId" = ${negocioId} AND "id" = ANY(${ids}::text[]) ORDER BY "id" FOR UPDATE`
}

export async function registrarDecisionRecupero(
  db: Db,
  negocioId: string,
  input: { empleadoId: string; retiroIds: string[]; importe: Prisma.Decimal; motivo: string | null; reemplazaDecisionId: string | null }
): Promise<{ ok: true; decisionId: string } | Rechazo> {
  return runStockSerializable(db, async (tx) => {
    const negocio = await tx.negocio.findUnique({ where: { id: negocioId }, select: { nombre: true } })
    if (!negocio) return rechazo(403, "Acceso denegado")
    let anterior: { id: string; items: Array<{ retiroId: string }> } | null = null
    if (input.reemplazaDecisionId) {
      anterior = await tx.decisionRecuperoRetiro.findFirst({ where: { id: input.reemplazaDecisionId, negocioId, empleadoId: input.empleadoId, estado: "VIGENTE" }, select: { id: true, items: { where: { vigente: true }, select: { retiroId: true } } } })
      if (!anterior) return rechazo(409, "La decisión que querés modificar ya no está vigente. Actualizá la pantalla.", "DECISION_NO_VIGENTE")
    }
    await bloquearRetiros(tx, negocioId, [...new Set([...input.retiroIds, ...(anterior?.items.map((i) => i.retiroId) ?? [])])])
    const retiros = await tx.retiroPersonal.findMany({ where: { id: { in: input.retiroIds }, negocioId }, include: RETIRO_INCLUDE })
    if (retiros.length !== input.retiroIds.length) return rechazo(404, "Alguno de los retiros no existe.")
    for (const r of retiros) {
      if (r.beneficiarioTipo !== "EMPLEADO" || r.beneficiarioEmpleadoId !== input.empleadoId) return rechazo(409, "Todos los retiros deben ser del mismo empleado.", "RETIRO_DE_OTRA_PERSONA")
      if (r.estado !== "VIGENTE") return rechazo(409, "Un retiro anulado no admite decisiones.", "RETIRO_ANULADO")
      const item = r.decisionItems.find((i) => i.vigente)
      if (item && item.decisionId !== anterior?.id) return rechazo(409, "Alguno de los retiros ya tiene una decisión. Modificá esa decisión en lugar de crear otra.", "RETIRO_YA_DECIDIDO")
    }
    const elegibles = retiros.map((r) => ({ id: r.id, createdAt: r.createdAt, elegible: valoresRetiro(r).valorVigente }))
    if (elegibles.some((e) => !e.elegible.gt(0))) return rechazo(409, "Alguno de los retiros ya no tiene valor elegible (fue devuelto).", "SIN_VALOR_ELEGIBLE")
    const asignacion = asignarImporteDecision(elegibles, input.importe)
    if (!asignacion) return rechazo(409, "El importe a recuperar no puede superar el valor de los retiros elegidos.", "IMPORTE_EXCEDE_ELEGIBLE")
    if (anterior) {
      await tx.decisionRecuperoRetiroItem.updateMany({ where: { decisionId: anterior.id, negocioId, vigente: true }, data: { vigente: false } })
      await tx.decisionRecuperoRetiro.update({ where: { id: anterior.id }, data: { estado: "REEMPLAZADA", finalizadaEn: new Date() } })
    }
    const total = addMoney(...asignacion.map((a) => a.elegible))
    const decision = await tx.decisionRecuperoRetiro.create({
      data: {
        negocioId,
        empleadoId: input.empleadoId,
        importeRecuperarDecimal: input.importe,
        valorElegibleDecimal: total,
        motivo: input.motivo,
        decididoPorNombre: negocio.nombre,
        reemplazaDecisionId: anterior?.id ?? null,
        items: { create: asignacion.map((a) => ({ negocioId, retiroId: a.id, elegibleAlDecidirDecimal: a.elegible, asignadoDecimal: a.asignado })) },
      },
      select: { id: true },
    })
    await auditLogWithClient(tx, {
      userId: negocioId,
      userType: "negocio",
      accion: "retiro_personal.decision_registrada",
      recurso: "decision_recupero_retiro",
      recursoId: decision.id,
      detalle: { empleadoId: input.empleadoId, retiros: asignacion.map((a) => ({ id: a.id, elegible: a.elegible.toFixed(2), asignado: a.asignado.toFixed(2) })), importeRecuperar: input.importe.toFixed(2), valorElegible: total.toFixed(2), reemplaza: anterior?.id ?? null, motivo: input.motivo },
    })
    return { ok: true as const, decisionId: decision.id }
  })
}

/** «Volver a pendiente»: la decisión queda ANULADA (historial conservado) y sus retiros vuelven a estar sin decisión. */
export async function anularDecisionRecupero(db: Db, negocioId: string, decisionId: string, motivo: string | null): Promise<{ ok: true } | Rechazo> {
  return runStockSerializable(db, async (tx) => {
    const d = await tx.decisionRecuperoRetiro.findFirst({ where: { id: decisionId, negocioId }, select: { id: true, estado: true, empleadoId: true, items: { where: { vigente: true }, select: { retiroId: true } } } })
    if (!d) return rechazo(404, "Decisión no encontrada.")
    if (d.estado !== "VIGENTE") return rechazo(409, "La decisión ya no está vigente.", "DECISION_NO_VIGENTE")
    await bloquearRetiros(tx, negocioId, d.items.map((i) => i.retiroId))
    await tx.decisionRecuperoRetiroItem.updateMany({ where: { decisionId: d.id, negocioId, vigente: true }, data: { vigente: false } })
    await tx.decisionRecuperoRetiro.update({ where: { id: d.id }, data: { estado: "ANULADA", finalizadaEn: new Date() } })
    await auditLogWithClient(tx, { userId: negocioId, userType: "negocio", accion: "retiro_personal.decision_anulada", recurso: "decision_recupero_retiro", recursoId: d.id, detalle: { empleadoId: d.empleadoId, retiros: d.items.map((i) => i.retiroId), motivo } })
    return { ok: true as const }
  })
}

/** Historial completo de decisiones de un empleado (vigentes, reemplazadas y anuladas). */
export async function historialDecisiones(db: Db, negocioId: string, empleadoId: string) {
  const filas = await db.decisionRecuperoRetiro.findMany({ where: { negocioId, empleadoId }, include: { items: true }, orderBy: { createdAt: "desc" }, take: 200 })
  return filas.map((d) => ({
    id: d.id,
    estado: d.estado,
    importeRecuperar: moneyToNumber(d.importeRecuperarDecimal),
    valorElegible: moneyToNumber(d.valorElegibleDecimal),
    motivo: d.motivo,
    decididoPorNombre: d.decididoPorNombre,
    reemplazaDecisionId: d.reemplazaDecisionId,
    createdAt: d.createdAt,
    finalizadaEn: d.finalizadaEn,
    retiros: d.items.map((i) => ({ retiroId: i.retiroId, elegible: moneyToNumber(i.elegibleAlDecidirDecimal), asignado: moneyToNumber(i.asignadoDecimal) })),
  }))
}

// ---------------------------------------------------------------------------
// Anulación por error de registro / devolución física (dueño)
// ---------------------------------------------------------------------------

export type DevolucionEntrada = { tipo: "ANULACION"; motivo: string } | { tipo: "DEVOLUCION"; motivo: string; lineas: Array<{ lineaId: string; cantidad: number }> }

export function parseDevolucionBody(body: unknown): { ok: true; value: DevolucionEntrada } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const motivo = typeof b.motivo === "string" ? b.motivo.trim() : ""
  if (!motivo || motivo.length > RETIRO_MOTIVO_MAX) return { ok: false, error: "Indicá el motivo." }
  if (b.tipo === "ANULACION") {
    if (b.confirmado !== true) return { ok: false, error: "Confirmá la anulación." }
    return { ok: true, value: { tipo: "ANULACION", motivo } }
  }
  if (b.tipo !== "DEVOLUCION") return { ok: false, error: "Tipo inválido." }
  if (!Array.isArray(b.lineas) || b.lineas.length === 0) return { ok: false, error: "Indicá qué se devolvió." }
  const lineas: Array<{ lineaId: string; cantidad: number }> = []
  const vistos = new Set<string>()
  for (const raw of b.lineas as unknown[]) {
    const l = (raw ?? {}) as { lineaId?: unknown; cantidad?: unknown }
    if (typeof l.lineaId !== "string" || !l.lineaId || typeof l.cantidad !== "number" || !Number.isFinite(l.cantidad) || l.cantidad <= 0) return { ok: false, error: "Cada línea requiere lineaId y una cantidad mayor a 0." }
    if (vistos.has(l.lineaId)) return { ok: false, error: "Hay líneas repetidas." }
    vistos.add(l.lineaId)
    lineas.push({ lineaId: l.lineaId, cantidad: l.cantidad })
  }
  return { ok: true, value: { tipo: "DEVOLUCION", motivo, lineas } }
}

export function huellaDevolucion(retiroId: string, e: DevolucionEntrada): string {
  const canonical = JSON.stringify({ retiroId, tipo: e.tipo, motivo: e.motivo, lineas: e.tipo === "DEVOLUCION" ? e.lineas.map((l) => [l.lineaId, l.cantidad]) : [] })
  return createHash("sha256").update(`T7-F1-DEVOLUCION\n${canonical}`).digest("hex")
}

export async function registrarDevolucionRetiro(
  db: Db,
  input: { negocioId: string; retiroId: string; entrada: DevolucionEntrada; idempotencyKey: string }
): Promise<{ ok: true; replayed: boolean; retiro: RetiroCompleto } | Rechazo> {
  const { negocioId, retiroId, entrada, idempotencyKey } = input
  const fingerprint = huellaDevolucion(retiroId, entrada)
  const replay = async (client: Tx | Db) => {
    const previa = await client.devolucionRetiroPersonal.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey } }, select: { idempotencyFingerprint: true, retiroId: true } })
    if (!previa) return null
    if (previa.idempotencyFingerprint !== fingerprint) return rechazo(409, "Esta clave de operación ya se usó para otra corrección.", "IDEMPOTENCY_KEY_REUSED")
    return { ok: true as const, replayed: true, retiro: await client.retiroPersonal.findUniqueOrThrow({ where: { id: previa.retiroId }, include: RETIRO_INCLUDE }) }
  }
  try {
    return await runStockSerializable(db, async (tx) => {
      const previa = await replay(tx)
      if (previa) return previa
      const negocio = await tx.negocio.findUnique({ where: { id: negocioId }, select: { nombre: true } })
      if (!negocio) return rechazo(403, "Acceso denegado")
      await bloquearRetiros(tx, negocioId, [retiroId])
      const retiro = await tx.retiroPersonal.findFirst({ where: { id: retiroId, negocioId }, include: RETIRO_INCLUDE })
      if (!retiro) return rechazo(404, "Retiro no encontrado.")
      if (retiro.estado !== "VIGENTE") return rechazo(409, "El retiro ya fue anulado.", "RETIRO_ANULADO")
      const devuelto = new Map<string, number>()
      const valorDevueltoLinea = new Map<string, Prisma.Decimal>()
      const costoDevueltoLinea = new Map<string, Prisma.Decimal>()
      for (const d of retiro.devoluciones) for (const l of d.lineas) {
        devuelto.set(l.retiroLineaId, (devuelto.get(l.retiroLineaId) ?? 0) + l.cantidad)
        valorDevueltoLinea.set(l.retiroLineaId, (valorDevueltoLinea.get(l.retiroLineaId) ?? new Prisma.Decimal(0)).plus(l.valorDecimal))
        if (l.costoDecimal) costoDevueltoLinea.set(l.retiroLineaId, (costoDevueltoLinea.get(l.retiroLineaId) ?? new Prisma.Decimal(0)).plus(l.costoDecimal))
      }
      const restante = (lineaId: string, cantidad: number) => Math.max(0, cantidad - (devuelto.get(lineaId) ?? 0))
      const pedidas = entrada.tipo === "ANULACION"
        ? retiro.lineas.filter((l) => restante(l.id, l.cantidad) > 1e-9).map((l) => ({ linea: l, cantidad: restante(l.id, l.cantidad) }))
        : entrada.lineas.map((p) => ({ linea: retiro.lineas.find((l) => l.id === p.lineaId), cantidad: p.cantidad }))
      if (pedidas.length === 0) return rechazo(409, "No queda mercadería pendiente en este retiro.", "NADA_PARA_DEVOLVER")
      const calculadas: Array<{ linea: (typeof retiro.lineas)[number]; cantidad: number; valor: Prisma.Decimal; costo: Prisma.Decimal | null }> = []
      for (const p of pedidas) {
        if (!p.linea) return rechazo(400, "Una de las líneas no pertenece a este retiro.")
        const quedan = restante(p.linea.id, p.linea.cantidad)
        if (p.cantidad > quedan + 1e-9) return rechazo(409, `«${p.linea.nombre}»: sólo quedan ${quedan} por devolver.`, "DEVOLUCION_EXCEDE_RETIRADO")
        const completa = Math.abs(p.cantidad - quedan) <= 1e-9
        // La última devolución de una línea toma el remanente exacto (sin centavos sueltos por redondeo).
        const valor = completa ? p.linea.subtotalDecimal.minus(valorDevueltoLinea.get(p.linea.id) ?? 0) : round2(p.linea.precioUnitarioDecimal.times(p.cantidad))
        const costo = !p.linea.costoUnitarioDecimal || !p.linea.costoTotalDecimal
          ? null
          : completa ? p.linea.costoTotalDecimal.minus(costoDevueltoLinea.get(p.linea.id) ?? 0) : round2(p.linea.costoUnitarioDecimal.times(p.cantidad))
        calculadas.push({ linea: p.linea, cantidad: completa ? quedan : p.cantidad, valor: Prisma.Decimal.max(0, valor), costo: costo ? Prisma.Decimal.max(0, costo) : null })
      }
      const valorDevolucion = addMoney(...calculadas.map((c) => c.valor))
      const costoDevolucion = addMoney(...calculadas.filter((c) => c.costo).map((c) => c.costo!))
      // Una decisión vigente nunca puede quedar por encima del valor elegible: se pide revisarla antes (no se cambia en silencio).
      const v = valoresRetiro(retiro)
      const elegibleNuevo = entrada.tipo === "ANULACION" ? new Prisma.Decimal(0) : Prisma.Decimal.max(0, v.valorVigente.minus(valorDevolucion))
      if (v.decisionVigenteId && v.asignado.gt(elegibleNuevo)) {
        return rechazo(409, "Este retiro tiene una decisión de recuperación por un importe mayor al que quedaría. Revisá primero esa decisión.", "DECISION_REQUIERE_REVISION")
      }
      const devolucion = await tx.devolucionRetiroPersonal.create({
        data: { negocioId, retiroId, tipo: entrada.tipo, motivo: entrada.motivo, registradoPorNombre: negocio.nombre, valorDecimal: valorDevolucion, costoConocidoDecimal: costoDevolucion, idempotencyKey, idempotencyFingerprint: fingerprint },
        select: { id: true },
      })
      let reingresadas = 0
      for (const c of calculadas) {
        // Sólo vuelve al stock lo que salió del stock en el retiro (nunca stock que no se descontó).
        const reingreso = c.linea.movioStock && c.linea.productoId
          ? await reingresarStockRetiroPersonal(tx, { negocioId, devolucionRetiroId: devolucion.id, key: { productoId: c.linea.productoId, productoVarianteId: c.linea.productoVarianteId }, cantidad: c.cantidad, motivo: entrada.tipo === "ANULACION" ? "Anulación de retiro personal" : "Devolución de retiro personal" })
          : null
        if (reingreso?.resultado === "REINGRESADO") reingresadas++
        await tx.devolucionRetiroLinea.create({ data: { negocioId, devolucionId: devolucion.id, retiroLineaId: c.linea.id, cantidad: c.cantidad, valorDecimal: c.valor, costoDecimal: c.costo, reingresoStock: reingreso?.resultado === "REINGRESADO" } })
      }
      if (entrada.tipo === "ANULACION") await tx.retiroPersonal.update({ where: { id: retiroId }, data: { estado: "ANULADO" } })
      await auditLogWithClient(tx, {
        userId: negocioId,
        userType: "negocio",
        accion: entrada.tipo === "ANULACION" ? "retiro_personal.anulado" : "retiro_personal.devolucion",
        recurso: "retiro_personal",
        recursoId: retiroId,
        detalle: { devolucionId: devolucion.id, motivo: entrada.motivo, valor: valorDevolucion.toFixed(2), lineas: calculadas.map((c) => ({ lineaId: c.linea.id, cantidad: c.cantidad })), lineasReingresadas: reingresadas },
      })
      return { ok: true as const, replayed: false, retiro: await tx.retiroPersonal.findUniqueOrThrow({ where: { id: retiroId }, include: RETIRO_INCLUDE }) }
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      const previa = await replay(db)
      if (previa) return previa
    }
    throw error
  }
}
