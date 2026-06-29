import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import {
  PAIRING_TTL_MS,
  generateOpaqueToken,
  generateManualCodeRaw,
  formatManualCode,
  normalizeManualCode,
  sha256Hex,
} from "@/lib/operaciones-terminal-auth"

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

async function getNegocioAuth(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const user = await getUserFromToken(token)
  if (!user || user.type !== "negocio") return null

  return user
}

// POST — Genera credenciales de activación (QR + código manual) para una terminal pendiente.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getNegocioAuth(req)
    if (!user) {
      return noStore(NextResponse.json({ error: "No autenticado" }, { status: 401 }))
    }

    const { id } = await params

    // Credenciales: QR (token opaco) + código manual (Crockford Base32). Solo se
    // guardan sus hashes; los valores crudos se devuelven una sola vez a la UI.
    const qrTokenRaw = generateOpaqueToken()
    const qrHash = sha256Hex(qrTokenRaw)

    const manualRaw = generateManualCodeRaw()
    const manualFormatted = formatManualCode(manualRaw)
    const manualHash = sha256Hex(normalizeManualCode(manualRaw))

    const now = new Date()
    const expiresAt = new Date(now.getTime() + PAIRING_TTL_MS)

    type GenResult =
      | { status: "ok" }
      | { status: "not_found" }
      | { status: "revoked" }
      | { status: "active" }
      | { status: "not_activatable" }

    // Buscar + validar + revocar previas + crear credenciales en UNA sola transacción
    // Serializable. Si otra operación activa o revoca la terminal en paralelo, el conflicto
    // de serialización aborta esta generación y NO se crean credenciales nuevas.
    let result: GenResult
    try {
      result = await db.$transaction<GenResult>(
        async (tx) => {
          const terminal = await tx.terminalOperativa.findFirst({
            where: { id, negocioId: user.id },
            select: { id: true, estado: true, revokedAt: true },
          })
          if (!terminal) return { status: "not_found" }
          if (terminal.revokedAt || terminal.estado === "revocado") return { status: "revoked" }
          if (terminal.estado === "activo") return { status: "active" }
          if (terminal.estado !== "pendiente") return { status: "not_activatable" }

          // Revocar credenciales pendientes anteriores de esta terminal.
          await tx.vinculacionTerminalOperativa.updateMany({
            where: { terminalSalonId: terminal.id, usedAt: null, revokedAt: null },
            data: { revokedAt: now },
          })

          // Crear las dos credenciales nuevas (misma terminal, mismo vencimiento).
          await tx.vinculacionTerminalOperativa.create({
            data: {
              negocioId: user.id,
              terminalSalonId: terminal.id,
              codeHash: qrHash,
              codePrefix: "qr",
              expiresAt,
            },
          })
          await tx.vinculacionTerminalOperativa.create({
            data: {
              negocioId: user.id,
              terminalSalonId: terminal.id,
              codeHash: manualHash,
              codePrefix: "manual",
              expiresAt,
            },
          })

          return { status: "ok" }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    } catch {
      // Conflicto de serialización u otro error transaccional → no se crearon credenciales.
      // Log genérico: nunca se incluye secreto, hash, código ni mensaje de error.
      console.error("[TerminalesOperativas] Falló la transacción de activación")
      return noStore(
        NextResponse.json(
          { error: "No se pudo generar la activación. Intentá nuevamente." },
          { status: 409 }
        )
      )
    }

    if (result.status === "not_found") {
      return noStore(NextResponse.json({ error: "Terminal no encontrada" }, { status: 404 }))
    }
    if (result.status === "revoked") {
      return noStore(NextResponse.json({ error: "La terminal está revocada" }, { status: 409 }))
    }
    if (result.status === "active") {
      return noStore(NextResponse.json({ error: "La terminal ya está activa" }, { status: 409 }))
    }
    if (result.status === "not_activatable") {
      return noStore(
        NextResponse.json({ error: "La terminal no puede activarse" }, { status: 409 })
      )
    }

    // Auditoría de mejor esfuerzo: nunca rompe una generación ya confirmada.
    // SIN secretos (no se incluyen tokens, códigos ni hashes).
    try {
      await auditLog({
        userId: user.id,
        userType: "negocio",
        accion: "terminal_operativa.activacion_generada",
        recurso: "terminal_operativa",
        recursoId: id,
        detalle: { metodos: ["qr", "manual"], expiresAt: expiresAt.toISOString() },
      })
    } catch {
      console.warn("[TerminalesOperativas] Falló la auditoría de activación")
    }

    return noStore(
      NextResponse.json({
        ok: true,
        qrToken: qrTokenRaw,
        manualCode: manualFormatted,
        expiresAt: expiresAt.toISOString(),
      })
    )
  } catch {
    console.error("[TerminalesOperativas] Falló la generación de activación")
    return noStore(
      NextResponse.json({ error: "Error al generar la activación" }, { status: 500 })
    )
  }
}
