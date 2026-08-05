// ============================================
// DeliGO — Detección de capacidades del navegador (P3-A)
// ============================================
// Módulo client-safe de SOLO DETECCIÓN — nunca solicita permisos, nunca
// llama `navigator.usb.requestDevice()` ni `navigator.serial.requestPort()`,
// nunca enumera dispositivos ya autorizados, nunca guarda nada en estado ni
// storage. Seguro de importar en cualquier contexto (incluido SSR): nunca
// lanza una excepción, nunca asume que `window`/`navigator` existen.
//
// `directPrintingPotentiallyAvailable: true` significa ÚNICAMENTE que el
// navegador expone alguna API candidata (WebUSB y/o Web Serial) en un
// contexto seguro — NUNCA que exista una impresora física compatible, ni
// que el usuario haya otorgado o vaya a otorgar permiso alguno. Ninguna
// etapa posterior (P3-B/P3-C) debe presentar este valor como garantía de
// compatibilidad.

// Los tipos WebUSB (`navigator.usb`) y Web Serial (`navigator.serial`) NO
// forman parte de `lib.dom.d.ts` en la versión de TypeScript de este
// proyecto (confirmado por auditoría, ver CODEX_REPORT.md) — se declaran
// acá, DELIBERADAMENTE mínimas (solo lo necesario para una comprobación de
// existencia), en vez de instalar un paquete de tipos o ampliar la
// superficie declarada. `unknown` a propósito: este módulo nunca invoca
// ningún método de estos objetos, solo comprueba que existan.
declare global {
  interface Navigator {
    usb?: unknown
    serial?: unknown
  }
}

export interface ThermalPrinterCapabilities {
  webUsbSupported: boolean
  webSerialSupported: boolean
  secureContext: boolean
  /**
   * Ver comentario de cabecera: candidato potencial, nunca una garantía de
   * impresora física compatible ni de permiso ya otorgado.
   */
  directPrintingPotentiallyAvailable: boolean
}

const UNAVAILABLE: ThermalPrinterCapabilities = {
  webUsbSupported: false,
  webSerialSupported: false,
  secureContext: false,
  directPrintingPotentiallyAvailable: false,
}

/**
 * Detecta, de forma puramente informativa, si el entorno actual EXPONE las
 * APIs candidatas para una futura impresión térmica directa. Nunca solicita
 * permisos, nunca abre un selector de dispositivo, nunca lanza — cualquier
 * propiedad ausente o de tipo inesperado se trata como "no soportado", no
 * como un error.
 */
export function detectThermalPrinterCapabilities(): ThermalPrinterCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { ...UNAVAILABLE }
  }

  const webUsbSupported = typeof navigator.usb !== "undefined"
  const webSerialSupported = typeof navigator.serial !== "undefined"
  const secureContext = typeof window.isSecureContext === "boolean" ? window.isSecureContext : false

  return {
    webUsbSupported,
    webSerialSupported,
    secureContext,
    directPrintingPotentiallyAvailable: secureContext && (webUsbSupported || webSerialSupported),
  }
}
