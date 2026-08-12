// ============================================
// DeliGO — Cancelación segura de pedidos de mesa (23-A1)
// ============================================
// Dominio + autorización + persistencia atómica para cancelar un pedido de
// mesa COMPLETO cargado por error. Sin UI (23-A2). Reutiliza al máximo la
// infraestructura existente:
//   - ESTADOS_PENDIENTES_MESA (src/lib/mesa-cuenta.ts) como única lista de
//     estados cancelables — la misma que ya usa buildCuentaMesa/P2.
//   - revertirTarifaSiCorresponde (src/lib/pedido-cancelacion-financiera.ts)
//     — mismo helper que usan negocio/PyR/cliente/repartidor al cancelar.
//   - PedidoEvento — se crea directamente dentro de esta transacción para que
//     el cambio de estado y su auditoría formen una única unidad atómica. No
//     se crea ningún modelo ni sistema de auditoría nuevo.
//   - resolveAreaOperativaEfectiva (src/lib/area-operativa.ts) — única fuente
//     de verdad del área personal (nunca "rol").
//   - requireOperacionesArea (src/lib/operaciones-terminal-access.ts) —
//     autorización real de Terminal Operativa, sin modificarla.
//
// No existía ningún endpoint de cancelación para Mozo/Salón (personal o
// terminal) antes de esta etapa — los únicos cuatro sitios que ya escriben
// `estado: "cancelado"` son Negocio, PyR (no-mesa), Cliente y
// Repartidor/sistema; ninguno cubre mesa. Este módulo llena ese vacío sin
// tocar ninguno de los cuatro existentes.
//
// `resolveMesaOccupancyCloseActor` (mesa-occupancy.ts) fue evaluado como base
// pero NO se reutiliza: colapsa Salón personal y Salón terminal en el mismo
// `type:"salon"`, y esta tarea exige distinguirlos (permisos y auditoría). Se
// construye acá un resolver nuevo con la misma lógica/orden de sesiones
// (negocio dueño → cuenta operativa personal → terminal), sin modificar el
// resolver existente (que sigue usándose, sin cambios, por el cierre de
// ocupación).

import { NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import {
  SESSION_COOKIE_NAME,
  OPERATIONAL_SESSION_COOKIE_NAME,
  findSesionByToken,
  validateOperationalSession,
} from "@/lib/auth"
import { resolveAreaOperativaEfectiva } from "@/lib/area-operativa"
import { requireOperacionesArea } from "@/lib/operaciones-terminal-access"
import { ESTADOS_PENDIENTES_MESA } from "@/lib/mesa-cuenta"
import { revertirTarifaSiCorresponde, DeudaReversionError } from "@/lib/pedido-cancelacion-financiera"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ---------------------------------------------------------------------------
// Validación del motivo (sección 11)
// ---------------------------------------------------------------------------
// 23-A2: constantes y función pura extraídas a mesa-pedido-cancelacion-contract.ts
// (sin Prisma/next/auth) para que la UI las importe sin arrastrar código
// server-only. Reexportadas acá tal cual — mismo comportamiento, ningún
// cambio de validación, status code ni autorización. route.ts y
// mesa-pedido-cancelacion.test.ts siguen importando estos símbolos desde
// este archivo sin modificación.
export {
  MOTIVO_CANCELACION_MIN_LEN,
  MOTIVO_CANCELACION_MAX_LEN,
  validarMotivoCancelacionMesa,
  type ValidacionMotivoCancelacion,
} from "@/lib/mesa-pedido-cancelacion-contract"

// ---------------------------------------------------------------------------
// Actor (sección 9, 10) — resolución EXCLUSIVA desde sesión server-side
// ---------------------------------------------------------------------------

// Mismo vocabulario para Pedido.canceladoPor y PedidoEvento.userType (ambos
// campos son strings libres, sin constraint de DB — ver auditoría de
// schema.prisma en CODEX_REPORT.md). "negocio"/"vendedor"/"sistema" (valores
// ya usados por los 4 endpoints de cancelación existentes) no se reutilizan
// para mesa a propósito: se necesitan 4 valores distintos y auditables para
// separar Salón personal de Salón terminal, cosa que ningún valor existente
// permite.
export type MesaPedidoCancelActorType = "negocio_admin" | "salon_personal" | "salon_terminal" | "mozo"

export interface MesaPedidoCancelActor {
  type: MesaPedidoCancelActorType
  negocioId: string
  actorId: string
  nombre: string
}

const PEDIDO_SCOPE_SELECT = { id: true } as const

export type ResolverActorCancelacionResultado =
  | { ok: true; actor: MesaPedidoCancelActor }
  | { ok: false; status: 401; reason: "no_session" }
  | { ok: false; status: 403; reason: "no_permission" }
  | { ok: false; status: 404; reason: "not_found" }

/**
 * Resuelve QUIÉN pide cancelar y, en el mismo paso, confirma que el pedido
 * pertenece al negocio de ese actor — nunca al revés. Evitar deliberadamente
 * "buscar el pedido primero y comparar negocioId después": eso permitiría
 * distinguir por status HTTP si un pedido existe bajo OTRO negocio (fuga
 * prohibida por la sección 16/17). Acá, cada rama ya conoce su propio
 * negocioId (de la sesión, nunca del cliente) y escanea el pedido acotado a
 * ESE negocio — un pedido ajeno y un pedido inexistente producen exactamente
 * la misma respuesta (404).
 *
 * Orden de sesiones (idéntico al ya usado por resolveMesaOccupancyCloseActor,
 * sin modificarlo): negocio dueño → cuenta operativa personal (Salón/Mozo,
 * por ÁREA EFECTIVA real) → Terminal Operativa (Salón). Una cuenta operativa
 * puede estar vinculada a Empleados de varios negocios (multi-negocio); se
 * eligen todos sus negocios candidatos y se busca el pedido dentro de ese
 * conjunto — nunca se exige un slug ni se confía en un negocioId enviado por
 * el cliente. PyR (personal o terminal) y Cliente nunca producen un actor
 * válido acá (sección 9E/9F): caen al `no_permission` final.
 */
export async function resolverActorCancelacionMesa(
  request: NextRequest,
  pedidoId: string
): Promise<ResolverActorCancelacionResultado> {
  let autenticadoComoAlguien = false

  // 1) Negocio dueño — sesión `deligo_session`, tipo "negocio".
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (sessionToken) {
    const session = await findSesionByToken(sessionToken)
    if (session) {
      autenticadoComoAlguien = true
      if (session.userType === "negocio") {
        const pedido = await db.pedido.findFirst({
          where: { id: pedidoId, negocioId: session.userId },
          select: PEDIDO_SCOPE_SELECT,
        })
        if (!pedido) return { ok: false, status: 404, reason: "not_found" }
        return {
          ok: true,
          actor: { type: "negocio_admin", negocioId: session.userId, actorId: session.userId, nombre: "" },
        }
      }
    }
  }

  // 2) Cuenta Operativa personal (Salón o Mozo, según área EFECTIVA real).
  const operativoToken = request.cookies.get(OPERATIONAL_SESSION_COOKIE_NAME)?.value
  if (operativoToken) {
    const operativoSession = await validateOperationalSession(operativoToken)
    if (operativoSession) {
      autenticadoComoAlguien = true
      const empleados = await db.empleado.findMany({
        where: { cuentaOperativaId: operativoSession.cuentaOperativaId, activo: true, eliminado: false },
        select: { id: true, nombre: true, negocioId: true, areaOperativa: true, rol: true },
      })
      const negocioIds = empleados.map((empleado) => empleado.negocioId)
      if (negocioIds.length > 0) {
        const pedido = await db.pedido.findFirst({
          where: { id: pedidoId, negocioId: { in: negocioIds } },
          select: { id: true, negocioId: true },
        })
        if (!pedido) return { ok: false, status: 404, reason: "not_found" }

        const empleado = empleados.find((candidato) => candidato.negocioId === pedido.negocioId)
        // No debería poder ser undefined (negocioIds viene de empleados), pero
        // se trata como "sin permiso" en vez de asumir/lanzar.
        if (!empleado) return { ok: false, status: 403, reason: "no_permission" }

        const area = resolveAreaOperativaEfectiva({ areaOperativa: empleado.areaOperativa, rol: empleado.rol })
        if (area === "salon") {
          return {
            ok: true,
            actor: { type: "salon_personal", negocioId: pedido.negocioId, actorId: empleado.id, nombre: empleado.nombre },
          }
        }
        if (area === "mozo") {
          return {
            ok: true,
            actor: { type: "mozo", negocioId: pedido.negocioId, actorId: empleado.id, nombre: empleado.nombre },
          }
        }
        // "pyr" / "sin_asignar": identidad válida, sin permiso para cancelar.
        return { ok: false, status: 403, reason: "no_permission" }
      }
    }
  }

  // 3) Terminal Operativa — únicamente área "salon" (Mozo nunca opera por
  // terminal en el proyecto; PyR nunca cancela mesa — sección 9E).
  const terminalAuth = await requireOperacionesArea(request, "salon")
  if (terminalAuth.ok) {
    autenticadoComoAlguien = true
    const pedido = await db.pedido.findFirst({
      where: { id: pedidoId, negocioId: terminalAuth.context.negocio.id },
      select: PEDIDO_SCOPE_SELECT,
    })
    if (!pedido) return { ok: false, status: 404, reason: "not_found" }
    return {
      ok: true,
      actor: {
        type: "salon_terminal",
        negocioId: terminalAuth.context.negocio.id,
        actorId: terminalAuth.context.terminal.id,
        nombre: terminalAuth.context.terminal.nombre,
      },
    }
  }
  if (terminalAuth.response.status === 403) {
    autenticadoComoAlguien = true
  }

  return autenticadoComoAlguien
    ? { ok: false, status: 403, reason: "no_permission" }
    : { ok: false, status: 401, reason: "no_session" }
}

// ---------------------------------------------------------------------------
// Cancelación atómica (secciones 3, 7, 8, 12, 13, 14)
// ---------------------------------------------------------------------------

export type CancelarPedidoMesaResultado =
  | { kind: "ok"; estadoAnterior: string; canceladoFecha: Date; motivo: string }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "invalid_estado" }
  | { kind: "sin_ocupacion" }
  | { kind: "conflict" }
  | { kind: "server_error" }

type PedidoEventoCreateData = Prisma.PedidoEventoCreateArgs["data"]

/**
 * Costura interna para probar de forma focalizada el rollback si falla la
 * auditoría. Producción siempre toma la rama explícita `tx.pedidoEvento.create`;
 * ningún endpoint ni input de usuario puede activar esta dependencia.
 */
export interface CancelarPedidoMesaInternals {
  crearPedidoEvento?: (tx: Prisma.TransactionClient, data: PedidoEventoCreateData) => Promise<unknown>
}

/**
 * Cancela COMPLETO un pedido de mesa, o falla de forma controlada. Todo el
 * trabajo de validación + escritura ocurre DENTRO de una única transacción
 * `Serializable` (mismo nivel de aislamiento que ya usa
 * operativo/mozo/pedidos/[id]/entregar/route.ts para cerrar exactamente esta
 * misma clase de carrera: reasignación de mesa entre la revalidación del
 * actor y el CAS). Nunca confía en una lectura hecha fuera de la
 * transacción — todo se relee fresco acá adentro.
 *
 * El CAS final (`updateMany`) codifica TODAS las condiciones estructurales
 * en una sola escritura atómica: id + negocio + estado anterior EXACTO +
 * ocupación exacta + ocupación todavía activa (filtro por relación). Ninguna
 * combinación de "leer, decidir, escribir" queda sin condición equivalente
 * en el propio WHERE de la escritura — así, una cuenta que se cierra, un
 * pedido que otro actor cancela, o una ocupación que expira entre la lectura
 * y el intento de cancelar, SIEMPRE hacen que `count !== 1` (conflicto
 * genérico 409), nunca que la cancelación se aplique sobre un estado
 * distinto al que se validó.
 *
 * Doble cancelación: un segundo intento sobre un pedido ya `cancelado` nunca
 * llega al CAS (falla antes, en el chequeo de `ESTADOS_PENDIENTES_MESA`) —
 * nunca se crea un segundo evento de auditoría ni se sobrescribe
 * motivo/fecha/actor original.
 */
export async function cancelarPedidoMesa(params: {
  pedidoId: string
  motivo: string
  actor: MesaPedidoCancelActor
}, internals: CancelarPedidoMesaInternals = {}): Promise<CancelarPedidoMesaResultado> {
  const { pedidoId, motivo, actor } = params

  try {
    return await db.$transaction(
      async (tx) => {
        // Sección 8: método mesa + acotado al negocio del actor (nunca al
        // negocio enviado por el cliente).
        const pedido = await tx.pedido.findFirst({
          where: { id: pedidoId, negocioId: actor.negocioId, metodoEntrega: "mesa" },
          select: { id: true, estado: true, mesaId: true, ocupacionMesaId: true },
        })
        if (!pedido) return { kind: "not_found" as const }

        // Pedido legacy sin ocupacionMesaId (sección 8): no cancelable por
        // esta operación, nunca se auto-vincula acá. Tampoco cancelable sin
        // mesaId (no debería ocurrir si metodoEntrega es "mesa", pero se
        // trata igual por seguridad — deny-by-default).
        if (!pedido.mesaId || !pedido.ocupacionMesaId) {
          return { kind: "sin_ocupacion" as const }
        }

        // Sección 7: allowlist explícita y cerrada — ESTADOS_PENDIENTES_MESA
        // es la MISMA lista que ya usan mesa-cuenta.ts/buildCuentaMesa y el
        // cierre comercial de ocupación. "entregado"/"cancelado"/cualquier
        // estado desconocido caen acá (deny-by-default, nunca
        // `!== "entregado"`).
        if (!(ESTADOS_PENDIENTES_MESA as readonly string[]).includes(pedido.estado)) {
          return { kind: "invalid_estado" as const }
        }

        // Sección 9A: Mozo solo si la mesa está asignada A ÉL en este mismo
        // instante (revalidación fresca, dentro de la transacción
        // Serializable — nunca se confía en un chequeo anterior).
        if (actor.type === "mozo") {
          const mesaAsignada = await tx.mesa.findFirst({
            where: { id: pedido.mesaId, negocioId: actor.negocioId, empleadoId: actor.actorId },
            select: { id: true },
          })
          if (!mesaAsignada) return { kind: "forbidden" as const }
        }

        // Una única fecha representa toda la operación: Pedido, PedidoEvento
        // y respuesta de dominio quedan temporalmente coherentes.
        const canceladoEn = new Date()

        // CAS atómico: estado exacto + ocupación exacta + ocupación todavía
        // activa (filtro por relación, resuelto en el mismo UPDATE). Cubre en
        // una sola condición: doble cancelación, cuenta/ocupación cerrada
        // entre la lectura y este punto, y cualquier cambio de estado
        // concurrente (PyR/otro actor).
        const cas = await tx.pedido.updateMany({
          where: {
            id: pedidoId,
            negocioId: actor.negocioId,
            estado: pedido.estado,
            ocupacionMesaId: pedido.ocupacionMesaId,
            ocupacionMesa: { estado: "activa" },
          },
          data: {
            estado: "cancelado",
            canceladoPor: actor.type,
            canceladoMotivo: motivo,
            canceladoFecha: canceladoEn,
          },
        })
        if (cas.count !== 1) return { kind: "conflict" as const }

        // Mismo helper que usan los 4 endpoints de cancelación existentes —
        // relee tarifaServicio/deudaAcumulada frescos DENTRO de esta misma
        // transacción. Hoy es un no-op para mesa (tarifaServicio siempre 0),
        // pero se llama igual por consistencia con la convención del
        // proyecto.
        await revertirTarifaSiCorresponde(tx, { id: pedidoId, negocioId: actor.negocioId })

        const eventoData: PedidoEventoCreateData = {
          pedidoId,
          estado: "cancelado",
          estadoAnterior: pedido.estado,
          userId: actor.actorId,
          userType: actor.type,
          nota: motivo,
          fecha: canceladoEn,
        }

        // La auditoría es parte obligatoria de la misma transacción
        // Serializable. No se captura el error: si falla, Prisma revierte el
        // CAS y cualquier reversión financiera previa.
        if (internals.crearPedidoEvento) {
          await internals.crearPedidoEvento(tx, eventoData)
        } else {
          await tx.pedidoEvento.create({ data: eventoData })
        }

        return { kind: "ok" as const, estadoAnterior: pedido.estado, canceladoFecha: canceladoEn, motivo }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  } catch (error) {
    if (error instanceof DeudaReversionError) {
      console.error("[MesaPedidoCancelacion] Reversión de deuda falló:", safeErrorForLog(error))
      return { kind: "server_error" }
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      // Conflicto Serializable esperado: no se reintenta para no duplicar
      // efectos ni presentar una respuesta engañosa.
      return { kind: "conflict" }
    }
    console.error("[MesaPedidoCancelacion] Error en la transacción de cancelación:", safeErrorForLog(error))
    return { kind: "server_error" }
  }
}
