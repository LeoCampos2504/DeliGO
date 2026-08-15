import { beforeEach, describe, expect, test } from "bun:test"
import {
  issueRoomCapability,
  issueSocketActorToken,
  verifyRoomCapability,
  verifySocketActorToken,
} from "@/lib/realtime-auth"

const session = { userId: "cliente-a", userType: "cliente" as const, sessionId: "session-a" }

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
    expect(claims.exp! - claims.iat!).toBe(300)
  })

  test("rejects tampered and expired actor tokens", async () => {
    const token = await issueSocketActorToken(session)
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`
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
  })
})
