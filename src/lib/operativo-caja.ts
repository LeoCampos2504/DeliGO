// ============================================
// F10-B1 — cashier (área "caja") helpers for /api/operativo/caja/**
// ============================================
// The cashier is authenticated ONLY through the personal operational session
// (CuentaOperativa + Empleado) resolved by resolveOperativoAreaForSlug(…, "caja"):
// approved, non-suspended business with employees enabled, GENERIC rubro, an
// active employee of THAT business with área efectiva "caja". Shared terminals
// never reach these routes. negocioId / empleadoId always come from that
// resolution — never from the URL beyond the slug, never from the body.
//
// Blind-close safety (F10-B2 prepared now): these responses expose only what a
// cashier needs to sell and to confirm THEIR OWN sale. Never: expected cash,
// differences, totals per payment method, business-wide summaries, Mercado Pago
// balances, financial movements or other cashiers' sales.

import { NextResponse } from "next/server"
import { OPERATIONAL_SESSION_COOKIE_NAME } from "@/lib/auth"
import { noStore, type OperativoMozoAuth } from "@/lib/operativo-mozo"
import type { VentaCajaConItems } from "@/lib/caja-venta-service"

export function cajaAuthFailure(auth: Extract<OperativoMozoAuth, { ok: false }>): NextResponse {
  const response = NextResponse.json(
    { ok: false, estado: auth.state, error: auth.status === 401 ? "No autenticado" : "Acceso no disponible" },
    { status: auth.status }
  )
  if (auth.clearSession) response.cookies.delete(OPERATIONAL_SESSION_COOKIE_NAME)
  return noStore(response)
}

/** The cashier's own confirmed sale — only what the success screen shows. */
export function ventaParaCajero(venta: VentaCajaConItems) {
  return {
    id: venta.id,
    total: venta.total,
    metodoPago: venta.metodoPago,
    cantidadItems: venta.cantidadItems,
    createdAt: venta.createdAt,
    items: venta.items.map((item) => ({
      id: item.id,
      productoId: item.productoId,
      varianteNombre: item.varianteNombre,
      nombre: item.nombre,
      precio: item.precio,
      cantidad: item.cantidad,
      subtotal: item.subtotal,
    })),
  }
}
