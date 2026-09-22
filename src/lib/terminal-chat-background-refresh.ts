// P2-T49-R1B: política de refresco del chat de Terminal PyR mientras la
// pestaña sigue MONTADA — extraída a una función pura (sin React) sólo
// para poder testearla con fake timers y un `document`/`window` simulados,
// sin mockear Next.js ni montar el componente completo (que trae
// useParams/UI/toast/AttachmentPreviewModal). La lógica de red en sí
// (fetch, AbortController, generación, stoppedRef, manejo de 401/403/409)
// sigue enteramente en el propio `refresh()` de la página — este módulo
// SÓLO decide CUÁNDO llamarlo, nunca reimplementa el request.
export interface BackgroundTolerantRefreshDeps {
  /** ms nominales entre reintentos de background — best-effort, el
   *  navegador puede throttlear timers de pestañas ocultas. */
  intervalMs: number
  isVisible: () => boolean
  /** Delegado exactamente al `refresh()` real de la página — nunca se
   *  reimplementa acá el fetch/abort/generación. */
  run: (opts: { allowHidden: boolean }) => void
  setInterval: (handler: () => void, ms: number) => number
  clearInterval: (id: number) => void
  addEventListener: (target: "document" | "window", type: string, handler: () => void) => void
  removeEventListener: (target: "document" | "window", type: string, handler: () => void) => void
}

/**
 * Arranca el refresco inicial (si visible) + un interval de background que
 * corre SIEMPRE (visible u oculta) + listeners de foco/visibilidad que
 * refrescan inmediatamente al volver visible. Devuelve la función de
 * limpieza (clearInterval + remover listeners) — pensada para usarse
 * directamente como el cleanup de un `useEffect`.
 */
export function startBackgroundTolerantRefresh(deps: BackgroundTolerantRefreshDeps): () => void {
  const { intervalMs, isVisible, run, setInterval, clearInterval, addEventListener, removeEventListener } = deps

  if (isVisible()) run({ allowHidden: false })

  const intervalId = setInterval(() => {
    run({ allowHidden: true })
  }, intervalMs)

  const onVisible = () => {
    if (isVisible()) run({ allowHidden: false })
  }
  const onFocus = () => {
    if (isVisible()) run({ allowHidden: false })
  }

  addEventListener("document", "visibilitychange", onVisible)
  addEventListener("window", "focus", onFocus)

  return () => {
    clearInterval(intervalId)
    removeEventListener("document", "visibilitychange", onVisible)
    removeEventListener("window", "focus", onFocus)
  }
}
