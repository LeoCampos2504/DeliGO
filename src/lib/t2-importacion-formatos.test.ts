/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test"
import { leerArchivo, MAX_BYTES_ARCHIVO } from "@/lib/importacion-archivo"
import { MAX_FILAS_IMPORTACION, parseNumero } from "@/lib/importacion-productos-service"

describe("T2 formatos de importación", () => {
  test("importes argentinos, celdas numéricas y valores inválidos", () => {
    for (const [entrada, valor] of [["2.315", 2315], ["1.850,50", 1850.5], ["890,75", 890.75], [1234.5, 1234.5], ["", null]] as const) {
      expect(parseNumero(entrada)).toEqual({ ok: true, value: valor })
    }
    for (const entrada of ["2,315", "2.3155", "texto", 1.234]) expect(parseNumero(entrada).ok).toBe(false)
  })
  test("CSV conserva texto, comillas y ceros a la izquierda", async () => {
    const hoja = await leerArchivo(new File(['nombre;codigo\r\n"Producto; A";001234\r\n'], "productos.csv"))
    expect(hoja.encabezados).toEqual(["nombre", "codigo"])
    expect(hoja.filas[0].valores).toEqual(["Producto; A", "001234"])
  })
  test("límite de 5 MB y rechazo de formato", async () => {
    expect(MAX_BYTES_ARCHIVO).toBe(5 * 1024 * 1024)
    expect(MAX_FILAS_IMPORTACION).toBe(2000)
    await expect(leerArchivo(new File([new Uint8Array(MAX_BYTES_ARCHIVO + 1)], "grande.csv"))).rejects.toThrow("5 MB")
    await expect(leerArchivo(new File(["x"], "productos.xls"))).rejects.toThrow("Formato no soportado")
  })
})
