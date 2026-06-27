import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { randomBytes } from "crypto"

// Generate a unique token for mozo links
function generateMozoToken(): string {
  return randomBytes(32).toString("hex") // 64-char hex string
}

function maskToken(token?: string | null) {
  if (!token) return null
  if (token.length <= 8) return "********"
  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

function serializeEmpleado<T extends { token: string | null }>(empleado: T, revealToken = false) {
  return {
    ...empleado,
    token: revealToken ? empleado.token : null,
    tokenMasked: maskToken(empleado.token),
    tokenRevealed: revealToken,
  }
}

// GET - List empleados for negocio
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
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

    // Generate tokens for any empleados that don't have one (legacy migration)
    for (const emp of empleados) {
      if (!emp.token) {
        let newToken = generateMozoToken()
        while (await db.empleado.findFirst({ where: { token: newToken } })) {
          newToken = generateMozoToken()
        }
        await db.empleado.update({
          where: { id: emp.id },
          data: { token: newToken },
        })
        emp.token = newToken
      }
    }

    return NextResponse.json(empleados.map((empleado) => serializeEmpleado(empleado)))
  } catch (error) {
    console.error("Error listing empleados:", error)
    return NextResponse.json(
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
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const user = await getUserFromToken(token)
    if (!user || user.type !== "negocio") {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 })
    }

    const negocioId = user.id
    const body = await req.json()
    const { nombre, codigo, rol, activo } = body

    if (!nombre?.trim()) {
      return NextResponse.json(
        { error: "El nombre es obligatorio" },
        { status: 400 }
      )
    }

    if (!codigo?.trim()) {
      return NextResponse.json(
        { error: "El código es obligatorio" },
        { status: 400 }
      )
    }

    // Check for duplicate codigo within negocio
    const existing = await db.empleado.findUnique({
      where: { negocioId_codigo: { negocioId, codigo: codigo.trim().toUpperCase() } },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Ya existe un empleado con el código "${codigo.trim().toUpperCase()}"` },
        { status: 409 }
      )
    }

    // Generate unique token for mozo link
    let mozoToken = generateMozoToken()
    // Ensure uniqueness (use findFirst since token doesn't have @unique constraint)
    while (await db.empleado.findFirst({ where: { token: mozoToken } })) {
      mozoToken = generateMozoToken()
    }

    const empleado = await db.empleado.create({
      data: {
        nombre: nombre.trim(),
        codigo: codigo.trim().toUpperCase(),
        token: mozoToken,
        rol: rol || "mozo",
        activo: activo !== undefined ? Boolean(activo) : true,
        negocioId,
      },
    })

    // Audit log
    await auditLog({ userId: negocioId, userType: "negocio", accion: "empleado.creado", recurso: "empleado", recursoId: empleado.id, detalle: { nombre: empleado.nombre, codigo: empleado.codigo } })

    return NextResponse.json(serializeEmpleado(empleado, true), { status: 201 })
  } catch (error) {
    console.error("Error creating empleado:", error)
    return NextResponse.json(
      { error: "Error al crear empleado" },
      { status: 500 }
    )
  }
}
