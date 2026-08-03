import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import {
  cleanupOldRegistrations,
  countRecentRegistrations,
  getOrCreateDeviceToken,
  getRegistrationLimitSecret,
  hashDeviceForRegistrationLimit,
  hashIpForRegistrationLimit,
  normalizeRegistrationIp,
  RegistrationLimitSecretMissingError,
  REGISTRATION_CLEANUP_AGE_MS,
  REGISTRATION_WINDOW_MS,
  setDeviceCookie,
  WEEKLY_REGISTRATION_LIMIT,
} from "@/lib/operativo-registration-limit"

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/

// Bugfix-5F: mismo patrón ya usado en otras rutas del proyecto
// (src/app/api/operativo/mozos/unirse/route.ts, entre otras) para
// transacciones Serializable — reintenta solo ante un conflicto real de
// serialización (P2034), nunca ante otro tipo de error.
const SERIALIZATION_RETRY_LIMIT = 3

function isSerializationConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  )
}

async function withSerializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZATION_RETRY_LIMIT; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === SERIALIZATION_RETRY_LIMIT) {
        throw error
      }
    }
  }

  throw new Error("SERIALIZATION_RETRY_EXHAUSTED")
}

function isEmailUniqueConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    (error.meta?.target as string[]).includes("email")
  )
}

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

function emailAlreadyExistsResponse() {
  return noStore(
    NextResponse.json(
      { error: "Ya existe una cuenta con este correo.", code: "EMAIL_ALREADY_EXISTS" },
      { status: 409 }
    )
  )
}

type CuentaCreada = { id: string; nombre: string; email: string; activo: boolean }

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req)
    const rl = checkRateLimit("register", ip)
    if (!rl.allowed) {
      return noStore(rateLimitResponse(rl, "Demasiados intentos de registro. Intentá de nuevo en 1 hora."))
    }

    const body = await req.json()
    const nombre = typeof body.nombre === "string" ? body.nombre.trim() : ""
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!nombre || !email || !password) {
      return noStore(
        NextResponse.json(
          { error: "Nombre, email y contraseña son obligatorios" },
          { status: 400 }
        )
      )
    }

    if (!EMAIL_REGEX.test(email)) {
      return noStore(NextResponse.json({ error: "Email inválido" }, { status: 400 }))
    }

    if (password.length < 6) {
      return noStore(
        NextResponse.json(
          { error: "La contraseña debe tener al menos 6 caracteres" },
          { status: 400 }
        )
      )
    }

    // Camino rápido: la mayoría de los emails duplicados se detectan acá,
    // antes de tocar el límite de registro. El unique constraint de
    // "email" sigue siendo la garantía real contra una carrera concurrente
    // (ver isEmailUniqueConflict más abajo).
    const existing = await db.cuentaOperativa.findUnique({
      where: { email },
      select: { id: true },
    })
    if (existing) {
      return emailAlreadyExistsResponse()
    }

    let secret: string
    try {
      secret = getRegistrationLimitSecret()
    } catch (error) {
      if (error instanceof RegistrationLimitSecretMissingError) {
        console.error(
          "[OperativoRegister] REGISTRATION_LIMIT_SECRET no está configurada — no se puede aplicar el límite de registro de forma segura. Registro rechazado."
        )
        return noStore(
          NextResponse.json({ error: "No se pudo procesar el registro. Intentá de nuevo más tarde." }, { status: 500 })
        )
      }
      throw error
    }

    const { token: deviceToken, isNew: isNewDevice } = getOrCreateDeviceToken(req)
    // Corrección: "unknown" (IP no fiable) nunca se hashea — hacerlo
    // produciría el mismo hash compartido por todos los usuarios sin IP
    // detectable, bloqueándolos globalmente entre sí. Con ipHash = null el
    // límite por IP se omite y solo aplica el límite por dispositivo.
    const normalizedIp = normalizeRegistrationIp(ip)
    const ipHash = normalizedIp ? hashIpForRegistrationLimit(normalizedIp, secret) : null
    const deviceHash = hashDeviceForRegistrationLimit(deviceToken, secret)

    const windowStart = new Date(Date.now() - REGISTRATION_WINDOW_MS)
    const cleanupCutoff = new Date(Date.now() - REGISTRATION_CLEANUP_AGE_MS)
    const hashedPassword = await hashPassword(password)

    const result = await withSerializableRetry(() =>
      db.$transaction(
        async (tx) => {
          // Limpieza oportunista: nunca toca los últimos 14 días, por lo
          // tanto nunca afecta la ventana de 7 días que se evalúa a continuación.
          await cleanupOldRegistrations(tx, cleanupCutoff)

          const { byIp, byDevice } = await countRecentRegistrations(tx, ipHash, deviceHash, windowStart)
          // blockedByIp solo puede ser true con una IP real conocida —
          // ipHash === null (IP no fiable) nunca bloquea por IP, únicamente
          // por dispositivo.
          const blockedByIp = ipHash !== null && byIp >= WEEKLY_REGISTRATION_LIMIT
          const blockedByDevice = byDevice >= WEEKLY_REGISTRATION_LIMIT
          if (blockedByIp || blockedByDevice) {
            return { blocked: true as const }
          }

          let account: CuentaCreada
          try {
            account = await tx.cuentaOperativa.create({
              data: { nombre, email, password: hashedPassword },
              select: { id: true, nombre: true, email: true, activo: true },
            })
          } catch (error) {
            if (isEmailUniqueConflict(error)) {
              return { blocked: false as const, emailConflict: true as const }
            }
            throw error
          }

          await tx.cuentaOperativaRegistro.create({
            data: { ipHash, deviceHash },
          })

          return { blocked: false as const, emailConflict: false as const, account }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      )
    )

    if (result.blocked) {
      const response = noStore(
        NextResponse.json(
          {
            error: "Alcanzaste el límite de cuentas que pueden crearse desde esta red o dispositivo.",
            code: "WEEKLY_REGISTRATION_LIMIT",
          },
          { status: 429 }
        )
      )
      if (isNewDevice) setDeviceCookie(response, deviceToken)
      return response
    }

    if (result.emailConflict) {
      const response = emailAlreadyExistsResponse()
      if (isNewDevice) setDeviceCookie(response, deviceToken)
      return response
    }

    const response = noStore(NextResponse.json({ ok: true, cuenta: result.account }, { status: 201 }))
    if (isNewDevice) setDeviceCookie(response, deviceToken)
    return response
  } catch (error) {
    console.error("[OperativoRegister] Error:", error)
    return noStore(
      NextResponse.json(
        { error: "No se pudo crear la cuenta" },
        { status: 500 }
      )
    )
  }
}
