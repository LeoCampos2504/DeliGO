// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — seed mínimo Fase B
// ============================================
// IMPORTANTE (DB hard gate): este módulo NUNCA importa "@/lib/db" ni
// "@/lib/auth" a nivel de módulo (static import) — eso ejecutaría antes de
// que podamos fijar `process.env.DATABASE_URL` desde
// `DELIGO_TEST_DATABASE_URL` (los imports ES se hoistean por delante de
// cualquier otro código del archivo). En vez de eso, `seedFixtures()` fija
// el env var y recién ENTONCES hace `await import(...)` dinámico — así este
// archivo es seguro tanto si se invoca standalone (`bun run seed-pool.ts`)
// como si `orchestrate.ts` lo importa dinámicamente.
//
// Crea fixtures MÍNIMAS: 1 Negocio (retiro-only, aprobado, abierto) + 1
// Producto + 1 Cliente + 1 Sesion Cliente + 1 Sesion Negocio, directo en
// PostgreSQL TESTING vía Prisma — nunca vía HTTP (register/login), nunca
// dispara email/push/Cloudinary reales.

import { randomUUID } from "node:crypto"
import { emptyManifest, writeManifest, type FixtureManifest } from "./manifest"
import { writeRuntimePool, type ActorIdentity } from "./runtime-pool"

export interface SeedResult {
  manifest: FixtureManifest
  runtimePoolFile: string
}

export async function seedFixtures(runId: string, scenario: string): Promise<SeedResult> {
  const testDbUrl = process.env.DELIGO_TEST_DATABASE_URL
  if (!testDbUrl) {
    throw new Error(
      "TEST_DB_HARD_GATE: DELIGO_TEST_DATABASE_URL no está definida — nunca se usa DATABASE_URL como fallback silencioso. Abortando."
    )
  }
  process.env.DATABASE_URL = testDbUrl

  // Imports dinámicos, DESPUÉS de fijar DATABASE_URL — ver comentario de cabecera.
  const { db } = await import("@/lib/db")
  const { createSession, hashSessionToken } = await import("@/lib/auth")

  const prefix = `loadcert-${runId}`
  const manifest = emptyManifest(runId, scenario)

  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}-negocio`,
      slug: `${prefix}-negocio`,
      usuario: `${prefix}-negocio`,
      email: `${prefix}-negocio@example.test`,
      // Negocio.password no es nullable (a diferencia de Cliente, que sí
      // admite null para cuentas OAuth-only) — placeholder no usable, nunca
      // se hace login HTTP con esta cuenta (la sesión ya se crea directo).
      password: "loadcert-fixture-not-a-real-hash",
      emailVerified: new Date(),
      aprobado: true,
      suspendido: false,
      horarioMode: "simple",
      abiertoManual: true,
      ofreceDelivery: false,
      ofreceRetiro: true,
    },
  })
  manifest.negocioIds.push(negocio.id)

  const producto = await db.producto.create({
    data: {
      nombre: `${prefix}-producto`,
      precio: 100,
      negocioId: negocio.id,
    },
  })
  manifest.productoIds.push(producto.id)

  const cliente = await db.cliente.create({
    data: {
      nombre: `${prefix}-cliente`,
      email: `${prefix}-cliente@example.test`,
      telefono: "",
      password: null,
      emailVerified: new Date(),
      bloqueado: false,
    },
  })
  manifest.clienteIds.push(cliente.id)

  // Sesiones creadas directo (nunca login HTTP) — reutiliza el helper real
  // createSession() de src/lib/auth.ts, nunca una reimplementación paralela
  // de generación/hash de token.
  const clienteToken = await createSession(cliente.id, "cliente")
  const negocioToken = await createSession(negocio.id, "negocio")
  manifest.sessionTokenHashes.push(hashSessionToken(clienteToken), hashSessionToken(negocioToken))

  const idempotencyKey = randomUUID()
  manifest.idempotencyKeys.push(idempotencyKey)

  const identities: ActorIdentity[] = [
    {
      role: "cliente",
      index: 0,
      id: cliente.id,
      email: cliente.email,
      sessionToken: clienteToken,
    },
    {
      role: "negocio",
      index: 0,
      id: negocio.id,
      email: negocio.email,
      sessionToken: negocioToken,
      negocioSlug: negocio.slug,
      productoId: producto.id,
    },
  ]

  const runtimePoolFile = writeRuntimePool({ runId, identities, idempotencyKeys: [idempotencyKey] })
  writeManifest(manifest)

  return { manifest, runtimePoolFile }
}

export async function disconnectSeedDb(): Promise<void> {
  const { db } = await import("@/lib/db")
  await db.$disconnect()
}

// Permite invocación standalone: `bun run load-tests/seed/seed-pool.ts --run-id <id> --scenario <name>`
if (import.meta.main) {
  const args = process.argv.slice(2)
  const getArg = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`)
    return idx >= 0 ? args[idx + 1] : undefined
  }
  const runId = getArg("run-id") ?? `loadcert-${Date.now()}-${randomUUID().slice(0, 8)}`
  const scenario = getArg("scenario") ?? "baseline-readonly"

  seedFixtures(runId, scenario)
    .then(async (result) => {
      console.log(`SEED_OK runId=${runId} manifest=${result.runtimePoolFile}`)
      await disconnectSeedDb()
    })
    .catch(async (err) => {
      console.error("SEED_FAILED", err)
      await disconnectSeedDb().catch(() => {})
      process.exit(1)
    })
}
