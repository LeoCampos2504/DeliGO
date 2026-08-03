import { NextRequest, NextResponse } from "next/server"

// Legacy-Cleanup-1A: este endpoint administraba Negocio.tokenEmpleados y
// Negocio.tokenSalon (los secretos compartidos detrás de /e/[token] y
// /s/[token]) — creándolos automáticamente en el GET y regenerándolos en el
// POST. Legacy-Audit-1 confirmó que las APIs que esos tokens autenticaban ya
// devuelven 410 Gone (Seguridad-5G) y que el único consumidor visible era el
// bloque "Compartir" de src/components/business/orders-tab.tsx, ya retirado
// en este mismo stage. No queda ningún consumidor moderno real.
//
// Por eso ninguno de los dos métodos toca la base: ni lee ni crea ni
// regenera tokenEmpleados/tokenSalon. Nunca se devuelve un token existente ni
// se ponen los campos existentes en null — esa limpieza queda para una etapa
// posterior (Legacy-Cleanup-1D), no para acá.

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

function legacyRetiredResponse() {
  return NextResponse.json(
    {
      error: "Los enlaces de acceso legacy fueron reemplazados por DeliGO Operaciones.",
      code: "LEGACY_ACCESS_RETIRED",
    },
    { status: 410, headers: NO_STORE_HEADERS }
  )
}

export async function GET(_req: NextRequest) {
  return legacyRetiredResponse()
}

export async function POST(_req: NextRequest) {
  return legacyRetiredResponse()
}
