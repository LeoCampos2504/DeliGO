import { NextRequest, NextResponse } from "next/server"

// ============================================
// Bugfix-4C: fallback de red para Web Share Target (Operaciones)
// ============================================
// Ver src/app/cliente/share-target/receive/route.ts — misma lógica exacta,
// solo cambia el rol de destino.
export async function POST(req: NextRequest) {
  return NextResponse.redirect(new URL("/operaciones/share-target?unsupported=1", req.url), 303)
}
