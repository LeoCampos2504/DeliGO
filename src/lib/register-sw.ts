// ============================================
// DeliGO - Service Worker Registration
// ============================================

import { toast } from "sonner";

const SW_PATH = "/sw.js";

let registration: ServiceWorkerRegistration | null = null;
let swUpdateAvailable = false;

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
 * Shows a toast notification when a new version is available
 */
function handleUpdate(newReg: ServiceWorkerRegistration): void {
  if (newReg.waiting) {
    swUpdateAvailable = true;
    toast.info("Nueva versión disponible", {
      description: "Recargá la página para actualizar DeliGO",
      duration: 8000,
      action: {
        label: "Actualizar",
        onClick: () => {
          if (newReg.waiting) {
            newReg.waiting.postMessage({ type: "SKIP_WAITING" });
          }
          window.location.reload();
        },
      },
    });
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
        toast.info("Nueva versión disponible", {
          description: "Recargá la página para actualizar DeliGO",
          duration: 8000,
          action: {
            label: "Actualizar",
            onClick: () => {
              if (newReg.waiting) {
                newReg.waiting.postMessage({ type: "SKIP_WAITING" });
              }
              window.location.reload();
            },
          },
        });
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

    // Listen for controller change (new SW activated)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[SW] Controller changed — new service worker activated");
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
