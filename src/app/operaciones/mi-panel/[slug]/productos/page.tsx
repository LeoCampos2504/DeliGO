"use client"

// ============================================
// Catálogo — «Productos» del empleado (celular primero)
// ============================================
// Sólo con permiso de catálogo VIGENTE otorgado por el dueño (el servidor lo verifica en cada operación: vencido o
// revocado, rechaza aunque esta pestaña siga abierta). Muestra y envía únicamente los campos permitidos; precios y
// costos son permisos aparte. Nunca stock ni dinero. Proveedores: misma relación que la ficha del proveedor.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Plus, Search, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"
import { ProveedoresDelProducto } from "@/components/business/producto-proveedores"
import { UNIDADES_MEDIDA } from "@/lib/inventario"

type Permisos = { vigente: boolean; hasta: string | null; crear: boolean; editar: boolean; proveedores: boolean; precios: boolean; costos: boolean; importar: boolean }
type Variante = { id: string; nombre: string; precio: number; codigoBarras: string | null; activo: boolean }
type Producto = { id: string; nombre: string; categoria: string; codigoBarras: string | null; marca: string | null; unidadMedida: string; imagenUrl: string | null; precio: number; costo?: number | null; variantes: Variante[] }
type Form = { nombre: string; categoria: string; codigoBarras: string; marca: string; unidadMedida: string; imagenUrl: string; precio: string; costo: string; variantes: Array<{ id?: string; nombre: string; codigoBarras: string; precio: string }> }
const PADDING_INFERIOR = "calc(max(7rem, var(--deligo-install-prompt-h, 0px) + 1rem) + env(safe-area-inset-bottom, 0px))"
const SEL = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
const num = (t: string) => { const v = Number(t.replace(/\./g, "").replace(",", ".")); return Number.isFinite(v) ? v : NaN }
const vacio = (): Form => ({ nombre: "", categoria: "", codigoBarras: "", marca: "", unidadMedida: "unidad", imagenUrl: "", precio: "", costo: "", variantes: [] })
const deProducto = (p: Producto): Form => ({ nombre: p.nombre, categoria: p.categoria, codigoBarras: p.codigoBarras ?? "", marca: p.marca ?? "", unidadMedida: p.unidadMedida, imagenUrl: p.imagenUrl ?? "", precio: p.precio > 0 ? String(p.precio).replace(".", ",") : "", costo: p.costo != null ? String(p.costo).replace(".", ",") : "", variantes: p.variantes.map((v) => ({ id: v.id, nombre: v.nombre, codigoBarras: v.codigoBarras ?? "", precio: v.precio > 0 ? String(v.precio).replace(".", ",") : "" })) })

export default function CatalogoEmpleadoPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const nav = useOperativoNav()
  const base = `/api/operativo/caja/${encodeURIComponent(slug)}/catalogo`
  const [datos, setDatos] = useState<{ permisos: Permisos; productos: Producto[]; categorias: string[] } | null>(null)
  const [busca, setBusca] = useState("")
  const [ver, setVer] = useState(30)
  const [modo, setModo] = useState<{ tipo: "lista" } | { tipo: "nuevo" } | { tipo: "editar"; id: string }>({ tipo: "lista" })
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await fetch(base, { cache: "no-store" })
    if (r.status === 401) return router.replace(nav.loginHref)
    const j = await r.json().catch(() => null)
    if (j?.ok) setDatos(j)
  }, [base, router, nav.loginHref])
  useEffect(() => { let v = true; void Promise.resolve().then(() => { if (v) void cargar() }); return () => { v = false } }, [cargar])

  const p = datos?.permisos
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return (datos?.productos ?? []).filter((x) => !t || `${x.nombre} ${x.categoria} ${x.codigoBarras ?? ""} ${x.marca ?? ""} ${x.variantes.map((v) => `${v.nombre} ${v.codigoBarras ?? ""}`).join(" ")}`.toLowerCase().includes(t))
  }, [datos, busca])
  const editando = modo.tipo === "editar" ? datos?.productos.find((x) => x.id === modo.id) ?? null : null

  return (
    <main className="min-h-screen bg-background" style={{ paddingBottom: PADDING_INFERIOR }}>
      <div className="mx-auto w-full max-w-3xl space-y-3 p-3 sm:p-4">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label="Volver a la Caja">
            <Link href={`${nav.homeHref}/${encodeURIComponent(slug)}/caja`}><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <p className="text-sm font-bold">Productos</p>
        </header>
        {!datos ? <p className="text-sm text-muted-foreground">Cargando…</p> : !p?.vigente ? (
          <p className="rounded-xl border p-3 text-sm" role="status">No tenés un permiso vigente para cargar productos. Pedíselo al dueño.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground" data-testid="permiso-vigente">Permiso hasta {new Date(p.hasta!).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })} · {[p.crear && "crear", p.editar && "editar", p.proveedores && "proveedores", p.precios && "precios", p.costos && "costos", p.importar && "importar"].filter(Boolean).join(" · ")}</p>
            {aviso && <p role="status" className="rounded-xl bg-emerald-50 p-2 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">{aviso}</p>}
            {modo.tipo === "lista" && (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={busca} onChange={(e) => { setBusca(e.target.value); setVer(30) }} placeholder="Buscar por nombre, código o marca…" className="min-h-11 rounded-xl pl-9" aria-label="Buscar producto" /></div>
                  {p.crear && <Button className="min-h-11 rounded-xl" onClick={() => { setAviso(null); setModo({ tipo: "nuevo" }) }}><Plus className="mr-1 h-4 w-4" />Nuevo</Button>}
                  {p.importar && <Button asChild variant="outline" className="min-h-11 rounded-xl"><Link href={`${nav.homeHref}/${encodeURIComponent(slug)}/productos/importar`}><Upload className="mr-1 h-4 w-4" />Importar</Link></Button>}
                </div>
                <ul className="space-y-1" aria-label="Productos">
                  {lista.slice(0, ver).map((x) => (
                    <li key={x.id}><button type="button" onClick={() => { setAviso(null); setModo({ tipo: "editar", id: x.id }) }} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm hover:bg-muted/50">
                      <span className="min-w-0 break-words"><span className="font-medium">{x.nombre}</span><span className="block text-xs text-muted-foreground">{x.categoria}{x.codigoBarras ? ` · ${x.codigoBarras}` : ""}{x.variantes.length ? ` · ${x.variantes.length} variantes` : ""}</span></span>
                      <span className="shrink-0 text-xs">{x.precio > 0 || x.variantes.some((v) => v.precio > 0) ? `$${(x.variantes.length ? Math.min(...x.variantes.map((v) => v.precio)) : x.precio).toLocaleString("es-AR")}` : <span className="text-amber-700">sin precio</span>}</span>
                    </button></li>
                  ))}
                </ul>
                {lista.length > ver && <Button variant="outline" className="min-h-11 w-full rounded-xl" onClick={() => setVer((v) => v + 30)}>Ver más ({lista.length - ver})</Button>}
              </>
            )}
            {modo.tipo === "nuevo" && p.proveedores && <p className="text-xs text-muted-foreground" data-testid="proveedores-despues-de-crear">Proveedores: al crear el producto se abre su ficha y ahí podés asociarlos.</p>}
            {modo.tipo === "nuevo" && <FormProducto base={base} permisos={p} categorias={datos.categorias} inicial={vacio()} onCancelar={() => setModo({ tipo: "lista" })} onHecho={async (t, id) => { setAviso(t); await cargar(); setModo(id ? { tipo: "editar", id } : { tipo: "lista" }) }} />}
            {modo.tipo === "editar" && editando && (
              <>
                <FormProducto key={editando.id} base={base} permisos={p} categorias={datos.categorias} inicial={deProducto(editando)} producto={editando} onCancelar={() => setModo({ tipo: "lista" })} onHecho={async (t) => { setAviso(t); await cargar() }} />
                {(p.editar || p.proveedores)
                  ? <ProveedoresDelProducto productoId={editando.id} base={`${base}/productos/${editando.id}/proveedores`} puedeEditar={p.proveedores} />
                  : <p className="rounded-xl border p-2 text-xs text-muted-foreground" data-testid="proveedores-no-habilitado">Proveedores: tu permiso no incluye ver ni asociar proveedores.</p>}
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function FormProducto({ base, permisos: p, categorias, inicial, producto, onCancelar, onHecho }: { base: string; permisos: Permisos; categorias: string[]; inicial: Form; producto?: Producto; onCancelar: () => void; onHecho: (texto: string, id?: string) => void | Promise<void> }) {
  const [f, setF] = useState<Form>(inicial)
  const [estado, setEstado] = useState<{ enviando: boolean; error: string | null }>({ enviando: false, error: null })
  const editable = producto ? p.editar : p.crear
  const set = (k: keyof Form, v: string) => setF((x) => ({ ...x, [k]: v }))
  const guardar = async () => {
    setEstado({ enviando: true, error: null })
    let body: Record<string, unknown>
    if (!producto) {
      body = { nombre: f.nombre, categoria: f.categoria, codigoBarras: f.codigoBarras || null, marca: f.marca, unidadMedida: f.unidadMedida, imagenUrl: f.imagenUrl || null }
      if (p.precios && f.precio.trim() && !f.variantes.length) body.precio = num(f.precio)
      if (p.costos && f.costo.trim()) body.costo = num(f.costo)
      if (f.variantes.length) body.variantes = f.variantes.map((v) => ({ nombre: v.nombre, codigoBarras: v.codigoBarras || null, ...(p.precios && v.precio.trim() ? { precio: num(v.precio) } : {}) }))
    } else {
      // Sólo se envían los campos permitidos que cambiaron (el servidor rechaza cualquier otro).
      body = {}
      const ini = deProducto(producto)
      if (p.editar) for (const k of ["nombre", "categoria", "marca", "unidadMedida"] as const) if (f[k] !== ini[k]) body[k] = f[k]
      if (p.editar && f.codigoBarras !== ini.codigoBarras) body.codigoBarras = f.codigoBarras || null
      if (p.editar && f.imagenUrl !== ini.imagenUrl) body.imagenUrl = f.imagenUrl || null
      if (p.precios && !producto.variantes.length && f.precio !== ini.precio && f.precio.trim()) body.precio = num(f.precio)
      if (p.costos && f.costo !== ini.costo) body.costo = f.costo.trim() ? num(f.costo) : null
      const vs = f.variantes.flatMap((v, i) => {
        const a = ini.variantes[i]; const d: Record<string, unknown> = {}
        if (p.editar && v.nombre !== a.nombre) d.nombre = v.nombre
        if (p.editar && v.codigoBarras !== a.codigoBarras) d.codigoBarras = v.codigoBarras || null
        if (p.precios && v.precio !== a.precio && v.precio.trim()) d.precio = num(v.precio)
        return Object.keys(d).length ? [{ id: v.id, ...d }] : []
      })
      if (vs.length) body.variantes = vs
      if (!Object.keys(body).length) return setEstado({ enviando: false, error: "No hay cambios para guardar." })
    }
    const r = await fetch(producto ? `${base}/productos/${producto.id}` : `${base}/productos`, { method: producto ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; producto?: { id: string }; sinPrecio?: boolean }
    if (!r.ok || !j.ok) return setEstado({ enviando: false, error: j.error ?? "No se pudo guardar." })
    setEstado({ enviando: false, error: null })
    await onHecho(producto ? "Cambios guardados." : `Producto creado${j.sinPrecio ? " sin precio de venta: no se puede vender hasta que alguien autorizado cargue el precio" : ""}.`, j.producto?.id)
  }
  return (
    <div className="space-y-2 rounded-2xl border p-3" data-testid="form-producto-empleado">
      <p className="text-sm font-semibold">{producto ? `Editar · ${producto.nombre}` : "Nuevo producto"}</p>
      <fieldset disabled={!editable} className="space-y-2">
        <label className="block space-y-1 text-sm font-medium" htmlFor="ce-nombre"><span>Nombre</span><Input id="ce-nombre" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} className="h-11 rounded-xl" /></label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium" htmlFor="ce-cat"><span>Categoría</span><Input id="ce-cat" list="ce-cats" value={f.categoria} onChange={(e) => set("categoria", e.target.value)} className="h-11 rounded-xl" /><datalist id="ce-cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist></label>
          <label className="block space-y-1 text-sm font-medium" htmlFor="ce-cb"><span>Código de barras</span><Input id="ce-cb" inputMode="numeric" value={f.codigoBarras} onChange={(e) => set("codigoBarras", e.target.value)} className="h-11 rounded-xl" /></label>
          <label className="block space-y-1 text-sm font-medium" htmlFor="ce-marca"><span>Marca / presentación</span><Input id="ce-marca" value={f.marca} onChange={(e) => set("marca", e.target.value)} className="h-11 rounded-xl" /></label>
          <label className="block space-y-1 text-sm font-medium" htmlFor="ce-unidad"><span>Unidad</span><select id="ce-unidad" className={SEL} value={f.unidadMedida} onChange={(e) => set("unidadMedida", e.target.value)}>{UNIDADES_MEDIDA.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}</select></label>
        </div>
        <label className="block space-y-1 text-sm font-medium" htmlFor="ce-img"><span>Imagen (URL, opcional)</span><Input id="ce-img" value={f.imagenUrl} onChange={(e) => set("imagenUrl", e.target.value)} className="h-11 rounded-xl" /></label>
      </fieldset>
      {(!producto ? f.variantes.length === 0 : producto.variantes.length === 0) && (
        p.precios
          ? <label className="block space-y-1 text-sm font-medium" htmlFor="ce-precio"><span>Precio de venta ($)</span><Input id="ce-precio" inputMode="decimal" value={f.precio} onChange={(e) => set("precio", e.target.value)} className="h-11 rounded-xl" /></label>
          : <p className="text-xs text-muted-foreground" data-testid="precio-sin-permiso">Precio de venta: {producto && producto.precio > 0 ? `$${producto.precio.toLocaleString("es-AR")}` : "sin precio"} (no tenés permiso para cambiarlo).</p>
      )}
      {p.costos && <label className="block space-y-1 text-sm font-medium" htmlFor="ce-costo"><span>Costo ($, opcional)</span><Input id="ce-costo" inputMode="decimal" value={f.costo} onChange={(e) => set("costo", e.target.value)} className="h-11 rounded-xl" /></label>}
      {(f.variantes.length > 0 || (!producto && p.crear)) && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Variantes</p>
          {f.variantes.map((v, i) => (
            <div key={v.id ?? i} className="grid gap-2 rounded-xl border p-2 sm:grid-cols-3">
              <Input aria-label="Nombre de la variante" placeholder="Nombre (ej.: 500 g)" disabled={!editable} value={v.nombre} onChange={(e) => setF((x) => ({ ...x, variantes: x.variantes.map((y, j) => (j === i ? { ...y, nombre: e.target.value } : y)) }))} className="h-11 rounded-xl" />
              <Input aria-label="Código de la variante" placeholder="Código de barras" disabled={!editable} value={v.codigoBarras} onChange={(e) => setF((x) => ({ ...x, variantes: x.variantes.map((y, j) => (j === i ? { ...y, codigoBarras: e.target.value } : y)) }))} className="h-11 rounded-xl" />
              {p.precios ? <Input aria-label="Precio de la variante" placeholder="Precio $" inputMode="decimal" value={v.precio} onChange={(e) => setF((x) => ({ ...x, variantes: x.variantes.map((y, j) => (j === i ? { ...y, precio: e.target.value } : y)) }))} className="h-11 rounded-xl" /> : <span className="self-center text-xs text-muted-foreground">{v.precio ? `$${v.precio}` : "sin precio"}</span>}
            </div>
          ))}
          {!producto && p.crear && <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={() => setF((x) => ({ ...x, variantes: [...x.variantes, { nombre: "", codigoBarras: "", precio: "" }] }))}>Agregar variante</Button>}
        </div>
      )}
      {estado.error && <p role="alert" className="text-sm text-rose-700">{estado.error}</p>}
      <div className="flex flex-wrap gap-2">
        {(editable || p.precios || p.costos) && <Button className="min-h-11 rounded-xl" disabled={estado.enviando} onClick={() => void guardar()}>{estado.enviando ? "Guardando…" : producto ? "Guardar cambios" : "Crear producto"}</Button>}
        <Button variant="ghost" className="min-h-11 rounded-xl" onClick={onCancelar}>Volver</Button>
      </div>
    </div>
  )
}
