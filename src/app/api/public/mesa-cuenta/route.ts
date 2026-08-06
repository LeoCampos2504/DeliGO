import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit"
import { MESA_OCCUPANCY_COOKIE_NAME, clearMesaOccupancyCookie } from "@/lib/mesa-occupancy"
import { resolveMesaClienteCuenta } from "@/lib/mesa-cliente-cuenta"

// ============================================
// DeliGO — GET público: cuenta de la ocupación activa de una mesa (23-B)
// ============================================
// Lectura pura para el cliente que accedió por QR. Autorización EXCLUSIVA
// por la cookie de dispositivo `deligo_mesa_occupancy` — nunca acepta
// negocioId/mesaId/ocupacionId del cliente como autoridad: `slug` y
// `mesaNumero` son datos públicos (los mismos que ya están impresos en el
// QR físico, ver mesa-geofence) usados únicamente para resolver el
// negocio/mesa reales server-side, igual que POST /api/public/mesa-geofence.
//
// Respuesta siempre 200 + `Cache-Control: private, no-store` — nunca revela
// vía status code si el negocio/mesa existen, ni si una credencial
// pertenece a otra mesa/negocio (ver mesa-cliente-cuenta.ts). Los únicos
// casos de error real son una petición malformada (400) o rate limit (429).
//
// Autorización + carga: delegada íntegramente a `resolveMesaClienteCuenta`
// (src/lib/mesa-cliente-cuenta.ts), que ya garantiza consistencia mediante
// una revalidación final fresca — ver el comentario de cabecera de ese
// archivo (23-B-CORRECCIÓN-1) para el análisis completo del TOCTOU
// original y por qué quedó eliminado.

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

function jsonNoStore(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status, headers: NO_STORE_HEADERS })
}

function sinSesion() {
  return jsonNoStore({ ok: true, status: "sin_sesion" })
}

// 23-B-CORRECCIÓN-1: `slug`/`mesa` llegan del cliente sin ninguna cota
// previa — antes de esta corrección se usaban tal cual (recortados con
// `trim()`, nada más) para construir la clave del rate limit en memoria
// (`ip:slug:mesa`). Un `slug` arbitrariamente largo/con caracteres
// arbitrarios generaba una entrada nueva del `Map` por cada variación —
// cardinalidad no acotada (ver auditoría en CODEX_REPORT.md, sección
// "Rate-limit store"). El formato real de un slug generado por la
// aplicación (`generateSlug`, src/lib/utils.ts) es siempre
// `[a-z0-9-]+` — este patrón es generoso (80 caracteres, muy por encima de
// cualquier slug real) pero acota la clave a un tamaño y alfabeto fijos
// ANTES de tocar el rate limiter o la base de datos.
const SLUG_PATTERN = /^[a-z0-9-]{1,80}$/
const MESA_NUMERO_MAX = 100_000

function parseSlug(raw: string | null): string | null {
  const value = (raw ?? "").trim().toLowerCase()
  return SLUG_PATTERN.test(value) ? value : null
}

function parseMesaNumero(raw: string | null): number | null {
  if (!raw || raw.length > 10) return null // corta cualquier string absurdamente largo antes de parsear
  if (!/^[0-9]+$/.test(raw)) return null // nunca acepta signo, decimales, notación científica, espacios
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 && value <= MESA_NUMERO_MAX ? value : null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const slug = parseSlug(searchParams.get("slug"))
  const mesaNumero = parseMesaNumero(searchParams.get("mesa"))

  if (!slug || !mesaNumero) {
    return jsonNoStore({ error: "slug y mesa son requeridos" }, { status: 400 })
  }

  const ip = getClientIp(request)

  // Límite grueso por IP, ANTES de resolver nada y ANTES del límite fino
  // por (ip,slug,mesa) — acota el total de variaciones de slug/mesa que un
  // mismo IP puede intentar por ventana, independientemente de si cada
  // combinación individual todavía tiene cupo en su propia clave.
  const rlIp = checkRateLimit("mesaCuentaPublicaIp", ip)
  if (!rlIp.allowed) {
    return rateLimitResponse(rlIp, "Estás consultando la cuenta con mucha frecuencia. Esperá un momento.")
  }

  const rl = checkRateLimit("mesaCuentaPublica", `${ip}:${slug}:${mesaNumero}`)
  if (!rl.allowed) {
    return rateLimitResponse(rl, "Estás consultando la cuenta con mucha frecuencia. Esperá un momento.")
  }

  try {
    const negocio = await db.negocio.findUnique({
      where: { slug },
      select: { id: true, nombre: true, aprobado: true, suspendido: true, salonActivo: true },
    })
    if (!negocio || !negocio.aprobado || negocio.suspendido || !negocio.salonActivo) {
      return sinSesion()
    }

    const mesa = await db.mesa.findFirst({
      where: { negocioId: negocio.id, numero: mesaNumero, activa: true },
      select: { id: true },
    })
    if (!mesa) {
      return sinSesion()
    }

    const token = request.cookies.get(MESA_OCCUPANCY_COOKIE_NAME)?.value ?? null
    const resultado = await resolveMesaClienteCuenta({ negocioId: negocio.id, mesaId: mesa.id, token })

    if (resultado.status === "sin_sesion") {
      return sinSesion()
    }

    if (resultado.status === "cerrada") {
      // Sesión propia de esta mesa, ya inválida — limpiar la cookie para
      // que el próximo escaneo/comprobación de geocerca emita una nueva
      // credencial en vez de seguir enviando un token muerto. Nunca
      // incluye datos de cuenta (garantizado a nivel de tipos).
      const response = jsonNoStore({ ok: true, status: "cerrada" })
      return clearMesaOccupancyCookie(response)
    }

    return jsonNoStore({
      ok: true,
      status: "activa",
      negocio: { nombre: negocio.nombre },
      mesa: { numero: mesaNumero },
      ...resultado.cuenta,
    })
  } catch (error) {
    console.error("[MesaClienteCuenta] Error resolviendo cuenta pública:", error)
    return jsonNoStore({ error: "Error del servidor" }, { status: 500 })
  }
}
