import { Prisma } from "@prisma/client"

// ============================================
// GLOBAL-LOGS-PII-1B — safeErrorForLog
// ============================================
// Motivo (evidencia real, verificada empíricamente contra PostgreSQL TESTING
// con un valor sentinel sintético — nunca datos reales): a diferencia de
// `PrismaClientKnownRequestError` (P2002/P2025/etc — `.message`/`.meta` sólo
// incluyen NOMBRES de campo/constraint, nunca los valores reales, contrato
// documentado y confirmado empíricamente en esta tarea),
// `PrismaClientValidationError.message` SÍ puede incluir el valor crudo de
// los argumentos pasados a la query (Prisma renderiza el objeto `where`/
// `data` completo dentro del mensaje para ayudar a debuggear). Si esa query
// se construye con datos derivados de una request (body/query/params) sin
// validación de tipo estricta previa, ese valor —potencialmente PII— queda
// embebido en `error.message`, y cualquier `console.error("...", error)`
// downstream lo expone en logs runtime.
//
// Este helper es la única fuente centralizada de "qué es seguro imprimir de
// un error atrapado" en callers server-side. Nunca serializa objetos
// arbitrarios, nunca reenvía `error.message` de `PrismaClientValidationError`
// ni de `PrismaClientInitializationError` (que en algunas versiones/backends
// puede incluir detalles de conexión). Para un `Error` de aplicación (los
// `throw new Error(...)` propios de este repo, auditados exhaustivamente en
// GLOBAL-LOGS-PII-1B: ninguno interpola PII/secrets en su mensaje — el único
// caso con interpolación en todo `src/` es un código de status HTTP) sí
// conserva `message`, porque es una señal operativa real y ya demostrada
// segura por auditoría, no por asunción.

export type SafeLoggedError = {
  errorType: string
  code?: string | number
  message?: string
  target?: unknown
}

// Forma típica de un error de provider HTTP (Cloudinary, web-push, fetch a
// APIs externas, etc.): trae statusCode/body/endpoint/headers — cualquiera
// de esos puede incluir credenciales, URLs privadas o datos ecoados por el
// proveedor. Si el objeto atrapado calza con esta forma, `.message` NUNCA
// se reenvía (a diferencia del `Error` de aplicación propio de este repo,
// cuyo `.message` sí está auditado como seguro) — sólo el `statusCode`,
// que es la única señal operativa de este tipo de error que vale la pena
// conservar.
function looksLikeProviderHttpError(value: unknown): value is { statusCode?: number; body?: unknown; endpoint?: unknown; headers?: unknown } {
  if (typeof value !== "object" || value === null) return false
  const candidate = value as Record<string, unknown>
  return "statusCode" in candidate || "body" in candidate || "endpoint" in candidate || "headers" in candidate
}

/**
 * Convierte un `unknown` atrapado en un catch en una forma segura para
 * pasar a `console.error`/`console.warn`. Nunca lanza. Nunca incluye
 * `stack`, `cause`, ni propiedades arbitrarias del objeto original.
 */
export function safeErrorForLog(error: unknown): SafeLoggedError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // Contrato documentado de Prisma + verificado empíricamente en esta
    // tarea: `code` y `meta.target` (nombres de campo/constraint) nunca
    // incluyen los valores reales que violaron la constraint.
    return {
      errorType: "PrismaClientKnownRequestError",
      code: error.code,
      target: (error.meta as { target?: unknown } | undefined)?.target,
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    // NUNCA reenviar `.message` — puede contener los argumentos crudos de
    // la query (valor demostrado embebido en un test dedicado).
    return { errorType: "PrismaClientValidationError" }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    // Puede incluir detalles de conexión según el backend — nunca se
    // reenvía el mensaje completo.
    return { errorType: "PrismaClientInitializationError", code: error.errorCode }
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return { errorType: "PrismaClientRustPanicError" }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return { errorType: "PrismaClientUnknownRequestError" }
  }

  if (looksLikeProviderHttpError(error)) {
    // Nunca body/endpoint/headers/message — sólo el status, que ya es
    // suficiente señal para diagnosticar sin arriesgar datos del proveedor.
    const statusCode = (error as { statusCode?: unknown }).statusCode
    return {
      errorType: error instanceof Error ? error.name || "ProviderHttpError" : "ProviderHttpError",
      code: typeof statusCode === "number" || typeof statusCode === "string" ? statusCode : undefined,
    }
  }

  if (error instanceof Error) {
    // Aplicación propia: auditoría exhaustiva de GLOBAL-LOGS-PII-1B
    // confirmó que ningún `throw new Error(...)` de este repo interpola
    // PII/secrets en su mensaje. `name`/`message` son señal operativa real.
    return { errorType: error.name || "Error", message: error.message }
  }

  // Cualquier otra forma (string, objeto plano de un provider, etc.):
  // nunca se serializa tal cual — sólo su tipo primitivo.
  return { errorType: typeof error }
}
