import { Prisma } from "@prisma/client"

// DeliGO - Reversión financiera única al cancelar un pedido (Seguridad-2C / 2C.1)
//
// Centraliza EXCLUSIVAMENTE la decisión de revertir la tarifa de servicio dentro de una
// transacción YA ABIERTA por el endpoint llamante. Este helper:
//   - no autentica usuarios ni decide permisos/scopes;
//   - no lee body/query ni construye negocioId a partir de datos de frontend;
//   - no envía notificaciones ni toca UI;
//   - no decide si el pedido puede cancelarse (eso es responsabilidad del CAS de
//     estado que cada endpoint ya ejecuta antes de llamar a este helper).
// Cada endpoint conserva su propia autorización, su propio filtro por negocio y su
// propio CAS de transición de estado; este helper solo se invoca DESPUÉS de que el
// pedido ya ganó su transición atómica a "cancelado" dentro de la misma transacción.
//
// Seguridad-2C.1: el helper YA NO recibe `tarifaServicio`/`deudaAcumulada` como
// snapshot leído por el llamador antes de abrir la transacción. Ese snapshot podía
// quedar desactualizado si, entre la lectura previa y el CAS de cancelación, otra
// transacción (p. ej. la confirmación de recepción del cliente) procesaba el cobro en
// paralelo — el CAS de estado seguía ganando (no tocaba `estado`), pero el helper
// revertía con datos viejos y no detectaba la deuda recién cargada. Por eso ahora
// relee el pedido DENTRO de la propia transacción, DESPUÉS de que el llamador ya ganó
// el CAS a "cancelado", garantizando que la decisión financiera vea siempre el dato
// más reciente y consistente con el resto de la transacción.

export class DeudaReversionError extends Error {}

export interface PedidoParaReversion {
  id: string
  negocioId: string
}

/**
 * Revierte la tarifa de un pedido recién cancelado, una única vez, dentro de la
 * transacción provista por el llamador. El llamador debe invocar este helper
 * INMEDIATAMENTE DESPUÉS de ganar su propio CAS que puso `estado:"cancelado"` en la
 * misma transacción — nunca antes.
 *
 * Paso A: relee el pedido dentro de la transacción, ya cancelado y acotado al negocio
 * correcto. Si no existe (el CAS del llamador no se aplicó de verdad, o hay una
 * inconsistencia), lanza `DeudaReversionError` para forzar rollback completo.
 *
 * Paso B: solo actúa si hay evidencia persistida y fresca de que la confirmación de
 * recepción procesó el cobro: `deudaAcumulada === true && tarifaServicio > 0`. Nunca
 * infiere una deuda a partir de `tarifaServicio` solo.
 *
 * Paso C: revierte `Negocio.deudaTarifa` de forma condicional (nunca queda negativa).
 * Si `Negocio.deudaTarifa` no alcanza, lanza `DeudaReversionError`.
 *
 * Paso D: consume la marca `deudaAcumulada` con un `updateMany` condicional (nunca un
 * `update` libre), para que una segunda reversión no pueda repetirse.
 *
 * En cualquier caso de `DeudaReversionError`, el llamador NO debe capturarlo dentro
 * del propio callback de `$transaction` — debe dejarlo propagar para que Prisma
 * revierta también el cambio de estado a "cancelado" ya aplicado en la misma
 * transacción.
 */
export async function revertirTarifaSiCorresponde(
  tx: Prisma.TransactionClient,
  pedido: PedidoParaReversion
): Promise<void> {
  // Paso A — lectura fresca dentro de la transacción, después del CAS de cancelación.
  const actual = await tx.pedido.findFirst({
    where: {
      id: pedido.id,
      negocioId: pedido.negocioId,
      estado: "cancelado",
    },
    select: {
      tarifaServicio: true,
      deudaAcumulada: true,
    },
  })

  if (!actual) {
    throw new DeudaReversionError()
  }

  // Paso B — decidir si corresponde reversión, con datos frescos. Nunca infiere deuda
  // a partir de tarifaServicio solo cuando deudaAcumulada es false.
  if (actual.deudaAcumulada !== true || actual.tarifaServicio <= 0) {
    return
  }

  // Paso C — revertir deuda de forma condicional (nunca queda negativa).
  const negocioUpdate = await tx.negocio.updateMany({
    where: {
      id: pedido.negocioId,
      deudaTarifa: { gte: actual.tarifaServicio },
    },
    data: {
      deudaTarifa: { decrement: actual.tarifaServicio },
    },
  })

  if (negocioUpdate.count !== 1) {
    throw new DeudaReversionError()
  }

  // Paso D — consumir la marca financiera con un updateMany condicional (nunca un
  // update libre), para que una segunda reversión no pueda repetirse.
  const pedidoUpdate = await tx.pedido.updateMany({
    where: {
      id: pedido.id,
      negocioId: pedido.negocioId,
      estado: "cancelado",
      deudaAcumulada: true,
    },
    data: {
      deudaAcumulada: false,
    },
  })

  if (pedidoUpdate.count !== 1) {
    throw new DeudaReversionError()
  }
}
