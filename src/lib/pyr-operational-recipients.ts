import { db } from "@/lib/db"
import type { OperationalPushEmployee } from "@/lib/operational-push-targets"

/**
 * Única responsabilidad: resolver los empleados PyR elegibles de un negocio
 * (activos, no eliminados, con CuentaOperativa activa) — mismo criterio
 * exacto ya usado por notifyOperationsOrderCancelled/resolveSalonEmpleados,
 * factorizado para no triplicarlo entre notifyPyrNewOrder,
 * notifyPyrNewReview y notifyPyrChatMessage (P2-T44-R1P2).
 *
 * No envía Push, no persiste Notificacion, no conoce ningún payload —
 * exclusivamente resolución de destinatarios.
 */
export async function resolvePyrOperationalRecipients(
  negocioId: string
): Promise<OperationalPushEmployee[]> {
  return db.empleado.findMany({
    where: {
      negocioId,
      activo: true,
      eliminado: false,
      areaOperativa: "pyr",
      cuentaOperativaId: { not: null },
      cuentaOperativa: { activo: true, eliminado: false },
    },
    select: { id: true, cuentaOperativaId: true, pushSubscription: true },
  })
}
