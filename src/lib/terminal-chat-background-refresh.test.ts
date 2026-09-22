// P2-T49-R1B: contrato de la política de refresco de background del chat
// de Terminal PyR — fake timers + document/window simulados, sin montar
// React ni Next.js (evita el costo/las dependencias de Next router context
// que un test de DOM del page.tsx completo requeriría). El fetch/abort/
// generación real vive intacto en refresh() de la página — acá sólo se
// verifica CUÁNDO se lo invoca.
import { describe, expect, test, mock } from "bun:test"
import { startBackgroundTolerantRefresh } from "./terminal-chat-background-refresh"

function makeFakeTimers() {
  let now = 0
  const timers = new Map<number, { at: number; interval: number; handler: () => void }>()
  let nextId = 1

  return {
    setInterval: (handler: () => void, ms: number): number => {
      const id = nextId++
      timers.set(id, { at: now + ms, interval: ms, handler })
      return id
    },
    clearInterval: (id: number): void => {
      timers.delete(id)
    },
    advance(ms: number) {
      const target = now + ms
      // Ejecuta todos los ticks vencidos en orden, reprogramando cada
      // interval — suficiente para simular varios ciclos de 10s.
      while (true) {
        let nextDue: { id: number; at: number } | null = null
        for (const [id, t] of timers) {
          if (t.at <= target && (nextDue === null || t.at < nextDue.at)) nextDue = { id, at: t.at }
        }
        if (!nextDue) break
        now = nextDue.at
        const t = timers.get(nextDue.id)
        if (!t) continue
        t.handler()
        t.at = now + t.interval
      }
      now = target
    },
  }
}

function makeFakeListenerTarget() {
  const handlers = new Map<string, Set<() => void>>()
  return {
    addEventListener: (type: string, handler: () => void) => {
      if (!handlers.has(type)) handlers.set(type, new Set())
      handlers.get(type)!.add(handler)
    },
    removeEventListener: (type: string, handler: () => void) => {
      handlers.get(type)?.delete(handler)
    },
    fire: (type: string) => {
      for (const handler of handlers.get(type) ?? []) handler()
    },
    listenerCount: (type: string) => handlers.get(type)?.size ?? 0,
  }
}

describe("P2-T49-R1B — startBackgroundTolerantRefresh", () => {
  test("A. pestaña oculta + tick del interval => refresh permitido con allowHidden=true", () => {
    const timers = makeFakeTimers()
    const doc = makeFakeListenerTarget()
    const win = makeFakeListenerTarget()
    const run = mock(() => {})
    let visible = false

    startBackgroundTolerantRefresh({
      intervalMs: 10000,
      isVisible: () => visible,
      run,
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
      addEventListener: (target, type, handler) => (target === "document" ? doc : win).addEventListener(type, handler),
      removeEventListener: (target, type, handler) => (target === "document" ? doc : win).removeEventListener(type, handler),
    })
    run.mockClear() // descarta el refresh inicial (isVisible()===false acá, así que ni siquiera corre)

    timers.advance(10000)
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenLastCalledWith({ allowHidden: true })
  })

  test("B. pestaña visible + tick del interval => refresh igual de permitido", () => {
    const timers = makeFakeTimers()
    const doc = makeFakeListenerTarget()
    const win = makeFakeListenerTarget()
    const run = mock(() => {})

    startBackgroundTolerantRefresh({
      intervalMs: 10000,
      isVisible: () => true,
      run,
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
      addEventListener: (target, type, handler) => (target === "document" ? doc : win).addEventListener(type, handler),
      removeEventListener: (target, type, handler) => (target === "document" ? doc : win).removeEventListener(type, handler),
    })
    expect(run).toHaveBeenCalledTimes(1) // refresh inicial, visible=true
    expect(run).toHaveBeenLastCalledWith({ allowHidden: false })

    run.mockClear()
    timers.advance(10000)
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenLastCalledWith({ allowHidden: true })
  })

  test("C. focus => refresh inmediato (allowHidden=false), gateado por isVisible", () => {
    const timers = makeFakeTimers()
    const doc = makeFakeListenerTarget()
    const win = makeFakeListenerTarget()
    const run = mock(() => {})
    let visible = false

    startBackgroundTolerantRefresh({
      intervalMs: 10000,
      isVisible: () => visible,
      run,
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
      addEventListener: (target, type, handler) => (target === "document" ? doc : win).addEventListener(type, handler),
      removeEventListener: (target, type, handler) => (target === "document" ? doc : win).removeEventListener(type, handler),
    })
    run.mockClear()

    // Foco sin visibilidad real (caso borde) no debería disparar nada.
    win.fire("focus")
    expect(run).not.toHaveBeenCalled()

    visible = true
    win.fire("focus")
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenLastCalledWith({ allowHidden: false })
  })

  test("D. hidden -> visible (visibilitychange) => refresh inmediato", () => {
    const timers = makeFakeTimers()
    const doc = makeFakeListenerTarget()
    const win = makeFakeListenerTarget()
    const run = mock(() => {})
    let visible = false

    startBackgroundTolerantRefresh({
      intervalMs: 10000,
      isVisible: () => visible,
      run,
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
      addEventListener: (target, type, handler) => (target === "document" ? doc : win).addEventListener(type, handler),
      removeEventListener: (target, type, handler) => (target === "document" ? doc : win).removeEventListener(type, handler),
    })
    run.mockClear()

    visible = true
    doc.fire("visibilitychange")
    expect(run).toHaveBeenCalledTimes(1)
    expect(run).toHaveBeenLastCalledWith({ allowHidden: false })
  })

  test("E. cleanup (unmount) => clearInterval + listeners removidos, ningún refresh posterior", () => {
    const timers = makeFakeTimers()
    const doc = makeFakeListenerTarget()
    const win = makeFakeListenerTarget()
    const run = mock(() => {})

    const stop = startBackgroundTolerantRefresh({
      intervalMs: 10000,
      isVisible: () => true,
      run,
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
      addEventListener: (target, type, handler) => (target === "document" ? doc : win).addEventListener(type, handler),
      removeEventListener: (target, type, handler) => (target === "document" ? doc : win).removeEventListener(type, handler),
    })
    expect(doc.listenerCount("visibilitychange")).toBe(1)
    expect(win.listenerCount("focus")).toBe(1)

    stop()
    expect(doc.listenerCount("visibilitychange")).toBe(0)
    expect(win.listenerCount("focus")).toBe(0)

    run.mockClear()
    timers.advance(60000)
    doc.fire("visibilitychange")
    win.fire("focus")
    expect(run).not.toHaveBeenCalled()
  })

  test("F. la protección de stoppedRef/401/403/409 sigue siendo responsabilidad exclusiva de refresh() — el scheduler nunca decide eso, sólo delega", () => {
    // El scheduler no conoce ni debe conocer stoppedRef/401/403/409: eso
    // vive enteramente en refresh() de la página, sin cambios de esta
    // ronda. Acá sólo se confirma que, si el `run` delegado decide no
    // hacer nada (equivalente a que refresh() cortó por stoppedRef), el
    // scheduler no reintenta con ninguna lógica propia ni entra en loop —
    // simplemente sigue llamando `run` en cada ciclo, tal cual refresh()
    // ya lo neutraliza internamente.
    const timers = makeFakeTimers()
    const doc = makeFakeListenerTarget()
    const win = makeFakeListenerTarget()
    let stopped = false
    const run = mock((_opts: { allowHidden: boolean }) => {
      if (stopped) return // simula el early-return real de refresh() por stoppedRef
    })

    startBackgroundTolerantRefresh({
      intervalMs: 10000,
      isVisible: () => false,
      run,
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
      addEventListener: (target, type, handler) => (target === "document" ? doc : win).addEventListener(type, handler),
      removeEventListener: (target, type, handler) => (target === "document" ? doc : win).removeEventListener(type, handler),
    })
    run.mockClear()
    stopped = true

    timers.advance(30000) // 3 ciclos
    expect(run).toHaveBeenCalledTimes(3) // el scheduler sigue llamando; run() es quien decide no hacer nada
  })
})
