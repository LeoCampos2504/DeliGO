// Seed aislado de Fase C. Sólo usa DELIGO_TEST_DATABASE_URL y nunca imprime su valor.
// Los tokens crudos se escriben únicamente bajo %TEMP% y se eliminan en cleanup.

import { randomUUID } from "node:crypto"
import { emptyManifest, writeManifest, type FixtureManifest } from "./manifest"
import { writeRuntimePool, type ActorIdentity } from "./runtime-pool"
import { buildFinancialFixturePlan, type FinancialFixturePlan } from "./service-fee"

export interface SeedResult {
  manifest: FixtureManifest
  runtimePoolFile: string
  financialFixture: FinancialFixturePlan
}

function requireTestDatabaseUrl(): string {
  const value = process.env.DELIGO_TEST_DATABASE_URL
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      "TEST_DB_HARD_GATE: DELIGO_TEST_DATABASE_URL no está disponible. Nunca se usa DATABASE_URL como fallback silencioso. Abortando antes de cualquier write."
    )
  }
  return value
}

function countForScenario(scenario: string) {
  if (scenario === "pacingProbe") {
    return { clientes: 1, negocios: 1, repartidores: 1, operaciones: 1, orders: 0 }
  }
  if (scenario === "realistic20") {
    return { clientes: 14, negocios: 3, repartidores: 2, operaciones: 1, orders: 0 }
  }
  if (scenario === "compressed50") {
    return { clientes: 60, negocios: 1, repartidores: 0, operaciones: 0, orders: 50 }
  }
  return { clientes: 1, negocios: 1, repartidores: 0, operaciones: 0, orders: 1 }
}

export async function seedFixtures(runId: string, scenario: string): Promise<SeedResult> {
  const testDbUrl = requireTestDatabaseUrl()
  process.env.DATABASE_URL = testDbUrl

  // Dynamic imports must remain after the hard gate and DATABASE_URL assignment.
  const { db } = await import("@/lib/db")
  const { createOperationalSession, createSession, hashSessionToken } = await import("@/lib/auth")

  const counts = countForScenario(scenario)
  const financialFixture = await buildFinancialFixturePlan(counts.orders)
  if (scenario === "compressed50" && (financialFixture.fixtureDebtLimit === null || financialFixture.fixtureDebtLimit < financialFixture.requiredDebtCapacity)) {
    throw new Error("COMPRESSED50_FINANCIAL_FIXTURE_INVALID")
  }
  const prefix = `loadcert-${runId}`
  const manifest = emptyManifest(runId, scenario)
  const identities: ActorIdentity[] = []

  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}-negocio`,
      slug: `${prefix}-negocio`,
      usuario: `${prefix}-negocio`,
      email: `${prefix}-negocio@example.test`,
      password: "loadcert-fixture-not-a-real-hash",
      emailVerified: new Date(),
      aprobado: true,
      suspendido: false,
      horarioMode: "simple",
      abiertoManual: true,
      ofreceDelivery: true,
      ofreceRetiro: true,
      salonActivo: true,
      empleadosActivos: counts.operaciones > 0,
      repartidorCodigo: `${runId.slice(-8).toUpperCase()}`,
      limiteDeuda: financialFixture.fixtureDebtLimit,
    },
  })
  manifest.negocioIds.push(negocio.id)

  const producto = await db.producto.create({
    data: { nombre: `${prefix}-producto`, precio: 100, negocioId: negocio.id },
  })
  manifest.productoIds.push(producto.id)

  for (let index = 0; index < counts.clientes; index += 1) {
    const cliente = await db.cliente.create({
      data: {
        nombre: `${prefix}-cliente-${index}`,
        email: `${prefix}-cliente-${index}@example.test`,
        telefono: "",
        password: null,
        emailVerified: new Date(),
        bloqueado: false,
      },
    })
    manifest.clienteIds.push(cliente.id)
    const token = await createSession(cliente.id, "cliente")
    manifest.sessionTokenHashes.push(hashSessionToken(token))
    identities.push({
      role: "cliente",
      index,
      id: cliente.id,
      email: cliente.email,
      sessionToken: token,
    })
  }

  for (let index = 0; index < counts.negocios; index += 1) {
    const token = await createSession(negocio.id, "negocio")
    manifest.sessionTokenHashes.push(hashSessionToken(token))
    identities.push({
      role: "negocio",
      index,
      id: negocio.id,
      email: negocio.email,
      sessionToken: token,
      negocioSlug: negocio.slug,
      productoId: producto.id,
    })
  }

  for (let index = 0; index < counts.repartidores; index += 1) {
    const repartidor = await db.repartidor.create({
      data: {
        nombre: `${prefix}-repartidor-${index}`,
        email: `${prefix}-repartidor-${index}@example.test`,
        password: null,
        emailVerified: new Date(),
        activo: true,
        eliminado: false,
      },
    })
    manifest.repartidorIds.push(repartidor.id)
    await db.repartidorNegocio.create({
      data: {
        repartidorId: repartidor.id,
        negocioId: negocio.id,
        negocioSlug: negocio.slug,
        negocioNombre: negocio.nombre,
        codigoAcceso: negocio.repartidorCodigo ?? "LOADCERT",
      },
    })
    const token = await createSession(repartidor.id, "repartidor")
    manifest.sessionTokenHashes.push(hashSessionToken(token))
    identities.push({
      role: "repartidor",
      index,
      id: repartidor.id,
      email: repartidor.email,
      sessionToken: token,
    })
  }

  if (counts.operaciones > 0) {
    const cuenta = await db.cuentaOperativa.create({
      data: {
        nombre: `${prefix}-operaciones`,
        email: `${prefix}-operaciones@example.test`,
        password: null,
        emailVerified: new Date(),
        activo: true,
        eliminado: false,
      },
    })
    manifest.cuentaOperativaIds.push(cuenta.id)
    const empleado = await db.empleado.create({
      data: {
        nombre: `${prefix}-salon`,
        codigo: `${runId.slice(-6).toUpperCase()}`,
        rol: "salon",
        areaOperativa: "salon",
        permisos: "[]",
        activo: true,
        eliminado: false,
        negocioId: negocio.id,
        cuentaOperativaId: cuenta.id,
      },
    })
    manifest.empleadoIds.push(empleado.id)
    const token = await createOperationalSession(cuenta.id)
    manifest.sessionTokenHashes.push(hashSessionToken(token))
    identities.push({
      role: "operaciones",
      index: 0,
      id: cuenta.id,
      email: cuenta.email,
      sessionToken: token,
      cookieName: "deligo_operativo_session",
      negocioSlug: negocio.slug,
    })
  }

  const idempotencyKeys = Array.from({ length: counts.orders }, () => randomUUID())
  manifest.idempotencyKeys.push(...idempotencyKeys)

  const runtimePoolFile = writeRuntimePool({ runId, identities, idempotencyKeys })
  writeManifest(manifest)
  return { manifest, runtimePoolFile, financialFixture }
}

export async function disconnectSeedDb(): Promise<void> {
  const { db } = await import("@/lib/db")
  await db.$disconnect()
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const getArg = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`)
    return idx >= 0 ? args[idx + 1] : undefined
  }
  const runId = getArg("run-id") ?? `loadcert-${Date.now()}-${randomUUID().slice(0, 8)}`
  const scenario = getArg("scenario") ?? "realistic20"
  seedFixtures(runId, scenario)
    .then(async (result) => {
      console.log(`SEED_OK runId=${runId} manifest=${result.runtimePoolFile}`)
      await disconnectSeedDb()
    })
    .catch(async (error) => {
      console.error("SEED_FAILED", error instanceof Error ? error.name : "unknown")
      await disconnectSeedDb().catch(() => {})
      process.exit(1)
    })
}
