"use client"

// Catálogo — dueño: permisos TEMPORALES de empleados para cargar/editar productos y autoría de cada producto.

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Permiso = { id: string; nombre: string; hasta: string | null; vigente: boolean; crear: boolean; editar: boolean; proveedores: boolean; precios: boolean; costos: boolean; importar: boolean }
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "—")
const enDias = (d: number) => { const x = new Date(Date.now() + d * 86400_000); x.setSeconds(0, 0); return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }

export function PermisosCatalogoEmpleados() {
  const q = useQuery<{ empleados: Permiso[] }>({ queryKey: ["permisos-catalogo"], queryFn: async () => { const r = await fetch("/api/negocio/empleados/permisos-catalogo", { cache: "no-store" }); if (!r.ok) throw new Error("permisos"); return r.json() } })
  return (
    <details className="rounded-2xl border p-3" data-testid="permisos-catalogo">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Empleados que pueden cargar productos</summary>
      <p className="text-xs text-muted-foreground">Deshabilitado por defecto. El permiso vence solo en la fecha indicada y se puede revocar en cualquier momento. Nunca da acceso al stock ni a operaciones de dinero. Precios y costos son permisos aparte.</p>
      <div className="mt-2 space-y-2">{q.isLoading ? <p className="text-xs text-muted-foreground">Cargando…</p> : (q.data?.empleados ?? []).map((e) => <FilaPermiso key={`${e.id}-${e.hasta}-${e.crear}-${e.precios}-${e.importar}`} e={e} onHecho={() => void q.refetch()} />)}</div>
    </details>
  )
}

function FilaPermiso({ e, onHecho }: { e: Permiso; onHecho: () => void }) {
  const [hasta, setHasta] = useState(e.vigente && e.hasta ? new Date(new Date(e.hasta).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : enDias(7))
  const [f, setF] = useState({ crear: e.crear, editar: e.editar, proveedores: e.proveedores, precios: e.precios, costos: e.costos, importar: e.importar })
  const [msg, setMsg] = useState<string | null>(null)
  const guardar = async (revocar: boolean) => {
    const r = await fetch("/api/negocio/empleados/permisos-catalogo", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empleadoId: e.id, hasta: revocar ? null : new Date(hasta).toISOString(), ...f }) })
    const j = (await r.json().catch(() => ({}))) as { error?: string }
    setMsg(r.ok ? (revocar ? "Acceso revocado." : "Permiso guardado.") : j.error ?? "No se pudo guardar.")
    if (r.ok) onHecho()
  }
  const chk = (k: keyof typeof f, t: string) => <label className="flex min-h-11 items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4" checked={f[k]} onChange={(x) => setF((v) => ({ ...v, [k]: x.target.checked }))} />{t}</label>
  return (
    <div className="space-y-1 rounded-xl border p-2" data-testid="fila-permiso-catalogo">
      <p className="text-sm font-medium">{e.nombre} <span className={e.vigente ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>· {e.vigente ? `habilitado hasta ${fecha(e.hasta)}` : e.hasta ? `vencido el ${fecha(e.hasta)}` : "sin permiso"}</span></p>
      <div className="flex flex-wrap gap-x-4">{chk("crear", "Crear productos y variantes")}{chk("editar", "Editar datos (nombre, categoría, código, presentación, imagen)")}{chk("proveedores", "Asociar proveedores")}{chk("precios", "Precios de venta")}{chk("costos", "Costos")}{chk("importar", "Importar productos (Excel/CSV)")}</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="block space-y-1 text-xs" htmlFor={`cat-hasta-${e.id}`}><span>Vence</span><Input id={`cat-hasta-${e.id}`} type="datetime-local" value={hasta} onChange={(x) => setHasta(x.target.value)} className="h-11 rounded-xl" /></label>
        <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setHasta(enDias(7))}>7 días</Button>
        <Button className="min-h-11 rounded-xl" onClick={() => void guardar(false)}>{e.vigente ? "Guardar / ampliar" : "Habilitar"}</Button>
        {(e.vigente || e.hasta) && <Button variant="ghost" className="min-h-11 rounded-xl text-rose-700" onClick={() => void guardar(true)}>Revocar ahora</Button>}
      </div>
      {msg && <p className="text-xs" role="status">{msg}</p>}
    </div>
  )
}

/** Quién creó y modificó el producto (auditoría), en la ficha del dueño. */
export function AutoriaProducto({ productoId }: { productoId: string }) {
  const q = useQuery<{ creado: { por: string | null; fecha: string }; ultimaModificacion: { por: string; fecha: string } | null }>({ queryKey: ["producto-autoria", productoId], queryFn: async () => { const r = await fetch(`/api/negocio/productos/${productoId}/autoria`, { cache: "no-store" }); if (!r.ok) throw new Error("autoria"); return r.json() } })
  if (!q.data) return null
  return (
    <p className="text-xs text-muted-foreground" data-testid="autoria-producto">
      Creado por {q.data.creado.por ?? "—"} · {fecha(q.data.creado.fecha)}{q.data.ultimaModificacion ? ` · última modificación: ${q.data.ultimaModificacion.por} · ${fecha(q.data.ultimaModificacion.fecha)}` : ""}
    </p>
  )
}
