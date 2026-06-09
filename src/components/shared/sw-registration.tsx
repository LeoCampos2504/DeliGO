"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/lib/register-sw";

/**
 * Client component that registers the service worker on mount.
 * Should be rendered once in the root layout.
 * Uses useEffect to ensure it only runs on the client side
 * and does not block the initial render.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    const register = () => {
      registerServiceWorker();
    };

    // Register service worker after the page has loaded
    // to avoid blocking the initial render
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
