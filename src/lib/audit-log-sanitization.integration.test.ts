/// <reference types="bun-types" />

// ============================================
// GLOBAL-LOGS-PII-1 — AuditLog: operational codes nunca persistidos
// ============================================
// Cubre dos exposiciones confirmadas durante la auditoría global de logging:
// (1) PATCH /api/negocio/config persistía el body COMPLETO de la request en
// `AuditLog.detalle` (incluyendo `repartidorCodigo`, un código de acceso
// operativo); (2) POST /api/negocio/empleados persistía `codigo` (el
// identificador con el que se busca al empleado desde un endpoint público)
// en el mismo lugar. Ambos ahora sólo persisten metadata segura (nombres de
// campos cambiados / nombre del empleado), nunca los valores/códigos.
// Contra PostgreSQL TESTING real, prefijo `test-global-logs-pii-`.

import { randomUUID } from "crypto"
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth"
import { PATCH as patchNegocioConfig } from "@/app/api/negocio/config/route"
import { POST as postEmpleado } from "@/app/api/negocio/empleados/route"

setDefaultTimeout(30_000)

const prefix = "test-global-logs-pii-"
const negocioIds: string[] = []

async function ensureNegocio(suffix: string) {
  const negocio = await db.negocio.create({
    data: {
      nombre: `${prefix}${suffix}`,
      slug: `${prefix}${suffix}-${randomUUID()}`,
      usuario: `${prefix}${suffix}-${randomUUID()}`,
      email: `${prefix}${suffix}-${randomUUID()}@example.test`,
      password: "fixture",
      aprobado: true,
      suspendido: false,
      ofreceDelivery: true,
    },
  })
  negocioIds.push(negocio.id)
  return negocio
}

async function cookieFor(negocioId: string) {
  const token = await createSession(negocioId, "negocio")
  return `${SESSION_COOKIE_NAME}=${token}`
}

function reqJson(url: string, method: string, cookie: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  })
}

async function cleanup() {
  await db.auditLog.deleteMany({ where: { userId: { in: negocioIds } } })
  await db.empleado.deleteMany({ where: { negocioId: { in: negocioIds } } })
  if (negocioIds.length) {
    await db.negocio.deleteMany({ where: { id: { in: negocioIds } } })
  }
}

beforeAll(cleanup)

afterAll(async () => {
  await cleanup()
  const remaining = await db.negocio.count({ where: { id: { in: negocioIds } } })
  expect(remaining).toBe(0)
})

describe("GLOBAL-LOGS-PII-1 — negocio.config_cambiada: repartidorCodigo nunca persistido", () => {
  test("PATCH /api/negocio/config con repartidorCodigo sentinel -> AuditLog.detalle no contiene el código", async () => {
    const negocio = await ensureNegocio("config")
    const cookie = await cookieFor(negocio.id)
    const sentinelCodigo = "SENTINEL-REPARTIDOR-CODE-999"

    const res = await patchNegocioConfig(reqJson("/api/negocio/config", "PATCH", cookie, { repartidorCodigo: sentinelCodigo }))
    expect(res.status).toBe(200)

    const auditEntry = await db.auditLog.findFirst({
      where: { userId: negocio.id, accion: "negocio.config_cambiada" },
      orderBy: { fecha: "desc" },
    })
    expect(auditEntry).not.toBeNull()
    expect(auditEntry?.detalle).not.toContain(sentinelCodigo)

    // Señal operativa preservada: sigue siendo posible saber QUÉ campo cambió.
    const detalle = JSON.parse(auditEntry?.detalle || "{}")
    expect(detalle.camposActualizados).toContain("repartidorCodigo")

    const updated = await db.negocio.findUnique({ where: { id: negocio.id } })
    expect(updated?.repartidorCodigo).toBe(sentinelCodigo)
  })
})

describe("GLOBAL-LOGS-PII-1 — empleado.creado: codigo nunca persistido en AuditLog", () => {
  test("POST /api/negocio/empleados con codigo sentinel -> AuditLog.detalle no contiene el codigo", async () => {
    const negocio = await ensureNegocio("empleado")
    const cookie = await cookieFor(negocio.id)
    const sentinelCodigo = "SENTINELCODE1"

    const res = await postEmpleado(
      reqJson("/api/negocio/empleados", "POST", cookie, { nombre: "Empleado Sintetico", codigo: sentinelCodigo })
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.codigo).toBe(sentinelCodigo) // la API sigue devolviéndolo al negocio dueño — esto no cambia

    const auditEntry = await db.auditLog.findFirst({
      where: { userId: negocio.id, accion: "empleado.creado" },
      orderBy: { fecha: "desc" },
    })
    expect(auditEntry).not.toBeNull()
    expect(auditEntry?.detalle).not.toContain(sentinelCodigo)

    const detalle = JSON.parse(auditEntry?.detalle || "{}")
    expect(detalle.nombre).toBe("Empleado Sintetico")
    expect(detalle.codigo).toBeUndefined()
  })
})
