import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"

// Áreas operativas válidas (configuración administrativa para DeliGO Operaciones).
const AREAS_OPERATIVAS = ["sin_asignar", "mozo", "salon", "pyr"] as const

/** Valida `areaOperativa` contra el allowlist. Devuelve el valor o null si es desconocido. */
function normalizeAreaOperativa(value: unknown): string | null {
  return typeof value === "string" && (AREAS_OPERATIVAS as readonly string[]).includes(value)
    ? value
    : null
}

function maskToken(token?: string | null) {
  if (!token) return null
  if (token.length <= 8) return "********"
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

// Legacy-Cleanup-1A: ya no se emite ningún Empleado.token nuevo (ver POST más
// abajo), así que este serializer ya nunca tiene un token real para revelar —
// se mantiene la misma forma de respuesta (token/tokenMasked/tokenRevealed)
// para no romper consumidores existentes, pero `token` queda siempre `null` y
// `tokenRevealed` siempre `false`. Un token YA EXISTENTE de antes de esta
// etapa (empleado mozo creado previamente) sigue viajando enmascarado en
// `tokenMasked`, nunca en texto plano.
function serializeEmpleado<T extends { token: string | null }>(empleado: T) {
  return {
    ...empleado,
    token: null,
    tokenMasked: maskToken(empleado.token),
    tokenRevealed: false,
  }
}

function noStoreJson<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json(data, init)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

// GET - List empleados for negocio
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return noStoreJson({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return noStoreJson({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id

    const empleados = await db.empleado.findMany({
      where: { negocioId, eliminado: false },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        rol: true,
        areaOperativa: true,
        asignacionVersion: true,
        activo: true,
        token: true,
        negocioId: true,
        cuentaOperativa: {
          select: {
            id: true,
            nombre: true,
            activo: true,
            eliminado: true,
          },
        },
      },
    })

    // GET es estrictamente de lectura (Operaciones-1F.1): no crea, modifica,
    // regenera ni revoca tokens legacy. Legacy-Cleanup-1A: ya no se emite
    // ningún Empleado.token nuevo en ningún flujo — un token no-nulo en un
    // empleado existente es, a partir de esta etapa, siempre uno emitido
    // antes de este cambio, nunca uno nuevo.
    return noStoreJson(empleados.map((empleado) => serializeEmpleado(empleado)))
  } catch (error) {
    console.error("Error listing empleados:", error)
    return noStoreJson(
      { error: "Error al obtener empleados" },
      { status: 500 }
    )
  }
}

// POST - Create empleado
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return noStoreJson({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return noStoreJson({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const body = await req.json()
    const { nombre, codigo, rol, activo } = body

    // Estado final de actividad del empleado (resuelto una sola vez).
    const empleadoActivo = activo !== undefined ? Boolean(activo) : true

    // Área operativa opcional al crear. Se valida contra el allowlist; nunca se acepta
    // `asignacionVersion` del frontend (queda en su default de schema).
    let areaOperativa = "sin_asignar"
    if (body.areaOperativa !== undefined) {
      const normalized = normalizeAreaOperativa(body.areaOperativa)
      if (normalized === null) {
        return noStoreJson({ error: "Área operativa inválida" }, { status: 400 })
      }
      areaOperativa = normalized
    }

    // No permitir crear un empleado inactivo con un área asignada.
    if (!empleadoActivo && areaOperativa !== "sin_asignar") {
      return noStoreJson(
        { error: "No se puede asignar área a un empleado inactivo" },
        { status: 409 }
      )
    }

    if (!nombre?.trim()) {
      return noStoreJson(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    if (!codigo?.trim()) {
      return noStoreJson(
        { error: "El código es obligatorio" },
        { status: 400 }
      )
    }

    // Check for duplicate codigo within negocio
    const existing = await db.empleado.findUnique({
      where: { negocioId_codigo: { negocioId, codigo: codigo.trim().toUpperCase() } },
    })
    if (existing) {
      return noStoreJson(
        { error: `Ya existe un empleado con el código "${codigo.trim().toUpperCase()}"` },
        { status: 409 }
      )
    }

    // Legacy-Cleanup-1A: decisión arquitectónica confirmada — ya no se emite
    // ningún Empleado.token nuevo, sin importar el área operativa (incluida
    // Mozo). El reemplazo es exclusivamente CuentaOperativa + código de
    // incorporación. Antes de esta etapa, un empleado creado con área
    // efectiva Mozo recibía acá un token legacy nuevo (`generateMozoToken()`).
    const rolFinal = rol || "mozo"

    const empleado = await db.empleado.create({
      data: {
        nombre: nombre.trim(),
        codigo: codigo.trim().toUpperCase(),
        token: null,
        rol: rolFinal,
        areaOperativa,
        activo: empleadoActivo,
        negocioId,
      },
    })

    // Audit log
    await auditLog({ userId: negocioId, userType: "negocio", accion: "empleado.creado", recurso: "empleado", recursoId: empleado.id, detalle: { nombre: empleado.nombre, codigo: empleado.codigo } })

    // Auditar la asignación de área cuando se crea con un área concreta (sin datos sensibles).
    if (areaOperativa !== "sin_asignar") {
      await auditLog({ userId: negocioId, userType: "negocio", accion: "empleado.area_asignada", recurso: "empleado", recursoId: empleado.id, detalle: { areaOperativa, asignacionVersion: empleado.asignacionVersion } })
    }

    return noStoreJson(serializeEmpleado(empleado), { status: 201 })
  } catch (error) {
    console.error("Error creating empleado:", error)
    return noStoreJson(
      { error: "Error al crear empleado" },
      { status: 500 }
    )
  }
}
