// ============================================
// F5-A — CUIT / nombres de proveedor (puro; misma regla que la función SQL f5a_cuit_valido)
// ============================================
import { describe, expect, test } from "bun:test"
import { cuitValido, formatearCuit, normalizarCuit, normalizarNombreProveedor } from "@/lib/cuit"

describe("F5-A — CUIT", () => {
  test("dígito verificador módulo 11 con los pesos oficiales y prefijos válidos", () => {
    for (const ok of ["20123456786", "30712345671", "27333333339", "30500000011", "20400000027", "33600000034"]) expect(cuitValido(ok)).toBe(true)
    for (const malo of ["20123456780", "12123456786", "2012345678", "201234567861", "abcdefghijk", "00000000000"]) expect(cuitValido(malo)).toBe(false)
  })

  test("normaliza guiones, puntos y espacios; vacío = sin CUIT; rechaza letras y largo incorrecto", () => {
    expect(normalizarCuit("20-12345678-6")).toEqual({ ok: true, valor: "20123456786" })
    expect(normalizarCuit(" 20.12345678.6 ")).toEqual({ ok: true, valor: "20123456786" })
    expect(normalizarCuit("")).toEqual({ ok: true, valor: null })
    expect(normalizarCuit(null)).toEqual({ ok: true, valor: null })
    expect(normalizarCuit(undefined)).toEqual({ ok: true, valor: null })
    expect(normalizarCuit("20-1234567A-6").ok).toBe(false)
    expect(normalizarCuit("20-1234567-6").ok).toBe(false)
    expect(normalizarCuit("20-12345678-0").ok).toBe(false)
    expect(normalizarCuit(20123456786).ok).toBe(false)
  })

  test("formato de presentación y normalización de nombres (sólo para advertir similares)", () => {
    expect(formatearCuit("20123456786")).toBe("20-12345678-6")
    expect(formatearCuit(null)).toBe("")
    expect(normalizarNombreProveedor("  Lácteos   del Sur S.A. ")).toBe("lacteos del sur s a")
    expect(normalizarNombreProveedor("PANIFICADORA ÑANDÚ")).toBe("panificadora nandu") // ñ se pliega a n: sólo sirve para advertir
  })
})
