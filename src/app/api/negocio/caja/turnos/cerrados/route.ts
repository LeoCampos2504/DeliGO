import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { moneyToNumber } from "@/lib/money"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { clasificarDiferencia } from "@/lib/caja-turnos-revision"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireNegocioCajaGenerico(req)
    if (!auth.ok) return auth.response
    const turnos = await db.turnoCaja.findMany({
      where: { negocioId: auth.negocioId, estado: "CERRADO_DECLARADO" },
      include: {
        cajaFisica: { select: { id: true, nombre: true } },
        empleado: { select: { nombre: true } },
        revisionesAdministrativas: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { cerradoEn: "desc" },
      take: 100,
    })
    return NextResponse.json({ turnos: turnos.flatMap((turno) => {
      if (!turno.cerradoEn || !turno.efectivoContadoDecimal || !turno.efectivoEsperadoDecimal) return []
      const diferencia = turno.efectivoContadoDecimal.minus(turno.efectivoEsperadoDecimal)
      const revision = turno.revisionesAdministrativas[0] ?? null
      return [{
        id: turno.id,
        caja: turno.cajaFisica,
        responsableTipo: turno.responsableTipo,
        responsableNombre: turno.responsableTipo === "EMPLEADO" ? (turno.empleado?.nombre ?? "Empleado") : "Dueño",
        abiertoEn: turno.abiertoEn,
        cerradoEn: turno.cerradoEn,
        estado: "CERRADO_DECLARADO" as const,
        fondoInicial: moneyToNumber(turno.fondoInicialDecimal),
        efectivoEsperado: moneyToNumber(turno.efectivoEsperadoDecimal),
        efectivoContado: moneyToNumber(turno.efectivoContadoDecimal),
        diferencia: moneyToNumber(diferencia),
        resultado: clasificarDiferencia(diferencia),
        estadoRevision: revision ? "REVISADO" as const : "PENDIENTE_REVISION" as const,
        ultimaRevisionEn: revision?.createdAt ?? null,
      }]
    }) })
  } catch (error) {
    console.error("Error listing closed cash shifts:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener los turnos cerrados" }, { status: 500 })
  }
}
