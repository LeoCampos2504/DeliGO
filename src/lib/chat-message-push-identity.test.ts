import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { chatMessageNotification } from "@/lib/push"

// Unit-level proof that chatMessageNotification's new `messageId` parameter
// is optional and additive (D2). Source-level assertions below prove the
// two real customer<->negocio Chat call sites now pass `mensaje.id`, while
// the three PyR (Preguntas y Respuestas) call sites remain completely
// untouched — this test file must never grow assertions about other Push
// types/factories; that is out of scope for D2.

describe("chatMessageNotification — optional messageId (D2)", () => {
  test("without messageId: payload has no data.messageId field at all", () => {
    const payload = chatMessageNotification("pedido-1", "Juan", "hola")
    expect(payload.data?.messageId).toBeUndefined()
    expect(payload.data && "messageId" in payload.data).toBe(false)
  })

  test("with messageId: payload carries the exact id in data.messageId", () => {
    const payload = chatMessageNotification("pedido-1", "Juan", "hola", "mensaje-abc")
    expect(payload.data?.messageId).toBe("mensaje-abc")
  })

  test("existing title/body/tag/type/pedidoId shape is unchanged either way", () => {
    const withoutId = chatMessageNotification("pedido-1", "Juan", "hola mundo")
    const withId = chatMessageNotification("pedido-1", "Juan", "hola mundo", "m-1")
    for (const payload of [withoutId, withId]) {
      expect(payload.title).toBe("Mensaje de Juan")
      expect(payload.body).toBe("hola mundo")
      expect(payload.tag).toBe("chat-pedido-1")
      expect(payload.data?.type).toBe("chat")
      expect(payload.data?.pedidoId).toBe("pedido-1")
    }
  })

  test("body is still truncated to 100 chars regardless of messageId", () => {
    const longText = "x".repeat(250)
    const payload = chatMessageNotification("pedido-1", "Juan", longText, "m-1")
    expect(payload.body.length).toBe(100)
  })
})

describe("chatMessageNotification call sites — D2 identity wiring scope", () => {
  const routeSource = () =>
    readFileSync(
      resolve(import.meta.dir, "..", "app", "api", "chat", "mensajes", "[pedidoId]", "route.ts"),
      "utf8",
    )

  test("both real Chat call sites pass mensaje.id as the 4th argument", () => {
    const source = routeSource()
    const matches = source.match(/chatMessageNotification\(pedidoId, senderName, messagePreview, mensaje\.id\)/g)
    expect(matches).not.toBeNull()
    expect(matches?.length).toBe(2)
  })

  test("no remaining 3-arg chatMessageNotification call in this file", () => {
    const source = routeSource()
    expect(source).not.toContain("chatMessageNotification(pedidoId, senderName, messagePreview)\n")
  })

  const pyrCallSites: Array<{ file: string[]; expectedCall: string }> = [
    {
      file: ["..", "app", "api", "operativo", "pyr", "pedidos", "[id]", "mensajes", "route.ts"],
      expectedCall: "chatMessageNotification(pedidoId, created.negocioNombre, texto.slice(0, 100))",
    },
    {
      file: ["..", "app", "api", "operaciones", "pyr", "mensajes", "[pedidoId]", "route.ts"],
      expectedCall: "chatMessageNotification(pedidoId, created.negocioNombre, texto.slice(0, 100))",
    },
    {
      file: ["..", "app", "api", "operaciones", "pyr", "mensajes", "[pedidoId]", "adjunto", "route.ts"],
      expectedCall: "chatMessageNotification(pedidoId, created.negocioNombre, preview)",
    },
  ]

  test.each(pyrCallSites)(
    "PyR call site in $file remains untouched (3 args, no messageId)",
    ({ file, expectedCall }) => {
      const source = readFileSync(resolve(import.meta.dir, ...file), "utf8")
      expect(source).toContain(expectedCall)
    },
  )
})
