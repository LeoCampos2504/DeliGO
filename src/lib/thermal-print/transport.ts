// ============================================
// DeliGO — Contratos de transporte para impresión térmica directa (P3-A)
// ============================================
// SOLO TIPOS/INTERFACES — ninguna implementación real. Este archivo nunca
// importa ni referencia `USBDevice`, `SerialPort`, ni ninguna clase real de
// WebUSB/Web Serial; nunca abre un selector de dispositivo, nunca escribe
// un byte, nunca se conecta a nada. Sirve como el contrato que P3-B
// (WebUSB experimental) y P3-C (Web Serial experimental) deberán implementar
// después de revisar esta base — implementarlos queda fuera del alcance de
// P3-A.
//
// Ningún objeto de hardware (`USBDevice`/`SerialPort` o equivalente) debe
// persistirse jamás en estado server-side ni en ningún storage — este
// contrato modela solo el ciclo de vida de una conexión efímera, en memoria,
// iniciada por gesto explícito del usuario (a implementar en P3-B/P3-C).

export type ThermalPrinterTransportKind = "webusb" | "webserial"

export type ThermalPrinterTransportState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "writing"
  | "error"

/**
 * Motivo sanitizado de un error de transporte — nunca un mensaje crudo de
 * excepción del navegador (que podría incluir detalles del dispositivo o
 * del entorno). `unknown` es el único catch-all: ningún motivo nuevo debe
 * inventarse sin agregarlo explícitamente a esta unión.
 */
export type ThermalPrinterTransportErrorReason =
  | "user_cancelled"
  | "unsupported_device"
  | "permission_denied"
  | "connection_lost"
  | "partial_write"
  | "unknown"

export interface ThermalPrinterTransportError {
  reason: ThermalPrinterTransportErrorReason
  /** Mensaje ya sanitizado, seguro de mostrar en UI/loguear — nunca el error crudo del navegador. */
  message: string
}

/**
 * Contrato mínimo que un transporte real (P3-B: WebUSB, P3-C: Web Serial)
 * deberá implementar. `connect()` DEBE requerir, en su implementación real,
 * un gesto explícito del usuario (nunca autoconexión) — este contrato no lo
 * impone en el tipo (TypeScript no puede expresar "requiere interacción
 * humana"), pero queda documentado como requisito de cualquier
 * implementación futura (ver CODEX_REPORT.md, sección de seguridad).
 */
export interface ThermalPrinterTransport {
  readonly kind: ThermalPrinterTransportKind
  readonly state: ThermalPrinterTransportState
  connect(): Promise<void>
  write(data: Uint8Array): Promise<void>
  disconnect(): Promise<void>
}
