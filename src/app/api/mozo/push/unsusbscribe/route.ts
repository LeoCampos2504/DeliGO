import { NextRequest, NextResponse } from "next/server"

// Seguridad-6A: ruta duplicada por un error de tipeo en el nombre de carpeta
// ("unsusbscribe" en vez de "unsubscribe"). Se confirmó (grep exhaustivo en
// src/) que ningún consumidor real del proyecto llama a esta URL — la ruta
// correcta, ya usada por el frontend, es /api/mozo/push/unsubscribe. Se
// retira en vez de mantenerla duplicada para no repetir el mismo mozoToken de
// autenticación y la misma lógica en dos lugares.
export async function POST(_req: NextRequest) {
  return NextResponse.json(
    { error: "Este endpoint fue retirado. Usá /api/mozo/push/unsubscribe." },
    { status: 410 }
  )
}
