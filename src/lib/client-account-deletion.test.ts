/// <reference types="bun-types" />

import { Prisma } from "@prisma/client"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import {
  ANONYMIZED_REVIEW_CLIENT_NAME,
  CLIENT_ACCOUNT_DELETION_MAX_ATTEMPTS,
  CLIENT_ACCOUNT_DELETION_TERMINAL_STATES,
  ClientAccountDeletionConflictError,
  ClientHasActiveOrdersError,
  deleteClientAccountInTransaction,
  isPedidoTerminalForClientAccountDeletion,
  retryClientAccountDeletion,
} from "./client-account-deletion"
import { DELETED_CLIENT_CHAT_MESSAGE_TEXT } from "./chat-attachment-deletion"

// Mock base compartido de `tx` para los describe blocks B0/B0.2B0/B0.2B1/C
// preexistentes: ninguno de esos tests ejercita mensajes con adjunto, así
// que `chatMensaje.findMany` siempre resuelve `[]` y
// `chatAttachmentDeletionJob.createMany` nunca llega a invocarse
// (`queueChatAttachmentDeletionJobs` corta antes si `targets.length === 0`).
function baseChatMocks(calls: Array<{ model: string; operation: string; args?: unknown }>) {
  return {
    chatMensaje: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "chatMensaje", operation: "findMany", args })
        return []
      },
      updateMany: async (args?: unknown) => {
        calls.push({ model: "chatMensaje", operation: "updateMany", args })
        return { count: 0 }
      },
    },
    chatAttachmentDeletionJob: {
      createMany: async (args?: unknown) => {
        calls.push({ model: "chatAttachmentDeletionJob", operation: "createMany", args })
        return { count: 0 }
      },
    },
  }
}

const ROOT = process.cwd()
const read = (relativePath: string) =>
  readFileSync(join(ROOT, ...relativePath.split("/")), "utf8").replace(/\r\n/g, "\n")
const migrationPath = "prisma/migrations/20260807010000_preserve_reviews_on_client_deletion/migration.sql"

function serializationConflict() {
  return new Prisma.PrismaClientKnownRequestError("serializable test conflict", {
    code: "P2034",
    clientVersion: Prisma.prismaVersion.client,
  })
}

function clientAlreadyDeletedConflict() {
  return new Prisma.PrismaClientKnownRequestError("client already deleted test conflict", {
    code: "P2025",
    clientVersion: Prisma.prismaVersion.client,
  })
}

describe("19-B0.1 — schema y migración estáticos", () => {
  const schema = read("prisma/schema.prisma")
  const migration = read(migrationPath)

  test("Resena permite desvincular Cliente sin alterar pedido ni expediente", () => {
    expect(schema).toContain("clienteId        String?")
    expect(schema).toContain("cliente             Cliente?                   @relation(fields: [clienteId], references: [id], onDelete: SetNull)")
    expect(schema).toContain("pedidoId         String    @unique")
    expect(schema).toContain("@@unique([id, negocioId])")
    expect(schema).toContain("fields: [resenaId, negocioId], references: [id, negocioId], onDelete: Restrict")
  })

  test("la migración cambia solo la FK Cliente/Resena y la nulabilidad", () => {
    expect(migration).toContain('ALTER TABLE "resenas" DROP CONSTRAINT "resenas_clienteId_fkey"')
    expect(migration).toContain('ALTER TABLE "resenas" ALTER COLUMN "clienteId" DROP NOT NULL')
    expect(migration).toContain('FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE')
    expect(migration).not.toMatch(/DROP\s+TABLE/i)
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(migration).not.toMatch(/\bTRUNCATE\b/i)
    expect(migration).not.toContain("solicitudes_revision_resena_resenaId_negocioId_fkey")
    expect(migration).not.toContain("pedidoId")
    expect(migration).not.toContain("estadoModeracion")
  })
})

describe("19-B0.1 — core de eliminación de cuenta", () => {
  test("anonimiza reseñas antes de desvincular y borrar la cuenta", async () => {
    const calls: Array<{ model: string; operation: string; args: unknown }> = []
    const operation = (model: string, name: string) => async (args: unknown) => {
      calls.push({ model, operation: name, args })
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena", "updateMany") },
      pedido: {
        findFirst: async (args: unknown) => {
          calls.push({ model: "pedido", operation: "findFirst", args })
          return null
        },
        updateMany: operation("pedido", "updateMany"),
      },
      ...baseChatMocks(calls),
      passwordResetToken: { deleteMany: operation("passwordResetToken", "deleteMany") },
      denuncia: { updateMany: operation("denuncia", "updateMany") },
      favorito: { deleteMany: operation("favorito", "deleteMany") },
      direccion: { deleteMany: operation("direccion", "deleteMany") },
      cliente: { delete: operation("cliente", "delete") },
    } as unknown as Prisma.TransactionClient

    await deleteClientAccountInTransaction(tx, "cliente-test")

    expect(calls.map(({ model, operation }) => `${model}.${operation}`)).toEqual([
      "pedido.findFirst",
      "resena.updateMany",
      "pedido.updateMany",
      "chatMensaje.findMany",
      "chatMensaje.updateMany",
      "chatMensaje.updateMany",
      "passwordResetToken.deleteMany",
      "denuncia.updateMany",
      "favorito.deleteMany",
      "direccion.deleteMany",
      "cliente.delete",
    ])
    expect(calls[0].args).toEqual({
      where: { clienteId: "cliente-test", estado: { notIn: ["entregado", "cancelado"] } },
      select: { id: true },
    })
    expect(calls[1].args).toEqual({
      where: { clienteId: "cliente-test" },
      data: { clienteId: null, clienteNombre: ANONYMIZED_REVIEW_CLIENT_NAME },
    })
    expect(calls[2].args).toEqual({
      where: { clienteId: "cliente-test" },
      data: {
        clienteId: null,
        clienteNombre: ANONYMIZED_REVIEW_CLIENT_NAME,
        clienteTelefono: "",
        direccion: null,
        referencia: null,
        lat: null,
        lng: null,
        notas: null,
      },
    })
    expect(calls[6].args).toEqual({
      where: { userId: "cliente-test", userType: "cliente" },
    })
    expect(calls[7].args).toEqual({
      where: { clienteId: "cliente-test" },
      data: { clienteId: null, clienteNombre: ANONYMIZED_REVIEW_CLIENT_NAME },
    })
  })

  test("reintenta P2034 acotadamente y clasifica el agotamiento como conflicto", async () => {
    let attempts = 0
    await expect(
      retryClientAccountDeletion(async () => {
        attempts += 1
        if (attempts < CLIENT_ACCOUNT_DELETION_MAX_ATTEMPTS) throw serializationConflict()
        return "ok"
      }),
    ).resolves.toBe("ok")
    expect(attempts).toBe(CLIENT_ACCOUNT_DELETION_MAX_ATTEMPTS)

    attempts = 0
    await expect(
      retryClientAccountDeletion(async () => {
        attempts += 1
        throw serializationConflict()
      }),
    ).rejects.toBeInstanceOf(ClientAccountDeletionConflictError)
    expect(attempts).toBe(CLIENT_ACCOUNT_DELETION_MAX_ATTEMPTS)
  })

  test("clasifica P2025 solo en el delete final y no lo reintenta", async () => {
    const operation = async () => ({ count: 1 })
    const tx = {
      resena: { updateMany: operation },
      pedido: { findFirst: async () => null, updateMany: operation },
      chatMensaje: { findMany: async () => [], updateMany: operation },
      chatAttachmentDeletionJob: { createMany: operation },
      passwordResetToken: { deleteMany: operation },
      denuncia: { updateMany: operation },
      favorito: { deleteMany: operation },
      direccion: { deleteMany: operation },
      cliente: { delete: async () => { throw clientAlreadyDeletedConflict() } },
    } as unknown as Prisma.TransactionClient

    await expect(deleteClientAccountInTransaction(tx, "cliente-test")).rejects.toBeInstanceOf(
      ClientAccountDeletionConflictError,
    )

    let attempts = 0
    await expect(
      retryClientAccountDeletion(async () => {
        attempts += 1
        throw new ClientAccountDeletionConflictError()
      }),
    ).rejects.toBeInstanceOf(ClientAccountDeletionConflictError)
    expect(attempts).toBe(1)
  })

  test("la ruta usa el core y no borra físicamente reseñas", () => {
    const route = read("src/app/api/cliente/cuenta/route.ts")
    expect(route).toContain(
      'import {\n  ClientAccountDeletionConflictError,\n  ClientHasActiveOrdersError,\n  deleteClientAccount,\n} from "@/lib/client-account-deletion"',
    )
    expect(route).toContain("await deleteClientAccount(clienteId)")
    expect(route).not.toContain("resena.deleteMany")
    expect(route).toContain("ClientAccountDeletionConflictError")
    expect(route).toContain("status: 409")
  })
})

describe("19-B0.2B0 — terminalidad de Pedido para el guard de eliminación", () => {
  test("CLIENT_ACCOUNT_DELETION_TERMINAL_STATES es exactamente entregado y cancelado", () => {
    expect([...CLIENT_ACCOUNT_DELETION_TERMINAL_STATES]).toEqual(["entregado", "cancelado"])
  })

  test("entregado y cancelado son terminales", () => {
    expect(isPedidoTerminalForClientAccountDeletion("entregado")).toBe(true)
    expect(isPedidoTerminalForClientAccountDeletion("cancelado")).toBe(true)
  })

  test("todo estado no terminal (incluido uno desconocido/futuro) bloquea por defecto", () => {
    for (const estado of [
      "recibido",
      "preparando",
      "en_camino",
      "listo_para_retirar",
      "confirmado",
      "un-estado-futuro-desconocido",
    ]) {
      expect(isPedidoTerminalForClientAccountDeletion(estado)).toBe(false)
    }
  })

  test("la ruta mapea ClientHasActiveOrdersError a 409 con code CLIENT_HAS_ACTIVE_ORDERS y mensaje sin PII", () => {
    const route = read("src/app/api/cliente/cuenta/route.ts")
    expect(route).toContain("ClientHasActiveOrdersError")
    expect(route).toContain("CLIENT_HAS_ACTIVE_ORDERS")
    expect(route).toContain("Tenés un pedido en curso. Podrás eliminar tu cuenta cuando finalice.")
  })
})

describe("19-B0.2B0 — deleteClientAccountInTransaction: guard de pedidos activos (mock)", () => {
  function txWithPedidoLookup(findFirstResult: { id: string } | null) {
    const calls: Array<{ model: string; operation: string }> = []
    const operation = (model: string, name: string) => async () => {
      calls.push({ model, operation: name })
      return { count: 0 }
    }
    const tx = {
      resena: { updateMany: operation("resena", "updateMany") },
      pedido: {
        findFirst: async () => {
          calls.push({ model: "pedido", operation: "findFirst" })
          return findFirstResult
        },
        updateMany: operation("pedido", "updateMany"),
      },
      ...baseChatMocks(calls),
      passwordResetToken: { deleteMany: operation("passwordResetToken", "deleteMany") },
      denuncia: { updateMany: operation("denuncia", "updateMany") },
      favorito: { deleteMany: operation("favorito", "deleteMany") },
      direccion: { deleteMany: operation("direccion", "deleteMany") },
      cliente: { delete: operation("cliente", "delete") },
    } as unknown as Prisma.TransactionClient
    return { tx, calls }
  }

  test("si existe un pedido activo, rechaza con ClientHasActiveOrdersError sin escribir nada", async () => {
    const { tx, calls } = txWithPedidoLookup({ id: "pedido-activo" })
    await expect(deleteClientAccountInTransaction(tx, "cliente-test")).rejects.toBeInstanceOf(
      ClientHasActiveOrdersError,
    )
    expect(calls).toEqual([{ model: "pedido", operation: "findFirst" }])
  })

  test("sin pedidos activos, procede con la secuencia completa de eliminación", async () => {
    const { tx, calls } = txWithPedidoLookup(null)
    await deleteClientAccountInTransaction(tx, "cliente-test")
    expect(calls.map(({ model, operation }) => `${model}.${operation}`)).toEqual([
      "pedido.findFirst",
      "resena.updateMany",
      "pedido.updateMany",
      "chatMensaje.findMany",
      "chatMensaje.updateMany",
      "chatMensaje.updateMany",
      "passwordResetToken.deleteMany",
      "denuncia.updateMany",
      "favorito.deleteMany",
      "direccion.deleteMany",
      "cliente.delete",
    ])
  })
})

describe("19-B0.2B1 — anonimización estructurada de Pedido + cleanup de PasswordResetToken (mock)", () => {
  test("pedido.updateMany sanitiza exactamente los campos estructurados de PII, preservando el resto", async () => {
    const calls: Array<{ model: string; operation: string; args: unknown }> = []
    const operation = (model: string, name: string) => async (args: unknown) => {
      calls.push({ model, operation: name, args })
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena", "updateMany") },
      pedido: { findFirst: async () => null, updateMany: operation("pedido", "updateMany") },
      ...baseChatMocks(calls),
      passwordResetToken: { deleteMany: operation("passwordResetToken", "deleteMany") },
      denuncia: { updateMany: operation("denuncia", "updateMany") },
      favorito: { deleteMany: operation("favorito", "deleteMany") },
      direccion: { deleteMany: operation("direccion", "deleteMany") },
      cliente: { delete: operation("cliente", "delete") },
    } as unknown as Prisma.TransactionClient

    await deleteClientAccountInTransaction(tx, "cliente-test")

    const pedidoUpdate = calls.find((c) => c.model === "pedido" && c.operation === "updateMany")
    expect(pedidoUpdate?.args).toEqual({
      where: { clienteId: "cliente-test" },
      data: {
        clienteId: null,
        clienteNombre: ANONYMIZED_REVIEW_CLIENT_NAME,
        clienteTelefono: "",
        direccion: null,
        referencia: null,
        lat: null,
        lng: null,
        notas: null,
      },
    })
    // Campos financieros/operativos/de historial no aparecen en absoluto en
    // el payload — nunca se tocan. `notas` sí se toca deliberadamente
    // (19-B0.2D1) — se prueba en el describe dedicado más abajo.
    const dataKeys = Object.keys((pedidoUpdate?.args as { data: object }).data)
    for (const untouched of [
      "total",
      "totalProductos",
      "tarifaServicio",
      "precioDelivery",
      "metodoEntrega",
      "metodoPago",
      "estado",
      "negocioId",
      "deudaAcumulada",
      "canceladoMotivo",
      "items",
    ]) {
      expect(dataKeys).not.toContain(untouched)
    }
  })

  test("passwordResetToken.deleteMany se acota a userId + userType cliente, ocurre después del guard y antes de cliente.delete", async () => {
    const calls: Array<{ model: string; operation: string; args?: unknown }> = []
    const operation = (model: string, name: string) => async (args?: unknown) => {
      calls.push({ model, operation: name, args })
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena", "updateMany") },
      pedido: {
        findFirst: async (args?: unknown) => {
          calls.push({ model: "pedido", operation: "findFirst", args })
          return null
        },
        updateMany: operation("pedido", "updateMany"),
      },
      ...baseChatMocks(calls),
      passwordResetToken: { deleteMany: operation("passwordResetToken", "deleteMany") },
      denuncia: { updateMany: operation("denuncia", "updateMany") },
      favorito: { deleteMany: operation("favorito", "deleteMany") },
      direccion: { deleteMany: operation("direccion", "deleteMany") },
      cliente: { delete: operation("cliente", "delete") },
    } as unknown as Prisma.TransactionClient

    await deleteClientAccountInTransaction(tx, "cliente-test")

    const order = calls.map((c) => `${c.model}.${c.operation}`)
    expect(order.indexOf("pedido.findFirst")).toBe(0)
    expect(order.indexOf("passwordResetToken.deleteMany")).toBeGreaterThan(order.indexOf("pedido.findFirst"))
    expect(order.indexOf("passwordResetToken.deleteMany")).toBeLessThan(order.indexOf("cliente.delete"))

    const tokenDelete = calls.find((c) => c.model === "passwordResetToken")
    expect(tokenDelete?.args).toEqual({ where: { userId: "cliente-test", userType: "cliente" } })
  })

  test("si el guard bloquea por pedido activo, ni pedido.updateMany ni passwordResetToken.deleteMany se ejecutan", async () => {
    const calls: string[] = []
    const operation = (label: string) => async () => {
      calls.push(label)
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena.updateMany") },
      pedido: { findFirst: async () => ({ id: "pedido-activo" }), updateMany: operation("pedido.updateMany") },
      chatMensaje: {
        findMany: operation("chatMensaje.findMany"),
        updateMany: operation("chatMensaje.updateMany"),
      },
      chatAttachmentDeletionJob: { createMany: operation("chatAttachmentDeletionJob.createMany") },
      passwordResetToken: { deleteMany: operation("passwordResetToken.deleteMany") },
      denuncia: { updateMany: operation("denuncia.updateMany") },
      favorito: { deleteMany: operation("favorito.deleteMany") },
      direccion: { deleteMany: operation("direccion.deleteMany") },
      cliente: { delete: operation("cliente.delete") },
    } as unknown as Prisma.TransactionClient

    await expect(deleteClientAccountInTransaction(tx, "cliente-test")).rejects.toBeInstanceOf(
      ClientHasActiveOrdersError,
    )
    expect(calls).toEqual([])
  })
})

describe("19-B0.2C — Denuncia: pseudonimización + FK SetNull (mock)", () => {
  test("denuncia.updateMany pseudonimiza clienteId/clienteNombre, después de passwordResetToken y antes de favorito/cliente.delete", async () => {
    const calls: Array<{ model: string; operation: string; args?: unknown }> = []
    const operation = (model: string, name: string) => async (args?: unknown) => {
      calls.push({ model, operation: name, args })
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena", "updateMany") },
      pedido: { findFirst: async () => null, updateMany: operation("pedido", "updateMany") },
      ...baseChatMocks(calls),
      passwordResetToken: { deleteMany: operation("passwordResetToken", "deleteMany") },
      denuncia: { updateMany: operation("denuncia", "updateMany") },
      favorito: { deleteMany: operation("favorito", "deleteMany") },
      direccion: { deleteMany: operation("direccion", "deleteMany") },
      cliente: { delete: operation("cliente", "delete") },
    } as unknown as Prisma.TransactionClient

    await deleteClientAccountInTransaction(tx, "cliente-test")

    const order = calls.map((c) => `${c.model}.${c.operation}`)
    expect(order.indexOf("denuncia.updateMany")).toBeGreaterThan(order.indexOf("passwordResetToken.deleteMany"))
    expect(order.indexOf("denuncia.updateMany")).toBeLessThan(order.indexOf("favorito.deleteMany"))
    expect(order.indexOf("denuncia.updateMany")).toBeLessThan(order.indexOf("cliente.delete"))

    const denunciaUpdate = calls.find((c) => c.model === "denuncia")
    expect(denunciaUpdate?.args).toEqual({
      where: { clienteId: "cliente-test" },
      data: { clienteId: null, clienteNombre: ANONYMIZED_REVIEW_CLIENT_NAME },
    })
  })

  test("si el guard bloquea por pedido activo, denuncia.updateMany tampoco se ejecuta", async () => {
    const calls: string[] = []
    const operation = (label: string) => async () => {
      calls.push(label)
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena.updateMany") },
      pedido: { findFirst: async () => ({ id: "pedido-activo" }), updateMany: operation("pedido.updateMany") },
      chatMensaje: {
        findMany: operation("chatMensaje.findMany"),
        updateMany: operation("chatMensaje.updateMany"),
      },
      chatAttachmentDeletionJob: { createMany: operation("chatAttachmentDeletionJob.createMany") },
      passwordResetToken: { deleteMany: operation("passwordResetToken.deleteMany") },
      denuncia: { updateMany: operation("denuncia.updateMany") },
      favorito: { deleteMany: operation("favorito.deleteMany") },
      direccion: { deleteMany: operation("direccion.deleteMany") },
      cliente: { delete: operation("cliente.delete") },
    } as unknown as Prisma.TransactionClient

    await expect(deleteClientAccountInTransaction(tx, "cliente-test")).rejects.toBeInstanceOf(
      ClientHasActiveOrdersError,
    )
    expect(calls).toEqual([])
  })

  test("schema y migración: FK de Denuncia pasa de Cascade a SetNull, columna nullable, sin tocar datos", () => {
    const schema = read("prisma/schema.prisma")
    const migration = read(
      "prisma/migrations/20260810000000_preserve_denuncia_on_client_delete/migration.sql",
    )

    expect(schema).toContain("clienteId     String?\n  negocioId     String\n")
    expect(schema).toContain("cliente Cliente? @relation(fields: [clienteId], references: [id], onDelete: SetNull)")

    expect(migration).toContain('ALTER TABLE "denuncias" DROP CONSTRAINT "denuncias_clienteId_fkey"')
    expect(migration).toContain('ALTER TABLE "denuncias" ALTER COLUMN "clienteId" DROP NOT NULL')
    expect(migration).toContain('FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE')
    expect(migration).not.toMatch(/DROP\s+TABLE/i)
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(migration).not.toMatch(/\bTRUNCATE\b/i)
    expect(migration).not.toMatch(/\bUPDATE\s+"denuncias"/i)
  })
})

describe("19-B0.2D1 — Chat + Pedido.notas + outbox de adjuntos (mock)", () => {
  test("pedido.updateMany incluye notas:null junto al resto de campos B1", async () => {
    const calls: Array<{ model: string; operation: string; args?: unknown }> = []
    const operation = (model: string, name: string) => async (args?: unknown) => {
      calls.push({ model, operation: name, args })
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena", "updateMany") },
      pedido: { findFirst: async () => null, updateMany: operation("pedido", "updateMany") },
      ...baseChatMocks(calls),
      passwordResetToken: { deleteMany: operation("passwordResetToken", "deleteMany") },
      denuncia: { updateMany: operation("denuncia", "updateMany") },
      favorito: { deleteMany: operation("favorito", "deleteMany") },
      direccion: { deleteMany: operation("direccion", "deleteMany") },
      cliente: { delete: operation("cliente", "delete") },
    } as unknown as Prisma.TransactionClient

    await deleteClientAccountInTransaction(tx, "cliente-test")

    const pedidoUpdate = calls.find((c) => c.model === "pedido" && c.operation === "updateMany")
    expect((pedidoUpdate?.args as { data: Record<string, unknown> }).data.notas).toBeNull()
  })

  test("chatMensaje.updateMany de contenido se acota a clienteId + remitente='cliente', con el sentinel exacto", async () => {
    const calls: Array<{ model: string; operation: string; args?: unknown }> = []
    const operation = (model: string, name: string) => async (args?: unknown) => {
      calls.push({ model, operation: name, args })
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena", "updateMany") },
      pedido: { findFirst: async () => null, updateMany: operation("pedido", "updateMany") },
      chatMensaje: {
        findMany: async (args?: unknown) => {
          calls.push({ model: "chatMensaje", operation: "findMany", args })
          return []
        },
        updateMany: operation("chatMensaje", "updateMany"),
      },
      chatAttachmentDeletionJob: { createMany: operation("chatAttachmentDeletionJob", "createMany") },
      passwordResetToken: { deleteMany: operation("passwordResetToken", "deleteMany") },
      denuncia: { updateMany: operation("denuncia", "updateMany") },
      favorito: { deleteMany: operation("favorito", "deleteMany") },
      direccion: { deleteMany: operation("direccion", "deleteMany") },
      cliente: { delete: operation("cliente", "delete") },
    } as unknown as Prisma.TransactionClient

    await deleteClientAccountInTransaction(tx, "cliente-test")

    const chatUpdates = calls.filter((c) => c.model === "chatMensaje" && c.operation === "updateMany")
    expect(chatUpdates).toHaveLength(2)

    // Primer updateMany: sanitiza contenido, sólo remitente="cliente".
    expect(chatUpdates[0].args).toEqual({
      where: { clienteId: "cliente-test", remitente: "cliente" },
      data: {
        clienteId: null,
        texto: DELETED_CLIENT_CHAT_MESSAGE_TEXT,
        imagenUrl: null,
        archivoUrl: null,
        archivoNombre: null,
        archivoTipo: null,
      },
    })
    expect(DELETED_CLIENT_CHAT_MESSAGE_TEXT).toBe("Mensaje no disponible")

    // Segundo updateMany: red de seguridad, sólo desvincula clienteId, NUNCA
    // toca texto/adjuntos — filtro complementario (remitente != "cliente").
    expect(chatUpdates[1].args).toEqual({
      where: { clienteId: "cliente-test", NOT: { remitente: "cliente" } },
      data: { clienteId: null },
    })
  })

  test("el findMany de attachments se filtra por clienteId + remitente='cliente' + algún adjunto no nulo, y ocurre antes de sanitizar", async () => {
    const calls: Array<{ model: string; operation: string; args?: unknown }> = []
    const operation = (model: string, name: string) => async (args?: unknown) => {
      calls.push({ model, operation: name, args })
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena", "updateMany") },
      pedido: { findFirst: async () => null, updateMany: operation("pedido", "updateMany") },
      chatMensaje: {
        findMany: async (args?: unknown) => {
          calls.push({ model: "chatMensaje", operation: "findMany", args })
          return []
        },
        updateMany: operation("chatMensaje", "updateMany"),
      },
      chatAttachmentDeletionJob: { createMany: operation("chatAttachmentDeletionJob", "createMany") },
      passwordResetToken: { deleteMany: operation("passwordResetToken", "deleteMany") },
      denuncia: { updateMany: operation("denuncia", "updateMany") },
      favorito: { deleteMany: operation("favorito", "deleteMany") },
      direccion: { deleteMany: operation("direccion", "deleteMany") },
      cliente: { delete: operation("cliente", "delete") },
    } as unknown as Prisma.TransactionClient

    await deleteClientAccountInTransaction(tx, "cliente-test")

    const findMany = calls.find((c) => c.model === "chatMensaje" && c.operation === "findMany")
    expect(findMany?.args).toEqual({
      where: {
        clienteId: "cliente-test",
        remitente: "cliente",
        OR: [{ imagenUrl: { not: null } }, { archivoUrl: { not: null } }],
      },
      select: { pedidoId: true, imagenUrl: true, archivoUrl: true },
    })

    const order = calls.map((c) => `${c.model}.${c.operation}`)
    const findManyIdx = order.indexOf("chatMensaje.findMany")
    const firstUpdateIdx = order.indexOf("chatMensaje.updateMany")
    expect(findManyIdx).toBeGreaterThanOrEqual(0)
    expect(findManyIdx).toBeLessThan(firstUpdateIdx)
  })

  test("con mensajes de Cliente con adjunto, se encolan jobs en chatAttachmentDeletionJob.createMany dentro de la misma tx", async () => {
    const calls: Array<{ model: string; operation: string; args?: unknown }> = []
    const operation = (model: string, name: string) => async (args?: unknown) => {
      calls.push({ model, operation: name, args })
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena", "updateMany") },
      pedido: { findFirst: async () => null, updateMany: operation("pedido", "updateMany") },
      chatMensaje: {
        findMany: async (args?: unknown) => {
          calls.push({ model: "chatMensaje", operation: "findMany", args })
          const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "demo"
          return [
            {
              pedidoId: "pedido-1",
              imagenUrl: `https://res.cloudinary.com/${cloudName}/image/upload/v1/chat/pedido-1/foto.jpg`,
              archivoUrl: null,
            },
          ]
        },
        updateMany: operation("chatMensaje", "updateMany"),
      },
      chatAttachmentDeletionJob: { createMany: operation("chatAttachmentDeletionJob", "createMany") },
      passwordResetToken: { deleteMany: operation("passwordResetToken", "deleteMany") },
      denuncia: { updateMany: operation("denuncia", "updateMany") },
      favorito: { deleteMany: operation("favorito", "deleteMany") },
      direccion: { deleteMany: operation("direccion", "deleteMany") },
      cliente: { delete: operation("cliente", "delete") },
    } as unknown as Prisma.TransactionClient

    await deleteClientAccountInTransaction(tx, "cliente-test")

    const jobCreate = calls.find((c) => c.model === "chatAttachmentDeletionJob" && c.operation === "createMany")
    expect(jobCreate).toBeDefined()
    const args = jobCreate?.args as { data: Array<{ provider: string; resourceType: string; identifier: string }>; skipDuplicates: boolean }
    expect(args.skipDuplicates).toBe(true)
    expect(args.data).toEqual([{ provider: "cloudinary", resourceType: "image", identifier: "chat/pedido-1/foto" }])

    const order = calls.map((c) => `${c.model}.${c.operation}`)
    const jobIdx = order.indexOf("chatAttachmentDeletionJob.createMany")
    const firstChatUpdateIdx = order.indexOf("chatMensaje.updateMany")
    expect(jobIdx).toBeGreaterThan(order.indexOf("chatMensaje.findMany"))
    expect(jobIdx).toBeLessThan(firstChatUpdateIdx)
  })

  test("si el guard bloquea por pedido activo, ni chatMensaje.findMany ni el outbox ni notas se ejecutan", async () => {
    const calls: string[] = []
    const operation = (label: string) => async () => {
      calls.push(label)
      return { count: 1 }
    }
    const tx = {
      resena: { updateMany: operation("resena.updateMany") },
      pedido: { findFirst: async () => ({ id: "pedido-activo" }), updateMany: operation("pedido.updateMany") },
      chatMensaje: {
        findMany: operation("chatMensaje.findMany"),
        updateMany: operation("chatMensaje.updateMany"),
      },
      chatAttachmentDeletionJob: { createMany: operation("chatAttachmentDeletionJob.createMany") },
      passwordResetToken: { deleteMany: operation("passwordResetToken.deleteMany") },
      denuncia: { updateMany: operation("denuncia.updateMany") },
      favorito: { deleteMany: operation("favorito.deleteMany") },
      direccion: { deleteMany: operation("direccion.deleteMany") },
      cliente: { delete: operation("cliente.delete") },
    } as unknown as Prisma.TransactionClient

    await expect(deleteClientAccountInTransaction(tx, "cliente-test")).rejects.toBeInstanceOf(
      ClientHasActiveOrdersError,
    )
    expect(calls).toEqual([])
  })

  test("schema y migración: tabla outbox nueva, sin FK a Cliente/ChatMensaje, dedupe por provider+resourceType+identifier", () => {
    const schema = read("prisma/schema.prisma")
    const migration = read(
      "prisma/migrations/20260811000000_add_chat_attachment_deletion_outbox/migration.sql",
    )

    expect(schema).toContain("model ChatAttachmentDeletionJob {")
    const modelMatch = schema.match(/model ChatAttachmentDeletionJob \{[^}]*\}/)
    expect(modelMatch).not.toBeNull()
    const modelBody = modelMatch?.[0] ?? ""
    expect(modelBody).not.toContain("Cliente")
    expect(modelBody).not.toContain("ChatMensaje")

    expect(migration).toContain('CREATE TABLE "chat_attachment_deletion_jobs"')
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "chat_attachment_deletion_jobs_provider_resourceType_identifier_key"',
    )
    expect(migration).not.toMatch(/DROP\s+TABLE/i)
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i)
    expect(migration).not.toMatch(/\bTRUNCATE\b/i)
    expect(migration).not.toMatch(/\bUPDATE\s+"/i)
    expect(migration).not.toMatch(/REFERENCES\s+"clientes"/i)
    expect(migration).not.toMatch(/REFERENCES\s+"chat_mensajes"/i)
  })
})
