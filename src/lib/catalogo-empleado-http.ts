// Catálogo — capa HTTP del empleado (área caja) y de los permisos del dueño. Identidad SIEMPRE desde la sesión.

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auditLogWithClient } from "@/lib/audit"
import { safeErrorForLog } from "@/lib/log-safe-error"
import { mapBarcodeWriteError } from "@/lib/barcode-uniqueness"
import { asociarProductos, desasociarProducto, proveedoresDeProducto } from "@/lib/proveedor-productos-service"
import { autoriaProducto, CatalogoError, crearProductoEmpleado, editarProductoEmpleado, guardarPermisosCatalogo, listarCatalogoEmpleado, listarPermisosCatalogo, permisosCatalogo } from "@/lib/catalogo-empleado-service"

const NO_STORE = { "Cache-Control": "private, no-store" }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })
const fallo = (r: { status: number; error: string; code?: string }) => json({ ok: false, error: r.error, ...(r.code ? { code: r.code } : {}) }, r.status)
function errorDe(contexto: string, error: unknown) {
  if (error instanceof CatalogoError) return fallo(error.resultado)
  const b = mapBarcodeWriteError(error)
  if (b) return json({ ok: false, ...b.body }, b.status)
  console.error(`[Catálogo] ${contexto}`, safeErrorForLog(error))
  return json({ ok: false, error: "No se pudo completar la operación. Probá de nuevo." }, 500)
}
const leer = async (req: NextRequest) => ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>

// ---------- empleado ----------
export async function catalogoEmpleadoHttp(negocioId: string, empleadoId: string, soloPermisos = false) {
  try {
    const permisos = await permisosCatalogo(db, negocioId, empleadoId)
    if (!permisos.vigente || soloPermisos) return json({ ok: true, permisos, productos: [], categorias: [] })
    return json({ ok: true, permisos, ...(await listarCatalogoEmpleado(db, negocioId, permisos)) })
  } catch (error) { return errorDe("catálogo del empleado", error) }
}
export async function crearProductoEmpleadoHttp(req: NextRequest, negocioId: string, empleadoId: string) {
  try {
    const r = await crearProductoEmpleado(db, { negocioId, empleadoId, body: await leer(req) })
    return r.ok ? json({ ok: true, ...r.value }, 201) : fallo(r)
  } catch (error) { return errorDe("crear producto (empleado)", error) }
}
export async function editarProductoEmpleadoHttp(req: NextRequest, negocioId: string, empleadoId: string, productoId: string) {
  try {
    const r = await editarProductoEmpleado(db, { negocioId, empleadoId, productoId, body: await leer(req) })
    return r.ok ? json({ ok: true, ...r.value }) : fallo(r)
  } catch (error) { return errorDe("editar producto (empleado)", error) }
}

const auditarEmpleado = (empleadoId: string) => async (tx: Parameters<typeof auditLogWithClient>[0], e: { accion: string; recurso: string; recursoId: string; detalle: Record<string, unknown> }) => {
  await auditLogWithClient(tx, { userId: empleadoId, userType: "empleado", accion: e.accion, recurso: e.recurso, recursoId: e.recursoId, detalle: { ...e.detalle, origen: "CATALOGO_EMPLEADO" } })
}
/** Proveedores del producto: ver con permiso de editar o de proveedores; asociar/quitar sólo con permiso de proveedores. */
export async function proveedoresProductoEmpleadoHttp(req: NextRequest, negocioId: string, empleadoId: string, productoId: string) {
  try {
    const p = await permisosCatalogo(db, negocioId, empleadoId)
    if (req.method === "GET") {
      if (!p.editar && !p.proveedores) return fallo({ status: 403, error: "Tu permiso para el catálogo no está vigente.", code: "CATALOGO_SIN_PERMISO" })
      const r = await proveedoresDeProducto(db, negocioId, productoId)
      return r ? json({ ok: true, ...r }) : fallo({ status: 404, error: "Producto no encontrado.", code: "PRODUCTO_NO_ENCONTRADO" })
    }
    if (!p.proveedores) return fallo({ status: 403, error: "No tenés permiso para asociar proveedores.", code: "PROVEEDORES_SIN_PERMISO" })
    if (req.method === "POST") {
      const b = await leer(req)
      if (typeof b.proveedorId !== "string" || !b.proveedorId) return fallo({ status: 400, error: "Elegí el proveedor.", code: "PROVEEDOR_REQUERIDO" })
      const r = await asociarProductos(db, { negocioId, proveedorId: b.proveedorId, body: { items: [{ productoId, productoVarianteId: typeof b.productoVarianteId === "string" ? b.productoVarianteId : null }] } }, { auditar: auditarEmpleado(empleadoId) })
      return r.ok ? json({ ok: true, ...r.value }) : fallo(r)
    }
    const asociacionId = req.nextUrl.searchParams.get("asociacionId") ?? ""
    const fila = asociacionId ? await db.proveedorProducto.findFirst({ where: { id: asociacionId, negocioId, productoId }, select: { proveedorId: true } }) : null
    if (!fila) return json({ ok: true, borradas: 0 })
    const r = await desasociarProducto(db, { negocioId, proveedorId: fila.proveedorId, asociacionId }, { auditar: auditarEmpleado(empleadoId) })
    return r.ok ? json({ ok: true, ...r.value }) : fallo(r)
  } catch (error) { return errorDe("proveedores del producto (empleado)", error) }
}

// ---------- dueño ----------
export async function permisosCatalogoHttp(negocioId: string) {
  try { return json({ ok: true, empleados: await listarPermisosCatalogo(db, negocioId) }) } catch (error) { return errorDe("permisos de catálogo", error) }
}
export async function guardarPermisosCatalogoHttp(req: NextRequest, negocioId: string) {
  try {
    const r = await guardarPermisosCatalogo(db, negocioId, await leer(req))
    return r.ok ? json({ ok: true, ...r.value }) : fallo(r)
  } catch (error) { return errorDe("guardar permisos de catálogo", error) }
}
export async function autoriaProductoHttp(negocioId: string, productoId: string) {
  try {
    const r = await autoriaProducto(db, negocioId, productoId)
    return r ? json({ ok: true, ...r }) : fallo({ status: 404, error: "Producto no encontrado.", code: "PRODUCTO_NO_ENCONTRADO" })
  } catch (error) { return errorDe("autoría del producto", error) }
}
