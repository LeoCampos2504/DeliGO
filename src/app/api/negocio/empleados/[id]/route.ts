import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"
import { auditLog } from "@/lib/audit"
import { resolveAreaOperativaEfectiva } from "@/lib/area-operativa"
import { tieneSalonHabilitado } from "@/lib/negocio-salon-contract"
import { safeErrorForLog } from "@/lib/log-safe-error"

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

// Legacy-Cleanup-1A: ya no se emite ni se regenera ningún Empleado.token —
// ver PUT más abajo, donde se retiró la rama `regenerateToken:true` que
// creaba uno nuevo. `token` queda siempre `null` en la respuesta;
// `tokenMasked` sigue reflejando, enmascarado, un token YA EXISTENTE de antes
// de esta etapa (nunca en texto plano).
function serializeEmpleado<T extends { token: string | null }>(empleado: T) {
  return {
    ...empleado,
    token: null,
    tokenMasked: maskToken(empleado.token),
    tokenRevealed: false,
  }
}

// PUT - Update empleado
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params

    // Verify ownership
    const existing = await db.empleado.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
      )
    }

    const body = await req.json()
    const { nombre, codigo, rol, activo } = body

    // If codigo is changing, check for duplicates
    if (codigo !== undefined) {
      const trimmedCode = codigo.trim().toUpperCase()
      if (trimmedCode !== existing.codigo) {
        const dup = await db.empleado.findUnique({
          where: { negocioId_codigo: { negocioId, codigo: trimmedCode } },
        })
        if (dup) {
          return NextResponse.json(
            { error: `Ya existe un empleado con el código "${trimmedCode}"` },
            { status: 409 }
          )
        }
      }
    }

    const updateData: Record<string, unknown> = {}
    if (nombre !== undefined) updateData.nombre = nombre.trim()
    if (codigo !== undefined) updateData.codigo = codigo.trim().toUpperCase()
    if (rol !== undefined) updateData.rol = rol
    if (activo !== undefined) updateData.activo = Boolean(activo)

    // Área operativa: la administra el negocio. Se valida contra el allowlist; nunca se
    // acepta `asignacionVersion` del frontend; el servidor incrementa la versión SOLO
    // cuando el área cambia realmente.
    let areaChanged = false
    let nuevaArea: string | null = null
    if (body.areaOperativa !== undefined) {
      const normalized = normalizeAreaOperativa(body.areaOperativa)
      if (normalized === null) {
        return NextResponse.json({ error: "Área operativa inválida" }, { status: 400 })
      }
      if (normalized !== existing.areaOperativa) {
        // No asignar área a empleados eliminados ni inactivos (salvo reactivación en la misma request).
        const quedaraActivo = activo !== undefined ? Boolean(activo) : existing.activo
        if (existing.eliminado || !quedaraActivo) {
          return NextResponse.json(
            { error: "No se puede asignar área a un empleado eliminado o inactivo" },
            { status: 409 }
          )
        }
        // Tarea 20 (Dark Kitchen): "mozo" y "salon" son exclusivamente
        // funciones de Salón — nunca se permite reasignar a ninguna de las
        // dos mientras el negocio no tenga Salón habilitado.
        if (normalized === "mozo" || normalized === "salon") {
          const negocioActual = await db.negocio.findUnique({ where: { id: negocioId }, select: { salonActivo: true } })
          if (!tieneSalonHabilitado(negocioActual)) {
            return NextResponse.json(
              { error: "El negocio no tiene Salón habilitado. Activalo antes de asignar esta área." },
              { status: 409 }
            )
          }
        }
        updateData.areaOperativa = normalized
        updateData.asignacionVersion = { increment: 1 }
        areaChanged = true
        nuevaArea = normalized
      }
    }

    // ── Endurecimiento del ciclo de vida del token legacy (Seguridad-6C.2A + Operaciones-1F) ──
    // El token legacy solo tiene sentido para un empleado activo, no eliminado y con
    // ÁREA EFECTIVA Mozo. Se calcula el estado FINAL que dejará esta actualización.
    const finalActivo = activo !== undefined ? Boolean(activo) : existing.activo
    const finalRol = rol !== undefined ? rol : existing.rol
    const finalArea =
      updateData.areaOperativa !== undefined ? updateData.areaOperativa : existing.areaOperativa
    const areaEfectivaFinal = resolveAreaOperativaEfectiva({ areaOperativa: finalArea, rol: finalRol })
    const quedaMozoActivo = finalActivo && !existing.eliminado && areaEfectivaFinal === "mozo"

    // Revocación en la MISMA escritura: si el estado final deja al empleado inactivo,
    // eliminado o con área efectiva distinta de Mozo (salon/pyr/sin_asignar sin
    // compatibilidad), se anula el token y su pushSubscription junto con el cambio de
    // estado (sin ventana entre dos consultas). Reactivar o devolver Mozo NO regenera
    // nada: el token queda en null.
    //
    // Legacy-Cleanup-1A: se retiró por completo la rama que regeneraba
    // Empleado.token a pedido explícito (`regenerateToken: true` en el body).
    // Ningún consumidor real la invocaba (confirmado antes de este cambio) y
    // la decisión vigente es no volver a emitir ninguna credencial legacy,
    // ni siquiera bajo un pedido explícito. Un token ya existente de antes de
    // esta etapa se preserva tal cual mientras el empleado siga activo con
    // área efectiva Mozo — nunca se reemplaza por uno nuevo.
    if (!quedaMozoActivo) {
      updateData.token = null
      updateData.pushSubscription = null
    }

    const includeCuenta = {
      cuentaOperativa: {
        select: { id: true, nombre: true, activo: true, eliminado: true },
      },
    } as const

    // Única escritura atómica por id. Si correspondía revocar, token/push ya
    // quedaron en null dentro de este mismo update; si el empleado sigue
    // siendo mozo activo, su token existente (si tenía uno) no se toca.
    const updated = await db.empleado.update({
      where: { id },
      data: updateData,
      include: includeCuenta,
    })

    // Auditar el cambio de área (sin datos sensibles).
    if (areaChanged) {
      await auditLog({ userId: negocioId, userType: "negocio", accion: "empleado.area_cambiada", recurso: "empleado", recursoId: updated.id, detalle: { areaOperativa: nuevaArea, asignacionVersion: updated.asignacionVersion } })
    }

    return NextResponse.json(serializeEmpleado(updated))
  } catch (error) {
    console.error("Error updating empleado:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al actualizar empleado" },
      { status: 500 }
    )
  }
}

// DELETE - Delete empleado
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params

    // Verify ownership
    const existing = await db.empleado.findUnique({ where: { id } })
    if (!existing || existing.negocioId !== negocioId) {
      return NextResponse.json(
        { error: "Empleado no encontrado" },
        { status: 404 }
      )
    }

    await db.$transaction([
      db.mesa.updateMany({
        where: { negocioId, empleadoId: id },
        data: { empleadoId: null },
      }),
      db.empleado.update({
        where: { id },
        data: {
          activo: false,
          eliminado: true,
          token: null,
          pushSubscription: null,
        },
      }),
    ])

    return NextResponse.json({ ok: true, message: "Empleado eliminado" })
  } catch (error) {
    console.error("Error deleting empleado:", safeErrorForLog(error))
    return NextResponse.json(
      { error: "Error al eliminar empleado" },
      { status: 500 }
    )
  }
}
