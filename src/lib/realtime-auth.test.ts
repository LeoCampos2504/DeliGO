import { beforeEach, describe, expect, test } from "bun:test"
import {
  issueRoomCapability,
  issueSocketActorToken,
  verifyRoomCapability,
  verifySocketActorToken,
} from "@/lib/realtime-auth"

const session = { userId: "cliente-a", userType: "cliente" as const, sessionId: "session-a" }

function decodeSignature(token: string): Buffer {
  const signature = token.split(".")[2]
  return Buffer.from(signature, "base64url")
}

// Test-only deterministic JWT signature tamper: changes the FIRST
// character of the signature segment, which always carries 6 fully
// meaningful bits. This is unlike the LAST character of a 32-byte HS256
// signature, whose 2 low bits are unused base64url padding — mutating
// that position can, for roughly 1 in 16 signatures, produce a
// different token string that still decodes to the SAME signature
// bytes, making verification pass and the test flake. Mutating the
// first character instead guarantees a different decoded byte on every
// call, deterministically, on the first attempt.
function tamperJwtSignature(token: string): string {
  const parts = token.split(".")
  if (parts.length !== 3) throw new Error("Expected a 3-segment JWT")
  const [header, payload, signature] = parts
  if (signature.length === 0) throw new Error("Expected a non-empty JWT signature")
  const first = signature[0]
  const replacement = first === "A" ? "B" : "A"
  const tamperedSignature = replacement + signature.slice(1)
  return `${header}.${payload}.${tamperedSignature}`
}

beforeEach(() => {
  process.env.REALTIME_SOCKET_TOKEN_SECRET = "test-only-realtime-secret-01234567890123456789"
  process.env.REALTIME_KEY_ID = "testing-key"
})

describe("realtime signed credentials", () => {
  test("issues and verifies the minimum actor claims", async () => {
    const token = await issueSocketActorToken(session)
    const claims = await verifySocketActorToken(token)
    expect(claims.kind).toBe("socket-actor")
    expect(claims.sub).toBe("cliente-a")
    expect(claims.userType).toBe("cliente")
    expect(claims.sid).toBe("session-a")
    expect(claims.scopes).toEqual([])
    expect(claims.exp! - claims.iat!).toBe(120)
  })

  test("rejects tampered and expired actor tokens", async () => {
    const token = await issueSocketActorToken(session)
    const tampered = tamperJwtSignature(token)
    expect(tampered).not.toBe(token)
    const originalSignatureBytes = decodeSignature(token)
    const tamperedSignatureBytes = decodeSignature(tampered)
    expect(tamperedSignatureBytes.length).toBe(originalSignatureBytes.length)
    expect(tamperedSignatureBytes.equals(originalSignatureBytes)).toBe(false)
    await expect(verifySocketActorToken(tampered)).rejects.toThrow()

    const expired = await issueSocketActorToken({ ...session, expiresIn: -1 })
    await expect(verifySocketActorToken(expired)).rejects.toThrow()
  })

  test("binds a room capability to actor, room and exact scopes", async () => {
    const token = await issueRoomCapability({
      ...session,
      pedidoId: "pedido-a",
      scopes: ["chat:read", "chat:typing"],
    })
    const claims = await verifyRoomCapability(token)
    expect(claims.kind).toBe("room-capability")
    expect(claims.room).toBe("pedido:pedido-a")
    expect(claims.pedidoId).toBe("pedido-a")
    expect(claims.scopes).toEqual(["chat:read", "chat:typing"])
    expect(claims.exp! - claims.iat!).toBe(120)

    const tamperedCapability = tamperJwtSignature(token)
    expect(tamperedCapability).not.toBe(token)
    const originalSignatureBytes = decodeSignature(token)
    const tamperedSignatureBytes = decodeSignature(tamperedCapability)
    expect(tamperedSignatureBytes.length).toBe(originalSignatureBytes.length)
    expect(tamperedSignatureBytes.equals(originalSignatureBytes)).toBe(false)
    await expect(verifyRoomCapability(tamperedCapability)).rejects.toThrow()
  })
})
