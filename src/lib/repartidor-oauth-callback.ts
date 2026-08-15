export type RepartidorOAuthCallback =
  | { kind: "success"; provider: "google" }
  | { kind: "error"; code: string; message: string }
  | { kind: "none" }

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Cancelaste el inicio de sesión con Google",
  missing_params: "Error en la autenticación con Google",
  invalid_state: "Error de seguridad en la autenticación",
  token_exchange: "Error al conectar con Google",
  user_info: "No se pudo obtener tu información de Google",
  email_not_verified: "Tu email de Google no está verificado",
  server_error: "Error del servidor al autenticar con Google",
}

export function hasRepartidorOAuthCallbackParams(params: URLSearchParams): boolean {
  return params.has("auth_success") || params.has("auth_error")
}

export function cleanRepartidorOAuthCallbackParams(url: URL): string {
  const cleanedUrl = new URL(url.toString())
  cleanedUrl.searchParams.delete("auth_success")
  cleanedUrl.searchParams.delete("auth_error")
  return `${cleanedUrl.pathname}${cleanedUrl.search}${cleanedUrl.hash}`
}

export function readRepartidorOAuthCallback(
  params: URLSearchParams
): RepartidorOAuthCallback {
  const errorCode = params.get("auth_error")
  if (errorCode) {
    return {
      kind: "error",
      code: errorCode,
      message: OAUTH_ERROR_MESSAGES[errorCode] ?? "Error al iniciar sesión con Google",
    }
  }

  if (params.get("auth_success") === "google") {
    return { kind: "success", provider: "google" }
  }

  return { kind: "none" }
}
