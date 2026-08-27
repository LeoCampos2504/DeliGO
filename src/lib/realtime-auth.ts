import { randomUUID } from "crypto"
import { jwtVerify, SignJWT, type JWTPayload } from "jose"
import type { RealtimeScope, RealtimeUserType } from "@/lib/realtime-policy"

export const REALTIME_ISSUER = "deligo-next"
export const REALTIME_AUDIENCE = "deligo-chat-service"
export const SOCKET_TOKEN_TTL_SECONDS = 2 * 60
export const ROOM_CAPABILITY_TTL_SECONDS = 2 * 60

export interface SocketActorClaims extends JWTPayload {
  kind: "socket-actor"
  sub: string
  userType: RealtimeUserType
  scopes: RealtimeScope[]
  sid: string
  jti: string
}

export interface RoomCapabilityClaims extends JWTPayload {
  kind: "room-capability"
  sub: string
  userType: RealtimeUserType
  scopes: RealtimeScope[]
  sid: string
  jti: string
  pedidoId: string
  room: `pedido:${string}`
}

function getSecret(): Uint8Array {
  const secret = process.env.REALTIME_SOCKET_TOKEN_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error("REALTIME_SOCKET_TOKEN_SECRET is missing or too short")
  }
  return new TextEncoder().encode(secret)
}

function getHeader(): { alg: "HS256"; kid?: string } {
  const keyId = process.env.REALTIME_KEY_ID?.trim()
  return keyId ? { alg: "HS256", kid: keyId } : { alg: "HS256" }
}

function assertStringClaim(payload: JWTPayload, name: string): string {
  const value = payload[name]
  if (typeof value !== "string" || !value) throw new Error(`Invalid realtime claim: ${name}`)
  return value
}

function assertScopes(payload: JWTPayload): RealtimeScope[] {
  if (!Array.isArray(payload.scopes) || payload.scopes.some((scope) => typeof scope !== "string")) {
    throw new Error("Invalid realtime scopes")
  }
  return payload.scopes as RealtimeScope[]
}

function assertCommonClaims(payload: JWTPayload, expectedKind: string): void {
  if (payload.kind !== expectedKind) throw new Error("Invalid realtime token kind")
  if (payload.iss !== REALTIME_ISSUER || payload.aud !== REALTIME_AUDIENCE) {
    throw new Error("Invalid realtime issuer or audience")
  }
  assertStringClaim(payload, "sub")
  assertStringClaim(payload, "userType")
  assertStringClaim(payload, "sid")
  assertStringClaim(payload, "jti")
  assertScopes(payload)
}

async function signClaims(
  claims: Record<string, unknown>,
  ttlSeconds: number,
  options?: { expiresIn?: number }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const builder = new SignJWT(claims)
    .setProtectedHeader(getHeader())
    .setIssuer(REALTIME_ISSUER)
    .setAudience(REALTIME_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(now + (options?.expiresIn ?? ttlSeconds))
    .setJti(typeof claims.jti === "string" ? claims.jti : randomUUID())

  return builder.sign(getSecret())
}

export async function issueSocketActorToken(input: {
  userId: string
  userType: RealtimeUserType
  sessionId: string
  scopes?: RealtimeScope[]
  expiresIn?: number
}): Promise<string> {
  return signClaims(
    {
      kind: "socket-actor",
      sub: input.userId,
      userType: input.userType,
      scopes: input.scopes ?? [],
      sid: input.sessionId,
      jti: randomUUID(),
    },
    SOCKET_TOKEN_TTL_SECONDS,
    { expiresIn: input.expiresIn }
  )
}

export async function issueRoomCapability(input: {
  userId: string
  userType: RealtimeUserType
  sessionId: string
  pedidoId: string
  scopes: RealtimeScope[]
  expiresIn?: number
}): Promise<string> {
  return signClaims(
    {
      kind: "room-capability",
      sub: input.userId,
      userType: input.userType,
      scopes: input.scopes,
      sid: input.sessionId,
      jti: randomUUID(),
      pedidoId: input.pedidoId,
      room: `pedido:${input.pedidoId}`,
    },
    ROOM_CAPABILITY_TTL_SECONDS,
    { expiresIn: input.expiresIn }
  )
}

async function verifyToken(token: string): Promise<JWTPayload> {
  if (typeof token !== "string" || token.length < 32 || token.length > 4096) {
    throw new Error("Invalid realtime token")
  }

  const { payload, protectedHeader } = await jwtVerify(token, getSecret(), {
    algorithms: ["HS256"],
    issuer: REALTIME_ISSUER,
    audience: REALTIME_AUDIENCE,
  })
  const configuredKeyId = process.env.REALTIME_KEY_ID?.trim()
  if (configuredKeyId && protectedHeader.kid !== configuredKeyId) {
    throw new Error("Invalid realtime key id")
  }
  return payload
}

export async function verifySocketActorToken(token: string): Promise<SocketActorClaims> {
  const payload = await verifyToken(token)
  assertCommonClaims(payload, "socket-actor")
  return payload as SocketActorClaims
}

export async function verifyRoomCapability(token: string): Promise<RoomCapabilityClaims> {
  const payload = await verifyToken(token)
  assertCommonClaims(payload, "room-capability")
  const pedidoId = assertStringClaim(payload, "pedidoId")
  const room = assertStringClaim(payload, "room")
  if (room !== `pedido:${pedidoId}`) throw new Error("Invalid realtime room")
  return payload as RoomCapabilityClaims
}
