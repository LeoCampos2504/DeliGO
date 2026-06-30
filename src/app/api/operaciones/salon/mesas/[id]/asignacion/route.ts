import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireOperacionesArea, hasTerminalScope } from "@/lib/operaciones-terminal-access"
import { auditLog } from "@/lib/audit"

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

// Mensaje genérico de conflicto: no revela negocio, IDs, estado de la mesa en otra
// terminal, ni detalles de la validación.
const CONFLICT_MESSAGE = "La mesa cambió en otro dispositivo. Actualizá el panel."

function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

function badRequest() {
  return NextResponse.json({ ok: false, error: "Solicitud inválida" }, { status: 400, headers: NO_STORE_HEADERS })
}

function forbidden() {
  return NextResponse.json(
    { ok: false, error: "Esta terminal no tiene permiso para realizar esa acción." },
    { status: 403, headers: NO_STORE_HEADERS }
  )
}

function conflict() {
  return NextResponse.json({ ok: false, error: CONFLICT_MESSAGE }, { status: 409, headers: NO_STORE_HEADERS })
}

// PATCH — Asigna, reasigna o libera el mozo responsable de una mesa desde una
// Terminal Operativa. El negocio sale SIEMPRE del contexto seguro de la terminal.
//
// Body permitido (cualquier otro campo se ignora):
//   { "empleadoId": "<id>" }  → asignar / reasignar (requiere salon.mesas.reasignar)
//   { "empleadoId": null   }  → liberar              (requiere salon.mesas.liberar)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1) Sesión válida de terminal + acceso al área Salón (401 / 403). Nunca confía en la UI.
    const auth = await requireOperacionesArea(req, "salon")
    if (!auth.ok) return auth.response
    const ctx = auth.context
    const negocioId = ctx.negocio.id

    const { id } = await params

    // 2) Solo se acepta `empleadoId` (string o null) del body. Todo lo demás se ignora.
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body) || !("empleadoId" in body)) {
      return badRequest()
    }
    const rawEmpleadoId = (body as Record<string, unknown>).empleadoId
    let empleadoId: string | null
    if (rawEmpleadoId === null) {
      empleadoId = null
    } else if (typeof rawEmpleadoId === "string" && rawEmpleadoId.trim().length > 0) {
      empleadoId = rawEmpleadoId.trim()
    } else {
      return badRequest()
    }

    const isLiberar = empleadoId === null

    // 3) Scope según la acción (la autoridad real vive en el servidor, no en la UI).
    const requiredScope = isLiberar ? "salon.mesas.liberar" : "salon.mesas.reasignar"
    if (!hasTerminalScope(ctx, requiredScope)) {
      return forbidden()
    }

    // 4) Mesa SIEMPRE acotada al negocio de la terminal y activa (semántica real del Salón:
    //    no se opera sobre mesas inactivas). Inexistente / ajena / inactiva → 409 genérico.
    const mesa = await db.mesa.findFirst({
      where: { id, negocioId, activa: true },
      select: { id: true, empleadoId: true },
    })
    if (!mesa) return conflict()

    // 5) Validar el empleado destino dentro del mismo negocio y con la elegibilidad real
    //    para atender mesas (idéntica a la del Salón existente): mozo activo no eliminado.
    let nuevoEmpleado: { id: string; nombre: string } | null = null
    if (!isLiberar) {
      const empleado = await db.empleado.findFirst({
        where: { id: empleadoId as string, negocioId, rol: "mozo", activo: true, eliminado: false },
        select: { id: true, nombre: true },
      })
      // Empleado inexistente / de otro negocio / inactivo / no-mozo → 409 genérico.
      if (!empleado) return conflict()
      nuevoEmpleado = empleado
    }

    // 6) Actualización condicional atómica (compare-and-swap por la asignación leída en
    //    servidor): si otra terminal cambió la mesa en el medio, gana una sola operación.
    const result = await db.mesa.updateMany({
      where: { id, negocioId, activa: true, empleadoId: mesa.empleadoId },
      data: { empleadoId: isLiberar ? null : nuevoEmpleado!.id },
    })
    if (result.count !== 1) return conflict()

    // 7) Auditoría best-effort con el mecanismo existente (acción dedicada `mesa.mozo_asignado`).
    //    Un fallo de auditoría no revierte la acción ya confirmada. Sin payloads ni objetos error.
    try {
      await auditLog({
        userId: ctx.terminal.id,
        userType: "terminal_operativa",
        accion: "mesa.mozo_asignado",
        recurso: "mesa",
        recursoId: mesa.id,
        detalle: {
          accion: isLiberar ? "liberar" : mesa.empleadoId ? "reasignar" : "asignar",
          empleadoAnteriorId: mesa.empleadoId,
          empleadoNuevoId: isLiberar ? null : nuevoEmpleado!.id,
        },
      })
    } catch {
      console.error("[OperacionesSalon] Falló la auditoría de asignación de mesa")
    }

    return NextResponse.json(
      {
        ok: true,
        mesa: {
          id: mesa.id,
          empleado: nuevoEmpleado ? { nombre: nuevoEmpleado.nombre } : null,
        },
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch {
    console.error("[OperacionesSalon] Falló la asignación de mesa")
    return noStore(NextResponse.json({ ok: false, error: "Error del servidor" }, { status: 500 }))
  }
}
