import { NextRequest, NextResponse } from "next/server"

const MANIFEST_BY_ROLE: Record<string, string> = {
  admin: "/manifest-admin.json",
  cliente: "/manifest-cliente.json",
  negocio: "/manifest-negocio.json",
  repartidor: "/manifest-repartidor.json",
}

export function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role") ?? "cliente"
  const manifestPath = MANIFEST_BY_ROLE[role] ?? MANIFEST_BY_ROLE.cliente

  return NextResponse.redirect(new URL(manifestPath, request.url))
}
