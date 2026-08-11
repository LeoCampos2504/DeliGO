/// <reference types="bun-types" />

// ============================================
// 19-B0.2D1 — chat-attachment-deletion: funciones puras
// ============================================
// Cubre resolución de targets (Cloudinary/local, válidos e inválidos) y la
// máscara de lectura defensiva — sin tocar DB ni red. Los tests que sí
// requieren DB (outbox real: crear/procesar/reintentar jobs) están en
// `client-account-deletion.integration.test.ts`.

import { describe, expect, test } from "bun:test"
import {
  DELETED_CLIENT_CHAT_MESSAGE_TEXT,
  resolveChatAttachmentDeletionTargets,
  sanitizeDeletedClientChatMessageForRead,
} from "./chat-attachment-deletion"

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "demo"
const PEDIDO_ID = "test-pedido-abc123"

describe("19-B0.2D1 — DELETED_CLIENT_CHAT_MESSAGE_TEXT", () => {
  test("es exactamente el sentinel oficial", () => {
    expect(DELETED_CLIENT_CHAT_MESSAGE_TEXT).toBe("Mensaje no disponible")
  })
})

describe("19-B0.2D1 — resolveChatAttachmentDeletionTargets: Cloudinary válido", () => {
  test("imagenUrl Cloudinary válida -> target { provider: cloudinary, resourceType: image }", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1700000000/chat/${PEDIDO_ID}/foto.jpg`,
      archivoUrl: null,
    })
    expect(targets).toEqual([
      { provider: "cloudinary", resourceType: "image", identifier: `chat/${PEDIDO_ID}/foto` },
    ])
  })

  test("archivoUrl PDF Cloudinary válida -> target { provider: cloudinary, resourceType: raw }", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: null,
      archivoUrl: `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/v1700000000/chat/${PEDIDO_ID}/comprobante_123.pdf`,
    })
    expect(targets).toEqual([
      { provider: "cloudinary", resourceType: "raw", identifier: `chat/${PEDIDO_ID}/comprobante_123` },
    ])
  })

  test("mensaje con imagen Y archivo -> resuelve ambos targets", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1/chat/${PEDIDO_ID}/img.png`,
      archivoUrl: `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/v1/chat/${PEDIDO_ID}/doc.pdf`,
    })
    expect(targets).toHaveLength(2)
    expect(targets).toContainEqual({ provider: "cloudinary", resourceType: "image", identifier: `chat/${PEDIDO_ID}/img` })
    expect(targets).toContainEqual({ provider: "cloudinary", resourceType: "raw", identifier: `chat/${PEDIDO_ID}/doc` })
  })
})

describe("19-B0.2D1 — resolveChatAttachmentDeletionTargets: Cloudinary rechazado", () => {
  test("host no-Cloudinary -> sin target", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: `https://evil.example.com/${CLOUD_NAME}/image/upload/v1/chat/${PEDIDO_ID}/foto.jpg`,
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })

  test("carpeta ajena a chat/<pedidoId> -> sin target (asset de otra entidad, ej. logo)", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1/logos/otro-negocio/logo.jpg`,
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })

  test("carpeta chat/ de OTRO pedido -> sin target (nunca cruza pedidos)", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1/chat/otro-pedido-999/foto.jpg`,
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })

  test("path traversal (..) -> sin target", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1/chat/${PEDIDO_ID}/../../secret.jpg`,
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })

  test("URL malformada -> sin target, nunca lanza", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: "no-es-una-url",
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })

  test("extensión no permitida -> sin target", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v1/chat/${PEDIDO_ID}/script.exe`,
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })
})

describe("19-B0.2D1 — resolveChatAttachmentDeletionTargets: local válido", () => {
  test("path local bajo /uploads/chat/<pedidoId>/ -> target { provider: local, resourceType: file }", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: `/uploads/chat/${PEDIDO_ID}/1700000000_ab12cd.jpg`,
      archivoUrl: null,
    })
    expect(targets).toEqual([
      { provider: "local", resourceType: "file", identifier: `uploads/chat/${PEDIDO_ID}/1700000000_ab12cd.jpg` },
    ])
  })
})

describe("19-B0.2D1 — resolveChatAttachmentDeletionTargets: local rechazado", () => {
  test("path traversal (..) -> sin target", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: `/uploads/chat/${PEDIDO_ID}/../../../etc/passwd`,
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })

  test("backslash -> sin target", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: `/uploads/chat/${PEDIDO_ID}\\..\\secret.jpg`,
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })

  test("carpeta ajena (no uploads/chat) -> sin target", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: "/uploads/productos/otro-negocio/logo.jpg",
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })

  test("path absoluto de filesystem (no bajo /uploads/) -> sin target", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: "C:/Windows/System32/config.jpg",
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })

  test("path de OTRO pedido -> sin target", () => {
    const targets = resolveChatAttachmentDeletionTargets({
      pedidoId: PEDIDO_ID,
      imagenUrl: "/uploads/chat/otro-pedido-999/foto.jpg",
      archivoUrl: null,
    })
    expect(targets).toEqual([])
  })
})

describe("19-B0.2D1 — resolveChatAttachmentDeletionTargets: sin adjuntos", () => {
  test("mensaje sin imagenUrl ni archivoUrl -> lista vacía", () => {
    expect(resolveChatAttachmentDeletionTargets({ pedidoId: PEDIDO_ID, imagenUrl: null, archivoUrl: null })).toEqual([])
  })
})

describe("19-B0.2D1 — sanitizeDeletedClientChatMessageForRead", () => {
  test("mensaje de Cliente eliminado (remitente=cliente, clienteId=null) -> se enmascara", () => {
    const result = sanitizeDeletedClientChatMessageForRead({
      remitente: "cliente",
      clienteId: null,
      texto: "PII_SENTINEL_SHOULD_NOT_LEAK",
      imagenUrl: "https://res.cloudinary.com/demo/image/upload/v1/chat/p/foto.jpg",
      archivoUrl: null,
      archivoNombre: "documento_original.pdf",
      archivoTipo: "application/pdf",
    })
    expect(result.texto).toBe(DELETED_CLIENT_CHAT_MESSAGE_TEXT)
    expect(result.imagenUrl).toBeNull()
    expect(result.archivoUrl).toBeNull()
    expect(result.archivoNombre).toBeNull()
    expect(result.archivoTipo).toBeNull()
    expect(JSON.stringify(result)).not.toContain("PII_SENTINEL_SHOULD_NOT_LEAK")
    expect(JSON.stringify(result)).not.toContain("documento_original.pdf")
  })

  test("mensaje de Cliente ACTIVO (clienteId real) -> se devuelve sin cambios", () => {
    const original = {
      remitente: "cliente",
      clienteId: "cliente-real-123",
      texto: "hola, todo bien",
      imagenUrl: null,
      archivoUrl: null,
    }
    expect(sanitizeDeletedClientChatMessageForRead(original)).toEqual(original)
  })

  test("mensaje de vendedor con clienteId=null (nunca debería tener PII, pero igual no se enmascara — no es 'cliente')", () => {
    const original = {
      remitente: "vendedor",
      clienteId: null,
      texto: "tu pedido está en camino",
      imagenUrl: null,
      archivoUrl: null,
    }
    expect(sanitizeDeletedClientChatMessageForRead(original)).toEqual(original)
  })
})
