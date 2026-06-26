import { NextRequest, NextResponse } from "next/server"

const STATIC_MANIFEST_BY_ROLE: Record<string, string> = {
  admin: "/manifest-admin.json",
  cliente: "/manifest-cliente.json",
  negocio: "/manifest-negocio.json",
  repartidor: "/manifest-repartidor.json",
  mozo: "/manifest-mozo.json",
  salon: "/manifest-salon.json",
  empleado: "/manifest-empleado.json",
}

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role") ?? "cliente"
  const manifestPath = STATIC_MANIFEST_BY_ROLE[role] ?? STATIC_MANIFEST_BY_ROLE.cliente
  return NextResponse.redirect(new URL(manifestPath, request.url))
}
