// ============================================
// T3 — consultas automáticas ante un rechazo DEFINITIVO de autenticación (401/403)
// ============================================
// Patrón compartido para las consultas periódicas de React Query (campana de avisos, destacado): antes, la queryFn
// convertía un 401 en un resultado vacío y el sondeo seguía cada 10–30 s indefinidamente, generando rechazos
// innecesarios (parte de los 116 HTTP 401 históricos) y ocultando la causa. Ahora un 401/403 se lanza como
// `AuthRejectedError`: no se reintenta, detiene el `refetchInterval` y el refetch al recuperar el foco para ESA
// consulta (su clave incluye al actor), y el llamador limpia lo que mostraba. Un actor nuevo o un remonte vuelven a
// consultar. Los errores de red o 5xx no detienen nada (siguen el comportamiento normal). El servidor no cambia:
// los rechazos legítimos se conservan y se siguen registrando.

export class AuthRejectedError extends Error {
  constructor(readonly status: 401 | 403) {
    super(`auth rejected ${status}`)
    this.name = "AuthRejectedError"
  }
}

export function isAuthRejected(error: unknown): error is AuthRejectedError {
  return error instanceof AuthRejectedError
}

/** Lanza `AuthRejectedError` para 401/403; deja pasar cualquier otra respuesta sin tocarla. */
export function throwIfAuthRejected(res: Response): void {
  if (res.status === 401 || res.status === 403) throw new AuthRejectedError(res.status)
}

/** `refetchInterval`: sigue sondeando salvo que el último error haya sido un rechazo de autenticación. */
export function pollUnlessAuthRejected(error: unknown, intervalMs: number): number | false {
  return isAuthRejected(error) ? false : intervalMs
}

/** `retry`: nunca reintenta un rechazo de autenticación; el resto, hasta 3 veces (default de React Query). */
export function retryUnlessAuthRejected(failureCount: number, error: unknown): boolean {
  return !isAuthRejected(error) && failureCount < 3
}
