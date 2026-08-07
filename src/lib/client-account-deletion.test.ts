/// <reference types="bun-types" />

import { Prisma } from "@prisma/client"
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"
import {
  ANONYMIZED_REVIEW_CLIENT_NAME,
  CLIENT_ACCOUNT_DELETION_MAX_ATTEMPTS,
  ClientAccountDeletionConflictError,
  deleteClientAccountInTransaction,
  retryClientAccountDeletion,
} from "./client-account-deletion"

const ROOT = process.cwd()
const read = (relativePath: string) => readFileSync(join(ROOT, ...relativePath.split("/")), "utf8")
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
      pedido: { updateMany: operation("pedido", "updateMany") },
      chatMensaje: { updateMany: operation("chatMensaje", "updateMany") },
      favorito: { deleteMany: operation("favorito", "deleteMany") },
      direccion: { deleteMany: operation("direccion", "deleteMany") },
      cliente: { delete: operation("cliente", "delete") },
    } as unknown as Prisma.TransactionClient

    await deleteClientAccountInTransaction(tx, "cliente-test")

    expect(calls.map(({ model, operation }) => `${model}.${operation}`)).toEqual([
      "resena.updateMany",
      "pedido.updateMany",
      "chatMensaje.updateMany",
      "favorito.deleteMany",
      "direccion.deleteMany",
      "cliente.delete",
    ])
    expect(calls[0].args).toEqual({
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
      pedido: { updateMany: operation },
      chatMensaje: { updateMany: operation },
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
    expect(route).toContain('import {\n  ClientAccountDeletionConflictError,\n  deleteClientAccount,\n} from "@/lib/client-account-deletion"')
    expect(route).toContain("await deleteClientAccount(clienteId)")
    expect(route).not.toContain("resena.deleteMany")
    expect(route).toContain("ClientAccountDeletionConflictError")
    expect(route).toContain("status: 409")
  })
})
