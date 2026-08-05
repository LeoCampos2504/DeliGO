/// <reference types="bun-types" />
import { describe, test, expect } from "bun:test"
import { buildCuentaMesa, type CuentaPedidoInput } from "@/lib/mesa-cuenta"
import { buildMesaAccountThermalTicket, type MesaAccountTicketInput } from "./mesa-account-ticket"

// ============================================
// DeliGO — Tests permanentes: modelo de ticket térmico (P3-A, grupo A)
// ============================================
// Puros: sin DB, sin red, sin React, sin DOM — se ejecutan con `bun test`
// directamente, sin infraestructura adicional. Usan la MISMA función real
// `buildCuentaMesa` (P2, ya probada por su propia suite histórica) para
// construir la entrada, de modo que estos tests verifiquen la integración
// real entre la cuenta y el modelo térmico, no una versión simplificada.

function pedidoBase(overrides: Partial<CuentaPedidoInput> = {}): CuentaPedidoInput {
  return {
    id: "pedido-1",
    estado: "entregado",
    fecha: "2026-08-05T18:30:00.000Z",
    total: 1000,
    items: [
      {
        id: "item-1",
        nombre: "Hamburguesa",
        precio: 1000,
        cantidad: 1,
        agregados: "[]",
        secciones: "{}",
        ingredientesQuitados: "[]",
        talle: "",
        color: "",
      },
    ],
    ...overrides,
  }
}

function inputFrom(pedidos: CuentaPedidoInput[], ocupacionOverrides: Partial<MesaAccountTicketInput["ocupacion"]> = {}): MesaAccountTicketInput {
  return {
    negocio: { nombre: "Restaurante Demo" },
    mesa: { numero: 7 },
    ocupacion: {
      iniciadaEn: "2026-08-05T18:00:00.000Z",
      cerradaEn: null,
      estado: "activa",
      ...ocupacionOverrides,
    },
    cuenta: buildCuentaMesa(pedidos),
  }
}

describe("P3-A — buildMesaAccountThermalTicket (grupo A: modelo)", () => {
  test("1. Cuenta activa -> leyenda 'vista_previa' y estado 'activa'", () => {
    const ticket = buildMesaAccountThermalTicket(inputFrom([pedidoBase()], { estado: "activa" }))
    expect(ticket.leyenda).toBe("vista_previa")
    expect(ticket.ocupacion.estado).toBe("activa")
  })

  test("2. Cuenta cerrada -> leyenda 'cuenta_cerrada' y conserva cerradaEn", () => {
    const ticket = buildMesaAccountThermalTicket(
      inputFrom([pedidoBase()], { estado: "cerrada", cerradaEn: "2026-08-05T19:00:00.000Z" })
    )
    expect(ticket.leyenda).toBe("cuenta_cerrada")
    expect(ticket.ocupacion.estado).toBe("cerrada")
    expect(ticket.ocupacion.cerradaEn).toBe("2026-08-05T19:00:00.000Z")
  })

  test("3. Cuenta sin pedidos -> arreglo vacío, total 0, nunca null/undefined", () => {
    const ticket = buildMesaAccountThermalTicket(inputFrom([]))
    expect(ticket.pedidos).toEqual([])
    expect(ticket.totalGeneral).toBe(0)
  })

  test("4. Pedido entregado -> no cancelado, no pendiente, suma en subtotal real", () => {
    const ticket = buildMesaAccountThermalTicket(inputFrom([pedidoBase({ estado: "entregado", total: 1500 })]))
    const [pedido] = ticket.pedidos
    expect(pedido.cancelado).toBe(false)
    expect(pedido.pendiente).toBe(false)
    expect(pedido.subtotal).toBe(1500)
    expect(ticket.totalGeneral).toBe(1500)
  })

  test("5. Pedido pendiente (recibido) -> figura como pendiente, no como entregado", () => {
    const ticket = buildMesaAccountThermalTicket(inputFrom([pedidoBase({ estado: "recibido", total: 800 })]))
    const [pedido] = ticket.pedidos
    expect(pedido.pendiente).toBe(true)
    expect(pedido.cancelado).toBe(false)
    // Un pendiente nunca suma al total general (mismo criterio de P2).
    expect(ticket.totalGeneral).toBe(0)
  })

  test("6. Pedido cancelado -> subtotal 0 en el ticket (mismo criterio que MesaCuentaDialog), total general sin ese monto", () => {
    const ticket = buildMesaAccountThermalTicket(inputFrom([pedidoBase({ estado: "cancelado", total: 2000 })]))
    const [pedido] = ticket.pedidos
    expect(pedido.cancelado).toBe(true)
    expect(pedido.subtotal).toBe(0)
    expect(ticket.totalGeneral).toBe(0)
  })

  test("7. Personalizaciones completas se conservan (agregados, secciones, ingredientes quitados, talle, color)", () => {
    const ticket = buildMesaAccountThermalTicket(
      inputFrom([
        pedidoBase({
          items: [
            {
              id: "item-1",
              nombre: "Pizza",
              precio: 3000,
              cantidad: 1,
              agregados: JSON.stringify([{ nombre: "Extra queso", precio: 300 }]),
              secciones: JSON.stringify({ Masa: "Fina" }),
              ingredientesQuitados: JSON.stringify(["aceitunas"]),
              talle: "M",
              color: "Rojo",
            },
          ],
        }),
      ])
    )
    const [item] = ticket.pedidos[0].items
    expect(item.agregados).toEqual(["Extra queso"])
    expect(item.secciones).toEqual(["Masa: Fina"])
    expect(item.ingredientesQuitados).toEqual(["aceitunas"])
    expect(item.talle).toBe("M")
    expect(item.color).toBe("Rojo")
  })

  test("8. Valores opcionales ausentes -> nunca undefined como texto visible", () => {
    const ticket = buildMesaAccountThermalTicket(
      inputFrom([
        pedidoBase({
          items: [
            {
              id: "item-1",
              nombre: "",
              precio: 500,
              cantidad: 1,
              agregados: null,
              secciones: null,
              ingredientesQuitados: null,
              talle: "",
              color: "",
            },
          ],
        }),
      ])
    )
    const [item] = ticket.pedidos[0].items
    expect(item.nombre).toBe("Producto")
    expect(item.nombre.includes("undefined")).toBe(false)
    expect(item.agregados).toEqual([])
    expect(item.secciones).toEqual([])
    expect(item.ingredientesQuitados).toEqual([])
  })

  test("9. Talle sin color -> color queda como cadena vacía, nunca 'undefined'", () => {
    const ticket = buildMesaAccountThermalTicket(
      inputFrom([
        pedidoBase({
          items: [
            { id: "i1", nombre: "Remera", precio: 100, cantidad: 1, agregados: "[]", secciones: "{}", ingredientesQuitados: "[]", talle: "L", color: "" },
          ],
        }),
      ])
    )
    const [item] = ticket.pedidos[0].items
    expect(item.talle).toBe("L")
    expect(item.color).toBe("")
  })

  test("10. Color sin talle -> talle queda como cadena vacía, nunca 'undefined'", () => {
    const ticket = buildMesaAccountThermalTicket(
      inputFrom([
        pedidoBase({
          items: [
            { id: "i1", nombre: "Remera", precio: 100, cantidad: 1, agregados: "[]", secciones: "{}", ingredientesQuitados: "[]", talle: "", color: "Azul" },
          ],
        }),
      ])
    )
    const [item] = ticket.pedidos[0].items
    expect(item.talle).toBe("")
    expect(item.color).toBe("Azul")
  })

  test("11. Ingredientes quitados vacíos -> arreglo vacío, nunca undefined", () => {
    const ticket = buildMesaAccountThermalTicket(
      inputFrom([
        pedidoBase({
          items: [
            { id: "i1", nombre: "Hamburguesa", precio: 100, cantidad: 1, agregados: "[]", secciones: "{}", ingredientesQuitados: "[]", talle: "", color: "" },
          ],
        }),
      ])
    )
    expect(ticket.pedidos[0].items[0].ingredientesQuitados).toEqual([])
  })

  test("12. Agregados vacíos -> arreglo vacío, nunca undefined; correlativo de pedido es 1-based, no el id real", () => {
    const ticket = buildMesaAccountThermalTicket(
      inputFrom([
        pedidoBase({ id: "id-real-oculto-1" }),
        pedidoBase({ id: "id-real-oculto-2", estado: "cancelado" }),
      ])
    )
    expect(ticket.pedidos[0].items[0].agregados).toEqual([])
    expect(ticket.pedidos[0].numero).toBe(1)
    expect(ticket.pedidos[1].numero).toBe(2)
    // Nunca se expone el id real del pedido en el modelo térmico.
    expect(JSON.stringify(ticket)).not.toContain("id-real-oculto")
  })
})
