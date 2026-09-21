// ============================================
// DeliGO - Service Worker
// ============================================

// DELIGO-BRANDING-R1: se sube la versión porque este deploy reemplaza el
// contenido de los icon-{rol}-192x192.png/512x512.png servidos bajo el mismo
// nombre de archivo de siempre. La regla de abajo que pretende servir
// "manifest files or PWA icons" siempre en red (nunca cacheados) sólo
// matchea el string "manifest" en la URL — el chequeo `includes("icon-192")`/
// `includes("icon-512")` NUNCA es true para estos nombres reales
// (`icon-cliente-192x192.png` no contiene el substring literal "icon-192":
// después de "icon-" sigue "cliente-192x192", no "192"), así que estos PNG
// en realidad caen en la rama cache-first de assets estáticos más abajo. Sin
// subir `CACHE_NAME`, un cliente que ya tenía el ícono viejo en caché lo
// seguiría sirviendo indefinidamente pese al deploy. Ver
// `codex-reports/DELIGO_BRANDING_R1_PWA_ROLE_ICON_REFRESH.md` — el bug del
// substring roto en sí se corrigió recién en P2-T36 (ver más abajo,
// `isPwaBrandingAsset`) — en R1 seguía sin tocarse, sólo se forzaba la
// invalidación real vía el bump de versión.
//
// Bugfix-4D: se sube la versión porque este deploy cambia lógica real de
// push/notificationclick (no solo el cache de assets) — subir el número
// fuerza que `activate` borre cualquier caché vieja apenas el SW nuevo tome
// control, en vez de esperar a que expire por su cuenta. `install` ya llama
// a `skipWaiting()` y `activate` ya llama a `clients.claim()`, así que el SW
// nuevo se activa e instala solo con el próximo deploy — no requiere que el
// usuario borre datos ni reinstale la PWA.
//
// P2-T36 (F-P2-T36-02): se sube la versión otra vez porque este deploy
// corrige el bug de substring documentado arriba (ver `isPwaBrandingAsset`
// en el handler `fetch`) Y agrega assets nuevos (maskable + badge) — un
// cliente que ya tenía un ícono viejo cacheado bajo la rama cache-first
// (por el bug de substring, nunca invalidado por esa regla) debe purgarlo
// también, no sólo dejar de repetir el bug hacia adelante.
const CACHE_NAME = "deligo-v16";

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
  // P2-T44-R1P6E: cada activación (deploy nuevo, o el navegador simplemente
  // reactivando este mismo SW) es una oportunidad segura de reintentar
  // cualquier traza de click que quedó pendiente de una sesión anterior —
  // independiente del waitUntil de arriba, nunca lo bloquea ni depende de él.
  event.waitUntil(flushPendingSwTraces());
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

  // NEVER cache manifest files or PWA icons/badges — Chrome must always
  // fetch fresh copies. F-P2-T36-02 fix: matching the FULL URL against the
  // literal substrings "icon-192"/"icon-512" never matched real filenames
  // (`icon-cliente-192x192.png` contains "cliente-192x192" right after
  // "icon-", never the literal substring "icon-192") — these assets silently
  // fell through to the cache-first branch below and could get stuck stale
  // indefinitely without a `CACHE_NAME` bump. Match the pathname's actual
  // "/icon-*.png" / "/badge-*.png" prefix instead — a real, explicit pattern
  // instead of an accidental substring, and one that also covers the new
  // maskable/badge assets added in P2-T36 by construction.
  const pathname = new URL(request.url).pathname;
  const isPwaBrandingAsset = /^\/(icon|badge)-/.test(pathname) && pathname.endsWith(".png");
  if (
    request.url.includes("manifest") ||
    isPwaBrandingAsset
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
  if (event.data && event.data.type === "CHAT_MESSAGE_PRESENTED") {
    recordPresentedChatMessage(event.data.messageId);
  }
});

// ============================================
// D2 — Foreground Push / Socket Dedupe
// ============================================
// Cuando un mensaje de Chat ya se le mostró al usuario en tiempo real (vía
// socket, con la conversación efectivamente foreground), el cliente avisa acá
// vía postMessage para que la Push de OS redundante para ese mismo mensaje se
// suprima. Fail-open por diseño: cualquier duda (falta de entrada, entrada
// vencida, registro corrupto/reiniciado, tipo != chat) hace que la Push se
// MUESTRE igual — una notificación duplicada es aceptable, una perdida no.
const CHAT_PRESENTED_TTL_MS = 45000;
const CHAT_PRESENTED_MAX_ENTRIES = 200;
// messageId -> expiresAt (epoch ms). Vive solo en memoria del SW: un reinicio
// del SW lo vacía por completo, lo cual es intencional (fail-open).
const presentedChatMessages = new Map();

function recordPresentedChatMessage(messageId) {
  if (typeof messageId !== "string" || messageId.length === 0) return;
  const now = Date.now();
  // Purga oportunista de vencidos antes de insertar, para no acumular basura.
  for (const [id, expiresAt] of presentedChatMessages) {
    if (expiresAt <= now) presentedChatMessages.delete(id);
  }
  if (
    presentedChatMessages.size >= CHAT_PRESENTED_MAX_ENTRIES &&
    !presentedChatMessages.has(messageId)
  ) {
    // Eviction determinística del más viejo (primera clave insertada, según
    // el orden de iteración garantizado de Map).
    const oldestKey = presentedChatMessages.keys().next().value;
    if (oldestKey !== undefined) presentedChatMessages.delete(oldestKey);
  }
  presentedChatMessages.set(messageId, now + CHAT_PRESENTED_TTL_MS);
}

// true SOLO si hay una entrada válida y no vencida para este messageId.
// Cualquier otro caso (falta el id, tipo distinto de chat, no hay entrada,
// entrada vencida) devuelve false — es decir, "mostrar la Push".
function wasChatMessageAlreadyPresented(messageId) {
  if (typeof messageId !== "string" || messageId.length === 0) return false;
  const expiresAt = presentedChatMessages.get(messageId);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    presentedChatMessages.delete(messageId);
    return false;
  }
  return true;
}

// Push notification event
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || "DeliGO";
    const notifType = data.data?.type || "general";

    // P2-T31-R22/R22A: causa raíz probada — `order_update`/`review`/`chat`
    // son notifType REALMENTE compartidos entre Cliente/Negocio/Repartidor
    // (ej. todo el ciclo de vida del pedido visto por el Cliente usa
    // `order_update`, el mismo tipo que Negocio recibe para lo suyo), así
    // que resolver el ícono SÓLO por `notifType` le da a un Cliente el
    // ícono de Negocio (y viceversa para Negocio+chat) — reproducido y
    // probado ejecutando este mismo archivo en R22 (ver
    // P2_T31_R22_ANDROID_PUSH_NOTIFICATION_ICON_ROUTING_ROOT_CAUSE_AUDIT.md).
    // `data.role` (agregado por `createNotification`::`personalRoleFor` en
    // push.ts) ya identifica al destinatario REAL, y ya se entrega de forma
    // confiable — es el mismo campo que `notificationclick` más abajo ya usa
    // para navegar al rol correcto. Se usa PRIMERO acá; el `notifType` legacy
    // sigue intacto como fallback exclusivamente para los tipos que no
    // llevan `role` (salon/mozo/empleado/operaciones, o cualquier payload
    // viejo ya encolado sin este campo) — nunca se elimina ni se reordena su
    // propio comportamiento interno.
    const ROLE_ICON = {
      cliente: "/icon-cliente-192x192.png",
      negocio: "/icon-negocio-192x192.png",
      repartidor: "/icon-repartidor-192x192.png",
    };
    const recipientRole = data.data?.role;

    // P2-T39-R3: actorFamily identifica al SuperAdmin de forma explícita e
    // inequívoca — a diferencia de `role`/`notifType`, nunca se comparte con
    // Cliente/Negocio/Repartidor. Nunca hace dispatch por tipo (5 tipos
    // distintos de Notificacion.tipo comparten esta MISMA rama fija) — sólo
    // decide ícono y, en notificationclick, el destino fijo /admin.
    const actorFamily = data.data?.actorFamily || null;
    const isSuperadminPush = actorFamily === "superadmin";

    // P2-T36: `badge` (el pequeño ícono monocromático que Android compone
    // sobre la propia notificación/status bar) NUNCA debe ser el mismo PNG
    // full-color que `icon` — Android lo recorta/tiñe igual, así que un PNG
    // a color rinde mal ahí. Se usa un ÚNICO badge neutro de DeliGO para
    // todos los roles (Android no necesita que el badge codifique el rol,
    // sólo `icon` lo hace) — extraído mecánicamente del propio glyph "D"
    // blanco de icon-cliente-512x512.png (sin rediseño, sin color nuevo).
    const DELIGO_BADGE = "/badge-deligo-monochrome-96x96.png";

    // Pick the icon/badge per notification type so the user can tell at a
    // glance which PWA the notification belongs to.
    let icon;
    if (isSuperadminPush) {
      icon = "/icon-admin-192x192.png";
    } else if (recipientRole && ROLE_ICON[recipientRole]) {
      icon = ROLE_ICON[recipientRole];
    } else {
      icon = "/icon-cliente-192x192.png";
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
      badge: data.badge || DELIGO_BADGE,
      tag: data.tag || undefined,
      vibrate: [100, 50, 100],
      data: {
        url: typeof data.data?.url === "string" ? data.data.url : null,
        type: notifType,
        role: data.data?.role || null,
        actorFamily,
        pedidoId: data.data?.pedidoId || null,
        mesaNumero: data.data?.mesaNumero || null,
      },
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false,
    };

    // D2 — solo para Chat, y solo si el messageId real fue marcado como
    // efectivamente presentado en foreground: cualquier otro caso (tipo
    // distinto, sin messageId, entrada vencida/ausente) sigue mostrando la
    // Push normalmente (fail-open).
    if (
      notifType === "chat" &&
      wasChatMessageAlreadyPresented(data.data?.messageId)
    ) {
      return;
    }

    // P2-T44-R1P5B: traza TESTING-only, únicamente para los 3 tipos PyR de
    // Operaciones que son objeto de la investigación de G3 — nunca para el
    // resto de Web Push (Cliente/Negocio/Repartidor/Salón/Mozo). Responde,
    // con evidencia real del propio evento `push`, si la URL ya se perdió
    // ACÁ (antes de notificationclick siquiera existir) o llegó intacta.
    let swTraceCompletion = Promise.resolve();
    if (
      notifType === "operaciones_pyr_new_order" ||
      notifType === "operaciones_pyr_new_review" ||
      notifType === "operaciones_pyr_chat"
    ) {
      const payloadUrl = data.data?.url;
      swTraceCompletion = sendSwTrace({
        event: "push_received",
        type: notifType,
        pedidoId: typeof data.data?.pedidoId === "string" ? data.data.pedidoId : null,
        payloadUrlPresent: typeof payloadUrl === "string",
        payloadUrlType: typeof payloadUrl,
        payloadUrl: typeof payloadUrl === "string" ? payloadUrl : null,
      }).then(() =>
        sendSwTrace({
          event: "show_notification",
          type: notifType,
          pedidoId: options.data.pedidoId,
          notificationDataUrlPresent: typeof options.data.url === "string",
          notificationDataUrlType: typeof options.data.url,
          notificationDataUrl: options.data.url,
        })
      );
    }

    event.waitUntil(
      Promise.allSettled([self.registration.showNotification(title, options), swTraceCompletion])
    );
    // P2-T44-R1P6E: cada `push` (de cualquier tipo/actor, no sólo PyR) es
    // otra oportunidad segura de reintentar una traza de click que haya
    // quedado pendiente de un tap anterior — independiente del waitUntil de
    // arriba. Resuelve casi instantáneo cuando no hay nada pendiente (el
    // caso normal para el resto de la app).
    event.waitUntil(flushPendingSwTraces());
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

// ============================================
// P2-T44-R1P5B/R1P6E: TESTING-only diagnostic trace for G3 Operations click
// routing (push_received / show_notification / notificationclick_decision /
// notificationclick_client / notificationclick_routing_result). See
// P2_T44_R1P5_G3_SW_CLICK_TRACE_INSTRUMENTATION.md for why the existing
// push-debug-trace.ts engine can't be reused here (no window/localStorage
// inside a Service Worker), P2_T44_R1P5B_G3_SW_TRACE_IMPLEMENTATION.md for
// the original network-only design, and P2_T44_R1P6E_DURABLE_SW_CLICK_TRACE.md
// for why that wasn't enough: R1P6A and R1P6D both showed push_received/
// show_notification arriving reliably while EVERY notificationclick trace
// silently vanished — the SW answering a click after a period of inactivity
// can have degraded/delayed network access at exactly that moment, and a
// single fire-and-forget POST with a short timeout has no way to recover
// from that. This block ONLY observes values the routing logic below
// already computes — it never changes
// isSafeInternalUrl/isSafeOperationsUrl/targetUrl/fallback/client
// matching/focus/navigate/openWindow.
const SW_TRACE_VERSION = "P2_T44_R1P6E_SW_TRACE_V2";
const SW_ROUTING_VERSION = "P2_T44_R1P6I_ABSOLUTE_OPERATIONS_TARGET";
const SW_TRACE_ENDPOINT = "/api/push/debug-sw-trace";
const SW_TRACE_TIMEOUT_MS = 1500;
const SW_DEBUG_DB_NAME = "deligo-sw-debug";
const SW_DEBUG_STORE_NAME = "pending-traces";
// P2-T44-R1P6E: trazas son diagnóstico TEMPORAL, nunca un registro
// permanente — TTL + tope de registros acotan el crecimiento sin depender
// de que el flush siempre tenga éxito.
const SW_DEBUG_TRACE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const SW_DEBUG_TRACE_MAX_RECORDS = 50;

// Un único intento de red, sin persistencia — usado por el flush (que ya
// decide qué hacer con el resultado) y por el envío inmediato "best effort"
// de push_received/show_notification (nunca críticos para el diagnóstico
// del click: si push_received se pierde una vez, no es motivo para
// arrastrar infraestructura durable a CADA Push del sistema). Nunca lanza,
// resuelve `true` sólo si el servidor confirmó recepción (2xx).
function sendSwTraceOnce(payload) {
  try {
    if (typeof fetch !== "function") return Promise.resolve(false);
    const body = JSON.stringify(payload);
    let signal;
    let timeoutId = null;
    if (typeof AbortController === "function") {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), SW_TRACE_TIMEOUT_MS);
      signal = controller.signal;
    }
    return fetch(SW_TRACE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal,
    })
      .then((res) => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        return Boolean(res && res.ok);
      })
      .catch(() => {
        if (timeoutId !== null) clearTimeout(timeoutId);
        return false;
      });
  } catch {
    return Promise.resolve(false);
  }
}

// Best-effort, never-throwing diagnostic POST — network-only, no durable
// backup. Deliberately NOT awaited before any real routing decision:
// callers fire the real focus()/navigate()/openWindow() call synchronously
// first, then fold this promise into whatever Promise.allSettled(...) they
// already pass to event.waitUntil.
function sendSwTrace(fields) {
  const payload = Object.assign({ traceVersion: SW_TRACE_VERSION, routingVersion: SW_ROUTING_VERSION }, fields);
  return sendSwTraceOnce(payload).then(() => {});
}

// ---- P2-T44-R1P6E: durable IndexedDB backing for click-critical traces ----
// Mismo patrón técnico ya usado en este archivo para share-target
// (`openShareTargetDb`/`putPendingShare`) — una sola store, keyPath simple,
// sin índices adicionales.
function openSwDebugDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SW_DEBUG_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SW_DEBUG_STORE_NAME)) {
        db.createObjectStore(SW_DEBUG_STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllPendingTraces(db) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SW_DEBUG_STORE_NAME, "readonly");
      const req = tx.objectStore(SW_DEBUG_STORE_NAME).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function putPendingTrace(db, record) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SW_DEBUG_STORE_NAME, "readwrite");
      tx.objectStore(SW_DEBUG_STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function deletePendingTrace(db, id) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(SW_DEBUG_STORE_NAME, "readwrite");
      tx.objectStore(SW_DEBUG_STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Persiste UN evento de click de forma durable, ANTES de intentar la red —
// nunca lanza, nunca bloquea/espera antes de la decisión de ruteo real
// (llamado en paralelo, nunca `await`ado por el código de ruteo). `fields`
// ya es el mismo objeto sanitizado que antes se mandaba directo a
// `sendSwTrace` — ningún dato nuevo, sólo un respaldo local antes del
// intento de red.
function persistPendingTrace(fields) {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  const now = Date.now();
  const record = {
    id: shareTargetToken(),
    traceVersion: SW_TRACE_VERSION,
    routingVersion: SW_ROUTING_VERSION,
    createdAt: now,
    expiresAt: now + SW_DEBUG_TRACE_TTL_MS,
    attemptCount: 0,
    fields: Object.assign({}, fields),
  };
  return openSwDebugDb()
    .then((db) =>
      getAllPendingTraces(db).then((existing) => {
        // Bounded storage — evicción oldest-first, nunca toca el registro
        // recién creado.
        const sorted = existing.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        const overflow = sorted.length - (SW_DEBUG_TRACE_MAX_RECORDS - 1);
        const toDelete = overflow > 0 ? sorted.slice(0, overflow) : [];
        return Promise.all(toDelete.map((r) => deletePendingTrace(db, r.id)))
          .then(() => putPendingTrace(db, record))
          .then(() => record);
      })
    )
    .catch(() => null);
}

// Reintenta enviar TODO lo pendiente — llamado en cada momento seguro en que
// el SW ya está despierto (activate/push/notificationclick), nunca por
// timer/polling propio. Un registro sólo se borra tras confirmación HTTP
// real; si falla, se conserva con `attemptCount` incrementado para el
// próximo intento. Un registro vencido (TTL) se descarta sin intentar
// enviarlo.
function flushPendingSwTraces() {
  if (typeof indexedDB === "undefined") return Promise.resolve();
  return openSwDebugDb()
    .then((db) =>
      getAllPendingTraces(db).then((records) => {
        const now = Date.now();
        return Promise.all(
          records.map((record) => {
            if (!record || typeof record.id !== "string") return Promise.resolve();
            if (typeof record.expiresAt === "number" && record.expiresAt <= now) {
              return deletePendingTrace(db, record.id);
            }
            const payload = Object.assign(
              {
                traceRecordId: record.id,
                traceVersion: record.traceVersion || SW_TRACE_VERSION,
                routingVersion: record.routingVersion || SW_ROUTING_VERSION,
                attemptCount: typeof record.attemptCount === "number" ? record.attemptCount : 0,
              },
              record.fields || {}
            );
            return sendSwTraceOnce(payload).then((ok) => {
              if (ok) return deletePendingTrace(db, record.id);
              const updated = Object.assign({}, record, { attemptCount: (record.attemptCount || 0) + 1 });
              return putPendingTrace(db, updated);
            });
          })
        );
      })
    )
    .catch(() => {});
}

// Punto de entrada único para los 3 eventos críticos del click
// (notificationclick_decision/_client/_routing_result): persiste primero
// (durable), luego intenta un flush inmediato de TODO lo pendiente — en el
// caso común (red disponible) esto se ve y comporta igual que el viejo
// sendSwTrace inmediato; si la red falla/tarda, el registro sobrevive para
// el próximo flush oportunista.
function recordAndSendTrace(fields) {
  return persistPendingTrace(fields)
    .then((record) => {
      if (record) return flushPendingSwTraces();
      // Sin IndexedDB disponible (o la persistencia falló): conserva el
      // comportamiento inmediato-only de antes de R1P6E, para que la traza
      // todavía tenga oportunidad de llegar en un entorno sin storage
      // durable en vez de perderse en silencio.
      const payload = Object.assign(
        { traceVersion: SW_TRACE_VERSION, routingVersion: SW_ROUTING_VERSION },
        fields
      );
      return sendSwTraceOnce(payload).then(() => {});
    })
    .catch(() => {});
}

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

  // ── SuperAdmin (P2-T39-R3) ──
  // Rama genérica y fija por `actorFamily`, nunca por `type` — los 5 tipos de
  // Notificacion.tipo dirigidos a SuperAdmin (negocio_pendiente,
  // destacado_solicitud, denuncia_nueva, negocio_deuda, review_moderation)
  // comparten EXACTAMENTE este mismo destino, sin deep link por entidad
  // (SUPERADMIN_PUSH_TAP_DESTINATION=/admin, EXACT_ENTITY_DEEP_LINK_
  // REQUIRED=NO — decisión de diseño de R2, no cambiada en R3). Nunca navega
  // a una URL externa o manipulada — el destino es siempre el literal fijo
  // `/admin`, independiente de cualquier otro campo del payload.
  if (notificationData.actorFamily === "superadmin") {
    const adminTarget = self.location.origin + "/admin";
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
        const isAdminClientPathname = (pathname) => pathname === "/admin" || pathname.startsWith("/admin/");
        const matchingClient = clients.find(
          (client) => "focus" in client && "navigate" in client && isAdminClientPathname(new URL(client.url).pathname)
        );
        if (matchingClient) {
          try {
            const navigatedClient = await matchingClient.navigate(adminTarget);
            return (navigatedClient || matchingClient).focus();
          } catch {
            return self.clients.openWindow(adminTarget);
          }
        }
        return self.clients.openWindow(adminTarget);
      })
    );
    return;
  }

  // ── Operaciones — panel personal (cuenta_operativa) ──
  // Rama compartida por TODOS los tipos modernos de Operaciones cuyo
  // contrato de navegación es una URL bajo /operaciones/mi-panel/ (P2-T44-
  // R1P2, generaliza lo que antes eran 2 ramas casi idénticas —
  // operaciones_salon_new_order y operaciones_order_cancelled — para
  // cubrir también los 3 productores PyR nuevos sin triplicar la lógica).
  // `mesa_order_ready` NO entra acá: su URL moderna es /mozo/panel/..., un
  // contrato distinto — sigue en su rama propia más abajo, sin tocar.
  // Solo navega a una URL relativa, del mismo origen, que empiece con
  // /operaciones/mi-panel/ y contenga /salon o /pyr — cualquier otro valor
  // (ausente, externo, con otro protocolo) cae al fallback fijo
  // /operaciones/ingresar. Rama aislada con `return` propio: nunca continúa
  // hacia la lógica legacy de salon_new_order/mesa_order_ready ni hacia las
  // notificaciones personales de más abajo.
  if (
    type === "operaciones_salon_new_order" ||
    type === "operaciones_order_cancelled" ||
    type === "operaciones_pyr_new_order" ||
    type === "operaciones_pyr_new_review" ||
    type === "operaciones_pyr_chat"
  ) {
    const rawUrl = notificationData.url;
    const isSafeOperationsUrl =
      isSafeInternalUrl(rawUrl) &&
      rawUrl.startsWith("/operaciones/mi-panel/") &&
      (rawUrl.includes("/salon") || rawUrl.includes("/pyr"));
    const targetUrl = isSafeOperationsUrl ? rawUrl : "/operaciones/ingresar";
    const absoluteTarget = self.location.origin + targetUrl;

    // P2-T44-R1P5B: traza TESTING-only — observa EXACTAMENTE los mismos
    // valores ya calculados arriba (rawUrl/isSafeOperationsUrl/targetUrl),
    // nunca los recalcula ni los altera. `usedFallback`/`fallbackReason` no
    // participan en la decisión real, sólo describen por qué se llegó a ella.
    const usedFallback = !isSafeOperationsUrl;
    const fallbackReason = !usedFallback
      ? null
      : !isSafeInternalUrl(rawUrl)
        ? "NOT_SAFE_INTERNAL_URL"
        : !rawUrl.startsWith("/operaciones/mi-panel/")
          ? "MISSING_OPERATIONS_PREFIX"
          : "MISSING_PYR_OR_SALON_SEGMENT";

    // P2-T44-R1P6E: otra oportunidad segura de reintentar trazas de un click
    // anterior que hayan quedado pendientes — independiente de la traza de
    // ESTE click (abajo), nunca la bloquea ni depende de ella.
    event.waitUntil(flushPendingSwTraces());

    const decisionTrace = recordAndSendTrace({
      event: "notificationclick_decision",
      type: type || null,
      pedidoId: typeof pedidoId === "string" ? pedidoId : null,
      rawUrlPresent: typeof rawUrl === "string",
      rawUrlType: typeof rawUrl,
      rawUrl: typeof rawUrl === "string" ? rawUrl : null,
      safeInternalUrl: isSafeInternalUrl(rawUrl),
      operationsPanelPrefixMatch: typeof rawUrl === "string" && rawUrl.startsWith("/operaciones/mi-panel/"),
      containsPyrOrSalon: typeof rawUrl === "string" && (rawUrl.includes("/salon") || rawUrl.includes("/pyr")),
      selectedTargetUrl: targetUrl,
      usedFallback,
      fallbackReason,
    });

    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
        // P2-T44-R1P6C (root cause: P2_T44_R1P6B_EXISTING_CLIENT_VS_CLOSED_APP_AUDIT.md):
        // un client sólo cuenta como "Operations client" reutilizable si su
        // pathname es EXACTAMENTE el Home bare (`/operaciones/mi-panel`, la
        // pantalla real de "los tres negocios" — Next.js nunca le agrega
        // barra final) o cualquier ruta bajo `/operaciones/mi-panel/` — NUNCA
        // cualquier otro client del origin (/cliente, /negocio, /repartidor,
        // /mozo). Reemplaza el viejo par de loops donde el segundo aceptaba
        // CUALQUIER client con focus+navigate sin mirar su pathname en
        // absoluto — esa fue la causa raíz confirmada físicamente (A/B: con
        // el Home de Operaciones ya abierto, ese loop sin filtro lo
        // capturaba y le pasaba el deep link real sin ninguna garantía de
        // que `navigate()` surtiera efecto).
        const isOperationsClientPathname = (pathname) =>
          pathname === "/operaciones/mi-panel" || pathname.startsWith("/operaciones/mi-panel/");

        // Una línea de traza por client considerado, ANTES de decidir el
        // ruteo — nunca cambia qué client se elige.
        const clientTraces = clients.map((client, index) => {
          const canFocusNavigate = "focus" in client && "navigate" in client;
          const clientPathname = canFocusNavigate ? new URL(client.url).pathname : null;
          return recordAndSendTrace({
            event: "notificationclick_client",
            type: type || null,
            clientIndex: index,
            clientCount: clients.length,
            clientPathname,
            matchesOperationsPanel: Boolean(clientPathname && isOperationsClientPathname(clientPathname)),
            canFocus: canFocusNavigate,
            canNavigate: canFocusNavigate,
          });
        });

        const matchingClient = clients.find(
          (client) =>
            "focus" in client &&
            "navigate" in client &&
            isOperationsClientPathname(new URL(client.url).pathname)
        );

        // P2-T44-R1P6C: mismo patrón técnico ya certificado en la rama de
        // notificaciones personales más abajo (nunca copiado su rol/ruta,
        // sólo la forma) — `navigate()` PRIMERO y ESPERADO, `focus()` sobre
        // el client que `navigate()` efectivamente devolvió (nunca sobre el
        // client viejo si hay uno nuevo), y un `catch` que jamás deja al
        // usuario silenciosamente en la pantalla vieja: cae a
        // `clients.openWindow(absoluteTarget)`, el único camino que esta
        // investigación confirmó físicamente que funciona con la app
        // cerrada.
        if (matchingClient) {
          try {
            const navigatedClient = await matchingClient.navigate(absoluteTarget);
            const routingTrace = recordAndSendTrace({
              event: "notificationclick_routing_result",
              type: type || null,
              routingAction: "NAVIGATE_FOCUS_OPERATIONS_CLIENT",
              navigateTarget: absoluteTarget,
              navigateResult: navigatedClient ? "RESOLVED_CLIENT" : "RESOLVED_NULL",
            });
            return Promise.allSettled([
              decisionTrace,
              routingTrace,
              ...clientTraces,
              (navigatedClient || matchingClient).focus(),
            ]);
          } catch (err) {
            const routingTrace = recordAndSendTrace({
              event: "notificationclick_routing_result",
              type: type || null,
              routingAction: "NAVIGATE_REJECTED_OPEN_WINDOW",
              navigateTarget: absoluteTarget,
              errorName: err && err.name ? String(err.name) : "Unknown",
              errorMessage: err && err.message ? String(err.message) : null,
            });
            return Promise.allSettled([
              decisionTrace,
              routingTrace,
              ...clientTraces,
              self.clients.openWindow(absoluteTarget),
            ]);
          }
        }

        // Sin ningún Operations client abierto (incluye "app cerrada" — el
        // camino ya probado físicamente, sin cambios conceptuales).
        const openWindowTrace = self.clients.openWindow(absoluteTarget).then(
          () =>
            recordAndSendTrace({
              event: "notificationclick_routing_result",
              type: type || null,
              routingAction: "NO_MATCH_OPEN_WINDOW",
              openWindowTarget: absoluteTarget,
            }),
          (err) =>
            recordAndSendTrace({
              event: "notificationclick_routing_result",
              type: type || null,
              routingAction: "NO_MATCH_OPEN_WINDOW_REJECTED",
              openWindowTarget: absoluteTarget,
              errorName: err && err.name ? String(err.name) : "Unknown",
              errorMessage: err && err.message ? String(err.message) : null,
            })
        );
        return Promise.allSettled([decisionTrace, openWindowTrace, ...clientTraces]);
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
