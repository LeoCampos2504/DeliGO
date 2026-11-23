// ============================================
// F10-C2c — precios protegidos por INICIO de venta
// ============================================
// Cuando el cajero (o el dueño) empieza una venta, el servidor registra la hora de inicio (inicios_venta). Al cobrar,
// el motor de ventas cobra a cada producto el precio que estaba VIGENTE en ese momento, aunque el producto se haya
// agregado después: si hubo activaciones de precio posteriores al inicio (activaciones_precio_venta: etiquetas
// confirmadas, activaciones del dueño o ediciones de catálogo), vale el precio anterior a la PRIMERA de ellas. No se
// copia el catálogo: sólo se consultan las activaciones posteriores al inicio de los productos de la venta.
// Seguridad: la hora la pone el servidor; el navegador sólo envía el id. El inicio es del mismo negocio y de la
// misma persona, se usa UNA sola vez (queda ligado a la venta) y vence a los INICIO_VENTA_MINUTOS: una venta
// abandonada o suspendida no puede sostener precios viejos indefinidamente (pasado el plazo se cobra el precio actual
// y la Caja avisa y actualiza el carrito antes de cobrar).

import { Prisma, type PrismaClient } from "@prisma/client"

type Db = PrismaClient
type Tx = Prisma.TransactionClient
type Dec = Prisma.Decimal

export const INICIO_VENTA_MINUTOS = 30
export type ActorInicio = { tipo: "NEGOCIO" } | { tipo: "EMPLEADO"; empleadoId: string }
type Fallo = { ok: false; status: 400 | 403 | 404 | 409; error: string; code: string }

export const INICIO_VENTA_VENCIDO_CODE = "INICIO_VENTA_VENCIDO"
export const PRECIOS_CAMBIARON_CODE = "PRECIOS_CAMBIARON"

const actorIdDe = (negocioId: string, a: ActorInicio) => (a.tipo === "EMPLEADO" ? a.empleadoId : negocioId)
export const clavePrecio = (productoId: string, varianteId: string | null | undefined) => `${productoId}|${varianteId ?? ""}`
export const idInicioValido = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 64

export async function crearInicioVenta(db: Db, negocioId: string, actor: ActorInicio) {
  const iniciadaEn = new Date()
  const expiraEn = new Date(iniciadaEn.getTime() + INICIO_VENTA_MINUTOS * 60_000)
  const r = await db.inicioVenta.create({ data: { negocioId, actorTipo: actor.tipo, actorId: actorIdDe(negocioId, actor), iniciadaEn, expiraEn }, select: { id: true, iniciadaEn: true, expiraEn: true } })
  return r
}

/** Precio vigente al inicio, sólo para las claves cuyo precio cambió DESPUÉS del inicio (el resto: precio actual). */
export async function preciosAlInicio(client: Db | Tx, negocioId: string, iniciadaEn: Date, productoIds?: string[]): Promise<Map<string, Dec>> {
  const acts = await client.activacionPrecioVenta.findMany({
    where: { negocioId, activadoEn: { gt: iniciadaEn }, ...(productoIds ? { productoId: { in: productoIds } } : {}) },
    orderBy: [{ activadoEn: "asc" }, { id: "asc" }],
    select: { productoId: true, productoVarianteId: true, precioAnteriorDecimal: true },
  })
  const out = new Map<string, Dec>()
  for (const a of acts) {
    const k = clavePrecio(a.productoId, a.productoVarianteId)
    if (!out.has(k)) out.set(k, a.precioAnteriorDecimal)
  }
  return out
}

/** Estado del inicio para la Caja: plazo y los precios que la venta conserva (sólo los que cambiaron después). */
export async function estadoInicioVenta(db: Db, negocioId: string, actor: ActorInicio, id: string) {
  const inicio = await db.inicioVenta.findFirst({ where: { id, negocioId, actorTipo: actor.tipo, actorId: actorIdDe(negocioId, actor) } })
  if (!inicio) return { ok: false as const, status: 404 as const, error: "Venta no encontrada.", code: "INICIO_VENTA_INVALIDO" }
  const vencido = inicio.expiraEn.getTime() <= Date.now()
  const usado = inicio.ventaId !== null
  const precios = vencido || usado ? new Map<string, Dec>() : await preciosAlInicio(db, negocioId, inicio.iniciadaEn)
  return {
    ok: true as const,
    value: {
      id: inicio.id, iniciadaEn: inicio.iniciadaEn, expiraEn: inicio.expiraEn, vencido, usado,
      precios: [...precios.entries()].map(([k, v]) => {
        const [productoId, varianteId] = k.split("|")
        return { productoId, varianteId: varianteId || null, precio: Number(v.toFixed(2)) }
      }),
    },
  }
}

/**
 * Dentro de la transacción de la venta: bloquea el inicio y valida negocio, persona, uso único y plazo. Un inicio
 * vencido o ya usado se rechaza (409) sin escribir nada: la Caja actualiza los precios y se vuelve a cobrar.
 */
export async function tomarInicioVentaEnTx(tx: Tx, input: { negocioId: string; actorTipo: string; actorId: string; id: string }): Promise<{ ok: true; inicio: { id: string; iniciadaEn: Date } } | Fallo> {
  const rows = await tx.$queryRaw<Array<{ id: string; actorTipo: string; actorId: string; iniciadaEn: Date; expiraEn: Date; ventaId: string | null }>>`
    SELECT "id", "actorTipo", "actorId", "iniciadaEn", "expiraEn", "ventaId" FROM "inicios_venta"
    WHERE "id" = ${input.id} AND "negocioId" = ${input.negocioId} FOR UPDATE`
  const r = rows[0]
  if (!r || r.actorTipo !== input.actorTipo || r.actorId !== input.actorId) return { ok: false, status: 400, error: "No se reconoce el inicio de esta venta. Volvé a cargar la Caja.", code: "INICIO_VENTA_INVALIDO" }
  if (r.ventaId) return { ok: false, status: 409, error: "Esta venta ya se cobró. Empezá una venta nueva.", code: INICIO_VENTA_VENCIDO_CODE }
  if (r.expiraEn.getTime() <= Date.now()) {
    return { ok: false, status: 409, error: `La venta estuvo abierta más de ${INICIO_VENTA_MINUTOS} minutos: se actualizaron los precios. Revisá el total y cobrá de nuevo.`, code: INICIO_VENTA_VENCIDO_CODE }
  }
  return { ok: true, inicio: { id: r.id, iniciadaEn: r.iniciadaEn } }
}

export async function marcarInicioUsadoEnTx(tx: Tx, inicioId: string, ventaId: string) {
  await tx.inicioVenta.update({ where: { id: inicioId }, data: { ventaId, usadaEn: new Date() } })
}
