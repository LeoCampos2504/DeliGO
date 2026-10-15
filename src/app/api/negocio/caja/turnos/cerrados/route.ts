import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { moneyToNumber } from "@/lib/money"
import { requireNegocioCajaGenerico } from "@/lib/negocio-caja-auth"
import { clasificarDiferencia } from "@/lib/caja-turnos-revision"
import { CIERRE_ORIGEN_RECUPERACION, CIERRE_ORIGEN_RESPONSABLE } from "@/lib/caja-turnos-service"

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
        entregasCustodia: { orderBy: { secuencia: "desc" }, take: 1 },
      },
      orderBy: { cerradoEn: "desc" },
      take: 100,
    })
    return NextResponse.json({ turnos: turnos.flatMap((turno) => {
      if (!turno.cerradoEn || !turno.efectivoContadoDecimal || !turno.efectivoEsperadoDecimal) return []
      const diferencia = turno.efectivoContadoDecimal.minus(turno.efectivoEsperadoDecimal)
      const revision = turno.revisionesAdministrativas[0] ?? null
      const entrega = turno.entregasCustodia[0] ?? null
      return [{
        id: turno.id,
        caja: turno.cajaFisica,
        responsableTipo: turno.responsableTipo,
        responsableNombre: turno.responsableTipo === "EMPLEADO" ? (turno.empleado?.nombre ?? "Empleado") : "Dueño",
        abiertoEn: turno.abiertoEn,
        cerradoEn: turno.cerradoEn,
        estado: "CERRADO_DECLARADO" as const,
        // F10-B2.2-G: who really closed it. A recovery is the owner's count, not the employee's declaration.
        cierreOrigen: turno.cierreOrigen === CIERRE_ORIGEN_RECUPERACION ? CIERRE_ORIGEN_RECUPERACION : CIERRE_ORIGEN_RESPONSABLE,
        cerradoPor: turno.cierreOrigen === CIERRE_ORIGEN_RECUPERACION ? "Dueño (recuperación administrativa)" : (turno.responsableTipo === "EMPLEADO" ? (turno.empleado?.nombre ?? "Empleado") : "Dueño"),
        motivoRecuperacion: turno.cierreOrigen === CIERRE_ORIGEN_RECUPERACION ? turno.cierreMotivo : null,
        fondoInicial: moneyToNumber(turno.fondoInicialDecimal),
        efectivoEsperado: moneyToNumber(turno.efectivoEsperadoDecimal),
        efectivoContado: moneyToNumber(turno.efectivoContadoDecimal),
        efectivoContadoExacto: turno.efectivoContadoDecimal.toFixed(2),
        diferencia: moneyToNumber(diferencia),
        resultado: clasificarDiferencia(diferencia),
        estadoRevision: revision ? "REVISADO" as const : "PENDIENTE_REVISION" as const,
        ultimaRevisionEn: revision?.createdAt ?? null,
        estadoEntrega: entrega ? "ENTREGA_CONFIRMADA" as const : "PENDIENTE_ENTREGA" as const,
        entregaActual: entrega ? {
          tipo: entrega.tipo,
          efectivoEntregado: moneyToNumber(entrega.efectivoEntregadoDecimal),
          fondoRemanente: moneyToNumber(entrega.fondoRemanenteDecimal),
          destinoTipo: entrega.destinoTipo,
          destinoNombre: entrega.destinoNombre,
          actor: "Dueño",
          confirmadoEn: entrega.confirmadoEn,
          observacion: entrega.observacion,
        } : null,
      }]
    }) })
  } catch (error) {
    console.error("Error listing closed cash shifts:", safeErrorForLog(error))
    return NextResponse.json({ error: "Error al obtener los turnos cerrados" }, { status: 500 })
  }
}

