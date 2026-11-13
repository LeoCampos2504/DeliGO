/// <reference types="bun-types" />
// QA automatizada — fixtures for the BROWSER pass on the isolated database
// `deligo_qa_auto` only. Creates (SQL/Prisma, fixtures only — no sales, no
// shifts) one OBLIGATORIO business with two registers, one owner login, two
// cashier logins and products. Passwords are local QA test values passed in
// QA_TEST_PASSWORD (never printed). Writes the non-secret ids to QA_FIXTURES_FILE.
// Run: bun --no-env-file scripts/qa/qa-auto-browser-fixtures.ts (with the QA env).

import { writeFileSync } from "node:fs"
import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"

const QA_DB = "deligo_qa_auto"
const url = process.env.DATABASE_URL ?? ""
if (!url.includes(`/${QA_DB}?`) || !/@127\.0\.0\.1:55420\//.test(url) || process.env.QA_AUTO !== "1") throw new Error("Sólo contra deligo_qa_auto local.")
const password = process.env.QA_TEST_PASSWORD
if (!password || password.length < 8) throw new Error("Falta QA_TEST_PASSWORD.")

// Verified on the live connection before the first write (unreachable → throws).
const [row] = await db.$queryRaw<Array<{ db: string; port: number }>>`SELECT current_database() AS db, inet_server_port() AS port`
if (row.db !== QA_DB || Number(row.port) !== 55420) throw new Error(`Conexión inesperada: ${row.db}:${row.port}. No se escribe nada.`)

const hash = await hashPassword(password)
const suffix = Date.now().toString(36)
const negocio = await db.negocio.create({
  data: { slug: `kiosco-qa-nav-${suffix}`, nombre: "Kiosco QA Navegador", usuario: `qa_dueno_${suffix}`, email: `qa-dueno-${suffix}@example.test`, password: hash, rubro: "negocio", aprobado: true, suspendido: false, empleadosActivos: true, salonActivo: true, cajaTurnosModo: "OBLIGATORIO" },
})
const cajaPrincipal = await db.cajaFisica.create({ data: { negocioId: negocio.id, nombre: "Caja principal", esPredeterminada: true, activa: true } })
const cajaDos = await db.cajaFisica.create({ data: { negocioId: negocio.id, nombre: "Caja 2", esPredeterminada: false, activa: true } })
const cajeros: Array<{ nombre: string; email: string; empleadoId: string }> = []
for (const nombre of ["Nora QA", "Omar QA"]) {
  const email = `qa-${nombre.split(" ")[0].toLowerCase()}-${suffix}@example.test`
  const cuenta = await db.cuentaOperativa.create({ data: { nombre, email, password: hash, activo: true, eliminado: false, emailVerified: new Date() } })
  const empleado = await db.empleado.create({ data: { nombre, codigo: `${nombre[0]}${suffix}`.toUpperCase().slice(0, 8), negocioId: negocio.id, cuentaOperativaId: cuenta.id, areaOperativa: "caja", activo: true, eliminado: false } })
  cajeros.push({ nombre, email, empleadoId: empleado.id })
}
const productos: Array<{ id: string; nombre: string }> = []
for (const [nombre, precio] of [["Alfajor QA", 1000], ["Bombon QA", 1000], ["Chocolate QA", 1500]] as const) {
  productos.push(await db.producto.create({ data: { nombre, precio, negocioId: negocio.id, controlStock: true, stockCantidad: 40 }, select: { id: true, nombre: true } }))
}
const out = { negocioId: negocio.id, slug: negocio.slug, usuarioDueno: negocio.usuario, cajas: { principal: cajaPrincipal.id, dos: cajaDos.id }, cajeros, productos }
if (process.env.QA_FIXTURES_FILE) writeFileSync(process.env.QA_FIXTURES_FILE, JSON.stringify(out, null, 2))
console.log(JSON.stringify({ negocioId: out.negocioId, slug: out.slug, cajeros: cajeros.map((c) => c.empleadoId) }))
await db.$disconnect()
