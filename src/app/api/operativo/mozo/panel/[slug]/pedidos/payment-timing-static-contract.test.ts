// P2-T46-R2: contrato estático complementario al test comportamental de
// route.test.ts — confirma por lectura de fuente que ningún rastro de
// la validación/uso de metodoPago sobrevive en este endpoint de pedido
// de mesa, y que `Pedido.create` no fija esa columna explícitamente
// (la deja en su default de schema, nunca como autoridad).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const source = readFileSync(
  join(process.cwd(), "src/app/api/operativo/mozo/panel/[slug]/pedidos/route.ts"),
  "utf8"
)

describe("P2-T46-R2 — backend: metodoPago ya no es autoridad para pedidos de mesa", () => {
  test("no existe la validación 400 'Metodo de pago invalido'", () => {
    expect(source).not.toContain("Metodo de pago invalido")
    expect(source).not.toContain('body.metodoPago !== "transferencia"')
  })

  test("no existe el error METODO_PAGO_INVALIDO (ni throw ni catch)", () => {
    expect(source).not.toContain("METODO_PAGO_INVALIDO")
  })

  test("createManualOrderFingerprint ya no incluye metodoPago en su forma/payload", () => {
    expect(source).not.toMatch(/createManualOrderFingerprint\(params: \{[^}]*metodoPago/)
    expect(source).not.toContain("metodoPago: params.metodoPago")
  })

  test("aceptaTransferencia ya no se selecciona ni se usa en este archivo", () => {
    expect(source).not.toContain("aceptaTransferencia")
  })

  test("Pedido.create no fija metodoPago explícitamente (queda en su default de schema)", () => {
    const createIdx = source.indexOf("const pedido = await tx.pedido.create({")
    expect(createIdx).toBeGreaterThan(-1)
    const itemsIdx = source.indexOf("items: {", createIdx)
    expect(itemsIdx).toBeGreaterThan(createIdx)
    const createBlock = source.slice(createIdx, itemsIdx)
    expect(createBlock).not.toMatch(/\bmetodoPago\s*,/)
    expect(createBlock).not.toMatch(/\bmetodoPago\s*:/)
  })

  test("metodoEntrega sigue hardcodeado a 'mesa' (este endpoint sólo crea pedidos de mesa)", () => {
    expect(source).toContain('metodoEntrega: "mesa"')
  })

  test("el GET del menú ya no expone aceptaTransferencia al frontend", () => {
    const getIdx = source.indexOf("export async function GET(")
    const postIdx = source.indexOf("export async function POST(")
    expect(getIdx).toBeGreaterThan(-1)
    expect(postIdx).toBeGreaterThan(getIdx)
    const getBlock = source.slice(getIdx, postIdx)
    expect(getBlock).not.toContain("aceptaTransferencia")
  })
})

describe("P2-T46-R2 — frontend: sin selector de pago en el flujo de pedido de mesa", () => {
  const pageSource = readFileSync(
    join(process.cwd(), "src/app/mozo/panel/[slug]/pedido/[mesaId]/page.tsx"),
    "utf8"
  )

  test("MOZO_MANUAL_TABLE_ORDER_PAYMENT_SELECTOR_ABSENT: no existe state metodoPago", () => {
    expect(pageSource).not.toContain("metodoPago")
    expect(pageSource).not.toContain("setMetodoPago")
  })

  test("no se renderizan los botones Efectivo/Transferencia", () => {
    expect(pageSource).not.toContain(">Efectivo<")
    expect(pageSource).not.toContain(">Transferencia<")
  })

  test("no queda ninguna dependencia visual de aceptaTransferencia", () => {
    expect(pageSource).not.toContain("aceptaTransferencia")
  })

  test("el body del POST manual ya no envía metodoPago", () => {
    const submitIdx = pageSource.indexOf("const submitOrder = async () => {")
    const fetchIdx = pageSource.indexOf("body: JSON.stringify({", submitIdx)
    const closeIdx = pageSource.indexOf("})", fetchIdx)
    expect(submitIdx).toBeGreaterThan(-1)
    const bodyBlock = pageSource.slice(fetchIdx, closeIdx)
    expect(bodyBlock).not.toMatch(/\bmetodoPago\b/)
  })

  test("Notas se preserva sin cambios", () => {
    expect(pageSource).toContain('placeholder="Aclaraciones de cocina"')
    expect(pageSource).toContain("notas,")
  })
})

describe("P2-T46-R2 — Operaciones personal sigue siendo el mismo componente (sin duplicar)", () => {
  test("el re-export de Operaciones apunta al mismo archivo ya corregido", () => {
    const reExportSource = readFileSync(
      join(process.cwd(), "src/app/operaciones/mi-panel/[slug]/pedido/[mesaId]/page.tsx"),
      "utf8"
    )
    expect(reExportSource).toContain('export { default } from "@/app/mozo/panel/[slug]/pedido/[mesaId]/page"')
  })
})
