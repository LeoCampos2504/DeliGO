import { NextRequest, NextResponse } from "next/server"

// ============================================
// Bugfix-4C: fallback de red para Web Share Target (Cliente)
// ============================================
// Esta ruta solo se alcanza si el service worker NO llegó a interceptar el
// POST de `share_target` (por ejemplo, la primera vez que se instala la PWA
// y el SW todavía no está activo/controlando la página). No leemos ni
// guardamos el archivo compartido en ningún lado — no hay forma segura de
// pedirle confirmación al usuario en este camino puramente server-side, así
// que se redirige a la página de share-target con `unsupported=1`, que
// muestra el mensaje de usar el botón "Adjuntar" dentro del chat.
export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL("/cliente/share-target?unsupported=1", req.url), 303)
}
