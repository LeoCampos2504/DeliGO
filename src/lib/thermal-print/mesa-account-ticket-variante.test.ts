/// <reference types="bun-types" />
// ============================================
// P2-T56-R3A-P0-F1 — la variante del PedidoItem llega al ticket de cuenta
// ============================================
// Cadena real completa, sin mocks: input persistido (PedidoItem con snapshot
// varianteNombre) → buildCuentaMesa → buildMesaAccountThermalTicket →
// buildEscPosTicket. Pura: sin DB, sin red, sin React.
import { describe, expect, test } from "bun:test"
import { buildCuentaMesa, type CuentaPedidoInput } from "@/lib/mesa-cuenta"
import { buildMesaAccountThermalTicket } from "./mesa-account-ticket"
import { buildEscPosTicket, PAPER_PROFILE_58MM } from "./escpos"

function rawDecode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("")
}

function pedidoConItems(items: CuentaPedidoInput["items"]): CuentaPedidoInput {
  return { id: "pedido-1", estado: "recibido", fecha: "2026-10-02T00:57:18.020Z", total: 3000, notas: null, items }
}

const ITEM_CON_VARIANTE = {
  id: "item-1",
  nombre: "Coca Cola",
  precio: 2000,
  cantidad: 1,
  agregados: "[]",
  secciones: "{}",
  ingredientesQuitados: "[]",
  talle: "",
  color: "",
  varianteNombre: "600ml",
}

const ITEM_SIMPLE = {
  id: "item-2",
  nombre: "Yerba mate",
  precio: 1000,
  cantidad: 1,
  agregados: "[]",
  secciones: "{}",
  ingredientesQuitados: "[]",
  talle: "",
  color: "",
  varianteNombre: null,
}

function ticketFor(items: CuentaPedidoInput["items"]) {
  return buildMesaAccountThermalTicket({
    negocio: { nombre: "Negocio Test" },
    mesa: { numero: 5 },
    ocupacion: { iniciadaEn: "2026-10-02T00:50:00.000Z", cerradaEn: null, estado: "activa" },
    cuenta: buildCuentaMesa([pedidoConItems(items)]),
  })
}

describe("P2-T56-R3A-P0-F1 — variante en el ticket de cuenta de mesa", () => {
  test("F1-C: el modelo térmico lleva la variante del snapshot, separada del nombre", () => {
    const ticket = ticketFor([ITEM_CON_VARIANTE])
    const [item] = ticket.pedidos[0].items
    expect(item.nombre).toBe("Coca Cola")
    expect(item.variante).toBe("600ml")
  })

  test("F1-C: el ticket impreso (ESC/POS) muestra la variante en su línea bajo el producto", () => {
    const text = rawDecode(buildEscPosTicket(ticketFor([ITEM_CON_VARIANTE]), PAPER_PROFILE_58MM))
    const productoIdx = text.indexOf("1x Coca Cola")
    const varianteIdx = text.indexOf("600ml")
    expect(productoIdx).toBeGreaterThanOrEqual(0)
    expect(varianteIdx).toBeGreaterThan(productoIdx)
  })

  test("F1-E: el nombre del producto no se duplica ni se concatena con la variante", () => {
    const text = rawDecode(buildEscPosTicket(ticketFor([ITEM_CON_VARIANTE]), PAPER_PROFILE_58MM))
    expect(text.split("Coca Cola").length - 1).toBe(1)
    expect(text).not.toContain("Coca Cola 600ml")
    expect(text).not.toContain("Coca Cola - 600ml")
  })

  test("F1-D: producto simple — variante vacía, sin línea extra ni 'undefined'/'null'", () => {
    const ticket = ticketFor([ITEM_SIMPLE])
    expect(ticket.pedidos[0].items[0].variante).toBe("")
    const conVariante = rawDecode(buildEscPosTicket(ticketFor([{ ...ITEM_SIMPLE, varianteNombre: "X" }]), PAPER_PROFILE_58MM))
    const sinVariante = rawDecode(buildEscPosTicket(ticket, PAPER_PROFILE_58MM))
    expect(sinVariante).not.toContain("undefined")
    expect(sinVariante).not.toContain("null")
    // La única diferencia entre ambos tickets es la línea de la variante.
    expect(conVariante.length).toBeGreaterThan(sinVariante.length)
  })

  test("pedido mixto: cada línea conserva su propia variante (o ninguna)", () => {
    const ticket = ticketFor([ITEM_CON_VARIANTE, ITEM_SIMPLE])
    expect(ticket.pedidos[0].items.map((i) => i.variante)).toEqual(["600ml", ""])
  })

  test("F1-F: input sin el campo varianteNombre (llamador legacy) → sin variante, sin error", () => {
    const { varianteNombre: _omit, ...legacy } = ITEM_CON_VARIANTE
    expect(ticketFor([legacy]).pedidos[0].items[0].variante).toBe("")
  })
})
