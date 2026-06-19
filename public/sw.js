// ============================================
// DeliGO - Service Worker
// ============================================

const CACHE_NAME = "deligo-v14";

// Assets to pre-cache on install
const PRE_CACHE_URLS = ["/cliente"];

// Maximum number of entries in the cache (prevent QuotaExceededError)
const MAX_CACHE_ENTRIES = 150;

// Install event — pre-cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRE_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate event — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Helper: trim cache to MAX_CACHE_ENTRIES (LRU-ish by deletion order)
async function trimCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    if (keys.length > MAX_CACHE_ENTRIES) {
      // Delete oldest entries (first in = oldest)
      const toDelete = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
      await Promise.all(toDelete.map((key) => cache.delete(key)));
    }
  } catch {
    // Ignore trim errors
  }
}

// Helper: safe cache match that always returns a Response or undefined
async function safeCacheMatch(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match(request);
    return response || undefined;
  } catch {
    return undefined;
  }
}

// Helper: cache a response (ignoring errors, skipping non-cacheable responses)
async function cacheResponse(request, response) {
  try {
    // Only cache successful responses with OK status
    if (!response || !response.ok || response.status !== 200) return;
    // Don't cache opaque responses (cross-origin without CORS) — they're huge and useless
    if (response.type === "opaque") return;
    // Don't cache ranged responses
    if (response.headers.get("content-range")) return;

    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Ignore cache errors (including QuotaExceeded)
  }
}

// Fetch event — network-first strategy with safe fallbacks
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http requests
  if (!request.url.startsWith("http")) return;

  // Skip Next.js HMR/WebSocket requests
  if (request.url.includes("/_next/") && request.url.includes("hmr")) return;

  // NEVER cache manifest files or PWA icons — Chrome must always fetch fresh copies
  if (
    request.url.includes("manifest") ||
    request.url.includes("icon-192") ||
    request.url.includes("icon-512")
  ) {
    event.respondWith(
      fetch(request).catch(() => safeCacheMatch(request)).then((r) => r || new Response("", { status: 503 }))
    );
    return;
  }

  // Network-first for API requests — don't cache them (they change constantly)
  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request)
        .catch(() => safeCacheMatch(request))
        .then((r) => r || new Response(JSON.stringify({ error: "Sin conexión" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }))
    );
    return;
  }

  // Cache-first for static assets (images, fonts)
  if (
    request.url.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot)$/i)
  ) {
    event.respondWith(
      safeCacheMatch(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            cacheResponse(request, response);
            return response;
          })
          .catch(() => new Response("", { status: 503 }));
      })
    );
    // Periodically trim cache
    event.waitUntil(trimCache());
    return;
  }

  // Network-first for JS/CSS/HTML — don't cache in dev to avoid stale modules
  // In production these change with each deploy, so caching is not critical
  if (
    request.url.match(/\.(css|js)$/i) ||
    request.url.includes("/_next/")
  ) {
    event.respondWith(
      fetch(request)
        .catch(() => safeCacheMatch(request))
        .then((r) => r || new Response("", { status: 503 }))
    );
    return;
  }

  // Network-first for everything else (HTML pages, etc.)
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache successful HTML responses
        if (response.ok && response.headers.get("content-type")?.includes("text/html")) {
          cacheResponse(request, response);
        }
        return response;
      })
      .catch(() => safeCacheMatch(request))
      .then((r) => r || new Response("", { status: 503 }))
  );
});

// Handle SKIP_WAITING message from the registration
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Push notification event
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "DeliGO";
    const notifType = data.data?.type || "general";

    // Pick the icon per notification type so the user can tell at a glance
    // which PWA the notification belongs to. The icon maps to the RECIPIENT
    // of the notification (not the sender), so each PWA shows its own icon.
    //
    //   cliente  ← order_update, review_request, chat, review
    //   negocio  ← new_order, order_update, review, account_update, chat
    //   repartidor ← new_delivery, order_update, chat
    //   salon    ← salon_new_order, salon_order_cancelled
    //   empleado ← empleados_new_order, empleados_new_review, empleados_order_cancelled
    //   mozo     ← mesa_order_ready
    let icon = "/icon-cliente-192x192.png";
    if (notifType === "salon_new_order" || notifType === "salon_order_cancelled") {
      icon = "/icon-salon-192x192.png";
    } else if (
      notifType === "empleados_new_order" ||
      notifType === "empleados_new_review" ||
      notifType === "empleados_order_cancelled"
    ) {
      icon = "/icon-empleado-192x192.png";
    } else if (notifType === "mesa_order_ready") {
      icon = "/icon-mozo-192x192.png";
    } else if (notifType === "new_delivery") {
      icon = "/icon-repartidor-192x192.png";
    } else if (
      notifType === "new_order" ||
      notifType === "order_update" ||
      notifType === "review" ||
      notifType === "account_update"
    ) {
      icon = "/icon-negocio-192x192.png";
    }

    const options = {
      body: data.body || "",
      icon: data.icon || icon,
      // badge = small status-bar icon. Android prefers monochrome; we reuse
      // the role icon as a fallback (no dedicated monochrome badge exists).
      badge: data.badge || icon,
      image: data.image || undefined,
      tag: data.tag || undefined,
      vibrate: [100, 50, 100],
      data: {
        url: data.data?.url || "/",
        type: notifType,
        pedidoId: data.data?.pedidoId || null,
        mesaNumero: data.data?.mesaNumero || null,
      },
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    // Fallback for non-JSON push data
    event.waitUntil(
      self.registration.showNotification("DeliGO", {
        body: event.data.text(),
        icon: "/icon-cliente-192x192.png",
      })
    );
  }
});

// Helper: focus the first open client whose pathname starts with one of the
// given prefixes. Returns true if a client was focused, false otherwise.
function focusClientByPath(clients, prefixes) {
  for (const prefix of prefixes) {
    for (const client of clients) {
      if ("focus" in client && "navigate" in client) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname.startsWith(prefix)) {
          client.focus();
          return true;
        }
      }
    }
  }
  return false;
}

// Helper: focus any open window (last resort).
function focusAnyClient(clients) {
  for (const client of clients) {
    if ("focus" in client) {
      client.focus();
      return true;
    }
  }
  return false;
}

// Notification click event — deep linking based on notification type
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const { type, pedidoId } = notificationData;

  // Handle action button clicks
  const action = event.action;

  // ── Shared-display PWA notifications ──
  // These PWAs are token-based (no session cookie), so we focus the already-
  // open page rather than navigating to a /cliente, /negocio, etc. URL.
  //
  //   salon_new_order            → /s/[token]  (salon shared display)
  //   empleados_new_order        → /e/[token]  (empleados shared panel, pedidos tab)
  //   empleados_new_review       → /e/[token]  (empleados shared panel, reseñas tab)
  //   mesa_order_ready           → /m/[token]  (mozo PWA), fallback /s/[token]
  if (
    type === "salon_new_order" ||
    type === "empleados_new_order" ||
    type === "empleados_new_review" ||
    type === "mesa_order_ready"
  ) {
    // Determine the preferred path prefix(es) for this notification type.
    let preferredPrefixes;
    if (type === "salon_new_order") {
      preferredPrefixes = ["/s/"];
    } else if (type === "empleados_new_order" || type === "empleados_new_review") {
      preferredPrefixes = ["/e/"];
    } else {
      // mesa_order_ready: mozo first, then salon as fallback
      preferredPrefixes = ["/m/", "/s/"];
    }

    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        // 1) Try to focus an already-open page matching the preferred prefix
        for (const prefix of preferredPrefixes) {
          for (const client of clients) {
            if ("focus" in client && "navigate" in client) {
              const clientUrl = new URL(client.url);
              if (clientUrl.pathname.startsWith(prefix)) {
                client.focus();
                return;
              }
            }
          }
        }
        // 2) Fallback: focus any open window
        if (focusAnyClient(clients)) return;
        // 3) Last resort: open the root (user will need to navigate manually)
        return self.clients.openWindow("/cliente");
      })
    );
    return;
  }

  // ── Personal (session-based) notifications ──
  // Build deep link URL based on notification type and action
  let targetPath = "/cliente";
  let targetTab = "";

  // First, determine which tab to navigate to based on notification type
  if (type === "new_order" || type === "order_update" || type === "review_request") {
    targetTab = "pedidos";
  } else if (type === "new_delivery") {
    targetTab = "entregas";
  } else if (type === "chat") {
    targetTab = "pedidos";
  } else if (type === "review") {
    targetTab = "resenas";
  } else if (type === "account_update") {
    targetTab = "config";
  }

  // Override tab based on action
  if (action === "review" && pedidoId) {
    targetTab = "pedidos";
  } else if (action === "navigate" && pedidoId) {
    targetTab = "entregas";
  }

  // Build target URL with tab parameter
  targetPath = `/cliente?tab=${targetTab}`;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Try to find an existing window to focus
      for (const client of clients) {
        if ("focus" in client && "navigate" in client) {
          const clientUrl = new URL(client.url);

          // If the client is already on a role page, navigate with tab param on that page
          if (clientUrl.pathname.startsWith("/cliente") && (type === "order_update" || type === "review_request" || type === "chat" || type === "review")) {
            client.focus();
            client.navigate(`/cliente?tab=${targetTab}`);
            return;
          }
          if (clientUrl.pathname === "/negocio" && (type === "new_order" || type === "order_update" || type === "review" || type === "chat" || type === "account_update")) {
            client.focus();
            client.navigate(`/negocio?tab=${targetTab}`);
            return;
          }
          if (clientUrl.pathname === "/repartidor" && (type === "new_delivery" || type === "order_update" || type === "chat")) {
            client.focus();
            client.navigate(`/repartidor?tab=${targetTab}`);
            return;
          }

          // Fallback: just focus and navigate to root with tab param
          client.focus();
          client.navigate(targetPath);
          return;
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(targetPath);
    })
  );
});
