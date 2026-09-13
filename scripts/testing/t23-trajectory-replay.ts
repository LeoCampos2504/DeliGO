/**
 * P2-T23-R3B — local, authenticated Testing replay harness.
 *
 * This file deliberately has no public route and never runs a replay merely by
 * being imported. Every mutating command requires an explicit Testing marker,
 * a Testing base URL and --confirm-testing. The only tracking writes use the
 * real authenticated POST /api/repartidor/ubicacion endpoint.
 */

import { randomUUID } from "node:crypto"

export type Scenario = "smooth-route" | "curve" | "stationary" | "stale" | "complete" | "route-to-destination" | "recovery-once"

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

interface CurrentTrackingPoint {
  point: ReplayPoint
  version: number | null
}

const PREFIX = "TEST_T23_"
const DEFAULT_BASE_URL = process.env.T23_TESTING_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || ""
const scenarioNames: Scenario[] = ["smooth-route", "curve", "stationary", "stale", "complete", "route-to-destination", "recovery-once"]

export const ROUTE_TO_DESTINATION_BATCH_SIZE = 4
export const ROUTE_TO_DESTINATION_BATCH_INTERVAL_MS = 4_000
export const ROUTE_TO_DESTINATION_DESTINATION: ReplayPoint = { lat: -34.6022, lng: -58.3795 }
export const ROUTE_TO_DESTINATION_TURNS = [
  { pointIndex: 6, label: "Avenida Corrientes -> Suipacha" },
  { pointIndex: 12, label: "Suipacha -> Tucuman" },
  { pointIndex: 18, label: "Tucuman -> Avenida 9 de Julio" },
  { pointIndex: 25, label: "Avenida 9 de Julio -> Avenida Corrientes" },
  { pointIndex: 31, label: "Avenida Corrientes -> Suipacha" },
] as const

// Frozen OSRM geometry sampled to 36 points for deterministic, street-shaped
// Testing replay. The harness never calls OSRM at runtime.
const routeToDestination: ReplayPoint[] = [
  { lat: -34.603592, lng: -58.381612 },
  { lat: -34.6036245782379, lng: -58.38120139395737 },
  { lat: -34.603642361368266, lng: -58.38079252458506 },
  { lat: -34.60361980462608, lng: -58.38037907047051 },
  { lat: -34.603485687625536, lng: -58.380115747317255 },
  { lat: -34.603593685038035, lng: -58.37984577819097 },
  { lat: -34.60353788748676, lng: -58.37947832963488 },
  { lat: -34.60319737879905, lng: -58.37950249233039 },
  { lat: -34.60285673477496, lng: -58.37952413160241 },
  { lat: -34.60251609075087, lng: -58.37954577087443 },
  { lat: -34.60217526535804, lng: -58.379562513583636 },
  { lat: -34.60183439722211, lng: -58.37957809612699 },
  { lat: -34.601493590801326, lng: -58.379595139041434 },
  { lat: -34.60128977895598, lng: -58.37975994569302 },
  { lat: -34.601310281829555, lng: -58.38017360502066 },
  { lat: -34.60133078470313, lng: -58.3805872643483 },
  { lat: -34.601351287576705, lng: -58.381000923675934 },
  { lat: -34.60136679322513, lng: -58.38141489074242 },
  { lat: -34.60138430170247, lng: -58.381828743696616 },
  { lat: -34.60161039233753, lng: -58.381963723685786 },
  { lat: -34.60195120312981, lng: -58.38194638844711 },
  { lat: -34.60229201392208, lng: -58.38192905320844 },
  { lat: -34.602632854503646, lng: -58.381912644489205 },
  { lat: -34.602973382090006, lng: -58.38191729706164 },
  { lat: -34.60331283029213, lng: -58.381949533668966 },
  { lat: -34.603647437528025, lng: -58.381930596451106 },
  { lat: -34.60359, lng: -58.38152480238856 },
  { lat: -34.60364321520434, lng: -58.381117139182635 },
  { lat: -34.603638393105896, lng: -58.38070540318842 },
  { lat: -34.60361804142036, lng: -58.380291730902364 },
  { lat: -34.6035954707927, lng: -58.379878219400645 },
  { lat: -34.60356456836674, lng: -58.37947579955143 },
  { lat: -34.60322410077681, lng: -58.37950071204943 },
  { lat: -34.60288345157033, lng: -58.37952223057532 },
  { lat: -34.60254280236384, lng: -58.37954374910122 },
  ROUTE_TO_DESTINATION_DESTINATION,
]

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
    "  bun run scripts/testing/t23-trajectory-replay.ts --scenario route-to-destination --confirm-testing",
    "  bun run scripts/testing/t23-trajectory-replay.ts --scenario recovery-once --confirm-testing",
    "  bun run scripts/testing/t23-trajectory-replay.ts --cleanup --confirm-testing",
    "",
    "Required environment: DELIGO_ENVIRONMENT=TESTING, T23_TESTING_BASE_URL,",
    "and for DB commands DATABASE_URL=DELIGO_TEST_DATABASE_URL.",
    "Reuse an existing fixture with T23_ORDER_ID, T23_CLIENT_SESSION and T23_DRIVER_SESSION.",
  ].join("\n"))
}

export function routeFor(scenario: Scenario): ReplayPoint[] {
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
  if (scenario === "route-to-destination") return routeToDestination
  return straight
}

export function buildBatches(points: ReplayPoint[], batchSize = 4): ReplayPoint[][] {
  const batches: ReplayPoint[][] = []
  for (let index = 0; index < points.length; index += batchSize) {
    batches.push(points.slice(index, index + batchSize))
  }
  return batches
}

export function haversineDistanceMeters(a: ReplayPoint, b: ReplayPoint): number {
  const earthRadiusMeters = 6_371_000
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const deltaLat = (b.lat - a.lat) * Math.PI / 180
  const deltaLng = (b.lng - a.lng) * Math.PI / 180
  const sinLat = Math.sin(deltaLat / 2)
  const sinLng = Math.sin(deltaLng / 2)
  const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export function batchDistanceMeters(batch: ReplayPoint[]): number {
  return batch.slice(1).reduce((distance, point, index) => distance + haversineDistanceMeters(batch[index], point), 0)
}

export function buildRecoveryTrajectory(currentPoint: ReplayPoint): ReplayPoint[] {
  return [
    currentPoint,
    { lat: currentPoint.lat, lng: currentPoint.lng + 0.00015 },
    { lat: currentPoint.lat + 0.00015, lng: currentPoint.lng + 0.00030 },
    { lat: currentPoint.lat + 0.00030, lng: currentPoint.lng + 0.00045 },
  ]
}

export function recoveryTrajectoryDistanceMeters(currentPoint: ReplayPoint): number {
  return batchDistanceMeters(buildRecoveryTrajectory(currentPoint))
}

export function buildLegacyHeartbeatPayload(pedidoId: string, currentPoint: ReplayPoint): { pedidoId: string; lat: number; lng: number } {
  return { pedidoId, lat: currentPoint.lat, lng: currentPoint.lng }
}

function routeDistanceMeters(points: ReplayPoint[]): number {
  return points.slice(1).reduce((distance, point, index) => distance + haversineDistanceMeters(points[index], point), 0)
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

interface PostLocationResult {
  status: number
  ok: boolean
  version: number | null
}

async function postLocation(baseUrl: string, fixture: Fixture, point: ReplayPoint, trajectory?: ReplayPoint[], batchNumber = 0): Promise<PostLocationResult> {
  const wireTrajectory = trajectory?.map((item, index) => ({ lat: item.lat, lng: item.lng, offsetMs: index * 450 }))
  const body = wireTrajectory
    ? { pedidoId: fixture.pedidoId, lat: point.lat, lng: point.lng, trajectory: wireTrajectory }
    : buildLegacyHeartbeatPayload(fixture.pedidoId, point)
  const sendTime = new Date().toISOString()
  const response = await fetch(`${baseUrl}/api/repartidor/ubicacion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
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
  return {
    status: response.status,
    ok: response.ok,
    version: typeof parsed.version === "number"
      ? parsed.version
      : typeof parsed.locationRevision === "number"
        ? parsed.locationRevision
        : null,
  }
}

async function fetchCurrentTrackingPoint(baseUrl: string, fixture: Fixture): Promise<CurrentTrackingPoint> {
  const response = await fetch(`${baseUrl}/api/pedidos/${fixture.pedidoId}/tracking`, {
    headers: { Cookie: `deligo_session=${fixture.clienteSession}` },
  })
  const responseText = await response.text()
  let parsed: Record<string, unknown> = {}
  try { parsed = JSON.parse(responseText) as Record<string, unknown> } catch { /* preserve raw status only */ }
  const lat = parsed.repartidorLat
  const lng = parsed.repartidorLng
  if (!response.ok || parsed.trackable !== true || typeof lat !== "number" || typeof lng !== "number") {
    fail(`tracking GET failed with HTTP ${response.status}`)
  }
  const version = typeof parsed.version === "number" ? parsed.version : null
  return { point: { lat, lng }, version }
}

async function runScenario(baseUrl: string, fixture: Fixture, scenario: Scenario): Promise<void> {
  if (scenario === "stale") {
    console.log("SCENARIO=stale");
    console.log("BATCHES_SENT=0");
    console.log("STALE_SCENARIO=operator-controlled pause; no state is falsified");
    return
  }
  if (scenario === "stationary") {
    const before = await fetchCurrentTrackingPoint(baseUrl, fixture)
    console.log(`POINT_BEFORE_STATIONARY=(${before.point.lat},${before.point.lng})`)
    console.log(`LAST_VERSION_BEFORE_STATIONARY=${before.version ?? "UNKNOWN"}`)
    await postLocation(baseUrl, fixture, before.point, undefined, 1)
    const after = await fetchCurrentTrackingPoint(baseUrl, fixture)
    console.log(`HEARTBEAT_SENT_POINT=(${before.point.lat},${before.point.lng})`)
    console.log(`POINT_AFTER_STATIONARY=(${after.point.lat},${after.point.lng})`)
    if (after.point.lat !== before.point.lat || after.point.lng !== before.point.lng) {
      fail("stationary heartbeat changed the current tracking point")
    }
    console.log("SCENARIO=stationary");
    console.log("TRAJECTORY_POSTS=0");
    return
  }
  if (scenario === "recovery-once") {
    const before = await fetchCurrentTrackingPoint(baseUrl, fixture)
    const trajectory = buildRecoveryTrajectory(before.point)
    const finalPoint = trajectory[trajectory.length - 1]
    console.log("RECOVERY_ORIGIN_SOURCE=GET_TRACKING_CURRENT_POINT")
    console.log(`SERVER_POINT_BEFORE_RECOVERY=(${before.point.lat},${before.point.lng})`)
    console.log(`LOCATION_REVISION_BEFORE_RECOVERY=${before.version ?? "UNKNOWN"}`)
    console.log(`RECOVERY_FIRST_POINT=(${trajectory[0].lat},${trajectory[0].lng})`)
    console.log(`RECOVERY_FINAL_POINT=(${finalPoint.lat},${finalPoint.lng})`)
    console.log(`RECOVERY_TRAJECTORY_POINT_COUNT=${trajectory.length}`)
    console.log(`RECOVERY_TOTAL_DISTANCE_M=${Math.round(recoveryTrajectoryDistanceMeters(before.point))}`)
    const posted = await postLocation(baseUrl, fixture, finalPoint, trajectory, 1)
    const after = await fetchCurrentTrackingPoint(baseUrl, fixture)
    console.log(`RECOVERY_POST_HTTP_STATUS=${posted.status}`)
    console.log(`RECOVERY_LOCATION_REVISION=${posted.version ?? after.version ?? "UNKNOWN"}`)
    console.log(`RECOVERY_FINAL_SERVER_POINT=(${after.point.lat},${after.point.lng})`)
    if (after.point.lat !== finalPoint.lat || after.point.lng !== finalPoint.lng) {
      fail("recovery final server point does not match trajectory final point")
    }
    console.log("RECOVERY_POST_COUNT=1")
    console.log("RECOVERY_ONCE_EXECUTED=SI")
    return
  }

  const route = routeFor(scenario)
  if (scenario === "route-to-destination") {
    await postLocation(baseUrl, fixture, route[0], undefined, 0)
    console.log("RESET_TO_ROUTE_START=PASS")
  }
  const batches = buildBatches(route, scenario === "route-to-destination" ? ROUTE_TO_DESTINATION_BATCH_SIZE : 4)
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index]
    await postLocation(baseUrl, fixture, batch[batch.length - 1], batch, index + 1)
    if (index < batches.length - 1) {
      const interval = scenario === "route-to-destination" ? ROUTE_TO_DESTINATION_BATCH_INTERVAL_MS : 1_000
      await new Promise((resolve) => setTimeout(resolve, interval))
    }
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
    if (scenario === "route-to-destination") {
      const route = routeFor(scenario)
      const batches = buildBatches(route, ROUTE_TO_DESTINATION_BATCH_SIZE)
      console.log("HARNESS_ROUTE_SOURCE=OSRM_ROUTE_GEOMETRY")
      console.log(`ROUTE_DISTANCE_M=${Math.round(routeDistanceMeters(route))}`)
      console.log(`TOTAL_BATCHES=${batches.length}`)
      console.log(`NUMBER_OF_CLEAR_TURNS=${ROUTE_TO_DESTINATION_TURNS.length}`)
      console.log(`TURN_INDICES=${ROUTE_TO_DESTINATION_TURNS.map((turn) => turn.pointIndex).join(",")}`)
      console.log(`ROUTE_START=(${route[0].lat},${route[0].lng})`)
      console.log(`ROUTE_END=(${route.at(-1)!.lat},${route.at(-1)!.lng})`)
      console.log(`FINAL_POINT_DISTANCE_TO_DESTINATION_M=${Math.round(haversineDistanceMeters(route.at(-1)!, ROUTE_TO_DESTINATION_DESTINATION))}`)
      console.log(`MAX_BATCH_POINTS=${Math.max(...batches.map((batch) => batch.length))}`)
      console.log(`MAX_BATCH_DISTANCE_M=${Math.ceil(Math.max(...batches.map(batchDistanceMeters)))}`)
      console.log("MAX_BATCH_DURATION_MS=1350")
      console.log(`ESTIMATED_REPLAY_DURATION_SECONDS=${((batches.length - 1) * ROUTE_TO_DESTINATION_BATCH_INTERVAL_MS + 4_000) / 1_000}`)
      console.log("ROUTE_TO_DESTINATION_READY=SI")
      console.log("ROUTE_TO_DESTINATION_EXECUTED=NO")
    }
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

if (import.meta.main) {
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}
