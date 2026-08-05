// ============================================
// DeliGO — Cuenta de mesa (P2 — cierre comercial)
// ============================================
// Función pura de cálculo de la cuenta de una ocupación de mesa. Sin
// Prisma/DB/React: recibe datos ya persistidos y autorizados (leídos por el
// endpoint server-side) y devuelve el desglose/total. Nunca reconsulta el
// catálogo actual de productos — cada línea usa exclusivamente el precio
// histórico ya persistido en `PedidoItem.precio`/`agregados`, y el total por
// pedido usa siempre `Pedido.total` ya persistido (nunca se recalcula desde
// los ítems: ese es el mismo total autoritativo que el resto de la app ya
// usa para ese pedido — evita que esta cuenta diverja si algún cargo futuro,
// como `tarifaServicio`, dejara de ser 0 para mesa).
//
// Regla de inclusión (P2, derivada del código real, no inventada):
//   - "entregado"  -> incluido en el total (única transición real y
//                     operativa que marca un pedido de mesa como servido).
//   - "cancelado"  -> excluido del total (mismo criterio que ya usan
//                     negocio/analytics y negocio/salon/stats: cancelado
//                     nunca cuenta como ingreso).
//   - cualquier otro estado real de mesa (recibido/preparando/
//     listo_para_retirar) -> todavía mutable: se muestra en la vista previa
//     pero BLOQUEA el cierre (`puedeCerrar=false`) hasta que se resuelva
//     operativamente (entregado o cancelado). Nunca se fuerza ni se
//     reescribe un estado para permitir el cierre.

import {
  parsePedidoItemAgregados,
  parsePedidoItemSecciones,
  getIngredientesQuitadosNombres,
  type PedidoItemAgregadoParsed,
} from "@/lib/pedido-item-personalizacion"

// Estados de pedido de mesa que todavía pueden cambiar (y por lo tanto
// bloquean el cierre de la cuenta) — mismo conjunto ESTADOS_ACTIVOS_MESA que
// ya usan los paneles operativos (P1-B), reproducido acá porque esos módulos
// son client-side/API-específicos y este archivo debe seguir sin
// dependencias de framework.
// Exportado: src/lib/mesa-occupancy.ts (closeMesaOccupancyComercial y el
// heartbeat de creación de pedido) reutiliza esta MISMA lista — nunca la
// duplica — para que el bloqueo de cierre comercial y la clasificación de la
// cuenta usen exactamente el mismo criterio de "pedido todavía mutable".
export const ESTADOS_PENDIENTES_MESA = ["recibido", "preparando", "listo_para_retirar"] as const
const ESTADO_INCLUIDO = "entregado"
const ESTADO_EXCLUIDO = "cancelado"

export interface CuentaPedidoItemInput {
  id: string
  nombre: string
  precio: number
  cantidad: number
  agregados: unknown
  secciones: unknown
  ingredientesQuitados: unknown
  talle: string
  color: string
}

export interface CuentaPedidoInput {
  id: string
  estado: string
  fecha: Date | string
  total: number
  items: CuentaPedidoItemInput[]
}

export interface CuentaItemLine {
  id: string
  nombre: string
  cantidad: number
  precioUnitario: number
  agregados: PedidoItemAgregadoParsed[]
  secciones: string[]
  ingredientesQuitados: string[]
  talle: string
  color: string
  // Solo informativo/de exhibición por línea — el total por pedido y el
  // total general SIEMPRE usan `Pedido.total` persistido, nunca esta suma.
  subtotalLineaAprox: number
}

export interface CuentaPedidoLine {
  id: string
  estado: string
  fecha: string
  items: CuentaItemLine[]
  subtotalPedido: number
  incluido: boolean
  excluido: boolean
  pendiente: boolean
}

export interface CuentaMesaResult {
  pedidos: CuentaPedidoLine[]
  totalGeneral: number
  pedidosIncluidosCount: number
  pedidosExcluidosCount: number
  pedidosPendientesCount: number
  puedeCerrar: boolean
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function toIsoString(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString()
}

// Render defensivo de `secciones` (variantes/talles vía secciones
// compartidas): cada selección puede ser un string (opción elegida) o un
// Record<string, number> (cantidad por opción, ej. medios y medios) — nunca
// se muestra `[object Object]`, `undefined` ni una excepción.
function renderSecciones(raw: unknown): string[] {
  const parsed = parsePedidoItemSecciones(raw)
  const lines: string[] = []
  for (const [seccion, seleccion] of Object.entries(parsed)) {
    if (typeof seleccion === "string") {
      if (seleccion.trim()) lines.push(`${seccion}: ${seleccion}`)
      continue
    }
    const opciones = Object.keys(seleccion)
    if (opciones.length > 0) lines.push(`${seccion}: ${opciones.join(", ")}`)
  }
  return lines
}

function buildItemLine(item: CuentaPedidoItemInput): CuentaItemLine {
  const precioUnitario = toFiniteNumber(item.precio, 0)
  const cantidad = toFiniteNumber(item.cantidad, 0)
  const agregados = parsePedidoItemAgregados(item.agregados)
  const agregadosTotal = agregados.reduce((sum, agregado) => sum + toFiniteNumber(agregado.precio, 0), 0)

  return {
    id: item.id,
    nombre: item.nombre || "Producto",
    cantidad,
    precioUnitario,
    agregados,
    secciones: renderSecciones(item.secciones),
    ingredientesQuitados: getIngredientesQuitadosNombres(item.ingredientesQuitados),
    talle: typeof item.talle === "string" ? item.talle : "",
    color: typeof item.color === "string" ? item.color : "",
    subtotalLineaAprox: (precioUnitario + agregadosTotal) * cantidad,
  }
}

export function buildCuentaMesa(pedidos: CuentaPedidoInput[]): CuentaMesaResult {
  let totalGeneral = 0
  let pedidosIncluidosCount = 0
  let pedidosExcluidosCount = 0
  let pedidosPendientesCount = 0

  const pedidosOut: CuentaPedidoLine[] = pedidos.map((pedido) => {
    const incluido = pedido.estado === ESTADO_INCLUIDO
    const excluido = pedido.estado === ESTADO_EXCLUIDO
    const pendiente = (ESTADOS_PENDIENTES_MESA as readonly string[]).includes(pedido.estado)

    if (incluido) {
      pedidosIncluidosCount += 1
      totalGeneral += toFiniteNumber(pedido.total, 0)
    } else if (excluido) {
      pedidosExcluidosCount += 1
    } else if (pendiente) {
      pedidosPendientesCount += 1
    }

    return {
      id: pedido.id,
      estado: pedido.estado,
      fecha: toIsoString(pedido.fecha),
      items: pedido.items.map(buildItemLine),
      subtotalPedido: toFiniteNumber(pedido.total, 0),
      incluido,
      excluido,
      pendiente,
    }
  })

  return {
    pedidos: pedidosOut,
    totalGeneral,
    pedidosIncluidosCount,
    pedidosExcluidosCount,
    pedidosPendientesCount,
    puedeCerrar: pedidosPendientesCount === 0,
  }
}
