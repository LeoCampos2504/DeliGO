/**
 * P2-T23-R3B — local, authenticated Testing replay harness.
 *
 * This file deliberately has no public route and never runs a replay merely by
 * being imported. Every mutating command requires an explicit Testing marker,
 * a Testing base URL and --confirm-testing. The only tracking writes use the
 * real authenticated POST /api/repartidor/ubicacion endpoint.
 */

import { randomUUID } from "node:crypto"

type Scenario = "smooth-route" | "curve" | "stationary" | "stale" | "complete"

interface Fixture {
  negocioId: string
  clienteId: string
  repartidorId: string
  pedidoId: string
  clienteSession: string
  repartidorSession: string
}

interface ReplayPoint {
  lat: number
  lng: number
}

const PREFIX = "TEST_T23_"
const DEFAULT_BASE_URL = process.env.T23_TESTING_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || ""
const scenarioNames: Scenario[] = ["smooth-route", "curve", "stationary", "stale", "complete"]

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function flagValue(name: string): string | null {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] || null : null
}

function fail(message: string): never {
  console.error(`T23_HARNESS_ERROR=${message}`)
  process.exit(1)
}

function assertTestingGuard(baseUrl: string, requiresDatabase = false): URL {
  if (!hasFlag("--confirm-testing")) fail("HARNESS_PRODUCTION_GUARD=HARD_FAIL missing --confirm-testing")
  const environment = process.env.DELIGO_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.APP_ENV
  if (environment !== "TESTING") fail("HARNESS_PRODUCTION_GUARD=HARD_FAIL environment marker must be exactly TESTING")
  if (!baseUrl) fail("HARNESS_PRODUCTION_GUARD=HARD_FAIL missing T23_TESTING_BASE_URL")

  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    fail("HARNESS_PRODUCTION_GUARD=HARD_FAIL invalid Testing base URL")
  }
  const host = parsed.hostname.toLowerCase()
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    host === "deligo.ar" ||
    host === "www.deligo.ar" ||
    host.endsWith(".deligo.ar") ||
    process.env.NODE_ENV === "production"
  ) {
    fail("HARNESS_PRODUCTION_GUARD=HARD_FAIL Production target rejected")
  }

  const databaseUrl = process.env.DATABASE_URL
  const testingDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
  if (requiresDatabase && (!databaseUrl || !testingDatabaseUrl || databaseUrl !== testingDatabaseUrl)) {
    fail("HARNESS_PRODUCTION_GUARD=HARD_FAIL DATABASE_URL must equal DELIGO_TEST_DATABASE_URL")
  }
  return parsed
}

function printUsage(): void {
  console.log([
    "Usage:",
    "  bun run scripts/testing/t23-trajectory-replay.ts --dry-run --confirm-testing",
    "  bun run scripts/testing/t23-trajectory-replay.ts --prepare --confirm-testing",
    "  bun run scripts/testing/t23-trajectory-replay.ts --scenario smooth-route --confirm-testing",
    "  bun run scripts/testing/t23-trajectory-replay.ts --cleanup --confirm-testing",
    "",
    "Required environment: DELIGO_ENVIRONMENT=TESTING, T23_TESTING_BASE_URL,",
    "and for DB commands DATABASE_URL=DELIGO_TEST_DATABASE_URL.",
    "Reuse an existing fixture with T23_ORDER_ID, T23_CLIENT_SESSION and T23_DRIVER_SESSION.",
  ].join("\n"))
}

function routeFor(scenario: Scenario): ReplayPoint[] {
  const straight: ReplayPoint[] = [
    { lat: -34.60370, lng: -58.38160 },
    { lat: -34.60358, lng: -58.38160 },
    { lat: -34.60346, lng: -58.38160 },
    { lat: -34.60334, lng: -58.38160 },
    { lat: -34.60322, lng: -58.38148 },
    { lat: -34.60310, lng: -58.38136 },
    { lat: -34.60298, lng: -58.38124 },
    { lat: -34.60286, lng: -58.38112 },
    { lat: -34.60274, lng: -58.38100 },
    { lat: -34.60262, lng: -58.38088 },
    { lat: -34.60250, lng: -58.38076 },
    { lat: -34.60238, lng: -58.38064 },
  ]
  if (scenario === "curve") {
    return [
      { lat: -34.60370, lng: -58.38160 },
      { lat: -34.60358, lng: -58.38152 },
      { lat: -34.60344, lng: -58.38142 },
      { lat: -34.60328, lng: -58.38130 },
      { lat: -34.60316, lng: -58.38114 },
      { lat: -34.60310, lng: -58.38096 },
      { lat: -34.60308, lng: -58.38076 },
      { lat: -34.60312, lng: -58.38058 },
      { lat: -34.60322, lng: -58.38042 },
      { lat: -34.60336, lng: -58.38030 },
    ]
  }
  return straight
}

function buildBatches(points: ReplayPoint[]): ReplayPoint[][] {
  const batches: ReplayPoint[][] = []
  for (let index = 0; index < points.length; index += 4) {
    batches.push(points.slice(index, index + 4))
  }
  return batches
}

function withTrailingSlashRemoved(url: URL): string {
  return url.toString().replace(/\/$/, "")
}

async function prepareFixture(): Promise<Fixture> {
  if (!process.env.DATABASE_URL || !process.env.DELIGO_TEST_DATABASE_URL) {
    fail("HARNESS_PRODUCTION_GUARD=HARD_FAIL DB prepare requires DATABASE_URL and DELIGO_TEST_DATABASE_URL")
  }
  const [{ db }, { createSession }] = await Promise.all([
    import("@/lib/db"),
    import("@/lib/auth"),
  ])
  const suffix = randomUUID().slice(0, 8).toUpperCase()
  const negocioName = `${PREFIX}NEGOCIO_${suffix}`
  const clienteName = `${PREFIX}CLIENTE_${suffix}`
  const repartidorName = `${PREFIX}REPARTIDOR_${suffix}`
  const slug = `${PREFIX.toLowerCase()}negocio_${suffix.toLowerCase()}`
  const emailSuffix = `${suffix.toLowerCase()}@testing.invalid`

  const negocio = await db.negocio.create({
    data: {
      slug,
      nombre: negocioName,
      usuario: `${PREFIX.toLowerCase()}usuario_${suffix.toLowerCase()}`,
      email: `negocio_${emailSuffix}`,
      password: `TEST_T23_EPHEMERAL_${randomUUID()}`,
      aprobado: true,
      ofreceDelivery: true,
      zonaDeliveryActiva: true,
      seguimientoDeliveryActivo: true,
      lat: -34.60370,
      lng: -58.38160,
    },
  })
  const cliente = await db.cliente.create({
    data: {
      nombre: clienteName,
      email: `cliente_${emailSuffix}`,
      telefono: "TEST_T23_TEMP",
    },
  })
  const repartidor = await db.repartidor.create({
    data: {
      nombre: repartidorName,
      email: `repartidor_${emailSuffix}`,
      activo: true,
    },
  })
  await db.repartidorNegocio.create({
    data: {
      repartidorId: repartidor.id,
      negocioId: negocio.id,
      negocioSlug: negocio.slug,
      negocioNombre: negocio.nombre,
      codigoAcceso: `TEST_T23_${randomUUID()}`,
    },
  })
  const first = routeFor("smooth-route")[0]
  const pedido = await db.pedido.create({
    data: {
      negocioId: negocio.id,
      negocioSlug: negocio.slug,
      negocioNombre: negocio.nombre,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      clienteTelefono: cliente.telefono,
      total: 1,
      totalProductos: 1,
      metodoEntrega: "domicilio",
      direccion: "Plaza de Mayo, Buenos Aires",
      lat: -34.60220,
      lng: -58.37950,
      negocioLat: negocio.lat,
      negocioLng: negocio.lng,
      repartidorId: repartidor.id,
      repartidorNombre: repartidor.nombre,
      repartidorAceptaFecha: new Date(),
      repartidorLat: first.lat,
      repartidorLng: first.lng,
      repartidorLastUpdate: new Date(),
      estado: "en_camino",
      seguimientoDeliveryHabilitado: true,
    },
  })
  return {
    negocioId: negocio.id,
    clienteId: cliente.id,
    repartidorId: repartidor.id,
    pedidoId: pedido.id,
    clienteSession: await createSession(cliente.id, "cliente"),
    repartidorSession: await createSession(repartidor.id, "repartidor"),
  }
}

function fixtureFromEnvironment(): Fixture {
  const pedidoId = process.env.T23_ORDER_ID
  const clienteSession = process.env.T23_CLIENT_SESSION
  const repartidorSession = process.env.T23_DRIVER_SESSION
  if (!pedidoId || !clienteSession || !repartidorSession) {
    fail("fixture missing: provide T23_ORDER_ID, T23_CLIENT_SESSION and T23_DRIVER_SESSION or run --prepare")
  }
  return {
    negocioId: process.env.T23_BUSINESS_ID || "provided",
    clienteId: process.env.T23_CLIENT_ID || "provided",
    repartidorId: process.env.T23_DRIVER_ID || "provided",
    pedidoId,
    clienteSession,
    repartidorSession,
  }
}

async function postLocation(baseUrl: string, fixture: Fixture, point: ReplayPoint, trajectory?: ReplayPoint[], batchNumber = 0): Promise<void> {
  const wireTrajectory = trajectory?.map((item, index) => ({ lat: item.lat, lng: item.lng, offsetMs: index * 450 }))
  const body = {
    pedidoId: fixture.pedidoId,
    lat: point.lat,
    lng: point.lng,
    ...(wireTrajectory ? { trajectory: wireTrajectory } : {}),
  }
  const sendTime = new Date().toISOString()
  const response = await fetch(`${baseUrl}/api/repartidor/ubicacion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `deligo_session=${fixture.repartidorSession}`,
    },
    body: JSON.stringify(body),
  })
  const responseText = await response.text()
  let parsed: Record<string, unknown> = {}
  try { parsed = JSON.parse(responseText) as Record<string, unknown> } catch { /* preserve raw status only */ }
  console.log(JSON.stringify({
    BATCH_NUMBER: batchNumber,
    POINT_COUNT: wireTrajectory?.length || 0,
    VERSION_RETURNED: parsed.version ?? parsed.locationRevision ?? null,
    SEND_TIME: sendTime,
    SERVER_RESPONSE: { status: response.status, ok: response.ok, body: parsed.error ? { error: parsed.error } : { ok: parsed.ok } },
  }))
  if (!response.ok) fail(`tracking POST failed with HTTP ${response.status}`)
}

async function runScenario(baseUrl: string, fixture: Fixture, scenario: Scenario): Promise<void> {
  if (scenario === "stale") {
    console.log("SCENARIO=stale");
    console.log("BATCHES_SENT=0");
    console.log("STALE_SCENARIO=operator-controlled pause; no state is falsified");
    return
  }
  if (scenario === "stationary") {
    const point = routeFor("stationary")[0]
    await postLocation(baseUrl, fixture, point, undefined, 1)
    console.log("SCENARIO=stationary");
    console.log("TRAJECTORY_POSTS=0");
    return
  }

  const batches = buildBatches(routeFor(scenario))
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index]
    await postLocation(baseUrl, fixture, batch[batch.length - 1], batch, index + 1)
    if (index < batches.length - 1) await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  if (scenario === "complete") {
    const clientConfirmation = await fetch(`${baseUrl}/api/cliente/pedidos/${fixture.pedidoId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `deligo_session=${fixture.clienteSession}`,
      },
      body: JSON.stringify({ action: "confirmar" }),
    })
    if (!clientConfirmation.ok) fail(`client confirmation failed with HTTP ${clientConfirmation.status}`)
    const delivered = await fetch(`${baseUrl}/api/repartidor/pedidos/${fixture.pedidoId}/entregar`, {
      method: "PUT",
      headers: { Cookie: `deligo_session=${fixture.repartidorSession}` },
    })
    if (!delivered.ok) fail(`completion failed with HTTP ${delivered.status}`)
    console.log("COMPLETION_ENDPOINT=PASS")
  }
  console.log(`SCENARIO=${scenario}`)
  console.log(`BATCHES_SENT=${batches.length}`)
}

async function cleanupFixture(): Promise<void> {
  const ids = [process.env.T23_ORDER_ID, process.env.T23_CLIENT_ID, process.env.T23_DRIVER_ID, process.env.T23_BUSINESS_ID]
  if (ids.some((value) => !value)) fail("cleanup requires T23_ORDER_ID, T23_CLIENT_ID, T23_DRIVER_ID and T23_BUSINESS_ID")
  const [{ db }] = await Promise.all([import("@/lib/db")])
  const [pedido, cliente, repartidor, negocio] = await Promise.all([
    db.pedido.findUnique({ where: { id: ids[0]! }, select: { id: true, negocioId: true, clienteId: true, repartidorId: true, clienteNombre: true, negocioNombre: true } }),
    db.cliente.findUnique({ where: { id: ids[1]! }, select: { id: true, nombre: true, email: true } }),
    db.repartidor.findUnique({ where: { id: ids[2]! }, select: { id: true, nombre: true, email: true } }),
    db.negocio.findUnique({ where: { id: ids[3]! }, select: { id: true, nombre: true, email: true } }),
  ])
  if (!pedido || !cliente || !repartidor || !negocio) fail("cleanup ownership check failed: fixture row missing")
  if (![pedido.clienteNombre, pedido.negocioNombre, cliente.nombre, repartidor.nombre, negocio.nombre].every((value) => value.startsWith(PREFIX))) {
    fail("cleanup ownership check failed: TEST_T23_ prefix missing")
  }
  await db.pedido.delete({ where: { id: pedido.id } })
  await db.sesion.deleteMany({ where: { userId: { in: [cliente.id, repartidor.id] } } })
  await db.repartidorNegocio.deleteMany({ where: { repartidorId: repartidor.id, negocioId: negocio.id } })
  await db.repartidor.delete({ where: { id: repartidor.id } })
  await db.cliente.delete({ where: { id: cliente.id } })
  await db.negocio.delete({ where: { id: negocio.id } })
  console.log("CLEANUP=PASS")
}

async function main(): Promise<void> {
  if (hasFlag("--help") || process.argv.length <= 2) {
    printUsage()
    return
  }
  const requiresDatabase = hasFlag("--prepare") || hasFlag("--cleanup")
  const baseUrl = withTrailingSlashRemoved(assertTestingGuard(DEFAULT_BASE_URL, requiresDatabase))
  if (hasFlag("--dry-run")) {
    const scenario = (flagValue("--scenario") || "smooth-route") as Scenario
    if (!scenarioNames.includes(scenario)) fail(`unknown scenario ${scenario}`)
    console.log("HARNESS_PRODUCTION_GUARD=HARD_FAIL")
    console.log("DRY_RUN=PASS")
    console.log(`TESTING_BASE_URL=${baseUrl}`)
    console.log(`SCENARIO=${scenario}`)
    console.log(`ROUTE_POINTS=${routeFor(scenario).length}`)
    console.log("HARNESS_TRACKING_REPLAY_USES_REAL_POST_ENDPOINT=SI")
    return
  }
  if (hasFlag("--cleanup")) {
    await cleanupFixture()
    return
  }

  const fixture = hasFlag("--prepare") ? await prepareFixture() : fixtureFromEnvironment()
  console.log(`BUSINESS_ID=${fixture.negocioId}`)
  console.log(`CLIENT_ID=${fixture.clienteId}`)
  console.log(`DRIVER_ID=${fixture.repartidorId}`)
  console.log(`ORDER_ID=${fixture.pedidoId}`)
  console.log(`CLIENT_URL=${baseUrl}/cliente`)
  console.log("CLIENT_INSTRUCTIONS=abrir Cliente Testing, localizar el pedido activo y pulsar Rastrear envío")
  if (hasFlag("--prepare") && !flagValue("--scenario")) {
    console.log("HARNESS_FIXTURE_READY=SI")
    console.log("HARNESS_REPLAY_NOT_STARTED=SI")
    console.log(`T23_CLIENT_SESSION=${fixture.clienteSession}`)
    console.log(`T23_DRIVER_SESSION=${fixture.repartidorSession}`)
    return
  }
  const scenario = (flagValue("--scenario") || "smooth-route") as Scenario
  if (!scenarioNames.includes(scenario)) fail(`unknown scenario ${scenario}`)
  await runScenario(baseUrl, fixture, scenario)
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
