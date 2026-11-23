"use client"

// ============================================
// F10-C2b — DeliGO Operaciones: «Recibir mercadería» (cajero, mobile-first)
// ============================================
// Pantalla personal del cajero (área caja) de un negocio genérico. Usa SÓLO las rutas operativas
// del cajero (/api/operativo/caja/[slug]/recepciones*): el camino principal es «Pedidos por recibir»
// (los pedidos del dueño, listos para tocar «Recibir pedido»: proveedor, pedido y TODOS sus renglones
// ya cargados; el cajero anota sólo lo que llegó). Retoma su borrador del mismo pedido en vez de crear
// otro. «Llegó mercadería sin pedido» queda para compras directas. Nunca ve saldos de proveedores,
// anticipos, deuda exigible ni el esperado de Caja. Crear un pedido no crea recepciones ni mueve stock:
// la recepción empieza al guardar y el stock entra sólo cuando el dueño aprueba. El pago en efectivo al
// recibir pasa por la salida PAGO_PROVEEDOR de F10-C1 de su propio turno (D-7).

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, PackageCheck, Plus, RefreshCw, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"
import { cn } from "@/lib/utils"
import { ESTADO_RECEPCION, MOTIVOS_RECHAZO, enviarJson, fueDevuelta, leerJson, RecepcionEditor, type DatosRecepcion, type FilaRecepcion, type RecepcionDetalle } from "@/components/business/recepcion-editor"
import { RecepcionPagoEfectivo } from "@/components/business/recepcion-pago-efectivo"
import { formatoArs, parseImporteArs } from "@/components/business/caja-salidas-cajero"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"

const PADDING_INFERIOR = "calc(max(7rem, var(--deligo-install-prompt-h, 0px) + 1rem) + env(safe-area-inset-bottom, 0px))"
const SEL = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
const POR_PAGINA = 10

type EstadoPedido = "PENDIENTE" | "PARCIAL" | "PENDIENTE_APROBACION" | "COMPLETADO" | "CERRADO_CON_PENDIENTES"
type PedidoParaRecibir = {
  id: string; numero: number; estado: EstadoPedido; estadoCompra: string; proveedor: { id: string; nombre: string }; fechaPedido: string; productos: number
  avance: { pedido: number; aceptado: number; pendiente: number }; recepcionesEnviadas: number; borradorPropio: { id: string; numero: number } | null
  pagoAnticipado?: { confirmado: number; programado: number } | null
  lineas: Array<{ producto: string; variante: string | null; pedida: number; aceptada: number; enRevision: number; pendiente: number }>
}

const ESTADO_PEDIDO: Record<EstadoPedido, { texto: string; clase: string }> = {
  PENDIENTE: { texto: "Por recibir", clase: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100" },
  PARCIAL: { texto: "Recibido en parte", clase: "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100" },
  PENDIENTE_APROBACION: { texto: "Recepción pendiente de aprobación", clase: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100" },
  COMPLETADO: { texto: "Completado", clase: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100" },
  CERRADO_CON_PENDIENTES: { texto: "Cerrado con pendientes", clase: "bg-muted text-foreground" },
}
const cerrado = (e: EstadoPedido) => e === "COMPLETADO" || e === "CERRADO_CON_PENDIENTES"
const num = (n: number) => String(n).replace(".", ",")
const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })
const normalizar = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")

type Vista = { modo: "lista" } | { modo: "nueva" } | { modo: "pedido"; compraId: string } | { modo: "ver"; id: string }

export default function RecibirMercaderiaPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()
  const nav = useOperativoNav()
  const base = `/api/operativo/caja/${encodeURIComponent(slug)}`
  const [ctx, setCtx] = useState<{ negocioId: string; empleadoId: string; negocioNombre: string } | null>(null)
  const [lista, setLista] = useState<FilaRecepcion[] | null>(null)
  const [pedidos, setPedidos] = useState<PedidoParaRecibir[] | null>(null)
  // Pagos E3: permiso individual de anticipos en efectivo (lo decide el servidor; deshabilitado por defecto).
  const [permiso, setPermiso] = useState<PermisoAnticipo>({ habilitado: false })
  const [error, setError] = useState<string | null>(null)
  const [vista, setVista] = useState<Vista>({ modo: "lista" })
  const [detalle, setDetalle] = useState<RecepcionDetalle | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [recienEnviada, setRecienEnviada] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<{ texto: string; proveedorId: string; estado: "ACTIVOS" | EstadoPedido }>({ texto: "", proveedorId: "", estado: "ACTIVOS" })
  const [verPedidos, setVerPedidos] = useState(POR_PAGINA)
  const [verCerradas, setVerCerradas] = useState(POR_PAGINA)

  const accesoPerdido = useCallback((status?: number, estado?: string) => {
    if (status === 401 || estado === "sin_sesion") router.replace(nav.loginHref)
    else if (estado === "area_no_habilitada") router.replace(nav.homeHref)
    else setError("«Recibir mercadería» no está disponible en este momento.")
  }, [router, nav.loginHref, nav.homeHref])

  const cargar = useCallback(async () => {
    try {
      const [{ recepciones }, ped, prods] = await Promise.all([
        leerJson<{ recepciones: FilaRecepcion[] }>(`${base}/recepciones`),
        leerJson<{ pedidos: PedidoParaRecibir[]; permisoAnticipo?: PermisoAnticipo }>(`${base}/recepciones-datos?pedidos=1`),
        ctx ? Promise.resolve(null) : leerJson<{ negocio: { id: string; nombre: string }; empleado: { id: string } }>(`${base}/productos`),
      ])
      if (prods) setCtx({ negocioId: prods.negocio.id, empleadoId: prods.empleado.id, negocioNombre: prods.negocio.nombre })
      setLista(recepciones)
      setPedidos(ped.pedidos)
      setPermiso(ped.permisoAnticipo ?? { habilitado: false })
    } catch (e) {
      const err = e as { status?: number; estado?: string }
      accesoPerdido(err.status, err.estado)
    }
  }, [base, ctx, accesoPerdido])
  useEffect(() => {
    let vigente = true
    // la carga corre en el callback de una promesa (nunca setState sincrónico dentro del efecto)
    void Promise.resolve().then(() => { if (vigente) void cargar() })
    return () => { vigente = false }
  }, [cargar])

  useEffect(() => {
    if (vista.modo !== "ver") return
    let cancelado = false
    leerJson<{ recepcion: RecepcionDetalle }>(`${base}/recepciones/${vista.id}`).then((r) => { if (!cancelado) setDetalle(r.recepcion) }).catch(() => setError("No se pudo abrir la recepción."))
    return () => { cancelado = true }
  }, [vista, base])

  const scope = ctx ? `operativo:${ctx.empleadoId}:${ctx.negocioId}` : "operativo"
  const editorProps = useMemo(() => ({
    scope,
    catalogoUrl: `${base}/recepciones-datos?catalogo=1`,
    cargarDatos: () => leerJson<DatosRecepcion>(`${base}/recepciones-datos`),
    compraUrl: (id: string) => `${base}/recepciones-datos?compraId=${encodeURIComponent(id)}`,
    crearUrl: `${base}/recepciones`,
    recepcionUrl: (id: string) => `${base}/recepciones/${encodeURIComponent(id)}`,
    accionUrl: (id: string, accion: string) => `${base}/recepciones/${encodeURIComponent(id)}/${accion}`,
    permiteEnviar: true,
  }), [scope, base])

  const grupos = useMemo(() => {
    const l = lista ?? []
    return {
      borradores: l.filter((r) => r.estado === "BORRADOR"),
      enviadas: l.filter((r) => r.estado === "PENDIENTE_APROBACION"),
      cerradas: l.filter((r) => ["APROBADA", "RECHAZADA", "DESCARTADA"].includes(r.estado)),
    }
  }, [lista])

  const proveedoresDePedidos = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of pedidos ?? []) m.set(p.proveedor.id, p.proveedor.nombre)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [pedidos])

  const pedidosFiltrados = useMemo(() => {
    const t = normalizar(filtro.texto.trim().replace(/^n[°º]?\s*/i, ""))
    return (pedidos ?? []).filter((p) => {
      if (filtro.estado === "ACTIVOS" ? cerrado(p.estado) : filtro.estado === "COMPLETADO" ? !cerrado(p.estado) : p.estado !== filtro.estado) return false
      if (filtro.proveedorId && p.proveedor.id !== filtro.proveedorId) return false
      if (!t) return true
      return String(p.numero) === t || normalizar(p.proveedor.nombre).includes(t) || p.lineas.some((l) => normalizar(`${l.producto} ${l.variante ?? ""}`).includes(t))
    })
  }, [pedidos, filtro])

  const volverALista = (texto?: string) => { setVista({ modo: "lista" }); setMensaje(texto ?? null); setRecienEnviada(null); void cargar() }
  const enviada = (id: string) => { setRecienEnviada(id); setDetalle(null); setVista({ modo: "ver", id }); void cargar() }
  const recibirPedido = (p: PedidoParaRecibir) => {
    setMensaje(null)
    setRecienEnviada(null)
    if (p.borradorPropio) setVista({ modo: "ver", id: p.borradorPropio.id })
    else setVista({ modo: "pedido", compraId: p.id })
  }

  return (
    <main className="min-h-screen bg-background" style={{ paddingBottom: PADDING_INFERIOR }}>
      <div className="mx-auto w-full max-w-3xl space-y-3 p-3 sm:p-4">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label="Volver a Caja">
            <Link href={`${nav.homeHref}/${encodeURIComponent(slug)}/caja`}><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 truncate text-base font-bold"><PackageCheck className="h-4 w-4 shrink-0" />Recibir mercadería</h1>
            {ctx && <p className="truncate text-xs text-muted-foreground">{ctx.negocioNombre}</p>}
          </div>
          {vista.modo === "lista" && <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Actualizar" onClick={() => void cargar()}><RefreshCw className="h-4 w-4" /></Button>}
        </header>

        {error && <p role="alert" className="rounded-2xl border p-4 text-center text-sm">{error}</p>}
        {mensaje && vista.modo === "lista" && <p role="status" className="rounded-xl bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">{mensaje}</p>}

        {vista.modo === "lista" && lista && pedidos && (
          <>
            <section className="space-y-2 rounded-2xl border p-3" aria-label="Pedidos por recibir">
              <h2 className="text-sm font-semibold">Pedidos por recibir ({pedidos.filter((p) => !cerrado(p.estado)).length})</h2>
              <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input aria-label="Buscar pedido" placeholder="N° de pedido, proveedor o producto" value={filtro.texto} onChange={(e) => { setVerPedidos(POR_PAGINA); setFiltro((x) => ({ ...x, texto: e.target.value })) }} className="h-11 rounded-xl pl-9" />
                </div>
                <select aria-label="Filtrar por proveedor" className={SEL} value={filtro.proveedorId} onChange={(e) => { setVerPedidos(POR_PAGINA); setFiltro((x) => ({ ...x, proveedorId: e.target.value })) }}>
                  <option value="">Todos los proveedores</option>
                  {proveedoresDePedidos.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
                </select>
                <select aria-label="Filtrar por estado" className={SEL} value={filtro.estado} onChange={(e) => { setVerPedidos(POR_PAGINA); setFiltro((x) => ({ ...x, estado: e.target.value as typeof filtro.estado })) }}>
                  <option value="ACTIVOS">Para recibir (todos)</option>
                  <option value="PENDIENTE">Por recibir</option>
                  <option value="PARCIAL">Recibidos en parte</option>
                  <option value="PENDIENTE_APROBACION">Pendientes de aprobación</option>
                  <option value="COMPLETADO">Completados o cerrados</option>
                </select>
              </div>
              {pedidosFiltrados.length === 0 && <p className="px-1 text-xs text-muted-foreground">{pedidos.length === 0 ? "El dueño todavía no cargó pedidos." : "Ningún pedido con ese filtro."}</p>}
              <ul className="space-y-2">
                {pedidosFiltrados.slice(0, verPedidos).map((p) => <TarjetaPedido key={p.id} p={p} onRecibir={() => recibirPedido(p)} anticipo={permiso.habilitado && p.estadoCompra === "ABIERTA" ? { permiso, url: `${base}/pedidos/${encodeURIComponent(p.id)}/anticipo-efectivo`, onHecho: () => void cargar() } : null} />)}
              </ul>
              {pedidosFiltrados.length > verPedidos && <Button variant="ghost" className="min-h-11 w-full rounded-xl" onClick={() => setVerPedidos((n) => n + POR_PAGINA)}>Ver más pedidos ({pedidosFiltrados.length - verPedidos})</Button>}
              <div className="border-t pt-2">
                <Button variant="outline" className="min-h-11 w-full rounded-xl sm:w-auto" onClick={() => { setMensaje(null); setVista({ modo: "nueva" }) }}><Plus className="mr-1 h-4 w-4" />Llegó mercadería sin pedido</Button>
              </div>
            </section>
            <Grupo titulo="Borradores para completar" filas={grupos.borradores} vacio="No tenés recepciones empezadas." onAbrir={(id) => setVista({ modo: "ver", id })} />
            <Grupo titulo="Enviadas · pendientes de aprobación" filas={grupos.enviadas} vacio="Nada esperando aprobación." onAbrir={(id) => setVista({ modo: "ver", id })} />
            <Grupo titulo="Recepciones cerradas" filas={grupos.cerradas.slice(0, verCerradas)} total={grupos.cerradas.length} vacio="Todavía no hay recepciones cerradas." onAbrir={(id) => setVista({ modo: "ver", id })} />
            {grupos.cerradas.length > verCerradas && <Button variant="ghost" className="min-h-11 w-full rounded-xl" onClick={() => setVerCerradas((n) => n + POR_PAGINA)}>Ver más ({grupos.cerradas.length - verCerradas})</Button>}
          </>
        )}
        {vista.modo === "lista" && (!lista || !pedidos) && !error && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {vista.modo === "nueva" && ctx && (
          <RecepcionEditor key="nueva" {...editorProps} detalle={null} sinPedido
            onGuardado={(r) => setVista({ modo: "ver", id: r.id })}
            onEnviado={enviada}
            onCancelar={() => volverALista()} />
        )}

        {vista.modo === "pedido" && ctx && (
          <RecepcionEditor key={`pedido:${vista.compraId}`} {...editorProps} detalle={null} compraInicial={vista.compraId}
            onGuardado={(r) => setVista({ modo: "ver", id: r.id })}
            onEnviado={enviada}
            onCancelar={() => volverALista()} />
        )}

        {vista.modo === "ver" && detalle && detalle.id === vista.id && (
          detalle.estado === "BORRADOR"
            ? (
              <>
                <RecepcionEditor key={`${detalle.id}:${detalle.version}`} {...editorProps} detalle={detalle}
                  onGuardado={() => undefined}
                  onEnviado={enviada}
                  onCancelar={() => volverALista()} />
                <RecepcionPagoEfectivo pagosUrl={`${base}/recepciones/${encodeURIComponent(detalle.id)}/pagos`} egresosUrl={`${base}/egresos`} recepcion={{ numero: detalle.numero, proveedorNombre: detalle.proveedor.nombre, comprobante: [detalle.comprobante.tipo, detalle.comprobante.numero].filter(Boolean).join(" ") || null }} />
              </>
            )
            : <ResumenCajero detalle={detalle} base={base} recienEnviada={recienEnviada === detalle.id} onVolver={() => volverALista()} />
        )}
      </div>
    </main>
  )
}

type CandidatoParecido = { tipo: string; importe: number; fecha: string; medio?: string | null; pedido?: number | null; caja?: string | null }
/** Pagos parecidos (mismo proveedor, importe y fechas cercanas): se muestran para decidir; nunca se asume duplicado. */
function AvisoParecidos({ parecidos, numero, esOtro, setEsOtro }: { parecidos: CandidatoParecido[]; numero: number; esOtro: boolean; setEsOtro: (v: boolean) => void }) {
  return (
    <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="alert" data-testid="aviso-pago-parecido">
      <p className="font-medium">Hay un pago parecido de este proveedor (mismo importe, fechas cercanas):</p>
      <ul className="list-disc pl-4">{parecidos.map((c, i) => <li key={i}>{c.tipo === "PAGO_DECLARADO" ? (c.medio === "TRANSFERENCIA" ? "Transferencia del dueño" : "Pago del dueño (otro medio)") : "Efectivo de Caja"} · {formatoArs(c.importe)} · {new Date(c.fecha).toLocaleDateString("es-AR")}{c.pedido ? (c.pedido === numero ? " · de ESTE pedido" : ` · del pedido N° ${c.pedido} (otro pedido)`) : " · sin pedido"}</li>)}</ul>
      <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={esOtro} onChange={(e) => setEsOtro(e.target.checked)} /><span>Es otro pago diferente (no es el mismo dinero).</span></label>
    </div>
  )
}

type PermisoAnticipo = { habilitado: false } | { habilitado: true; limiteOperacion: number; limiteDiario: number; usadoHoy: number }

/** Pagos E3: anticipo en efectivo del pedido desde el turno PROPIO del cajero, dentro de sus límites. */
function AnticipoEfectivo({ permiso, url, numero, onHecho }: { permiso: Extract<PermisoAnticipo, { habilitado: true }>; url: string; numero: number; onHecho: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [importe, setImporte] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const [estado, setEstado] = useState<{ enviando: boolean; msg: string | null; ok: boolean }>({ enviando: false, msg: null, ok: false })
  const [clave, setClave] = useState<{ cuerpo: string; key: string } | null>(null)
  // Posible duplicado (F5): pagos parecidos del mismo proveedor; registrar exige confirmar que es otro pago.
  const [parecidos, setParecidos] = useState<CandidatoParecido[] | null>(null)
  const [esOtro, setEsOtro] = useState(false)
  const disponibleHoy = Math.max(Math.round((permiso.limiteDiario - permiso.usadoHoy) * 100) / 100, 0)
  const registrar = async () => {
    const p = parseImporteArs(importe)
    if (!p.ok || Number(p.valor) <= 0) return setEstado({ enviando: false, msg: "Escribí el importe.", ok: false })
    if (!confirmo) return setEstado({ enviando: false, msg: "Confirmá que entregaste ese efectivo de tu caja.", ok: false })
    if (parecidos && !esOtro) return setEstado({ enviando: false, msg: "Confirmá que es otro pago diferente.", ok: false })
    const enviar = { importe: p.valor, ...(parecidos && esOtro ? { confirmoNoDuplicado: true } : {}) }
    const cuerpo = JSON.stringify(enviar)
    const key = clave && clave.cuerpo === cuerpo ? clave.key : newIdempotencyKey()
    setClave({ cuerpo, key })
    setEstado({ enviando: true, msg: null, ok: false })
    const r = await enviarJson(url, "POST", enviar, key)
    if (!r.ok) {
      if (!r.incierto) setClave(null)
      if (r.code === "POSIBLE_PAGO_DUPLICADO") { setParecidos(((r.detalle as { candidatos?: CandidatoParecido[] } | undefined)?.candidatos) ?? []); setEsOtro(false); return setEstado({ enviando: false, msg: null, ok: false }) }
      return setEstado({ enviando: false, msg: r.code === "TURNO_REQUERIDO" || r.code === "TURNO_NO_DISPONIBLE" ? "Necesitás tu turno de Caja abierto." : r.error, ok: false })
    }
    setClave(null); setImporte(""); setConfirmo(false); setAbierto(false); setParecidos(null); setEsOtro(false)
    setEstado({ enviando: false, msg: `Anticipo registrado: ${formatoArs(Number(p.valor))} salieron de tu caja, una sola vez, para el pedido N° ${numero}.`, ok: true })
    onHecho()
  }
  return (
    <div className="space-y-2" data-testid="anticipo-efectivo">
      {estado.ok && estado.msg && <p role="status" className="text-xs text-emerald-800 dark:text-emerald-200">{estado.msg}</p>}
      {!abierto ? <Button variant="outline" className="min-h-11 w-full rounded-xl sm:w-auto" onClick={() => { setEstado({ enviando: false, msg: null, ok: false }); setAbierto(true) }}>Pagar anticipo en efectivo</Button> : (
        <div className="space-y-2 rounded-xl border p-2 text-sm">
          <p className="text-xs text-muted-foreground">Sale de tu caja (tu turno abierto). Tu límite: {formatoArs(permiso.limiteOperacion)} por pago · te quedan {formatoArs(disponibleHoy)} hoy.</p>
          <label className="block space-y-1 font-medium" htmlFor={`ant-${numero}`}><span>Importe ($)</span><Input id={`ant-${numero}`} inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} className="h-11 rounded-xl" /></label>
          <label className="flex min-h-11 items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} /><span>Entregué ese efectivo de mi caja al proveedor como anticipo de este pedido.</span></label>
          {parecidos && <AvisoParecidos parecidos={parecidos} numero={numero} esOtro={esOtro} setEsOtro={setEsOtro} />}
          {!estado.ok && estado.msg && <p role="alert" className="text-xs text-rose-700">{estado.msg}</p>}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-xl" disabled={estado.enviando || (parecidos !== null && !esOtro)} onClick={() => void registrar()}>{estado.enviando ? "Registrando…" : "Registrar anticipo"}</Button>
            <Button variant="ghost" className="min-h-11 rounded-xl" disabled={estado.enviando} onClick={() => setAbierto(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function TarjetaPedido({ p, onRecibir, anticipo }: { p: PedidoParaRecibir; onRecibir: () => void; anticipo: { permiso: PermisoAnticipo; url: string; onHecho: () => void } | null }) {
  const e = ESTADO_PEDIDO[p.estado]
  const completado = cerrado(p.estado)
  return (
    <li className="space-y-2 rounded-xl border p-3" data-testid="pedido-por-recibir">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Pedido N° {p.numero} · {p.proveedor.nombre}</span>
        <span className={cn("rounded px-1.5 py-0.5 text-xs", e.clase)}>{e.texto}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {p.productos} {p.productos === 1 ? "producto" : "productos"} · pedido el {fechaCorta(p.fechaPedido)} · aceptado {num(p.avance.aceptado)} de {num(p.avance.pedido)}{p.avance.pendiente > 0 ? ` · faltan ${num(p.avance.pendiente)}` : ""}
      </p>
      {p.pagoAnticipado && p.pagoAnticipado.confirmado > 0 && <p className="rounded-lg bg-violet-50 p-2 text-xs font-medium text-violet-950 dark:bg-violet-950/40 dark:text-violet-100" data-testid="aviso-pago-anticipado">Ya se pagaron {formatoArs(p.pagoAnticipado.confirmado)} por adelantado de este pedido. No vuelvas a pagarlo al recibir.</p>}
      {p.pagoAnticipado && p.pagoAnticipado.programado > 0 && <p className="text-xs text-muted-foreground">Hay una transferencia del dueño programada de {formatoArs(p.pagoAnticipado.programado)} para este pedido.</p>}
      {p.recepcionesEnviadas > 0 && <p className="text-xs text-sky-800 dark:text-sky-200">Hay {p.recepcionesEnviadas === 1 ? "una recepción enviada" : `${p.recepcionesEnviadas} recepciones enviadas`} esperando aprobación: no vuelvas a cargar esa mercadería.</p>}
      {!completado && anticipo && anticipo.permiso.habilitado && <AnticipoEfectivo permiso={anticipo.permiso} url={anticipo.url} numero={p.numero} onHecho={anticipo.onHecho} />}
      {!completado && (
        <Button className="min-h-11 w-full rounded-xl sm:w-auto" onClick={onRecibir}>
          {p.borradorPropio ? `Continuar recepción N° ${p.borradorPropio.numero}` : p.estado === "PENDIENTE" ? "Recibir pedido" : "Recibir lo que falta"}
        </Button>
      )}
    </li>
  )
}

function Grupo({ titulo, filas, total, vacio, onAbrir }: { titulo: string; filas: FilaRecepcion[]; total?: number; vacio: string; onAbrir: (id: string) => void }) {
  return (
    <section className="space-y-2" aria-label={titulo}>
      <h2 className="px-1 text-sm font-semibold">{titulo} ({total ?? filas.length})</h2>
      {filas.length === 0 && <p className="px-1 text-xs text-muted-foreground">{vacio}</p>}
      <ul className="space-y-2">
        {filas.map((r) => (
          <li key={r.id}>
            <button onClick={() => onAbrir(r.id)} className={cn("flex min-h-14 w-full flex-col gap-1 rounded-xl border p-3 text-left hover:bg-muted/40", fueDevuelta(r) && "border-amber-400")}>
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">Recepción N° {r.numero} · {r.proveedor.nombre}</span>
                <span className={cn("rounded px-1.5 py-0.5 text-xs", ESTADO_RECEPCION[r.estado]?.clase)}>{fueDevuelta(r) ? "Devuelta para corregir" : ESTADO_RECEPCION[r.estado]?.texto ?? r.estado}</span>
              </span>
              <span className="text-xs text-muted-foreground">{r.lineas} productos{r.compra ? ` · Pedido N° ${r.compra.numero}` : " · sin pedido"}{r.comprobante ? ` · ${r.comprobante}` : ""}</span>
              {r.ultimaObservacion?.motivo && (r.estado === "RECHAZADA" || fueDevuelta(r)) && <span className="break-words text-xs text-amber-800 dark:text-amber-200">Motivo: {r.ultimaObservacion.motivo}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

const EVENTO_RECEPCION: Record<string, string> = { ENVIO: "Enviada", DEVOLUCION_A_BORRADOR: "Devuelta para corregir", APROBACION: "Aprobada", RECHAZO: "Rechazada", DESCARTE: "Descartada" }

function ResumenCajero({ detalle, base, recienEnviada, onVolver }: { detalle: RecepcionDetalle; base: string; recienEnviada: boolean; onVolver: () => void }) {
  const motivo = detalle.estado === "RECHAZADA" ? detalle.motivoRechazo : null
  return (
    <div className="space-y-3">
      {recienEnviada && detalle.estado === "PENDIENTE_APROBACION" && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" data-testid="recepcion-enviada">Recepción enviada · Pendiente de aprobación</p>
      )}
      <div className="space-y-1 rounded-2xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Recepción N° {detalle.numero}</h2>
          <span className={cn("rounded px-1.5 py-0.5 text-xs", ESTADO_RECEPCION[detalle.estado]?.clase)}>{ESTADO_RECEPCION[detalle.estado]?.texto ?? detalle.estado}</span>
        </div>
        <p className="text-sm">{detalle.proveedor.nombre}{detalle.compra ? ` · Pedido N° ${detalle.compra.numero}` : " · sin pedido"}</p>
        {motivo && <p role="status" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">El dueño la rechazó: «{motivo}». Si pagaste en efectivo, ese pago sigue registrado y el dueño lo resuelve aparte.</p>}
        {detalle.estado === "PENDIENTE_APROBACION" && <p className="text-xs text-muted-foreground">Ya está enviada: no hace falta enviarla de nuevo. El dueño la revisa y, si necesita cambios, te la devuelve con el motivo.</p>}
      </div>
      <ul className="space-y-2" aria-label="Productos de la recepción">
        {detalle.lineas.map((l) => (
          <li key={l.id} className="rounded-xl border p-2 text-sm">
            <p className="break-words font-medium">{l.producto}{l.variante ? ` — ${l.variante}` : ""}</p>
            <p className="text-xs text-muted-foreground">Llegó {num(l.cantidadRecibida)} · aceptado {num(l.cantidadAceptada)}{l.cantidadRechazada > 0 ? ` · no aceptado ${num(l.cantidadRechazada)} (${MOTIVOS_RECHAZO[l.motivoRechazo ?? ""] ?? l.motivoRechazo})` : ""}</p>
          </li>
        ))}
      </ul>
      {detalle.estado !== "DESCARTADA" && <RecepcionPagoEfectivo pagosUrl={`${base}/recepciones/${encodeURIComponent(detalle.id)}/pagos`} egresosUrl={`${base}/egresos`} permitePagar={detalle.estado === "PENDIENTE_APROBACION"} recepcion={{ numero: detalle.numero, proveedorNombre: detalle.proveedor.nombre, comprobante: [detalle.comprobante.tipo, detalle.comprobante.numero].filter(Boolean).join(" ") || null }} />}
      <ol className="space-y-1 text-xs text-muted-foreground" aria-label="Historial">
        {detalle.historial.map((h, i) => <li key={i}>{new Date(h.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })} · {EVENTO_RECEPCION[h.tipo] ?? h.tipo} · {h.actorNombre}{h.motivo ? ` · ${h.motivo}` : ""}</li>)}
      </ol>
      <Button variant="outline" className="min-h-11 rounded-xl" onClick={onVolver}>Volver a la lista</Button>
    </div>
  )
}
