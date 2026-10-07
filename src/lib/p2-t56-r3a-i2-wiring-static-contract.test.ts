// ============================================
// P2-T56-R3A-I2 — contrato estático de wiring de los 14 sitios del lifecycle
// ============================================
// ORDER_CREATION_WIRING=2/2 · PREPARANDO_WIRING=6/6 · CANCELLATION_WIRING=6/6.
// Además de las afirmaciones positivas, cada grupo tiene un detector de BYPASS
// sobre TODO src/ productivo: falla si aparece un creador de Pedido, un escritor
// de `preparando` o un cancelador que no pase por la autoridad compartida
// (src/lib/stock-lifecycle.ts).
import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "fs"
import { join } from "path"

const ROOT = process.cwd()
const read = (path: string) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n")
const AUTHORITY = "src/lib/stock-lifecycle.ts"

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) && !/-test-fake\.ts$/.test(name)) out.push(rel)
  }
  return out
}
const productive = walk("src").map((path) => ({ path, src: read(path) }))

/** Texto de cada llamada `pedido.<method>(...)` con paréntesis balanceados. */
function calls(src: string, method: string): string[] {
  const out: string[] = []
  const needle = `pedido.${method}(`
  let from = 0
  for (;;) {
    const start = src.indexOf(needle, from)
    if (start < 0) return out
    let depth = 0
    let end = start + needle.length - 1
    for (; end < src.length; end++) {
      if (src[end] === "(") depth++
      else if (src[end] === ")") {
        depth--
        if (depth === 0) break
      }
    }
    out.push(src.slice(start, end + 1))
    from = end + 1
  }
}

const CREATORS = ["src/app/api/pedidos/route.ts", "src/app/api/operativo/mozo/panel/[slug]/pedidos/route.ts"]
const PREPARANDO_WRITERS = [
  "src/app/api/negocio/pedidos/route.ts",
  "src/app/api/negocio/pedidos/[id]/estado/route.ts",
  "src/app/api/operaciones/pyr/pedidos/[id]/estado/route.ts",
  "src/app/api/operaciones/salon/pedidos/[id]/estado/route.ts",
  "src/app/api/operativo/pyr/pedidos/[id]/preparar/route.ts",
  "src/app/api/operativo/salon/pedidos/[id]/preparar/route.ts",
]
const CANCELLATION_SITES = [
  "src/app/api/cliente/pedidos/[id]/route.ts",
  "src/app/api/negocio/pedidos/[id]/estado/route.ts",
  "src/app/api/negocio/pedidos/route.ts",
  "src/app/api/operaciones/pyr/pedidos/[id]/estado/route.ts",
  "src/app/api/repartidor/pedidos/auto-cancel/route.ts",
  "src/lib/mesa-pedido-cancelacion.ts",
]
const sorted = (xs: string[]) => [...xs].sort()

describe("ORDER_CREATION_WIRING=2/2", () => {
  test("los únicos creadores productivos de Pedido son los 2 entrypoints conocidos", () => {
    const creators = productive.filter(({ src }) => calls(src, "create").length > 0).map(({ path }) => path)
    expect(sorted(creators)).toEqual(sorted(CREATORS))
  })

  for (const path of CREATORS) {
    test(`${path}: gate de rubro + plan + reserva con PedidoItem.id pre-generado, en transacción Serializable`, () => {
      const src = read(path)
      expect(src).toMatch(/isGenericBusinessStockScope\([^)]*rubro\)/)
      expect(src).toContain("planificarReservaStockPedido(tx,")
      expect(src).toContain("reservarStockPedido(tx,")
      expect(src).toContain("runStockSerializable(")
      expect(src).toContain("id: randomUUID(),")
      expect(src).toMatch(/create: validatedItems\.map\(\(item\) => \(\{\s*id: item\.id,/)
      expect(src).toContain("mapStockLifecycleError(error)")
    })
  }

  // I2-F1: una lectura de modo fuera de la tx (OFF) elegía el runner legacy y
  // podía confirmar un pedido sin reserva después de una activación OFF→ON.
  test("I2-F1 GENERIC_CONTROLLED_ALWAYS_SERIALIZABLE: el runner de POST /api/pedidos depende sólo de rubro + líneas controladas, nunca del modo", () => {
    const src = read(CREATORS[0])
    expect(src).toMatch(
      /const useStockTransaction =\s*isGenericBusinessStockScope\(negocio\.rubro\) && stockLines\.some\(\(line\) => line\.controlStock\)\n/
    )
    expect(src).toMatch(/useStockTransaction\s*\?\s*runStockSerializable\(db, createPedidoInTx\)\s*:\s*db\.\$transaction\(createPedidoInTx\)/)
    // F1-D: ninguna rama `modo OFF → db.$transaction` ni comparación de modo en el route.
    expect(src).not.toMatch(/!==\s*"OFF"|===\s*"OFF"/)
    expect(src).not.toContain("readStockReservationMode")
    expect(src).not.toContain("stockReservaModo")
    expect(src).not.toContain("configPlataforma")
  })

  test("I2-F1 MODE_READ_INSIDE_STOCK_TX: la única lectura productiva del modo es readStockReservationMode(tx) dentro de planificarReservaStockPedido", () => {
    const readers = productive
      .filter(({ src }) => /readStockReservationMode\(/.test(src.replace(/export async function readStockReservationMode\(/, "")))
      .map(({ path }) => path)
    expect(readers).toEqual([AUTHORITY])
    const authority = read(AUTHORITY)
    const calls = authority.match(/readStockReservationMode\([^)]*\)/g) ?? []
    expect(calls).toEqual(["readStockReservationMode(reader: ConfigReader)", "readStockReservationMode(tx)"])
    const planner = authority.slice(authority.indexOf("export async function planificarReservaStockPedido("))
    expect(planner.indexOf("readStockReservationMode(tx)")).toBeGreaterThan(-1)
    expect(planner.indexOf("readStockReservationMode(tx)")).toBeLessThan(planner.indexOf("\n}\n"))
    // Ambos creadores planifican con el `tx` de su transacción Serializable.
    for (const path of CREATORS) {
      expect(read(path)).toMatch(/await planificarReservaStockPedido\(tx, \{/)
    }
  })

  test("Mozo: el retry Serializable local fue reemplazado por la autoridad compartida", () => {
    const src = read(CREATORS[1])
    expect(src).not.toContain("withSerializableRetry")
    expect(src).not.toContain("SERIALIZATION_RETRY_LIMIT")
  })
})

describe("PREPARANDO_WIRING=6/6", () => {
  test("exactamente los 6 escritores conocidos llaman a transicionarAPreparandoConStock", () => {
    const users = productive
      .filter(({ path, src }) => path !== AUTHORITY && src.includes("transicionarAPreparandoConStock(tx,"))
      .map(({ path }) => path)
    expect(sorted(users)).toEqual(sorted(PREPARANDO_WRITERS))
  })

  for (const path of PREPARANDO_WRITERS) {
    test(`${path}: → preparando corre dentro de runStockSerializable y traduce los errores de stock`, () => {
      const src = read(path)
      expect(src).toMatch(/runStockSerializable\(db, \(tx\) =>\s*transicionarAPreparandoConStock\(tx, \{/)
      expect(src).toContain('data: { estado: "preparando" }')
      expect(src).toContain("mapStockLifecycleError(error)")
    })
  }

  test("BYPASS: ningún pedido.updateMany productivo escribe estado \"preparando\" fuera de la autoridad", () => {
    const bypass = productive.filter(({ path, src }) =>
      path !== AUTHORITY && calls(src, "updateMany").some((call) => /data:\s*\{[^}]*estado:\s*"preparando"/.test(call))
    )
    expect(bypass.map(({ path }) => path)).toEqual([])
  })

  test("los escritores genéricos ramifican `preparando` hacia la autoridad antes del CAS plano", () => {
    for (const path of PREPARANDO_WRITERS.slice(0, 4)) {
      const src = read(path)
      const branch = src.indexOf('if (estado === "preparando")')
      expect(branch).toBeGreaterThan(-1)
      expect(src.indexOf("transicionarAPreparandoConStock(tx,", branch)).toBeGreaterThan(branch)
    }
  })
})

describe("CANCELLATION_WIRING=6/6", () => {
  test("exactamente los 6 sitios conocidos usan aplicarEfectosCancelacion", () => {
    const users = productive
      .filter(({ path, src }) => path !== AUTHORITY && src.includes("aplicarEfectosCancelacion(tx,"))
      .map(({ path }) => path)
    expect(sorted(users)).toEqual(sorted(CANCELLATION_SITES))
  })

  test("BYPASS: revertirTarifaSiCorresponde sólo se invoca desde la autoridad compartida (deuda y liberación nunca se separan)", () => {
    const direct = productive
      .filter(({ path, src }) => path !== AUTHORITY && path !== "src/lib/pedido-cancelacion-financiera.ts" && src.includes("revertirTarifaSiCorresponde("))
      .map(({ path }) => path)
    expect(direct).toEqual([])
  })

  test("BYPASS: todo archivo productivo que escribe una cancelación (canceladoFecha) pasa por la autoridad", () => {
    // Escritura real = canceladoFecha dentro de una llamada pedido.updateMany/update,
    // o asignado al payload de update (`updateData.canceladoFecha =` / `data.canceladoFecha =`).
    // Excluye tipos, DTOs de lectura y selects.
    const writers = productive
      .filter(({ src }) =>
        [...calls(src, "updateMany"), ...calls(src, "update")].some((call) => /canceladoFecha\s*:/.test(call)) ||
        /\b(updateData|data)\.canceladoFecha\s*=/.test(src)
      )
      .map(({ path }) => path)
    expect(writers.length).toBeGreaterThanOrEqual(CANCELLATION_SITES.length)
    const missing = writers.filter((path) => path !== AUTHORITY && !CANCELLATION_SITES.includes(path))
    expect(missing).toEqual([])
  })

  test("motivos por actor", () => {
    expect(read("src/app/api/cliente/pedidos/[id]/route.ts")).toContain('motivo: "CANCELADO_CLIENTE"')
    expect(read("src/app/api/repartidor/pedidos/auto-cancel/route.ts")).toContain('motivo: "CANCELADO_SISTEMA"')
    expect(read("src/lib/mesa-pedido-cancelacion.ts")).toContain('motivo: "CANCELADO_MESA"')
    for (const path of ["src/app/api/negocio/pedidos/[id]/estado/route.ts", "src/app/api/negocio/pedidos/route.ts", "src/app/api/operaciones/pyr/pedidos/[id]/estado/route.ts"]) {
      expect(read(path)).toContain('motivo: "CANCELADO_VENDEDOR"')
    }
  })
})

// I2-F2: la verificación real-DB en TESTING mostró transacciones de stock que
// excedían el timeout interactivo default de Prisma (5000 ms). La política es
// explícita y vive sólo en runStockSerializable.
describe("I2-F2 — política de timeout de la transacción de stock: explícita y única", () => {
  test("STOCK_SERIALIZABLE_TIMEOUT_EXPLICIT / MAX_WAIT_EXPLICIT: runStockSerializable pasa maxWait y timeout con constantes de la autoridad", () => {
    const authority = read(AUTHORITY)
    expect(authority).toMatch(/export const STOCK_SERIALIZABLE_MAX_WAIT_MS = \d[\d_]*\n/)
    expect(authority).toMatch(/export const STOCK_SERIALIZABLE_TIMEOUT_MS = \d[\d_]*\n/)
    const fn = authority.slice(authority.indexOf("export async function runStockSerializable<T>("))
    const body = fn.slice(0, fn.indexOf("\n}\n"))
    expect(body).toContain("isolationLevel: Prisma.TransactionIsolationLevel.Serializable,")
    expect(body).toContain("maxWait: STOCK_SERIALIZABLE_MAX_WAIT_MS,")
    expect(body).toContain("timeout: STOCK_SERIALIZABLE_TIMEOUT_MS,")
    // Sin parámetro de opciones: ningún caller puede pisar la política.
    expect(body).toMatch(/fn: \(tx: Tx\) => Promise<T>\n\): Promise<T>/)
    expect(body).not.toContain("...options")
    expect(authority).not.toContain("StockSerializableOptions")
  })

  test("los callers de runStockSerializable no pasan maxWait/timeout propios", () => {
    const callers = productive.filter(({ path, src }) => path !== AUTHORITY && src.includes("runStockSerializable("))
    expect(callers.length).toBe(8)
    for (const { path, src } of callers) {
      let from = 0
      for (;;) {
        const start = src.indexOf("runStockSerializable(", from)
        if (start < 0) break
        let depth = 0
        let end = start + "runStockSerializable(".length - 1
        for (; end < src.length; end++) {
          if (src[end] === "(") depth++
          else if (src[end] === ")") {
            depth--
            if (depth === 0) break
          }
        }
        const call = src.slice(start, end + 1)
        expect({ path, maxWait: /\bmaxWait\s*:/.test(call), timeout: /\btimeout\s*:/.test(call) }).toEqual({ path, maxWait: false, timeout: false })
        from = end + 1
      }
    }
  })
})

// I2-F3: de las 6 cancelaciones, sólo la transacción Serializable de mesa
// expiró con los defaults en la verificación real-DB; es la única que recibe la
// política explícita (las mismas constantes de la autoridad, sin runStockSerializable
// ni retry nuevo).
describe("I2-F3 — política de timeout de las transacciones de cancelación (allowlist)", () => {
  const MESA = "src/lib/mesa-pedido-cancelacion.ts"
  const POLICY_ALLOWLIST = [AUTHORITY, MESA]

  test("CANCELLATION_TIMEOUT_POLICY_CONTRACT: mesa conserva Serializable y pasa las constantes de la autoridad", () => {
    const src = read(MESA)
    expect(src).toMatch(
      /\{\n\s+isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable,\n\s+maxWait: STOCK_SERIALIZABLE_MAX_WAIT_MS,\n\s+timeout: STOCK_SERIALIZABLE_TIMEOUT_MS,\n\s+\}/
    )
    expect(src).not.toContain("runStockSerializable(")
    expect(src).not.toMatch(/maxWait:\s*\d|timeout:\s*\d/)
  })

  test("las constantes de la política sólo se usan en la autoridad y en mesa", () => {
    const users = productive
      .filter(({ src }) => /STOCK_SERIALIZABLE_(MAX_WAIT|TIMEOUT)_MS/.test(src))
      .map(({ path }) => path)
    expect(sorted(users)).toEqual(sorted(POLICY_ALLOWLIST))
  })

  test("las otras 5 cancelaciones no tienen timeouts propios (sin cambios en F3) y siguen sin isolation explícita", () => {
    for (const path of CANCELLATION_SITES.filter((p) => p !== MESA)) {
      const src = read(path)
      expect({ path, maxWait: /\bmaxWait\s*:/.test(src), timeout: /\btimeout\s*:/.test(src) }).toEqual({ path, maxWait: false, timeout: false })
    }
  })
})

describe("guard de producto, PEDIDO system-only y modo OFF intacto", () => {
  test("DELETE producto consulta reservas ACTIVA antes del hard delete", () => {
    const src = read("src/app/api/negocio/productos/[id]/route.ts")
    const guard = src.indexOf("contarReservasActivasProducto(db,")
    expect(guard).toBeGreaterThan(-1)
    expect(src.indexOf("await db.producto.delete(", guard)).toBeGreaterThan(guard)
    expect(src).toContain('code: "PRODUCT_HAS_ACTIVE_RESERVATIONS"')
  })

  test("el endpoint manual de movimientos sigue rechazando todo tipo fuera de la lista manual (PEDIDO incluido)", () => {
    expect(read("src/app/api/negocio/inventario/movimientos/route.ts")).toContain('tipo === "VENTA" || !isValidMovimientoTipo(tipo)')
  })

  test("ningún archivo productivo escribe ConfigPlataforma.stockReservaModo (I2 no activa ON/DRAINING)", () => {
    const writers = productive.filter(({ src }) => /stockReservaModo\s*:\s*["']/.test(src)).map(({ path }) => path)
    expect(writers).toEqual([])
  })

  test("los routes nunca acceden a ReservaStock directamente: sólo la autoridad", () => {
    const direct = productive.filter(({ path, src }) => path !== AUTHORITY && /\.reservaStock\./.test(src)).map(({ path }) => path)
    expect(direct).toEqual([])
  })
})
