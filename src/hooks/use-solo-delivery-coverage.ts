"use client"

import { useCallback, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { shouldShowBusinessInDiscovery } from "@/lib/business-discovery-visibility"
import { isValidCoordinatePair } from "@/lib/delivery-coverage"
import { fetchDeliveryPreciosBatched, type DeliveryPreciosMap } from "@/lib/delivery-precios-batch"

// ============================================
// DeliGO — Cobertura de "solo delivery" en discovery (T20-DK2A/T20-DK2B/T20-DK2C)
// ============================================
// Reutilizado por el listado principal (cliente/page.tsx) y el carrusel de
// promocionados (promoted-businesses-section.tsx) — un único hook, un único
// contrato, para no duplicar la lógica de exclusión entre ambas superficies.
//
// Privacidad (T20-DK2A): las coordenadas del Cliente NUNCA viajan en la URL.
// Este hook llama a `POST /api/negocios/delivery-precios` (body JSON), el
// mismo endpoint batch que el home ya usaba para precios — nunca una
// consulta GET con lat/lng, nunca una consulta por negocio.
//
// Robustez (T20-DK2B/DK2C): la resolución en lotes (chunking, límite
// estricto, combinación, fail-open ante fallo parcial) vive en
// `fetchDeliveryPreciosBatched` (`src/lib/delivery-precios-batch.ts`) — la
// MISMA función que usa el consumidor histórico de precios en
// `cliente/page.tsx`, para que el límite del endpoint (`DELIVERY_PRECIOS_MAX_IDS`)
// tenga una única implementación de batching en todo el proyecto.

export interface SoloDeliveryCoverageCandidate {
  id: string
  ofreceDelivery: boolean
  retiroHabilitado?: boolean
}

// T20-DK2B: pura y exportada para poder probarla directamente (dedupe +
// orden estable) sin necesidad de un harness de React. Sólo los negocios
// "solo delivery" (ofreceDelivery && !retiroHabilitado) necesitan
// resolución de cobertura — Delivery+retiro y Solo retiro son siempre
// visibles, no hace falta consultarlos. El mismo conjunto de candidatos, en
// cualquier orden de entrada, produce siempre la misma lista de salida (no
// dispara una queryKey ni un chunking distintos por un reordenamiento
// irrelevante del array `negocios`).
export function extractSoloDeliveryCandidateIds(negocios: SoloDeliveryCoverageCandidate[]): string[] {
  const unique = new Set(
    negocios.filter((n) => n.ofreceDelivery && n.retiroHabilitado === false).map((n) => n.id)
  )
  return [...unique].sort()
}

export function useSoloDeliveryCoverage(params: {
  negocios: SoloDeliveryCoverageCandidate[]
  lat?: number
  lng?: number
  enabled: boolean
}) {
  const { negocios, lat, lng, enabled } = params
  // T20-DK2A: nunca dispara el batch con coordenadas no finitas o fuera de
  // rango — se tratan igual que "ubicación desconocida" (nunca oculta nada).
  const hasLocation = isValidCoordinatePair(lat, lng)

  const candidateIds = useMemo(() => extractSoloDeliveryCandidateIds(negocios), [negocios])
  const candidateIdsKey = candidateIds.join(",")

  const { data, isLoading } = useQuery<DeliveryPreciosMap>({
    queryKey: ["negocios-cobertura-solo-delivery", lat, lng, candidateIdsKey],
    queryFn: async () => {
      if (lat === undefined || lng === undefined) return {}
      return fetchDeliveryPreciosBatched(lat, lng, candidateIds)
    },
    enabled: enabled && hasLocation && candidateIds.length > 0,
  })

  // No hace falta esperar nada si no hay ubicación conocida o si el
  // conjunto actual no tiene ningún candidato "solo delivery" — evita
  // bloquear el render con un loading innecesario. Con candidatos, `isBusy`
  // se mantiene true hasta que el query completo (TODOS los lotes, vía el
  // único Promise.all interno de `fetchDeliveryPreciosBatched`) resolvió —
  // nunca hay un estado intermedio donde sólo el primer lote ya aplicó y el
  // resto todavía no.
  const needsCoverage = hasLocation && candidateIds.length > 0
  const isBusy = enabled && needsCoverage && isLoading
  const isReady = !needsCoverage || !!data

  // Memoizado por `data`/`hasLocation` (no por identidad de `negocio`) para
  // que un consumidor pueda usarlo como dependencia de su propio useMemo sin
  // invalidar en cada render.
  const isVisible = useCallback(
    (negocio: SoloDeliveryCoverageCandidate): boolean => {
      const esSoloDelivery = negocio.ofreceDelivery && negocio.retiroHabilitado === false
      if (!esSoloDelivery) return true
      if (!hasLocation) return true
      const cobertura = data?.[negocio.id]
      return shouldShowBusinessInDiscovery({
        ofreceDelivery: negocio.ofreceDelivery,
        ofreceRetiro: negocio.retiroHabilitado ?? true,
        coverageKnown: cobertura !== undefined,
        deliveryAvailable: cobertura?.delivery !== false,
      })
    },
    [data, hasLocation]
  )

  // Memoizado como un único objeto estable (misma identidad mientras
  // `isVisible`/`isBusy`/`isReady` no cambien) — permite que un consumidor
  // dependa del objeto completo en su propio useMemo/useCallback sin que el
  // React Compiler tenga que inferir una dependencia más específica que una
  // propiedad anidada (ver react-hooks/preserve-manual-memoization).
  return useMemo(() => ({ isVisible, isBusy, isReady }), [isVisible, isBusy, isReady])
}
