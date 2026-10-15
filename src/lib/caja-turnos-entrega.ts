import { createHash } from "node:crypto"
import { Prisma, type EntregaCustodiaTurnoCaja, type PrismaClient } from "@prisma/client"
import { isValidVentaIdempotencyKey } from "@/lib/caja-venta"

const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const
const OBSERVACION_MAX = 1000
const DESTINO_MAX = 120

export type DestinoEntrega = "DUENO" | "RESGUARDO"
export type TipoEntrega = "ENTREGA_CONFIRMADA" | "RECTIFICACION"
export type EntregaInput = {
  negocioId: string
  turnoCajaId: string
  actorId: string
  idempotencyKey: string
  confirmar: boolean
  tipo: unknown
  efectivoEntregado: unknown
  fondoRemanente: unknown
  destinoTipo: unknown
  destinoNombre: unknown
  observacion: unknown
}

export function parseImporteCustodia(value: unknown): Prisma.Decimal | null {
  if (typeof value !== "string" || value.trim().length > 15 || !/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null
  try {
    const amount = new Prisma.Decimal(value.trim())
    if (!amount.isFinite() || amount.isNegative() || amount.gt("9999999999.99")) return null
    return amount
  } catch { return null }
}

export function normalizarDestinoNombre(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string") return undefined
  const valueTrimmed = value.trim()
  return valueTrimmed.length > 0 && valueTrimmed.length <= DESTINO_MAX ? valueTrimmed : undefined
}

export function normalizarNotaEntrega(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string") return undefined
  const valueTrimmed = value.trim()
  return valueTrimmed.length <= OBSERVACION_MAX ? valueTrimmed || null : undefined
}

function fingerprint(input: EntregaInput, tipo: TipoEntrega, delivered: Prisma.Decimal, retained: Prisma.Decimal, destinationName: string | null, note: string | null) {
  return createHash("sha256").update([
    input.negocioId, input.turnoCajaId, tipo, delivered.toFixed(2), retained.toFixed(2),
    String(input.destinoTipo), destinationName ?? "", note ?? "",
  ].join("\n")).digest("hex")
}

function isSerialization(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" }
function isUnique(error: unknown) { return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" }

export type EntregaResultado =
  | { ok: true; entrega: EntregaCustodiaTurnoCaja; replayed: boolean }
  | { ok: false; status: 400 | 404 | 409; code: string; error: string }
const fail = (status: 400 | 404 | 409, code: string, error: string): EntregaResultado => ({ ok: false, status, code, error })

/** Owner-only append-only custody registration; it only records physical disposition. */
export async function registrarEntregaCustodia(db: PrismaClient, input: EntregaInput): Promise<EntregaResultado> {
  if (!input.turnoCajaId.trim()) return fail(400, "TURNO_INVALIDO", "Turno inválido.")
  if (!input.confirmar) return fail(400, "CONFIRMACION_REQUERIDA", "Confirmá explícitamente la recepción o el destino físico.")
  if (input.tipo !== "ENTREGA_CONFIRMADA" && input.tipo !== "RECTIFICACION") return fail(400, "TIPO_INVALIDO", "Tipo de operación inválido.")
  const tipo: TipoEntrega = input.tipo
  if (!isValidVentaIdempotencyKey(input.idempotencyKey)) return fail(400, "IDEMPOTENCY_KEY_REQUIRED", "Falta una Idempotency-Key válida.")
  const delivered = parseImporteCustodia(input.efectivoEntregado)
  const retained = parseImporteCustodia(input.fondoRemanente)
  if (!delivered || !retained) return fail(400, "IMPORTE_INVALIDO", "Los importes deben ser válidos, no negativos y tener hasta dos decimales.")
  if (input.destinoTipo !== "DUENO" && input.destinoTipo !== "RESGUARDO") return fail(400, "DESTINO_INVALIDO", "Seleccioná dueño o un lugar de resguardo.")
  const destinationName = normalizarDestinoNombre(input.destinoNombre)
  if (destinationName === undefined || (input.destinoTipo === "DUENO" && destinationName !== null) || (input.destinoTipo === "RESGUARDO" && !destinationName)) {
    return fail(400, "DESTINO_INVALIDO", "El resguardo requiere un nombre; para el dueño no corresponde indicar uno.")
  }
  const note = normalizarNotaEntrega(input.observacion)
  if (note === undefined || (tipo === "RECTIFICACION" && !note)) return fail(400, "OBSERVACION_INVALIDA", "La rectificación requiere una observación de hasta 1000 caracteres.")
  const idempotencyKey = input.idempotencyKey.trim().toLowerCase()
  const idempotencyFingerprint = fingerprint(input, tipo, delivered, retained, destinationName, note)

  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(async (tx): Promise<EntregaResultado> => {
        const previous = await tx.entregaCustodiaTurnoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId: input.negocioId, idempotencyKey } } })
        if (previous) {
          if (previous.turnoCajaId !== input.turnoCajaId || previous.actorId !== input.actorId || previous.idempotencyFingerprint !== idempotencyFingerprint) {
            return fail(409, "IDEMPOTENCY_KEY_REUSED", "Este intento ya se usó con otros datos.")
          }
          return { ok: true, entrega: previous, replayed: true }
        }

        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "turnos_caja"
          WHERE "id" = ${input.turnoCajaId} AND "negocioId" = ${input.negocioId}
          FOR UPDATE`
        if (!locked.length) return fail(404, "TURNO_NO_ENCONTRADO", "Turno cerrado no encontrado.")
        const turno = await tx.turnoCaja.findFirst({
          where: { id: input.turnoCajaId, negocioId: input.negocioId },
          select: { id: true, estado: true, cerradoEn: true, cajaFisicaId: true, responsableTipo: true, responsableId: true, empleadoId: true, efectivoContadoDecimal: true, efectivoEsperadoDecimal: true },
        })
        if (!turno) return fail(404, "TURNO_NO_ENCONTRADO", "Turno cerrado no encontrado.")
        if (turno.estado !== "CERRADO_DECLARADO" || !turno.cerradoEn || !turno.efectivoContadoDecimal || !turno.efectivoEsperadoDecimal) return fail(409, "TURNO_NO_CERRADO", "Sólo se puede registrar custodia de un turno declarado y cerrado.")
        if (tipo === "RECTIFICACION") {
          const traspaso = await tx.traspasoFondoTurnoCaja.findUnique({ where: { turnoOrigenId: turno.id }, select: { id: true } })
          if (traspaso) return fail(409, "FONDO_REMANENTE_YA_TRANSFERIDO", "El remanente ya fue recibido por otro turno; no se puede rectificar silenciosamente.")
        }
        if (!delivered.plus(retained).equals(turno.efectivoContadoDecimal)) return fail(400, "SUMA_NO_COINCIDE", "La entrega y el remanente deben sumar exactamente el efectivo declarado.")

        const existingInitial = await tx.entregaCustodiaTurnoCaja.findFirst({ where: { negocioId: input.negocioId, turnoCajaId: input.turnoCajaId, tipo: "ENTREGA_CONFIRMADA" } })
        if (tipo === "ENTREGA_CONFIRMADA" && existingInitial) return fail(409, "ENTREGA_YA_CONFIRMADA", "La entrega inicial ya fue confirmada; registrá una rectificación auditable.")
        if (tipo === "RECTIFICACION" && !existingInitial) return fail(409, "ENTREGA_INICIAL_REQUERIDA", "Primero debe existir una entrega inicial confirmada.")
        const latest = await tx.entregaCustodiaTurnoCaja.findFirst({
          where: { negocioId: input.negocioId, turnoCajaId: input.turnoCajaId },
          orderBy: { secuencia: "desc" }, select: { secuencia: true },
        })
        const secuencia = (latest?.secuencia ?? 0) + 1
        if ((tipo === "ENTREGA_CONFIRMADA" && secuencia !== 1) || (tipo === "RECTIFICACION" && secuencia < 2)) return fail(409, "ENTREGA_ESTADO_INVALIDO", "El historial de entrega cambió; actualizá el turno e intentá nuevamente.")

        const entrega = await tx.entregaCustodiaTurnoCaja.create({ data: {
          negocioId: input.negocioId,
          cajaFisicaId: turno.cajaFisicaId,
          turnoCajaId: turno.id,
          responsableTipo: turno.responsableTipo,
          responsableId: turno.responsableId,
          empleadoId: turno.empleadoId,
          efectivoContadoDecimal: turno.efectivoContadoDecimal,
          efectivoEsperadoDecimal: turno.efectivoEsperadoDecimal,
          diferenciaDecimal: turno.efectivoContadoDecimal.minus(turno.efectivoEsperadoDecimal),
          efectivoEntregadoDecimal: delivered,
          fondoRemanenteDecimal: retained,
          destinoTipo: input.destinoTipo,
          destinoNombre: destinationName,
          actorId: input.actorId,
          confirmadoEn: new Date(),
          observacion: note,
          tipo,
          secuencia,
          estado: "CONFIRMADA",
          idempotencyKey,
          idempotencyFingerprint,
        } })
        return { ok: true, entrega, replayed: false }
      }, { ...TX_OPTIONS, isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (isSerialization(error) && attempt < 3) continue
      if (isUnique(error)) {
        const previous = await db.entregaCustodiaTurnoCaja.findUnique({ where: { negocioId_idempotencyKey: { negocioId: input.negocioId, idempotencyKey } } })
        if (previous && previous.turnoCajaId === input.turnoCajaId && previous.actorId === input.actorId && previous.idempotencyFingerprint === idempotencyFingerprint) return { ok: true, entrega: previous, replayed: true }
        if (previous) return fail(409, "IDEMPOTENCY_KEY_REUSED", "Este intento ya se usó con otros datos.")
        if (tipo === "RECTIFICACION" && attempt < 3) continue
        if (tipo === "RECTIFICACION") return fail(409, "HISTORIAL_CAMBIO", "El historial cambió durante la rectificación; actualizá el turno e intentá nuevamente.")
        return fail(409, "ENTREGA_YA_CONFIRMADA", "Ya existe una entrega inicial; registrá una rectificación auditable.")
      }
      throw error
    }
  }
}

