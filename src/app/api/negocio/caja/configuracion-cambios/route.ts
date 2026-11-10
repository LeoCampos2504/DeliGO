import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { UMBRAL_ANTIGUEDAD_DIAS_PREDETERMINADO, UMBRAL_CADENA_CAMBIOS_PREDETERMINADO } from "@/lib/caja-cambios-service"

// ============================================
// F4-C5 (D3/D4) — owner ONLY: thresholds of the informative exchange warnings (P1)
// ============================================
// null = the default (30 days / 3 previous exchanges). The warnings never block
// an exchange; these numbers only decide when they are shown. Same ranges as
// the SQL CHECKs of migration 20261109120000. The audit records WHICH fields
// changed, never their values (like the business configuration).

const LIMITES = { antiguedadDias: { min: 1, max: 3650 }, cadenaCambios: { min: 1, max: 1000 } } as const
type Campo = keyof typeof LIMITES

function respuesta(n: { cambioAvisoAntiguedadDias: number | null; cambioAvisoCadenaCambios: number | null }) {
  return {
    ok: true,
    configurados: { antiguedadDias: n.cambioAvisoAntiguedadDias, cadenaCambios: n.cambioAvisoCadenaCambios },
    predeterminados: { antiguedadDias: UMBRAL_ANTIGUEDAD_DIAS_PREDETERMINADO, cadenaCambios: UMBRAL_CADENA_CAMBIOS_PREDETERMINADO },
    vigentes: {
      antiguedadDias: n.cambioAvisoAntiguedadDias ?? UMBRAL_ANTIGUEDAD_DIAS_PREDETERMINADO,
      cadenaCambios: n.cambioAvisoCadenaCambios ?? UMBRAL_CADENA_CAMBIOS_PREDETERMINADO,
    },
  }
}

const SELECT = { cambioAvisoAntiguedadDias: true, cambioAvisoCadenaCambios: true } as const

export async function GET(req: NextRequest) {
  const auth = await requireNegocioCajaGenerico(req)
  if (!auth.ok) return auth.response
  const negocio = await db.negocio.findUnique({ where: { id: auth.negocioId }, select: SELECT })
  if (!negocio) return NextResponse.json({ ok: false, error: "Negocio no encontrado" }, { status: 404 })
  return NextResponse.json(respuesta(negocio), { headers: { "Cache-Control": "no-store" } })
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Datos inválidos." }, { status: 400 })
    const data: { cambioAvisoAntiguedadDias?: number | null; cambioAvisoCadenaCambios?: number | null } = {}
    for (const campo of Object.keys(LIMITES) as Campo[]) {
      if (!(campo in body)) continue
      const valor = body[campo]
      if (valor !== null && !(typeof valor === "number" && Number.isInteger(valor) && valor >= LIMITES[campo].min && valor <= LIMITES[campo].max)) {
        return NextResponse.json({ ok: false, error: `El valor debe ser un número entero entre ${LIMITES[campo].min} y ${LIMITES[campo].max}, o vacío para usar el predeterminado.`, code: "UMBRAL_INVALIDO", campo }, { status: 400 })
      }
      data[campo === "antiguedadDias" ? "cambioAvisoAntiguedadDias" : "cambioAvisoCadenaCambios"] = valor as number | null
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ ok: false, error: "No hay cambios para guardar." }, { status: 400 })
    const negocio = await db.negocio.update({ where: { id: auth.negocioId }, data, select: SELECT })
    await auditLog({ userId: auth.negocioId, userType: "negocio", accion: "negocio.config_cambiada", recurso: "negocio", recursoId: auth.negocioId, detalle: { camposActualizados: Object.keys(data) } })
    return NextResponse.json(respuesta(negocio))
  } catch (error) {
    console.error("Error updating exchange warning thresholds:", safeErrorForLog(error))
    return NextResponse.json({ ok: false, error: "No pudimos guardar la configuración." }, { status: 500 })
  }
}
