// ============================================
// F9 — scan feedback (sound + vibration), browser only
// ============================================
// D6: sound ON by default with a visible mute toggle; vibration where the
// device supports it (Android — iOS Safari has no Vibration API, it is a
// silent no-op there). Never the only success signal: the scanner always
// shows a visual banner too.
// iOS only lets an AudioContext start from a user gesture, so callers
// invoke primeScanAudio() inside the tap that opens the scanner.

export type ScanFeedbackTone = "success" | "warning" | "error" | "info"

const SOUND_PREF_KEY = "deligo:scanner:sound"

let audioContext: AudioContext | null = null

export function primeScanAudio(): void {
  try {
    if (typeof window === "undefined") return
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    if (!audioContext) audioContext = new Ctor()
    if (audioContext.state === "suspended") void audioContext.resume()
  } catch {
    audioContext = null
  }
}

export function readScanSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_PREF_KEY) !== "off"
  } catch {
    return true
  }
}

export function writeScanSoundPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, enabled ? "on" : "off")
  } catch {
    // per-device convenience only
  }
}

function beep(frequency: number, startOffset: number, durationMs: number) {
  if (!audioContext) return
  const start = audioContext.currentTime + startOffset
  const osc = audioContext.createOscillator()
  const gain = audioContext.createGain()
  osc.type = "sine"
  osc.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000)
  osc.connect(gain)
  gain.connect(audioContext.destination)
  osc.start(start)
  osc.stop(start + durationMs / 1000 + 0.02)
}

export function playScanFeedback(tone: ScanFeedbackTone, soundEnabled: boolean): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(tone === "success" ? 60 : tone === "info" ? 30 : [70, 50, 70])
    }
  } catch {
    // vibration is best-effort
  }
  if (!soundEnabled) return
  try {
    if (!audioContext) return
    if (audioContext.state === "suspended") void audioContext.resume()
    if (tone === "success") beep(1046, 0, 90)
    else if (tone === "info") beep(880, 0, 60)
    else {
      beep(330, 0, 110)
      beep(330, 0.16, 110)
    }
  } catch {
    // audio is best-effort
  }
}
