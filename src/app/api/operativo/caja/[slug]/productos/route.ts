import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { noStore, resolveOperativoAreaForSlug } from "@/lib/operativo-mozo"
import { cajaAuthFailure } from "@/lib/operativo-caja"
import { anotarDisponibilidadCaja, CAJERO_PRODUCTO_SELECT } from "@/lib/caja-catalogo"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// F10-B1 — GET /api/operativo/caja/[slug]/productos (cashier catalog)
// ============================================
// Selling catalog for the authenticated cashier of THIS business: only active
// products, only selling fields (CAJERO_PRODUCTO_SELECT — no cost, discounts or
// configuration), and the SAME availability rule as the owner's Caja
// (anotarDisponibilidadCaja). Read-only. Also returns the minimal context the
// cashier screen needs (business display data + the cashier's own identity).
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const auth = await resolveOperativoAreaForSlug(req, slug, "caja")
    if (!auth.ok) return cajaAuthFailure(auth)

    const productos = await db.producto.findMany({
      where: { negocioId: auth.negocio.id, eliminado: false },
      select: CAJERO_PRODUCTO_SELECT,
      orderBy: { orden: "asc" },
    })
    const conDisponible = await anotarDisponibilidadCaja(db, auth.negocio.id, productos, { rubro: auth.negocio.rubro })

    return noStore(
      NextResponse.json({
        ok: true,
        estado: "operativo",
        negocio: {
          id: auth.negocio.id,
          nombre: auth.negocio.nombre,
          slug: auth.negocio.slug,
          colorPrincipal: auth.negocio.colorPrincipal,
          logoUrl: auth.negocio.logoUrl,
        },
        empleado: { id: auth.empleado.id, nombre: auth.empleado.nombre },
        productos: conDisponible,
      })
    )
  } catch (error) {
    console.error("Error listing productos de caja (operativo):", safeErrorForLog(error))
    return noStore(NextResponse.json({ ok: false, error: "Error al obtener productos" }, { status: 500 }))
  }
}
