import { NextRequest, NextResponse } from "next/server"
import { Prisma, type Denuncia } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

// Preset denuncia reasons
const MOTIVOS_PRESET: Record<string, string> = {
  direccion_falsa: "Dirección falsa o incorrecta",
  no_retiro: "No retiró el pedido",
  no_pago: "No pagó el pedido",
  comportamiento: "Comportamiento inadecuado",
}

export { MOTIVOS_PRESET }

const MAX_DENUNCIAS_BEFORE_BLOCK = 3
const MAX_MOTIVO_LENGTH = 500
const MAX_MOTIVO_TIPO_LENGTH = 50
const MAX_SERIALIZATION_RETRIES = 3

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// Postgres soporta aislamiento Serializable y Prisma lo expone para este provider
// (confirmado en prisma/schema.prisma: datasource "postgresql"). Un conflicto de
// serialización entre dos transacciones concurrentes (p. ej. crear una denuncia
// mientras se borra otra del mismo cliente) se manifiesta como
// PrismaClientKnownRequestError con code "P2034" — "Transaction failed due to a
// write conflict or a deadlock". Solo ese código se reintenta; cualquier otro error
// se propaga tal cual.
function isSerializationConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
}

// Error de dominio para el conflicto de unicidad persistente (índice único parcial de
// Seguridad-3B sobre denuncias.clienteId+negocioId+pedidoId, aplicable cuando
// pedidoId no es null). Se distingue explícitamente de un conflicto de serialización
// (P2034): P2002 nunca se reintenta, se traduce directo a un 409 de dominio.
class DuplicateDenunciaError extends Error {}

// Ejecuta `fn` dentro de una transacción Serializable, reintentando hasta
// MAX_SERIALIZATION_RETRIES veces solo ante conflictos de serialización detectados de
// forma segura. Si el conflicto persiste tras los reintentos, la excepción se propaga
// para que el handler responda un conflicto seguro (409) en vez de éxito o un 500
// genérico. Nunca se usa un lock en memoria como defensa.
async function runSerializableTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      lastError = error
      if (!isSerializationConflict(error) || attempt === MAX_SERIALIZATION_RETRIES) {
        throw error
      }
    }
  }
  throw lastError
}

// POST - Create a denuncia (business reports a customer)
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Solo los negocios pueden denunciar clientes" }, { status: 403 })
    }

    const rawBody = await req.json().catch(() => null)
    if (!isPlainObject(rawBody)) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
    }

    // Allowlist estricta: cualquier clave extra (negocioId, negocioNombre,
    // clienteNombre, estado de moderación, etc.) rechaza el body con 400.
    const ALLOWED_KEYS = new Set(["clienteId", "pedidoId", "motivoTipo", "motivo"])
    if (Object.keys(rawBody).some((key) => !ALLOWED_KEYS.has(key))) {
      return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
    }

    const { clienteId, pedidoId, motivoTipo, motivo } = rawBody

    if (typeof clienteId !== "string" || !clienteId.trim()) {
      return NextResponse.json({ error: "clienteId es obligatorio" }, { status: 400 })
    }

    // El vínculo real entre un negocio y un cliente en este producto es un pedido
    // concreto entre ambos. Exigir pedidoId (y validarlo más abajo) impide que un
    // negocio denuncie a un cliente arbitrario con el que nunca tuvo un pedido real.
    if (typeof pedidoId !== "string" || !pedidoId.trim()) {
      return NextResponse.json({ error: "pedidoId es obligatorio" }, { status: 400 })
    }

    if (
      typeof motivoTipo !== "string" ||
      !motivoTipo.trim() ||
      motivoTipo.length > MAX_MOTIVO_TIPO_LENGTH ||
      typeof motivo !== "string" ||
      !motivo.trim() ||
      motivo.length > MAX_MOTIVO_LENGTH
    ) {
      return NextResponse.json({ error: "El motivo es obligatorio" }, { status: 400 })
    }

    type PostOutcome =
      | { kind: "cliente_no_encontrado" }
      | { kind: "pedido_no_encontrado" }
      | { kind: "duplicado" }
      | {
          kind: "creada"
          denuncia: Denuncia
          totalDenuncias: number
          bloqueado: boolean
        }

    let outcome: PostOutcome
    try {
      outcome = await runSerializableTransaction(async (tx) => {
        // Releer cliente dentro de la transacción: la decisión de bloqueo nunca se
        // basa en una lectura hecha fuera de esta transacción.
        const cliente = await tx.cliente.findUnique({
          where: { id: clienteId },
          select: { id: true, nombre: true, bloqueado: true, ultimoIp: true, dispositivoFingerprint: true },
        })
        if (!cliente) {
          return { kind: "cliente_no_encontrado" as const }
        }

        // Vínculo real: el pedido citado debe pertenecer al negocio autenticado
        // (sesión, nunca body) Y a este mismo cliente.
        const pedido = await tx.pedido.findFirst({
          where: { id: pedidoId, negocioId: user.id, clienteId },
          select: { id: true },
        })
        if (!pedido) {
          return { kind: "pedido_no_encontrado" as const }
        }

        // Check if already denounced by this negocio for this pedido (prevent duplicates)
        const existing = await tx.denuncia.findFirst({
          where: { clienteId, negocioId: user.id, pedidoId },
          select: { id: true },
        })
        if (existing) {
          return { kind: "duplicado" as const }
        }

        // Create the denuncia. El findFirst de arriba cubre el caso normal; este
        // try/catch es la defensa persistente (índice único parcial en la base de
        // datos, Seguridad-3B) para la carrera que el findFirst no alcanza a detectar
        // — se rodea EXCLUSIVAMENTE esta llamada, nunca todo el bloque, para no
        // confundir un P2002 de otra tabla (p. ej. ClienteBloqueado) con un duplicado
        // de denuncia.
        let denuncia: Denuncia
        try {
          denuncia = await tx.denuncia.create({
            data: {
              clienteId,
              negocioId: user.id,
              pedidoId,
              negocioNombre: user.nombre,
              clienteNombre: cliente.nombre,
              motivoTipo,
              motivo,
            },
          })
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new DuplicateDenunciaError()
          }
          throw error
        }

        // Count total denuncias for this client
        const totalDenuncias = await tx.denuncia.count({
          where: { clienteId },
        })

        // Normalizar el estado final del cliente según el conteo real — todo dentro de
        // la misma transacción: si cualquier paso de acá falla (incluido un conflicto
        // de serialización), la denuncia recién creada también se revierte. No se usa
        // `!cliente.bloqueado` como única puerta: se repara cualquier inconsistencia
        // histórica (flag y filas ClienteBloqueado desalineados del conteo real).
        let bloqueado: boolean

        if (totalDenuncias >= MAX_DENUNCIAS_BEFORE_BLOCK) {
          // 1) Flag: updateMany condicional. count===0 solo significa que ya estaba
          // bloqueado (válido, no es un error).
          await tx.cliente.updateMany({
            where: { id: clienteId, bloqueado: false },
            data: { bloqueado: true, bloqueadoFecha: new Date() },
          })

          // 2) Entradas ClienteBloqueado: se aseguran siempre que el total final sea
          // >= 3, incluso si el cliente ya estaba bloqueado antes de esta denuncia
          // (repara filas faltantes de un bloqueo histórico incompleto).
          if (cliente.ultimoIp && cliente.ultimoIp !== "unknown") {
            const existingIpBlock = await tx.clienteBloqueado.findFirst({
              where: { ip: cliente.ultimoIp, clienteId },
            })
            if (!existingIpBlock) {
              await tx.clienteBloqueado.create({
                data: {
                  ip: cliente.ultimoIp,
                  fingerprint: cliente.dispositivoFingerprint || "",
                  clienteId,
                  clienteNombre: cliente.nombre,
                },
              })
            }
          }

          if (cliente.dispositivoFingerprint) {
            const existingFpBlock = await tx.clienteBloqueado.findFirst({
              where: { fingerprint: cliente.dispositivoFingerprint, clienteId },
            })
            if (!existingFpBlock) {
              await tx.clienteBloqueado.create({
                data: {
                  ip: cliente.ultimoIp || "",
                  fingerprint: cliente.dispositivoFingerprint,
                  clienteId,
                  clienteNombre: cliente.nombre,
                },
              })
            }
          }

          bloqueado = true
        } else {
          // Menos de 3 denuncias: normalizar igual, aunque el flag ya fuera false, para
          // reparar datos históricos (cliente desbloqueado con filas ClienteBloqueado
          // viejas todavía presentes).
          await tx.cliente.updateMany({
            where: { id: clienteId, bloqueado: true },
            data: { bloqueado: false, bloqueadoFecha: null },
          })

          // Limpieza acotada exclusivamente a este cliente — nunca por IP/fingerprint
          // solos, para no afectar el bloqueo de otro cliente que comparta esos valores.
          await tx.clienteBloqueado.deleteMany({
            where: { clienteId },
          })

          bloqueado = false
        }

        return { kind: "creada" as const, denuncia, totalDenuncias, bloqueado }
      })
    } catch (error) {
      if (error instanceof DuplicateDenunciaError) {
        return NextResponse.json(
          { error: "Ya denunciaste a este cliente por este pedido" },
          { status: 409 }
        )
      }
      if (isSerializationConflict(error)) {
        return NextResponse.json(
          { error: "No se pudo procesar la denuncia por un conflicto de concurrencia. Reintentá." },
          { status: 409 }
        )
      }
      throw error
    }

    if (outcome.kind === "cliente_no_encontrado") {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }
    if (outcome.kind === "pedido_no_encontrado") {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 })
    }
    if (outcome.kind === "duplicado") {
      return NextResponse.json({ error: "Ya denunciaste a este cliente por este pedido" }, { status: 409 })
    }

    const { denuncia, totalDenuncias, bloqueado } = outcome
    return NextResponse.json({
      ok: true,
      denuncia,
      totalDenuncias,
      bloqueado,
      mensaje: bloqueado
        ? `Cliente bloqueado automáticamente (${totalDenuncias} denuncias)`
        : `Denuncia registrada (${totalDenuncias}/${MAX_DENUNCIAS_BEFORE_BLOCK})`,
    }, { status: 201 })
  } catch (error) {
    console.error("Error creating denuncia:", error)
    return NextResponse.json({ error: "Error al crear la denuncia" }, { status: 500 })
  }
}

// GET - List denuncias (for negocio or superadmin)
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || (user.type !== "negocio" && user.type !== "superadmin")) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const clienteId = searchParams.get("clienteId")

    const where: Record<string, unknown> = {}

    if (user.type === "negocio") {
      where.negocioId = user.id
    }

    if (clienteId) {
      where.clienteId = clienteId
    }

    const denuncias = await db.denuncia.findMany({
      where,
      orderBy: { fecha: "desc" },
      take: 100,
    })

    // El estado de bloqueo del cliente solo se agrega si el actor está autorizado a
    // verlo: superadmin (rol administrativo real), o un negocio que efectivamente
    // encontró al menos una denuncia propia contra ese cliente (es decir, ya tiene un
    // vínculo real registrado) — nunca por el solo hecho de conocer/adivinar un
    // clienteId. Sin esto, cualquier negocio autenticado podía consultar el email y el
    // estado de bloqueo de un cliente arbitrario aunque nunca lo hubiera denunciado.
    const puedeVerClienteInfo =
      clienteId && (user.type === "superadmin" || (user.type === "negocio" && denuncias.length > 0))

    let clienteInfo = null
    if (puedeVerClienteInfo) {
      const cliente = await db.cliente.findUnique({
        where: { id: clienteId as string },
        select: { id: true, nombre: true, bloqueado: true, bloqueadoFecha: true, email: true },
      })
      if (cliente) {
        clienteInfo = cliente
      }
    }

    return NextResponse.json({ denuncias, clienteInfo })
  } catch (error) {
    console.error("Error fetching denuncias:", error)
    return NextResponse.json({ error: "Error al obtener denuncias" }, { status: 500 })
  }
}
