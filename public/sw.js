// ============================================
// DeliGO - Service Worker
// ============================================

const CACHE_NAME = "deligo-v8";

// Assets to pre-cache on install
const PRE_CACHE_URLS = ["/"];

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
    const options = {
      body: data.body || "",
      icon: data.icon || "/icon-cliente-192x192.png",
      badge: data.badge || "/icon-cliente-192x192.png",
      vibrate: [100, 50, 100],
      data: {
        url: data.data?.url || "/",
        type: data.data?.type || "general",
        pedidoId: data.data?.pedidoId || null,
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

// Notification click event — deep linking based on notification type
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const { type, pedidoId, url: customUrl } = notificationData;

  // Handle action button clicks
  const action = event.action;

  // Build deep link URL based on notification type and action
  let targetPath = "/";
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
  } else if (type === "mesa_order_ready") {
    targetTab = "salon";
  }

  // Override tab based on action
  if (action === "review" && pedidoId) {
    targetTab = "pedidos";
  } else if (action === "navigate" && pedidoId) {
    targetTab = "entregas";
  }

  // Handle mesa_order_ready — navigate to the employee page
  if (type === "mesa_order_ready") {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        // Try to find the employee page (/m/[token]) that's already open
        for (const client of clients) {
          if ("focus" in client && "navigate" in client) {
            const clientUrl = new URL(client.url);
            // If already on an employee page, just focus it
            if (clientUrl.pathname.startsWith("/m/")) {
              client.focus();
              return;
            }
          }
        }
        // If no employee page is open, try salon page
        for (const client of clients) {
          if ("focus" in client && "navigate" in client) {
            const clientUrl = new URL(client.url);
            if (clientUrl.pathname.startsWith("/s/")) {
              client.focus();
              return;
            }
          }
        }
        // Just focus any existing window
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            return;
          }
        }
        return self.clients.openWindow("/");
      })
    );
    return;
  }

  // Build target URL with tab parameter
  targetPath = `/?tab=${targetTab}`;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Try to find an existing window to focus
      for (const client of clients) {
        if ("focus" in client && "navigate" in client) {
          const clientUrl = new URL(client.url);

          // If the client is already on a role page, navigate with tab param on that page
          if (clientUrl.pathname === "/cliente" && (type === "order_update" || type === "review_request" || type === "chat" || type === "review")) {
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
