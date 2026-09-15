"use client"

type T24PhysicalWitnessEvent = {
  pedidoId: string
  event: string
  revision?: number | string | null
  source?: "MATCHED" | "RAW" | "LOCATION_ONLY" | "HTTP" | "REALTIME"
  trajectoryPoints?: number
  matchedTrajectoryPoints?: number
  queueState?: string
  acceptance?: string
  snapOccurred?: boolean
  staleRecovery?: boolean
  callbackSequence?: number
  callbackOrigin?: "watchPosition" | "getCurrentPosition"
  lat?: number
  lng?: number
  accuracy?: number
  visibility?: string
  onLine?: boolean
  timeSincePreviousCallbackMs?: number | null
  decision?: string
  movementDistanceMeters?: number | null
  movementThresholdMeters?: number | null
  previousAccuracyMeters?: number | null
  currentAccuracyMeters?: number | null
  throttleDecision?: string
  // P2-T23-H2 (H1 §6 finding): a "DEFER_MIN_INTERVAL" throttleDecision used to
  // conflate two structurally different reasons (the 5s network throttle vs
  // the batch-age wait) under one label — this distinguishes them so a
  // future probe can attribute cause cleanly instead of guessing from
  // aggregate counts.
  deferReason?: "NETWORK_MIN_SEND_INTERVAL" | "BATCH_AGE_WAIT" | "ADAPTIVE_BATCH_WAIT" | "OTHER"
  timeSinceLastNetworkSendMs?: number | null
  minSendIntervalMs?: number
  bufferPointCountBefore?: number
  bufferPointCountAfter?: number
  bufferPointCount?: number
  batchId?: string
  batchPointCount?: number
  batchAgeMs?: number | null
  batchDistanceMeters?: number | null
  flushReason?: string
  sendStartedAt?: string
  responseReceivedAt?: string
  httpStatus?: number
  returnedRevision?: number | string | null
  callbackSequenceStart?: number | null
  callbackSequenceEnd?: number | null
  lifecycleType?: string
  state?: string
  channel?: "REALTIME" | "HTTP"
  revisionGapClassification?: string
  playbackAccepted?: boolean
  playbackStarted?: boolean
  playbackFinished?: boolean
  playbackSuperseded?: boolean
  snapReason?: string
}

export type T24WitnessTransportContext = Pick<T24PhysicalWitnessEvent,
  "batchId" | "batchPointCount" | "callbackSequenceStart" | "callbackSequenceEnd"
>

export function isT24PhysicalWitnessEnabled(pedidoId: string): boolean {
  return process.env.NEXT_PUBLIC_T24_PHYSICAL_WITNESS_ENABLED === "1" &&
    pedidoId === process.env.NEXT_PUBLIC_T24_PHYSICAL_WITNESS_ORDER_ID
}

export function createT24PhysicalWitnessHeaders(
  pedidoId: string,
  context: T24WitnessTransportContext,
): Record<string, string> {
  if (!isT24PhysicalWitnessEnabled(pedidoId)) return {}
  return { "X-T24-Physical-Witness": JSON.stringify(context) }
}

/**
 * Testing-only, best-effort side-channel for the controlled physical T24
 * witness. It is compile-time disabled unless the Testing deployment opts in;
 * it never participates in tracking state or playback decisions.
 */
export function recordT24PhysicalWitness(event: T24PhysicalWitnessEvent): void {
  if (!isT24PhysicalWitnessEnabled(event.pedidoId)) return
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
