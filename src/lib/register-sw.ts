// ============================================
// DeliGO - Service Worker Registration
// ============================================

import { toast } from "sonner";

const SW_PATH = "/sw.js";

let registration: ServiceWorkerRegistration | null = null;
let swUpdateAvailable = false;
let updateToastShownThisSession = false;

/**
 * Check if service workers are supported
 */
function isServiceWorkerSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator
  );
}

/**
 * Handle service worker updates
 * Auto-applies updates silently. Only shows a toast once per session
 * if the user hasn't reloaded yet after 30 seconds.
 */
function handleUpdate(newReg: ServiceWorkerRegistration): void {
  // If a waiting SW already exists, auto-activate it silently
  if (newReg.waiting) {
    swUpdateAvailable = true;
    // Auto-activate the waiting SW
    newReg.waiting.postMessage({ type: "SKIP_WAITING" });

    // Show a subtle toast only once per session, after a delay
    if (!updateToastShownThisSession) {
      updateToastShownThisSession = true;
      setTimeout(() => {
        // Only show if the page still hasn't reloaded
        toast.info("DeliGO se actualizó", {
          description: "La próxima vez que abras la app tendrás la última versión",
          duration: 5000,
        });
      }, 30000);
    }
  }

  newReg.addEventListener("updatefound", () => {
    const newWorker = newReg.installing;
    if (!newWorker) return;

    newWorker.addEventListener("statechange", () => {
      if (
        newWorker.state === "installed" &&
        navigator.serviceWorker.controller
      ) {
        // New content is available
        swUpdateAvailable = true;

        // Auto-activate: send SKIP_WAITING so the new SW takes over
        if (newReg.waiting) {
          newReg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        // Show a one-time subtle notification after a delay
        if (!updateToastShownThisSession) {
          updateToastShownThisSession = true;
          setTimeout(() => {
            toast.info("DeliGO se actualizó", {
              description: "La próxima vez que abras la app tendrás la última versión",
              duration: 5000,
            });
          }, 30000);
        }
      }
    });
  });
}

/**
 * Register the service worker
 * Should be called once when the app loads (client-side only)
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    console.log("[SW] Service workers not supported in this browser");
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, {
      scope: "/",
    });

    registration = reg;
    console.log("[SW] Service worker registered successfully", reg.scope);

    // Check for updates immediately
    handleUpdate(reg);

    // Listen for controller change (new SW activated) — auto-reload once
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[SW] Controller changed — new service worker activated");
      // Only auto-reload once per page load to avoid infinite loops
      if (!hasReloaded && swUpdateAvailable) {
        hasReloaded = true;
        // Soft reload: just let the new SW take control, don't force a page reload
        // The user will get the new version on next navigation
      }
    });

    // Periodically check for updates (every 30 minutes)
    if ("updateViaCache" in reg) {
      // Use updateViaCache if available
    }
    const updateInterval = setInterval(() => {
      reg.update().catch((err) => {
        console.warn("[SW] Update check failed:", err);
      });
    }, 30 * 60 * 1000);

    // Clean up interval on page unload
    window.addEventListener("beforeunload", () => {
      clearInterval(updateInterval);
    });

    return reg;
  } catch (error) {
    console.error("[SW] Service worker registration failed:", error);
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!isServiceWorkerSupported() || !registration) {
    return false;
  }

  try {
    const result = await registration.unregister();
    registration = null;
    swUpdateAvailable = false;
    console.log("[SW] Service worker unregistered");
    return result;
  } catch (error) {
    console.error("[SW] Service worker unregistration failed:", error);
    return false;
  }
}

/**
 * Check if a service worker update is available
 */
export function isUpdateAvailable(): boolean {
  return swUpdateAvailable;
}

/**
 * Get the current service worker registration
 */
export function getRegistration(): ServiceWorkerRegistration | null {
  return registration;
}
