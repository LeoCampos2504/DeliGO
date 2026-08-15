// ============================================
// DeliGO - Service Worker
// ============================================

// Bugfix-4D: se sube la versión porque este deploy cambia lógica real de
// push/notificationclick (no solo el cache de assets) — subir el número
// fuerza que `activate` borre cualquier caché vieja apenas el SW nuevo tome
// control, en vez de esperar a que expire por su cuenta. `install` ya llama
// a `skipWaiting()` y `activate` ya llama a `clients.claim()`, así que el SW
// nuevo se activa e instala solo con el próximo deploy — no requiere que el
// usuario borre datos ni reinstale la PWA.
const CACHE_NAME = "deligo-v14";

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

// ============================================
// Bugfix-4C: Web Share Target (recibir comprobantes desde apps externas)
// ============================================
// Solo intercepta el POST exacto que cada manifest declara como
// `share_target.action`. El archivo NUNCA se sube a ningún servidor acá: se
// guarda temporalmente en IndexedDB del propio navegador (nunca en DB,
// nunca en public/, nunca base64) hasta que el usuario elige un chat y
// confirma el envío desde la página /<rol>/share-target. Si algo falla acá
// (SW no soporta IndexedDB, formData vacío, etc.), se cae al fallback de
// red (src/app/<rol>/share-target/receive/route.ts), que tampoco guarda
// nada — solo redirige con `unsupported=1`.
const SHARE_TARGET_PATHS = {
  "/cliente/share-target/receive": "cliente",
  "/negocio/share-target/receive": "negocio",
  "/operaciones/share-target/receive": "operaciones",
};
const SHARE_TARGET_DB_NAME = "deligo-share-target";
const SHARE_TARGET_STORE_NAME = "pending-shares";
const SHARE_TARGET_TTL_MS = 15 * 60 * 1000; // 15 minutos
const SHARE_TARGET_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB, igual que /api/upload
const SHARE_TARGET_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB, igual que /api/upload
const SHARE_TARGET_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function shareTargetToken() {
  if (self.crypto && typeof self.crypto.randomUUID === "function") {
    return self.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (self.crypto && typeof self.crypto.getRandomValues === "function") {
    self.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function openShareTargetDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHARE_TARGET_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SHARE_TARGET_STORE_NAME)) {
        db.createObjectStore(SHARE_TARGET_STORE_NAME, { keyPath: "token" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Limpieza best-effort de comparticiones vencidas — no bloquea el guardado
// de la nueva si falla.
function cleanupExpiredShares(db) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SHARE_TARGET_STORE_NAME, "readwrite");
      const store = tx.objectStore(SHARE_TARGET_STORE_NAME);
      const now = Date.now();
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) return;
        if (cursor.value && cursor.value.expiresAt < now) cursor.delete();
        cursor.continue();
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function putPendingShare(record) {
  return openShareTargetDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        cleanupExpiredShares(db).then(() => {
          const tx = db.transaction(SHARE_TARGET_STORE_NAME, "readwrite");
          tx.objectStore(SHARE_TARGET_STORE_NAME).put(record);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      })
  );
}

async function handleShareTargetPost(event, role) {
  try {
    const formData = await event.request.formData();
    const file = formData.get("file");
    const title = typeof formData.get("title") === "string" ? formData.get("title") : "";
    const text = typeof formData.get("text") === "string" ? formData.get("text") : "";
    // Nunca se navega a esto ni se trata como URL real — es solo texto
    // informativo que algunas apps mandan junto al archivo.
    const sharedUrl = typeof formData.get("url") === "string" ? formData.get("url") : "";

    const isFile = file && typeof file === "object" && typeof file.arrayBuffer === "function";
    if (!isFile || !file.type || !SHARE_TARGET_ALLOWED_TYPES.includes(file.type)) {
      return Response.redirect(`/${role}/share-target?rejected=1`, 303);
    }
    const isPdf = file.type === "application/pdf";
    const maxSize = isPdf ? SHARE_TARGET_MAX_FILE_SIZE : SHARE_TARGET_MAX_IMAGE_SIZE;
    if (!file.size || file.size <= 0 || file.size > maxSize) {
      return Response.redirect(`/${role}/share-target?rejected=1`, 303);
    }

    const token = shareTargetToken();
    const now = Date.now();
    await putPendingShare({
      token,
      blob: file,
      name: (file.name || "comprobante").toString().slice(0, 120),
      type: file.type,
      size: file.size,
      role,
      createdAt: now,
      expiresAt: now + SHARE_TARGET_TTL_MS,
      title: title.slice(0, 200),
      text: text.slice(0, 500),
      sharedUrl: sharedUrl.slice(0, 500),
    });

    return Response.redirect(`/${role}/share-target?share=${token}`, 303);
  } catch {
    return Response.redirect(`/${role}/share-target?unsupported=1`, 303);
  }
}

// Fetch event — network-first strategy with safe fallbacks
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Bugfix-4C: interceptar SOLO el POST exacto de share_target de cada rol,
  // antes de cualquier otra regla (incluida la que ignora todo lo no-GET).
  if (request.method === "POST") {
    const pathname = new URL(request.url).pathname;
    const role = SHARE_TARGET_PATHS[pathname];
    if (role) {
      event.respondWith(handleShareTargetPost(event, role));
      return;
    }
  }

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
    if (notifType === "salon_new_order" || notifType === "operaciones_salon_new_order") {
      icon = "/icon-salon-192x192.png";
    } else if (notifType === "operaciones_order_cancelled") {
      icon = data.data?.area === "salon"
        ? "/icon-salon-192x192.png"
        : "/icon-empleado-192x192.png";
    } else if (notifType === "mesa_order_ready") {
      icon = "/icon-mozo-192x192.png";
    } else if (notifType === "new_order" || notifType === "order_update" || notifType === "review" || notifType === "account_update") {
      icon = "/icon-negocio-192x192.png";
    }

    // Bugfix-4D: causa raíz confirmada del deep link roto. Este objeto es la
    // ÚNICA fuente real de `notification.data` que llega a `notificationclick`
    // — lo que no se copie acá se pierde para siempre, sin importar qué tan
    // bien esté armado el payload en push.ts. Dos bugs reales:
    //   1) `role` (agregado en push.ts::createNotification) nunca se copiaba
    //      acá, así que `notificationclick` SIEMPRE caía al rol por defecto
    //      ("cliente"), aunque la notificación fuera de negocio.
    //   2) `url` caía a "/" con `|| "/"` cuando el payload no traía una URL
    //      explícita — "/" es una ruta interna "segura", así que
    //      `notificationclick` la tomaba como la URL válida y NUNCA llegaba a
    //      construir la URL real con rol+pestaña+pedidoId. Ahora `url` queda
    //      `null` cuando no hay una URL real, y `notificationclick` recién
    //      ahí arma la URL correcta.
    const options = {
      body: data.body || "",
      icon: data.icon || icon,
      badge: data.badge || icon,
      tag: data.tag || undefined,
      vibrate: [100, 50, 100],
      data: {
        url: typeof data.data?.url === "string" ? data.data.url : null,
        type: notifType,
        role: data.data?.role || null,
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

// ============================================
// Bugfix-4D: deep link de notificaciones "personales" (con sesión)
// ============================================
const ROLE_BASE_PATH = { cliente: "/cliente/", negocio: "/negocio", repartidor: "/repartidor" };

function isSafeInternalUrl(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

// Función pura — sin `self`/DOM/clients — para poder probarla con un script
// de Node sin un Service Worker real (ver sección 13 del reporte). Devuelve
// SIEMPRE una ruta interna (nunca una URL externa: `url` solo se usa si
// `isSafeInternalUrl` la aprueba).
function buildPersonalNotificationTarget({ type, role, pedidoId, action, url }) {
  const effectiveRole = ROLE_BASE_PATH[role] ? role : "cliente";
  const basePath = ROLE_BASE_PATH[effectiveRole];

  if (isSafeInternalUrl(url)) return url;

  const id = pedidoId ? String(pedidoId) : null;

  // Chat: el ChatProvider global abre la conversación exacta con `?chat=<id>`
  // sin depender de ninguna pestaña — por eso no lleva `tab` ni `pedidoId`.
  if (type === "chat") {
    return id ? `${basePath}?chat=${encodeURIComponent(id)}` : basePath;
  }

  // Reseña pendiente: pestaña Pedidos + pedido exacto + marca para abrir el
  // modal de reseña automáticamente (consumido por ClientOrdersPanel).
  if (type === "review_request" || (action === "review" && id)) {
    if (!id) return `${basePath}?tab=pedidos`;
    return `${basePath}?${new URLSearchParams({ tab: "pedidos", pedidoId: id, review: "1" }).toString()}`;
  }

  // Pedido nuevo / actualización de estado: pestaña Pedidos + pedido exacto +
  // marca para resaltar/enfocar esa tarjeta (ClientOrdersPanel / OrdersTab).
  if (type === "new_order" || type === "order_update") {
    if (!id) return `${basePath}?tab=pedidos`;
    return `${basePath}?${new URLSearchParams({ tab: "pedidos", pedidoId: id, focusPedido: "1" }).toString()}`;
  }

  if (type === "new_delivery" || (action === "navigate" && id)) {
    const params = new URLSearchParams({ tab: "entregas" });
    if (id) params.set("pedidoId", id);
    return `${basePath}?${params.toString()}`;
  }

  if (type === "review") {
    return `${basePath}?tab=resenas`;
  }

  if (type === "account_update") {
    return `${basePath}?tab=config`;
  }

  // Tipo desconocido / sin pedidoId relevante: fallback seguro del rol.
  return basePath;
}

// Notification click event — deep linking based on notification type
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const notificationData = event.notification.data || {};
  const { type, pedidoId, role } = notificationData;

  // Handle action button clicks
  const action = event.action;

  // ── Operaciones — Salón (cuenta personal, Legacy-Cleanup-1C.2B) ──
  // Tipo moderno, independiente del canal legacy de abajo (salon_new_order /
  // /s/). Solo navega a una URL relativa, del mismo origen, que empiece con
  // /operaciones/mi-panel/ y contenga el segmento /salon — cualquier otro
  // valor (ausente, externo, con otro protocolo) cae al fallback fijo
  // /operaciones/ingresar. Rama aislada con `return` propio: nunca continúa
  // hacia la lógica legacy de salon_new_order/mesa_order_ready ni hacia las
  // notificaciones personales de más abajo.
  if (type === "operaciones_salon_new_order") {
    const rawUrl = notificationData.url;
    const isSafeSalonUrl =
      isSafeInternalUrl(rawUrl) &&
      rawUrl.startsWith("/operaciones/mi-panel/") &&
      rawUrl.includes("/salon");
    const targetUrl = isSafeSalonUrl ? rawUrl : "/operaciones/ingresar";

    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if ("focus" in client && "navigate" in client) {
            const clientUrl = new URL(client.url);
            if (clientUrl.pathname.startsWith("/operaciones/mi-panel/")) {
              client.focus();
              client.navigate(targetUrl);
              return;
            }
          }
        }
        for (const client of clients) {
          if ("focus" in client && "navigate" in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      })
    );
    return;
  }

  // ── Operaciones — cancellation (current personal panels) ──
  if (type === "operaciones_order_cancelled") {
    const rawUrl = notificationData.url;
    const isSafeOperationsUrl =
      isSafeInternalUrl(rawUrl) &&
      rawUrl.startsWith("/operaciones/mi-panel/") &&
      (rawUrl.includes("/salon") || rawUrl.includes("/pyr"));
    const targetUrl = isSafeOperationsUrl ? rawUrl : "/operaciones/ingresar";

    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if ("focus" in client && "navigate" in client) {
            const clientUrl = new URL(client.url);
            if (clientUrl.pathname.startsWith("/operaciones/mi-panel/")) {
              client.focus();
              client.navigate(targetUrl);
              return;
            }
          }
        }
        for (const client of clients) {
          if ("focus" in client && "navigate" in client) {
            client.focus();
            client.navigate(targetUrl);
            return;
          }
        }
        return self.clients.openWindow(targetUrl);
      })
    );
    return;
  }

  // ── Shared-display PWA notifications ──
  // These PWAs are token-based (no session cookie), so we focus the already-
  // open page rather than navigating to a /cliente, /negocio, etc. URL.
  //
  //   salon_new_order            → /s/[token]  (salon shared display)
  //   mesa_order_ready           → /mozo/panel/[slug] (moderno) o /m/[token] (legacy)
  //
  // Legacy-Cleanup-1C.1: se retiraron acá empleados_new_order/empleados_new_review
  // (sin consumidor moderno) y el fallback a /s/ de mesa_order_ready (ese tipo
  // ya no cae a Salón — solo a /mozo/panel/... o a /m/, todavía sin modificar).
  if (
    type === "salon_new_order" ||
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
    } else {
      // mesa_order_ready: /m/ (legacy, todavía sin modificar). Ya no cae a
      // /s/ — ese fallback se retiró en Legacy-Cleanup-1C.1.
      preferredPrefixes = ["/m/"];
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
  // Bugfix-4D: `targetPath` se calcula con una función pura para poder
  // probarla con Node sin un navegador real (ver sección 13 del reporte).
  const targetPath = buildPersonalNotificationTarget({
    type,
    role,
    pedidoId,
    action,
    url: notificationData.url,
  });
  const effectiveRole = ROLE_BASE_PATH[role] ? role : "cliente";
  const basePath = ROLE_BASE_PATH[effectiveRole];

  // Bugfix-4D: instrumentación temporal para verificar en dispositivo real
  // (ver sección 12 del reporte). Nunca imprime el pedidoId real ni la URL
  // completa (podría contenerlo) — solo el rol/tipo y qué parámetros se
  // terminaron poniendo en la URL, sin sus valores.
  console.info("[SW notificationclick]", {
    type: type || null,
    role: role || null,
    hasPedidoId: Boolean(pedidoId),
    basePath,
    targetParams: targetPath.includes("?") ? [...new URLSearchParams(targetPath.split("?")[1]).keys()] : [],
  });

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      const absoluteTarget = self.location.origin + targetPath;
      const rolePrefix = basePath.replace(/\/$/, "") || basePath;

      // Bugfix-4D: NUNCA reutilizar una ventana de otro rol (antes, si no
      // había ninguna ventana del rol correcto pero SÍ alguna de otro rol
      // abierta, se la navegaba igual — ej. una ventana de Negocio abierta
      // recibía una notificación de Cliente y terminaba mostrando Cliente
      // dentro de la ventana de Negocio). Solo se navega una ventana cuyo
      // pathname ya empiece con el prefijo del rol correcto.
      const matchingClient = clients.find(
        (client) =>
          "focus" in client &&
          "navigate" in client &&
          new URL(client.url).pathname.startsWith(rolePrefix)
      );

      if (matchingClient) {
        try {
          // Bugfix-4D: navegar primero y ESPERAR, recién después enfocar —
          // antes se hacía focus() y luego navigate() sin esperar nada, lo
          // que en la práctica podía dejar la ventana enfocada pero todavía
          // en la URL vieja (o en medio de la navegación) cuando el usuario
          // la ve. `navigate()` puede devolver un WindowClient distinto (o
          // null en algunos navegadores) — se usa ese si existe, si no el
          // original.
          const navigatedClient = await matchingClient.navigate(absoluteTarget);
          return (navigatedClient || matchingClient).focus();
        } catch {
          // navigate() falló: no quedarse en la ventana equivocada, abrir
          // una ventana nueva con la URL correcta.
          return self.clients.openWindow(absoluteTarget);
        }
      }

      // Ninguna ventana del rol correcto abierta (o ninguna ventana en
      // absoluto): abrir una nueva. Nunca "/cliente/", "/negocio" ni
      // start_url genérico — siempre la URL real ya armada arriba.
      return self.clients.openWindow(absoluteTarget);
    })
  );
});
