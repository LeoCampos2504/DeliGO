// ============================================
// F5-A — proveedores (server only; ÚNICO escritor de proveedores y proveedor_cambios)
// ============================================
// D-1: ficha mínima; CUIT opcional, validado y ÚNICO por negocio (índice parcial en SQL;
// el mismo CUIT puede existir en otro negocio). Un nombre similar devuelve una ADVERTENCIA
// con los coincidentes y se crea sólo con confirmación explícita (nunca un bloqueo).
// El negocio sale SIEMPRE de la sesión del dueño. Nunca se borra un proveedor
// (activo=false); todo cambio de ficha deja una fila en proveedor_cambios y auditoría
// en la misma transacción.

import { Prisma, type PrismaClient } from "@prisma/client"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"
import { runSerializable } from "@/lib/caja-devoluciones-service"
import { normalizarCuit, normalizarNombreProveedor } from "@/lib/cuit"

type Db = PrismaClient
type Tx = Prisma.TransactionClient

export type ProveedorResult<T> =
  | { ok: true; value: T }
  | { ok: false; status: 400 | 404 | 409; error: string; code?: string; detalle?: Record<string, unknown> }

const fail = (status: 400 | 404 | 409, error: string, code?: string, detalle?: Record<string, unknown>) =>
  ({ ok: false as const, status, error, ...(code ? { code } : {}), ...(detalle ? { detalle } : {}) })

export const PROVEEDOR_SELECT = {
  id: true, nombre: true, cuit: true, telefono: true, email: true, notas: true, activo: true, createdAt: true, updatedAt: true,
} satisfies Prisma.ProveedorSelect
export type ProveedorFicha = Prisma.ProveedorGetPayload<{ select: typeof PROVEEDOR_SELECT }>

// ---------------------------------------------------------------------------
// Validación (pura)
// ---------------------------------------------------------------------------

function texto(value: unknown, max: number, min = 1): { ok: true; value: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: null }
  if (typeof value !== "string") return { ok: false }
  const t = value.trim().replace(/\s+/g, " ")
  if (!t) return { ok: true, value: null }
  return t.length >= min && t.length <= max ? { ok: true, value: t } : { ok: false }
}

export interface DatosProveedor {
  nombre: string
  cuit: string | null
  telefono: string | null
  email: string | null
  notas: string | null
}

export function parseDatosProveedor(body: unknown): ProveedorResult<DatosProveedor & { confirmoNombreSimilar: boolean }> {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const nombre = texto(b.nombre, 120)
  if (!nombre.ok || !nombre.value) return fail(400, "Escribí el nombre del proveedor (hasta 120 caracteres).", "NOMBRE_PROVEEDOR_INVALIDO")
  if (!normalizarNombreProveedor(nombre.value)) return fail(400, "El nombre del proveedor tiene que tener letras o números.", "NOMBRE_PROVEEDOR_INVALIDO")
  const cuit = normalizarCuit(b.cuit)
  if (!cuit.ok) return fail(400, cuit.error, "CUIT_INVALIDO")
  const telefono = texto(b.telefono, 40)
  const email = texto(b.email, 120, 3)
  const notas = texto(b.notas, 500)
  if (!telefono.ok) return fail(400, "El teléfono admite hasta 40 caracteres.", "TELEFONO_INVALIDO")
  if (!email.ok || (email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value))) return fail(400, "El email no es válido.", "EMAIL_INVALIDO")
  if (!notas.ok) return fail(400, "Las notas admiten hasta 500 caracteres.", "NOTAS_INVALIDAS")
  return {
    ok: true,
    value: { nombre: nombre.value, cuit: cuit.valor, telefono: telefono.value, email: email.value?.toLowerCase() ?? null, notas: notas.value, confirmoNombreSimilar: b.confirmoNombreSimilar === true },
  }
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}
const esCuitDuplicado = (error: unknown) => error instanceof Error && error.message.includes("proveedores_negocio_cuit_unico")

async function proveedorConCuit(db: Pick<Tx, "proveedor">, negocioId: string, cuit: string, excluirId?: string) {
  return db.proveedor.findFirst({ where: { negocioId, cuit, ...(excluirId ? { NOT: { id: excluirId } } : {}) }, select: { id: true, nombre: true } })
}

const cuitDuplicado = (existente: { id: string; nombre: string }) =>
  fail(409, `Ya tenés un proveedor con ese CUIT: «${existente.nombre}».`, "PROVEEDOR_CUIT_DUPLICADO", { proveedor: existente })

/** Coincidencias por nombre normalizado: igual, o uno contiene al otro (≥ 4 caracteres). Sólo informa. */
export async function nombresSimilares(db: Pick<Tx, "proveedor">, negocioId: string, nombre: string, excluirId?: string) {
  // Comparación en forma compacta (sin espacios): «Lácteos del Sur S.A.» ≈ «lacteos del sur sa».
  // Iguales, o uno contenido en el otro (mín. 4 caracteres). Sólo advierte; nunca bloquea.
  const compacto = (t: string) => t.replace(/ /g, "")
  const nuevo = compacto(normalizarNombreProveedor(nombre))
  if (!nuevo) return []
  const todos = await db.proveedor.findMany({
    where: { negocioId, ...(excluirId ? { NOT: { id: excluirId } } : {}) },
    select: { id: true, nombre: true, cuit: true, activo: true, nombreNormalizado: true },
    orderBy: { createdAt: "asc" },
    take: 2000,
  })
  return todos
    .filter((p) => {
      const existente = compacto(p.nombreNormalizado)
      if (existente === nuevo) return true
      const corto = existente.length <= nuevo.length ? existente : nuevo
      return corto.length >= 4 && (nuevo.includes(existente) || existente.includes(nuevo))
    })
    .slice(0, 5)
    .map((p) => ({ id: p.id, nombre: p.nombre, cuit: p.cuit, activo: p.activo }))
}

// ---------------------------------------------------------------------------
// Alta
// ---------------------------------------------------------------------------

export type AuditoriaEnTx<T> = (tx: Tx, valor: T) => Promise<void>

export async function crearProveedor(
  db: Db,
  input: { negocioId: string; body: unknown; idempotencyKey: string },
  opciones: { auditar?: AuditoriaEnTx<ProveedorFicha> } = {}
): Promise<ProveedorResult<{ proveedor: ProveedorFicha; replayed: boolean }>> {
  const { negocioId } = input
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "Falta una Idempotency-Key válida.", "IDEMPOTENCY_KEY_REQUIRED")
  const key = input.idempotencyKey.toLowerCase()
  const parsed = parseDatosProveedor(input.body)
  if (!parsed.ok) return parsed
  const d = parsed.value
  const replay = async (client: Pick<Tx, "proveedor">) => {
    const previo = await client.proveedor.findUnique({ where: { negocioId_idempotencyKey: { negocioId, idempotencyKey: key } }, select: PROVEEDOR_SELECT })
    if (!previo) return null
    if (previo.nombre !== d.nombre || previo.cuit !== d.cuit) return fail(409, "Este intento ya se usó con otros datos.", "IDEMPOTENCY_KEY_REUSED")
    return { ok: true as const, value: { proveedor: previo, replayed: true } }
  }
  try {
    return await runSerializable(db, async (tx) => {
      const previo = await replay(tx)
      if (previo) return previo
      if (d.cuit) {
        const existente = await proveedorConCuit(tx, negocioId, d.cuit)
        if (existente) return cuitDuplicado(existente)
      }
      const similares = await nombresSimilares(tx, negocioId, d.nombre)
      if (similares.length > 0 && !d.confirmoNombreSimilar) {
        return fail(409, "Ya tenés proveedores con un nombre parecido. Revisá si es el mismo; si es otro, confirmá el alta.", "PROVEEDOR_NOMBRE_SIMILAR", { coincidencias: similares })
      }
      const proveedor = await tx.proveedor.create({
        data: { negocioId, nombre: d.nombre, nombreNormalizado: normalizarNombreProveedor(d.nombre), cuit: d.cuit, telefono: d.telefono, email: d.email, notas: d.notas, actorId: negocioId, idempotencyKey: key },
        select: PROVEEDOR_SELECT,
      })
      if (opciones.auditar) await opciones.auditar(tx, proveedor)
      return { ok: true as const, value: { proveedor, replayed: false } }
    })
  } catch (error) {
    if (isUniqueViolation(error) || esCuitDuplicado(error)) {
      const previo = await replay(db)
      if (previo) return previo
      if (d.cuit) {
        const existente = await proveedorConCuit(db, negocioId, d.cuit)
        if (existente) return cuitDuplicado(existente)
      }
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Edición de ficha (historial + auditoría; nunca borra)
// ---------------------------------------------------------------------------

const CAMPOS_EDITABLES = ["nombre", "cuit", "telefono", "email", "notas", "activo"] as const

export async function actualizarProveedor(
  db: Db,
  input: { negocioId: string; proveedorId: string; body: unknown },
  opciones: { auditar?: AuditoriaEnTx<{ proveedor: ProveedorFicha; campos: string[] }> } = {}
): Promise<ProveedorResult<{ proveedor: ProveedorFicha; campos: string[] }>> {
  const { negocioId, proveedorId } = input
  const b = (input.body && typeof input.body === "object" ? input.body : {}) as Record<string, unknown>
  try {
    return await runSerializable(db, async (tx) => {
      const filas = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "proveedores" WHERE "id" = ${proveedorId} AND "negocioId" = ${negocioId} FOR UPDATE`
      if (!filas[0]) return fail(404, "Proveedor no encontrado.", "PROVEEDOR_NO_ENCONTRADO")
      const actual = await tx.proveedor.findUniqueOrThrow({ where: { id: proveedorId }, select: PROVEEDOR_SELECT })
      const parsed = parseDatosProveedor({ nombre: b.nombre ?? actual.nombre, cuit: "cuit" in b ? b.cuit : actual.cuit, telefono: "telefono" in b ? b.telefono : actual.telefono, email: "email" in b ? b.email : actual.email, notas: "notas" in b ? b.notas : actual.notas, confirmoNombreSimilar: b.confirmoNombreSimilar })
      if (!parsed.ok) return parsed
      if (b.activo !== undefined && typeof b.activo !== "boolean") return fail(400, "Estado inválido.", "ACTIVO_INVALIDO")
      const nuevo = { nombre: parsed.value.nombre, cuit: parsed.value.cuit, telefono: parsed.value.telefono, email: parsed.value.email, notas: parsed.value.notas, activo: typeof b.activo === "boolean" ? b.activo : actual.activo }
      const campos = CAMPOS_EDITABLES.filter((c) => nuevo[c] !== actual[c])
      if (campos.length === 0) return { ok: true as const, value: { proveedor: actual, campos: [] } }
      if (campos.includes("cuit") && nuevo.cuit) {
        const existente = await proveedorConCuit(tx, negocioId, nuevo.cuit, proveedorId)
        if (existente) return cuitDuplicado(existente)
      }
      if (campos.includes("nombre")) {
        const similares = await nombresSimilares(tx, negocioId, nuevo.nombre, proveedorId)
        if (similares.length > 0 && !parsed.value.confirmoNombreSimilar) {
          return fail(409, "Ya tenés proveedores con un nombre parecido. Confirmá el cambio si es otro proveedor.", "PROVEEDOR_NOMBRE_SIMILAR", { coincidencias: similares })
        }
      }
      await tx.proveedorCambio.create({
        data: { negocioId, proveedorId, campos: JSON.stringify(campos), valoresAnteriores: JSON.stringify(Object.fromEntries(campos.map((c) => [c, actual[c]]))), actorId: negocioId },
      })
      const proveedor = await tx.proveedor.update({
        where: { id: proveedorId },
        data: { ...nuevo, nombreNormalizado: normalizarNombreProveedor(nuevo.nombre) },
        select: PROVEEDOR_SELECT,
      })
      if (opciones.auditar) await opciones.auditar(tx, { proveedor, campos })
      return { ok: true as const, value: { proveedor, campos } }
    })
  } catch (error) {
    if (isUniqueViolation(error) || esCuitDuplicado(error)) {
      const actual = await db.proveedor.findFirst({ where: { id: proveedorId, negocioId }, select: { cuit: true } })
      const cuit = normalizarCuit(b.cuit)
      if (cuit.ok && cuit.valor && cuit.valor !== actual?.cuit) {
        const existente = await proveedorConCuit(db, negocioId, cuit.valor, proveedorId)
        if (existente) return cuitDuplicado(existente)
      }
    }
    throw error
  }
}

export async function historialProveedor(db: Pick<Db, "proveedorCambio">, negocioId: string, proveedorId: string) {
  const filas = await db.proveedorCambio.findMany({ where: { negocioId, proveedorId }, orderBy: { createdAt: "desc" }, take: 100 })
  return filas.map((f) => ({ id: f.id, campos: JSON.parse(f.campos) as string[], valoresAnteriores: JSON.parse(f.valoresAnteriores) as Record<string, unknown>, createdAt: f.createdAt }))
}
