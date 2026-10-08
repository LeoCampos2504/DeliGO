// ============================================
// F9 — barcode detector loader (browser only, lazy)
// ============================================
// One detection interface for every platform:
//   - the native W3C BarcodeDetector when the browser has it AND supports
//     the retail formats (Chrome Android, Samsung Internet);
//   - otherwise the `barcode-detector` ponyfill (ZXing-C++ compiled to
//     WebAssembly) — iPhone Safari / installed iPhone PWA, desktop browsers.
// The WebAssembly binary is served by DeliGO itself (same origin, see
// public/vendor/zxing-wasm/<version>/): the package's default jsDelivr CDN
// location is overridden, so no external CDN is ever contacted (and the
// CSP connect-src 'self' would block it anyway).
// Nothing here runs at import time: the ponyfill is dynamically imported
// only when a scanner actually opens, so SSR/build never touch it.

import { SCANNER_BARCODE_FORMATS } from "@/lib/barcode"

/** Must match the installed zxing-wasm version (asserted by the F9 static contract test). */
export const ZXING_WASM_VERSION_SERVED = "3.1.3"
export const ZXING_READER_WASM_URL = `/vendor/zxing-wasm/${ZXING_WASM_VERSION_SERVED}/zxing_reader.wasm`

export interface DetectedBarcodeLike {
  rawValue: string
  format: string
}

export interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcodeLike[]>
}

export interface LoadedBarcodeDetector {
  detector: BarcodeDetectorLike
  engine: "native" | "wasm"
}

interface NativeBarcodeDetectorCtor {
  new (options: { formats: string[] }): BarcodeDetectorLike
  getSupportedFormats(): Promise<string[]>
}

let cached: Promise<LoadedBarcodeDetector> | null = null

export function loadBarcodeDetector(): Promise<LoadedBarcodeDetector> {
  if (cached) return cached
  cached = (async (): Promise<LoadedBarcodeDetector> => {
    const formats = [...SCANNER_BARCODE_FORMATS]
    const Native = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorCtor }).BarcodeDetector
    if (typeof Native === "function" && typeof Native.getSupportedFormats === "function") {
      try {
        const supported = await Native.getSupportedFormats()
        const usable = formats.filter((f) => supported.includes(f))
        if (usable.includes("ean_13") && usable.includes("code_128")) {
          return { detector: new Native({ formats: usable }), engine: "native" }
        }
      } catch {
        // fall through to the WebAssembly ponyfill
      }
    }
    const ponyfill = await import("barcode-detector/ponyfill")
    await ponyfill.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? ZXING_READER_WASM_URL : prefix + path),
      },
      fireImmediately: true,
    })
    return { detector: new ponyfill.BarcodeDetector({ formats }), engine: "wasm" }
  })()
  // A failed load (offline, blocked) must be retryable on the next open.
  cached.catch(() => {
    cached = null
  })
  return cached
}
