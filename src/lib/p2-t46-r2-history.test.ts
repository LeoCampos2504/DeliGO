/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { buildMesaHistorialAccounts, type MesaHistorialPedidoInput } from "./mesa-historial"
import { buildMesaAccountThermalTicket } from "./thermal-print/mesa-account-ticket"

const occupation = (id: string, payment: "efectivo" | "transferencia") => ({
  id,
  mesaId: "mesa-21",
  mesaNumero: 21,
  estado: "cerrada",
  iniciadaEn: "2026-09-10T18:00:00.000Z",
  cerradaEn: "2026-09-10T20:00:00.000Z",
  metodoPago: payment,
  pagoConfirmadoEn: "2026-09-10T20:00:00.000Z",
})
function pedido(overrides: Partial<MesaHistorialPedidoInput> = {}): MesaHistorialPedidoInput {
  return {
    id: "pedido-a1",
    mesaNumero: 21,
    clienteNombre: "Cliente de fixture",
    empleadoNombre: null,
    ocupacionMesaId: "ocupacion-a",
    ocupacionMesa: occupation("ocupacion-a", "transferencia"),
    estado: "entregado",
    fecha: "2026-09-10T18:30:00.000Z",
    total: 2500,
    notas: null,
    items: [
      {
        id: "item-a1",
        nombre: "Hamburguesa",
        cantidad: 1,
        precio: 1500,
        agregados: "[]",
        secciones: "{}",
        ingredientesQuitados: "[]",
        talle: "",
        color: "",
      },
      {
        id: "item-a2",
        nombre: "Gaseosa",
        cantidad: 2,
        precio: 500,
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

describe("P2-T46-R2 — historial de cuentas y ticket", () => {
  test("agrupa dos pedidos vinculados en una cuenta y conserva items/notas", () => {
    const accounts = buildMesaHistorialAccounts([
      pedido(),
      pedido({
        id: "pedido-a2",
        fecha: "2026-09-10T19:00:00.000Z",
        total: 1800,
        notas: "Sin hielo",
        items: [
          {
            id: "item-a3",
            nombre: "Pizza grande",
            cantidad: 1,
            precio: 1800,
            agregados: "[]",
            secciones: "{}",
            ingredientesQuitados: "[]",
            talle: "",
            color: "",
          },
        ],
      }),
    ])

    expect(accounts).toHaveLength(1)
    expect(accounts[0].pedidos).toHaveLength(2)
    expect(accounts[0].pedidos[0].items.map((item) => item.nombre)).toEqual(["Hamburguesa", "Gaseosa"])
    expect(accounts[0].pedidos[1].items[0].nombre).toBe("Pizza grande")
    expect(accounts[0].pedidos[1].notas).toBe("Sin hielo")
    expect(accounts[0].totalGeneral).toBe(4300)
    expect(accounts[0].metodoPago).toBe("transferencia")
  })

  test("separa ocupaciones de la misma mesa y conserva cada pago", () => {
    const accounts = buildMesaHistorialAccounts([
      pedido(),
      pedido({
        id: "pedido-b1",
        ocupacionMesaId: "ocupacion-b",
        ocupacionMesa: occupation("ocupacion-b", "efectivo"),
        total: 900,
      }),
    ])

    expect(accounts).toHaveLength(2)
    expect(accounts.find((account) => account.ocupacionId === "ocupacion-a")?.metodoPago).toBe("transferencia")
    expect(accounts.find((account) => account.ocupacionId === "ocupacion-b")?.metodoPago).toBe("efectivo")
  })

  test("legacy sin ocupacion no se agrupa por mesa", () => {
    const accounts = buildMesaHistorialAccounts([
      pedido({ id: "legacy-1", ocupacionMesaId: null, ocupacionMesa: null }),
      pedido({ id: "legacy-2", ocupacionMesaId: null, ocupacionMesa: null }),
    ])

    expect(accounts).toHaveLength(2)
    expect(accounts.every((account) => account.legacy && account.ocupacionId === null)).toBe(true)
  })

  test("el ticket usa los dos pedidos y el total/pago canónicos", () => {
    const account = buildMesaHistorialAccounts([pedido(), pedido({ id: "pedido-a2", total: 1800 })])[0]
    const ticket = buildMesaAccountThermalTicket({
      negocio: { nombre: "Negocio fixture" },
      mesa: { numero: account.mesaNumero! },
      ocupacion: {
        iniciadaEn: account.iniciadaEn!,
        cerradaEn: account.cerradaEn,
        estado: account.estadoOcupacion!,
      },
      cuenta: account,
    })

    expect(ticket.pedidos).toHaveLength(2)
    expect(ticket.totalGeneral).toBe(account.totalGeneral)
    expect(ticket.metodoPago).toBe("transferencia")
  })
})
