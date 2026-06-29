import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { checkRateLimit, createRateLimitKey, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { parseStoredGrant } from "@/lib/operaciones-terminal-permissions"
import {
  generateOpaqueToken,
  getTerminalSessionExpiry,
  normalizeManualCode,
  sha256Hex,
  setTerminalSessionCookie,
} from "@/lib/operaciones-terminal-auth"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }
// Mensaje genérico — nunca revela la causa exacta (incorrecto/vencido/usado/revocado…).
const GENERIC_ERROR = "Código inválido, vencido o ya utilizado."

function genericError(status = 400) {
  return NextResponse.json({ error: GENERIC_ERROR }, { status, headers: NO_STORE_HEADERS })
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit por IP (mismo patrón que el canje de códigos operativos).
    const ip = getClientIp(req)
    const rl = checkRateLimit("operativoJoin", createRateLimitKey(ip))
    if (!rl.allowed) {
      return rateLimitResponse(rl, "Demasiados intentos. Probá de nuevo en unos minutos.")
    }

    const body = await req.json().catch(() => null)
    const code = body && typeof body.code === "string" ? body.code : ""
    if (!code.trim()) {
      return genericError()
    }

    // El mismo input puede ser un QR token (exacto) o un código manual (normalizado).
    // Se prueban ambos hashes; nunca se loguea el valor crudo ni el hash.
    const qrHash = sha256Hex(code.trim())
    const manualHash = sha256Hex(normalizeManualCode(code))
    const now = new Date()

    type ActivarResult =
      | {
          ok: true
          rawToken: string
          negocioId: string
          terminal: {
            id: string
            nombre: string
            perfil: string
            areas: string
            scopes: string
            negocio: { id: string; nombre: string; slug: string; colorPrincipal: string }
          }
        }
      | { ok: false }

    let result: ActivarResult

    try {
      result = await db.$transaction<ActivarResult>(async (tx) => {
        const vinculacion = await tx.vinculacionTerminalOperativa.findFirst({
          where: { codeHash: { in: [qrHash, manualHash] } },
          select: {
            id: true,
            terminalSalonId: true,
            expiresAt: true,
            usedAt: true,
            revokedAt: true,
          },
        })

        if (!vinculacion) return { ok: false }
        if (vinculacion.usedAt || vinculacion.revokedAt) return { ok: false }
        if (vinculacion.expiresAt <= now) return { ok: false }
        if (!vinculacion.terminalSalonId) return { ok: false }

        // Se leen aquí (dentro de la transacción) todos los datos seguros necesarios
        // para la respuesta: así no hace falta una consulta posterior al commit.
        const terminal = await tx.terminalOperativa.findFirst({
          where: { id: vinculacion.terminalSalonId },
          select: {
            id: true,
            negocioId: true,
            estado: true,
            revokedAt: true,
            nombre: true,
            perfil: true,
            areas: true,
            scopes: true,
            negocio: { select: { id: true, nombre: true, slug: true, colorPrincipal: true } },
          },
        })
        if (!terminal) return { ok: false }
        if (terminal.revokedAt || terminal.estado === "revocado") return { ok: false }
        if (terminal.estado !== "pendiente") return { ok: false }

        // Consumo atómico: solo gana quien marca usedAt cuando todavía estaba libre.
        const consumed = await tx.vinculacionTerminalOperativa.updateMany({
          where: { id: vinculacion.id, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        })
        if (consumed.count !== 1) return { ok: false }

        // Revocar el resto de credenciales pendientes de esta terminal.
        await tx.vinculacionTerminalOperativa.updateMany({
          where: { terminalSalonId: terminal.id, usedAt: null, revokedAt: null },
          data: { revokedAt: now },
        })

        // Defensa adicional: revocar sesiones previas de la terminal.
        await tx.sesionTerminalOperativa.updateMany({
          where: { terminalSalonId: terminal.id, revokedAt: null },
          data: { revokedAt: now },
        })

        // Crear la sesión opaca (solo se guarda el hash del token).
        const rawToken = generateOpaqueToken()
        await tx.sesionTerminalOperativa.create({
          data: {
            terminalSalonId: terminal.id,
            tokenHash: sha256Hex(rawToken),
            expiresAt: getTerminalSessionExpiry(now),
            lastUsedAt: now,
          },
        })

        // Activar la terminal.
        await tx.terminalOperativa.update({
          where: { id: terminal.id },
          data: { estado: "activo", lastUsedAt: now },
        })

        return {
          ok: true,
          rawToken,
          negocioId: terminal.negocioId,
          terminal: {
            id: terminal.id,
            nombre: terminal.nombre,
            perfil: terminal.perfil,
            areas: terminal.areas,
            scopes: terminal.scopes,
            negocio: terminal.negocio,
          },
        }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch {
      // Conflicto de serialización u otro error transaccional → respuesta genérica.
      return genericError(409)
    }

    if (!result.ok) {
      return genericError()
    }

    // Contexto seguro derivado de los datos leídos DENTRO de la transacción.
    // No hay consulta posterior al commit antes de setear la cookie.
    const grant = parseStoredGrant(result.terminal.areas, result.terminal.scopes)

    // Auditoría de mejor esfuerzo: la terminal YA fue activada y la sesión creada.
    // Una falla de auditoría no puede devolver genericError() ni impedir la cookie.
    try {
      await auditLog({
        userId: result.negocioId,
        userType: "negocio",
        accion: "terminal_operativa.activada",
        recurso: "terminal_operativa",
        recursoId: result.terminal.id,
        detalle: { estado: "activo" },
      })
    } catch {
      console.warn("[OperacionesTerminal] Falló la auditoría posterior a la activación")
    }

    const response = NextResponse.json(
      {
        ok: true,
        terminal: {
          id: result.terminal.id,
          nombre: result.terminal.nombre,
          estado: "activo",
          perfil: result.terminal.perfil,
          areas: grant.areas,
          scopes: grant.scopes,
        },
        negocio: result.terminal.negocio,
      },
      { headers: NO_STORE_HEADERS }
    )

    return setTerminalSessionCookie(response, result.rawToken)
  } catch {
    console.error("[OperacionesTerminal] Falló la activación de terminal")
    return genericError(500)
  }
}
