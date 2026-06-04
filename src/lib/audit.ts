// DeliGO - Audit Log Utility
// Registers who did what and when for security tracking

import { db } from "@/lib/db"

export type AuditAction =
  // Productos
  | "producto.creado"
  | "producto.modificado"
  | "producto.eliminado"
  | "producto.precio_cambiado"
  | "producto.stock_cambiado"
  // Pedidos
  | "pedido.creado"
  | "pedido.estado_cambiado"
  | "pedido.cancelado"
  // Empleados
  | "empleado.creado"
  | "empleado.modificado"
  | "empleado.eliminado"
  // Negocio
  | "negocio.suspendido"
  | "negocio.reactivado"
  | "negocio.config_cambiada"
  | "negocio.promocionado"
  // Repartidor
  | "repartidor.creado"
  | "repartidor.asociado"
  | "repartidor.eliminado"
  // Reseñas
  | "resena.respondida"
  // Mesas
  | "mesa.creada"
  | "mesa.eliminada"
  | "mesa.mozo_asignado"
  // General
  | "sesion.login"
  | "sesion.logout"

interface AuditLogParams {
  userId: string
  userType: string
  accion: string
  recurso: string
  recursoId?: string
  detalle?: Record<string, unknown>
  ip?: string
}

/**
 * Log an audit event to the database.
 * This is fire-and-forget — errors are logged but don't fail the main operation.
 */
export async function auditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId,
        userType: params.userType,
        accion: params.accion,
        recurso: params.recurso,
        recursoId: params.recursoId || "",
        detalle: JSON.stringify(params.detalle || {}),
        ip: params.ip || "",
      },
    })
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error("[AuditLog] Failed to write audit log:", error)
  }
}

/**
 * Log a pedido status change (creates both AuditLog and PedidoEvento)
 */
export async function logPedidoEstadoChange(params: {
  pedidoId: string
  estadoNuevo: string
  estadoAnterior: string
  userId?: string
  userType?: string
  nota?: string
}): Promise<void> {
  try {
    // Create PedidoEvento
    await db.pedidoEvento.create({
      data: {
        pedidoId: params.pedidoId,
        estado: params.estadoNuevo,
        estadoAnterior: params.estadoAnterior,
        userId: params.userId || null,
        userType: params.userType || null,
        nota: params.nota || "",
      },
    })

    // Create AuditLog
    if (params.userId) {
      await auditLog({
        userId: params.userId,
        userType: params.userType || "sistema",
        accion: "pedido.estado_cambiado",
        recurso: "pedido",
        recursoId: params.pedidoId,
        detalle: {
          estadoAnterior: params.estadoAnterior,
          estadoNuevo: params.estadoNuevo,
          nota: params.nota,
        },
      })
    }
  } catch (error) {
    console.error("[AuditLog] Failed to log pedido estado change:", error)
  }
}
