// P2-T45-R1: cobertura mínima de la única lógica separable y testeable sin
// montar el componente — la derivación pura del conteo de "nuevos" que
// alimenta el badge de resumen y el dot pulsante por fila. No se agrega
// harness de efectos/React: el timer de polling replica mecánicamente el
// patrón ya en producción de src/app/operaciones/salon/page.tsx (mismo
// REFRESH_MS, misma guarda de visibilidad, mismo cleanup) y se revisa por
// lectura de código, no por un test nuevo.
import { describe, expect, test } from "bun:test"
import fs from "fs"
import path from "path"
import { countPedidosRecibidos, getMessageIndicator } from "./page"

const PAGE_SOURCE = fs.readFileSync(path.join(__dirname, "page.tsx"), "utf8")

describe("P2-T45-R1 — countPedidosRecibidos", () => {
  test("[] => 0", () => {
    expect(countPedidosRecibidos([])).toBe(0)
  })

  test("[recibido] => 1", () => {
    expect(countPedidosRecibidos([{ estado: "recibido" }])).toBe(1)
  })

  test("[recibido, recibido] => 2", () => {
    expect(countPedidosRecibidos([{ estado: "recibido" }, { estado: "recibido" }])).toBe(2)
  })

  test("[aceptado, preparando] => 0", () => {
    expect(countPedidosRecibidos([{ estado: "aceptado" }, { estado: "preparando" }])).toBe(0)
  })

  test("[recibido, aceptado, cancelado] => 1", () => {
    expect(
      countPedidosRecibidos([{ estado: "recibido" }, { estado: "aceptado" }, { estado: "cancelado" }])
    ).toBe(1)
  })
})

// P2-T49-R1D: derivación pura del indicador de mensajes por pedido —
// concepto distinto de countPedidosRecibidos de arriba (T45, "pedido
// nuevo"). No decide permisos ni marca nada como leído — sólo traduce el
// tieneMensajes/mensajesNoLeidos que el panel ya entrega (gateado
// server-side por pyr.mensajes.ver) a qué mostrar.
describe("P2-T49-R1D — getMessageIndicator", () => {
  test("tieneMensajes=false, mensajesNoLeidos=0 => none", () => {
    expect(getMessageIndicator({ tieneMensajes: false, mensajesNoLeidos: 0 })).toEqual({ kind: "none", count: 0 })
  })

  test("tieneMensajes=true, mensajesNoLeidos=0 => read", () => {
    expect(getMessageIndicator({ tieneMensajes: true, mensajesNoLeidos: 0 })).toEqual({ kind: "read", count: 0 })
  })

  test("tieneMensajes=true, mensajesNoLeidos=1 => unread_one", () => {
    expect(getMessageIndicator({ tieneMensajes: true, mensajesNoLeidos: 1 })).toEqual({ kind: "unread_one", count: 1 })
  })

  test("tieneMensajes=true, mensajesNoLeidos=5 => unread_many", () => {
    expect(getMessageIndicator({ tieneMensajes: true, mensajesNoLeidos: 5 })).toEqual({ kind: "unread_many", count: 5 })
  })

  test("tieneMensajes=false pero mensajesNoLeidos>0 (dato inconsistente) => none, nunca revela nada sin presencia", () => {
    expect(getMessageIndicator({ tieneMensajes: false, mensajesNoLeidos: 3 })).toEqual({ kind: "none", count: 0 })
  })
})

describe("P2-T49-R1D — contrato estático: la card de pedido renderiza el indicador", () => {
  test("PedidoRow usa getMessageIndicator y renderiza el copy de mensajes/no leídos", () => {
    expect(PAGE_SOURCE).toContain("const messageIndicator = getMessageIndicator(pedido)")
    expect(PAGE_SOURCE).toContain('"1 mensaje nuevo"')
    expect(PAGE_SOURCE).toContain("mensajes nuevos")
    expect(PAGE_SOURCE).toContain("Mensajes")
  })

  test("el badge no introduce un botón anidado ni stopPropagation — permanece dentro del click existente de la card", () => {
    expect(PAGE_SOURCE).not.toContain("stopPropagation")
    // El badge vive dentro del <button onClick={onClick}> de PedidoRow, no
    // agrega ningún <button> ni <Link> propio.
    const rowMatch = PAGE_SOURCE.match(/function PedidoRow\([\s\S]*?\n\}/)
    expect(rowMatch).not.toBeNull()
    const rowBody = rowMatch![0]
    expect((rowBody.match(/<button/g) ?? []).length).toBe(1)
  })

  test("el panel no agrega un timer nuevo — sigue usando el único REFRESH_MS de T45", () => {
    const matches = PAGE_SOURCE.match(/setInterval/g) ?? []
    expect(matches.length).toBe(1)
  })
})
