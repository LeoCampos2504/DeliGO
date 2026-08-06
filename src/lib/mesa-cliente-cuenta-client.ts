"use client"

import type { CuentaMesaResult } from "@/lib/mesa-cuenta"

// ============================================
// DeliGO — Cliente compartido de cuenta pública de mesa (23-B)
// ============================================
// Lógica pura de fetch/clasificación para el endpoint canónico
// GET /api/public/mesa-cuenta?slug=...&mesa=... — mismo patrón que
// src/lib/mesa-occupancy-client.ts y src/lib/mesa-pedido-cancelacion-client.ts.
// Sin React, sin estado propio. `cache: "no-store"` explícito además del
// header `Cache-Control: private, no-store` que ya envía el servidor —
// nunca debe servirse una respuesta cacheada por el navegador, un Service
// Worker no consciente de esta ruta, ni ningún proxy intermedio.
//
// La cookie de sesión (`deligo_mesa_occupancy`) es HttpOnly — este módulo
// nunca la lee ni la escribe directamente; solo confía en que el navegador
// la adjunta automáticamente a la petición `same-origin`.

export interface MesaClienteCuentaActiva extends CuentaMesaResult {
  negocioNombre: string
  mesaNumero: number
}

export type MesaClienteCuentaOutcome =
  | { kind: "activa"; cuenta: MesaClienteCuentaActiva }
  | { kind: "cerrada" }
  | { kind: "sin_sesion" }
  | { kind: "error" }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export async function fetchMesaClienteCuenta(
  params: { slug: string; mesaNumero: number },
  signal?: AbortSignal
): Promise<MesaClienteCuentaOutcome> {
  const { slug, mesaNumero } = params
  let res: Response
  try {
    res = await fetch(
      `/api/public/mesa-cuenta?slug=${encodeURIComponent(slug)}&mesa=${encodeURIComponent(String(mesaNumero))}`,
      { cache: "no-store", signal }
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return { kind: "error" }
  }

  if (!res.ok) return { kind: "error" }

  const data: unknown = await res.json().catch(() => null)
  if (!isRecord(data) || data.ok !== true) return { kind: "error" }

  if (data.status === "sin_sesion") return { kind: "sin_sesion" }
  if (data.status === "cerrada") return { kind: "cerrada" }

  if (
    data.status === "activa" &&
    isRecord(data.negocio) &&
    typeof data.negocio.nombre === "string" &&
    isRecord(data.mesa) &&
    typeof data.mesa.numero === "number" &&
    Array.isArray(data.pedidos) &&
    typeof data.totalGeneral === "number" &&
    typeof data.pedidosIncluidosCount === "number" &&
    typeof data.pedidosExcluidosCount === "number" &&
    typeof data.pedidosPendientesCount === "number" &&
    typeof data.puedeCerrar === "boolean"
  ) {
    const cuenta = data as unknown as CuentaMesaResult & {
      negocio: { nombre: string }
      mesa: { numero: number }
    }
    return {
      kind: "activa",
      cuenta: {
        pedidos: cuenta.pedidos,
        totalGeneral: cuenta.totalGeneral,
        pedidosIncluidosCount: cuenta.pedidosIncluidosCount,
        pedidosExcluidosCount: cuenta.pedidosExcluidosCount,
        pedidosPendientesCount: cuenta.pedidosPendientesCount,
        puedeCerrar: cuenta.puedeCerrar,
        negocioNombre: cuenta.negocio.nombre,
        mesaNumero: cuenta.mesa.numero,
      },
    }
  }

  // "activa" con forma inesperada: nunca se trata como éxito sin confirmar
  // el shape completo.
  return { kind: "error" }
}
