"use client"

import { useEffect, useRef } from "react"
import {
  buildSampleFromPosition,
  isCandidateSampleNewer,
  isSampleFresh,
  isSignificantMovement,
  type TrackingLocationSample,
} from "@/lib/tracking-movement"

interface ActiveDelivery {
  id: string
  estado: string
  repartidorId?: string | null
  // P2-T01: eligibilidad resuelta server-side con la misma política central
  // (isTrackingCoreEligible) que GET tracking y realtime authorize —
  // snapshot inmutable del pedido AND flag vivo del negocio AND
  // estado/metodoEntrega. Ausente o false => este hook nunca produce GPS
  // para ese pedido, sin importar estado/repartidorId locales.
  trackingEligibleNow?: boolean
}

// P2-T02 (P2T02-MODEL-E1) constants — Stage 1/1B design authority.
const WATCH_OPTIONS_ENABLE_HIGH_ACCURACY = false
const WATCH_OPTIONS_MAXIMUM_AGE_MS = 3000
const WATCH_OPTIONS_TIMEOUT_MS = 4000
const MIN_SEND_INTERVAL_MS = 5000
const STATIONARY_HEARTBEAT_MS = 60000
// P2-T02 Stage 6J: ventana del watchdog de liveness del watcher físico — 25%
// de margen sobre un ciclo normal de heartbeat, nunca un intervalo corto ni
// arbitrario. Ver FOREGROUND_WATCHDOG_WINDOW_MS más abajo para el porqué.
const FOREGROUND_WATCHDOG_WINDOW_MS = STATIONARY_HEARTBEAT_MS + STATIONARY_HEARTBEAT_MS / 4
// P2-T02 Stage 6J: margen para que una señal tardía de la MISMA ola de
// resume (p.ej. un pageshow persisted que llega después de que
// visibilitychange ya disparó y completó la recuperación) no dispare una
// segunda recuperación redundante — derivado del propio timeout por intento
// del watch, nunca un número arbitrario.
const FOREGROUND_RECOVERY_DEDUPE_WINDOW_MS = WATCH_OPTIONS_TIMEOUT_MS * 2

interface DeliveryTrackingState {
  // Última posición efectivamente confirmada por el servidor (2xx) para
  // ESTA entrega — base de comparación de movimiento y de cadencia. Nunca
  // avanza antes de una confirmación real (P2-T02 Stage 1B — commit point).
  lastSentSample: TrackingLocationSample | null
  lastSuccessfulSendAt: number | null
  // Sample más reciente que merece enviarse en cuanto el throttle lo
  // permita — reemplazado por cada callback significativo posterior, nunca
  // encolado (GPS_SAMPLE_QUEUE_MODEL=LATEST_SAMPLE_ONLY).
  pendingMeaningfulSample: TrackingLocationSample | null
  pendingSendTimerId: ReturnType<typeof setTimeout> | null
  heartbeatTimerId: ReturnType<typeof setTimeout> | null
  // Single-flight de POST por entrega — sustituye a pendingLocationRequestsRef.
  postInFlight: boolean
}

// Elegibilidad "core": server-side elegible y no marcada localmente como
// ineligible por un rechazo/error previo — NUNCA excluye por un POST ya en
// vuelo. `postInFlight` es un detalle de implementación del single-flight de
// UN request HTTP puntual, no una propiedad de la entrega en sí — la entrega
// sigue siendo la misma demanda física real de GPS mientras ese POST está en
// curso. Por eso `isCoreEligible` es la ÚNICA función usada para decidir:
// (a) si un sample YA OBSERVADO debe considerarse/reevaluarse para una
// entrega, (b) si el watcher físico debe estar activo, y (c) el badge
// público `trackingActive` — en los tres casos, un POST en vuelo NUNCA
// cuenta como "esta entrega dejó de necesitar tracking". El single-flight
// real de POST por entrega vive exclusivamente dentro de
// sendLocationForDelivery (que guarda el sample como pendiente si ya hay uno
// en vuelo, nunca lo descarta) — nunca en esta función.
function isCoreEligible(delivery: ActiveDelivery, knownIneligible: Set<string>): boolean {
  return (
    delivery.estado === "en_camino" &&
    Boolean(delivery.repartidorId) &&
    delivery.trackingEligibleNow === true &&
    !knownIneligible.has(delivery.id)
  )
}

/**
 * P2-T02 (P2T02-MODEL-E1) — productor GPS event-driven del Repartidor.
 *
 * Reemplaza el polling ciego de 5s (getCurrentPosition en setInterval,
 * histórico MODEL-G1) por un único `watchPosition` por tab/hook, activo
 * sólo mientras exista al menos una entrega localmente elegible, con
 * filtrado local de movimiento (Haversine + accuracy-aware, ver
 * src/lib/tracking-movement.ts), un intervalo mínimo de envío de 5s (mismo
 * máximo ya validado en producción), coalescencia de último-sample-válido,
 * un heartbeat estacionario de 60s que SÓLO puede reenviar una observación
 * realmente fresca (nunca "lava" el timestamp de una coordenada vieja), y
 * un mecanismo de adquisición fresca puntual (getCurrentPosition one-shot,
 * single-flight) para los bordes donde no hay un sample reutilizable:
 * entrega nueva, recuperación de foreground, reactivación, y heartbeat
 * vencido sin sample fresco.
 *
 * Server-authoritative producer: POST /api/repartidor/ubicacion persiste la
 * ubicación y publica el evento realtime `tracking.location.updated` — este
 * hook nunca emite nada productivamente sobre el transporte realtime
 * compartido.
 *
 * P2-T01 se preserva íntegro: `knownIneligibleRef` recuerda cualquier
 * pedido cuyo último POST fue rechazado (cualquier no-2xx) o falló a nivel
 * de transporte, hasta que un "mios" fresco y exitoso vuelva a reportar
 * `trackingEligibleNow`. El servidor (MODEL-LOCK-A) sigue siendo la única
 * autoridad real de elegibilidad — este hook es optimización local de
 * batería/red, nunca el mecanismo de seguridad.
 *
 * P2-T19 (conciencia de si algún Cliente está mirando el tracking) queda
 * explícitamente fuera de alcance — cero viewer/presence awareness aquí.
 */
export function useRepartidorTracking(activeDeliveries: ActiveDelivery[]) {
  const deliveriesRef = useRef<ActiveDelivery[]>(activeDeliveries)
  const knownIneligibleRef = useRef<Set<string>>(new Set())
  const deliveryStateRef = useRef<Map<string, DeliveryTrackingState>>(new Map())

  const watchIdRef = useRef<number | null>(null)
  // Incrementada en cada start/stop del watcher físico — cualquier callback
  // (watchPosition success/error, one-shot fresh acquisition, timer
  // pendiente) capturado bajo una generación distinta a la vigente se
  // descarta por completo, sin efectos secundarios (P2-T02 Stage 1B §20).
  const watchGenerationRef = useRef(0)
  // Sample físico más reciente observado por el Repartidor, compartido
  // entre todas sus entregas — nunca confundido con "lo último enviado a
  // una entrega en particular" (ver DeliveryTrackingState.lastSentSample).
  const latestObservedSampleRef = useRef<TrackingLocationSample | null>(null)
  // Single-flight de adquisición fresca (getCurrentPosition one-shot) —
  // varios triggers concurrentes (heartbeat, entrega nueva, foreground)
  // comparten la misma promesa en vuelo en vez de disparar múltiples
  // llamadas físicas al sensor GPS.
  const freshSamplePromiseRef = useRef<Promise<TrackingLocationSample | null> | null>(null)
  // P2-T02 Stage 6I (FINDING_P2T02_STAGE6H_01): true entre una transición
  // oculta real (visibilitychange a "hidden", o una restauración bfcache
  // vía pageshow con persisted=true) y la primera señal de foreground que
  // la procese — permite forzar un reinicio duro del watcher exactamente
  // una vez por retorno real a primer plano, sin churnear ante un `focus`
  // incidental sobre una página que nunca estuvo oculta.
  const pendingForegroundRecoveryRef = useRef(false)
  // P2-T02 Stage 6J: timestamp del último callback físico real del sensor
  // GPS (watchPosition success/error, o getCurrentPosition success/error) —
  // la única evidencia de que el watcher sigue vivo, independiente de
  // watchIdRef (que sólo prueba que alguna vez se registró un watch, nunca
  // que siga entregando callbacks). Nunca se deriva de un envío HTTP exitoso
  // por sí solo — un POST puede seguir usando un sample reutilizado sin que
  // haya habido ningún callback físico nuevo.
  const lastProducerActivityAtRef = useRef<number | null>(null)
  // Watchdog de liveness — ver scheduleWatchdog/checkWatchdog. Justificado
  // por un gap real: si el manejador de "hidden" nunca llega a ejecutarse
  // (el SO puede congelar la página entera sin disparar ningún evento),
  // pendingForegroundRecoveryRef nunca se marca true, y ninguna señal de
  // foreground posterior fuerza un reinicio — el multi-señal por sí solo no
  // garantiza recuperación en ese caso. El watchdog es la única red de
  // seguridad independiente de que alguna señal de lifecycle se haya
  // disparado (P2-T02 Stage 6J, revisión de FINDING_P2T02_STAGE6H_01).
  const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // P2-T02 Stage 6J: a diferencia de un setTimeout (cancelable vía
  // clearWatchdog/clearTimeout), un queueMicrotask ya programado no puede
  // cancelarse — si una señal de foreground lo programa y el hook se
  // desmonta antes de que corra, la revisión igual se ejecutaría con
  // deliveriesRef.current obsoleto (nunca se limpia al desmontar) y podría
  // crear un watchPosition nuevo después del teardown. Este flag es la
  // única guarda contra eso — se consulta al inicio de esa revisión tardía.
  const isMountedRef = useRef(true)
  // P2-T02 Stage 6J: timestamp de la última vez que performForcedRecovery
  // efectivamente corrió — permite que una señal tardía de pageshow
  // persisted, perteneciente a la MISMA ola de resume que ya se atendió,
  // no fuerce una segunda recuperación redundante (ver handlePageShow).
  const recoveryCompletedAtRef = useRef<number | null>(null)

  function getOrCreateDeliveryState(id: string): DeliveryTrackingState {
    let state = deliveryStateRef.current.get(id)
    if (!state) {
      state = {
        lastSentSample: null,
        lastSuccessfulSendAt: null,
        pendingMeaningfulSample: null,
        pendingSendTimerId: null,
        heartbeatTimerId: null,
        postInFlight: false,
      }
      deliveryStateRef.current.set(id, state)
    }
    return state
  }

  function clearDeliveryTimers(id: string) {
    const state = deliveryStateRef.current.get(id)
    if (!state) return
    if (state.pendingSendTimerId !== null) {
      clearTimeout(state.pendingSendTimerId)
      state.pendingSendTimerId = null
    }
    if (state.heartbeatTimerId !== null) {
      clearTimeout(state.heartbeatTimerId)
      state.heartbeatTimerId = null
    }
  }

  function cleanupDeliveryState(id: string) {
    clearDeliveryTimers(id)
    deliveryStateRef.current.delete(id)
  }

  function stopWatcher() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    // Invalida cualquier callback/adquisición fresca en vuelo — si el
    // watcher se detiene (cero elegibles u oculto), completar un one-shot
    // pendiente ya no tiene ningún destino válido.
    watchGenerationRef.current += 1
    // Libera el single-flight de adquisición fresca de la generación vieja
    // — sin esto, una nueva generación (p.ej. tras volver a visible) queda
    // atada a la MISMA promesa en vuelo de la generación anterior (su propio
    // callback interno ya resuelve null por generación obsoleta, pero recién
    // cuando esa llamada física a getCurrentPosition efectivamente termine),
    // en vez de poder iniciar su propia adquisición inmediatamente
    // (P2-T02 Stage 3 §18).
    freshSamplePromiseRef.current = null
  }

  // Ningún delivery de `deliveriesRef.current` sigue siendo core-elegible
  // (ninguno queda, o todos cayeron en knownIneligible) -> no hay ninguna
  // demanda física de GPS restante, liberar el sensor. Se usa después de un
  // fallo de POST asíncrono, que muta knownIneligibleRef fuera del efecto de
  // reconciliación de props (P2-T02 Stage 3 §11) — nunca reinicia el
  // watcher, sólo lo detiene cuando corresponde.
  function stopWatcherIfNoneEligible() {
    const anyEligible = deliveriesRef.current.some((d) => isCoreEligible(d, knownIneligibleRef.current))
    if (!anyEligible) {
      stopWatcher()
      clearWatchdog()
    }
  }

  function startWatcherIfNeeded() {
    if (watchIdRef.current !== null) return
    if (document.visibilityState !== "visible") return
    if (!navigator.geolocation) return
    const hasEligible = deliveriesRef.current.some((d) => isCoreEligible(d, knownIneligibleRef.current))
    if (!hasEligible) return

    const generation = watchGenerationRef.current
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => handleWatchSuccess(generation, position),
      (error) => handleWatchError(generation, error),
      {
        enableHighAccuracy: WATCH_OPTIONS_ENABLE_HIGH_ACCURACY,
        timeout: WATCH_OPTIONS_TIMEOUT_MS,
        maximumAge: WATCH_OPTIONS_MAXIMUM_AGE_MS,
      }
    )
  }

  // Reinicio duro compartido por toda señal de recuperación de foreground
  // (multi-señal o watchdog) — nunca confía en que el watch previo siga
  // vivo, y produce un envío de recuperación fresco por cada entrega
  // elegible bajo la generación NUEVA (P2-T02 Stage 6I/6J,
  // FINDING_P2T02_STAGE6H_01).
  function performForcedRecovery(eligibleNow: ActiveDelivery[]) {
    stopWatcher()
    startWatcherIfNeeded()
    recoveryCompletedAtRef.current = Date.now()
    const generation = watchGenerationRef.current
    for (const delivery of eligibleNow) {
      void ensureForegroundRecoverySendForDelivery(delivery.id, generation)
    }
  }

  function clearWatchdog() {
    if (watchdogTimerRef.current !== null) {
      clearTimeout(watchdogTimerRef.current)
      watchdogTimerRef.current = null
    }
  }

  // Arma (o rearma) el único timer del watchdog — nunca se acumulan varios
  // (MAX_FOREGROUND_WATCHDOG_TIMERS=1). No hace ninguna llamada física al
  // GPS por sí mismo — sólo programa una revisión futura de si hubo
  // evidencia de actividad real del watcher durante la ventana.
  function scheduleWatchdog() {
    clearWatchdog()
    if (document.visibilityState !== "visible") return
    const hasEligible = deliveriesRef.current.some((d) => isCoreEligible(d, knownIneligibleRef.current))
    if (!hasEligible) return
    const generation = watchGenerationRef.current
    watchdogTimerRef.current = setTimeout(() => checkWatchdog(generation), FOREGROUND_WATCHDOG_WINDOW_MS)
  }

  // Única red de seguridad independiente de que cualquier señal de
  // lifecycle (visibilitychange/focus/pageshow) se haya disparado alguna
  // vez — ver el comentario de watchdogTimerRef. Nunca hace polling de
  // ubicación: si hay evidencia real de actividad reciente, sólo reprograma
  // la próxima revisión; si no la hay, dispara EXACTAMENTE un intento de
  // recuperación (reutilizando performForcedRecovery) y vuelve a
  // reprogramarse para una ventana completa nueva — nunca un retry
  // inmediato ni un storm.
  function checkWatchdog(generation: number) {
    watchdogTimerRef.current = null
    if (generation !== watchGenerationRef.current) return
    if (document.visibilityState !== "visible") return
    const eligibleNow = deliveriesRef.current.filter((d) => isCoreEligible(d, knownIneligibleRef.current))
    if (eligibleNow.length === 0) return

    const now = Date.now()
    const activity = lastProducerActivityAtRef.current
    if (activity !== null && now - activity < FOREGROUND_WATCHDOG_WINDOW_MS) {
      scheduleWatchdog()
      return
    }

    performForcedRecovery(eligibleNow)
    scheduleWatchdog()
  }

  // Único punto que actualiza la evidencia de liveness del watchdog — un
  // callback físico real del sensor GPS, sea éxito o error, prueba que el
  // watcher (o la adquisición puntual) sigue efectivamente vivo, algo que
  // watchIdRef nunca puede garantizar por sí solo.
  function markProducerActivity() {
    lastProducerActivityAtRef.current = Date.now()
  }

  function handleWatchSuccess(generation: number, position: GeolocationPosition) {
    if (generation !== watchGenerationRef.current) return // callback obsoleto de un watcher ya reemplazado
    markProducerActivity()
    observeSample(buildSampleFromPosition(position))
  }

  function handleWatchError(generation: number, error: GeolocationPositionError) {
    if (generation !== watchGenerationRef.current) return
    markProducerActivity()
    if (error.code === error.PERMISSION_DENIED) {
      // Fatal — nunca reintentar automáticamente (evita cualquier storm de
      // prompts). Sólo un futuro cambio de elegibilidad/visibilidad, o que
      // el usuario vuelva a otorgar el permiso vía profile-tab.tsx (flujo
      // voluntario separado, sin cambios), puede reiniciar el watcher.
      stopWatcher()
    }
    // POSITION_UNAVAILABLE / TIMEOUT: no destructivo — el watcher sigue
    // activo, simplemente no hay sample nuevo esta vez.
  }

  // Actualiza la observación física compartida (si es igual o más nueva por
  // capturedAt que la ya conocida — nunca por orden de llegada del
  // callback) y evalúa el fan-out hacia cada entrega localmente elegible.
  function observeSample(sample: TrackingLocationSample) {
    if (isCandidateSampleNewer(sample, latestObservedSampleRef.current)) {
      latestObservedSampleRef.current = sample
    }
    for (const delivery of deliveriesRef.current) {
      if (!isCoreEligible(delivery, knownIneligibleRef.current)) continue
      considerSampleForDelivery(delivery.id, sample)
    }
  }

  function considerSampleForDelivery(deliveryId: string, sample: TrackingLocationSample) {
    const state = getOrCreateDeliveryState(deliveryId)
    if (!isSignificantMovement(state.lastSentSample, sample)) return
    scheduleOrSendForDelivery(deliveryId, sample)
  }

  // MIN_SEND_INTERVAL_MS + scheduler explícito (P2-T02 Stage 1B corrección
  // C): si ya se puede enviar, se envía ya; si no, el sample se guarda como
  // pendiente y se programa como máximo UN wake-up para el momento en que
  // vuelva a estar permitido — nunca se deja esperando al próximo callback
  // ni al heartbeat "por accidente".
  function scheduleOrSendForDelivery(deliveryId: string, sample: TrackingLocationSample) {
    const state = getOrCreateDeliveryState(deliveryId)
    const now = Date.now()
    const earliestNextSendAt =
      state.lastSuccessfulSendAt !== null ? state.lastSuccessfulSendAt + MIN_SEND_INTERVAL_MS : now

    if (now >= earliestNextSendAt) {
      // Este envío inmediato reemplaza cualquier pending timer/sample más
      // viejo que estuviera esperando su turno — sin esto, ese timer viejo
      // dispararía más tarde con una coordenada ya superada por este envío
      // (P2-T02 Stage 3 §22).
      if (state.pendingSendTimerId !== null) {
        clearTimeout(state.pendingSendTimerId)
        state.pendingSendTimerId = null
      }
      state.pendingMeaningfulSample = null
      void sendLocationForDelivery(deliveryId, sample)
      return
    }

    state.pendingMeaningfulSample = sample
    if (state.pendingSendTimerId === null) {
      const delay = earliestNextSendAt - now
      const generation = watchGenerationRef.current
      state.pendingSendTimerId = setTimeout(() => firePendingSend(deliveryId, generation), delay)
    }
  }

  function firePendingSend(deliveryId: string, generation: number) {
    const state = deliveryStateRef.current.get(deliveryId)
    if (!state) return
    state.pendingSendTimerId = null
    if (generation !== watchGenerationRef.current) return

    const delivery = deliveriesRef.current.find((d) => d.id === deliveryId)
    if (!delivery || !isCoreEligible(delivery, knownIneligibleRef.current)) return
    if (document.visibilityState !== "visible") return

    const pending = state.pendingMeaningfulSample
    if (!pending) return
    state.pendingMeaningfulSample = null
    // Revalidación defensiva de frescura — el timer es de corta duración
    // (a lo sumo MIN_SEND_INTERVAL_MS), pero nunca se envía un sample que
    // haya dejado de ser fresco entre que se guardó y que el timer disparó.
    if (!isSampleFresh(pending, Date.now())) return
    // Defensa adicional: si un envío MÁS NUEVO que este pending ya se
    // confirmó por otro camino mientras el timer esperaba (p.ej. un envío
    // inmediato disparado por movimiento adicional que superó el throttle
    // antes de que este timer llegara a su turno), descartar este pending
    // en vez de reenviar una coordenada ya superada (P2-T02 Stage 3 §22).
    if (state.lastSentSample && !isCandidateSampleNewer(pending, state.lastSentSample)) return
    void sendLocationForDelivery(deliveryId, pending)
  }

  // Single-flight de POST por entrega (MAX_CONCURRENT_POST_PER_DELIVERY=1).
  // Commit point de lastSentSample/lastSuccessfulSendAt: SIEMPRE tras un
  // 2xx confirmado — nunca al iniciar el fetch, nunca ante un fallo
  // (P2-T02 Stage 1B §20) — un intento nunca se confunde con una
  // aceptación del servidor.
  async function sendLocationForDelivery(deliveryId: string, sample: TrackingLocationSample) {
    const state = getOrCreateDeliveryState(deliveryId)
    if (state.postInFlight) {
      // Ya hay un POST en vuelo para esta entrega — conservar sólo el
      // sample más reciente como pendiente para reevaluar al terminar,
      // nunca disparar un segundo POST concurrente.
      if (isCandidateSampleNewer(sample, state.pendingMeaningfulSample)) {
        state.pendingMeaningfulSample = sample
      }
      return
    }

    state.postInFlight = true
    try {
      const res = await fetch("/api/repartidor/ubicacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoId: deliveryId, lat: sample.lat, lng: sample.lng }),
      })

      const currentState = deliveryStateRef.current.get(deliveryId)
      if (!currentState) return // la entrega fue limpiada mientras el POST estaba en vuelo

      if (!res.ok) {
        // Cualquier no-2xx — status/transporte únicamente, nunca parseado
        // del cuerpo de la respuesta (mismo contrato que P2-T01). Limpieza
        // COMPLETA (no sólo timers): así, si un "mios" fresco vuelve a
        // confirmar elegibilidad más tarde, el efecto de reconciliación la
        // trata como genuinamente nueva (ensureInitialSendForDelivery +
        // heartbeat fresco), nunca reanudando en silencio contra un
        // lastSentSample potencialmente viejo (P2-T02 Stage 3 §12).
        knownIneligibleRef.current.add(deliveryId)
        cleanupDeliveryState(deliveryId)
        // Si ninguna entrega restante es core-elegible, liberar el sensor
        // GPS ahora — no esperar a un cambio de props no relacionado
        // (P2-T02 Stage 3 §11).
        stopWatcherIfNoneEligible()
        return
      }

      currentState.lastSentSample = sample
      currentState.lastSuccessfulSendAt = Date.now()

      // Si la pestaña pasó a oculta mientras este POST estaba en vuelo,
      // OPTION-V2 exige cero timers activos en ese estado — no reprogramar
      // el heartbeat ni un pending sample aquí violaría esa garantía. La
      // recuperación al volver a visible ya rearma el heartbeat según el
      // lastSuccessfulSendAt real (P2-T02 Stage 3 §15).
      if (document.visibilityState === "visible") {
        scheduleHeartbeat(deliveryId)

        // Si mientras este POST estaba en vuelo llegó un sample pendiente
        // más nuevo que el que se acaba de confirmar, reevaluarlo ahora
        // contra el throttle normal — nunca se pierde silenciosamente.
        const pending = currentState.pendingMeaningfulSample
        currentState.pendingMeaningfulSample = null
        if (pending && isCandidateSampleNewer(pending, sample)) {
          scheduleOrSendForDelivery(deliveryId, pending)
        }
      }
    } catch {
      // Network error / abort — fail-closed exactamente igual que un
      // no-2xx.
      const currentState = deliveryStateRef.current.get(deliveryId)
      if (!currentState) return
      knownIneligibleRef.current.add(deliveryId)
      cleanupDeliveryState(deliveryId)
      stopWatcherIfNoneEligible()
    } finally {
      const currentState = deliveryStateRef.current.get(deliveryId)
      if (currentState) currentState.postInFlight = false
    }
  }

  // Adquisición fresca puntual (getCurrentPosition ONE-SHOT, nunca un
  // interval recurrente) — se usa exclusivamente en los bordes donde no
  // existe un sample reutilizable dentro de la ventana de frescura: entrega
  // nueva/reactivada sin sample fresco, recuperación de foreground, y
  // heartbeat vencido. Single-flight: llamadas concurrentes comparten la
  // misma promesa en vez de disparar múltiples adquisiciones físicas.
  function ensureFreshSample(): Promise<TrackingLocationSample | null> {
    if (freshSamplePromiseRef.current) return freshSamplePromiseRef.current

    const generation = watchGenerationRef.current
    const promise = new Promise<TrackingLocationSample | null>((resolve) => {
      if (!navigator.geolocation) {
        resolve(null)
        return
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          markProducerActivity()
          if (generation !== watchGenerationRef.current) {
            resolve(null)
            return
          }
          const sample = buildSampleFromPosition(position)
          // Un callback de watchPosition más nuevo que haya llegado
          // mientras este one-shot estaba en vuelo ya habría actualizado
          // latestObservedSampleRef — nunca lo pisamos con un resultado
          // más viejo (isCandidateSampleNewer lo garantiza).
          if (isCandidateSampleNewer(sample, latestObservedSampleRef.current)) {
            latestObservedSampleRef.current = sample
          }
          resolve(latestObservedSampleRef.current)
        },
        () => {
          markProducerActivity()
          resolve(null)
        },
        {
          enableHighAccuracy: WATCH_OPTIONS_ENABLE_HIGH_ACCURACY,
          timeout: WATCH_OPTIONS_TIMEOUT_MS,
          maximumAge: WATCH_OPTIONS_MAXIMUM_AGE_MS,
        }
      )
    }).finally(() => {
      if (freshSamplePromiseRef.current === promise) freshSamplePromiseRef.current = null
    })

    freshSamplePromiseRef.current = promise
    return promise
  }

  // Envío inicial para una entrega recién elegible (nueva, o reactivada
  // tras un disable/fallo) — nunca envía una coordenada stale como si fuera
  // actual, y nunca requiere movimiento previo.
  async function ensureInitialSendForDelivery(deliveryId: string) {
    const now = Date.now()
    if (isSampleFresh(latestObservedSampleRef.current, now)) {
      void sendLocationForDelivery(deliveryId, latestObservedSampleRef.current as TrackingLocationSample)
      return
    }

    const fresh = await ensureFreshSample()
    const state = deliveryStateRef.current.get(deliveryId)
    if (!state) return
    // Mientras esperábamos la adquisición fresca, esta entrega puede haber
    // recibido ya un envío exitoso por otro camino (un callback normal del
    // watcher que llegó primero) — no duplicar ese envío con un resultado
    // que ahora llega tarde.
    if (state.lastSentSample !== null) return
    const delivery = deliveriesRef.current.find((d) => d.id === deliveryId)
    if (!delivery || !isCoreEligible(delivery, knownIneligibleRef.current)) return
    if (!fresh || !isSampleFresh(fresh, Date.now())) return // sin sample fresco disponible — el próximo callback normal del watcher lo cubrirá
    void sendLocationForDelivery(deliveryId, fresh)
  }

  // Envío de recuperación tras un reinicio forzado del watcher en
  // foreground (P2-T02 Stage 6I, FINDING_P2T02_STAGE6H_01) — a diferencia
  // de ensureInitialSendForDelivery, NO se aborta sólo porque la entrega ya
  // tenga un lastSentSample previo: ese sample es exactamente lo que un
  // ciclo background/foreground real puede haber vuelto obsoleto sin que
  // el código lo sepa (Android físico: 9+ minutos de silencio tras Home→
  // Recientes, con permiso/elegibilidad intactos, sólo recuperado por una
  // recarga completa). Nunca aplica el filtro de movimiento — igual que el
  // resto de los call-sites que invocan sendLocationForDelivery
  // directamente — el Repartidor puede seguir físicamente quieto y aun así
  // debe producirse este envío.
  async function ensureForegroundRecoverySendForDelivery(deliveryId: string, generation: number) {
    const now = Date.now()
    if (isSampleFresh(latestObservedSampleRef.current, now)) {
      if (generation !== watchGenerationRef.current) return
      const delivery = deliveriesRef.current.find((d) => d.id === deliveryId)
      if (!delivery || !isCoreEligible(delivery, knownIneligibleRef.current)) return
      void sendLocationForDelivery(deliveryId, latestObservedSampleRef.current as TrackingLocationSample)
      return
    }

    const fresh = await ensureFreshSample()
    if (generation !== watchGenerationRef.current) return
    const delivery = deliveriesRef.current.find((d) => d.id === deliveryId)
    if (!delivery || !isCoreEligible(delivery, knownIneligibleRef.current)) return
    if (!fresh || !isSampleFresh(fresh, Date.now())) return
    void sendLocationForDelivery(deliveryId, fresh)
  }

  function scheduleHeartbeat(deliveryId: string, delayOverrideMs?: number) {
    const state = deliveryStateRef.current.get(deliveryId)
    if (!state) return
    if (state.heartbeatTimerId !== null) {
      clearTimeout(state.heartbeatTimerId)
      state.heartbeatTimerId = null
    }
    const delay = delayOverrideMs ?? STATIONARY_HEARTBEAT_MS
    const generation = watchGenerationRef.current
    state.heartbeatTimerId = setTimeout(() => void fireHeartbeat(deliveryId, generation), delay)
  }

  // Heartbeat estacionario — SÓLO puede reenviar una observación realmente
  // fresca (P2-T02 Stage 1B §11-13): nunca "lava" el timestamp del servidor
  // con una coordenada vieja. Si la adquisición fresca de respaldo falla,
  // no se envía nada y el heartbeat se reprograma para el próximo ciclo
  // completo — nunca un retry inmediato (evita cualquier storm).
  async function fireHeartbeat(deliveryId: string, generation: number) {
    const state = deliveryStateRef.current.get(deliveryId)
    if (!state) return
    state.heartbeatTimerId = null
    if (generation !== watchGenerationRef.current) return

    const delivery = deliveriesRef.current.find((d) => d.id === deliveryId)
    if (!delivery || !isCoreEligible(delivery, knownIneligibleRef.current)) return
    if (document.visibilityState !== "visible") return

    const now = Date.now()
    if (isSampleFresh(latestObservedSampleRef.current, now)) {
      void sendLocationForDelivery(deliveryId, latestObservedSampleRef.current as TrackingLocationSample)
      return
    }

    const lastSuccessfulSendAtAtHeartbeatStart = state.lastSuccessfulSendAt
    const fresh = await ensureFreshSample()
    const currentState = deliveryStateRef.current.get(deliveryId)
    if (!currentState) return
    if (generation !== watchGenerationRef.current) return
    // Mientras esperábamos la adquisición fresca, un envío más reciente ya
    // pudo haber ocurrido por otro camino (movimiento real, o el pending
    // scheduler) — no pisarlo con un resultado potencialmente más viejo.
    if (currentState.lastSuccessfulSendAt !== lastSuccessfulSendAtAtHeartbeatStart) return

    const delivery2 = deliveriesRef.current.find((d) => d.id === deliveryId)
    if (!delivery2 || !isCoreEligible(delivery2, knownIneligibleRef.current)) return

    if (!fresh || !isSampleFresh(fresh, Date.now())) {
      // Adquisición fresca fallida/insuficiente — cero POST, cero avance de
      // repartidorLastUpdate/locationRevision. Best-effort: se reintenta
      // recién en el próximo ciclo completo de STATIONARY_HEARTBEAT_MS, o
      // antes si un callback normal de watchPosition trae algo fresco.
      scheduleHeartbeat(deliveryId)
      return
    }

    void sendLocationForDelivery(deliveryId, fresh)
  }

  // Reconcilia el conjunto de entregas elegibles en cada cambio de props:
  // limpia el estado de cualquier entrega que dejó de ser elegible (por
  // cualquier motivo — desapareció del array, perdió trackingEligibleNow, o
  // cayó en knownIneligible), y trata toda entrega elegible SIN estado
  // registrado como "nueva" — incluyendo una reactivación tras un disable o
  // un fallo previo, que siempre reingresa por el camino de envío inicial
  // fresco, nunca reanudando en silencio contra un lastSentSample
  // potencialmente desactualizado.
  useEffect(() => {
    deliveriesRef.current = activeDeliveries

    for (const delivery of activeDeliveries) {
      if (delivery.trackingEligibleNow === true) {
        knownIneligibleRef.current.delete(delivery.id)
      }
    }

    const eligibleNow = activeDeliveries.filter((d) => isCoreEligible(d, knownIneligibleRef.current))
    const eligibleNowIds = new Set(eligibleNow.map((d) => d.id))

    for (const id of [...deliveryStateRef.current.keys()]) {
      if (!eligibleNowIds.has(id)) cleanupDeliveryState(id)
    }

    for (const delivery of eligibleNow) {
      if (!deliveryStateRef.current.has(delivery.id)) {
        getOrCreateDeliveryState(delivery.id)
        void ensureInitialSendForDelivery(delivery.id)
      }
    }

    if (eligibleNow.length > 0) {
      startWatcherIfNeeded()
      scheduleWatchdog()
    } else {
      stopWatcher()
      clearWatchdog()
    }
  }, [activeDeliveries])

  // OPTION-V2: oculto -> clearWatch + cancelar todo timer de envío
  // pendiente/heartbeat; visible -> reiniciar el watcher y rearmar cada
  // heartbeat según su lastSuccessfulSendAt REAL (nunca resetear el
  // conteo a 0 sólo porque la pestaña volvió a mostrarse).
  // BACKGROUND_TRACKING_GUARANTEED=NO.
  //
  // P2-T02 Stage 6I (FINDING_P2T02_STAGE6H_01): un Android físico real
  // demostró que depender EXCLUSIVAMENTE de `visibilitychange` para decidir
  // cuándo el productor debe recuperarse no alcanza — la app quedó 9+
  // minutos sin producir ninguna ubicación tras un ciclo background (Home)
  // → foreground (Recientes) real, con permiso y elegibilidad intactos
  // todo el tiempo, hasta que una recarga completa la recuperó. `focus` y
  // `pageshow` se agregan como señales corroborantes/redundantes de "la
  // página volvió a primer plano" — y, crucialmente, un `watchIdRef` local
  // ya no se asume funcional sólo por existir: toda señal de foreground que
  // siga a una transición oculta real fuerza un reinicio duro del watcher
  // (stopWatcher + startWatcherIfNeeded) más un envío de recuperación
  // fresco, en vez de confiar en que el watch previo sigue vivo.
  // `pendingForegroundRecoveryRef` coalesce varias señales casi simultáneas
  // (visibilitychange + focus + pageshow del mismo "retorno") en
  // exactamente una ola de recuperación, y evita que un `focus` incidental
  // sobre una página que nunca estuvo oculta genere churn.
  useEffect(() => {
    // Coalescing: visibilitychange + focus + pageshow pueden llegar en la
    // misma ráfaga síncrona de un único "retorno a foreground" real (P2-T02
    // Stage 6I §18-19) — procesar cada uno inmediatamente duplicaría el
    // reinicio duro del watcher. En vez de eso, cada señal sólo actualiza
    // estado (incluida `pendingForegroundRecoveryRef`) y programa UNA
    // revisión en el próximo microtask; si ya hay una programada para este
    // tick, las señales siguientes no agregan una segunda — la revisión
    // real corre una sola vez, después de que TODAS las señales síncronas
    // del burst ya mutaron el estado que va a leer.
    let recoveryCheckScheduled = false

    function handleForegroundSignal() {
      if (document.visibilityState !== "visible") return
      const eligibleNow = deliveriesRef.current.filter((d) => isCoreEligible(d, knownIneligibleRef.current))
      if (eligibleNow.length === 0) return

      const forceRecovery = pendingForegroundRecoveryRef.current
      pendingForegroundRecoveryRef.current = false

      if (forceRecovery) {
        // Un watchId local no puede asumirse funcional sólo por existir
        // tras una transición oculta real — reiniciar duro en vez de
        // confiar en el guard "ya hay uno" de startWatcherIfNeeded().
        performForcedRecovery(eligibleNow)
      } else {
        // Señal de foreground incidental sobre una página que ya estaba
        // sana (nunca pasó por oculta desde la última recuperación) — sólo
        // asegurar que el watcher siga activo, sin forzar reinicio ni un
        // reenvío nuevo (evita churn en uso normal).
        startWatcherIfNeeded()
      }

      for (const delivery of eligibleNow) {
        const state = deliveryStateRef.current.get(delivery.id)
        if (state && state.heartbeatTimerId === null && state.lastSuccessfulSendAt !== null) {
          const remaining = Math.max(0, STATIONARY_HEARTBEAT_MS - (Date.now() - state.lastSuccessfulSendAt))
          scheduleHeartbeat(delivery.id, remaining)
        }
      }

      // Toda señal de foreground procesada (forzada o incidental) confirma
      // que seguimos visibles/elegibles — rearmar el watchdog desde acá,
      // nunca dejarlo huérfano de una generación vieja.
      scheduleWatchdog()
    }

    function scheduleForegroundCheck() {
      if (recoveryCheckScheduled) return
      recoveryCheckScheduled = true
      queueMicrotask(() => {
        recoveryCheckScheduled = false
        // A diferencia de un setTimeout, este microtask ya no puede
        // cancelarse una vez programado — si el hook se desmontó mientras
        // esperaba, nunca debe actuar sobre refs potencialmente obsoletas.
        if (!isMountedRef.current) return
        handleForegroundSignal()
      })
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        scheduleForegroundCheck()
        return
      }

      stopWatcher()
      pendingForegroundRecoveryRef.current = true
      clearWatchdog() // cero timers activos mientras oculto (OPTION-V2) — el watchdog también cuenta.
      for (const id of [...deliveryStateRef.current.keys()]) {
        clearDeliveryTimers(id)
      }
    }

    function handleWindowFocus() {
      scheduleForegroundCheck()
    }

    function handlePageShow(event: PageTransitionEvent) {
      // Una restauración real desde bfcache (persisted===true) puede no
      // haber pasado por nuestro propio manejador de "hidden" — tratarla
      // como una transición oculta real, salvo que ya sepamos que una
      // recuperación forzada acaba de correr hace muy poco (misma ola de
      // resume, sólo llegando tarde) — si no, un pageshow persisted que
      // sigue a una recuperación ya exitosa dispararía una segunda
      // redundante (P2-T02 Stage 6J).
      if (event.persisted) {
        const recoveredRecently =
          recoveryCompletedAtRef.current !== null &&
          Date.now() - recoveryCompletedAtRef.current < FOREGROUND_RECOVERY_DEDUPE_WINDOW_MS
        if (!recoveredRecently) pendingForegroundRecoveryRef.current = true
      }
      scheduleForegroundCheck()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleWindowFocus)
    window.addEventListener("pageshow", handlePageShow)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleWindowFocus)
      window.removeEventListener("pageshow", handlePageShow)
    }
  }, [])

  // Teardown completo al desmontar (o en el cleanup de un remount de React
  // Strict Mode) — garantiza que un segundo mount siempre arranca desde un
  // watcher/estado limpio, nunca coexistiendo con el del mount anterior.
  useEffect(() => {
    // Strict Mode simula unmount+remount reutilizando los MISMOS refs (no
    // los recrea) — reafirmar `true` acá en cada montaje real/simulado es
    // lo que evita que el segundo mount quede permanentemente "desmontado"
    // a los ojos de scheduleForegroundCheck's microtask guard.
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopWatcher()
      clearWatchdog()
      for (const id of [...deliveryStateRef.current.keys()]) {
        cleanupDeliveryState(id)
      }
    }
  }, [])

  // Elegible localmente = elegible "core" — el badge nunca depende de si en
  // este microinstante hay o no un fetch en vuelo (P2-T02 Stage 3 §9).
  const trackingActive = activeDeliveries.some((d) => isCoreEligible(d, knownIneligibleRef.current))

  return { trackingActive }
}
