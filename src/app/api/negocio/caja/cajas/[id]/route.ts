import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { actualizarCajaFisica } from "@/lib/caja-turnos-service"

// ============================================
// F10-B2.1 — owner: configure ONE register of their business
// ============================================
// PATCH { nombre?, descripcion?, activa?, esPredeterminada?: true }.
// Never deletes: a register keeps its shifts and sales as history. Cannot
// deactivate the default register or one with an open shift.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const { id } = await params
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
    const result = await actualizarCajaFisica(db, auth.negocioId, id, {
      nombre: body.nombre,
      descripcion: body.descripcion,
      activa: body.activa,
      esPredeterminada: body.esPredeterminada,
    })
    if (!result.ok) return NextResponse.json(result.code ? { error: result.error, code: result.code } : { error: result.error }, { status: result.status })
    const c = result.value
    await auditLog({
      userId: auth.negocioId,
      userType: "negocio",
      accion: "caja_fisica.actualizada",
      recurso: "caja_fisica",
      recursoId: c.id,
      detalle: { nombre: c.nombre, activa: c.activa, esPredeterminada: c.esPredeterminada },
    })
    return NextResponse.json({ id: c.id, nombre: c.nombre, descripcion: c.descripcion, esPredeterminada: c.esPredeterminada, activa: c.activa })
  } catch (error) {
    console.error("Error updating caja física:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al actualizar la caja" }, { status: 500 })
  }
}
