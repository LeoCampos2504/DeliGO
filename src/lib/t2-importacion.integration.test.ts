/// <reference types="bun-types" />
// T2: real importer on the isolated CI PostgreSQL. Never silently skip.
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"
import { ejecutarImportacion, estadoImportacion, previsualizarImportacion } from "@/lib/importacion-productos-service"

setDefaultTimeout(180_000)
if (!process.env.DELIGO_TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.DELIGO_TEST_DATABASE_URL || process.env.DELIGO_ENVIRONMENT !== "TESTING" || process.env.DELIGO_EPHEMERAL_TEST_DB !== "1") {
  throw new Error("La integración de importación requiere PostgreSQL efímero declarado para CI")
}
async function negocio() {
  const id = randomUUID()
  return db.negocio.create({ data: { slug: `t2-${id}`, nombre: `T2 ${id}`, usuario: `t2-${id}`, email: `t2-${id}@example.test`, password: "fixture", rubro: "negocio", aprobado: true } })
}
const actor = { tipo: "NEGOCIO" as const }

describe("T2 importación: concurrencia, reintentos y tandas", () => {
  test("dos confirmaciones concurrentes y replay no duplican producto ni auditoría; otra clave de negocio no accede", async () => {
    const a = await negocio(), b = await negocio(), nombre = `Producto ${randomUUID()}`
    const base = { campos: ["nombre", "precio"], filas: [{ fila: 2, nombre, precio: 1234 }] }
    const previa = await previsualizarImportacion(db, { negocioId: a.id, actor, body: base })
    if (!previa.ok) throw new Error(previa.code)
    expect(previa.value.grupos).toHaveLength(1)
    const clave = randomUUID()
    const body = { ...base, clave, archivo: "t2.csv", decisiones: { [previa.value.grupos[0].clave]: "crear" } }
    const input = { negocioId: a.id, actor, body }
    const respuestas = await Promise.all([ejecutarImportacion(db, input), ejecutarImportacion(db, input)])
    expect(respuestas.every((r) => r.ok)).toBe(true)
    let fin = await ejecutarImportacion(db, input)
    for (let i = 0; i < 5 && fin.ok && fin.value.estado !== "COMPLETADA"; i++) fin = await ejecutarImportacion(db, input)
    if (!fin.ok) throw new Error(fin.code)
    expect(fin.value.estado).toBe("COMPLETADA")
    expect(fin.value.resultados).toHaveLength(1)
    expect(fin.value.resultados[0].resultado).toBe("CREADO")
    const replay = await ejecutarImportacion(db, input)
    expect(replay).toEqual(fin)
    const productos = await db.producto.findMany({ where: { negocioId: a.id, nombre }, select: { id: true, stockCantidad: true } })
    expect(productos).toHaveLength(1)
    expect(productos[0].stockCantidad).toBe(0)
    expect(await db.auditLog.count({ where: { recurso: "importacion_productos", recursoId: fin.value.importacionId, accion: "catalogo.importacion" } })).toBe(1)
    expect(await db.auditLog.count({ where: { recurso: "producto", recursoId: productos[0].id, accion: "producto.creado" } })).toBe(1)
    expect(await db.movimientoInventario.count({ where: { negocioId: a.id } })).toBe(0)
    expect(await db.movimientoFinanciero.count({ where: { negocioId: a.id } })).toBe(0)
    expect(await estadoImportacion(db, b.id, clave)).toBeNull()
    expect(await db.producto.count({ where: { negocioId: b.id } })).toBe(0)
  })

  test("151 grupos atraviesan el límite de 150 y continúan con la misma clave", async () => {
    const a = await negocio()
    const filas = Array.from({ length: 151 }, (_, i) => ({ fila: i + 2, nombre: `Tanda ${i}` }))
    const base = { campos: ["nombre"], filas }
    const previa = await previsualizarImportacion(db, { negocioId: a.id, actor, body: base })
    if (!previa.ok) throw new Error(previa.code)
    expect(previa.value.grupos).toHaveLength(151)
    const body = { ...base, clave: randomUUID(), archivo: "tanda.csv", decisiones: Object.fromEntries(previa.value.grupos.map((g) => [g.clave, "omitir"])) }
    const input = { negocioId: a.id, actor, body }
    const primera = await ejecutarImportacion(db, input)
    if (!primera.ok) throw new Error(primera.code)
    expect(primera.value.estado).toBe("EN_CURSO")
    expect(primera.value.procesados).toBeGreaterThan(0)
    expect(primera.value.procesados).toBeLessThanOrEqual(150)
    let fin = primera
    for (let i = 0; i < 10 && fin.value.estado !== "COMPLETADA"; i++) {
      const siguiente = await ejecutarImportacion(db, input)
      if (!siguiente.ok) throw new Error(siguiente.code)
      fin = siguiente
    }
    expect(fin.value.estado).toBe("COMPLETADA")
    expect(fin.value.procesados).toBe(151)
    expect(fin.value.resultados.every((r) => r.resultado === "OMITIDO")).toBe(true)
    expect(await db.producto.count({ where: { negocioId: a.id } })).toBe(0)
  })

  test("límites de filas e identificaciones repetidas se validan en la vista previa", async () => {
    const a = await negocio()
    const excedente = await previsualizarImportacion(db, { negocioId: a.id, actor, body: { campos: ["nombre"], filas: Array.from({ length: 2001 }, (_, i) => ({ fila: i + 2, nombre: `P${i}` })) } })
    expect(excedente.ok).toBe(false)
    if (!excedente.ok) expect(excedente.code).toBe("DEMASIADAS_FILAS")
    const previa = await previsualizarImportacion(db, { negocioId: a.id, actor, body: {
      campos: ["nombre", "codigoBarras", "variante"],
      filas: [
        { fila: 2, nombre: "Simple", codigoBarras: "001234" },
        { fila: 3, nombre: "Simple", codigoBarras: "001234" },
        { fila: 4, nombre: "Con variantes", variante: "Rojo", codigoBarras: 987654 },
        { fila: 5, nombre: "Con variantes", variante: "Rojo", codigoBarras: "456789" },
      ],
    } })
    if (!previa.ok) throw new Error(previa.code)
    expect(previa.value.resumen.errores).toBeGreaterThan(0)
    expect(previa.value.grupos.some((g) => g.errores.some((e) => e.includes("repetido")))).toBe(true)
    expect(await db.producto.count({ where: { negocioId: a.id } })).toBe(0)
  })

})
