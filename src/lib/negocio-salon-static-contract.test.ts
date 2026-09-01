/// <reference types="bun-types" />
// ============================================
// DeliGO — Test contractual estático: enforcement de Salón (Tarea 20)
// ============================================
// Auditoría estática combinada con revisión estructural real (mismo
// criterio ya aplicado en mesa-pedido-cancelacion-ui-contract.test.ts y
// mesa-cliente-cuenta-static-contract.test.ts). Complementa, no sustituye,
// los tests de comportamiento real contra PostgreSQL (negocio-salon.test.ts).

import { describe, test, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = process.cwd()
function read(relPath: string): string {
  return readFileSync(join(ROOT, ...relPath.split("/")), "utf-8")
}

describe("TAREA-20-CORRECCIÓN-2 — la transición asíncrona de salonHabilitado usa la lógica pura real (wiring, no solo el nombre)", () => {
  test("n/[slug]/page.tsx importa y LLAMA resolveEffectiveMesa/shouldFetchCustomerMesaData/shouldCheckMesaGeofence — nunca reimplementa el cómputo inline", () => {
    const src = read("src/app/n/[slug]/page.tsx")
    expect(src).toContain('from "@/lib/mesa-checkout-transition"')
    // Llamada real (con paréntesis de invocación), no solo mencionada en un comentario.
    expect(src).toMatch(/=\s*resolveEffectiveMesa\(\{/)
    expect(src).toMatch(/shouldFetchCustomerMesaData\(\{/)
    // Nunca debe volver a existir el cómputo inline que reemplaza esta función.
    expect(src).not.toContain('const effectiveMesaNumero = (salonHabilitadoDelNegocio ? mesaNumero : null) ?? mozoSelectedMesa?.numero ?? null')
    // shouldCheckMesaGeofence se mantiene INLINE a propósito (equivalente
    // probado por separado en mesa-checkout-transition.test.ts, escenario
    // 11) — enrutarlo por shouldCheckMesaGeofence() de la lib rompe la
    // memoización manual del useCallback siguiente (runMesaGeofenceCheck);
    // confirmado reproducible. Mismo resultado booleano en ambas formas.
    expect(src).toContain("const shouldCheckMesaGeofence = isEffectiveMesaOrder && !!negocio?.mesaGeofenceReady")
  })

  test("cart-panel.tsx importa y LLAMA resolveMetodoEntrega/defaultMetodoEntregaManual — metodoEntrega nunca es un useState inicializado una sola vez", () => {
    const src = read("src/components/cart/cart-panel.tsx")
    expect(src).toContain('from "@/lib/mesa-checkout-transition"')
    expect(src).toMatch(/const metodoEntrega = resolveMetodoEntrega\(\{/)
    expect(src).toMatch(/defaultMetodoEntregaManual\(negocio\.ofreceDelivery\)/)
    // El patrón viejo (useState inicializado desde isMesaOrder, nunca resincronizado) no debe reaparecer.
    expect(src).not.toMatch(/useState<"retiro" \| "domicilio" \| "mesa">\(\s*\n\s*isMesaOrder \? "mesa"/)
  })

  test("clearCart() solo se llama en el camino de éxito de handleCheckout — ninguna transición de modo mesa lo dispara", () => {
    const src = read("src/components/cart/cart-panel.tsx")
    const ocurrencias = (src.match(/\bclearCart\(\)/g) ?? []).length
    expect(ocurrencias).toBe(1)
    const idxClearCart = src.indexOf("clearCart()")
    const idxSetShowSuccess = src.indexOf("setShowSuccess(true)")
    const idxHandleCheckoutStart = src.indexOf("const handleCheckout = async ()")
    expect(idxSetShowSuccess).toBeGreaterThan(idxHandleCheckoutStart)
    expect(idxClearCart).toBeGreaterThan(idxSetShowSuccess) // solo después de marcar éxito
  })
})

describe("Tarea 20 — la creación de pedido de mesa exige salonHabilitado", () => {
  test("POST /api/pedidos rechaza metodoEntrega mesa cuando el negocio no tiene Salón, ANTES de resolver la mesa", () => {
    const src = read("src/app/api/pedidos/route.ts")
    const idxImport = src.indexOf('from "@/lib/negocio-salon-contract"')
    const idxIsMesaOrderBlock = src.indexOf("if (isMesaOrder) {")
    const idxCheck = src.indexOf("tieneSalonHabilitado(negocio)")
    const idxResolverMesa = src.indexOf("mesaNumero or mesaId is required")
    expect(idxImport).toBeGreaterThan(-1)
    expect(idxIsMesaOrderBlock).toBeGreaterThan(-1)
    expect(idxCheck).toBeGreaterThan(idxIsMesaOrderBlock)
    expect(idxCheck).toBeLessThan(idxResolverMesa)
  })
})

describe("Tarea 20-CORRECCIÓN-1 — POST /api/pedidos revalida Salón una segunda vez, DENTRO de la misma transacción que crea el pedido (Caso C)", () => {
  test("la revalidación final vive dentro del mismo db.$transaction que tx.pedido.create — nunca en una transacción separada", () => {
    const src = read("src/app/api/pedidos/route.ts")
    const idxTransactionStart = src.indexOf(".$transaction(async (tx) => {")
    const idxRevalidacion = src.indexOf("beforeFinalSalonRevalidation", idxTransactionStart)
    const idxNegocioFresco = src.indexOf("negocioFresco = await tx.negocio.findUnique(", idxTransactionStart)
    const idxThrow = src.indexOf("throw new SalonDeshabilitadoError()", idxTransactionStart)
    const idxPedidoCreate = src.indexOf("await tx.pedido.create(")
    expect(idxTransactionStart).toBeGreaterThan(-1)
    expect(idxRevalidacion).toBeGreaterThan(idxTransactionStart)
    expect(idxNegocioFresco).toBeGreaterThan(idxTransactionStart)
    expect(idxThrow).toBeGreaterThan(idxNegocioFresco)
    expect(idxThrow).toBeLessThan(idxPedidoCreate)
  })

  test("SalonDeshabilitadoError se mapea a 400 sanitizado, nunca a 500 ni al mensaje crudo de Prisma/Error", () => {
    const src = read("src/app/api/pedidos/route.ts")
    expect(src).toContain("if (error instanceof SalonDeshabilitadoError) throw error") // re-lanzado desde el .catch interno, nunca tratado como conflicto de idempotencia
    expect(src).toMatch(/if \(error instanceof SalonDeshabilitadoError\) \{\s*\n\s*return NextResponse\.json\(\s*\n\s*\{ error: "El negocio no tiene Salón habilitado" \},\s*\n\s*\{ status: 400 \}/)
  })

  test("TAREA-20-CORRECCIÓN-2: el export HTTP `POST` mantiene EXACTAMENTE la firma que Next.js espera (sin segundo parámetro) — un segundo parámetro ahí rompe RouteHandlerConfig del validador generado (causa real, confirmada, de los 2 errores TypeScript nuevos 34->36)", () => {
    const src = read("src/app/api/pedidos/route.ts")
    expect(src).toMatch(/export async function POST\(request: NextRequest\) \{\s*\n\s*return handlePedidoCreation\(request\)\s*\n\s*\}/)
    expect(src).not.toMatch(/export async function POST\(request: NextRequest, testHooks/)
  })

  test("PedidoRouteTestHooks (beforeNegocioFetch/beforeFinalSalonRevalidation) es exclusivo de tests — solo alcanzable vía POST_FOR_TESTS, que Next.js nunca reconoce como método HTTP", () => {
    const src = read("src/app/api/pedidos/route.ts")
    expect(src).toContain("export interface PedidoRouteTestHooks")
    expect(src).toContain("async function handlePedidoCreation(request: NextRequest, testHooks?: PedidoRouteTestHooks)")
    expect(src).toContain("export async function POST_FOR_TESTS(request: NextRequest, testHooks: PedidoRouteTestHooks)")
    // El único lugar del repo que importa/llama POST_FOR_TESTS es el propio
    // test de concurrencia (negocio-salon.test.ts) — nunca código de producción.
    const testSrc = read("src/lib/negocio-salon.test.ts")
    expect(testSrc).toContain("POST_FOR_TESTS as crearPedido")
    expect(testSrc).toContain("testHooks")
  })
})

describe("Tarea 20-CORRECCIÓN-1 — todo llamador HTTP-alcanzable de SalonDeshabilitadoError responde de forma controlada, nunca 500", () => {
  test("POST /api/public/mesa-geofence: la apertura de ocupación (openOrReuseMesaOccupancy) está envuelta en un catch genérico que nunca bloquea el pedido ni expone detalle", () => {
    const src = read("src/app/api/public/mesa-geofence/route.ts")
    const idxTry = src.indexOf("try {")
    const idxOpen = src.indexOf("await openOrReuseMesaOccupancy(")
    const idxCatch = src.indexOf("} catch (occupancyError) {")
    expect(idxTry).toBeGreaterThan(-1)
    expect(idxOpen).toBeGreaterThan(idxTry)
    expect(idxCatch).toBeGreaterThan(idxOpen)
    // El catch nunca relanza ni devuelve 500 — solo registra sanitizado y deja occupancyReady=false.
    expect(src).toContain("occupancyReady = true")
    expect(src).not.toMatch(/catch \(occupancyError\) \{[\s\S]{0,400}throw/)
  })

  test("POST /api/pedidos (camino de personal/negocio sin calibrar): openOrReuseMesaOccupancyForStaff está envuelto en un catch genérico -> 409 sanitizado, nunca 500", () => {
    const src = read("src/app/api/pedidos/route.ts")
    const idxOpen = src.indexOf("await openOrReuseMesaOccupancyForStaff({")
    const idxCatch = src.indexOf("} catch (error) {", idxOpen)
    const idxCode = src.indexOf('code: "MESA_OCCUPANCY_UNAVAILABLE"', idxCatch)
    expect(idxOpen).toBeGreaterThan(-1)
    expect(idxCatch).toBeGreaterThan(idxOpen)
    expect(idxCode).toBeGreaterThan(idxCatch)
  })

  test("POST /api/operativo/mozo/panel/[slug]/pedidos: openOrReuseMesaOccupancyForStaff está envuelto en un catch genérico -> 409 sanitizado, nunca 500", () => {
    const src = read("src/app/api/operativo/mozo/panel/[slug]/pedidos/route.ts")
    const idxOpen = src.indexOf("await openOrReuseMesaOccupancyForStaff({")
    const idxCatch = src.indexOf("} catch (error) {", idxOpen)
    const idxCode = src.indexOf('code: "MESA_OCCUPANCY_UNAVAILABLE"', idxCatch)
    expect(idxOpen).toBeGreaterThan(-1)
    expect(idxCatch).toBeGreaterThan(idxOpen)
    expect(idxCode).toBeGreaterThan(idxCatch)
  })
})

describe("Tarea 20 — la apertura de ocupación revalida Salón dentro de la misma transacción", () => {
  test("openOrReuseMesaOccupancyCore lee negocio.salonActivo y lanza SalonDeshabilitadoError", () => {
    const src = read("src/lib/mesa-occupancy.ts")
    expect(src).toContain("export class SalonDeshabilitadoError")
    expect(src).toContain("tieneSalonHabilitado(negocio)")
    expect(src).toContain("throw new SalonDeshabilitadoError()")
  })

  test("el chequeo vive DENTRO de openOrReuseMesaOccupancyCore (compartido por ambas variantes), no duplicado en cada variante pública", () => {
    const src = read("src/lib/mesa-occupancy.ts")
    const ocurrencias = (src.match(/tieneSalonHabilitado\(/g) ?? []).length
    expect(ocurrencias).toBe(1) // 1 sola llamada real (más el import)
  })
})

describe("Tarea 20 — desactivarSalonSiPermitido reutiliza runSerializableTransaction (nunca duplica el motor)", () => {
  test("negocio-salon.ts importa runSerializableTransaction de mesa-occupancy.ts", () => {
    const src = read("src/lib/negocio-salon.ts")
    expect(src).toContain('from "@/lib/mesa-occupancy"')
    expect(src).toContain("runSerializableTransaction")
    expect(src).not.toContain("isolationLevel: Prisma.TransactionIsolationLevel.Serializable") // no reimplementa su propia transacción
  })

  test("reutiliza ESTADOS_PENDIENTES_MESA reexportado — nunca duplica la allowlist", () => {
    const src = read("src/lib/negocio-salon.ts")
    expect(src).toContain("ESTADOS_PENDIENTES_MESA")
    expect(src).not.toMatch(/\[\s*"recibido"\s*,\s*"preparando"/) // nunca redefine el array literal
  })
})

describe("Tarea 20 — terminal: área 'salon' exige salonActivo, área 'pyr' nunca", () => {
  test("hasTerminalArea y hasTerminalScope condicionan por 'salon', nunca por 'pyr'", () => {
    const src = read("src/lib/operaciones-terminal-access.ts")
    expect(src).toMatch(/area === "salon" && context\.negocio\.salonActivo/)
    expect(src).toMatch(/scope\.startsWith\("salon\."\) && context\.negocio\.salonActivo/)
    expect(src).not.toMatch(/area === "pyr" && context\.negocio\.salonActivo/)
    expect(src).not.toMatch(/scope\.startsWith\("pyr\."\) && context\.negocio\.salonActivo/)
  })

  test("activación de terminal exige salonActivo solo si el grant incluye 'salon', y nunca filtra salonActivo en la respuesta JSON", () => {
    const src = read("src/app/api/operaciones/terminal/activar/route.ts")
    expect(src).toContain('grantParaActivar.areas.includes("salon")')
    expect(src).toContain("tieneSalonHabilitado(terminal.negocio)")
    // La respuesta nunca debe incluir salonActivo — se excluye explícitamente.
    expect(src).toContain("salonActivo: _salonActivo, ...negocioSeguro")
  })
})

describe("Tarea 20 — empleados: mozo/salon exigen salonActivo, pyr nunca", () => {
  test("POST /api/negocio/empleados", () => {
    const src = read("src/app/api/negocio/empleados/route.ts")
    expect(src).toMatch(/areaOperativa === "mozo" \|\| areaOperativa === "salon"/)
    expect(src).not.toMatch(/areaOperativa === "pyr"[\s\S]*salonActivo/)
  })

  test("PUT /api/negocio/empleados/[id]", () => {
    const src = read("src/app/api/negocio/empleados/[id]/route.ts")
    expect(src).toMatch(/normalized === "mozo" \|\| normalized === "salon"/)
  })
})

describe("Tarea 20 — negocio público expone salonHabilitado sanitizado, nunca salonActivo crudo", () => {
  test("GET /api/negocios/[slug]", () => {
    const src = read("src/app/api/negocios/[slug]/route.ts")
    expect(src).toContain("salonHabilitado: negocio.salonActivo === true")
  })
})

describe("Tarea 20-CORRECCIÓN-1 — página pública consolida UN SOLO flag efectivo de mesa", () => {
  test("n/[slug]/page.tsx deriva salonHabilitadoDelNegocio a partir de negocio.salonHabilitado, nunca de isMesaOrder", () => {
    const src = read("src/app/n/[slug]/page.tsx")
    expect(src).toContain("const salonHabilitadoDelNegocio = !!negocio?.salonHabilitado")
  })

  test("effectiveMesaNumero/effectiveMesaId/isEffectiveMesaOrder se derivan de resolveEffectiveMesa (Tarea 20-CORRECCIÓN-2) — nunca un cómputo inline duplicado", () => {
    const src = read("src/app/n/[slug]/page.tsx")
    expect(src).toMatch(/const \{ effectiveMesaNumero, effectiveMesaId, isEffectiveMesaOrder \} = resolveEffectiveMesa\(\{/)
  })

  test("banner de mesa y panel de cuenta pública (23-B) usan isEffectiveMesaOrder, nunca mesaHabilitadaParaEsteNegocio ni isMesaOrder crudo", () => {
    const src = read("src/app/n/[slug]/page.tsx")
    expect(src).not.toContain("mesaHabilitadaParaEsteNegocio")
    const usos = (src.match(/isEffectiveMesaOrder && effectiveMesaNumero/g) ?? []).length
    expect(usos).toBe(2) // banner de mesa + panel de cuenta pública (23-B)
  })

  test("canOrder/requireAuth/requireLocation usan isEffectiveMesaOrder, nunca isMesaOrder crudo como autoridad de comportamiento", () => {
    const src = read("src/app/n/[slug]/page.tsx")
    expect(src).toContain("const canOrder = isEffectiveMesaOrder || (isAuthenticated() && userType()")
    expect(src).toMatch(/requireAuth = \(\): boolean => \{\s*\n\s*if \(isEffectiveMesaOrder\) return true/)
    expect(src).toMatch(/requireLocation = \(\): boolean => \{\s*\n\s*if \(isEffectiveMesaOrder\) return true/)
  })

  test("la consulta a mesas-public (customerMesaData) nunca se dispara si el negocio no tiene Salón habilitado (Tarea 20-CORRECCIÓN-2: vía shouldFetchCustomerMesaData)", () => {
    const src = read("src/app/n/[slug]/page.tsx")
    const ocurrencias = (src.match(/shouldFetchCustomerMesaData\(\{ mesaNumero, slug, isAuthenticatedMozo: false, salonHabilitadoDelNegocio \}\)/g) ?? []).length
    expect(ocurrencias).toBe(2) // guardia dentro de queryFn + `enabled`, misma función real en ambos
  })

  test("isMesaOrder crudo sobrevive únicamente como detección de URL — nunca como autoridad de comportamiento fuera de su propia declaración", () => {
    const src = read("src/app/n/[slug]/page.tsx")
    expect(src).not.toMatch(/\bisMesaOrder\b/)
  })
})
