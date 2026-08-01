// ============================================
// DeliGO - Service Worker
// ============================================

const CACHE_NAME = "deligo-v13";

// Assets to pre-cache on install
const PRE_CACHE_URLS = ["/cliente/"];

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

    // Pick the icon/badge per notification type so the user can tell at a
    // glance which PWA the notification belongs to.
    let icon = "/icon-cliente-192x192.png";
    if (notifType === "salon_new_order") {
      icon = "/icon-salon-192x192.png";
    } else if (notifType === "empleados_new_order" || notifType === "empleados_new_review") {
      icon = "/icon-empleado-192x192.png";
    } else if (notifType === "mesa_order_ready") {
      icon = "/icon-mozo-192x192.png";
    } else if (notifType === "new_order" || notifType === "order_update" || notifType === "review" || notifType === "account_update") {
      icon = "/icon-negocio-192x192.png";
    }

    const options = {
      body: data.body || "",
      icon: data.icon || icon,
      badge: data.badge || icon,
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
  const { type, pedidoId, role } = notificationData;

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
    const directMozoPanelUrl =
      type === "mesa_order_ready" &&
      typeof notificationData.url === "string" &&
      notificationData.url.startsWith("/mozo/panel/")
        ? notificationData.url
        : null;

    if (directMozoPanelUrl) {
      event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
          for (const client of clients) {
            if ("focus" in client && "navigate" in client) {
              const clientUrl = new URL(client.url);
              if (clientUrl.pathname.startsWith("/mozo/panel/")) {
                client.focus();
                client.navigate(directMozoPanelUrl);
                return;
              }
            }
          }
          for (const client of clients) {
            if ("focus" in client && "navigate" in client) {
              client.focus();
              client.navigate(directMozoPanelUrl);
              return;
            }
          }
          return self.clients.openWindow(directMozoPanelUrl);
        })
      );
      return;
    }

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
        return self.clients.openWindow("/cliente/");
      })
    );
    return;
  }

  // ── Personal (session-based) notifications ──
  // Bugfix-4 [17]: antes esta rama siempre construía/abría "/cliente/...",
  // sin importar el rol real del destinatario (negocio, repartidor), y nunca
  // navegaba al pedido/chat exacto — solo a la pestaña genérica. Ahora:
  //   1) Se resuelve la app correcta a partir de `data.role` (agregado en
  //      push.ts::createNotification), en vez de asumir "cliente" siempre.
  //   2) Se agrega el pedidoId (cuando existe) a la URL para que la página
  //      pueda abrir el recurso exacto (hoy: el chat del pedido).
  //   3) Si el payload trae `data.url`, se usa SOLO si es una ruta interna
  //      segura (empieza con "/", nunca "//" ni un esquema tipo "javascript:"),
  //      para evitar un open-redirect si algún payload llegara manipulado.
  const ROLE_BASE_PATH = { cliente: "/cliente/", negocio: "/negocio", repartidor: "/repartidor" };
  const effectiveRole = ROLE_BASE_PATH[role] ? role : "cliente";
  const basePath = ROLE_BASE_PATH[effectiveRole];

  // First, determine which tab to navigate to based on notification type
  let targetTab = "";
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

  function isSafeInternalUrl(value) {
    return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
  }

  // Build target URL: prefer an explicit, validated internal `data.url`;
  // otherwise build one from role + tab (+ pedidoId, + chat/review markers so
  // the page can open the exact conversation/review, per Bugfix-4B).
  let targetPath;
  if (isSafeInternalUrl(notificationData.url)) {
    targetPath = notificationData.url;
  } else {
    const params = new URLSearchParams();
    if (targetTab) params.set("tab", targetTab);
    if (pedidoId) params.set("pedidoId", String(pedidoId));
    if (type === "chat" && pedidoId) params.set("chat", String(pedidoId));
    // Bugfix-4B [17A]: "review_request" es específicamente "pedile al cliente
    // que califique este pedido" — marca la reseña para que el panel de
    // pedidos abra el modal automáticamente. `type === "review"` (nueva
    // reseña recibida / respuesta a una reseña) es un caso distinto: va a la
    // pestaña "resenas", no al modal de "dejar reseña", así que no lleva esta
    // marca.
    if (type === "review_request" && pedidoId) params.set("review", "1");
    targetPath = `${basePath}?${params.toString()}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Try to find an existing window already on the correct role's app
      for (const client of clients) {
        if ("focus" in client && "navigate" in client) {
          const clientUrl = new URL(client.url);
          if (clientUrl.pathname.startsWith(basePath.replace(/\/$/, "") || basePath)) {
            client.focus();
            client.navigate(targetPath);
            return;
          }
        }
      }
      // No window on the right app: focus any open window and navigate it there
      for (const client of clients) {
        if ("focus" in client && "navigate" in client) {
          client.focus();
          client.navigate(targetPath);
          return;
        }
      }
      // Otherwise open a new window for the correct role's app
      return self.clients.openWindow(targetPath);
    })
  );
});
