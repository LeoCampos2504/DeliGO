// P2-T40-R1 — unit tests for the signed, short-lived push-owner handoff.
// Same jose HS256 pattern already certified for google-oauth-pending.ts;
// these tests focus on what T40-A1 explicitly required: never forgeable,
// never usable past its TTL, and a missing secret must degrade to "no
// handoff" rather than crashing the login flow.
import { beforeEach, describe, expect, test } from "bun:test"

const TEST_SECRET = "a".repeat(32)

describe("push-owner-handoff", () => {
  beforeEach(() => {
    process.env.PUSH_OWNER_HANDOFF_SECRET = TEST_SECRET
  })

  test("sign then verify round-trips the exact claims", async () => {
    const { signPushOwnerHandoff, verifyPushOwnerHandoff } = await import("./push-owner-handoff")
    const token = await signPushOwnerHandoff({
      family: "cliente",
      prevOwnerType: "cliente",
      prevOwnerId: "cliente-A",
    })
    expect(token).not.toBeNull()

    const claims = await verifyPushOwnerHandoff(token ?? undefined)
    expect(claims?.family).toBe("cliente")
    expect(claims?.prevOwnerType).toBe("cliente")
    expect(claims?.prevOwnerId).toBe("cliente-A")
  })

  test("prevOwner null round-trips (newSession signal with nothing to clean up)", async () => {
    const { signPushOwnerHandoff, verifyPushOwnerHandoff } = await import("./push-owner-handoff")
    const token = await signPushOwnerHandoff({ family: "cuenta_operativa", prevOwnerType: null, prevOwnerId: null })
    const claims = await verifyPushOwnerHandoff(token ?? undefined)
    expect(claims?.family).toBe("cuenta_operativa")
    expect(claims?.prevOwnerType).toBeNull()
    expect(claims?.prevOwnerId).toBeNull()
  })

  test("a token signed with a different secret never verifies (not forgeable)", async () => {
    const { signPushOwnerHandoff } = await import("./push-owner-handoff")
    const token = await signPushOwnerHandoff({ family: "cliente", prevOwnerType: "cliente", prevOwnerId: "x" })

    process.env.PUSH_OWNER_HANDOFF_SECRET = "b".repeat(32)
    const { verifyPushOwnerHandoff } = await import("./push-owner-handoff")
    const claims = await verifyPushOwnerHandoff(token ?? undefined)
    expect(claims).toBeNull()
  })

  test("a tampered token (payload bit-flipped) never verifies", async () => {
    const { signPushOwnerHandoff, verifyPushOwnerHandoff } = await import("./push-owner-handoff")
    const token = await signPushOwnerHandoff({ family: "cliente", prevOwnerType: "cliente", prevOwnerId: "x" })
    expect(token).not.toBeNull()
    const parts = (token as string).split(".")
    // Flip a character in the payload segment — the signature no longer matches.
    parts[1] = parts[1].slice(0, -1) + (parts[1].endsWith("A") ? "B" : "A")
    const tampered = parts.join(".")
    const claims = await verifyPushOwnerHandoff(tampered)
    expect(claims).toBeNull()
  })

  test("missing secret: sign returns null, never throws (login must not be blocked)", async () => {
    delete process.env.PUSH_OWNER_HANDOFF_SECRET
    const { signPushOwnerHandoff } = await import("./push-owner-handoff")
    const token = await signPushOwnerHandoff({ family: "cliente", prevOwnerType: "cliente", prevOwnerId: "x" })
    expect(token).toBeNull()
  })

  test("missing secret at verify time: resolves null, never throws", async () => {
    const { signPushOwnerHandoff } = await import("./push-owner-handoff")
    const token = await signPushOwnerHandoff({ family: "cliente", prevOwnerType: "cliente", prevOwnerId: "x" })

    delete process.env.PUSH_OWNER_HANDOFF_SECRET
    const { verifyPushOwnerHandoff } = await import("./push-owner-handoff")
    const claims = await verifyPushOwnerHandoff(token ?? undefined)
    expect(claims).toBeNull()
  })

  test("undefined/garbage input never verifies and never throws", async () => {
    const { verifyPushOwnerHandoff } = await import("./push-owner-handoff")
    expect(await verifyPushOwnerHandoff(undefined)).toBeNull()
    expect(await verifyPushOwnerHandoff("")).toBeNull()
    expect(await verifyPushOwnerHandoff("not-a-jwt")).toBeNull()
  })

  test("an expired handoff never verifies", async () => {
    const jose = await import("jose")
    const secret = new TextEncoder().encode(TEST_SECRET)
    const now = Math.floor(Date.now() / 1000)
    const expired = await new jose.SignJWT({
      kind: "push-owner-handoff",
      family: "cliente",
      prevOwnerType: "cliente",
      prevOwnerId: "x",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("deligo-push-owner-handoff")
      .setAudience("deligo-push-owner-handoff")
      .setIssuedAt(now - 300)
      .setExpirationTime(now - 60)
      .sign(secret)

    const { verifyPushOwnerHandoff } = await import("./push-owner-handoff")
    expect(await verifyPushOwnerHandoff(expired)).toBeNull()
  })
})
