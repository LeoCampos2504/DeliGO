// ============================================
// F9 — continuous-scan lock (pure, deterministic, testable)
// ============================================
// The camera loop calls `observe()` once per ANALYZED FRAME — including
// frames where nothing was decoded (codes = []). That is what lets this
// controller tell "the barcode is still in front of the camera" apart from
// "the barcode left and came back": absence is measured from frames, never
// from how often the decoder happens to report a success.
//
// Rules:
//   - a code is accepted after `confirmFrames` CONSECUTIVE frames see it
//     (filters single-frame misreads);
//   - once accepted, the code is LOCKED while it keeps appearing; it only
//     re-arms after it has been absent for `rearmAbsenceMs` (decode
//     dropouts shorter than that while the product sits still never add a
//     second unit — 10 s in front of the camera = exactly one unit);
//   - `sameCodeMinIntervalMs` is an extra floor between two acceptances of
//     the SAME code, never the primary mechanism;
//   - a different code is accepted as soon as it is confirmed;
//   - while `acceptNew` is false (variant selector open, an add in flight)
//     nothing is accepted, and every code seen is locked so that resuming
//     never adds a unit for a product that stayed in view during the pause.
// A fresh lock is created per scanner session, so closing and reopening the
// scanner never carries stale locks.

export interface ScanLockConfig {
  confirmFrames: number
  rearmAbsenceMs: number
  sameCodeMinIntervalMs: number
}

export const DEFAULT_SCAN_LOCK_CONFIG: ScanLockConfig = {
  confirmFrames: 2,
  rearmAbsenceMs: 700,
  sameCodeMinIntervalMs: 1200,
}

export interface ScanLock {
  /**
   * Feed one analyzed frame. `codes` are the lookup keys decoded in that
   * frame (possibly empty). Returns the code accepted on this frame, or null.
   */
  observe(codes: ReadonlyArray<string>, now: number, options?: { acceptNew?: boolean }): string | null
  /** Treat `code` as just accepted (e.g. a manual entry) so the camera doesn't re-add it while still in view. */
  lock(code: string, now: number): void
  isLocked(code: string): boolean
  reset(): void
}

export function createScanLock(config: Partial<ScanLockConfig> = {}): ScanLock {
  const cfg: ScanLockConfig = { ...DEFAULT_SCAN_LOCK_CONFIG, ...config }
  // code → last time it was seen while locked
  const locked = new Map<string, number>()
  // code → consecutive frames seen (unlocked candidates only)
  const streak = new Map<string, number>()
  // code → last acceptance time
  const acceptedAt = new Map<string, number>()

  function lock(code: string, now: number) {
    locked.set(code, now)
    streak.delete(code)
  }

  return {
    observe(codes, now, options = {}) {
      const acceptNew = options.acceptNew !== false
      const present = new Set(codes)

      // 1. Refresh or release locks.
      for (const [code, lastSeen] of locked) {
        if (present.has(code)) locked.set(code, now)
        else if (now - lastSeen >= cfg.rearmAbsenceMs) locked.delete(code)
      }

      // 2. Paused: everything in view becomes locked, nothing is accepted.
      if (!acceptNew) {
        for (const code of present) locked.set(code, now)
        streak.clear()
        return null
      }

      // 3. Consecutive-frame confirmation for unlocked codes.
      for (const code of [...streak.keys()]) {
        if (!present.has(code)) streak.delete(code)
      }
      let accepted: string | null = null
      for (const code of present) {
        if (locked.has(code)) continue
        const count = (streak.get(code) ?? 0) + 1
        streak.set(code, count)
        if (accepted !== null || count < cfg.confirmFrames) continue
        const last = acceptedAt.get(code)
        if (last !== undefined && now - last < cfg.sameCodeMinIntervalMs) continue
        accepted = code
      }
      if (accepted !== null) {
        acceptedAt.set(accepted, now)
        lock(accepted, now)
      }
      return accepted
    },
    lock(code, now) {
      acceptedAt.set(code, now)
      lock(code, now)
    },
    isLocked(code) {
      return locked.has(code)
    },
    reset() {
      locked.clear()
      streak.clear()
      acceptedAt.clear()
    },
  }
}
