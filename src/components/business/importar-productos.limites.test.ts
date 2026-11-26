// T1-09 — formatos y límites de la importación: el texto sale de las MISMAS constantes que usan el lector y el servidor.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { TEXTO_LIMITES_IMPORTACION } from "./importar-productos"
import { MAX_BYTES_ARCHIVO } from "@/lib/importacion-archivo"
import { MAX_FILAS_IMPORTACION } from "@/lib/importacion-limites"

describe("T1-09 — formatos y límites visibles en la importación (dueño y empleado)", () => {
  test("XLSX y CSV, primera hoja, 5 MB y 2.000 filas, derivados de las constantes vigentes", () => {
    expect(MAX_BYTES_ARCHIVO).toBe(5 * 1024 * 1024)
    expect(MAX_FILAS_IMPORTACION).toBe(2000)
    expect([...TEXTO_LIMITES_IMPORTACION]).toEqual([
      "Archivos Excel (.xlsx) o CSV (.csv).",
      "De un Excel se procesa sólo la primera hoja.",
      "Tamaño máximo: 5 MB.",
      "Máximo: 2.000 filas por importación.",
    ])
  })

  test("el servidor usa el mismo límite de filas (re-exportado, sin un segundo valor) y la pantalla no lo escribe a mano", () => {
    const servicio = readFileSync("src/lib/importacion-productos-service.ts", "utf8")
    expect(servicio).toContain('import { MAX_FILAS_IMPORTACION } from "@/lib/importacion-limites"')
    expect(servicio).not.toMatch(/MAX_FILAS_IMPORTACION\s*=\s*\d/)
    const pantalla = readFileSync("src/components/business/importar-productos.tsx", "utf8")
    expect(pantalla).not.toMatch(/2\.000 filas|5 MB\./)
    // Una sola pantalla para el dueño y el empleado.
    expect(readFileSync("src/app/negocio/importar-productos/page.tsx", "utf8")).toContain("<ImportarProductos")
    expect(readFileSync("src/app/operaciones/mi-panel/[slug]/productos/importar/page.tsx", "utf8")).toContain("<ImportarProductos")
  })
})
