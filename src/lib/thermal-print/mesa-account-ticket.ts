// ============================================
// DeliGO — Transformación cuenta de mesa -> ticket térmico (P3-A)
// ============================================
// Función pura: recibe la MISMA estructura que ya devuelve
// `buildCuentaMesa` (`src/lib/mesa-cuenta.ts`, P2) más los tres campos que
// el endpoint agrega alrededor (negocio.nombre, mesa.numero, datos de la
// ocupación) y construye un `ThermalTicket` (`types.ts`). Nunca consulta la
// base de datos, nunca llama a un endpoint, nunca accede a `window`/DOM,
// nunca depende de React, nunca recalcula `totalGeneral` — se usa tal cual
// lo entrega el servidor. Nunca se importa nada de
// `mesa-cuenta-dialog.tsx` (componente `"use client"`): solo se reutilizan,
// vía `import type`, las interfaces ya puramente estructurales de
// `mesa-cuenta.ts` (que ese mismo archivo ya expone sin depender de
// Prisma/DB/React).

import type { CuentaItemLine, CuentaMesaResult, CuentaPedidoLine } from "@/lib/mesa-cuenta"
import type { ThermalTicket, ThermalTicketItem, ThermalTicketPedido } from "./types"

/**
 * Datos de la ocupación/mesa/negocio que el endpoint de cuenta agrega
 * alrededor de `CuentaMesaResult` (ver `GET /api/operaciones/ocupaciones/
 * [id]/cuenta`). Deliberadamente NO incluye `ocupacion.id` (identificador de
 * sesión — nunca se imprime, sección 5) ni ningún dato de autorización.
 */
export interface MesaAccountTicketInput {
  negocio: { nombre: string }
  mesa: { numero: number }
  ocupacion: { iniciadaEn: string; cerradaEn: string | null; estado: string }
  cuenta: CuentaMesaResult
}

function toThermalItem(item: CuentaItemLine): ThermalTicketItem {
  return {
    cantidad: item.cantidad,
    nombre: item.nombre || "Producto",
    subtotal: item.subtotalLineaAprox,
    // Copias defensivas — nunca se comparte la misma referencia de arreglo
    // que `CuentaMesaResult`, para que este módulo nunca pueda mutar (ni ser
    // mutado por) el resultado que ya consumió la UI.
    agregados: item.agregados.map((agregado) => agregado.nombre).filter((nombre) => nombre.trim().length > 0),
    secciones: [...item.secciones],
    ingredientesQuitados: [...item.ingredientesQuitados],
    talle: item.talle || "",
    color: item.color || "",
  }
}

function toThermalPedido(pedido: CuentaPedidoLine, index: number): ThermalTicketPedido {
  return {
    // Correlativo DENTRO de este ticket (1-based) — nunca el id real del
    // pedido (sección 5: no incluir identificadores internos).
    numero: index + 1,
    fecha: pedido.fecha,
    cancelado: pedido.excluido,
    pendiente: pedido.pendiente,
    items: pedido.items.map(toThermalItem),
    // Mismo criterio que ya aplica `MesaCuentaDialog` al mostrar la cuenta
    // (ver mesa-cuenta-dialog.tsx: `pedido.excluido ? formatPrice(0) :
    // formatPrice(pedido.subtotalPedido)`) — un pedido cancelado muestra
    // subtotal 0 en el ticket, nunca su `Pedido.total` histórico, aunque
    // ese total nunca se resta ni se recalcula en `totalGeneral` (que sigue
    // siendo, sin cambios, el que ya calculó `buildCuentaMesa`).
    subtotal: pedido.excluido ? 0 : pedido.subtotalPedido,
  }
}

/**
 * Construye el modelo térmico de la cuenta de una mesa. Pura: mismos datos
 * de entrada, mismo `ThermalTicket` de salida. Conserva el orden de
 * `cuenta.pedidos` tal cual llega (ya viene ordenado por fecha/id desde el
 * endpoint — esta función nunca reordena). Nunca inventa un estado que no
 * exista en `CuentaPedidoLine` (`excluido`/`pendiente` ya vienen resueltos
 * por `buildCuentaMesa`, con las mismas reglas de P2).
 */
export function buildMesaAccountThermalTicket(input: MesaAccountTicketInput): ThermalTicket {
  const estadoActiva = input.ocupacion.estado === "activa"

  return {
    negocio: { nombre: input.negocio.nombre || "" },
    mesa: { numero: input.mesa.numero },
    ocupacion: {
      iniciadaEn: input.ocupacion.iniciadaEn,
      cerradaEn: input.ocupacion.cerradaEn,
      estado: estadoActiva ? "activa" : "cerrada",
    },
    pedidos: input.cuenta.pedidos.map(toThermalPedido),
    totalGeneral: input.cuenta.totalGeneral,
    leyenda: estadoActiva ? "vista_previa" : "cuenta_cerrada",
  }
}
