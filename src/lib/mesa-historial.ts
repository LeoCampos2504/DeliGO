import { buildCuentaMesa, withCuentaMesaPayment, type CuentaMesaResult, type CuentaPedidoInput, type CuentaPedidoLine } from "@/lib/mesa-cuenta"

export interface MesaHistorialOcupacionInput {
  id: string
  mesaId: string
  mesaNumero: number | null
  estado: string
  iniciadaEn: Date | string
  cerradaEn: Date | string | null
  metodoPago: string | null
  pagoConfirmadoEn: Date | string | null
}

export interface MesaHistorialPedidoInput extends CuentaPedidoInput {
  mesaNumero: number | null
  clienteNombre: string | null
  empleadoNombre: string | null
  ocupacionMesaId: string | null
  ocupacionMesa: MesaHistorialOcupacionInput | null
}

export interface CuentaMesaHistorialPedido extends CuentaPedidoLine {
  clienteNombre: string | null
  empleadoNombre: string | null
}

export interface CuentaMesaHistorialResult extends Omit<CuentaMesaResult, "pedidos"> {
  ocupacionId: string | null
  mesaId: string | null
  mesaNumero: number | null
  iniciadaEn: string | null
  cerradaEn: string | null
  estadoOcupacion: string | null
  legacy: boolean
  pedidos: CuentaMesaHistorialPedido[]
}

function toIsoString(value: Date | string | null): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function accountKey(pedido: MesaHistorialPedidoInput): string {
  return pedido.ocupacionMesaId ? `ocupacion:${pedido.ocupacionMesaId}` : `legacy:${pedido.id}`
}

/**
 * Agrupa únicamente por la FK histórica directa. Un pedido sin FK conserva
 * su propia entrada legacy; nunca se infiere una ocupación por mesa o fecha.
 */
export function buildMesaHistorialAccounts(pedidos: MesaHistorialPedidoInput[]): CuentaMesaHistorialResult[] {
  const grouped = new Map<string, MesaHistorialPedidoInput[]>()
  for (const pedido of pedidos) {
    const key = accountKey(pedido)
    const current = grouped.get(key)
    if (current) current.push(pedido)
    else grouped.set(key, [pedido])
  }

  const accounts = [...grouped.values()].map((group) => {
    const first = group[0]
    const ocupacion = first.ocupacionMesaId ? first.ocupacionMesa : null
    const canonical = withCuentaMesaPayment(
      buildCuentaMesa(group.map(({ mesaNumero: _mesaNumero, clienteNombre: _clienteNombre, empleadoNombre: _empleadoNombre, ocupacionMesaId: _ocupacionMesaId, ocupacionMesa: _ocupacionMesa, ...pedido }) => pedido)),
      {
        metodoPago: ocupacion?.metodoPago ?? null,
        pagoConfirmadoEn: ocupacion?.pagoConfirmadoEn ?? null,
      }
    )

    return {
      ...canonical,
      ocupacionId: ocupacion?.id ?? null,
      mesaId: ocupacion?.mesaId ?? null,
      mesaNumero: ocupacion?.mesaNumero ?? first.mesaNumero ?? null,
      iniciadaEn: toIsoString(ocupacion?.iniciadaEn ?? null),
      cerradaEn: toIsoString(ocupacion?.cerradaEn ?? null),
      estadoOcupacion: ocupacion?.estado ?? null,
      legacy: !first.ocupacionMesaId,
      pedidos: canonical.pedidos.map((pedido, index) => ({
        ...pedido,
        clienteNombre: group[index]?.clienteNombre ?? null,
        empleadoNombre: group[index]?.empleadoNombre ?? null,
      })),
    }
  })

  return accounts.sort((a, b) => {
    const aDate = a.pedidos[0]?.fecha ?? ""
    const bDate = b.pedidos[0]?.fecha ?? ""
    return bDate.localeCompare(aDate)
  })
}
