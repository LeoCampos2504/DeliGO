/// <reference types="bun-types" />
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "node:crypto"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { CatalogoError, crearProductoEmpleado, guardarPermisosCatalogo } from "@/lib/catalogo-empleado-service"

setDefaultTimeout(180_000)
if (!process.env.DELIGO_TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.DELIGO_TEST_DATABASE_URL || process.env.DELIGO_ENVIRONMENT !== "TESTING" || process.env.DELIGO_EPHEMERAL_TEST_DB !== "1") throw new Error("La prueba requiere PostgreSQL efímero de CI")
function barrera() {
  let liberar!: () => void
  const espera = new Promise<void>((resolve) => { liberar = resolve })
  return { espera, liberar }
}
async function esperarRevocacionBloqueada() {
  const limite = Date.now() + 10_000
  while (Date.now() < limite) {
    const filas = await db.$queryRaw<Array<{ bloqueada: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database()
          AND wait_event_type = 'Lock'
          AND query ILIKE '%UPDATE "empleados"%'
      ) AS bloqueada`
    if (filas[0]?.bloqueada) return true
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  return false
}
async function escenario() {
  const id = randomUUID()
  const negocio = await db.negocio.create({ data: { slug: `t2race-${id}`, nombre: `T2 ${id}`, usuario: `t2race-${id}`, email: `t2race-${id}@example.test`, password: "fixture", rubro: "negocio", aprobado: true } })
  const empleado = await db.empleado.create({ data: { negocioId: negocio.id, nombre: "T2", codigo: id.slice(0, 8), catalogoHasta: new Date(Date.now() + 3600_000), catalogoCrear: true, catalogoEditar: true, catalogoPrecios: true } })
  return { negocio, empleado }
}
type TxFn = (tx: Prisma.TransactionClient) => Promise<unknown>
type TxOptions = { isolationLevel?: Prisma.TransactionIsolationLevel; maxWait?: number; timeout?: number }

describe("T2 orden transaccional de revocación", () => {
  test("revocación confirmada antes de autorización efectiva rechaza alta sin efectos", async () => {
    const { negocio, empleado } = await escenario()
    const iniciado = barrera(), seguir = barrera()
    const controlado = new Proxy(db, { get(target, prop, receiver) {
      if (prop === "$transaction") return async (fn: TxFn, options: TxOptions) => {
        iniciado.liberar(); await seguir.espera
        return db.$transaction(fn, options)
      }
      return Reflect.get(target, prop, receiver)
    } })
    const alta = crearProductoEmpleado(controlado, { negocioId: negocio.id, empleadoId: empleado.id, body: { nombre: "No autorizado", precio: 100 } })
    await iniciado.espera
    const revocacion = await guardarPermisosCatalogo(db, negocio.id, { empleadoId: empleado.id, hasta: new Date(Date.now() + 3600_000).toISOString(), crear: true, editar: true, precios: false })
    expect(revocacion.ok).toBe(true)
    seguir.liberar()
    await expect(alta).rejects.toBeInstanceOf(CatalogoError)
    expect(await db.producto.count({ where: { negocioId: negocio.id } })).toBe(0)
    const p = await db.empleado.findUniqueOrThrow({ where: { id: empleado.id } })
    expect(p.catalogoCrear).toBe(true); expect(p.catalogoEditar).toBe(true); expect(p.catalogoPrecios).toBe(false)
  })

  test("alta que ya tiene FOR SHARE se ordena antes de la revocación; la siguiente es rechazada", async () => {
    const { negocio, empleado } = await escenario()
    const bloqueado = barrera(), continuar = barrera()
    const controlado = new Proxy(db, { get(target, prop, receiver) {
      if (prop === "$transaction") return (fn: TxFn, options: TxOptions) => db.$transaction(async (tx) => {
        const instrumentado = new Proxy(tx, { get(obj, key, recv) {
          if (key === "$queryRaw") return async (...args: Parameters<typeof tx.$queryRaw>) => {
            const resultado = await tx.$queryRaw(...args)
            bloqueado.liberar(); await continuar.espera
            return resultado
          }
          return Reflect.get(obj, key, recv)
        } })
        return fn(instrumentado)
      }, options)
      return Reflect.get(target, prop, receiver)
    } })
    const alta = crearProductoEmpleado(controlado, { negocioId: negocio.id, empleadoId: empleado.id, body: { nombre: "Autorizado" } })
    await bloqueado.espera
    // La revocación real usa UPDATE sobre esta misma fila: observar su espera de lock
    // prueba la coordinación de ambas rutas, sin depender del orden de planificación.
    const revocacionEnCurso = guardarPermisosCatalogo(db, negocio.id, { empleadoId: empleado.id, hasta: null })
    const bloqueada = await esperarRevocacionBloqueada()
    continuar.liberar()
    expect((await alta).ok).toBe(true)
    const revocacion = await revocacionEnCurso
    expect(bloqueada).toBe(true)
    expect(revocacion.ok).toBe(true)
    expect((await crearProductoEmpleado(db, { negocioId: negocio.id, empleadoId: empleado.id, body: { nombre: "Posterior" } })).ok).toBe(false)
    expect(await db.producto.count({ where: { negocioId: negocio.id } })).toBe(1)
  })
})
