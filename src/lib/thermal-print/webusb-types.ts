// ============================================
// DeliGO — Tipos WebUSB mínimos (P3-B1)
// ============================================
// La versión de TypeScript de este proyecto (confirmado por auditoría, ver
// CODEX_REPORT.md) no incluye tipos WebUSB en `lib.dom.d.ts` — ni `USB`, ni
// `USBDevice`, ni ninguna propiedad `usb` en `Navigator`. Este archivo
// declara ÚNICAMENTE la superficie que `webusb-transport.ts` usa
// realmente — nunca una copia de una librería de tipos externa, nunca un
// método/propiedad que P3-B1 no invoque.
//
// Deliberadamente NO son declaraciones `declare global` — son interfaces
// exportadas normales. P3-A (`browser-capabilities.ts`) ya declaró
// globalmente `Navigator.usb?: unknown` para su propia comprobación de
// existencia; volver a declarar esa misma propiedad acá con un tipo más
// estricto (p. ej. `USB`) produciría un conflicto de fusión de
// declaraciones ("Subsequent property declarations must have the same
// type"). `webusb-transport.ts` evita el conflicto por completo: nunca
// vuelve a declarar `Navigator.usb` globalmente, y en su lugar hace un cast
// LOCAL vía un tipo intersección (`Navigator & { usb?: USB }`) en el único
// punto donde necesita el tipo fuerte — ver comentario en
// `getNavigatorUsb()`. Esto significa que este archivo no necesita (y no
// debe) modificar `browser-capabilities.ts`.

export type USBDirection = "in" | "out"
export type USBEndpointType = "bulk" | "interrupt" | "isochronous"
export type USBTransferStatus = "ok" | "stall" | "babble"

export interface USBEndpoint {
  readonly endpointNumber: number
  readonly direction: USBDirection
  readonly type: USBEndpointType
  readonly packetSize?: number
}

export interface USBAlternateInterface {
  readonly alternateSetting: number
  readonly interfaceClass: number
  readonly interfaceSubclass: number
  readonly interfaceProtocol: number
  readonly endpoints: readonly USBEndpoint[]
}

export interface USBInterface {
  readonly interfaceNumber: number
  readonly alternates: readonly USBAlternateInterface[]
  readonly claimed?: boolean
}

export interface USBConfiguration {
  readonly configurationValue: number
  readonly interfaces: readonly USBInterface[]
}

export interface USBOutTransferResult {
  readonly status: USBTransferStatus
  readonly bytesWritten: number
}

export interface USBDevice {
  readonly opened: boolean
  readonly configuration: USBConfiguration | null
  readonly configurations: readonly USBConfiguration[]
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(configurationValue: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  releaseInterface(interfaceNumber: number): Promise<void>
  selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void>
  transferOut(endpointNumber: number, data: Uint8Array): Promise<USBOutTransferResult>
}

export interface USBDeviceFilter {
  readonly vendorId?: number
  readonly productId?: number
  readonly classCode?: number
  readonly subclassCode?: number
  readonly protocolCode?: number
  readonly serialNumber?: string
}

export interface USBDeviceRequestOptions {
  readonly filters: readonly USBDeviceFilter[]
}

export interface USB {
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>
}
