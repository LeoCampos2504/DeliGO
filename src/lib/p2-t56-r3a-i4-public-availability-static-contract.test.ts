// ============================================
// P2-T56-R3A-I4 — contrato estático de disponibilidad pública
// ============================================
// Fija el cableado aprobado por el operador:
//  1. Sólo POST /api/pedidos valida el disponible en OFF; Mozo conserva I2.
//  2. Las lecturas públicas (catálogo, promociones, repetir) pasan por la
//     autoridad transaccional (`@/lib/stock-lifecycle`), con UNA lectura
//     agrupada de reservas y gate de rubro genérico.
//  3. El stockCantidad del producto base no se publica.
//  4. El carrito nunca se muta en silencio: advierte, bloquea el checkout y
//     un 409 de stock no lo vacía. Revalidación al abrir, antes del checkout,
//     tras 409 y al volver a la pestaña.
//  5. La UI nunca muestra cantidades exactas de stock al cliente.
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = join(import.meta.dir, "..", "..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n")
// Sólo para routes .ts (page/cart-panel se leen crudos: contienen "/*" dentro de strings).
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")

const PEDIDOS = "src/app/api/pedidos/route.ts"
const MOZO = "src/app/api/operativo/mozo/panel/[slug]/pedidos/route.ts"
const PUBLIC_READERS = [
  "src/app/api/negocios/[slug]/route.ts",
  "src/app/api/cliente/promociones/route.ts",
  "src/app/api/negocios/promocionados/route.ts",
  "src/app/api/cliente/pedidos/[id]/repetir/route.ts",
]
const PAGE = "src/app/n/[slug]/page.tsx"
const CART = "src/components/cart/cart-panel.tsx"
const STORE = "src/store/cart-store.ts"

describe("I4 — validación OFF sólo en POST /api/pedidos", () => {
  test("POST /api/pedidos pasa validarDisponibleEnOff: true al planner", () => {
    const src = stripComments(read(PEDIDOS))
    expect(src).toMatch(/planificarReservaStockPedido\(tx, \{[^}]*validarDisponibleEnOff: true[^}]*\}\)/)
  })

  test("el replay idempotente sigue antes del planner dentro de la tx", () => {
    const src = stripComments(read(PEDIDOS))
    const replay = src.indexOf("idempotencyKey", src.indexOf("createPedidoInTx"))
    const planner = src.indexOf("planificarReservaStockPedido(tx")
    expect(replay).toBeGreaterThan(-1)
    expect(planner).toBeGreaterThan(replay)
  })

  test("Mozo NO pasa el flag (OFF de I2 intacto)", () => {
    expect(read(MOZO)).not.toContain("validarDisponibleEnOff")
  })
})

describe("I4 — lecturas públicas vía la autoridad transaccional", () => {
  for (const path of PUBLIC_READERS) {
    test(`${path}: importa de @/lib/stock-lifecycle (no de stock-authority), gate genérico y una lectura agrupada`, () => {
      const src = stripComments(read(path))
      expect(src).toContain('from "@/lib/stock-lifecycle"')
      expect(src).not.toMatch(/["']@\/lib\/stock-authority["']/)
      expect(src).toContain("isGenericBusinessStockScope(")
      expect(src.match(/await leerReservasActivasPorClave\(/g)).toHaveLength(1)
      expect(src).toContain("resolvePublicProductAvailability(")
      expect(src).not.toMatch(/\.reservaStock\b/)
    })
  }

  test("catálogo público: nunca publica el stockCantidad del producto base", () => {
    const src = stripComments(read("src/app/api/negocios/[slug]/route.ts"))
    expect(src).not.toMatch(/stockCantidad: product\.stockCantidad/)
    expect(src).toMatch(/stockDisponible: availability \? availability\.stockDisponible : null/)
  })
})

describe("I4 — carrito sin mutación silenciosa", () => {
  test("cart-store no conoce la disponibilidad (no recorta ni borra ítems por stock)", () => {
    const src = read(STORE)
    expect(src).not.toContain("cart-stock-availability")
    expect(src).not.toContain("stockDisponible")
  })

  test("cart-panel: advierte, bloquea Continuar y revalida al abrir y antes del checkout", () => {
    const src = read(CART)
    expect(src).toContain("<CartStockWarning issues={stockIssues} />")
    expect(src).toContain("disabled={items.length === 0 || hasStockIssues}")
    const open = src.slice(src.indexOf("const handleOpenChange"), src.indexOf("const handleCheckout"))
    expect(open).toContain("onRefreshAvailability?.()")
    const checkout = src.slice(src.indexOf("const handleCheckout"))
    expect(checkout.indexOf("onRefreshAvailability()")).toBeGreaterThan(-1)
    expect(checkout.indexOf("onRefreshAvailability()")).toBeLessThan(checkout.indexOf('fetch("/api/pedidos"'))
  })

  test("cart-panel: un 409 STOCK_INSUFFICIENT refresca y vuelve a la lista sin vaciar el carrito", () => {
    const src = read(CART)
    expect(src).toMatch(/res\.status === 409 && data\.code === "STOCK_INSUFFICIENT"/)
    const branch = src.slice(src.indexOf("err instanceof CartStockConflictError"), src.indexOf("err instanceof MesaOccupancyBlockedError"))
    expect(branch).toContain("onRefreshAvailability?.()")
    expect(branch).toContain('setStep("items")')
    expect(branch).not.toContain("clearCart")
    expect(branch).not.toContain("removeItem")
  })

  test("página: guarda por clave de stock al agregar, tope en el detalle y refetch al volver a la pestaña", () => {
    const src = read(PAGE)
    expect(src).toMatch(/const handleAddToCart = \(item: CartItem\): boolean =>/)
    expect(src).toContain("puedeAgregarAlCarrito(buildCatalogAvailability(negocio), cartItems, item)")
    expect(src).toContain("unidadesAgregables(buildCatalogAvailability(negocio), cartItems, product.id")
    expect(src).toContain('refetchOnWindowFocus: "always"')
    expect(src).toContain("if (added) setDetailOpen(false)")
  })
})

describe("I4 — sin cantidades exactas de stock en la UI del cliente", () => {
  for (const path of [PAGE, CART]) {
    test(`${path}: nunca renderiza stockDisponible / stockCantidad como texto`, () => {
      const src = read(path)
      expect(src).not.toMatch(/\{[^{}]*\b(stockDisponible|stockCantidad|unidadesRestantes)\b[^{}]*\}\s*<\//)
      // `(?<!=)` excluye cuerpos de arrow function (`=> {`), que no son texto JSX.
      expect(src).not.toMatch(/(?<!=)>\s*\{[^{}]*\b(stockDisponible|stockCantidad|unidadesRestantes)\b/)
    })
  }
})

describe("I4 — variantes del cliente", () => {
  test("isVarianteDisponible prefiere el stockDisponible publicado", () => {
    const src = stripComments(read("src/lib/client-product-variants.ts"))
    expect(src).toMatch(/if \(typeof variante\.stockDisponible === "number"\) return variante\.stockDisponible > 0/)
  })
})
