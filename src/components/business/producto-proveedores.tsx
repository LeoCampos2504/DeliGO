"use client"

// ============================================
// Catálogo — proveedores del producto (la misma relación proveedor_productos que «Productos que entrega»)
// ============================================
// Con el producto ya creado: asociar o quitar en el acto (idempotente y auditado en el servidor) y la ficha del
// proveedor se actualiza sola. Al crear: se eligen los proveedores y se asocian apenas se guarda el producto.
// Nunca cambia el producto, su stock, costos ni precios. Dueño, o empleado con permiso vigente vía `base` (las rutas lo exigen).

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Proveedor = { id: string; nombre: string }
type Datos = { variantes: Array<{ id: string; nombre: string }>; proveedores: Proveedor[]; asociaciones: Array<{ id: string; proveedorId: string; proveedor: string; productoVarianteId: string | null; variante: string | null; origen: string }> }
const SEL = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
class ErrorCarga extends Error {
  constructor(public status: number, public code: string | null, public mensaje: string | null) { super(mensaje ?? "proveedores") }
}

/** Producto nuevo: elegir proveedores (se asocian después de crear el producto). */
export function ProveedoresProductoNuevo({ seleccion, onCambio }: { seleccion: string[]; onCambio: (ids: string[]) => void }) {
  const q = useQuery<{ proveedores: Array<Proveedor & { activo: boolean }> }>({ queryKey: ["negocio-proveedores", "lista-simple"], queryFn: async () => { const r = await fetch("/api/negocio/proveedores", { cache: "no-store" }); if (!r.ok) throw new Error("proveedores"); return r.json() } })
  const activos = (q.data?.proveedores ?? []).filter((p) => p.activo)
  return (
    <fieldset className="space-y-1 rounded-xl border p-2" data-testid="proveedores-producto-nuevo">
      <legend className="px-1 text-sm font-medium">Proveedores (opcional)</legend>
      {q.isLoading ? <p className="text-xs text-muted-foreground">Cargando…</p> : activos.length === 0 ? <p className="text-xs text-muted-foreground">Todavía no hay proveedores cargados.</p> : activos.map((p) => (
        <label key={p.id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={seleccion.includes(p.id)} onChange={(e) => onCambio(e.target.checked ? [...seleccion, p.id] : seleccion.filter((x) => x !== p.id))} />{p.nombre}</label>
      ))}
      <p className="text-xs text-muted-foreground">Se asocian al guardar. No cambia stock, costos ni precios.</p>
    </fieldset>
  )
}

/** Producto existente: proveedores asociados, agregar y quitar en el acto. */
export function ProveedoresDelProducto({ productoId, base, puedeEditar = true }: { productoId: string; base?: string; puedeEditar?: boolean }) {
  const url = base ?? `/api/negocio/productos/${productoId}/proveedores`
  const qc = useQueryClient()
  // Nunca queda «Cargando…» indefinidamente: un 4xx (sin permiso, producto inexistente) no se reintenta y se muestra.
  const q = useQuery<Datos, ErrorCarga>({
    queryKey: ["producto-proveedores", productoId, url],
    queryFn: async () => {
      const r = await fetch(url, { cache: "no-store" })
      const j = (await r.json().catch(() => null)) as (Datos & { ok?: boolean; error?: string; code?: string }) | null
      if (!r.ok || !j || j.ok === false) throw new ErrorCarga(r.status, j?.code ?? null, j?.error ?? null)
      return j
    },
    retry: (n, e) => e.status >= 500 && n < 1,
  })
  const [proveedorId, setProveedorId] = useState("")
  const [varianteId, setVarianteId] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enviar = async (method: "POST" | "DELETE", body?: unknown, query = "") => {
    if (enviando) return
    setEnviando(true); setError(null)
    try {
      const r = await fetch(`${url}${query}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!r.ok || j.ok === false) setError(j.error ?? "No se pudo guardar. Probá de nuevo.")
      await q.refetch()
      // La ficha del proveedor («Productos que entrega») y el catálogo de compras se ven actualizados al abrirlos.
      void qc.invalidateQueries({ queryKey: ["negocio-proveedores"] })
    } catch {
      setError("No se pudo guardar por un problema de conexión. Probá de nuevo.")
    } finally {
      setEnviando(false)
    }
  }
  const d = q.data
  const ya = (pid: string, vid: string | null) => (d?.asociaciones ?? []).some((a) => a.proveedorId === pid && a.productoVarianteId === vid)
  return (
    <div className="space-y-2 rounded-xl border p-2" data-testid="proveedores-del-producto">
      <p className="text-sm font-medium">Proveedores</p>
      {q.isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
      {q.isError && (
        q.error.status === 401 || q.error.status === 403
          ? <p role="status" className="rounded-lg bg-amber-50 p-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100" data-testid="proveedores-sin-permiso">{q.error.status === 401 ? "Tu sesión terminó. Volvé a ingresar." : q.error.mensaje ?? "No tenés permiso para ver los proveedores de este producto."}</p>
          : <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-rose-700" data-testid="proveedores-error-carga">
              <span>{q.error.status === 404 ? (q.error.mensaje ?? "Producto no encontrado.") : "No se pudieron cargar los proveedores."}</span>
              {q.error.status !== 404 && <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={q.isFetching} onClick={() => void q.refetch()}>{q.isFetching ? "Reintentando…" : "Reintentar"}</Button>}
            </div>
      )}
      {d && d.asociaciones.length === 0 && <p className="text-xs text-muted-foreground">Sin proveedores asociados.</p>}
      <ul className="space-y-1" aria-label="Proveedores asociados">
        {(d?.asociaciones ?? []).map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-sm">
            <span className="min-w-0 break-words">{a.proveedor}{a.productoVarianteId ? ` · ${a.variante ?? "variante"}` : d && d.variantes.length ? " · todas las variantes" : ""}{a.origen === "RECEPCION" ? <span className="ml-1 text-xs text-muted-foreground">(por una recepción)</span> : null}</span>
            {puedeEditar && <Button type="button" variant="ghost" className="min-h-11 shrink-0 rounded-xl text-rose-700" disabled={enviando} aria-label={`Quitar ${a.proveedor}`} onClick={() => void enviar("DELETE", undefined, `?asociacionId=${encodeURIComponent(a.id)}`)}>Quitar</Button>}
          </li>
        ))}
      </ul>
      {puedeEditar && d && d.proveedores.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1"><Label htmlFor={`pp-prov-${productoId}`}>Agregar proveedor</Label>
            <select id={`pp-prov-${productoId}`} className={SEL} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Elegí…</option>{d.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          {d.variantes.length > 0 && (
            <div className="space-y-1"><Label htmlFor={`pp-var-${productoId}`}>Variante</Label>
              <select id={`pp-var-${productoId}`} className={SEL} value={varianteId} onChange={(e) => setVarianteId(e.target.value)}>
                <option value="">Todas las variantes</option>{d.variantes.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </div>
          )}
          <Button type="button" variant="outline" className="min-h-11 self-end rounded-xl" disabled={enviando || !proveedorId || ya(proveedorId, varianteId || null)}
            onClick={() => void enviar("POST", { proveedorId, productoVarianteId: varianteId || null }).then(() => { setProveedorId(""); setVarianteId("") })}>
            {proveedorId && ya(proveedorId, varianteId || null) ? "Ya asociado" : "Agregar"}
          </Button>
        </div>
      )}
      {puedeEditar && d && d.proveedores.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay proveedores activos cargados en el negocio.</p>}
      {!puedeEditar && d && <p className="text-xs text-muted-foreground" data-testid="proveedores-solo-lectura">Sólo lectura: para asociar o quitar proveedores hace falta el permiso «Asociar proveedores».</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <p className="text-xs text-muted-foreground">Asociar o quitar no cambia el producto, su stock, costos ni precios.</p>
    </div>
  )
}
