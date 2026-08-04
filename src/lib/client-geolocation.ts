"use client"

// ============================================
// DeliGO — Lectura de ubicación del cliente (P0-C.1)
// ============================================
// Helper compartido entre la comprobación al abrir el QR de mesa y la
// lectura fresca antes de cada pedido de mesa, para no duplicar la misma
// lógica en dos lugares. Reglas fijas, no negociables:
//   - Nunca usa watchPosition (una sola lectura por llamada).
//   - Nunca persiste la posición (ni localStorage, ni sessionStorage, ni
//     cookies) — vive únicamente en memoria de quien llama.
//   - Nunca registra coordenadas en consola.
//   - Nunca envía datos a servicios de terceros — esta función no hace
//     ningún fetch, solo envuelve la API nativa del navegador.

export type ClientGeolocationResult =
  | { ok: true; lat: number; lng: number; accuracy: number }
  | { ok: false; reason: "unsupported" | "denied" | "timeout" | "unavailable" }

const GEOLOCATION_TIMEOUT_MS = 12000

export function getFreshClientLocation(): Promise<ClientGeolocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, reason: "unsupported" })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          ok: true,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ ok: false, reason: "denied" })
        } else if (error.code === error.TIMEOUT) {
          resolve({ ok: false, reason: "timeout" })
        } else {
          resolve({ ok: false, reason: "unavailable" })
        }
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: 0,
      }
    )
  })
}
