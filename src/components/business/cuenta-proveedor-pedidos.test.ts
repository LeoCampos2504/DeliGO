// T1-04 — texto del reparto de «Pagar deudas seleccionadas»: lo no repartido es saldo a favor DEL NEGOCIO.
import { describe, expect, test } from "bun:test"
import { textoRepartoPago } from "./cuenta-proveedor-pedidos"

const plano = (t: string) => t.replace(/\s+/g, " ")

describe("T1-04 — texto del saldo a favor al pagar deudas seleccionadas", () => {
  test("ejemplo certificado del Bloque 3: se aplican $4.231,50 de $5.000,00 y $768,50 quedan a favor del NEGOCIO", () => {
    const t = plano(textoRepartoPago(4231.5, 5000, 768.5))
    expect(t).toBe(plano("Se aplican $ 4.231,50 de los $ 5.000,00 pagados. Los $ 768,50 restantes quedan como saldo a favor de tu negocio con este proveedor y no se aplicarán automáticamente a otras deudas."))
    expect(t).not.toContain("a favor del proveedor")
  })

  test("sin resto no menciona saldo a favor; sin importe todavía sólo dice lo aplicado", () => {
    expect(plano(textoRepartoPago(5000, 5000, 0))).toBe(plano("Se aplican $ 5.000,00 de los $ 5.000,00 pagados."))
    expect(plano(textoRepartoPago(0, Number.NaN, 0))).toBe(plano("Se aplican $ 0,00."))
  })
})
