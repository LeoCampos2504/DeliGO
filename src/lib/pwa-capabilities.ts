export type PwaPlatform = "ios" | "android" | "desktop" | "other"

export type PwaCapabilities = {
  platform: PwaPlatform
  isIos: boolean
  isIosSafari: boolean
  isStandalone: boolean
  supportsServiceWorker: boolean
  supportsPushManager: boolean
  supportsNotification: boolean
  notificationPermission: NotificationPermission | "unsupported"
  secureContext: boolean
}

export function getPwaCapabilities(): PwaCapabilities {
  if (typeof window === "undefined") {
    return {
      platform: "other",
      isIos: false,
      isIosSafari: false,
      isStandalone: false,
      supportsServiceWorker: false,
      supportsPushManager: false,
      supportsNotification: false,
      notificationPermission: "unsupported",
      secureContext: false,
    }
  }

  const userAgent = navigator.userAgent
  const platformName = navigator.platform
  const isIpadOS =
    platformName === "MacIntel" &&
    navigator.maxTouchPoints > 1
  const isIos = /iphone|ipad|ipod/i.test(userAgent) || isIpadOS
  const isAndroid = /android/i.test(userAgent)
  const isDesktop =
    !isIos &&
    !isAndroid &&
    /win|mac|linux/i.test(userAgent)
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  const isSafari =
    /safari/i.test(userAgent) &&
    !/crios|fxios|edgios|opr|opera|chrome|chromium/i.test(userAgent)

  return {
    platform: isIos ? "ios" : isAndroid ? "android" : isDesktop ? "desktop" : "other",
    isIos,
    isIosSafari: isIos && isSafari,
    isStandalone,
    supportsServiceWorker: "serviceWorker" in navigator,
    supportsPushManager: "PushManager" in window,
    supportsNotification: "Notification" in window,
    notificationPermission: "Notification" in window ? Notification.permission : "unsupported",
    secureContext: window.isSecureContext,
  }
}
