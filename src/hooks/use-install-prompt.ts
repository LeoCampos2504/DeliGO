"use client"

import { useState, useEffect, useCallback, useSyncExternalStore } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

// ---- isInstalled store ----
let isInstalledValue = false
const installedListeners = new Set<() => void>()

if (typeof window !== "undefined") {
  isInstalledValue =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as unknown as { standalone: boolean }).standalone === true)
}

function getInstalledSnapshot(): boolean {
  return isInstalledValue
}

const getInstalledServerSnapshot = () => false

function subscribeInstalled(cb: () => void): () => void {
  installedListeners.add(cb)
  return () => installedListeners.delete(cb)
}

// ---- deferredPrompt store ----
let deferredPromptValue: BeforeInstallPromptEvent | null = null
const promptListeners = new Set<() => void>()

function getDeferredSnapshot(): BeforeInstallPromptEvent | null {
  return deferredPromptValue
}

const getDeferredServerSnapshot = () => null

function subscribeDeferred(cb: () => void): () => void {
  promptListeners.add(cb)
  return () => promptListeners.delete(cb)
}

// ---- CRITICAL: Capture beforeinstallprompt at MODULE LEVEL ----
// This event fires very early — sometimes before React mounts.
// Adding the listener at module level ensures we never miss it.
if (typeof window !== "undefined") {
  if (!isInstalledValue) {
    window.addEventListener("beforeinstallprompt", (e: Event) => {
      e.preventDefault()
      deferredPromptValue = e as BeforeInstallPromptEvent
      promptListeners.forEach((l) => l())
    })

    window.addEventListener("appinstalled", () => {
      deferredPromptValue = null
      promptListeners.forEach((l) => l())
      isInstalledValue = true
      installedListeners.forEach((l) => l())
    })
  }
}

// ---- Platform detection helpers ----
export function detectPlatform(): "android" | "ios" | "desktop" | "other" {
  if (typeof window === "undefined") return "other"
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return "android"
  if (/iphone|ipad|ipod/i.test(ua)) return "ios"
  if (/win|mac|linux/i.test(ua) && !/mobile/i.test(ua)) return "desktop"
  return "other"
}

function isIosSafari(): boolean {
  if (typeof window === "undefined") return false
  const ua = navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  const isSafari = /safari/i.test(ua) && !/crios|fxios/i.test(ua)
  return isIos && isSafari
}

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as unknown as { standalone: boolean }).standalone === true)
  )
}

// ---- Hook ----
export function useInstallPrompt() {
  const isInstalled = useSyncExternalStore(
    subscribeInstalled,
    getInstalledSnapshot,
    getInstalledServerSnapshot
  )

  const deferredPrompt = useSyncExternalStore(
    subscribeDeferred,
    getDeferredSnapshot,
    getDeferredServerSnapshot
  )

  // The native beforeinstallprompt was captured (Android Chrome, Samsung Internet, etc.)
  const isInstallable = deferredPrompt !== null

  // Track whether we've determined the platform needs a manual prompt
  const [manualPromptNeeded, setManualPromptNeeded] = useState(false)

  // Determine if we need a manual install prompt
  useEffect(() => {
    if (isInstalled) return
    if (isStandaloneMode()) return
    // If native prompt is already available, no need for manual
    if (deferredPromptValue) return
    // If we already decided to show manual prompt, don't re-evaluate
    if (manualPromptNeeded) return

    const platform = detectPlatform()

    // iOS Safari: show manual instructions after a delay
    if (platform === "ios" && isIosSafari()) {
      const timer = setTimeout(() => {
        if (!deferredPromptValue && !isInstalledValue) {
          setManualPromptNeeded(true)
        }
      }, 3000)
      return () => clearTimeout(timer)
    }

    // Android: wait for beforeinstallprompt, show manual fallback if it doesn't fire
    if (platform === "android") {
      const timer = setTimeout(() => {
        // Only show manual prompt if native prompt still isn't available
        if (!deferredPromptValue && !isInstalledValue) {
          setManualPromptNeeded(true)
        }
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isInstalled, manualPromptNeeded])

  // shouldShowManualPrompt = manualPromptNeeded AND native prompt not available
  const shouldShowManualPrompt = manualPromptNeeded && !isInstallable

  const promptInstall = useCallback(async () => {
    if (!deferredPromptValue) return false

    const prompt = deferredPromptValue
    prompt.prompt()
    const { outcome } = await prompt.userChoice

    deferredPromptValue = null
    promptListeners.forEach((l) => l())

    if (outcome === "accepted") {
      isInstalledValue = true
      installedListeners.forEach((l) => l())
    }

    return outcome === "accepted"
  }, [])

  const platform = detectPlatform()

  return {
    isInstallable,
    isInstalled,
    promptInstall,
    shouldShowManualPrompt,
    platform,
  }
}
