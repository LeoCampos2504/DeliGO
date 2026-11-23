"use client"

// ============================================
// Catálogo — IMPORTAR PRODUCTOS desde Excel / CSV (dueño y empleado, computadora y celular)
// ============================================
// Pasos: Subir archivo → Revisar columnas → Vista previa → Confirmar → Resultados. Nada se guarda hasta «Confirmar»;
// la confirmación lleva una clave única (reintentos, doble clic o cortes no duplican: el servidor devuelve el mismo
// resultado o retoma lo que faltó). Las filas con error se pueden descargar para corregirlas y volver a importar sólo esas.

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Download, FileSpreadsheet, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { descargarCsv, leerArchivo, type Celda, type Hoja } from "@/lib/importacion-archivo"

type Campo = "nombre" | "descripcion" | "categoria" | "marca" | "codigoBarras" | "precio" | "costo" | "variante" | "proveedores"
type Accion = "crear" | "omitir" | "actualizar"
type Grupo = { clave: string; filas: number[]; nombre: string; tipo: "NUEVO" | "EXISTENTE" | "ERROR"; productoNombre: string | null; acciones: Accion[]; sugerida: Accion; errores: string[]; avisos: string[]; cambios: string[]; importes: string[]; variantes: number }
type Vista = { permisos: Record<"crear" | "editar" | "proveedores" | "precios" | "costos", boolean>; resumen: { filas: number; grupos: number; nuevos: number; existentes: number; errores: number }; grupos: Grupo[] }
type Resultado = { clave: string; filas: number[]; nombre: string; resultado: "CREADO" | "ACTUALIZADO" | "OMITIDO" | "ERROR"; detalle: string }
type Estado = { estado: "EN_CURSO" | "COMPLETADA"; procesados: number; totalGrupos: number; ocupada?: boolean; resumen: { creados: number; actualizados: number; omitidos: number; errores: number } | null; resultados: Resultado[] }

const CAMPOS: Array<{ k: Campo; t: string; ayuda?: string }> = [
  { k: "nombre", t: "Nombre del producto *" }, { k: "categoria", t: "Categoría" }, { k: "codigoBarras", t: "Código de barras" },
  { k: "precio", t: "Precio de venta" }, { k: "costo", t: "Costo" }, { k: "variante", t: "Variante", ayuda: "filas con el mismo nombre y distinta variante forman un producto" },
  { k: "proveedores", t: "Proveedor", ayuda: "nombre exacto de un proveedor ya cargado; varios separados con «;»" }, { k: "marca", t: "Marca / presentación" }, { k: "descripcion", t: "Descripción" },
]
const SINONIMOS: Record<Campo, string[]> = {
  nombre: ["nombre", "producto", "articulo", "nombre del producto", "item"], descripcion: ["descripcion", "detalle", "observaciones"],
  categoria: ["categoria", "rubro", "familia", "seccion"], marca: ["marca", "presentacion"], codigoBarras: ["codigo de barras", "codigo", "ean", "barras", "cod barras", "gtin", "upc"],
  precio: ["precio de venta", "precio venta", "precio", "pvp", "venta", "precio final"], costo: ["costo", "precio de costo", "precio costo", "compra"],
  variante: ["variante", "variedad", "sabor", "talle", "tamano"], proveedores: ["proveedor", "proveedores", "distribuidor", "distribuidora"],
}
const n = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
function sugerirMapeo(enc: string[]): Record<Campo, number> {
  const m = {} as Record<Campo, number>; const usadas = new Set<number>()
  const buscar = (k: Campo) => {
    for (const exacto of [true, false]) for (const s of SINONIMOS[k]) {
      const i = enc.findIndex((h, j) => !usadas.has(j) && (exacto ? n(h) === s : n(h).includes(s)))
      if (i >= 0) { m[k] = i; usadas.add(i); return }
    }
    m[k] = -1
  }
  for (const k of ["codigoBarras", "precio", "costo", "nombre", "variante", "categoria", "proveedores", "marca", "descripcion"] as Campo[]) buscar(k)
  // Muchas planillas llaman «Descripción» al nombre del producto.
  if (m.nombre < 0 && m.descripcion >= 0) { m.nombre = m.descripcion; m.descripcion = -1 }
  return m
}
function uuid() {
  // randomUUID sólo existe en contextos seguros (https / localhost); en la red local se arma un UUID v4.
  const c: Crypto = globalThis.crypto
  if (typeof c.randomUUID === "function") return c.randomUUID()
  const b = c.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128
  const h = Array.from(b, (x: number) => x.toString(16).padStart(2, "0")).join("")
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
type Pendiente = { clave: string; archivo: string; fecha: string; cuerpo: unknown }
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
function leerPendiente(k: string): Pendiente | null {
  try { const v = localStorage.getItem(k); const p = v ? (JSON.parse(v) as Pendiente) : null; return p && typeof p.clave === "string" && p.cuerpo ? p : null } catch { return null }
}
function guardarPendiente(k: string, p: Pendiente) { try { localStorage.setItem(k, JSON.stringify(p)) } catch { /* sin almacenamiento: igual se reintenta en esta pantalla */ } }
function borrarPendiente(k: string) { try { localStorage.removeItem(k) } catch { /* nada */ } }
const PASOS = ["Subir archivo", "Revisar columnas", "Vista previa", "Confirmar", "Resultados"]
const SEL = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
const COLOR: Record<string, string> = { NUEVO: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100", EXISTENTE: "bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-100", ERROR: "bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-100", CREADO: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100", ACTUALIZADO: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100", OMITIDO: "bg-muted text-muted-foreground" }
const ETIQUETA: Record<string, string> = { NUEVO: "Nuevo", EXISTENTE: "Ya existe", ERROR: "Con error", CREADO: "Creado", ACTUALIZADO: "Actualizado", OMITIDO: "Omitido" }
const TXT_ACCION: Record<Accion, string> = { crear: "Crear", omitir: "Omitir", actualizar: "Actualizar" }

export function ImportarProductos({ api, volverHref, volverTexto = "Volver" }: { api: string; volverHref: string; volverTexto?: string }) {
  const [paso, setPaso] = useState(0)
  const [archivo, setArchivo] = useState<{ nombre: string; hoja: Hoja } | null>(null)
  const [mapeo, setMapeo] = useState<Record<Campo, number> | null>(null)
  const [vista, setVista] = useState<Vista | null>(null)
  const [decisiones, setDecisiones] = useState<Record<string, Accion>>({})
  const [filtro, setFiltro] = useState<"TODOS" | "NUEVO" | "EXISTENTE" | "ERROR">("TODOS")
  const [ver, setVer] = useState(50)
  const [clave, setClave] = useState<string | null>(null)
  const [estado, setEstado] = useState<Estado | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const envio = useRef<unknown>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [incompleta, setIncompleta] = useState<Pendiente | null>(null)
  const clavePendiente = `deligo-importacion-pendiente:${api}`
  // Importación confirmada que no llegó a terminar (corte, recarga, cierre): se ofrece continuarla con la misma clave.
  useEffect(() => {
    let v = true
    void Promise.resolve().then(() => { if (v) setIncompleta(leerPendiente(clavePendiente)) })
    return () => { v = false }
  }, [clavePendiente])

  useEffect(() => {
    if (!(ocupado && paso === 3)) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h)
  }, [ocupado, paso])

  const filasMapeadas = useMemo(() => {
    if (!archivo || !mapeo) return []
    return archivo.hoja.filas.map((f) => {
      const o: Record<string, Celda | number> = { fila: f.numero }
      for (const c of CAMPOS) if (mapeo[c.k] >= 0) o[c.k] = f.valores[mapeo[c.k]] ?? ""
      return o
    })
  }, [archivo, mapeo])
  const campos = mapeo ? CAMPOS.filter((c) => mapeo[c.k] >= 0).map((c) => c.k) : []

  const elegirArchivo = async (file: File | undefined) => {
    if (!file) return
    setError(null); setOcupado(true)
    try {
      const hoja = await leerArchivo(file)
      setArchivo({ nombre: file.name, hoja }); setMapeo(sugerirMapeo(hoja.encabezados)); setVista(null); setEstado(null); setClave(null); setPaso(1)
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer el archivo.") } finally { setOcupado(false) }
  }
  const pedirVista = async () => {
    setError(null); setOcupado(true)
    try {
      const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modo: "vista_previa", campos, filas: filasMapeadas }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || !j.ok) { setError(j.error ?? "No se pudo armar la vista previa."); return }
      setVista(j); setDecisiones(Object.fromEntries((j as Vista).grupos.filter((g) => g.acciones.length).map((g) => [g.clave, g.sugerida]))); setFiltro("TODOS"); setVer(50); setPaso(2)
    } catch { setError("Sin conexión. Probá de nuevo (todavía no se guardó nada).") } finally { setOcupado(false) }
  }
  const confirmar = async (reanudar?: Pendiente) => {
    const k = reanudar?.clave ?? clave
    if (ocupado || !k) return
    setError(null); setAviso(null); setOcupado(true)
    const cuerpo = reanudar?.cuerpo ?? envio.current ?? { modo: "confirmar", clave: k, archivo: archivo?.nombre ?? "", campos, filas: filasMapeadas, decisiones }
    envio.current = cuerpo
    guardarPendiente(clavePendiente, { clave: k, archivo: reanudar?.archivo ?? archivo?.nombre ?? "", fecha: reanudar?.fecha ?? new Date().toISOString(), cuerpo })
    // Tandas cortas con la MISMA clave hasta completar. Ante un corte o un error del servidor se reintenta solo:
    // lo ya guardado nunca se repite. Sólo un rechazo definitivo (permiso, datos distintos, sesión) detiene el ciclo.
    let fallos = 0
    try {
      for (let vuelta = 0; vuelta < 5000; vuelta++) {
        let j: (Estado & { ok?: boolean; error?: string }) | null = null, status = 0
        try {
          const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })
          status = r.status; j = await r.json().catch(() => null)
        } catch { j = null }
        if (j?.ok) {
          fallos = 0; setAviso(null); setEstado(j)
          if (j.estado === "COMPLETADA") { borrarPendiente(clavePendiente); setIncompleta(null); setPaso(4); return }
          await esperar(j.ocupada ? 3000 : 200)
          if (j.ocupada) setAviso("Retomando una importación que quedó a medias… (puede tardar hasta un minuto)")
          continue
        }
        if (status >= 400 && status < 500) {
          setError(status === 401 ? "Tu sesión terminó. Ingresá de nuevo y tocá «Continuar importación»: lo ya guardado no se repite." : j?.error ?? "No se pudo completar la importación.")
          if (status === 409) { borrarPendiente(clavePendiente); setIncompleta(null) }
          return
        }
        fallos++
        setAviso(`Sin respuesta del servidor (intento ${fallos}). Reintentando automáticamente… Lo ya guardado no se repite.`)
        await esperar(Math.min(15000, 1500 * fallos))
      }
    } finally { setOcupado(false) }
  }
  const descargarErrores = (detalle: Map<number, string>) => {
    if (!archivo) return
    const filas = new Set([...detalle.keys()])
    descargarCsv(`filas-con-error-${archivo.nombre.replace(/\.[^.]+$/, "")}.csv`, [["Fila original", ...archivo.hoja.encabezados, "Error"], ...archivo.hoja.filas.filter((f) => filas.has(f.numero)).map((f) => [f.numero, ...archivo.hoja.encabezados.map((_, i) => f.valores[i] ?? ""), detalle.get(f.numero) ?? ""])])
  }
  const plantilla = () => descargarCsv("plantilla-productos-deligo.csv", [["Nombre", "Categoria", "Codigo de barras", "Precio de venta", "Costo", "Variante", "Proveedor", "Marca", "Descripcion"], ["Yerba suave 1 kg", "Almacén", "7790000000017", "3200", "2100", "", "", "Marca ejemplo", ""], ["Gaseosa cola", "Bebidas", "7790000000024", "1500", "900", "500 ml", "", "", ""], ["Gaseosa cola", "Bebidas", "7790000000031", "2600", "1600", "1,5 L", "", "", ""]])

  const grupos = vista?.grupos ?? []
  const visibles = grupos.filter((g) => filtro === "TODOS" || g.tipo === filtro)
  const cuenta = (a: Accion) => grupos.filter((g) => decisiones[g.clave] === a).length
  const masivo = (tipo: Grupo["tipo"], a: Accion) => setDecisiones((d) => { const x = { ...d }; for (const g of grupos) if (g.tipo === tipo && g.acciones.includes(a)) x[g.clave] = a; return x })
  const reinicio = () => { setPaso(0); setArchivo(null); setMapeo(null); setVista(null); setEstado(null); setClave(null); envio.current = null; setError(null); setAviso(null) }
  const continuar = (p: Pendiente) => { setClave(p.clave); setEstado(null); setPaso(3); void confirmar(p) }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-3 sm:p-4" data-testid="importar-productos">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label={volverTexto}><Link href={volverHref}><ArrowLeft className="h-5 w-5" /></Link></Button>
        <p className="text-sm font-bold">Importar productos</p>
      </header>
      <ol className="grid grid-cols-5 gap-1 text-center text-[11px] sm:text-xs" aria-label="Pasos">
        {PASOS.map((t, i) => <li key={t} className={`rounded-lg px-1 py-2 ${i === paso ? "bg-primary text-primary-foreground font-semibold" : i < paso ? "bg-muted" : "border text-muted-foreground"}`} aria-current={i === paso ? "step" : undefined}>{i + 1}. {t}</li>)}
      </ol>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{error}</p>}
      {aviso && <p role="status" className="rounded-xl bg-amber-50 p-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">{aviso}</p>}
      {incompleta && !ocupado && paso !== 4 && (
        <div className="space-y-2 rounded-2xl border border-amber-300 p-3" data-testid="importacion-incompleta">
          <p className="text-sm">Hay una importación sin terminar{incompleta.archivo ? ` de «${incompleta.archivo}»` : ""} (confirmada el {new Date(incompleta.fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}). Al continuar se guarda sólo lo que falta.</p>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-xl" onClick={() => continuar(incompleta)}>Continuar importación</Button>
            <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => { borrarPendiente(clavePendiente); setIncompleta(null) }}>Descartar aviso</Button>
          </div>
        </div>
      )}

      {paso === 0 && (
        <div className="space-y-3">
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center hover:bg-muted/40"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void elegirArchivo(e.dataTransfer.files[0]) }}>
            <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium">{ocupado ? "Leyendo archivo…" : "Elegí o arrastrá un archivo .xlsx o .csv"}</span>
            <span className="text-xs text-muted-foreground">Hasta 2.000 filas y 5 MB. Se lee la primera hoja; la primera fila debe tener los títulos.</span>
            <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={ocupado} onChange={(e) => { void elegirArchivo(e.target.files?.[0]); e.target.value = "" }} />
          </label>
          <Button variant="outline" className="min-h-11 rounded-xl" onClick={plantilla}><Download className="mr-1 h-4 w-4" />Descargar plantilla de ejemplo (.csv)</Button>
          <p className="text-xs text-muted-foreground">Nada se guarda hasta confirmar. No se carga stock ni se crean proveedores. Los productos que ya existen nunca se modifican sin tu confirmación.</p>
        </div>
      )}

      {paso === 1 && archivo && mapeo && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm"><FileSpreadsheet className="h-4 w-4" aria-hidden /><span className="min-w-0 break-all font-medium">{archivo.nombre}</span><span className="shrink-0 text-muted-foreground">· {archivo.hoja.filas.length} filas</span></p>
          <p className="text-xs text-muted-foreground">Indicá qué columna del archivo corresponde a cada dato. Lo que no relaciones no se importa.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CAMPOS.map((c) => (
              <label key={c.k} className="block space-y-1 rounded-xl border p-2 text-sm" htmlFor={`map-${c.k}`}>
                <span className="font-medium">{c.t}</span>
                <select id={`map-${c.k}`} className={SEL} value={mapeo[c.k]} onChange={(e) => setMapeo({ ...mapeo, [c.k]: Number(e.target.value) })}>
                  <option value={-1}>— no importar —</option>
                  {archivo.hoja.encabezados.map((h, i) => <option key={i} value={i}>{h}</option>)}
                </select>
                <span className="block break-words text-xs text-muted-foreground">{mapeo[c.k] >= 0 ? `Ej.: ${String(archivo.hoja.filas[0]?.valores[mapeo[c.k]] ?? "") || "(vacío)"}` : c.ayuda ?? ""}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-xl" disabled={ocupado || mapeo.nombre < 0} onClick={() => void pedirVista()}>{ocupado ? "Revisando…" : "Ver vista previa"}</Button>
            <Button variant="ghost" className="min-h-11 rounded-xl" onClick={reinicio}>Elegir otro archivo</Button>
          </div>
          {mapeo.nombre < 0 && <p className="text-xs text-rose-700">Falta relacionar la columna del nombre.</p>}
        </div>
      )}

      {paso === 2 && vista && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            {([["NUEVO", vista.resumen.nuevos, "nuevos"], ["EXISTENTE", vista.resumen.existentes, "ya existen"], ["ERROR", vista.resumen.errores, "con error"]] as const).map(([t, c, l]) => (
              <button key={t} type="button" onClick={() => { setFiltro(filtro === t ? "TODOS" : t); setVer(50) }} className={`min-h-16 rounded-xl p-2 ${COLOR[t]} ${filtro === t ? "ring-2 ring-primary" : ""}`}><span className="block text-xl font-bold">{c}</span><span className="text-xs">{l}</span></button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{vista.resumen.filas} filas → {vista.resumen.grupos} productos. {Object.entries(vista.permisos).filter(([, v]) => !v).length ? `Sin permiso de: ${Object.entries(vista.permisos).filter(([, v]) => !v).map(([k]) => k).join(", ")} (esos datos se ignoran).` : ""}</p>
          <div className="flex flex-wrap gap-2">
            {vista.resumen.nuevos > 0 && <><Button variant="outline" size="sm" className="min-h-11 rounded-xl" onClick={() => masivo("NUEVO", "crear")}>Crear todos los nuevos</Button><Button variant="outline" size="sm" className="min-h-11 rounded-xl" onClick={() => masivo("NUEVO", "omitir")}>Omitir nuevos</Button></>}
            {grupos.some((g) => g.acciones.includes("actualizar")) && <><Button variant="outline" size="sm" className="min-h-11 rounded-xl" onClick={() => masivo("EXISTENTE", "actualizar")}>Actualizar existentes con cambios</Button><Button variant="outline" size="sm" className="min-h-11 rounded-xl" onClick={() => masivo("EXISTENTE", "omitir")}>Omitir existentes</Button></>}
            {vista.resumen.errores > 0 && <Button variant="outline" size="sm" className="min-h-11 rounded-xl" onClick={() => descargarErrores(new Map(grupos.filter((g) => g.tipo === "ERROR").flatMap((g) => g.filas.map((f) => [f, g.errores.join(" ")] as [number, string]))))}><Download className="mr-1 h-4 w-4" />Filas con error (.csv)</Button>}
          </div>
          <ul className="space-y-2" aria-label="Vista previa">
            {visibles.slice(0, ver).map((g) => (
              <li key={g.clave} className="space-y-1 rounded-xl border p-2" data-testid="grupo-importacion">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR[g.tipo]}`}>{ETIQUETA[g.tipo]}</span>
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">{g.nombre}{g.variantes ? ` · ${g.variantes} variantes` : ""}</span>
                  <span className="text-xs text-muted-foreground">fila{g.filas.length > 1 ? "s" : ""} {g.filas.join(", ")}</span>
                </div>
                {g.productoNombre && g.productoNombre !== g.nombre && <p className="text-xs text-muted-foreground">En el catálogo: {g.productoNombre}</p>}
                {g.cambios.length > 0 && <ul className="list-disc pl-5 text-xs">{g.cambios.map((c) => <li key={c}>{c}</li>)}</ul>}
                {g.importes.length > 0 && <p className="text-xs" data-testid="importes-a-guardar">Se guarda: {g.importes.join(" · ")}</p>}
                {g.avisos.map((a) => <p key={a} className="text-xs text-amber-800 dark:text-amber-200">{a}</p>)}
                {g.errores.map((e) => <p key={e} className="text-xs text-rose-700 dark:text-rose-300">{e}</p>)}
                {g.acciones.length > 1 && (
                  <div className="flex gap-1" role="radiogroup" aria-label={`Acción para ${g.nombre}`}>
                    {g.acciones.map((a) => <button key={a} type="button" role="radio" aria-checked={decisiones[g.clave] === a} onClick={() => setDecisiones((d) => ({ ...d, [g.clave]: a }))} className={`min-h-11 flex-1 rounded-xl border px-3 text-sm ${decisiones[g.clave] === a ? "border-primary bg-primary text-primary-foreground" : ""}`}>{TXT_ACCION[a]}</button>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {visibles.length > ver && <Button variant="outline" className="min-h-11 w-full rounded-xl" onClick={() => setVer((v) => v + 50)}>Ver más ({visibles.length - ver})</Button>}
          <div className="sticky bottom-2 flex flex-wrap gap-2 rounded-2xl border bg-background/95 p-2 backdrop-blur">
            <Button className="min-h-11 rounded-xl" disabled={!cuenta("crear") && !cuenta("actualizar")} onClick={() => { setClave(uuid()); envio.current = null; setPaso(3) }}>Continuar ({cuenta("crear")} a crear · {cuenta("actualizar")} a actualizar)</Button>
            <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => setPaso(1)}>Volver a columnas</Button>
          </div>
        </div>
      )}

      {paso === 3 && (vista || envio.current !== null) && (
        <div className="space-y-3 rounded-2xl border p-3">
          <p className="text-sm font-semibold">Confirmá la importación</p>
          {vista && <ul className="space-y-1 text-sm">
            <li>Se crean <b>{cuenta("crear")}</b> productos nuevos.</li>
            <li>Se actualizan <b>{cuenta("actualizar")}</b> productos existentes (sólo los cambios listados).</li>
            <li>Se omiten <b>{cuenta("omitir")}</b>; <b>{vista.resumen.errores}</b> con error no se importan.</li>
          </ul>}
          <p className="text-xs text-muted-foreground">No se carga stock ni se generan movimientos de inventario. Queda registrado quién importó y qué se creó o modificó.</p>
          {ocupado && (
            <div role="status" className="space-y-1 text-sm" data-testid="avance-importacion">
              <p>Importando… {estado?.totalGrupos ? `${estado.procesados} de ${estado.totalGrupos}` : ""}</p>
              {estado?.totalGrupos ? <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.round((estado.procesados / estado.totalGrupos) * 100)}%` }} /></div> : null}
              <p className="text-xs text-muted-foreground">Si se corta la conexión o cerrás la pantalla, después podés continuar: lo ya guardado no se repite.</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-xl" disabled={ocupado} onClick={() => void confirmar()}>{ocupado ? "Importando…" : envio.current ? "Continuar importación" : "Confirmar importación"}</Button>
            {!ocupado && !envio.current && <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => setPaso(2)}>Volver a la vista previa</Button>}
          </div>
        </div>
      )}

      {paso === 4 && estado && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            {([["CREADO", estado.resumen?.creados, "creados"], ["ACTUALIZADO", estado.resumen?.actualizados, "actualizados"], ["OMITIDO", estado.resumen?.omitidos, "omitidos"], ["ERROR", estado.resumen?.errores, "con error"]] as const).map(([t, c, l]) => <div key={t} className={`rounded-xl p-2 ${COLOR[t]}`}><span className="block text-xl font-bold">{c ?? 0}</span><span className="text-xs">{l}</span></div>)}
          </div>
          {(estado.resumen?.errores ?? 0) > 0 && <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => descargarErrores(new Map(estado.resultados.filter((r) => r.resultado === "ERROR").flatMap((r) => r.filas.map((f) => [f, r.detalle] as [number, string]))))}><Download className="mr-1 h-4 w-4" />Descargar filas con error (.csv) para corregir y reimportar</Button>}
          <ul className="space-y-1" aria-label="Resultados">
            {[...estado.resultados].sort((a, b) => Number(b.resultado === "ERROR") - Number(a.resultado === "ERROR") || a.filas[0] - b.filas[0]).slice(0, ver).map((r) => (
              <li key={r.clave} className="flex flex-wrap items-start gap-2 rounded-xl border p-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR[r.resultado]}`}>{ETIQUETA[r.resultado]}</span>
                <span className="min-w-0 flex-1 break-words"><span className="font-medium">{r.nombre}</span><span className="block text-xs text-muted-foreground">fila{r.filas.length > 1 ? "s" : ""} {r.filas.join(", ")} · {r.detalle}</span></span>
              </li>
            ))}
          </ul>
          {estado.resultados.length > ver && <Button variant="outline" className="min-h-11 w-full rounded-xl" onClick={() => setVer((v) => v + 50)}>Ver más ({estado.resultados.length - ver})</Button>}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-xl" onClick={reinicio}>Importar otro archivo</Button>
            <Button asChild variant="outline" className="min-h-11 rounded-xl"><Link href={volverHref}>{volverTexto}</Link></Button>
          </div>
        </div>
      )}
    </div>
  )
}
