// ============================================
// F5-A — motor ÚNICO de cuenta corriente de proveedores (server only)
// ============================================
// ÚNICO escritor de obligaciones_proveedor, creditos_proveedor, eventos_cuenta_proveedor,
// operaciones_asignacion y asignaciones_pago. Diseño v2 §4, §5, §7, §10.
//
//   OBLIGACIÓN  lo que se le debe al proveedor (F5-A: SALDO_INICIAL | AJUSTE_DEUDA)
//   CRÉDITO     lo que reduce la deuda (PAGO_CAJA | PAGO_DECLARADO | AJUSTE_A_FAVOR)
//   ASIGNACIÓN  parte de un crédito EFECTIVO atribuida a una obligación VIGENTE del mismo
//               proveedor; nunca se borra: se DESAFECTA con otra fila (append-only)
//
// Fórmulas (§4.2) — la deuda no es dinero; nada de esto tiene patas en el libro financiero:
//   asignado(x)                 = Σ ASIGNACION vigentes de x (no desafectadas)
//   pendiente(obligación)       = importe − asignado(obligación)                      (obligaciones VIGENTES)
//   disponible(crédito)         = importe − asignado(crédito)                          (créditos EFECTIVOS)
//   deudaVigente                = Σ importe de obligaciones VIGENTES
//   obligacionesPendientes      = Σ pendiente(obligaciones VIGENTES)
//   creditosConfirmados         = Σ importe de créditos EFECTIVOS (VIGENTE | CONFIRMADO_DUENO)
//   creditosAsignados           = Σ asignado(créditos EFECTIVOS)
//   anticiposDisponibles        = creditosConfirmados − creditosAsignados
//   pagosDeclaradosPendientes   = Σ importe de PAGO_DECLARADO en estado DECLARADO (NO resta)
//   saldoNeto (con signo)       = deudaVigente − creditosConfirmados
//                               = obligacionesPendientes − anticiposDisponibles   (identidad verificada)
//   deudaExigible               = max(saldoNeto, 0)    (nunca negativa)
//   saldoAFavor                 = max(−saldoNeto, 0)   (créditos confirmados que superan toda la deuda)
// anticiposDisponibles (pagos confirmados aún sin asignar) ≠ saldoAFavor: puede haber anticipos sin asignar
// y a la vez deuda exigible (falta asignarlos). Las asignaciones sólo atribuyen: no cambian ningún saldo
// ni pueden descontar dos veces.
//
// Cada acción económica: Serializable con reintento acotado, Idempotency-Key + huella
// (replay 200, clave reutilizada 409), auditoría en la MISMA transacción (R1), y las mismas
// invariantes repetidas en SQL (triggers). El negocio sale siempre de la sesión.

import { createHash } from "node:crypto"
import { Prisma, type PrismaClient } from "@prisma/client"
import { moneyToNumber } from "@/lib/money"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { runSerializable } from "@/lib/caja-devoluciones-service"
import { parseImporteEgreso } from "@/lib/caja-egresos-service"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
const D = Prisma.Decimal
const CERO = new D(0)

export type CuentaResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 409; error: string; code?: string; detalle?: Record<string, unknown> }

const fail = (status: 400 | 404 | 409, error: string, code?: string, detalle?: Record<string, unknown>) =>
  ({ ok: false as const, status, error, ...(code ? { code } : {}), ...(detalle ? { detalle } : {}) })

// ---------------------------------------------------------------------------
// Vocabulario
// ---------------------------------------------------------------------------

export const ORIGENES_OBLIGACION_F5A = ["SALDO_INICIAL", "AJUSTE_DEUDA"] as const
export const NATURALEZAS_AJUSTE_DEUDA = ["ERROR_DE_CARGA", "DIFERENCIA_ACORDADA", "RECARGO", "OTRO"] as const
export const NATURALEZAS_AJUSTE_FAVOR = ["ERROR_DE_CARGA", "BONIFICACION", "DIFERENCIA_ACORDADA", "OTRO"] as const
export const MEDIOS_DECLARADOS = ["TRANSFERENCIA", "MERCADO_PAGO", "OTRO"] as const
export const ESTADOS_CREDITO_EFECTIVO = ["VIGENTE", "CONFIRMADO_DUENO"] as const
export const MAX_RENGLONES_ASIGNACION = 50
const TEXTO_MAX = 500

export const esCreditoEfectivo = (estado: string) => (ESTADOS_CREDITO_EFECTIVO as readonly string[]).includes(estado)

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

function texto(value: unknown, max: number): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== "string") return { ok: false }
  const t = value.trim().replace(/\s+/g, " ")
  if (!t) return { ok: true, value: null }
  return t.length <= max ? { ok: true, value: t } : { ok: false }
}

/** Fecha "YYYY-MM-DD" o ISO; nunca en el futuro lejano (más de 1 día). */
function fecha(value: unknown, porDefecto: Date | null): { ok: true; value: Date | null } | { ok: false } {
  if (value === undefined || value === null || value === "") return { ok: true, value: porDefecto }
  if (typeof value !== "string") return { ok: false }
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00.000Z` : value)
  if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000 || d.getFullYear() < 2000) return { ok: false }
  return { ok: true, value: d }
}

const huella = (partes: unknown[]) => createHash("sha256").update(JSON.stringify(partes)).digest("hex")

function claveValida(key: string): string | null {
  return isValidVentaIdempotencyKey(key) ? key.toLowerCase() : null
}
const CLAVE_REQUERIDA = fail(400, "Falta una Idempotency-Key válida.", "IDEMPOTENCY_KEY_REQUIRED")
const CLAVE_REUSADA = fail(409, "Este intento ya se usó con otros datos.", "IDEMPOTENCY_KEY_REUSED")

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/** Traduce las guardas SQL (defensa en profundidad) a respuestas controladas. */
export function mapCuentaProveedorDbError(error: unknown): { status: 409; error: string; code: string } | null {
  const t = error instanceof Error ? error.message : String(error)
  const tabla: Array<[string, string, string]> = [
    ["assignment exceeds the available credit", "El pago no tiene disponible suficiente para esa asignación.", "ASIGNACION_EXCEDE_CREDITO"],
    ["assignment exceeds the pending obligation", "La asignación supera lo pendiente de esa deuda.", "ASIGNACION_EXCEDE_OBLIGACION"],
    ["only an effective supplier credit can be assigned", "Ese pago todavía no está confirmado o ya no está vigente.", "CREDITO_NO_EFECTIVO"],
    ["only an obligation in force can receive an assignment", "Esa deuda ya no está vigente.", "OBLIGACION_NO_VIGENTE"],
    ["has active assignments", "Primero desafectá las asignaciones vigentes.", "TIENE_ASIGNACIONES"],
    ["a compensated cash outflow cannot be linked", "Ese pago de Caja fue compensado: no se puede vincular.", "EGRESO_COMPENSADO"],
    ["only a supplier payment outflow can be linked", "Sólo se puede vincular un pago a proveedor de Caja.", "EGRESO_NO_ES_PAGO_PROVEEDOR"],
    ["creditos_proveedor_egreso_vigente_unico", "Ese pago de Caja ya está vinculado a un proveedor.", "PAGO_YA_VINCULADO"],
    ["obligaciones_proveedor_saldo_inicial_unico", "Ese proveedor ya tiene un saldo inicial vigente.", "SALDO_INICIAL_EXISTENTE"],
    ["unassignment must reverse exactly one assignment", "Esa asignación ya fue desafectada o no corresponde.", "ASIGNACION_NO_VIGENTE"],
  ]
  for (const [frag, error2, code] of tabla) if (t.includes(frag)) return { status: 409, error: error2, code }
  return null
}

async function conManejoDeErrores<T>(fn: () => Promise<CuentaResult<T>>, alDuplicar?: () => Promise<CuentaResult<T> | null>): Promise<CuentaResult<T>> {
  try {
    return await fn()
  } catch (error) {
    if (isUniqueViolation(error) && alDuplicar) {
      const r = await alDuplicar()
      if (r) return r
    }
    const mapped = mapCuentaProveedorDbError(error)
    if (mapped) return fail(mapped.status, mapped.error, mapped.code)
    throw error
  }
}

export async function bloquearProveedor(tx: Tx, negocioId: string, proveedorId: string) {
  const filas = await tx.$queryRaw<Array<{ id: string; activo: boolean; nombre: string }>>`
    SELECT "id", "activo", "nombre" FROM "proveedores" WHERE "id" = ${proveedorId} AND "negocioId" = ${negocioId} FOR UPDATE`
  return filas[0] ?? null
}
const PROVEEDOR_NO_ENCONTRADO = fail(404, "Proveedor no encontrado.", "PROVEEDOR_NO_ENCONTRADO")
const PROVEEDOR_INACTIVO = fail(409, "El proveedor está inactivo. Activalo para registrar movimientos.", "PROVEEDOR_INACTIVO")

/** Asignado vigente por crédito y por obligación (una sola consulta por proveedor). */
export async function asignadoVigente(db: Pick<Tx, "$queryRaw">, negocioId: string, proveedorId: string) {
  const filas = await db.$queryRaw<Array<{ creditoId: string; obligacionId: string; total: string }>>`
    SELECT a."creditoId", a."obligacionId", sum(a."importeDecimal")::text AS total
      FROM "asignaciones_pago" a
     WHERE a."negocioId" = ${negocioId} AND a."proveedorId" = ${proveedorId} AND a."tipo" = 'ASIGNACION'
       AND NOT EXISTS (SELECT 1 FROM "asignaciones_pago" d WHERE d."revierteAsignacionId" = a."id")
     GROUP BY 1, 2`
  const porCredito = new Map<string, Prisma.Decimal>()
  const porObligacion = new Map<string, Prisma.Decimal>()
  for (const f of filas) {
    const v = new D(f.total)
    porCredito.set(f.creditoId, (porCredito.get(f.creditoId) ?? CERO).plus(v))
    porObligacion.set(f.obligacionId, (porObligacion.get(f.obligacionId) ?? CERO).plus(v))
  }
  return { porCredito, porObligacion }
}

export type AuditoriaEnTx = (tx: Tx, evento: { accion: string; recursoId: string; detalle: Record<string, unknown> }) => Promise<void>

// ---------------------------------------------------------------------------
// Obligaciones: saldo inicial / ajuste de deuda / anulación
// ---------------------------------------------------------------------------

export async function registrarObligacion(
  db: Db,
  input: { negocioId: string; proveedorId: string; body: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<CuentaResult<{ obligacionId: string; replayed: boolean }>> {
  const { negocioId, proveedorId } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>
  if (typeof b.origen !== "string" || !(ORIGENES_OBLIGACION_F5A as readonly string[]).includes(b.origen)) {
    return fail(400, "Elegí si es un saldo inicial o un ajuste de deuda.", "ORIGEN_INVALIDO")
  }
  const origen = b.origen as (typeof ORIGENES_OBLIGACION_F5A)[number]
  const importe = parseImporteEgreso(b.importe)
  if (!importe.ok) return fail(400, importe.error, "IMPORTE_INVALIDO")
  const desc = texto(b.descripcion, TEXTO_MAX)
  if (!desc.ok || !desc.value) return fail(400, "Escribí una descripción (hasta 500 caracteres).", "DESCRIPCION_REQUERIDA")
  let naturalezaAjuste: string | null = null
  if (origen === "AJUSTE_DEUDA") {
    if (typeof b.naturalezaAjuste !== "string" || !(NATURALEZAS_AJUSTE_DEUDA as readonly string[]).includes(b.naturalezaAjuste)) {
      return fail(400, "Elegí la naturaleza del ajuste.", "NATURALEZA_AJUSTE_INVALIDA")
    }
    naturalezaAjuste = b.naturalezaAjuste
  } else if (b.naturalezaAjuste !== undefined && b.naturalezaAjuste !== null && b.naturalezaAjuste !== "") {
    return fail(400, "La naturaleza sólo aplica a un ajuste.", "NATURALEZA_AJUSTE_INVALIDA")
  }
  const f = fecha(b.fecha, origen === "SALDO_INICIAL" ? null : new Date())
  if (!f.ok || !f.value) return fail(400, origen === "SALDO_INICIAL" ? "Indicá la fecha de corte del saldo inicial." : "La fecha no es válida.", "FECHA_INVALIDA")
  const compTipo = texto(b.comprobanteTipo, 40)
  const compNumero = texto(b.comprobanteNumero, 60)
  const compFecha = fecha(b.comprobanteFecha, null)
  if (!compTipo.ok || !compNumero.ok || !compFecha.ok) return fail(400, "Revisá los datos del comprobante.", "COMPROBANTE_INVALIDO")
  const fp = huella([negocioId, proveedorId, "OBLIGACION", origen, naturalezaAjuste, importe.value.toFixed(2), f.value.toISOString(), desc.value, compTipo.value, compNumero.value, compFecha.value?.toISOString() ?? null])

  const replay = async (client: Pick<Tx, "obligacionProveedor">): Promise<CuentaResult<{ obligacionId: string; replayed: boolean }> | null> => {
    const previa = await client.obligacionProveedor.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: { id: true, idempotencyFingerprint: true } })
    if (!previa) return null
    return previa.idempotencyFingerprint === fp ? { ok: true, value: { obligacionId: previa.id, replayed: true } } : CLAVE_REUSADA
  }
  return conManejoDeErrores(() => runSerializable(db, async (tx) => {
    const previa = await replay(tx)
    if (previa) return previa
    const prov = await bloquearProveedor(tx, negocioId, proveedorId)
    if (!prov) return PROVEEDOR_NO_ENCONTRADO
    if (!prov.activo) return PROVEEDOR_INACTIVO
    if (origen === "SALDO_INICIAL") {
      const existente = await tx.obligacionProveedor.findFirst({ where: { negocioId, proveedorId, origen: "SALDO_INICIAL", estado: "VIGENTE" }, select: { id: true } })
      if (existente) return fail(409, "Ese proveedor ya tiene un saldo inicial vigente. Para corregirlo, anulalo o registrá un ajuste.", "SALDO_INICIAL_EXISTENTE")
    }
    const o = await tx.obligacionProveedor.create({
      data: {
        negocioId, proveedorId, origen, naturalezaAjuste, importeDecimal: importe.value, fecha: f.value!, descripcion: desc.value!,
        comprobanteTipo: compTipo.value, comprobanteNumero: compNumero.value, comprobanteFecha: compFecha.value,
        actorId: negocioId, idempotencyKey: key, idempotencyFingerprint: fp,
      },
      select: { id: true },
    })
    if (opciones.auditar) await opciones.auditar(tx, { accion: "cuenta_proveedor.obligacion_registrada", recursoId: o.id, detalle: { negocioId, proveedorId, obligacionId: o.id, origen, naturalezaAjuste, importe: importe.value.toFixed(2), fecha: f.value!.toISOString() } })
    return { ok: true as const, value: { obligacionId: o.id, replayed: false } }
  }), () => replay(db))
}

/** Evento (append-only) + transición de estado en la misma transacción. */
async function crearEvento(tx: Tx, data: { negocioId: string; obligacionId?: string; creditoId?: string; tipo: string; motivo: string | null; key: string; fp: string; fecha: Date }) {
  return tx.eventoCuentaProveedor.create({
    data: { negocioId: data.negocioId, obligacionId: data.obligacionId ?? null, creditoId: data.creditoId ?? null, tipo: data.tipo, motivo: data.motivo, actorId: data.negocioId, idempotencyKey: data.key, idempotencyFingerprint: data.fp, createdAt: data.fecha },
    select: { id: true },
  })
}

async function replayEvento(client: Pick<Tx, "eventoCuentaProveedor">, negocioId: string, key: string, fp: string, objetivo: { obligacionId?: string; creditoId?: string }) {
  const previo = await client.eventoCuentaProveedor.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: { idempotencyFingerprint: true, obligacionId: true, creditoId: true } })
  if (!previo) return null
  const mismo = previo.idempotencyFingerprint === fp && (objetivo.obligacionId ? previo.obligacionId === objetivo.obligacionId : previo.creditoId === objetivo.creditoId)
  return mismo ? { ok: true as const, value: { replayed: true } } : CLAVE_REUSADA
}

export async function anularObligacion(
  db: Db,
  input: { negocioId: string; obligacionId: string; motivo: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<CuentaResult<{ replayed: boolean }>> {
  const { negocioId, obligacionId } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  const motivo = texto(input.motivo, TEXTO_MAX)
  if (!motivo.ok || !motivo.value) return fail(400, "Escribí el motivo de la anulación.", "MOTIVO_REQUERIDO")
  const fp = huella([negocioId, obligacionId, "ANULACION", motivo.value])
  return conManejoDeErrores(() => runSerializable(db, async (tx) => {
    const previo = await replayEvento(tx, negocioId, key, fp, { obligacionId })
    if (previo) return previo
    const base = await tx.obligacionProveedor.findFirst({ where: { id: obligacionId, negocioId }, select: { proveedorId: true } })
    if (!base) return fail(404, "Deuda no encontrada.", "OBLIGACION_NO_ENCONTRADA")
    await bloquearProveedor(tx, negocioId, base.proveedorId)
    const o = await tx.obligacionProveedor.findFirstOrThrow({ where: { id: obligacionId, negocioId }, select: { estado: true, importeDecimal: true, origen: true } })
    if (o.estado !== "VIGENTE") return fail(409, "Esa deuda ya estaba anulada.", "OBLIGACION_NO_VIGENTE")
    if (o.origen === "RECEPCION" || o.origen === "CARGO_ACCESORIO") {
      return fail(409, "Una deuda que nació de una recepción aprobada no se anula: corregila con un ajuste de deuda (o con una devolución al proveedor cuando esté disponible).", "OBLIGACION_DE_RECEPCION")
    }
    const { porObligacion } = await asignadoVigente(tx, negocioId, base.proveedorId)
    if ((porObligacion.get(obligacionId) ?? CERO).gt(0)) return fail(409, "Esa deuda tiene pagos asignados: desafectalos antes de anularla.", "TIENE_ASIGNACIONES")
    const ahora = new Date()
    await crearEvento(tx, { negocioId, obligacionId, tipo: "ANULACION", motivo: motivo.value, key, fp, fecha: ahora })
    await tx.obligacionProveedor.update({ where: { id: obligacionId }, data: { estado: "ANULADA", anuladaEn: ahora } })
    if (opciones.auditar) await opciones.auditar(tx, { accion: "cuenta_proveedor.obligacion_anulada", recursoId: obligacionId, detalle: { negocioId, proveedorId: base.proveedorId, obligacionId, origen: o.origen, importe: o.importeDecimal.toFixed(2), motivo: motivo.value } })
    return { ok: true as const, value: { replayed: false } }
  }), () => replayEvento(db, negocioId, key, fp, { obligacionId }))
}

// ---------------------------------------------------------------------------
// Posibles pagos duplicados (sólo ADVIERTEN: dos pagos distintos del mismo importe son legítimos)
// ---------------------------------------------------------------------------
// El efectivo que salió de Caja tiene UNA fuente: el egreso PAGO_PROVEEDOR de F10-C1, que se
// VINCULA (crédito PAGO_CAJA). Un pago declarado nunca lo representa: se exige la declaración
// explícita «no salió del efectivo de Caja» y se advierte (409 confirmable) si hay un pago de Caja
// o un pago declarado del mismo proveedor con el mismo importe y fecha, o con la misma referencia.

export type CandidatoDuplicado = {
  tipo: "PAGO_CAJA_SIN_VINCULAR" | "PAGO_CAJA_VINCULADO" | "PAGO_DECLARADO"
  id: string
  importe: number
  fecha: Date
  referencia: string | null
  estado: string | null
  caja: string | null
  coincidencia: "IMPORTE_Y_FECHA" | "REFERENCIA"
  /** Pagos E3: medio del pago parecido y pedido al que está ligado (si lo está), para decidir si es otro pago. */
  medio?: string | null
  pedido?: number | null
}
/** Un pago de Caja y su declaración pueden diferir algunos días (fecha de carga vs. fecha del pago). */
export const VENTANA_DUPLICADO_CAJA_DIAS = 3
const DIA_MS = 86_400_000
const dia = (d: Date) => d.toISOString().slice(0, 10)
export const referenciaNormalizada = (r: string | null | undefined) => (r ?? "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "")

async function pagosCajaCandidatos(tx: Tx, negocioId: string, proveedorId: string, importe: Prisma.Decimal, fecha: Date): Promise<CandidatoDuplicado[]> {
  const margen = (VENTANA_DUPLICADO_CAJA_DIAS + 1) * DIA_MS
  const egresos = await tx.egresoCaja.findMany({
    where: { negocioId, naturaleza: "PAGO_PROVEEDOR", importeDecimal: importe, compensacion: { is: null }, createdAt: { gte: new Date(fecha.getTime() - margen), lte: new Date(fecha.getTime() + margen) } },
    select: { id: true, importeDecimal: true, createdAt: true, comprobanteReferencia: true, turno: { select: { cajaFisica: { select: { nombre: true } } } }, creditosProveedor: { where: { estado: "VIGENTE" }, select: { proveedorId: true } } },
    orderBy: { createdAt: "asc" },
    take: 20,
  })
  const out: CandidatoDuplicado[] = []
  for (const e of egresos) {
    const vinculo = e.creditosProveedor[0]
    if (vinculo && vinculo.proveedorId !== proveedorId) continue // es un pago de OTRO proveedor
    out.push({ tipo: vinculo ? "PAGO_CAJA_VINCULADO" : "PAGO_CAJA_SIN_VINCULAR", id: e.id, importe: n(e.importeDecimal), fecha: e.createdAt, referencia: e.comprobanteReferencia, estado: null, caja: e.turno.cajaFisica.nombre, coincidencia: "IMPORTE_Y_FECHA" })
  }
  return out
}

async function pagosDeclaradosCandidatos(tx: Tx, negocioId: string, proveedorId: string, importe: Prisma.Decimal, fecha: Date, referencia: string | null, ventanaDias: number): Promise<CandidatoDuplicado[]> {
  const ref = referenciaNormalizada(referencia)
  const margen = (ventanaDias + 1) * DIA_MS
  const filas = await tx.creditoProveedor.findMany({
    where: {
      negocioId, proveedorId, origen: "PAGO_DECLARADO", estado: { in: ["DECLARADO", "CONFIRMADO_DUENO"] },
      OR: [{ importeDecimal: importe, fechaPago: { gte: new Date(fecha.getTime() - margen), lte: new Date(fecha.getTime() + margen) } }, ...(ref.length >= 4 ? [{ referencia: { not: null } }] : [])],
    },
    select: { id: true, importeDecimal: true, fechaPago: true, referencia: true, estado: true, createdAt: true, medio: true, compraReferencia: { select: { numero: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  })
  const out: CandidatoDuplicado[] = []
  for (const c of filas) {
    const f = c.fechaPago ?? c.createdAt
    const mismaRef = ref.length >= 4 && referenciaNormalizada(c.referencia) === ref
    const mismoImporteYFecha = c.importeDecimal.equals(importe) && (ventanaDias === 0 ? dia(f) === dia(fecha) : Math.abs(f.getTime() - fecha.getTime()) <= ventanaDias * DIA_MS + DIA_MS / 2)
    if (mismaRef || mismoImporteYFecha) out.push({ tipo: "PAGO_DECLARADO", id: c.id, importe: n(c.importeDecimal), fecha: f, referencia: c.referencia, estado: c.estado, caja: null, coincidencia: mismaRef ? "REFERENCIA" : "IMPORTE_Y_FECHA", medio: c.medio, pedido: c.compraReferencia?.numero ?? null })
  }
  return out
}

const candidatosParaRespuesta = (cs: CandidatoDuplicado[]) => cs.map((c) => ({ ...c, fecha: c.fecha.toISOString() }))

// ---------------------------------------------------------------------------
// Créditos: pago declarado / ajuste a favor / vincular pago de Caja
// ---------------------------------------------------------------------------

export async function registrarCredito(
  db: Db,
  input: {
    negocioId: string; proveedorId: string; body: unknown; idempotencyKey: string
    /** Pagos E1: pago ligado a un pedido ABIERTO del mismo proveedor (inmutable; se aplica solo a ese pedido al aprobar). */
    compraReferenciaId?: string
    /** Pagos E1: transferencia que el DUEÑO declara realizada: nace confirmada (evento CONFIRMACION en la misma transacción). */
    confirmarAlRegistrar?: boolean
    /** Pagos E2: datos extra que forman parte de la huella (p. ej. el reparto entre facturas). */
    extraHuella?: unknown[]
    /** Pagos E2: se ejecuta en la MISMA transacción, con el crédito ya creado (y confirmado). Si lanza, no queda nada. */
    alCrearEnTx?: (tx: Tx, creditoId: string) => Promise<void>
  },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<CuentaResult<{ creditoId: string; replayed: boolean }>> {
  const { negocioId, proveedorId } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>
  if (b.origen !== "PAGO_DECLARADO" && b.origen !== "AJUSTE_A_FAVOR") return fail(400, "Elegí si es un pago por transferencia u otro medio, o un ajuste a favor.", "ORIGEN_INVALIDO")
  const origen = b.origen
  const importe = parseImporteEgreso(b.importe)
  if (!importe.ok) return fail(400, importe.error, "IMPORTE_INVALIDO")
  const motivo = texto(b.motivo, TEXTO_MAX)
  if (!motivo.ok) return fail(400, "El motivo admite hasta 500 caracteres.", "MOTIVO_INVALIDO")
  let medio: string | null = null, referencia: string | null = null, cuenta: string | null = null, fechaPago: Date | null = null, naturalezaAjuste: string | null = null
  if (origen === "PAGO_DECLARADO") {
    if (typeof b.medio !== "string" || !(MEDIOS_DECLARADOS as readonly string[]).includes(b.medio)) return fail(400, "Elegí el medio del pago.", "MEDIO_INVALIDO")
    medio = b.medio
    const r = texto(b.referencia, 120), c = texto(b.cuentaOrigenDeclarada, 120), fpago = fecha(b.fechaPago, new Date())
    if (!r.ok || !c.ok) return fail(400, "La referencia y la cuenta admiten hasta 120 caracteres.", "REFERENCIA_INVALIDA")
    if (!fpago.ok) return fail(400, "La fecha del pago no es válida.", "FECHA_INVALIDA")
    referencia = r.value; cuenta = c.value; fechaPago = fpago.value
    if (b.confirmoNoSalioDeCaja !== true) {
      return fail(400, "Confirmá que este pago NO salió del efectivo de la Caja. Un pago en efectivo de Caja ya está registrado en Egresos: se vincula desde «Vincular pago de Caja», no se declara de nuevo.", "CONFIRMACION_FUERA_DE_CAJA_REQUERIDA")
    }
    if (medio === "OTRO" && !motivo.value) return fail(400, "Para «Otro medio», indicá en la nota cuál fue (por ejemplo: cheque, efectivo propio fuera de la caja).", "MEDIO_DETALLE_REQUERIDO")
  } else {
    if (typeof b.naturalezaAjuste !== "string" || !(NATURALEZAS_AJUSTE_FAVOR as readonly string[]).includes(b.naturalezaAjuste)) return fail(400, "Elegí la naturaleza del ajuste.", "NATURALEZA_AJUSTE_INVALIDA")
    if (!motivo.value) return fail(400, "Escribí el motivo del ajuste.", "MOTIVO_REQUERIDO")
    naturalezaAjuste = b.naturalezaAjuste
  }
  if ((input.compraReferenciaId || input.confirmarAlRegistrar) && origen !== "PAGO_DECLARADO") return fail(400, "Sólo un pago por transferencia u otro medio puede ligarse a un pedido o confirmarse al registrarlo.", "ORIGEN_INVALIDO")
  const extra = [...(input.compraReferenciaId ? ["PEDIDO", input.compraReferenciaId] : []), ...(input.confirmarAlRegistrar ? ["CONFIRMADO_AL_REGISTRAR"] : []), ...(input.extraHuella ?? [])]
  const fp = huella([negocioId, proveedorId, "CREDITO", origen, importe.value.toFixed(2), medio, referencia, cuenta, fechaPago?.toISOString() ?? null, naturalezaAjuste, motivo.value, ...extra])
  const replay = async (client: Pick<Tx, "creditoProveedor">): Promise<CuentaResult<{ creditoId: string; replayed: boolean }> | null> => {
    const previo = await client.creditoProveedor.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: { id: true, idempotencyFingerprint: true } })
    if (!previo) return null
    return previo.idempotencyFingerprint === fp ? { ok: true, value: { creditoId: previo.id, replayed: true } } : CLAVE_REUSADA
  }
  return conManejoDeErrores(() => runSerializable(db, async (tx) => {
    const previo = await replay(tx)
    if (previo) return previo
    const prov = await bloquearProveedor(tx, negocioId, proveedorId)
    if (!prov) return PROVEEDOR_NO_ENCONTRADO
    if (!prov.activo) return PROVEEDOR_INACTIVO
    if (input.compraReferenciaId) {
      const compra = await tx.compra.findFirst({ where: { id: input.compraReferenciaId, negocioId, proveedorId }, select: { estado: true } })
      if (!compra) return fail(404, "Pedido no encontrado para este proveedor.", "COMPRA_NO_ENCONTRADA")
      if (compra.estado !== "ABIERTA") return fail(409, "El pedido ya está cerrado o anulado: no admite pagos anticipados.", "COMPRA_NO_ABIERTA")
    }
    let advertidos: CandidatoDuplicado[] = []
    if (origen === "PAGO_DECLARADO") {
      advertidos = [...(await pagosCajaCandidatos(tx, negocioId, proveedorId, importe.value, fechaPago!)), ...(await pagosDeclaradosCandidatos(tx, negocioId, proveedorId, importe.value, fechaPago!, referencia, 0))]
      if (advertidos.length > 0 && b.confirmoNoDuplicado !== true) {
        const deCaja = advertidos.some((x) => x.tipo === "PAGO_CAJA_SIN_VINCULAR")
        return fail(409, deCaja
          ? "Hay un pago a proveedor registrado en Caja por el mismo importe y en fechas cercanas. Si es este mismo pago, vinculalo desde «Vincular pago de Caja» en vez de declararlo. Si es un pago distinto, confirmá que no es un duplicado."
          : "Ya hay un pago de este proveedor con el mismo importe y fecha, o con la misma referencia. Si es un pago distinto, confirmá que no es un duplicado.", "POSIBLE_PAGO_DUPLICADO", { candidatos: candidatosParaRespuesta(advertidos) })
      }
    }
    const c = await tx.creditoProveedor.create({
      data: {
        negocioId, proveedorId, origen, importeDecimal: importe.value, estado: origen === "PAGO_DECLARADO" ? "DECLARADO" : "VIGENTE",
        medio, referencia, cuentaOrigenDeclarada: cuenta, fechaPago, naturalezaAjuste, motivo: motivo.value,
        compraReferenciaId: input.compraReferenciaId ?? null,
        actorId: negocioId, idempotencyKey: key, idempotencyFingerprint: fp,
      },
      select: { id: true },
    })
    // Pagos E1: transferencia realizada por el dueño — una sola operación, sin segunda confirmación administrativa.
    // Es una DECLARACIÓN del dueño, no una verificación bancaria (la conciliación es F10-D).
    if (input.confirmarAlRegistrar) {
      const ahora = new Date()
      await crearEvento(tx, { negocioId, creditoId: c.id, tipo: "CONFIRMACION", motivo: "Transferencia declarada realizada por el dueño al registrarla", key: `${key}:confirmacion`, fp, fecha: ahora })
      await tx.creditoProveedor.update({ where: { id: c.id }, data: { estado: "CONFIRMADO_DUENO", confirmadoEn: ahora, confirmadoPorId: negocioId } })
    }
    if (input.alCrearEnTx) await input.alCrearEnTx(tx, c.id)
    if (opciones.auditar) await opciones.auditar(tx, { accion: origen === "PAGO_DECLARADO" ? "cuenta_proveedor.pago_declarado" : "cuenta_proveedor.ajuste_a_favor", recursoId: c.id, detalle: { negocioId, proveedorId, creditoId: c.id, origen, importe: importe.value.toFixed(2), medio, naturalezaAjuste, ...(origen === "PAGO_DECLARADO" ? { confirmoNoSalioDeCaja: true, duplicadosAdvertidos: advertidos.map((x) => ({ tipo: x.tipo, id: x.id })) } : {}), ...(input.compraReferenciaId ? { compraId: input.compraReferenciaId } : {}), ...(input.confirmarAlRegistrar ? { confirmadoAlRegistrar: true, estado: "CONFIRMADO_DUENO" } : {}) } })
    return { ok: true as const, value: { creditoId: c.id, replayed: false } }
  }), () => replay(db))
}

/**
 * Vincula un egreso PAGO_PROVEEDOR de F10-C1 a un proveedor (crédito PAGO_CAJA, efectivo
 * inmediato). La fila del egreso NUNCA se modifica. Mismo orden de candados que la
 * compensación de F10-C1 (fila de la caja → fila del egreso): vincular y compensar en
 * simultáneo se ordenan; el trigger SQL repite las comprobaciones (I-1, I-8).
 */
export async function vincularPagoCaja(
  db: Db,
  input: { negocioId: string; proveedorId: string; egresoCajaId: unknown; idempotencyKey: string; confirmoNoDuplicado?: unknown },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<CuentaResult<{ creditoId: string; replayed: boolean }>> {
  const { negocioId, proveedorId } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  if (typeof input.egresoCajaId !== "string" || !input.egresoCajaId.trim()) return fail(400, "Elegí el pago de Caja a vincular.", "EGRESO_INVALIDO")
  const egresoCajaId = input.egresoCajaId.trim()
  const fp = huella([negocioId, proveedorId, "PAGO_CAJA", egresoCajaId])
  const replay = async (client: Pick<Tx, "creditoProveedor">): Promise<CuentaResult<{ creditoId: string; replayed: boolean }> | null> => {
    const previo = await client.creditoProveedor.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: { id: true, idempotencyFingerprint: true } })
    if (!previo) return null
    return previo.idempotencyFingerprint === fp ? { ok: true, value: { creditoId: previo.id, replayed: true } } : CLAVE_REUSADA
  }
  return conManejoDeErrores(() => runSerializable(db, async (tx) => {
    const previo = await replay(tx)
    if (previo) return previo
    return vincularPagoCajaEnTx(tx, { negocioId, proveedorId, egresoCajaId, idempotencyKey: key, fingerprint: fp, confirmoNoDuplicado: input.confirmoNoDuplicado === true }, opciones)
  }), async () => (await replay(db)) ?? (await yaVinculadoEn(db, negocioId, egresoCajaId)))
}

async function yaVinculadoEn(client: Pick<Tx, "creditoProveedor">, negocioId: string, egresoCajaId: string) {
  const v = await client.creditoProveedor.findFirst({ where: { negocioId, egresoCajaId, origen: "PAGO_CAJA", estado: "VIGENTE" }, select: { proveedor: { select: { nombre: true } } } })
  return v ? fail(409, `Ese pago de Caja ya está vinculado al proveedor «${v.proveedor.nombre}».`, "PAGO_YA_VINCULADO") : null
}

/**
 * Núcleo de la vinculación dentro de una transacción ya abierta (lo usa también la aprobación de una
 * recepción con su pago en efectivo, D-7 v2). Mismos candados (caja → egreso → proveedor) y controles.
 */
export async function vincularPagoCajaEnTx(
  tx: Tx,
  input: { negocioId: string; proveedorId: string; egresoCajaId: string; idempotencyKey: string; fingerprint: string; confirmoNoDuplicado: boolean; /** Pagos E3: anticipo en efectivo ligado a un pedido. */ compraReferenciaId?: string },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<CuentaResult<{ creditoId: string; replayed: boolean }>> {
  const { negocioId, proveedorId, egresoCajaId } = input
  const key = input.idempotencyKey
  const fp = input.fingerprint
  const yaVinculado = (client: Pick<Tx, "creditoProveedor">) => yaVinculadoEn(client, negocioId, egresoCajaId)
  {
    const base = await tx.egresoCaja.findFirst({ where: { id: egresoCajaId, negocioId }, select: { cajaFisicaId: true } })
    if (!base) return fail(404, "Pago de Caja no encontrado.", "EGRESO_NO_ENCONTRADO")
    await tx.$queryRaw`SELECT "id" FROM "cajas_fisicas" WHERE "id" = ${base.cajaFisicaId} AND "negocioId" = ${negocioId} FOR UPDATE`
    const filas = await tx.$queryRaw<Array<{ naturaleza: string; importeDecimal: Prisma.Decimal; createdAt: Date }>>`
      SELECT "naturaleza", "importeDecimal", "createdAt" FROM "egresos_caja" WHERE "id" = ${egresoCajaId} AND "negocioId" = ${negocioId} FOR UPDATE`
    const egreso = filas[0]
    if (!egreso) return fail(404, "Pago de Caja no encontrado.", "EGRESO_NO_ENCONTRADO")
    if (egreso.naturaleza !== "PAGO_PROVEEDOR") return fail(409, "Sólo se puede vincular un pago a proveedor de Caja (no un gasto ni un retiro).", "EGRESO_NO_ES_PAGO_PROVEEDOR")
    if (await tx.compensacionEgresoCaja.findUnique({ where: { egresoId_negocioId: { egresoId: egresoCajaId, negocioId } }, select: { id: true } })) {
      return fail(409, "Ese pago de Caja fue compensado (anulado): no se puede vincular.", "EGRESO_COMPENSADO")
    }
    const dup = await yaVinculado(tx)
    if (dup) return dup
    const prov = await bloquearProveedor(tx, negocioId, proveedorId)
    if (!prov) return PROVEEDOR_NO_ENCONTRADO
    if (!prov.activo) return PROVEEDOR_INACTIVO
    const importe = new D(egreso.importeDecimal)
    const advertidos = await pagosDeclaradosCandidatos(tx, negocioId, proveedorId, importe, new Date(egreso.createdAt), null, VENTANA_DUPLICADO_CAJA_DIAS)
    if (advertidos.length > 0 && !input.confirmoNoDuplicado) {
      return fail(409, "Ya registraste un pago declarado de este proveedor por el mismo importe en fechas cercanas. Si es el mismo pago, rechazá o anulá el declarado y vinculá el de Caja (el efectivo tiene una sola fuente). Si son pagos distintos, confirmá que no es un duplicado.", "POSIBLE_PAGO_DUPLICADO", { candidatos: candidatosParaRespuesta(advertidos) })
    }
    const c = await tx.creditoProveedor.create({
      data: { negocioId, proveedorId, origen: "PAGO_CAJA", importeDecimal: importe, estado: "VIGENTE", egresoCajaId, compraReferenciaId: input.compraReferenciaId ?? null, actorId: negocioId, idempotencyKey: key, idempotencyFingerprint: fp },
      select: { id: true },
    })
    if (opciones.auditar) await opciones.auditar(tx, { accion: "cuenta_proveedor.pago_caja_vinculado", recursoId: c.id, detalle: { negocioId, proveedorId, creditoId: c.id, egresoCajaId, importe: importe.toFixed(2), duplicadosAdvertidos: advertidos.map((x) => ({ tipo: x.tipo, id: x.id })) } })
    return { ok: true as const, value: { creditoId: c.id, replayed: false } }
  }
}

// Transiciones de un crédito, cada una con su evento (append-only).
const TRANSICIONES = {
  CONFIRMACION: { desde: ["DECLARADO"], hacia: "CONFIRMADO_DUENO", origenes: ["PAGO_DECLARADO"], motivoRequerido: false, accion: "cuenta_proveedor.pago_declarado_confirmado" },
  RECHAZO: { desde: ["DECLARADO"], hacia: "RECHAZADO", origenes: ["PAGO_DECLARADO"], motivoRequerido: true, accion: "cuenta_proveedor.pago_declarado_rechazado" },
  ANULACION: { desde: ["CONFIRMADO_DUENO", "VIGENTE"], hacia: "ANULADO", origenes: ["PAGO_DECLARADO", "AJUSTE_A_FAVOR"], motivoRequerido: true, accion: "cuenta_proveedor.credito_anulado" },
  DESVINCULACION: { desde: ["VIGENTE"], hacia: "DESVINCULADO", origenes: ["PAGO_CAJA"], motivoRequerido: true, accion: "cuenta_proveedor.pago_caja_desvinculado" },
} as const
export type TransicionCredito = keyof typeof TRANSICIONES

export async function transicionarCredito(
  db: Db,
  tipo: TransicionCredito,
  input: { negocioId: string; creditoId: string; motivo: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<CuentaResult<{ replayed: boolean }>> {
  const regla = TRANSICIONES[tipo]
  const { negocioId, creditoId } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  const motivo = texto(input.motivo, TEXTO_MAX)
  if (!motivo.ok) return fail(400, "El motivo admite hasta 500 caracteres.", "MOTIVO_INVALIDO")
  if (regla.motivoRequerido && !motivo.value) return fail(400, "Escribí el motivo.", "MOTIVO_REQUERIDO")
  const fp = huella([negocioId, creditoId, tipo, motivo.value])
  return conManejoDeErrores(() => runSerializable(db, async (tx) => {
    const previo = await replayEvento(tx, negocioId, key, fp, { creditoId })
    if (previo) return previo
    const base = await tx.creditoProveedor.findFirst({ where: { id: creditoId, negocioId }, select: { proveedorId: true } })
    if (!base) return fail(404, "Pago o crédito no encontrado.", "CREDITO_NO_ENCONTRADO")
    await bloquearProveedor(tx, negocioId, base.proveedorId)
    const c = await tx.creditoProveedor.findFirstOrThrow({ where: { id: creditoId, negocioId }, select: { origen: true, estado: true, importeDecimal: true, egresoCajaId: true } })
    if (!(regla.origenes as readonly string[]).includes(c.origen) || !(regla.desde as readonly string[]).includes(c.estado)) {
      return fail(409, "Esa acción no corresponde al estado actual del pago.", "TRANSICION_NO_PERMITIDA", { estado: c.estado, origen: c.origen })
    }
    if (esCreditoEfectivo(c.estado)) {
      const { porCredito } = await asignadoVigente(tx, negocioId, base.proveedorId)
      if ((porCredito.get(creditoId) ?? CERO).gt(0)) return fail(409, "Ese pago tiene asignaciones vigentes: desafectalas primero.", "TIENE_ASIGNACIONES")
    }
    const ahora = new Date()
    await crearEvento(tx, { negocioId, creditoId, tipo, motivo: motivo.value, key, fp, fecha: ahora })
    await tx.creditoProveedor.update({
      where: { id: creditoId },
      data: tipo === "CONFIRMACION" ? { estado: regla.hacia, confirmadoEn: ahora, confirmadoPorId: negocioId } : { estado: regla.hacia, cerradoEn: ahora },
    })
    if (opciones.auditar) await opciones.auditar(tx, { accion: regla.accion, recursoId: creditoId, detalle: { negocioId, proveedorId: base.proveedorId, creditoId, origen: c.origen, de: c.estado, a: regla.hacia, importe: c.importeDecimal.toFixed(2), egresoCajaId: c.egresoCajaId, motivo: motivo.value } })
    return { ok: true as const, value: { replayed: false } }
  }), () => replayEvento(db, negocioId, key, fp, { creditoId }))
}

// ---------------------------------------------------------------------------
// Motor único de asignaciones: ASIGNAR | DESAFECTAR | REASIGNAR
// ---------------------------------------------------------------------------

export interface RenglonAsignacion { creditoId: string; obligacionId: string; importe: Prisma.Decimal }
export interface OperacionAsignacionSolicitud { tipo: "ASIGNAR" | "DESAFECTAR" | "REASIGNAR"; desafectar: string[]; asignar: RenglonAsignacion[]; motivo: string | null }

export function parseOperacionAsignacion(body: unknown): CuentaResult<OperacionAsignacionSolicitud> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  if (b.tipo !== "ASIGNAR" && b.tipo !== "DESAFECTAR" && b.tipo !== "REASIGNAR") return fail(400, "Operación inválida.", "OPERACION_INVALIDA")
  const tipo = b.tipo
  const motivo = texto(b.motivo, TEXTO_MAX)
  if (!motivo.ok) return fail(400, "El motivo admite hasta 500 caracteres.", "MOTIVO_INVALIDO")
  const desafectarRaw = Array.isArray(b.desafectar) ? b.desafectar : []
  const asignarRaw = Array.isArray(b.asignar) ? b.asignar : []
  if (desafectarRaw.length + asignarRaw.length > MAX_RENGLONES_ASIGNACION) return fail(400, `Hasta ${MAX_RENGLONES_ASIGNACION} renglones por operación.`, "DEMASIADOS_RENGLONES")
  const desafectar: string[] = []
  for (const id of desafectarRaw) {
    if (typeof id !== "string" || !id.trim()) return fail(400, "Asignación inválida.", "RENGLON_INVALIDO")
    if (desafectar.includes(id)) return fail(400, "Una asignación aparece dos veces.", "RENGLON_DUPLICADO")
    desafectar.push(id.trim())
  }
  const asignar: RenglonAsignacion[] = []
  for (const r of asignarRaw) {
    const x = (r && typeof r === "object" ? r : {}) as Record<string, unknown>
    if (typeof x.creditoId !== "string" || typeof x.obligacionId !== "string" || !x.creditoId || !x.obligacionId) return fail(400, "Renglón de asignación inválido.", "RENGLON_INVALIDO")
    const imp = parseImporteEgreso(x.importe)
    if (!imp.ok) return fail(400, "Cada importe asignado tiene que ser mayor a cero, con hasta 2 decimales.", "IMPORTE_INVALIDO")
    if (asignar.some((a) => a.creditoId === x.creditoId && a.obligacionId === x.obligacionId)) return fail(400, "El mismo pago aparece dos veces para la misma deuda: sumalos en un renglón.", "RENGLON_DUPLICADO")
    asignar.push({ creditoId: x.creditoId, obligacionId: x.obligacionId, importe: imp.value })
  }
  if (tipo === "ASIGNAR" && (asignar.length === 0 || desafectar.length > 0)) return fail(400, "Para asignar, indicá al menos un renglón (sin desafectaciones).", "OPERACION_INVALIDA")
  if (tipo === "DESAFECTAR" && (desafectar.length === 0 || asignar.length > 0)) return fail(400, "Para desafectar, indicá al menos una asignación.", "OPERACION_INVALIDA")
  if (tipo === "REASIGNAR" && (desafectar.length === 0 || asignar.length === 0)) return fail(400, "Reasignar requiere desafectar y volver a asignar en la misma operación.", "OPERACION_INVALIDA")
  return { ok: true, value: { tipo, desafectar, asignar, motivo: motivo.value } }
}

export async function operarAsignaciones(
  db: Db,
  input: { negocioId: string; proveedorId: string; body: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<CuentaResult<{ operacionId: string; replayed: boolean }>> {
  const { negocioId, proveedorId } = input
  const key = claveValida(input.idempotencyKey)
  if (!key) return CLAVE_REQUERIDA
  const parsed = parseOperacionAsignacion(input.body)
  if (!parsed.ok) return parsed
  const s = parsed.value
  const fp = huella([negocioId, proveedorId, s.tipo, [...s.desafectar].sort(), s.asignar.map((a) => [a.creditoId, a.obligacionId, a.importe.toFixed(2)]).sort(), s.motivo])
  const replay = async (client: Pick<Tx, "operacionAsignacion">): Promise<CuentaResult<{ operacionId: string; replayed: boolean }> | null> => {
    const previa = await client.operacionAsignacion.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: { id: true, idempotencyFingerprint: true } })
    if (!previa) return null
    return previa.idempotencyFingerprint === fp ? { ok: true, value: { operacionId: previa.id, replayed: true } } : CLAVE_REUSADA
  }
  return conManejoDeErrores(() => runSerializable(db, async (tx) => {
    const previa = await replay(tx)
    if (previa) return previa
    return operarAsignacionesEnTx(tx, { negocioId, proveedorId, solicitud: s, idempotencyKey: key, fingerprint: fp }, opciones)
  }), () => replay(db))
}

/**
 * Núcleo ÚNICO del motor de asignaciones, para usar DENTRO de una transacción Serializable ya
 * abierta (operarAsignaciones o la aprobación de una recepción de F10-C2a). Toma el candado del
 * proveedor, valida topes con los efectos de la propia operación y escribe operación + renglones.
 */
export async function operarAsignacionesEnTx(
  tx: Tx,
  input: { negocioId: string; proveedorId: string; solicitud: OperacionAsignacionSolicitud; idempotencyKey: string; fingerprint: string },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<CuentaResult<{ operacionId: string; replayed: boolean }>> {
  const { negocioId, proveedorId, solicitud: s, idempotencyKey: key, fingerprint: fp } = input
  // Un candado por proveedor serializa TODAS sus operaciones de asignación (sin interbloqueos).
  const prov = await bloquearProveedor(tx, negocioId, proveedorId)
  if (!prov) return PROVEEDOR_NO_ENCONTRADO
    const { porCredito, porObligacion } = await asignadoVigente(tx, negocioId, proveedorId)

    // 1) Desafectaciones: asignaciones VIGENTES de ESTE proveedor.
    const aDesafectar = s.desafectar.length
      ? await tx.asignacionPago.findMany({ where: { id: { in: s.desafectar }, negocioId, proveedorId, tipo: "ASIGNACION" }, select: { id: true, creditoId: true, obligacionId: true, importeDecimal: true, revertidaPor: { select: { id: true } } } })
      : []
    if (aDesafectar.length !== s.desafectar.length || aDesafectar.some((a) => a.revertidaPor)) {
      return fail(409, "Alguna asignación ya fue desafectada o no pertenece a este proveedor.", "ASIGNACION_NO_VIGENTE")
    }
    for (const a of aDesafectar) {
      porCredito.set(a.creditoId, (porCredito.get(a.creditoId) ?? CERO).minus(a.importeDecimal))
      porObligacion.set(a.obligacionId, (porObligacion.get(a.obligacionId) ?? CERO).minus(a.importeDecimal))
    }

    // 2) Asignaciones: créditos EFECTIVOS y obligaciones VIGENTES de ESTE proveedor, dentro de los topes.
    if (s.asignar.length) {
      const creditos = await tx.creditoProveedor.findMany({ where: { id: { in: [...new Set(s.asignar.map((a) => a.creditoId))] }, negocioId, proveedorId }, select: { id: true, estado: true, importeDecimal: true } })
      const obligaciones = await tx.obligacionProveedor.findMany({ where: { id: { in: [...new Set(s.asignar.map((a) => a.obligacionId))] }, negocioId, proveedorId }, select: { id: true, estado: true, importeDecimal: true } })
      const credito = new Map(creditos.map((c) => [c.id, c]))
      const obligacion = new Map(obligaciones.map((o) => [o.id, o]))
      for (const r of s.asignar) {
        const c = credito.get(r.creditoId), o = obligacion.get(r.obligacionId)
        if (!c || !o) return fail(404, "Algún pago o deuda no pertenece a este proveedor.", "RENGLON_DE_OTRO_PROVEEDOR")
        if (!esCreditoEfectivo(c.estado)) return fail(409, "Un pago declarado sólo se puede asignar después de confirmarlo; los anulados o desvinculados no se asignan.", "CREDITO_NO_EFECTIVO")
        if (o.estado !== "VIGENTE") return fail(409, "Esa deuda ya no está vigente.", "OBLIGACION_NO_VIGENTE")
        const nuevoC = (porCredito.get(c.id) ?? CERO).plus(r.importe)
        const nuevoO = (porObligacion.get(o.id) ?? CERO).plus(r.importe)
        if (nuevoC.gt(c.importeDecimal)) return fail(409, "El pago no tiene disponible suficiente para esa asignación.", "ASIGNACION_EXCEDE_CREDITO", { creditoId: c.id, disponible: c.importeDecimal.minus(porCredito.get(c.id) ?? CERO).toFixed(2) })
        if (nuevoO.gt(o.importeDecimal)) return fail(409, "La asignación supera lo pendiente de esa deuda.", "ASIGNACION_EXCEDE_OBLIGACION", { obligacionId: o.id, pendiente: o.importeDecimal.minus(porObligacion.get(o.id) ?? CERO).toFixed(2) })
        porCredito.set(c.id, nuevoC)
        porObligacion.set(o.id, nuevoO)
      }
    }

    const op = await tx.operacionAsignacion.create({ data: { negocioId, proveedorId, tipo: s.tipo, motivo: s.motivo, actorId: negocioId, idempotencyKey: key, idempotencyFingerprint: fp }, select: { id: true } })
    for (const a of aDesafectar) {
      await tx.asignacionPago.create({ data: { negocioId, proveedorId, operacionId: op.id, creditoId: a.creditoId, obligacionId: a.obligacionId, tipo: "DESAFECTACION", importeDecimal: a.importeDecimal, revierteAsignacionId: a.id } })
    }
    for (const r of s.asignar) {
      await tx.asignacionPago.create({ data: { negocioId, proveedorId, operacionId: op.id, creditoId: r.creditoId, obligacionId: r.obligacionId, tipo: "ASIGNACION", importeDecimal: r.importe } })
    }
    if (opciones.auditar) {
      await opciones.auditar(tx, {
        accion: "cuenta_proveedor.asignacion",
        recursoId: op.id,
        detalle: { negocioId, proveedorId, operacionId: op.id, tipo: s.tipo, desafectadas: aDesafectar.map((a) => ({ asignacionId: a.id, importe: a.importeDecimal.toFixed(2) })), asignadas: s.asignar.map((r) => ({ creditoId: r.creditoId, obligacionId: r.obligacionId, importe: r.importe.toFixed(2) })), motivo: s.motivo },
      })
    }
    return { ok: true as const, value: { operacionId: op.id, replayed: false } }
}

/**
 * F10-C2a: obligación nacida de una recepción APROBADA (RECEPCION, única por recepción) o de un
 * cargo accesorio (CARGO_ACCESORIO, única por cargo). Sólo dentro de la transacción de aprobación,
 * con el proveedor ya bloqueado; el trigger SQL exige la recepción aprobada y el importe exacto.
 */
export async function crearObligacionDeRecepcionEnTx(
  tx: Tx,
  input: {
    negocioId: string
    proveedorId: string
    origen: "RECEPCION" | "CARGO_ACCESORIO"
    recepcionId?: string | null
    recepcionCargoId?: string | null
    importe: Prisma.Decimal
    fecha: Date
    descripcion: string
    comprobanteTipo?: string | null
    comprobanteNumero?: string | null
    comprobanteFecha?: Date | null
    idempotencyKey: string
  },
  opciones: { auditar?: AuditoriaEnTx } = {}
): Promise<{ obligacionId: string }> {
  const fp = huella([input.negocioId, input.proveedorId, "OBLIGACION", input.origen, input.recepcionId ?? null, input.recepcionCargoId ?? null, input.importe.toFixed(2)])
  const o = await tx.obligacionProveedor.create({
    data: {
      negocioId: input.negocioId, proveedorId: input.proveedorId, origen: input.origen, importeDecimal: input.importe, fecha: input.fecha,
      descripcion: input.descripcion.slice(0, 500), comprobanteTipo: input.comprobanteTipo ?? null, comprobanteNumero: input.comprobanteNumero ?? null,
      comprobanteFecha: input.comprobanteFecha ?? null, recepcionId: input.recepcionId ?? null, recepcionCargoId: input.recepcionCargoId ?? null,
      actorId: input.negocioId, idempotencyKey: input.idempotencyKey, idempotencyFingerprint: fp,
    },
    select: { id: true },
  })
  if (opciones.auditar) {
    await opciones.auditar(tx, { accion: "cuenta_proveedor.obligacion_registrada", recursoId: o.id, detalle: { negocioId: input.negocioId, proveedorId: input.proveedorId, obligacionId: o.id, origen: input.origen, recepcionId: input.recepcionId ?? null, recepcionCargoId: input.recepcionCargoId ?? null, importe: input.importe.toFixed(2) } })
  }
  return { obligacionId: o.id }
}

/** Créditos efectivos de un proveedor con disponible (anticipos), para proponer su aplicación. */
export async function anticiposDisponibles(db: Pick<Tx, "creditoProveedor" | "$queryRaw">, negocioId: string, proveedorId: string) {
  const creditos = await db.creditoProveedor.findMany({ where: { negocioId, proveedorId, estado: { in: [...ESTADOS_CREDITO_EFECTIVO] }, compraReferenciaId: null }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, origen: true, importeDecimal: true, medio: true, referencia: true, fechaPago: true, createdAt: true } })
  if (!creditos.length) return []
  const { porCredito } = await asignadoVigente(db, negocioId, proveedorId)
  return creditos
    .map((c) => ({ id: c.id, origen: c.origen, medio: c.medio, referencia: c.referencia, fecha: c.fechaPago ?? c.createdAt, importe: c.importeDecimal, disponible: c.importeDecimal.minus(porCredito.get(c.id) ?? CERO) }))
    .filter((c) => c.disponible.gt(0))
}

// ---------------------------------------------------------------------------
// Lecturas: estado de cuenta, resumen por proveedor, sugerencia FIFO, pagos de Caja sin proveedor
// ---------------------------------------------------------------------------

const n = (v: Prisma.Decimal) => moneyToNumber(v)

export interface TotalesCuenta {
  deudaVigente: Prisma.Decimal
  obligacionesPendientes: Prisma.Decimal
  creditosConfirmados: Prisma.Decimal
  creditosAsignados: Prisma.Decimal
  anticiposDisponibles: Prisma.Decimal
  pagosDeclaradosPendientes: Prisma.Decimal
  saldoNeto: Prisma.Decimal
  deudaExigible: Prisma.Decimal
  saldoAFavor: Prisma.Decimal
  identidadOk: boolean
}

export function calcularTotales(
  obligaciones: Array<{ id: string; estado: string; importeDecimal: Prisma.Decimal }>,
  creditos: Array<{ id: string; estado: string; importeDecimal: Prisma.Decimal }>,
  porCredito: Map<string, Prisma.Decimal>,
  porObligacion: Map<string, Prisma.Decimal>
): TotalesCuenta {
  let deudaVigente = CERO, obligacionesPendientes = CERO, creditosConfirmados = CERO, creditosAsignados = CERO, pagosDeclaradosPendientes = CERO
  for (const o of obligaciones) {
    if (o.estado !== "VIGENTE") continue
    deudaVigente = deudaVigente.plus(o.importeDecimal)
    obligacionesPendientes = obligacionesPendientes.plus(o.importeDecimal.minus(porObligacion.get(o.id) ?? CERO))
  }
  for (const c of creditos) {
    if (esCreditoEfectivo(c.estado)) {
      creditosConfirmados = creditosConfirmados.plus(c.importeDecimal)
      creditosAsignados = creditosAsignados.plus(porCredito.get(c.id) ?? CERO)
    } else if (c.estado === "DECLARADO") {
      pagosDeclaradosPendientes = pagosDeclaradosPendientes.plus(c.importeDecimal)
    }
  }
  const anticiposDisponibles = creditosConfirmados.minus(creditosAsignados)
  const saldoNeto = deudaVigente.minus(creditosConfirmados)
  return {
    deudaVigente, obligacionesPendientes, creditosConfirmados, creditosAsignados, anticiposDisponibles, pagosDeclaradosPendientes,
    saldoNeto,
    deudaExigible: saldoNeto.gt(0) ? saldoNeto : CERO,
    saldoAFavor: saldoNeto.lt(0) ? saldoNeto.negated() : CERO,
    identidadOk: saldoNeto.equals(obligacionesPendientes.minus(anticiposDisponibles)),
  }
}

export const totalesParaRespuesta = (t: TotalesCuenta) => ({
  deudaVigente: n(t.deudaVigente),
  obligacionesPendientes: n(t.obligacionesPendientes),
  creditosConfirmados: n(t.creditosConfirmados),
  creditosAsignados: n(t.creditosAsignados),
  anticiposDisponibles: n(t.anticiposDisponibles),
  pagosDeclaradosPendientes: n(t.pagosDeclaradosPendientes),
  saldoNeto: n(t.saldoNeto),
  deudaExigible: n(t.deudaExigible),
  saldoAFavor: n(t.saldoAFavor),
  identidadOk: t.identidadOk,
})

export async function estadoCuenta(db: Db, negocioId: string, proveedorId: string) {
  const proveedor = await db.proveedor.findFirst({ where: { id: proveedorId, negocioId }, select: { id: true } })
  if (!proveedor) return null
  const [obligaciones, creditos, asignaciones, operaciones, eventos, asignado] = await Promise.all([
    db.obligacionProveedor.findMany({ where: { negocioId, proveedorId }, orderBy: [{ fecha: "asc" }, { createdAt: "asc" }, { id: "asc" }] }),
    db.creditoProveedor.findMany({ where: { negocioId, proveedorId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { egresoCaja: { select: { createdAt: true, motivo: true, proveedorNombre: true, comprobanteReferencia: true, turno: { select: { cajaFisica: { select: { nombre: true } } } } } } } }),
    db.asignacionPago.findMany({ where: { negocioId, proveedorId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], select: { id: true, operacionId: true, creditoId: true, obligacionId: true, tipo: true, importeDecimal: true, revierteAsignacionId: true, createdAt: true, revertidaPor: { select: { id: true } } } }),
    db.operacionAsignacion.findMany({ where: { negocioId, proveedorId }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, tipo: true, motivo: true, createdAt: true } }),
    db.eventoCuentaProveedor.findMany({ where: { negocioId, OR: [{ obligacion: { proveedorId } }, { credito: { proveedorId } }] }, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, tipo: true, motivo: true, obligacionId: true, creditoId: true, createdAt: true } }),
    asignadoVigente(db, negocioId, proveedorId),
  ])
  const totales = calcularTotales(obligaciones, creditos, asignado.porCredito, asignado.porObligacion)
  return {
    totales: totalesParaRespuesta(totales),
    obligaciones: obligaciones.map((o) => {
      const a = asignado.porObligacion.get(o.id) ?? CERO
      return {
        id: o.id, origen: o.origen, naturalezaAjuste: o.naturalezaAjuste, importe: n(o.importeDecimal), asignado: n(a),
        pendiente: o.estado === "VIGENTE" ? n(o.importeDecimal.minus(a)) : 0, fecha: o.fecha, descripcion: o.descripcion,
        comprobante: o.comprobanteNumero || o.comprobanteTipo ? { tipo: o.comprobanteTipo, numero: o.comprobanteNumero, fecha: o.comprobanteFecha } : null,
        estado: o.estado, anuladaEn: o.anuladaEn, createdAt: o.createdAt,
      }
    }),
    creditos: creditos.map((c) => {
      const a = asignado.porCredito.get(c.id) ?? CERO
      const efectivo = esCreditoEfectivo(c.estado)
      return {
        id: c.id, origen: c.origen, estado: c.estado, efectivo, importe: n(c.importeDecimal), asignado: n(a), disponible: efectivo ? n(c.importeDecimal.minus(a)) : 0,
        medio: c.medio, referencia: c.referencia, fechaPago: c.fechaPago, cuentaOrigenDeclarada: c.cuentaOrigenDeclarada, naturalezaAjuste: c.naturalezaAjuste, motivo: c.motivo,
        confirmadoEn: c.confirmadoEn, cerradoEn: c.cerradoEn, conciliacionEstado: c.conciliacionEstado,
        egresoCaja: c.egresoCajaId && c.egresoCaja ? { id: c.egresoCajaId, createdAt: c.egresoCaja.createdAt, motivo: c.egresoCaja.motivo, proveedorNombre: c.egresoCaja.proveedorNombre, comprobante: c.egresoCaja.comprobanteReferencia, caja: c.egresoCaja.turno.cajaFisica.nombre } : null,
        createdAt: c.createdAt,
      }
    }),
    asignaciones: asignaciones.map((a) => ({ id: a.id, operacionId: a.operacionId, creditoId: a.creditoId, obligacionId: a.obligacionId, tipo: a.tipo, importe: n(a.importeDecimal), revierteAsignacionId: a.revierteAsignacionId, vigente: a.tipo === "ASIGNACION" && !a.revertidaPor, createdAt: a.createdAt })),
    operaciones,
    eventos,
  }
}

/** Totales por proveedor (lista), con las mismas fórmulas; una consulta por tabla. */
export async function resumenProveedores(db: Db, negocioId: string, proveedorIds: string[]) {
  const vacio = () => ({ obligaciones: [] as Array<{ id: string; estado: string; importeDecimal: Prisma.Decimal }>, creditos: [] as Array<{ id: string; estado: string; importeDecimal: Prisma.Decimal }> })
  const acc = new Map(proveedorIds.map((id) => [id, vacio()]))
  if (!proveedorIds.length) return new Map<string, ReturnType<typeof totalesParaRespuesta>>()
  const [obligaciones, creditos, asignadas] = await Promise.all([
    db.obligacionProveedor.findMany({ where: { negocioId, proveedorId: { in: proveedorIds } }, select: { id: true, proveedorId: true, estado: true, importeDecimal: true } }),
    db.creditoProveedor.findMany({ where: { negocioId, proveedorId: { in: proveedorIds } }, select: { id: true, proveedorId: true, estado: true, importeDecimal: true } }),
    db.$queryRaw<Array<{ creditoId: string; obligacionId: string; total: string }>>`
      SELECT a."creditoId", a."obligacionId", sum(a."importeDecimal")::text AS total FROM "asignaciones_pago" a
       WHERE a."negocioId" = ${negocioId} AND a."proveedorId" IN (${Prisma.join(proveedorIds)}) AND a."tipo" = 'ASIGNACION'
         AND NOT EXISTS (SELECT 1 FROM "asignaciones_pago" d WHERE d."revierteAsignacionId" = a."id")
       GROUP BY 1, 2`,
  ])
  for (const o of obligaciones) acc.get(o.proveedorId)?.obligaciones.push(o)
  for (const c of creditos) acc.get(c.proveedorId)?.creditos.push(c)
  const porCredito = new Map<string, Prisma.Decimal>(), porObligacion = new Map<string, Prisma.Decimal>()
  for (const f of asignadas) {
    porCredito.set(f.creditoId, (porCredito.get(f.creditoId) ?? CERO).plus(new D(f.total)))
    porObligacion.set(f.obligacionId, (porObligacion.get(f.obligacionId) ?? CERO).plus(new D(f.total)))
  }
  return new Map([...acc].map(([id, a]) => [id, totalesParaRespuesta(calcularTotales(a.obligaciones, a.creditos, porCredito, porObligacion))]))
}

/** FIFO: SÓLO una sugerencia (lectura). Reparte el disponible del crédito de la deuda más antigua a la más nueva. */
export async function sugerenciaAsignacion(db: Db, negocioId: string, proveedorId: string, creditoId: string): Promise<CuentaResult<{ disponible: number; renglones: Array<{ obligacionId: string; importe: number; pendiente: number }>; quedaComoAnticipo: number }>> {
  const credito = await db.creditoProveedor.findFirst({ where: { id: creditoId, negocioId, proveedorId }, select: { estado: true, importeDecimal: true } })
  if (!credito) return fail(404, "Pago o crédito no encontrado.", "CREDITO_NO_ENCONTRADO")
  if (!esCreditoEfectivo(credito.estado)) return fail(409, "Ese pago todavía no está confirmado o ya no está vigente.", "CREDITO_NO_EFECTIVO")
  const { porCredito, porObligacion } = await asignadoVigente(db, negocioId, proveedorId)
  let restante = credito.importeDecimal.minus(porCredito.get(creditoId) ?? CERO)
  const disponible = restante
  const obligaciones = await db.obligacionProveedor.findMany({ where: { negocioId, proveedorId, estado: "VIGENTE" }, orderBy: [{ fecha: "asc" }, { createdAt: "asc" }, { id: "asc" }], select: { id: true, importeDecimal: true } })
  const renglones: Array<{ obligacionId: string; importe: number; pendiente: number }> = []
  for (const o of obligaciones) {
    if (!restante.gt(0)) break
    const pendiente = o.importeDecimal.minus(porObligacion.get(o.id) ?? CERO)
    if (!pendiente.gt(0)) continue
    const parte = Prisma.Decimal.min(pendiente, restante)
    renglones.push({ obligacionId: o.id, importe: n(parte), pendiente: n(pendiente) })
    restante = restante.minus(parte)
  }
  return { ok: true, value: { disponible: n(disponible), renglones, quedaComoAnticipo: n(restante) } }
}

/** Pagos a proveedor de Caja (F10-C1) todavía sin vincular, no compensados (lectura). */
export async function pagosCajaSinVincular(db: Db, negocioId: string) {
  const egresos = await db.egresoCaja.findMany({
    where: { negocioId, naturaleza: "PAGO_PROVEEDOR", compensacion: { is: null }, creditosProveedor: { none: { estado: "VIGENTE" } } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, importeDecimal: true, motivo: true, proveedorNombre: true, proveedorIdentificacion: true, comprobanteReferencia: true, createdAt: true, actorTipo: true, turno: { select: { cajaFisica: { select: { nombre: true } } } } },
  })
  return egresos.map((e) => ({ id: e.id, importe: n(e.importeDecimal), motivo: e.motivo, proveedorNombre: e.proveedorNombre, proveedorIdentificacion: e.proveedorIdentificacion, comprobante: e.comprobanteReferencia, createdAt: e.createdAt, registradoPor: e.actorTipo === "NEGOCIO" ? "DUENO" : "EMPLEADO", caja: e.turno.cajaFisica.nombre }))
}
