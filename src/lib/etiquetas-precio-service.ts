// ============================================
// F10-C2c — etiquetas de góndola: el precio autorizado por el dueño se ACTIVA recién cuando se confirma la etiqueta
// ============================================
// Flujo: al aprobar una recepción el dueño elige qué precios de venta actualizar (precios-venta-service). Cada uno
// queda como etiqueta PENDIENTE (se sigue cobrando el precio anterior) o, si el producto no tiene etiqueta física /
// se vende sólo online, se activa en el acto (SIN_ETIQUETA). Un empleado del área Caja (o el dueño) cambia la etiqueta
// y la confirma: recién ahí cambia el precio de venta, por la etiqueta y sólo a lo que autorizó el dueño.
// Reglas: el empleado sólo confirma (nunca elige ni modifica el precio); cada activación es única (estado PENDIENTE
// condicional + índice único) y queda auditada; una autorización más nueva o una edición desde el catálogo dejan la
// etiqueta vieja REEMPLAZADA (nunca activa un precio viejo); nunca toca compras, costos, stock, deudas, promociones
// ni ventas ya hechas. Cada cambio efectivo queda en activaciones_precio_venta (base de los precios por inicio de venta).

import { Prisma, type PrismaClient } from "@prisma/client"
import { mapaNombresVisibles } from "@/lib/empleado-identidad"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
const D = Prisma.Decimal

export type ActorEtiqueta = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }
export type AuditoriaEtiqueta = (tx: Tx, e: { accion: string; recursoId: string; detalle: Record<string, unknown> }) => Promise<void>
type Fallo = { ok: false; status: 400 | 403 | 404 | 409; error: string; code: string }
const fail = (status: Fallo["status"], error: string, code: string): Fallo => ({ ok: false, status, error, code })

export const ESTADOS_ETIQUETA = ["PENDIENTE", "ACTIVADA", "REEMPLAZADA", "DESCARTADA"] as const
const MAX_LOTE = 100

const precio2 = (v: number) => new D(v.toFixed(2))

/** Precio de venta ACTIVO de un producto/variante, con la fila bloqueada (FOR UPDATE) dentro de la transacción. */
export async function precioActivoBloqueado(tx: Tx, negocioId: string, productoId: string, varianteId: string | null): Promise<Prisma.Decimal | null> {
  if (varianteId) {
    const rows = await tx.$queryRaw<Array<{ precio: number }>>`
      SELECT v."precio" FROM "producto_variantes" v JOIN "productos" p ON p."id" = v."productoId"
      WHERE v."id" = ${varianteId} AND v."productoId" = ${productoId} AND p."negocioId" = ${negocioId} FOR UPDATE OF p, v`
    return rows[0] ? precio2(Number(rows[0].precio)) : null
  }
  const rows = await tx.$queryRaw<Array<{ precio: number }>>`
    SELECT "precio" FROM "productos" WHERE "id" = ${productoId} AND "negocioId" = ${negocioId} AND NOT "eliminado" FOR UPDATE`
  return rows[0] ? precio2(Number(rows[0].precio)) : null
}

/**
 * Shared serialization point for every price/label write on one product.
 * The no-op MVCC update matters under SERIALIZABLE: SELECT FOR UPDATE alone
 * can wait while keeping an older snapshot, which would miss a just-inserted
 * pending label. This changes no logical column value; `productos` has no
 * update triggers, and callers still write their normal audit/history rows.
 */
export async function bloquearPrecioYEtiquetasEnTx(tx: Tx, negocioId: string, productoId: string, varianteId: string | null) {
  const precio = await precioActivoBloqueado(tx, negocioId, productoId, varianteId)
  if (!precio) return { precio: null, etiquetaPendiente: false }
  await tx.$executeRaw`UPDATE "productos" SET "updatedAt" = "updatedAt" WHERE "id" = ${productoId} AND "negocioId" = ${negocioId}`
  const etiquetas = await tx.etiquetaPrecio.findFirst({ where: { negocioId, productoId, estado: "PENDIENTE" }, select: { id: true } })
  return { precio, etiquetaPendiente: Boolean(etiquetas) }
}

async function escribirPrecio(tx: Tx, productoId: string, varianteId: string | null, precio: Prisma.Decimal) {
  const valor = Number(precio.toFixed(2))
  if (varianteId) await tx.productoVariante.update({ where: { id: varianteId }, data: { precio: valor } })
  else await tx.producto.update({ where: { id: productoId }, data: { precio: valor } })
}

// ---------- lista ----------
export async function listarEtiquetas(db: Db, negocioId: string, filtro: { estado?: string | null; q?: string | null; conActor: boolean }) {
  const estado = filtro.estado === "COMPLETADAS" ? { in: ["ACTIVADA", "REEMPLAZADA", "DESCARTADA"] } : filtro.estado === "TODAS" ? undefined : "PENDIENTE"
  const q = (filtro.q ?? "").trim().slice(0, 80)
  const filas = await db.etiquetaPrecio.findMany({
    where: {
      negocioId,
      ...(estado ? { estado } : {}),
      ...(q ? { OR: [{ producto: { nombre: { contains: q, mode: "insensitive" } } }, { productoVariante: { nombre: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    orderBy: [{ autorizadaEn: "desc" }],
    take: 300,
    include: {
      producto: { select: { nombre: true, eliminado: true } },
      productoVariante: { select: { nombre: true, activo: true } },
      cambioPrecioVenta: { select: { recepcion: { select: { numero: true } } } },
    },
  })
  const pendientes = await db.etiquetaPrecio.count({ where: { negocioId, estado: "PENDIENTE" } })
  // Nombres de quien confirmó (empleados del negocio); el dueño figura como «Dueño».
  const empleadoIds = [...new Set(filas.filter((f) => f.resueltaPorTipo === "EMPLEADO" && f.resueltaPorId).map((f) => f.resueltaPorId!))]
  const nombreEmpleado = filtro.conActor ? await mapaNombresVisibles(db, negocioId, empleadoIds) : new Map<string, string>()
  return {
    pendientes,
    etiquetas: filas.map((f) => ({
      id: f.id,
      producto: f.producto.nombre,
      variante: f.productoVariante?.nombre ?? null,
      precioAnterior: f.precioAnteriorDecimal.toFixed(2),
      precioNuevo: f.precioNuevoDecimal.toFixed(2),
      modo: f.modo,
      estado: f.estado,
      resolucion: f.resolucion,
      recepcion: f.cambioPrecioVenta.recepcion.numero,
      autorizadaEn: f.autorizadaEn,
      resueltaEn: f.resueltaEn,
      // El empleado ve sólo el estado; el dueño ve quién confirmó y cuándo.
      ...(filtro.conActor ? { resueltaPor: f.resueltaPorTipo === "NEGOCIO" ? "Dueño" : f.resueltaPorTipo === "EMPLEADO" ? (nombreEmpleado.get(f.resueltaPorId!) ?? "Empleado") : null } : {}),
    })),
  }
}

// ---------- confirmar / activar / descartar ----------
export type AccionEtiqueta = "CONFIRMAR" | "ACTIVAR_SIN_ETIQUETA" | "DESCARTAR"

function idsValidos(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_LOTE) return null
  const ids = [...new Set(raw)]
  return ids.every((x) => typeof x === "string" && x.length > 0 && x.length <= 64) ? (ids as string[]) : null
}

/**
 * Resuelve un lote de etiquetas PENDIENTES. Cada una se procesa por separado dentro de UNA transacción: las que ya no
 * están pendientes (otra persona la confirmó, quedó reemplazada por un precio más nuevo o la descartó el dueño) se
 * informan y no cambian nada. Sólo el dueño activa sin etiqueta o descarta.
 */
export async function resolverEtiquetas(
  db: Db,
  input: { negocioId: string; actor: ActorEtiqueta; accion: unknown; ids: unknown },
  opciones: { auditar?: AuditoriaEtiqueta } = {}
): Promise<{ ok: true; value: { resueltas: Array<{ id: string; producto: string; precioNuevo: string }>; omitidas: Array<{ id: string; motivo: string }> } } | Fallo> {
  const { negocioId, actor } = input
  const accion = input.accion as AccionEtiqueta
  if (!["CONFIRMAR", "ACTIVAR_SIN_ETIQUETA", "DESCARTAR"].includes(accion)) return fail(400, "Acción inválida.", "ACCION_INVALIDA")
  if (accion !== "CONFIRMAR" && actor.tipo !== "NEGOCIO") return fail(403, "Sólo el dueño puede hacer esto.", "SOLO_DUENO")
  const ids = idsValidos(input.ids)
  if (!ids) return fail(400, `Elegí entre 1 y ${MAX_LOTE} etiquetas.`, "ETIQUETAS_INVALIDAS")
  const actorTipo = actor.tipo
  const actorId = actor.tipo === "EMPLEADO" ? actor.empleadoId : negocioId
  if (actor.tipo === "EMPLEADO") {
    const e = await db.empleado.findFirst({ where: { id: actor.empleadoId, negocioId, activo: true, eliminado: false }, select: { id: true } })
    if (!e) return fail(403, "Acceso denegado.", "ACCESO_DENEGADO")
  }

  return db.$transaction(async (tx) => {
    const resueltas: Array<{ id: string; producto: string; precioNuevo: string }> = []
    const omitidas: Array<{ id: string; motivo: string }> = []
    // Orden fijo: evita bloqueos cruzados entre dos lotes concurrentes.
    for (const id of [...ids].sort()) {
      const et = await tx.etiquetaPrecio.findFirst({ where: { id, negocioId }, include: { producto: { select: { nombre: true } }, productoVariante: { select: { nombre: true } } } })
      if (!et) { omitidas.push({ id, motivo: "No existe." }); continue }
      const nombre = `${et.producto.nombre}${et.productoVariante ? ` — ${et.productoVariante.nombre}` : ""}`
      if (et.estado !== "PENDIENTE") {
        omitidas.push({ id, motivo: et.estado === "ACTIVADA" ? `${nombre}: ya estaba actualizada.` : et.estado === "REEMPLAZADA" ? `${nombre}: hay un precio más nuevo autorizado; confirmá esa etiqueta.` : `${nombre}: el dueño la descartó.` })
        continue
      }
      const bloqueado = await bloquearPrecioYEtiquetasEnTx(tx, negocioId, et.productoId, et.productoVarianteId)
      if (!bloqueado.precio) { omitidas.push({ id, motivo: `${nombre}: el producto ya no está disponible.` }); continue }
      const ahora = new Date()
      if (accion === "DESCARTAR") {
        const r = await tx.etiquetaPrecio.updateMany({ where: { id, estado: "PENDIENTE" }, data: { estado: "DESCARTADA", resolucion: "DESCARTADA", resueltaEn: ahora, resueltaPorTipo: "NEGOCIO", resueltaPorId: negocioId } })
        if (r.count !== 1) { omitidas.push({ id, motivo: `${nombre}: ya no estaba pendiente.` }); continue }
        if (opciones.auditar) await opciones.auditar(tx, { accion: "precio_venta.etiqueta_descartada", recursoId: id, detalle: { negocioId, etiquetaId: id, productoId: et.productoId, productoVarianteId: et.productoVarianteId, precioAutorizado: et.precioNuevoDecimal.toFixed(2), precioQueSigue: et.precioAnteriorDecimal.toFixed(2) } })
        resueltas.push({ id, producto: nombre, precioNuevo: et.precioAnteriorDecimal.toFixed(2) })
        continue
      }
      // Activar: el precio activo tiene que seguir siendo el que había al autorizar (si no, la etiqueta quedó vieja).
      const activo = bloqueado.precio
      if (!activo.eq(et.precioAnteriorDecimal)) { omitidas.push({ id, motivo: `${nombre}: el precio cambió desde que se autorizó. Pedile al dueño que lo revise.` }); continue }
      const resolucion = accion === "CONFIRMAR" ? "ETIQUETA_CONFIRMADA" : "ACTIVADA_POR_DUENO"
      const r = await tx.etiquetaPrecio.updateMany({ where: { id, estado: "PENDIENTE" }, data: { estado: "ACTIVADA", resolucion, resueltaEn: ahora, resueltaPorTipo: actorTipo, resueltaPorId: actorId } })
      if (r.count !== 1) { omitidas.push({ id, motivo: `${nombre}: ya no estaba pendiente.` }); continue }
      await escribirPrecio(tx, et.productoId, et.productoVarianteId, et.precioNuevoDecimal)
      const act = await tx.activacionPrecioVenta.create({
        data: { negocioId, productoId: et.productoId, productoVarianteId: et.productoVarianteId, precioAnteriorDecimal: activo, precioNuevoDecimal: et.precioNuevoDecimal, origen: accion === "CONFIRMAR" ? "ETIQUETA" : "DUENO_SIN_ETIQUETA", etiquetaPrecioId: id, actorTipo, actorId, activadoEn: ahora },
      })
      if (opciones.auditar) {
        await opciones.auditar(tx, {
          accion: accion === "CONFIRMAR" ? "precio_venta.etiqueta_confirmada" : "precio_venta.activado_sin_etiqueta",
          recursoId: id,
          detalle: { negocioId, etiquetaId: id, activacionId: act.id, productoId: et.productoId, productoVarianteId: et.productoVarianteId, precioAnterior: activo.toFixed(2), precioNuevo: et.precioNuevoDecimal.toFixed(2), actor: { tipo: actorTipo, id: actorId } },
        })
      }
      resueltas.push({ id, producto: nombre, precioNuevo: et.precioNuevoDecimal.toFixed(2) })
    }
    return { ok: true as const, value: { resueltas, omitidas } }
  })
}

// ---------- catálogo ----------
/**
 * Edición del precio desde el catálogo (dueño): bloquea la fila, corre la actualización y, si el precio cambió, lo
 * registra como activación CATALOGO y deja REEMPLAZADA la etiqueta pendiente de ese producto/variante (el dueño fijó
 * otro precio a mano: la etiqueta vieja nunca se activa). Misma transacción que la actualización.
 */
export async function conPrecioDeCatalogoEnTx<T>(
  tx: Tx,
  clave: { negocioId: string; productoId: string; varianteId: string | null },
  actualizar: (etiquetaPendiente: boolean) => Promise<T>,
  actor: { tipo: "NEGOCIO" | "EMPLEADO"; id: string } | null = null,
  opciones: { etiquetas?: "NINGUNA" | "DUEÑO" | "RECHAZAR" | "PRESERVAR"; alRechazarEtiqueta?: () => never } = {}
): Promise<T> {
  const politica = opciones.etiquetas ?? "NINGUNA"
  const estado = politica === "NINGUNA"
    ? { precio: await precioActivoBloqueado(tx, clave.negocioId, clave.productoId, clave.varianteId), etiquetaPendiente: false }
    : await bloquearPrecioYEtiquetasEnTx(tx, clave.negocioId, clave.productoId, clave.varianteId)
  if (estado.etiquetaPendiente && politica === "RECHAZAR") {
    if (opciones.alRechazarEtiqueta) opciones.alRechazarEtiqueta()
    throw new Error("ETIQUETA_PRECIO_PENDIENTE")
  }
  const antes = estado.precio
  const resultado = await actualizar(estado.etiquetaPendiente)
  const despues = await precioActivoBloqueado(tx, clave.negocioId, clave.productoId, clave.varianteId)
  if (estado.etiquetaPendiente && politica === "PRESERVAR" && antes && despues && !antes.eq(despues)) {
    throw new Error("La escritura intentó cambiar un precio protegido por etiqueta pendiente.")
  }
  if (!antes || !despues || antes.eq(despues) || !antes.gt(0) || !despues.gt(0)) return resultado
  const ahora = new Date()
  await tx.etiquetaPrecio.updateMany({
    where: { negocioId: clave.negocioId, productoId: clave.productoId, productoVarianteId: clave.varianteId, estado: "PENDIENTE" },
    data: { estado: "REEMPLAZADA", resolucion: "REEMPLAZADA_POR_CATALOGO", resueltaEn: ahora, resueltaPorTipo: "NEGOCIO", resueltaPorId: clave.negocioId },
  })
  await tx.activacionPrecioVenta.create({
    data: { negocioId: clave.negocioId, productoId: clave.productoId, productoVarianteId: clave.varianteId, precioAnteriorDecimal: antes, precioNuevoDecimal: despues, origen: "CATALOGO", actorTipo: actor?.tipo ?? "NEGOCIO", actorId: actor?.id ?? clave.negocioId, activadoEn: ahora },
  })
  return resultado
}
