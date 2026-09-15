"use client"

type T24PhysicalWitnessEvent = {
  pedidoId: string
  event: string
  revision?: number | string | null
  source?: "MATCHED" | "RAW" | "HTTP" | "REALTIME"
  trajectoryPoints?: number
  matchedTrajectoryPoints?: number
  queueState?: string
  acceptance?: string
  snapOccurred?: boolean
  staleRecovery?: boolean
}

/**
 * Testing-only, best-effort side-channel for the controlled physical T24
 * witness. It is compile-time disabled unless the Testing deployment opts in;
 * it never participates in tracking state or playback decisions.
 */
export function recordT24PhysicalWitness(event: T24PhysicalWitnessEvent): void {
  if (process.env.NEXT_PUBLIC_T24_PHYSICAL_WITNESS_ENABLED !== "1") return
  if (event.pedidoId !== process.env.NEXT_PUBLIC_T24_PHYSICAL_WITNESS_ORDER_ID) return
  if (!event.pedidoId || !event.event) return

  const body = JSON.stringify({
    ...event,
    observedAt: new Date().toISOString(),
  })

  void fetch("/api/testing/t24-physical-witness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    credentials: "same-origin",
  }).catch(() => {
    // Observability must never affect the normal tracking flow.
  })
}
