/// <reference types="bun-types" />

// ============================================
// DeliGO — T20-DK2A: cobertura de "solo delivery" sin coordenadas en GET
// ============================================
// Usa las rutas REALES (listado principal, promocionados, batch de
// cobertura/precios, detalle por slug) contra PostgreSQL TESTING real —
// nunca mockea Prisma. Prefijo `test-t20dk2-`, cleanup obligatorio.
//
// A diferencia de la versión T20-DK2 (revertida), la exclusión de negocios
// "solo delivery" fuera de cobertura ya NO ocurre dentro de los endpoints
// GET de discovery (que ahora ignoran cualquier lat/lng recibido) — ocurre
// client-side, vía `useSoloDeliveryCoverage` (src/hooks), contra el batch
// `POST /api/negocios/delivery-precios`. Este archivo prueba: (1) el
// contrato de privacidad — ningún fetch GET de discovery construye una URL
// con lat/lng, (2) que los endpoints GET son invariantes a lat/lng (ya no
// filtran), (3) la regresión completa del endpoint batch que ahora es la
// única fuente real de cobertura para discovery.

import { readFileSync } from "fs"
import { join } from "path"
import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { GET as listNegocios } from "@/app/api/negocios/route"
import { GET as listPromocionados } from "@/app/api/negocios/promocionados/route"
import { GET as getNegocioDetail } from "@/app/api/negocios/[slug]/route"
import { POST as postDeliveryPrecios } from "@/app/api/negocios/delivery-precios/route"
import { fetchDeliveryPreciosBatched, type DeliveryPreciosMap } from "@/lib/delivery-precios-batch"

setDefaultTimeout(60_000)

const prefix = "test-t20dk2-"

// Triángulo de cobertura real — dentro: (1,1). Fuera: (50,50).
const zonaCobertura = JSON.stringify([
  { nombre: "Zona T20DK2", precio: 250, puntos: [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 0 }] },
])
const DENTRO = { lat: 1, lng: 1 }
const FUERA = { lat: 50, lng: 50 }

async function ensureNegocio(
  suffix: string,
  overrides: Partial<{
    ofreceDelivery: boolean
    ofreceRetiro: boolean
    promocionado: boolean
    ordenPromocion: number
    zonaDeliveryActiva: boolean
    deliveryMode: string
    zonasDelivery: string
    precioDelivery: number
  }> = {}
) {
  return db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}`,
      usuario: `${prefix}${suffix}`,
      email: `${prefix}${suffix}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      ofreceDelivery: overrides.ofreceDelivery ?? true,
      ofreceRetiro: overrides.ofreceRetiro ?? false,
      zonaDeliveryActiva: overrides.zonaDeliveryActiva ?? true,
      deliveryMode: overrides.deliveryMode ?? "expert",
      zonasDelivery: overrides.zonasDelivery ?? zonaCobertura,
      precioDelivery: overrides.precioDelivery ?? 0,
      promocionado: overrides.promocionado ?? false,
      ordenPromocion: overrides.ordenPromocion ?? 0,
    },
  })
}

function reqNegocios(params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString()
  return new NextRequest(`http://localhost/api/negocios${qs ? `?${qs}` : ""}`)
}

function reqDeliveryPrecios(body: unknown) {
  return new NextRequest("http://localhost/api/negocios/delivery-precios", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function cleanup() {
  await db.negocio.deleteMany({ where: { slug: { startsWith: prefix } } })
}

let configOriginal: { id: string; promocionadosActivos: boolean } | null = null
let configCreadaPorTest = false

beforeAll(async () => {
  await cleanup()
  const existing = await db.configPlataforma.findFirst()
  if (existing) {
    configOriginal = { id: existing.id, promocionadosActivos: existing.promocionadosActivos }
    if (!existing.promocionadosActivos) {
      await db.configPlataforma.update({ where: { id: existing.id }, data: { promocionadosActivos: true } })
    }
  } else {
    const created = await db.configPlataforma.create({ data: { clave: `t20dk2-${randomUUID()}`, promocionadosActivos: true } })
    configCreadaPorTest = true
    configOriginal = { id: created.id, promocionadosActivos: true }
  }
}, { timeout: 30_000 })

afterAll(async () => {
  await cleanup()
  if (configCreadaPorTest && configOriginal) {
    await db.configPlataforma.delete({ where: { id: configOriginal.id } }).catch(() => {})
  } else if (configOriginal) {
    await db.configPlataforma.update({ where: { id: configOriginal.id }, data: { promocionadosActivos: configOriginal.promocionadosActivos } }).catch(() => {})
  }
  const remaining = await db.negocio.count({ where: { slug: { startsWith: prefix } } })
  expect(remaining).toBe(0)
})

// ============================================
// 22. Contrato de privacidad: sin coordenadas en URLs GET (chequeo estático)
// ============================================
describe("22. Privacidad — ningún fetch GET de discovery construye lat/lng en la URL", () => {
  test("cliente/page.tsx: el fetch a /api/negocios nunca agrega lat/lng como query param", () => {
    const source = readFileSync(join(process.cwd(), "src/app/cliente/page.tsx"), "utf-8")
    const anchor = 'queryKey: ["negocios", activeCategory, activeSort, searchQuery]'
    const start = source.indexOf(anchor)
    expect(start).toBeGreaterThan(-1)
    const fetchCallIdx = source.indexOf("fetch(`/api/negocios?", start)
    expect(fetchCallIdx).toBeGreaterThan(-1)
    const block = source.slice(start, fetchCallIdx + 40)
    expect(block).not.toMatch(/\.set\(\s*["']lat["']/)
    expect(block).not.toMatch(/\.set\(\s*["']lng["']/)
  })

  test("promoted-businesses-section.tsx: el fetch a /api/negocios/promocionados nunca agrega lat/lng como query param", () => {
    const source = readFileSync(join(process.cwd(), "src/components/home/promoted-businesses-section.tsx"), "utf-8")
    const fetchCallIdx = source.indexOf('fetch("/api/negocios/promocionados"')
    expect(fetchCallIdx).toBeGreaterThan(-1)
    // La llamada es un literal fijo sin querystring en absoluto.
    const line = source.slice(fetchCallIdx, fetchCallIdx + 60)
    expect(line).not.toMatch(/[?&](lat|lng)=/)
  })

  test("ni GET /api/negocios ni GET /api/negocios/promocionados leen searchParams lat/lng en su código fuente", () => {
    const negociosSource = readFileSync(join(process.cwd(), "src/app/api/negocios/route.ts"), "utf-8")
    const promoSource = readFileSync(join(process.cwd(), "src/app/api/negocios/promocionados/route.ts"), "utf-8")
    expect(negociosSource).not.toMatch(/searchParams\.get\(\s*["']lat["']\s*\)/)
    expect(negociosSource).not.toMatch(/searchParams\.get\(\s*["']lng["']\s*\)/)
    expect(promoSource).not.toMatch(/searchParams\.get\(\s*["']lat["']\s*\)/)
    expect(promoSource).not.toMatch(/searchParams\.get\(\s*["']lng["']\s*\)/)
  })
})

// ============================================
// 23. GET /api/negocios es invariante a lat/lng (ya no filtra)
// ============================================
describe("23. GET /api/negocios ignora cualquier lat/lng recibido", () => {
  test("un negocio solo delivery fuera de zona aparece igual, con o sin lat/lng en la query", async () => {
    const negocio = await ensureNegocio("get-invariante", { ofreceDelivery: true, ofreceRetiro: false })

    const sinCoords = await listNegocios(reqNegocios())
    const bodySinCoords = await sinCoords.json()
    expect(bodySinCoords.some((n: { id: string }) => n.id === negocio.id)).toBe(true)

    const conCoordsFuera = await listNegocios(reqNegocios({ lat: String(FUERA.lat), lng: String(FUERA.lng) }))
    const bodyConCoordsFuera = await conCoordsFuera.json()
    expect(bodyConCoordsFuera.some((n: { id: string }) => n.id === negocio.id)).toBe(true)
  })

  test("el listado expone retiroHabilitado sanitizado, nunca ofreceRetiro crudo", async () => {
    const negocio = await ensureNegocio("get-retirohabilitado", { ofreceDelivery: true, ofreceRetiro: false })
    const res = await listNegocios(reqNegocios())
    const body = await res.json()
    const item = body.find((n: { id: string }) => n.id === negocio.id)
    expect(item.retiroHabilitado).toBe(false)
    expect(item.ofreceRetiro).toBeUndefined()
  })
})

// ============================================
// 24. GET /api/negocios/promocionados es invariante a lat/lng
// ============================================
describe("24. GET /api/negocios/promocionados ignora cualquier lat/lng recibido", () => {
  test("un negocio solo delivery promocionado fuera de zona aparece igual, con o sin lat/lng", async () => {
    const negocio = await ensureNegocio("promo-invariante", { ofreceDelivery: true, ofreceRetiro: false, promocionado: true, ordenPromocion: 1 })

    // T20-DK2A: `GET` de este endpoint ya no acepta ningún parámetro — la
    // firma real de la función confirma en tiempo de compilación que no
    // puede recibir lat/lng (ni siquiera vía URL), no sólo que los ignora.
    const res = await listPromocionados()
    const body = await res.json()
    expect(body.negocios.some((n: { id: string }) => n.id === negocio.id)).toBe(true)
  })

  test("expone retiroHabilitado sanitizado", async () => {
    const negocio = await ensureNegocio("promo-retirohabilitado", { ofreceDelivery: true, ofreceRetiro: true, promocionado: true, ordenPromocion: 2 })
    const res = await listPromocionados()
    const body = await res.json()
    const item = body.negocios.find((n: { id: string }) => n.id === negocio.id)
    expect(item.retiroHabilitado).toBe(true)
  })
})

// ============================================
// 27. Regresión completa de POST /api/negocios/delivery-precios (batch)
// ============================================
describe("27. POST /api/negocios/delivery-precios — regresión completa (única fuente real de cobertura)", () => {
  test("modo simple (sin zona activa): siempre disponible, precio plano", async () => {
    const negocio = await ensureNegocio("precios-simple", { ofreceDelivery: true, ofreceRetiro: false, zonaDeliveryActiva: false, deliveryMode: "", precioDelivery: 500 })
    const res = await postDeliveryPrecios(reqDeliveryPrecios({ lat: DENTRO.lat, lng: DENTRO.lng, negocioIds: [negocio.id] }))
    const body = await res.json()
    expect(body.precios[negocio.id].mode).toBe("simple")
    expect(body.precios[negocio.id].precioDelivery).toBe(500)
    expect(body.precios[negocio.id].delivery).toBeUndefined()
  })

  test("modo experto: dentro de zona -> disponible con precio de zona", async () => {
    const negocio = await ensureNegocio("precios-experto-dentro", { ofreceDelivery: true, ofreceRetiro: false })
    const res = await postDeliveryPrecios(reqDeliveryPrecios({ lat: DENTRO.lat, lng: DENTRO.lng, negocioIds: [negocio.id] }))
    const body = await res.json()
    expect(body.precios[negocio.id].delivery).toBeUndefined()
    expect(body.precios[negocio.id].zonaNombre).toBe("Zona T20DK2")
    expect(body.precios[negocio.id].precioDelivery).toBe(250)
  })

  test("modo experto: fuera de zona -> delivery=false, reason=outside_zones (cobertura no disponible)", async () => {
    const negocio = await ensureNegocio("precios-experto-fuera", { ofreceDelivery: true, ofreceRetiro: false })
    const res = await postDeliveryPrecios(reqDeliveryPrecios({ lat: FUERA.lat, lng: FUERA.lng, negocioIds: [negocio.id] }))
    const body = await res.json()
    expect(body.precios[negocio.id].delivery).toBe(false)
    expect(body.precios[negocio.id].reason).toBe("outside_zones")
  })

  test("negocio sin delivery: delivery=false, reason=no_delivery", async () => {
    const negocio = await ensureNegocio("precios-sin-delivery", { ofreceDelivery: false, ofreceRetiro: true, zonaDeliveryActiva: false, deliveryMode: "" })
    const res = await postDeliveryPrecios(reqDeliveryPrecios({ lat: DENTRO.lat, lng: DENTRO.lng, negocioIds: [negocio.id] }))
    const body = await res.json()
    expect(body.precios[negocio.id].delivery).toBe(false)
    expect(body.precios[negocio.id].reason).toBe("no_delivery")
  })

  test("múltiples negocios en un solo batch: cada uno resuelve su propia cobertura de forma independiente", async () => {
    const zonaChica = JSON.stringify([{ nombre: "Zona chica", precio: 100, puntos: [{ lat: 40, lng: 40 }, { lat: 40, lng: 60 }, { lat: 60, lng: 40 }] }])
    const zonaEstandar = await ensureNegocio("precios-batch-zona-estandar", { ofreceDelivery: true, ofreceRetiro: false }) // cubre DENTRO=(1,1)
    const zonaDistinta = await ensureNegocio("precios-batch-zona-distinta", { ofreceDelivery: true, ofreceRetiro: false, zonasDelivery: zonaChica }) // cubre FUERA=(50,50), no DENTRO
    const soloRetiro = await ensureNegocio("precios-batch-solo-retiro", { ofreceDelivery: false, ofreceRetiro: true, zonaDeliveryActiva: false, deliveryMode: "" })

    const res = await postDeliveryPrecios(
      reqDeliveryPrecios({ lat: DENTRO.lat, lng: DENTRO.lng, negocioIds: [zonaEstandar.id, zonaDistinta.id, soloRetiro.id] })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body.precios)).toHaveLength(3)
    expect(body.precios[zonaEstandar.id].delivery).toBeUndefined() // disponible en (1,1)
    expect(body.precios[zonaDistinta.id].delivery).toBe(false) // su zona está lejos de (1,1)
    expect(body.precios[soloRetiro.id].reason).toBe("no_delivery")
  })

  test("body inválido (sin lat/lng/negocioIds) -> 400 sanitizado, nunca 500", async () => {
    const res = await postDeliveryPrecios(reqDeliveryPrecios({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})

// ============================================
// Acceso directo — detalle por slug sigue disponible
// ============================================
describe("Acceso directo por slug — nunca 404, gates DK1 intactos", () => {
  test("negocio solo delivery: GET por slug funciona, expone retiroHabilitado, sin exponer zonasDelivery/ofreceRetiro crudos", async () => {
    const negocio = await ensureNegocio("acceso-directo", { ofreceDelivery: true, ofreceRetiro: false })
    const res = await getNegocioDetail(new NextRequest(`http://localhost/api/negocios/${negocio.slug}`), {
      params: Promise.resolve({ slug: negocio.slug }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.slug).toBe(negocio.slug)
    expect(body.retiroHabilitado).toBe(false)
    expect(body.zonasDelivery).toBeUndefined()
    expect(body.ofreceRetiro).toBeUndefined()
  })
})

// ============================================
// T20-DK2B — robustez del batch para >50 candidatos (PostgreSQL TESTING real)
// ============================================
describe("T20-DK2B — POST /api/negocios/delivery-precios rechaza explícitamente el exceso", () => {
  test("negocioIds.length > 50 -> 400 sanitizado, nunca trunca en silencio", async () => {
    const ids = Array.from({ length: 51 }, (_, i) => `fake-id-${i}`)
    const res = await postDeliveryPrecios(reqDeliveryPrecios({ lat: DENTRO.lat, lng: DENTRO.lng, negocioIds: ids }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/50/)
  })

  test("negocioIds.length === 50 -> aceptado (200)", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => `fake-id-${i}`)
    const res = await postDeliveryPrecios(reqDeliveryPrecios({ lat: DENTRO.lat, lng: DENTRO.lng, negocioIds: ids }))
    expect(res.status).toBe(200)
  })
})

describe("T20-DK2B — CRÍTICO: 51 negocios solo-delivery reales, uno de ellos en el segundo chunk", () => {
  test("dividido en 2 requests reales (50 + 1) como haría el hook, el negocio #51 (fuera de zona) queda correctamente marcado como no disponible", async () => {
    const zonaLejana = JSON.stringify([
      { nombre: "Zona lejana", precio: 100, puntos: [{ lat: 40, lng: 40 }, { lat: 40, lng: 60 }, { lat: 60, lng: 40 }] },
    ])

    const primeros50 = await Promise.all(
      Array.from({ length: 50 }, (_, i) => ensureNegocio(`batch51-${i}`, { ofreceDelivery: true, ofreceRetiro: false }))
    )
    // El #51 cubre FUERA (40..60,40..60) pero NO cubre DENTRO (1,1) — a
    // diferencia de los otros 50, que sí cubren DENTRO (zonaCobertura).
    const negocio51 = await ensureNegocio("batch51-fuera", { ofreceDelivery: true, ofreceRetiro: false, zonasDelivery: zonaLejana })

    const todosLosIds = [...primeros50.map((n) => n.id), negocio51.id]
    expect(todosLosIds).toHaveLength(51)

    // Simula exactamente lo que hace resolveSoloDeliveryCoverageBatched:
    // dos requests reales, 50 + 1, al MISMO endpoint real.
    const chunk1 = todosLosIds.slice(0, 50)
    const chunk2 = todosLosIds.slice(50)
    expect(chunk2).toEqual([negocio51.id])

    const [res1, res2] = await Promise.all([
      postDeliveryPrecios(reqDeliveryPrecios({ lat: DENTRO.lat, lng: DENTRO.lng, negocioIds: chunk1 })),
      postDeliveryPrecios(reqDeliveryPrecios({ lat: DENTRO.lat, lng: DENTRO.lng, negocioIds: chunk2 })),
    ])
    expect(res1.status).toBe(200)
    expect(res2.status).toBe(200)
    const body1 = await res1.json()
    const body2 = await res2.json()
    const combinado = { ...body1.precios, ...body2.precios }

    expect(Object.keys(combinado)).toHaveLength(51)
    // Los primeros 50 (chunk 1): dentro de zona -> disponibles.
    for (const n of primeros50) {
      expect(combinado[n.id].delivery).not.toBe(false)
    }
    // El #51 (chunk 2, único elemento): su zona no cubre DENTRO -> fuera de
    // zona. Demuestra que el segundo batch se evalúa con la misma
    // correctitud que el primero, no sólo los primeros 50.
    expect(combinado[negocio51.id].delivery).toBe(false)
    expect(combinado[negocio51.id].reason).toBe("outside_zones")
  })
})

// ============================================
// T20-DK2C — fetchDeliveryPreciosBatched real (consumidor histórico de
// precios) contra PostgreSQL TESTING — no sólo el hook de cobertura
// ============================================
describe("T20-DK2C — CRÍTICO: consumidor histórico de precios con 51 negocios reales, vía fetchDeliveryPreciosBatched real", () => {
  // Adaptador: llama la ruta REAL (misma lógica/DB que un fetch HTTP real),
  // sin depender de un servidor HTTP levantado — mismo patrón que el resto
  // de esta suite (`postDeliveryPrecios` importado directamente).
  async function fetchChunkViaRealRoute(lat: number, lng: number, ids: string[]): Promise<DeliveryPreciosMap> {
    const res = await postDeliveryPrecios(reqDeliveryPrecios({ lat, lng, negocioIds: ids }))
    if (!res.ok) return {}
    const body = await res.json()
    return body.precios ?? {}
  }

  test("51 negocios reales (precios normales + 1 con precio de zona distinguible en el 2º chunk): fetchDeliveryPreciosBatched decide el chunking internamente y combina todo, sin 400 global ni pérdida del #51", async () => {
    const zonaPrecioDistinto = JSON.stringify([
      { nombre: "Zona cara", precio: 777, puntos: [{ lat: 0, lng: 0 }, { lat: 0, lng: 10 }, { lat: 10, lng: 0 }] },
    ])

    const primeros50 = await Promise.all(
      Array.from({ length: 50 }, (_, i) => ensureNegocio(`precios51-${i}`, { ofreceDelivery: true, ofreceRetiro: false }))
    )
    const negocio51 = await ensureNegocio("precios51-especial", {
      ofreceDelivery: true,
      ofreceRetiro: false,
      zonasDelivery: zonaPrecioDistinto,
    })

    const todosLosIds = [...primeros50.map((n) => n.id), negocio51.id]
    expect(todosLosIds).toHaveLength(51)

    // A diferencia del test CRÍTICO de DK2B (que orquestaba los 2 chunks a
    // mano), acá se llama la función REAL compartida — es ella la que debe
    // decidir dividir en 50+1 y combinar el resultado.
    const combinado = await fetchDeliveryPreciosBatched(DENTRO.lat, DENTRO.lng, todosLosIds, fetchChunkViaRealRoute)

    expect(Object.keys(combinado)).toHaveLength(51)
    for (const n of primeros50) {
      expect(combinado[n.id].precioDelivery).toBe(250) // zonaCobertura estándar
    }
    // El #51 (único elemento del segundo chunk): precio de SU propia zona,
    // no el de los primeros 50 — demuestra que el chunk 2 se resuelve con
    // los datos reales de sus propios negocios, no un valor arrastrado.
    expect(combinado[negocio51.id].precioDelivery).toBe(777)
    expect(combinado[negocio51.id].zonaNombre).toBe("Zona cara")
  })
})
