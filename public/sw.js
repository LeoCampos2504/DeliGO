// ============================================
// DeliGO - Service Worker
// ============================================

const CACHE_NAME = "deligo-v3";

// Assets to pre-cache on install
const PRE_CACHE_URLS = ["/"];

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

// Fetch event — network-first strategy for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip chrome-extension and other non-http requests
  if (!request.url.startsWith("http")) return;

  // NEVER cache manifest.json or PWA icons — Chrome must always fetch fresh copies
  // to properly evaluate installability
  if (
    request.url.includes("manifest.json") ||
    request.url.includes("icon-192") ||
    request.url.includes("icon-512")
  ) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Network-first for API requests
  if (request.url.includes("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Cache-first for static assets (images, fonts, etc.)
  // But network-first for JS/CSS to avoid stale module issues in dev
  if (
    request.url.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2?|ttf|eot)$/i)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned);
          });
          return response;
        });
      })
    );
    return;
  }

  // Network-first for JS/CSS to avoid stale compilation issues
  if (
    request.url.match(/\.(css|js)$/i)
  ) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, cloned);
          });
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Network-first for everything else (HTML pages, etc.)
  event.respondWith(
    fetch(request)
      .then((response) => {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, cloned);
        });
        return response;
      })
      .catch(() => caches.match(request))
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
      icon: data.icon || "/icon-192x192.png",
      badge: data.badge || "/icon-192x192.png",
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
        icon: "/icon-192x192.png",
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
  let targetUrl = customUrl || "/";

  if (action === "review" && pedidoId) {
    // "Calificar" action — open the order to leave a review
    targetUrl = `/?tab=pedidos&review=${pedidoId}`;
  } else if (action === "navigate" && pedidoId) {
    // "Navegar" action for delivery — open the delivery detail
    targetUrl = `/?tab=entregas&pedido=${pedidoId}`;
  } else if (action === "view") {
    // "Ver pedido" / "Ver detalle" / "Ver reseña"
    if (type === "new_order" && pedidoId) {
      targetUrl = `/?tab=pedidos&pedido=${pedidoId}`;
    } else if (type === "new_delivery" && pedidoId) {
      targetUrl = `/?tab=entregas&pedido=${pedidoId}`;
    } else if (type === "order_update" && pedidoId) {
      targetUrl = `/?tab=pedidos&pedido=${pedidoId}`;
    } else if (type === "review") {
      targetUrl = `/?tab=resenas`;
    } else if (type === "review_request" && pedidoId) {
      targetUrl = `/?tab=pedidos&review=${pedidoId}`;
    } else if (customUrl) {
      targetUrl = customUrl;
    }
  } else if (!action) {
    // Default click (notification body, not an action button)
    // Route based on notification type
    if (type === "new_order" && pedidoId) {
      targetUrl = `/?tab=pedidos&pedido=${pedidoId}`;
    } else if (type === "order_update" && pedidoId) {
      targetUrl = `/?tab=pedidos&pedido=${pedidoId}`;
    } else if (type === "new_delivery" && pedidoId) {
      targetUrl = `/?tab=entregas&pedido=${pedidoId}`;
    } else if (type === "chat" && pedidoId) {
      targetUrl = `/?tab=pedidos&chat=${pedidoId}`;
    } else if (type === "review") {
      targetUrl = `/?tab=resenas`;
    } else if (type === "review_request" && pedidoId) {
      targetUrl = `/?tab=pedidos&review=${pedidoId}`;
    } else if (type === "account_update") {
      targetUrl = `/?tab=config`;
    } else if (customUrl) {
      targetUrl = customUrl;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open, navigating to the target URL
      for (const client of clients) {
        // Check if the client URL has the same origin
        if ("focus" in client && "navigate" in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});
