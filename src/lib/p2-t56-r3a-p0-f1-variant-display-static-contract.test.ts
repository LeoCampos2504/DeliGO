// ============================================
// P2-T56-R3A-P0-F1 — contrato estático: la variante del PedidoItem se ve en
// Operaciones, Negocio/Salón y el ticket
// ============================================
// Montar estas pantallas exigiría harnesses enormes (sesión operativa,
// polling, drawers, router de Next); se verifica por source, mismo criterio
// ya aceptado en page.test.ts / negocio-salon-static-contract.test.ts. La
// regla de display se prueba directamente en pedido-item-variante.test.ts y
// la cadena del ticket en thermal-print/mesa-account-ticket-variante.test.ts.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const HELPER_IMPORT = 'import { getPedidoItemVarianteNombre } from "@/lib/pedido-item-variante"'

describe("P2-T56-R3A-P0-F1 — los endpoints de detalle entregan el snapshot varianteNombre", () => {
  const endpoints = [
    "src/app/api/operaciones/ocupaciones/[id]/cuenta/route.ts",
    "src/app/api/operaciones/salon/panel/route.ts",
    "src/app/api/operaciones/salon/historial/route.ts",
    "src/app/api/operativo/salon/pedidos/[id]/detalle/route.ts",
    "src/app/api/operativo/mozo/pedidos/[id]/detalle/route.ts",
  ]
  for (const path of endpoints) {
    test(`${path} selecciona PedidoItem.varianteNombre`, () => {
      expect(read(path)).toMatch(/varianteNombre: true/)
    })
  }

  test("los endpoints que mapean items a mano propagan varianteNombre", () => {
    expect(read("src/app/api/operaciones/salon/panel/route.ts")).toContain("varianteNombre: item.varianteNombre,")
    expect(read("src/app/api/operaciones/salon/historial/route.ts")).toContain("varianteNombre: item.varianteNombre,")
    expect(read("src/app/api/operativo/salon/pedidos/[id]/detalle/route.ts")).toContain("varianteNombre: item.varianteNombre || null,")
    expect(read("src/app/api/operativo/mozo/pedidos/[id]/detalle/route.ts")).toContain("varianteNombre: item.varianteNombre || null,")
  })

  test("Negocio: GET /api/negocio/pedidos ya incluye todos los escalares de PedidoItem (include, no select)", () => {
    const src = read("src/app/api/negocio/pedidos/route.ts")
    expect(src).toMatch(/items: \{\s*include: \{\s*producto:/)
  })
})

describe("P2-T56-R3A-P0-F1 — F1-A Operaciones muestra la variante", () => {
  test("Cuenta de mesa (MesaCuentaDialog — Operaciones, Mozo y Negocio) muestra la variante bajo el producto", () => {
    const src = read("src/components/operativo/mesa-cuenta-dialog.tsx")
    expect(src).toContain(HELPER_IMPORT)
    expect(src).toContain("{getPedidoItemVarianteNombre(item) && (")
    expect(src).toContain("{item.cantidad}x {item.nombre}")
  })

  test("Terminal de Salón (operaciones/salon) muestra 'Producto · Variante'", () => {
    const src = read("src/app/operaciones/salon/page.tsx")
    expect(src).toContain(HELPER_IMPORT)
    expect(src).toContain("const varianteNombre = getPedidoItemVarianteNombre(item)")
    expect(src).toContain("{varianteNombre && <span className=\"font-medium text-foreground\"> · {varianteNombre}</span>}")
  })

  test("Detalle de pedido (PedidoDetalleDrawer — mi-panel Salón y panel Mozo) muestra 'Producto · Variante'", () => {
    const src = read("src/components/operativo/pedido-detalle.tsx")
    expect(src).toContain(HELPER_IMPORT)
    expect(src).toContain("varianteNombre?: string | null")
    expect(src).toContain("{varianteNombre && <span className=\"font-medium text-foreground\"> · {varianteNombre}</span>}")
  })
})

describe("P2-T56-R3A-P0-F1 — F1-B Negocio/Salón muestra la variante", () => {
  test("detalle de mesa del Salón de Negocio muestra 'Producto · Variante'", () => {
    const src = read("src/components/business/salon-tab.tsx")
    expect(src).toContain(HELPER_IMPORT)
    expect(src).toContain("const varianteNombre = getPedidoItemVarianteNombre(item)")
    expect(src).toContain("{varianteNombre && <span className=\"font-medium text-foreground\"> · {varianteNombre}</span>}")
  })

  test("historial (MesaAccountDetail, R2C-F2) sigue mostrando la variante", () => {
    expect(read("src/components/shared/mesa-account-detail.tsx")).toContain(
      "[item.varianteNombre, item.talle, item.color].filter(Boolean).join(\" · \")"
    )
  })
})

describe("P2-T56-R3A-P0-F1 — F1-C ticket", () => {
  test("vista previa del ticket muestra la variante en su propia línea", () => {
    expect(read("src/components/shared/mesa-account-ticket-dialog.tsx")).toContain(
      "{item.variante && <p className=\"pl-3 text-xs font-medium text-muted-foreground\">{item.variante}</p>}"
    )
  })

  test("modelo térmico y ESC/POS llevan la variante", () => {
    expect(read("src/lib/thermal-print/mesa-account-ticket.ts")).toContain("variante: getPedidoItemVarianteNombre(item) ?? \"\",")
    expect(read("src/lib/thermal-print/escpos.ts")).toContain("if (variante) personalizaciones.push(variante)")
  })
})

describe("P2-T56-R3A-P0-F1 — F1-E/F1-F: nunca se muta ni se reconstruye el nombre persistido", () => {
  const renderers = [
    "src/components/operativo/mesa-cuenta-dialog.tsx",
    "src/app/operaciones/salon/page.tsx",
    "src/components/operativo/pedido-detalle.tsx",
    "src/components/business/salon-tab.tsx",
  ]
  for (const path of renderers) {
    test(`${path}: no concatena la variante dentro de nombre ni consulta ProductoVariante`, () => {
      const src = read(path)
      expect(src).not.toMatch(/nombre:\s*`\$\{[^}]*nombre\}[^`]*\$\{[^}]*variante/i)
      expect(src).not.toContain("productoVariante.")
    })
  }

  test("los endpoints nunca escriben PedidoItem (sólo lectura del snapshot)", () => {
    for (const path of [
      "src/app/api/operaciones/salon/panel/route.ts",
      "src/app/api/operativo/salon/pedidos/[id]/detalle/route.ts",
      "src/app/api/operativo/mozo/pedidos/[id]/detalle/route.ts",
    ]) {
      expect(read(path)).not.toContain("pedidoItem.update")
    }
  })
})
