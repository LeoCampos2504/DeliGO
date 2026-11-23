"use client"

// ============================================
// F10-C2b — dueño: «Compras» (bandeja de recepciones, aprobación, pedidos e impuestos)
// ============================================
// Rutas del DUEÑO de F10-C2a (/api/negocio/recepciones*, /api/negocio/compras*). La aprobación es
// del servidor y atómica (stock R3A + costos + UNA deuda en F5 + anticipos opcionales); esta pantalla
// sólo muestra la vista previa con el estado actual, pide confirmar explícitamente los importes, los
// excedentes y las diferencias de costo, y envía la versión que el dueño vio (si cambió, 409 y se
// vuelve a revisar). Cada acción lleva una Idempotency-Key estable por contenido. Los pagos en
// efectivo hechos al recibir (D-7) aparecen como «pagos de Caja sin vincular» con la referencia de
// la recepción: vincularlos usa F5 (nunca crea otro movimiento) y quedan como anticipos aplicables.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, Link2, Plus, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { cn } from "@/lib/utils"
import { formatoArs, parseImporteArs } from "@/components/business/caja-salidas-cajero"
import {
  ESTADO_RECEPCION,
  MOTIVOS_RECHAZO,
  enviarJson,
  leerJson,
  parseCantidad,
  RecepcionEditor,
  type DatosRecepcion,
  type FilaRecepcion,
  type ProductoCatalogo,
  type RecepcionDetalle,
} from "@/components/business/recepcion-editor"
import { esReferenciaDeRecepcion } from "@/components/business/recepcion-pago-efectivo"

// Espacio inferior: el último control queda siempre por encima del botón flotante del chat (que en el panel del dueño ocupa hasta ~136 px desde abajo) y del aviso de instalación PWA.
const RESERVA_AVISO_INSTALACION = "calc(max(9.5rem, var(--deligo-install-prompt-h, 0px) + 1rem) + env(safe-area-inset-bottom, 0px))"
const SEL = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
export const comprasQueryKey = (negocioId: string) => ["negocio-compras", negocioId] as const

// ---------------------------------------------------------------------------
// Tipos de la vista previa (API del dueño)
// ---------------------------------------------------------------------------

export type VistaPrevia = {
  recepcionId: string; version: number; estado: string; tratamientoImpuestos: string
  lineas: Array<{ id: string; orden: number; producto: string; variante: string | null; aceptada: number; rechazada: number; controlStock: boolean | null; subtotal: number; descuentoLinea: number; descuentoGlobal: number; neto: number; impuestos: number; percepcion: number; cargos: number; costoInventarioTotal: number; costoUnitarioInventario: number | null }>
  totales: { neto: number; descuentos: number; impuestos: number; percepciones: number; cargosMismoProveedor: number; cargosInventario: number; totalObligacion: number; costoInventarioTotal: number }
  cargosConObligacionPropia: Array<{ id: string; concepto: string; proveedorId: string; proveedor: string; importe: number; gasto: boolean }>
  excedentes: Array<{ orden: number; producto: string; compraLineaId: string | null; pedido: number | null; yaRecibido: number | null; pendiente: number | null; aceptadaAhora: number; excedente: number }>
  diferenciasCosto: Array<{ orden: number; producto: string; costoNeto: number; referencia: number; origenReferencia: string; diferenciaPct: number }>
  umbralDiferenciaCostoPct: number
  problemas: Array<{ code: string; error: string }>
  anticiposDisponibles: Array<{ creditoId: string; origen: string; medio: string | null; referencia: string | null; fecha: string; importe: number; disponible: number }>
  /** D-7 v2: pagos en efectivo hechos al recibir, asociados a ESTA recepción (se aplican solos al aprobar). */
  pagosRecepcion?: PagoRecepcionVista[]
  resumenPagos?: { totalMercaderia: number; pagado: number; seAplica: number; anticiposPedido?: number; saldoPendiente: number; anticipo: number }
  /** Pagos de Caja viejos que sólo mencionan la recepción en el texto: se asocian con un toque. */
  pagosSugeridos?: Array<{ egresoCajaId: string; importe: number; fecha: string; proveedorNombre: string | null; caja: string | null; mismoProveedor: boolean }>
  /** Pagos E1: pagos anticipados del pedido (transferencias del dueño) y cuánto se aplica a esta recepción. */
  anticiposPedido?: null | { resumen: ResumenPagosPedido; pagos: PagoPedido[]; seAplica: number }
  /** Pedido con total informado (referencia comercial): comparación en la misma base, con o sin IVA. */
  /** Precios de venta: propuesta que conserva el recargo actual sobre el costo (opcional al aprobar). */
  preciosVenta?: PropuestaPrecioVista[]
  totalPedido?: null | { numero: number; totalInformado: number; iva: string; base: "CON_IVA" | "SIN_IVA"; estaRecepcion: number; aprobadasAntes: number; recepcionesAprobadas: number; acumulado: number; diferencia: number; excede: boolean; entregaCompleta: boolean }
}
export type PropuestaPrecioVista = {
  clave: string; productoId: string; productoVarianteId: string | null; producto: string; variante: string | null; descuentoActivo: boolean
  estado: "PROPUESTO" | "SIN_COSTO_ANTERIOR" | "PRECIO_BAJO_COSTO" | "SIN_PRECIO" | "SIN_CAMBIO_DE_COSTO" | "HAY_UNA_RECEPCION_MAS_RECIENTE"
  costoAnterior: number | null; costoNuevo: number; precioActual: number | null; recargoPct: number | null; precioPropuesto: string | null; diferencia: number | null
  /** F10-C2c: precio que se cobra hoy y, si hay, el precio autorizado que todavía espera su etiqueta. */
  precioVigente?: number | null; etiquetaPendiente?: number | null
}
const MOTIVO_SIN_PROPUESTA: Record<string, string> = {
  SIN_COSTO_ANTERIOR: "Sin costo anterior: no hay recargo para conservar. Definí el precio desde el producto.",
  PRECIO_BAJO_COSTO: "El precio actual es menor al costo anterior: no se calcula solo (revisalo desde el producto).",
  SIN_PRECIO: "Sin precio de venta cargado.",
  SIN_CAMBIO_DE_COSTO: "El costo no cambió: el precio queda igual.",
  HAY_UNA_RECEPCION_MAS_RECIENTE: "Hay una recepción más reciente de este producto: no se toca su costo ni su precio.",
}
/** Lo que se envía al aprobar: sólo los precios elegidos, con el precio propuesto que el dueño vio. */
export const seleccionDePrecios = (propuestas: ReadonlyArray<PropuestaPrecioVista> | undefined, elegidos: ReadonlySet<string>, sinEtiqueta: ReadonlySet<string> = new Set()) =>
  (propuestas ?? []).filter((x) => x.estado === "PROPUESTO" && x.precioPropuesto && elegidos.has(x.clave)).map((x) => ({ clave: x.clave, precioPropuesto: x.precioPropuesto!, ...(sinEtiqueta.has(x.clave) ? { modo: "SIN_ETIQUETA" as const } : {}) }))

export const IVA_TOTAL_INFORMADO: Record<string, string> = { INCLUYE_IVA: "incluye IVA", SIN_IVA: "sin IVA", NO_SE_SABE: "no se sabe si incluye IVA" }
export type PagoRecepcionVista = {
  id: string; egresoCajaId: string; origen: string; estadoVinculo: string; estado: "SE_APLICA" | "OBSERVADO" | "ANULADO_EN_CAJA" | "DE_OTRO_PROVEEDOR" | "SIN_DISPONIBLE" | "ACREDITADO"
  observacion: string | null; importe: number; disponible: number; fecha: string; cajero: string; caja: string | null; turnoCajaId: string | null; turnoAbiertoEn: string | null
}
const ESTADO_PAGO: Record<PagoRecepcionVista["estado"], string> = {
  SE_APLICA: "Se aplica al aprobar", OBSERVADO: "Observado: no se aplica", ANULADO_EN_CAJA: "Anulado en Caja: no se aplica",
  DE_OTRO_PROVEEDOR: "Vinculado a otro proveedor: no se aplica", SIN_DISPONIBLE: "Ya usado en otra deuda", ACREDITADO: "Aplicado",
}
type PagoCaja = { id: string; importe: number; motivo: string; proveedorNombre: string | null; comprobante: string | null; createdAt: string; registradoPor: string; caja: string }

// ---------------------------------------------------------------------------
// Helpers puros (exportados para tests)
// ---------------------------------------------------------------------------

const horasDesde = (iso: string | null | undefined, ahora = Date.now()) => (iso ? (ahora - new Date(iso).getTime()) / 3_600_000 : 0)
/** Prioridad visual en la bandeja: más de 48 h → alta, más de 24 h → media. */
export function prioridadPendiente(enviadaEn: string | null | undefined, ahora = Date.now()): "alta" | "media" | "normal" {
  const h = horasDesde(enviadaEn, ahora)
  return h > 48 ? "alta" : h > 24 ? "media" : "normal"
}
export function antiguedad(iso: string | null | undefined, ahora = Date.now()): string {
  const h = horasDesde(iso, ahora)
  if (h < 1) return "hace menos de 1 h"
  if (h < 24) return `hace ${Math.floor(h)} h`
  const d = Math.floor(h / 24)
  return `hace ${d} ${d === 1 ? "día" : "días"}`
}

/** Cuerpo de la aprobación: lo que el dueño vio (versión) y confirmó, sin nada implícito. */
export function cuerpoAprobacion(v: Pick<VistaPrevia, "version" | "tratamientoImpuestos" | "excedentes" | "diferenciasCosto"> & { totalPedido?: VistaPrevia["totalPedido"]; anticiposPedido?: VistaPrevia["anticiposPedido"] }, o: { confirmoExcedentes: boolean; confirmoDiferencias: boolean; anticipos: Record<string, string>; confirmoNoDuplicado?: boolean; confirmoTotalPedido?: boolean; actualizarPrecios?: Array<{ clave: string; precioPropuesto: string }> }) {
  const aplicar: Array<{ creditoId: string; importe: string }> = []
  for (const [creditoId, texto] of Object.entries(o.anticipos)) {
    if (!texto.trim()) continue
    const p = parseImporteArs(texto)
    if (!p.ok) return { ok: false as const, error: `Anticipo: ${p.error}` }
    aplicar.push({ creditoId, importe: p.valor })
  }
  return {
    ok: true as const,
    body: {
      version: v.version, tratamientoImpuestos: v.tratamientoImpuestos,
      ...(v.excedentes.length ? { confirmoExcedentes: o.confirmoExcedentes } : {}),
      ...(v.diferenciasCosto.length ? { confirmoDiferenciasCosto: o.confirmoDiferencias } : {}),
      ...(aplicar.length ? { aplicarAnticipos: aplicar } : {}),
      ...(o.confirmoNoDuplicado ? { confirmoNoDuplicado: true } : {}),
      ...(v.totalPedido?.excede ? { confirmoTotalPedido: o.confirmoTotalPedido === true } : {}),
      // Pagos E1: lo que la revisión mostró de los anticipos del pedido; si cambió, el servidor exige revisar de nuevo.
      ...(v.anticiposPedido?.seAplica ? { anticipoPedidoEsperado: v.anticiposPedido.seAplica.toFixed(2) } : {}),
      ...(o.actualizarPrecios?.length ? { actualizarPrecios: o.actualizarPrecios } : {}),
    },
  }
}

/** ¿Se puede aprobar? Problemas bloquean; excedentes y diferencias exigen su confirmación; los importes siempre. */
export function puedeAprobar(v: Pick<VistaPrevia, "problemas" | "excedentes" | "diferenciasCosto"> & { totalPedido?: VistaPrevia["totalPedido"] }, o: { confirmoImportes: boolean; confirmoExcedentes: boolean; confirmoDiferencias: boolean; confirmoTotalPedido?: boolean }) {
  if (v.problemas.length) return false
  if (v.totalPedido?.excede && !o.confirmoTotalPedido) return false
  if (v.excedentes.length && !o.confirmoExcedentes) return false
  if (v.diferenciasCosto.length && !o.confirmoDiferencias) return false
  return o.confirmoImportes
}

/** Pagos de Caja sin vincular que mencionan ESTA recepción (D-7). */
export const pagosDeLaRecepcion = (pagos: ReadonlyArray<PagoCaja>, numero: number) => pagos.filter((p) => esReferenciaDeRecepcion(p.comprobante, numero))

// ---------------------------------------------------------------------------
// Acción idempotente
// ---------------------------------------------------------------------------

function useAccion() {
  const claves = useRef(new Map<string, string>())
  const enCurso = useRef(false)
  const [estado, setEstado] = useState<{ enviando: boolean; error: string | null; code?: string; detalle?: Record<string, unknown> }>({ enviando: false, error: null })
  const ejecutar = async (url: string, body: unknown, onOk: (json: Record<string, any>) => void, method: "POST" | "PUT" = "POST") => {
    if (enCurso.current) return
    enCurso.current = true
    const canonico = `${method} ${url} ${JSON.stringify(body)}`
    let key = claves.current.get(canonico)
    if (!key) { key = newIdempotencyKey(); claves.current.set(canonico, key) }
    setEstado({ enviando: true, error: null })
    const r = await enviarJson(url, method, body, key)
    enCurso.current = false
    if (r.ok) { claves.current.delete(canonico); setEstado({ enviando: false, error: null }); onOk(r.json); return }
    if (!r.incierto) claves.current.delete(canonico)
    setEstado({ enviando: false, error: r.error, code: r.code, detalle: r.detalle })
  }
  return { ...estado, ejecutar, limpiar: () => setEstado({ enviando: false, error: null }) }
}

const fecha = (iso: string | null | undefined, hora = true) => (iso ? new Date(iso).toLocaleString("es-AR", hora ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }) : "—")
const num = (n: number | null | undefined) => (n === null || n === undefined ? "—" : String(n).replace(".", ","))

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

type Pestana = "bandeja" | "recepciones" | "pedidos" | "impuestos"

export function OwnerCompras({ negocioId, onVerProveedor }: { negocioId: string; onVerProveedor?: (proveedorId: string) => void }) {
  const [pestana, setPestana] = useState<Pestana>("bandeja")
  const [abierta, setAbierta] = useState<{ tipo: "recepcion"; id: string } | { tipo: "nueva" } | { tipo: "pedido"; id: string } | { tipo: "nuevoPedido" } | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const qc = useQueryClient()
  const lista = useQuery({ queryKey: [...comprasQueryKey(negocioId), "recepciones"], queryFn: () => leerJson<{ recepciones: Array<FilaRecepcion & { preparadaPorNombre: string; enviadaEn: string | null; totalObligacion: number | null }> }>("/api/negocio/recepciones") })
  const refrescar = useCallback(() => {
    void qc.invalidateQueries({ queryKey: comprasQueryKey(negocioId) })
    void qc.invalidateQueries({ queryKey: ["negocio-proveedores", negocioId] })
  }, [qc, negocioId])
  const pendientes = useMemo(() => (lista.data?.recepciones ?? []).filter((r) => r.estado === "PENDIENTE_APROBACION").sort((a, b) => (a.enviadaEn ?? "").localeCompare(b.enviadaEn ?? "")), [lista.data])
  const cerrar = (texto?: string) => { setAbierta(null); setMensaje(texto ?? null); refrescar() }

  return (
    <section className="space-y-3" aria-labelledby="compras-titulo" style={{ paddingBottom: RESERVA_AVISO_INSTALACION }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 id="compras-titulo" className="flex items-center gap-1.5 text-base font-semibold"><ClipboardList className="h-4 w-4" />Compras y recepciones</h3>
          <p className="text-xs text-muted-foreground">La mercadería entra al stock y a la deuda con el proveedor sólo cuando aprobás la recepción.</p>
        </div>
        {!abierta && <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Actualizar" onClick={refrescar}><RefreshCw className="h-4 w-4" /></Button>}
      </div>
      {mensaje && !abierta && <p role="status" className="flex items-start gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{mensaje}</p>}

      {!abierta && (
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1" role="tablist" aria-label="Secciones de compras">
          {([["bandeja", `Por aprobar${pendientes.length ? ` (${pendientes.length})` : ""}`], ["recepciones", "Recepciones"], ["pedidos", "Pedidos"], ["impuestos", "Impuestos"]] as const).map(([k, t]) => (
            <button key={k} role="tab" aria-selected={pestana === k} onClick={() => setPestana(k)} className={cn("min-h-11 flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-semibold", pestana === k ? "bg-background text-primary shadow-sm" : "text-muted-foreground")}>{t}</button>
          ))}
        </div>
      )}

      {!abierta && pestana === "bandeja" && (
        <div className="space-y-2" aria-label="Recepciones por aprobar">
          {lista.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
          {lista.data && pendientes.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No hay recepciones esperando aprobación.</p>}
          <ul className="space-y-2">
            {pendientes.map((r) => {
              const pr = prioridadPendiente(r.enviadaEn)
              return (
                <li key={r.id}>
                  <button onClick={() => { setMensaje(null); setAbierta({ tipo: "recepcion", id: r.id }) }} className={cn("flex min-h-14 w-full flex-col gap-1 rounded-xl border p-3 text-left hover:bg-muted/40", pr === "alta" && "border-rose-400", pr === "media" && "border-amber-400")} data-prioridad={pr}>
                    <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">N° {r.numero} · {r.proveedor.nombre}</span><span className={cn("rounded px-1.5 py-0.5 text-xs", pr === "alta" ? "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-100" : pr === "media" ? "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "bg-muted")}>Enviada {antiguedad(r.enviadaEn)}</span></span>
                    <span className="text-xs text-muted-foreground">{r.lineas} productos · preparó {r.preparadaPorNombre}{r.compra ? ` · Pedido N° ${r.compra.numero}` : ""}{r.comprobante ? ` · ${r.comprobante}` : ""}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {!abierta && pestana === "recepciones" && <ListaRecepciones filas={lista.data?.recepciones ?? []} onAbrir={(id) => { setMensaje(null); setAbierta({ tipo: "recepcion", id }) }} onNueva={() => { setMensaje(null); setAbierta({ tipo: "nueva" }) }} />}
      {!abierta && pestana === "pedidos" && <ListaPedidos negocioId={negocioId} onAbrir={(id) => setAbierta({ tipo: "pedido", id })} onNuevo={() => setAbierta({ tipo: "nuevoPedido" })} />}
      {!abierta && pestana === "impuestos" && <><ConfigImpuestos /><PermisosAnticipos /></>}

      {abierta?.tipo === "nueva" && (
        <RecepcionEditor {...editorDueno(negocioId)} detalle={null} onGuardado={(r) => setAbierta({ tipo: "recepcion", id: r.id })} onCancelar={() => cerrar()} />
      )}
      {abierta?.tipo === "recepcion" && <RevisionRecepcion key={abierta.id} negocioId={negocioId} recepcionId={abierta.id} onCerrar={cerrar} onCambio={refrescar} onVerProveedor={onVerProveedor} />}
      {abierta?.tipo === "nuevoPedido" && <FormPedido onCerrar={cerrar} />}
      {abierta?.tipo === "pedido" && <DetallePedido compraId={abierta.id} onCerrar={cerrar} onAbrirRecepcion={(id) => setAbierta({ tipo: "recepcion", id })} />}
    </section>
  )
}

function editorDueno(negocioId: string) {
  return {
    scope: `negocio:${negocioId}`,
    catalogoUrl: "/api/negocio/compras/catalogo",
    cargarDatos: async (): Promise<DatosRecepcion> => {
      const [p, c] = await Promise.all([
        leerJson<{ proveedores: Array<{ id: string; nombre: string; activo: boolean }> }>("/api/negocio/proveedores"),
        leerJson<{ compras: Array<{ id: string; numero: number; proveedor: { id: string }; fechaPedido: string }> }>("/api/negocio/compras?estado=ABIERTA"),
      ])
      return { proveedores: p.proveedores.filter((x) => x.activo).map((x) => ({ id: x.id, nombre: x.nombre })), comprasAbiertas: c.compras.map((x) => ({ id: x.id, numero: x.numero, proveedorId: x.proveedor.id, fechaPedido: x.fechaPedido })) }
    },
    compraUrl: (id: string) => `/api/negocio/compras/${encodeURIComponent(id)}`,
    crearUrl: "/api/negocio/recepciones",
    recepcionUrl: (id: string) => `/api/negocio/recepciones/${encodeURIComponent(id)}`,
    accionUrl: (id: string, accion: string) => `/api/negocio/recepciones/${encodeURIComponent(id)}/${accion}`,
    permiteEnviar: false,
  }
}

function ListaRecepciones({ filas, onAbrir, onNueva }: { filas: Array<FilaRecepcion & { preparadaPorNombre: string; totalObligacion: number | null }>; onAbrir: (id: string) => void; onNueva: () => void }) {
  const [estado, setEstado] = useState("")
  const visibles = filas.filter((r) => !estado || r.estado === estado)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button className="min-h-11 rounded-xl" onClick={onNueva}><Plus className="mr-1 h-4 w-4" />Nueva recepción</Button>
        <select aria-label="Filtrar por estado" className={cn(SEL, "w-auto min-w-40 flex-1")} value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_RECEPCION).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}
        </select>
      </div>
      {visibles.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">No hay recepciones.</p>}
      <ul className="space-y-2" aria-label="Recepciones">
        {visibles.map((r) => (
          <li key={r.id}>
            <button onClick={() => onAbrir(r.id)} className="flex min-h-14 w-full flex-col gap-1 rounded-xl border p-3 text-left hover:bg-muted/40">
              <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">N° {r.numero} · {r.proveedor.nombre}</span><span className={cn("rounded px-1.5 py-0.5 text-xs", ESTADO_RECEPCION[r.estado]?.clase)}>{ESTADO_RECEPCION[r.estado]?.texto ?? r.estado}</span></span>
              <span className="text-xs text-muted-foreground">{fecha(r.fechaRecepcion, false)} · {r.lineas} productos · preparó {r.preparadaPorNombre}{r.totalObligacion ? ` · deuda ${formatoArs(r.totalObligacion)}` : ""}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Revisión y aprobación
// ---------------------------------------------------------------------------

function RevisionRecepcion({ negocioId, recepcionId, onCerrar, onCambio, onVerProveedor }: { negocioId: string; recepcionId: string; onCerrar: (texto?: string) => void; onCambio?: () => void; onVerProveedor?: (id: string) => void }) {
  const [detalle, setDetalle] = useState<RecepcionDetalle | null>(null)
  const [vista, setVista] = useState<VistaPrevia | null>(null)
  const [vistaError, setVistaError] = useState<string | null>(null)
  const [tratamiento, setTratamiento] = useState<string | null>(null)
  const [editar, setEditar] = useState(false)
  const [modo, setModo] = useState<"revisar" | "devolver" | "rechazar">("revisar")
  const [motivo, setMotivo] = useState("")
  const [confirmos, setConfirmos] = useState({ confirmoImportes: false, confirmoExcedentes: false, confirmoDiferencias: false, confirmoTotalPedido: false })
  const [anticipos, setAnticipos] = useState<Record<string, string>>({})
  const [confirmoNoDuplicado, setConfirmoNoDuplicado] = useState(false)
  const [preciosElegidos, setPreciosElegidos] = useState<Set<string>>(new Set())
  // F10-C2c: precios elegidos que se activan al aprobar (sin etiqueta física / sólo online); el resto espera la etiqueta.
  const [sinEtiqueta, setSinEtiqueta] = useState<Set<string>>(new Set())
  const [aprobada, setAprobada] = useState<{ obligacionId: string | null; etiquetas: number; activados: number } | null>(null)
  const accion = useAccion()

  const cargar = useCallback(async (t: string | null = tratamiento) => {
    try {
      const { recepcion } = await leerJson<{ recepcion: RecepcionDetalle }>(`/api/negocio/recepciones/${recepcionId}`)
      setDetalle(recepcion)
      setVista(null)
      setVistaError(null)
      if (recepcion.estado === "BORRADOR" || recepcion.estado === "PENDIENTE_APROBACION") {
        try {
          const { vistaPrevia } = await leerJson<{ vistaPrevia: VistaPrevia }>(`/api/negocio/recepciones/${recepcionId}/vista-previa${t ? `?tratamientoImpuestos=${t}` : ""}`)
          setVista(vistaPrevia)
        } catch (e) {
          setVistaError((e as Error).message)
        }
      }
      setConfirmos({ confirmoImportes: false, confirmoExcedentes: false, confirmoDiferencias: false, confirmoTotalPedido: false })
      setPreciosElegidos(new Set())
      setSinEtiqueta(new Set())
    } catch {
      setVistaError("No se pudo abrir la recepción.")
    }
  }, [recepcionId, tratamiento])
  useEffect(() => {
    let vigente = true
    // la carga corre en el callback de una promesa (nunca setState sincrónico dentro del efecto)
    void Promise.resolve().then(() => { if (vigente) void cargar() })
    return () => { vigente = false }
  }, [cargar])
  // Pagos E1: si los anticipos del pedido cambiaron desde esta revisión, el servidor rechaza y se recarga la vista previa.
  const codigoAccion = accion.code
  useEffect(() => {
    if (codigoAccion !== "PAGOS_PEDIDO_CAMBIARON") return
    void Promise.resolve().then(() => cargar())
  }, [codigoAccion, cargar])

  if (!detalle) return <p className="text-sm text-muted-foreground">{vistaError ?? "Cargando…"}</p>
  if (editar) {
    return <RecepcionEditor {...editorDueno(negocioId)} detalle={detalle} onGuardado={() => undefined} onCancelar={() => { setEditar(false); void cargar() }} />
  }
  const abierta = detalle.estado === "BORRADOR" || detalle.estado === "PENDIENTE_APROBACION"
  // Un borrador del cajero todavía no fue enviado: se ve, pero se aprueba recién cuando lo envíe.
  const borradorDelCajero = detalle.estado === "BORRADOR" && detalle.preparadaPor.tipo === "EMPLEADO"
  const totalAnticipos = Object.values(anticipos).reduce((s, t) => { const p = parseImporteArs(t); return s + (p.ok ? Number(p.valor) : 0) }, 0)
  const seAplicaEfectivo = vista?.resumenPagos?.seAplica ?? 0
  const seAplicaPedido = vista?.resumenPagos?.anticiposPedido ?? vista?.anticiposPedido?.seAplica ?? 0
  const seAplicaSolo = Math.round((seAplicaEfectivo + seAplicaPedido) * 100) / 100
  const quedaParaManual = Math.max((vista?.totales.totalObligacion ?? 0) - seAplicaSolo, 0)
  const aprobar = () => {
    if (!vista) return
    const seleccion = seleccionDePrecios(vista.preciosVenta, preciosElegidos, sinEtiqueta)
    const c = cuerpoAprobacion(vista, { ...confirmos, anticipos, confirmoNoDuplicado, actualizarPrecios: seleccion })
    if (!c.ok) return
    void accion.ejecutar(`/api/negocio/recepciones/${recepcionId}/aprobacion`, c.body, (json) => { setAprobada({ obligacionId: json.obligacionId ?? null, etiquetas: seleccion.filter((x) => !("modo" in x)).length, activados: seleccion.filter((x) => "modo" in x).length }); onCambio?.() })
  }

  if (aprobada) {
    return (
      <div className="space-y-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100" role="status" data-testid="aprobada">
        <p className="flex items-center gap-1.5 font-semibold"><CheckCircle2 className="h-5 w-5" />Recepción N° {detalle.numero} aprobada</p>
        <p className="text-sm">El stock ya se actualizó y la deuda con {detalle.proveedor.nombre} quedó registrada una sola vez en su cuenta{vista ? ` (${formatoArs(vista.totales.totalObligacion)})` : ""}.</p>
        {aprobada.etiquetas > 0 && <p className="text-sm" data-testid="aprobada-etiquetas"><strong>{aprobada.etiquetas} {aprobada.etiquetas === 1 ? "precio nuevo espera" : "precios nuevos esperan"} el cambio de etiqueta.</strong> Hasta que alguien confirme la etiqueta en «Etiquetas», se sigue cobrando el precio anterior.</p>}
        {aprobada.activados > 0 && <p className="text-sm">{aprobada.activados} {aprobada.activados === 1 ? "precio nuevo ya se cobra" : "precios nuevos ya se cobran"} (sin etiqueta física).</p>}
        <div className="flex flex-wrap gap-2">
          {onVerProveedor && <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => onVerProveedor(detalle.proveedor.id)}>Ver cuenta del proveedor</Button>}
          <Button className="min-h-11 rounded-xl" onClick={() => onCerrar(`Recepción N° ${detalle.numero} aprobada.`)}>Volver a la bandeja</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3" aria-label={`Recepción N° ${detalle.numero}`}>
      <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => onCerrar()}><ArrowLeft className="mr-1 h-4 w-4" />Compras</Button>
      <div className="space-y-1 rounded-2xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Recepción N° {detalle.numero}</h3>
          <span className={cn("rounded px-1.5 py-0.5 text-xs", ESTADO_RECEPCION[detalle.estado]?.clase)}>{ESTADO_RECEPCION[detalle.estado]?.texto}</span>
        </div>
        <p className="text-sm">{detalle.proveedor.nombre}{detalle.compra ? ` · Pedido N° ${detalle.compra.numero}` : " · compra directa"}</p>
        <p className="text-xs text-muted-foreground">Recibida {fecha(detalle.fechaRecepcion, false)} · preparó {detalle.preparadaPor.nombre}{detalle.comprobante.numero ? ` · ${[detalle.comprobante.tipo, detalle.comprobante.numero].filter(Boolean).join(" ")}` : " · sin comprobante"}</p>
        {onVerProveedor && <Button variant="link" className="h-auto min-h-11 px-0 text-sm" onClick={() => onVerProveedor(detalle.proveedor.id)}>Ver cuenta del proveedor</Button>}
      </div>

      {vistaError && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{vistaError}</p>}

      {abierta && vista && (
        <>
          {vista.problemas.length > 0 && (
            <div role="alert" className="space-y-1 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100" data-testid="problemas">
              <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" />No se puede aprobar todavía</p>
              <ul className="list-disc pl-5">{vista.problemas.map((p, i) => <li key={i}>{p.error}</li>)}</ul>
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl border">
            <table className="w-full min-w-[34rem] text-sm" aria-label="Productos y costos">
              <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="p-2 text-left">Producto</th><th className="p-2 text-right">Acept.</th><th className="p-2 text-right">Neto</th><th className="p-2 text-right">Impuestos</th><th className="p-2 text-right">Cargos</th><th className="p-2 text-right">Costo unit.</th></tr></thead>
              <tbody>
                {vista.lineas.map((l) => (
                  <tr key={l.id} className="border-t align-top">
                    <td className="p-2"><span className="break-words">{l.producto}{l.variante ? ` — ${l.variante}` : ""}</span>{l.rechazada > 0 && <span className="block text-xs text-amber-800 dark:text-amber-200">Rechazado {num(l.rechazada)}</span>}{l.controlStock === false && <span className="block text-xs text-muted-foreground">Sin control de stock</span>}</td>
                    <td className="p-2 text-right tabular-nums">{num(l.aceptada)}</td>
                    <td className="p-2 text-right tabular-nums">{formatoArs(l.neto)}</td>
                    <td className="p-2 text-right tabular-nums">{formatoArs(l.impuestos + l.percepcion)}</td>
                    <td className="p-2 text-right tabular-nums">{formatoArs(l.cargos)}</td>
                    <td className="p-2 text-right font-medium tabular-nums">{l.costoUnitarioInventario === null ? "—" : formatoArs(l.costoUnitarioInventario)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Totales">
            <Dato t="Neto" v={formatoArs(vista.totales.neto)} />
            <Dato t="Descuentos" v={formatoArs(vista.totales.descuentos)} />
            <Dato t="Impuestos y percepciones" v={formatoArs(vista.totales.impuestos + vista.totales.percepciones)} />
            <Dato t="Cargos del proveedor" v={formatoArs(vista.totales.cargosMismoProveedor)} />
            <div className="col-span-2 sm:col-span-4"><Dato t={`Deuda que se registra con ${detalle.proveedor.nombre}`} v={formatoArs(vista.totales.totalObligacion)} destacado /></div>
          </div>
          {vista.cargosConObligacionPropia.length > 0 && (
            <div className="rounded-xl border p-3 text-sm"><p className="font-medium">Cargos con su propia deuda</p>
              <ul className="mt-1 space-y-1 text-xs">{vista.cargosConObligacionPropia.map((c) => <li key={c.id}>{c.concepto} · {c.proveedor} · {formatoArs(c.importe)}{c.gasto ? " · gasto (no va al costo)" : ""}</li>)}</ul></div>
          )}
          <label className="block space-y-1 text-sm font-medium" htmlFor="rev-tratamiento"><span>Impuestos en el costo</span>
            <select id="rev-tratamiento" className={SEL} value={vista.tratamientoImpuestos} onChange={(e) => { setTratamiento(e.target.value); void cargar(e.target.value) }}>
              <option value="IMPUESTOS_INTEGRAN_COSTO">El IVA integra el costo (no lo recupero)</option>
              <option value="IMPUESTOS_RECUPERABLES">El IVA no integra el costo (lo recupero)</option>
            </select>
          </label>

          {vista.excedentes.length > 0 && (
            <div className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" data-testid="excedentes">
              <p className="font-semibold">Se aceptó más de lo pendiente del pedido</p>
              <ul className="list-disc pl-5 text-xs">{vista.excedentes.map((x, i) => <li key={i}>{x.producto}: {x.compraLineaId ? `pendiente ${num(x.pendiente)}, aceptado ${num(x.aceptadaAhora)} (+${num(x.excedente)})` : `no estaba en el pedido (${num(x.aceptadaAhora)})`}</li>)}</ul>
              <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmos.confirmoExcedentes} onChange={(e) => setConfirmos((c) => ({ ...c, confirmoExcedentes: e.target.checked }))} /><span>Confirmo que se recibe y se debe esa cantidad extra.</span></label>
            </div>
          )}
          {vista.diferenciasCosto.length > 0 && (
            <div className="space-y-1 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" data-testid="diferencias">
              <p className="font-semibold">Costos que difieren más de {vista.umbralDiferenciaCostoPct}% de la referencia</p>
              <ul className="list-disc pl-5 text-xs">{vista.diferenciasCosto.map((x, i) => <li key={i}>{x.producto}: {formatoArs(x.costoNeto)} contra {formatoArs(x.referencia)} ({x.origenReferencia === "PEDIDO" ? "pedido" : x.origenReferencia === "ULTIMA_RECEPCION" ? "última recepción" : "costo del producto"}) · {num(x.diferenciaPct)}%</li>)}</ul>
              <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmos.confirmoDiferencias} onChange={(e) => setConfirmos((c) => ({ ...c, confirmoDiferencias: e.target.checked }))} /><span>Revisé esos costos y son correctos.</span></label>
            </div>
          )}

          {vista.totalPedido && (() => {
            const t = vista.totalPedido
            const base = t.base === "CON_IVA" ? "con IVA" : "sin IVA"
            return (
              <div className={cn("space-y-2 rounded-xl border p-3 text-sm", t.excede ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/30" : "border-sky-200 dark:border-sky-800")} data-testid="total-pedido-comparacion">
                <p className="font-medium">Total informado al hacer el pedido N° {t.numero}: {formatoArs(t.totalInformado)} ({IVA_TOTAL_INFORMADO[t.iva] ?? t.iva})</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Dato t={`Esta recepción (${base})`} v={formatoArs(t.estaRecepcion)} />
                  <Dato t={`Recepciones aprobadas antes (${t.recepcionesAprobadas})`} v={formatoArs(t.aprobadasAntes)} />
                  <Dato t="Acumulado del pedido" v={formatoArs(t.acumulado)} destacado />
                </div>
                {t.iva === "NO_SE_SABE" && <p className="text-xs text-muted-foreground">Como no se sabía si el total incluía IVA, se compara sin IVA (lo más favorable al proveedor).</p>}
                {t.excede
                  ? <p className="text-xs font-medium text-amber-900 dark:text-amber-200">Lo facturado supera el total informado por {formatoArs(t.diferencia)}. No es un error del sistema: revisá la factura y confirmá abajo.</p>
                  : t.entregaCompleta
                    ? <p className="text-xs">Con esta recepción se completa el pedido. Diferencia contra lo informado: {formatoArs(t.diferencia)}.</p>
                    : <p className="text-xs text-muted-foreground">Entrega parcial: todavía faltan productos, así que un acumulado menor al total no es un incumplimiento.</p>}
                {t.excede && (
                  <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmos.confirmoTotalPedido} onChange={(e) => setConfirmos((c) => ({ ...c, confirmoTotalPedido: e.target.checked }))} /><span>Revisé la diferencia con el total informado y la factura es correcta.</span></label>
                )}
              </div>
            )
          })()}

          {(vista.preciosVenta ?? []).length > 0 && (() => {
            const lista = vista.preciosVenta ?? []
            const propuestos = lista.filter((x) => x.estado === "PROPUESTO")
            const elegidos = propuestos.filter((x) => preciosElegidos.has(x.clave)).length
            const alternar = (clave: string) => setPreciosElegidos((sel) => { const n = new Set(sel); if (n.has(clave)) n.delete(clave); else n.add(clave); return n })
            return (
              <div className="space-y-2 rounded-xl border border-emerald-200 p-3 text-sm dark:border-emerald-800" data-testid="precios-venta">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">Actualización de precios de venta</p>
                  {propuestos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setPreciosElegidos(new Set(propuestos.map((x) => x.clave)))}>Actualizar todos ({propuestos.length})</Button>
                      <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => { setPreciosElegidos(new Set()); setSinEtiqueta(new Set()) }}>Ninguno</Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Opcional. Se conserva el recargo que hoy tiene cada producto sobre su costo. Si no elegís ninguno, igual se aprueba: entra el stock, se actualiza el costo y la deuda, y los precios de venta quedan como están.</p>
                <p className="text-xs text-muted-foreground">Los precios que elijas quedan <strong>pendientes de cambio de etiqueta</strong>: se sigue cobrando el precio anterior hasta que alguien cambie la etiqueta de góndola y la confirme. Si el producto no tiene etiqueta física o se vende sólo online, desmarcá «Esperar la etiqueta» y se activa al aprobar.</p>
                <ul className="space-y-2">
                  {lista.map((x) => {
                    const puede = x.estado === "PROPUESTO"
                    return (
                      <li key={x.clave} className={cn("rounded-lg border p-2", puede && preciosElegidos.has(x.clave) && "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30", !puede && "bg-muted/40")} data-testid="precio-venta">
                        <label className={cn("flex items-start gap-2", puede && "cursor-pointer")}>
                          {puede ? <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={preciosElegidos.has(x.clave)} onChange={() => alternar(x.clave)} aria-label={`Actualizar el precio de ${x.producto}${x.variante ? ` ${x.variante}` : ""}`} /> : <span className="mt-1 h-4 w-4 shrink-0" />}
                          <span className="min-w-0 flex-1 space-y-0.5">
                            <span className="block break-words font-medium">{x.producto}{x.variante ? ` — ${x.variante}` : ""}</span>
                            <span className="block text-xs text-muted-foreground">Costo {x.costoAnterior !== null ? formatoArs(x.costoAnterior) : "—"} → {formatoArs(x.costoNuevo)} · precio actual {x.precioVigente != null ? formatoArs(x.precioVigente) : x.precioActual !== null ? formatoArs(x.precioActual) : "—"}{x.recargoPct !== null ? ` · recargo ${num(x.recargoPct)} %` : ""}</span>
                            {x.etiquetaPendiente != null && <span className="block text-xs text-amber-900 dark:text-amber-200">Ya hay un precio autorizado de {formatoArs(x.etiquetaPendiente)} esperando su etiqueta: el recargo se calcula sobre ese precio y, si actualizás, esa etiqueta queda reemplazada.</span>}
                            {puede && x.precioPropuesto
                              ? <span className="block">Nuevo precio: <strong className="tabular-nums">{formatoArs(Number(x.precioPropuesto))}</strong> <span className={cn("text-xs", (x.diferencia ?? 0) >= 0 ? "text-emerald-800 dark:text-emerald-200" : "text-rose-700")}>({(x.diferencia ?? 0) >= 0 ? "+" : ""}{formatoArs(x.diferencia ?? 0)})</span></span>
                              : <span className="block text-xs text-amber-900 dark:text-amber-200">{MOTIVO_SIN_PROPUESTA[x.estado] ?? x.estado}</span>}
                            {puede && x.descuentoActivo && <span className="block text-xs text-muted-foreground">Tiene un descuento activo: no se toca (se sigue aplicando sobre el precio nuevo).</span>}
                          </span>
                        </label>
                        {puede && preciosElegidos.has(x.clave) && (
                          <label className="ml-6 mt-1 flex min-h-11 items-center gap-2 text-xs">
                            <input type="checkbox" className="h-4 w-4" checked={!sinEtiqueta.has(x.clave)} onChange={() => setSinEtiqueta((sel) => { const n = new Set(sel); if (n.has(x.clave)) n.delete(x.clave); else n.add(x.clave); return n })} aria-label={`Esperar el cambio de etiqueta de ${x.producto}${x.variante ? ` ${x.variante}` : ""}`} />
                            <span>{sinEtiqueta.has(x.clave) ? "Se activa al aprobar (sin etiqueta física / sólo online)." : "Esperar la etiqueta: se activa cuando alguien confirme que la cambió."}</span>
                          </label>
                        )}
                      </li>
                    )
                  })}
                </ul>
                {propuestos.length > 0 && <p className="text-xs">{elegidos === 0 ? "No se actualiza ningún precio de venta." : `Se ${elegidos === 1 ? "autoriza 1 precio" : `autorizan ${elegidos} precios`} de venta: ${propuestos.filter((x) => preciosElegidos.has(x.clave) && !sinEtiqueta.has(x.clave)).length} esperan la etiqueta y ${propuestos.filter((x) => preciosElegidos.has(x.clave) && sinEtiqueta.has(x.clave)).length} se activan al aprobar.`}</p>}
              </div>
            )
          })()}

          {vista.anticiposPedido && (
            <div className="space-y-1 rounded-xl border border-violet-200 p-3 text-sm dark:border-violet-800" data-testid="anticipos-pedido">
              <p className="font-medium">Pagos anticipados del pedido</p>
              <p className="text-xs">Transferencias realizadas: {formatoArs(vista.anticiposPedido.resumen.confirmado)} · ya aplicado a otras recepciones del pedido: {formatoArs(vista.anticiposPedido.resumen.aplicado)} · disponible: {formatoArs(vista.anticiposPedido.resumen.disponible)}</p>
              <p className="text-xs"><strong>Al aprobar se aplica solo a esta factura: {formatoArs(vista.anticiposPedido.seAplica)}</strong>{vista.anticiposPedido.resumen.disponible - vista.anticiposPedido.seAplica > 0.004 ? ` · quedan ${formatoArs(Math.round((vista.anticiposPedido.resumen.disponible - vista.anticiposPedido.seAplica) * 100) / 100)} a favor para las próximas entregas del pedido` : ""}.</p>
              {vista.anticiposPedido.resumen.programado > 0 && <p className="text-xs text-muted-foreground">Hay {formatoArs(vista.anticiposPedido.resumen.programado)} en transferencias programadas: no se aplican hasta marcarlas como hechas.</p>}
            </div>
          )}

          {vista.resumenPagos && (
            <div className="space-y-2 rounded-xl border border-violet-200 p-3 text-sm dark:border-violet-800" data-testid="pagos-al-recibir">
              <div className="grid gap-2 sm:grid-cols-3" data-testid="resumen-saldo">
                <Dato t="Total de mercadería (deuda bruta)" v={formatoArs(vista.resumenPagos.totalMercaderia)} />
                <Dato t="Efectivo pagado al recibir" v={formatoArs(vista.resumenPagos.seAplica)} />
                <Dato t="Anticipos del pedido que se aplican" v={formatoArs(seAplicaPedido)} />
                {totalAnticipos > 0 && <Dato t="Otros pagos aplicados (casos especiales)" v={formatoArs(totalAnticipos)} />}
                <Dato t="Saldo pendiente estimado después de aprobar" v={formatoArs(Math.max(Math.round((vista.resumenPagos.totalMercaderia - seAplicaSolo - totalAnticipos) * 100) / 100, 0))} destacado />
              </div>
              <p className="text-xs text-muted-foreground">La deuda se registra por el total ({formatoArs(vista.resumenPagos.totalMercaderia)}); los pagos se aplican sobre ella en la misma aprobación, sin otro movimiento de dinero.</p>
              {vista.resumenPagos.anticipo > 0 && <p className="text-xs">El pago supera la mercadería: {formatoArs(vista.resumenPagos.anticipo)} quedan a favor (anticipo del proveedor).</p>}
              {(vista.pagosRecepcion ?? []).length === 0 && <p className="text-xs text-muted-foreground">No se registraron pagos en efectivo al recibir esta mercadería.</p>}
              {(vista.pagosRecepcion ?? []).map((p) => <PagoAsociado key={p.id} pago={p} recepcionId={recepcionId} onCambio={() => void cargar()} />)}
              {(vista.pagosRecepcion ?? []).length > 0 && <p className="text-xs text-muted-foreground">Al aprobar, el pago se aplica solo a esta deuda (sin otro movimiento de dinero). Si algo no cierra, observalo: deja de aplicarse y la salida de Caja no se toca.</p>}
              {(vista.pagosSugeridos ?? []).length > 0 && (
                <div className="space-y-1 rounded-lg bg-muted/40 p-2" data-testid="pagos-sugeridos">
                  <p className="text-xs font-medium">Pagos de Caja que mencionan esta recepción pero no están asociados</p>
                  {(vista.pagosSugeridos ?? []).map((x) => <PagoSugerido key={x.egresoCajaId} pago={x} recepcionId={recepcionId} onAsociado={() => void cargar()} />)}
                </div>
              )}
            </div>
          )}

          {vista.anticiposDisponibles.length > 0 && (
            <details className="space-y-2 rounded-xl border p-3 text-sm" aria-label="Anticipos disponibles">
              <summary className="min-h-11 cursor-pointer py-2 font-medium">Casos especiales: aplicar otros pagos o anticipos del proveedor</summary>
              <p className="text-xs text-muted-foreground">Sólo para pagos anteriores, sin recepción o que cubren varias facturas. Queda para aplicar: {formatoArs(quedaParaManual)}.</p>
              {vista.anticiposDisponibles.map((a) => (
                <label key={a.creditoId} htmlFor={`ant-${a.creditoId}`} className="grid items-center gap-2 sm:grid-cols-[1fr_9rem]">
                  <span className="text-xs">{a.origen === "PAGO_CAJA" ? "Pago de Caja" : a.origen === "PAGO_DECLARADO" ? `Pago por ${a.medio?.toLowerCase().replace("_", " ") ?? "otro medio"}` : "Ajuste a favor"} · {fecha(a.fecha, false)}{a.referencia ? ` · ${a.referencia}` : ""} · disponible {formatoArs(a.disponible)}</span>
                  <Input id={`ant-${a.creditoId}`} inputMode="decimal" placeholder="0,00" value={anticipos[a.creditoId] ?? ""} onChange={(e) => setAnticipos((x) => ({ ...x, [a.creditoId]: e.target.value }))} className="h-11 rounded-xl" />
                </label>
              ))}
              {totalAnticipos > quedaParaManual && <p className="text-xs text-rose-700">Supera lo que queda de la deuda después del pago en efectivo.</p>}
            </details>
          )}

          {borradorDelCajero && (
            <p role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" data-testid="borrador-no-enviado">
              {detalle.preparadaPor.nombre} todavía está cargando esta recepción (borrador sin enviar). Cuando la envíe aparece en «Por aprobar» y la podés aprobar.
            </p>
          )}
          {modo === "revisar" && !borradorDelCajero && (
            <div className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-3" data-testid="confirmacion-aprobacion">
              <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmos.confirmoImportes} onChange={(e) => setConfirmos((c) => ({ ...c, confirmoImportes: e.target.checked }))} />
                <span>Revisé productos, importes y pagos: se suma el stock aceptado y se registra una deuda de <strong>{formatoArs(vista.totales.totalObligacion)}</strong>{seAplicaSolo + totalAnticipos > 0 ? <>, de la que se cancelan <strong>{formatoArs(seAplicaSolo + totalAnticipos)}</strong> con lo ya pagado; queda pendiente <strong>{formatoArs(Math.max(vista.totales.totalObligacion - seAplicaSolo - totalAnticipos, 0))}</strong></> : ""}.</span></label>
              {(accion.code === "POSIBLE_PAGO_DUPLICADO" || confirmoNoDuplicado) && (
                <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmoNoDuplicado} onChange={(e) => setConfirmoNoDuplicado(e.target.checked)} /><span>El pago en efectivo y el pago declarado parecido son pagos distintos (no es un duplicado).</span></label>
              )}
              {accion.error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{accion.error}{accion.code === "VERSION_CAMBIADA" && <> <button className="underline" onClick={() => { accion.limpiar(); void cargar() }}>Ver la versión actual</button></>}</p>}
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11 rounded-xl" disabled={accion.enviando || !puedeAprobar(vista, confirmos) || totalAnticipos > quedaParaManual} onClick={aprobar}>{accion.enviando ? "Aprobando…" : "Aprobar recepción"}</Button>
                {detalle.estado === "BORRADOR" && <Button variant="outline" className="min-h-11 rounded-xl" disabled={accion.enviando} onClick={() => setEditar(true)}>Editar</Button>}
                {detalle.estado === "PENDIENTE_APROBACION" && <Button variant="outline" className="min-h-11 rounded-xl" disabled={accion.enviando} onClick={() => { accion.limpiar(); setModo("devolver") }}>Devolver para corregir</Button>}
                <Button variant="ghost" className="min-h-11 rounded-xl text-rose-700" disabled={accion.enviando} onClick={() => { accion.limpiar(); setModo("rechazar") }}>Rechazar</Button>
              </div>
            </div>
          )}
          {modo !== "revisar" && (
            <div className="space-y-2 rounded-2xl border p-3" data-testid="motivo-accion">
              <label className="block space-y-1 text-sm font-medium" htmlFor="rev-motivo"><span>{modo === "devolver" ? "¿Qué hay que corregir?" : "Motivo del rechazo"}</span><Textarea id="rev-motivo" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded-xl" /></label>
              <p className="text-xs text-muted-foreground">{modo === "devolver" ? "Vuelve a borrador para quien la preparó, con este motivo. No se mueve nada." : "No entra stock ni se registra deuda. Si hubo un pago en efectivo al recibir, sigue registrado y lo tratás aparte."}</p>
              {accion.error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{accion.error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button className="min-h-11 rounded-xl" disabled={accion.enviando || !motivo.trim()} onClick={() => void accion.ejecutar(`/api/negocio/recepciones/${recepcionId}/${modo === "devolver" ? "devolucion" : "rechazo"}`, { version: detalle.version, motivo: motivo.trim() }, () => onCerrar(modo === "devolver" ? `Recepción N° ${detalle.numero} devuelta para corregir.` : `Recepción N° ${detalle.numero} rechazada.`))}>{modo === "devolver" ? "Devolver" : "Rechazar"}</Button>
                <Button variant="ghost" className="min-h-11 rounded-xl" disabled={accion.enviando} onClick={() => setModo("revisar")}>Volver</Button>
              </div>
            </div>
          )}
        </>
      )}

      {!abierta && (
        <div className="space-y-2">
          {detalle.totalesAprobacion && <Dato t="Deuda registrada" v={formatoArs(detalle.totalesAprobacion.totalObligacion)} destacado />}
          {detalle.estado === "RECHAZADA" && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">Rechazada: «{detalle.motivoRechazo}».</p>}
          <ul className="space-y-1" aria-label="Productos">
            {detalle.lineas.map((l) => <li key={l.id} className="rounded-xl border p-2 text-sm"><span className="break-words font-medium">{l.producto}{l.variante ? ` — ${l.variante}` : ""}</span><span className="block text-xs text-muted-foreground">Aceptado {num(l.cantidadAceptada)}{l.cantidadRechazada > 0 ? ` · rechazado ${num(l.cantidadRechazada)} (${MOTIVOS_RECHAZO[l.motivoRechazo ?? ""] ?? l.motivoRechazo})` : ""}{l.aprobacion?.costoUnitarioInventario != null ? ` · costo unitario ${formatoArs(l.aprobacion.costoUnitarioInventario)}` : ""}</span></li>)}
          </ul>
        </div>
      )}

      <div>
        <p className="text-sm font-semibold">Historial</p>
        <ol className="mt-1 space-y-1" aria-label="Historial de la recepción">
          <li className="rounded-lg bg-muted/40 p-2 text-xs">Preparada por {detalle.preparadaPor.nombre}</li>
          {detalle.historial.map((h, i) => <li key={i} className="rounded-lg bg-muted/40 p-2 text-xs"><span className="font-medium">{{ ENVIO: "Enviada", DEVOLUCION_A_BORRADOR: "Devuelta para corregir", APROBACION: "Aprobada", RECHAZO: "Rechazada", DESCARTE: "Descartada" }[h.tipo] ?? h.tipo}</span> · {h.actorNombre} · {fecha(h.createdAt)}{h.motivo ? ` · «${h.motivo}»` : ""}</li>)}
        </ol>
      </div>
    </div>
  )
}

/** Un pago real asociado: cajero, fecha y hora, caja y turno de origen; el dueño sólo lo controla (u observa). */
function PagoAsociado({ pago, recepcionId, onCambio }: { pago: PagoRecepcionVista; recepcionId: string; onCambio: () => void }) {
  const accion = useAccion()
  const [observando, setObservando] = useState(false)
  const [motivo, setMotivo] = useState("")
  const url = `/api/negocio/recepciones/${recepcionId}/pagos/${pago.id}`
  const noSeAplica = pago.estado !== "SE_APLICA" && pago.estado !== "ACREDITADO"
  return (
    <div className={cn("space-y-1 rounded-lg border p-2", noSeAplica && "border-amber-300 bg-amber-50/60 dark:bg-amber-950/30")} data-testid="pago-asociado">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold tabular-nums">{formatoArs(pago.importe)} en efectivo</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{ESTADO_PAGO[pago.estado]}</span>
      </div>
      <p className="text-xs text-muted-foreground">Registró {pago.cajero} · {fecha(pago.fecha)}{pago.caja ? ` · ${pago.caja}` : ""}{pago.turnoAbiertoEn ? ` · turno abierto el ${fecha(pago.turnoAbiertoEn)}` : ""}{pago.origen === "ASOCIADO_DUENO" ? " · asociado por el dueño" : ""}</p>
      {pago.estado === "OBSERVADO" && pago.observacion && <p className="text-xs">Observación: «{pago.observacion}»</p>}
      {(pago.estado === "SE_APLICA" || pago.estado === "OBSERVADO") && !observando && (
        <Button variant="ghost" className="min-h-11 rounded-xl text-xs" disabled={accion.enviando} onClick={() => (pago.estado === "OBSERVADO" ? void accion.ejecutar(url, { accion: "incluir" }, onCambio) : setObservando(true))}>{pago.estado === "OBSERVADO" ? "Volver a aplicarlo al aprobar" : "Observar este pago"}</Button>
      )}
      {observando && (
        <div className="space-y-2">
          <label className="block space-y-1 text-xs font-medium" htmlFor={`obs-${pago.id}`}><span>¿Qué tiene de raro? (no se borra la salida de Caja)</span><Input id={`obs-${pago.id}`} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="h-11 rounded-xl" /></label>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11 rounded-xl" disabled={accion.enviando || !motivo.trim()} onClick={() => void accion.ejecutar(url, { accion: "observar", motivo: motivo.trim() }, () => { setObservando(false); onCambio() })}>Observar</Button>
            <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => setObservando(false)}>Cancelar</Button>
          </div>
        </div>
      )}
      {accion.error && <p role="alert" className="text-xs text-rose-700">{accion.error}</p>}
    </div>
  )
}

/** Pago de Caja anterior a esta versión (sólo con la referencia en texto): se asocia con un toque, sin mover dinero. */
function PagoSugerido({ pago, recepcionId, onAsociado }: { pago: NonNullable<VistaPrevia["pagosSugeridos"]>[number]; recepcionId: string; onAsociado: () => void }) {
  const accion = useAccion()
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs">{formatoArs(pago.importe)} · {fecha(pago.fecha)}{pago.caja ? ` · ${pago.caja}` : ""}{pago.proveedorNombre ? ` · ${pago.proveedorNombre}` : ""}{!pago.mismoProveedor ? " · otro nombre de proveedor" : ""}</span>
      <Button variant="outline" className="min-h-11 rounded-xl" disabled={accion.enviando} onClick={() => void accion.ejecutar(`/api/negocio/recepciones/${recepcionId}/pagos`, { egresoCajaId: pago.egresoCajaId }, onAsociado)}>{accion.enviando ? "Asociando…" : "Asociar a esta recepción"}</Button>
      {accion.error && <p role="alert" className="w-full text-xs text-rose-700">{accion.error}</p>}
    </div>
  )
}

function Dato({ t, v, destacado }: { t: string; v: string; destacado?: boolean }) {
  return <div className={cn("min-w-0 rounded-xl border p-2", destacado && "border-primary/50 bg-primary/5")}><p className="text-xs text-muted-foreground">{t}</p><p className={cn("break-words font-semibold tabular-nums", destacado && "text-lg")}>{v}</p></div>
}

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

type FilaPedido = { id: string; numero: number; estado: string; estadoRecepcion: string; proveedor: { id: string; nombre: string }; fechaPedido: string; lineas: number; totalInformado?: number | null; totalInformadoIva?: string | null }
const ESTADO_PEDIDO: Record<string, string> = { SIN_RECIBIR: "Sin recibir", PARCIAL: "Recibido en parte", COMPLETA: "Completado" }
// ---------- Pagos E1: transferencia anticipada desde el pedido ----------
export type ResumenPagosPedido = { confirmado: number; aplicado: number; disponible: number; programado: number }
export type PagoPedido = { id: string; estado: string; origen?: string; medio: string | null; importe: number; aplicado: number; disponible: number; fechaPago: string | null; referencia: string | null; nota: string | null; confirmadoEn: string | null; cerradoEn: string | null; createdAt: string }
type TipoPagoPedido = "NO" | "TOTAL" | "PARCIAL" | "PROGRAMADA"
type MedioPagoPedido = "TRANSFERENCIA" | "CAJA" | "PROPIO"
type FormPagoPedido = { tipo: TipoPagoPedido; medio: MedioPagoPedido; caja: string; justificacion: string; importe: string; fecha: string; referencia: string }
const hoyIso = () => new Date().toISOString().slice(0, 10)
const formPagoInicial = (): FormPagoPedido => ({ tipo: "NO", medio: "TRANSFERENCIA", caja: "", justificacion: "", importe: "", fecha: hoyIso(), referencia: "" })
type CajaAbierta = { cajaId: string; turnoId: string; nombre: string }
/** Pagos E3: cajas con turno abierto (mismo endpoint que «Egresos»); el efectivo sólo sale de una de ellas. */
function useCajasAbiertas() {
  return useQuery<CajaAbierta[]>({
    queryKey: ["owner-cajas-abiertas-pago-pedido"],
    queryFn: async () => {
      const r = await fetch("/api/negocio/caja/cajas", { cache: "no-store" })
      const j = (await r.json().catch(() => ({}))) as { cajas?: Array<{ id: string; nombre: string; activa: boolean; turnoAbierto: { id: string } | null }> }
      return (j.cajas ?? []).filter((c) => c.activa && c.turnoAbierto).map((c) => ({ cajaId: c.id, turnoId: c.turnoAbierto!.id, nombre: c.nombre }))
    },
  })
}
const ESTADO_PAGO_PEDIDO: Record<string, string> = { DECLARADO: "Programada (no cuenta como pagada)", CONFIRMADO_DUENO: "Realizada", RECHAZADO: "No se hizo", ANULADO: "Anulada" }
/** Cuerpo del pago del pedido (null = «No pagué»). La transferencia realizada es una declaración del dueño, no una verificación bancaria. */
export function cuerpoPagoPedido(f: FormPagoPedido, estimado: number | null): { ok: true; cuerpo: Record<string, unknown> | null; ruta: "pagos" | "anticipo-efectivo" } | { ok: false; error: string } {
  if (f.tipo === "NO") return { ok: true, cuerpo: null, ruta: "pagos" }
  const texto = f.importe.trim() || (f.tipo === "TOTAL" && estimado ? String(estimado) : "")
  const imp = parseImporteArs(texto)
  if (!imp.ok || Number(imp.valor) <= 0) return { ok: false, error: "Escribí el importe del pago." }
  const medio: MedioPagoPedido = f.tipo === "PROGRAMADA" ? "TRANSFERENCIA" : f.medio
  // Pagos E3: efectivo de Caja = salida F10-C1 de una caja con turno abierto (nunca inventada).
  if (medio === "CAJA") {
    const [cajaFisicaId, turnoCajaId] = f.caja.split("|")
    if (!cajaFisicaId || !turnoCajaId) return { ok: false, error: "Elegí la caja (con turno abierto) de la que sale el efectivo." }
    return { ok: true, ruta: "anticipo-efectivo", cuerpo: { importe: imp.valor, cajaFisicaId, turnoCajaId, ...(f.justificacion.trim() ? { justificacion: f.justificacion.trim() } : {}) } }
  }
  if (!f.fecha) return { ok: false, error: "Indicá la fecha del pago." }
  return { ok: true, ruta: "pagos", cuerpo: { realizada: f.tipo !== "PROGRAMADA", ...(medio === "PROPIO" ? { medio: "EFECTIVO_PROPIO" } : {}), importe: imp.valor, fechaPago: f.fecha, referencia: f.referencia.trim() || null } }
}
function CamposPagoPedido({ f, setF, estimado, conNoPague, pideJustificacion = false }: { f: FormPagoPedido; setF: (u: (x: FormPagoPedido) => FormPagoPedido) => void; estimado: number | null; conNoPague: boolean; pideJustificacion?: boolean }) {
  const opciones: Array<[TipoPagoPedido, string]> = [...(conNoPague ? [["NO", "No pagué"] as [TipoPagoPedido, string]] : []), ["TOTAL", "Ya pagué el total estimado"], ["PARCIAL", "Ya pagué una parte"], ["PROGRAMADA", "Transferencia programada, todavía no hecha"]]
  const cajas = useCajasAbiertas()
  const medio: MedioPagoPedido = f.tipo === "PROGRAMADA" ? "TRANSFERENCIA" : f.medio
  return (
    <div className="space-y-2" data-testid="pago-pedido">
      <fieldset className="grid gap-1 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-medium">Pago anticipado</legend>
        {opciones.map(([v, t]) => <label key={v} className={cn("flex min-h-11 items-center gap-2 rounded-xl border p-2 text-sm", f.tipo === v && "border-primary bg-primary/5")}><input type="radio" name="tipo-pago-pedido" className="h-4 w-4" checked={f.tipo === v} onChange={() => setF((x) => ({ ...x, tipo: v, importe: v === "TOTAL" && estimado ? String(estimado).replace(".", ",") : x.importe }))} />{t}</label>)}
      </fieldset>
      {f.tipo !== "NO" && f.tipo !== "PROGRAMADA" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium" htmlFor="pp-medio"><span>¿Cómo pagaste?</span>
            <select id="pp-medio" className={SEL} value={f.medio} onChange={(e) => setF((x) => ({ ...x, medio: e.target.value as MedioPagoPedido }))}>
              <option value="TRANSFERENCIA">Transferencia</option><option value="CAJA">Efectivo de una Caja</option><option value="PROPIO">Efectivo propio (no sale de la Caja)</option>
            </select>
          </label>
          {medio === "CAJA" && (
            <label className="block space-y-1 text-sm font-medium" htmlFor="pp-caja"><span>Caja de la que sale</span>
              <select id="pp-caja" className={SEL} value={f.caja} onChange={(e) => setF((x) => ({ ...x, caja: e.target.value }))}>
                <option value="">{cajas.isLoading ? "Cargando…" : (cajas.data ?? []).length ? "Elegí…" : "No hay cajas con turno abierto"}</option>
                {(cajas.data ?? []).map((c) => <option key={c.cajaId} value={`${c.cajaId}|${c.turnoId}`}>{c.nombre}</option>)}
              </select>
            </label>
          )}
          {medio === "CAJA" && pideJustificacion && <label className="block space-y-1 text-sm font-medium sm:col-span-2" htmlFor="pp-just"><span>Justificación (el efectivo esperado del turno queda en negativo)</span><Textarea id="pp-just" maxLength={400} value={f.justificacion} onChange={(e) => setF((x) => ({ ...x, justificacion: e.target.value }))} className="rounded-xl" /></label>}
        </div>
      )}
      {f.tipo !== "NO" && (
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block space-y-1 text-sm font-medium" htmlFor="pp-importe"><span>Importe ($)</span><Input id="pp-importe" inputMode="decimal" placeholder="0,00" value={f.importe} onChange={(e) => setF((x) => ({ ...x, importe: e.target.value }))} className="h-11 rounded-xl" /></label>
          {medio !== "CAJA" && <label className="block space-y-1 text-sm font-medium" htmlFor="pp-fecha"><span>{f.tipo === "PROGRAMADA" ? "Fecha prevista" : "Fecha del pago"}</span><Input id="pp-fecha" type="date" value={f.fecha} onChange={(e) => setF((x) => ({ ...x, fecha: e.target.value }))} className="h-11 rounded-xl" /></label>}
          {medio !== "CAJA" && <label className="block space-y-1 text-sm font-medium" htmlFor="pp-ref"><span>Referencia o comprobante (opcional)</span><Input id="pp-ref" maxLength={120} value={f.referencia} onChange={(e) => setF((x) => ({ ...x, referencia: e.target.value }))} className="h-11 rounded-xl" /></label>}
          <p className="text-xs text-muted-foreground sm:col-span-3">{f.tipo === "PROGRAMADA"
            ? "Queda pendiente: no se cuenta como pagada hasta que marques «Ya hice esta transferencia»."
            : medio === "CAJA"
              ? "Sale UNA vez del efectivo de la caja elegida (queda en sus Egresos, con su turno). Se aplica sola a la factura de este pedido cuando apruebes la recepción; si sobra, queda a favor para las próximas entregas."
              : medio === "PROPIO"
                ? "Dinero tuyo, fuera de la Caja: no se registra ninguna salida de Caja. Se aplica solo a este pedido al aprobar sus recepciones."
                : "Se registra como pagada en este paso (es tu declaración: DeliGO no la verifica con el banco). No sale de la Caja. Se aplica sola a la factura de este pedido cuando apruebes la recepción; si sobra, queda a favor para las próximas entregas."}
            {estimado ? ` Total estimado del pedido: ${formatoArs(estimado)}.` : ""}</p>
        </div>
      )}
    </div>
  )
}
function PagosDelPedido({ compraId, pagos, abierto, estimado, onCambio }: { compraId: string; pagos: { resumen: ResumenPagosPedido; pagos: PagoPedido[] }; abierto: boolean; estimado: number | null; onCambio: () => void }) {
  const accion = useAccion()
  const [f, setF] = useState<FormPagoPedido>(() => ({ ...formPagoInicial(), tipo: "PARCIAL" }))
  const [nuevo, setNuevo] = useState(false)
  const [noDuplicado, setNoDuplicado] = useState(false)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const r = pagos.resumen
  const registrar = () => {
    const c = cuerpoPagoPedido(f, estimado)
    if (!c.ok || !c.cuerpo) return setErrorForm(c.ok ? "Elegí cómo pagaste." : c.error)
    setErrorForm(null)
    void accion.ejecutar(`/api/negocio/compras/${compraId}/${c.ruta}`, { ...c.cuerpo, ...(noDuplicado ? { confirmoNoDuplicado: true } : {}) }, () => { setNuevo(false); setNoDuplicado(false); setF({ ...formPagoInicial(), tipo: "PARCIAL" }); onCambio() })
  }
  return (
    <section className="space-y-2 rounded-2xl border border-violet-200 p-3 text-sm dark:border-violet-800" data-testid="pagos-pedido" aria-label="Pagos del pedido">
      <p className="font-semibold">Pagos del pedido</p>
      <p className="text-xs">Pagado: <strong className="tabular-nums">{formatoArs(r.confirmado)}</strong> · aplicado a facturas: {formatoArs(r.aplicado)} · <strong>disponible (anticipo): {formatoArs(r.disponible)}</strong>{r.programado > 0 ? ` · programado sin hacer: ${formatoArs(r.programado)}` : ""}</p>
      {pagos.pagos.length === 0 && <p className="text-xs text-muted-foreground">Sin pagos registrados para este pedido.</p>}
      <ul className="space-y-1">
        {pagos.pagos.map((p) => (
          <li key={p.id} className="rounded-lg bg-muted/40 p-2 text-xs">
            <span className="font-medium">{p.origen === "PAGO_CAJA" ? "Efectivo de Caja" : p.medio === "OTRO" ? "Efectivo propio" : "Transferencia"} {formatoArs(p.importe)}</span> · {p.origen === "PAGO_CAJA" ? "Realizado" : ESTADO_PAGO_PEDIDO[p.estado] ?? p.estado} · {fecha(p.fechaPago ?? p.createdAt, false)}{p.referencia ? ` · ref. ${p.referencia}` : ""}
            {(p.estado === "CONFIRMADO_DUENO" || p.estado === "VIGENTE") && <span className="block text-muted-foreground">Aplicado {formatoArs(p.aplicado)} · disponible {formatoArs(p.disponible)}</span>}
            {p.estado === "DECLARADO" && (
              <span className="mt-1 flex flex-wrap gap-2">
                <Button variant="outline" className="min-h-11 rounded-xl text-xs" disabled={accion.enviando} onClick={() => void accion.ejecutar(`/api/negocio/proveedores/creditos/${p.id}/confirmacion`, { motivo: null }, onCambio)}>Ya hice esta transferencia</Button>
                <Button variant="ghost" className="min-h-11 rounded-xl text-xs" disabled={accion.enviando} onClick={() => void accion.ejecutar(`/api/negocio/proveedores/creditos/${p.id}/rechazo`, { motivo: "Transferencia programada que no se hizo" }, onCambio)}>No se va a hacer</Button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {abierto && !nuevo && <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => { accion.limpiar(); setNuevo(true) }}>Registrar un pago</Button>}
      {abierto && nuevo && (
        <div className="space-y-2 rounded-xl border p-2">
          <CamposPagoPedido f={f} setF={setF} estimado={estimado} conNoPague={false} pideJustificacion={accion.code === "JUSTIFICACION_REQUERIDA"} />
          {(accion.code === "POSIBLE_PAGO_DUPLICADO" || noDuplicado) && (
            <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" data-testid="aviso-pago-parecido">
              <p className="font-medium">Hay un pago parecido de este proveedor (mismo importe, fechas cercanas):</p>
              <ul className="list-disc pl-4">{(((accion.detalle as { candidatos?: Array<{ tipo: string; importe: number; fecha: string; medio?: string | null; pedido?: number | null; referencia?: string | null; caja?: string | null }> } | undefined)?.candidatos) ?? []).map((x, i) => <li key={i}>{x.tipo === "PAGO_DECLARADO" ? (x.medio === "TRANSFERENCIA" ? "Transferencia" : "Pago por otro medio") : `Efectivo de Caja${x.caja ? ` (${x.caja})` : ""}`} · {formatoArs(x.importe)} · {fecha(x.fecha, false)}{x.referencia ? ` · ref. ${x.referencia}` : ""}{x.pedido ? ` · pedido N° ${x.pedido}` : " · sin pedido"}</li>)}</ul>
              <label className="flex min-h-11 items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={noDuplicado} onChange={(e) => setNoDuplicado(e.target.checked)} /><span>Es otro pago diferente (no es el mismo dinero).</span></label>
            </div>
          )}
          {(errorForm || (accion.error && accion.code !== "POSIBLE_PAGO_DUPLICADO")) && <p role="alert" className="text-sm text-rose-700">{errorForm ?? accion.error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-xl" disabled={accion.enviando || (accion.code === "POSIBLE_PAGO_DUPLICADO" && !noDuplicado)} onClick={registrar}>{accion.enviando ? "Registrando…" : "Registrar pago"}</Button>
            <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => setNuevo(false)}>Cancelar</Button>
          </div>
        </div>
      )}
      {!abierto && <p className="text-xs text-muted-foreground">El pedido está cerrado o anulado: no admite pagos nuevos. Lo disponible queda a favor, pendiente de resolver.</p>}
    </section>
  )
}

const MOTIVOS_CIERRE: Record<string, string> = {
  NO_REEMPLAZARA_DANADOS: "El proveedor no reemplazará la mercadería dañada",
  NO_ENTREGARA_FALTANTE: "El proveedor no entregará el faltante",
  CANCELADO_PARCIAL: "Pedido cancelado parcialmente",
  OTRO: "Otro",
}
type FotoCierre = { motivoTipo: string | null; lineas: Array<{ compraLineaId: string; producto: string; variante: string | null; pedida: number; aceptada: number; pendiente: number }> }

function ListaPedidos({ negocioId, onAbrir, onNuevo }: { negocioId: string; onAbrir: (id: string) => void; onNuevo: () => void }) {
  const q = useQuery({ queryKey: [...comprasQueryKey(negocioId), "pedidos"], queryFn: () => leerJson<{ compras: FilaPedido[] }>("/api/negocio/compras") })
  return (
    <div className="space-y-2">
      <Button className="min-h-11 rounded-xl" onClick={onNuevo}><Plus className="mr-1 h-4 w-4" />Nuevo pedido</Button>
      {q.data && q.data.compras.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Todavía no hay pedidos. Podés recibir mercadería sin pedido.</p>}
      <ul className="space-y-2" aria-label="Pedidos">
        {(q.data?.compras ?? []).map((c) => (
          <li key={c.id}><button onClick={() => onAbrir(c.id)} className="flex min-h-14 w-full flex-col gap-1 rounded-xl border p-3 text-left hover:bg-muted/40">
            <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">Pedido N° {c.numero} · {c.proveedor.nombre}</span><span className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.estado === "ABIERTA" ? ESTADO_PEDIDO[c.estadoRecepcion] : c.estado === "ANULADA" ? "Anulado" : c.estadoRecepcion === "COMPLETA" ? "Completado" : "Cerrado con pendientes"}</span></span>
            <span className="text-xs text-muted-foreground">{fecha(c.fechaPedido, false)} · {c.lineas} productos{c.totalInformado ? ` · total informado ${formatoArs(c.totalInformado)} (${IVA_TOTAL_INFORMADO[c.totalInformadoIva ?? ""] ?? ""})` : ""}</span>
          </button></li>
        ))}
      </ul>
    </div>
  )
}

function DetallePedido({ compraId, onCerrar, onAbrirRecepcion }: { compraId: string; onCerrar: (t?: string) => void; onAbrirRecepcion: (id: string) => void }) {
  const [c, setC] = useState<null | { id: string; numero: number; estado: string; estadoRecepcion: string; totalInformado?: number | null; totalInformadoIva?: string | null; proveedor: { nombre: string }; lineas: Array<{ id: string; producto: string; variante: string | null; pedida: number; recibida: number; enRevision?: number; pendiente: number; costoUnitarioAcordado?: number | null }>; recepciones: Array<{ id: string; numero: number; estado: string }>; historial: Array<{ tipo: string; motivo: string | null; createdAt: string; actor?: string; cierre?: FotoCierre }>; pagos?: { resumen: ResumenPagosPedido; pagos: PagoPedido[] } }>(null)
  const [recarga, setRecarga] = useState(0)
  const [accionPedido, setAccionPedido] = useState<null | "cierre" | "anulacion">(null)
  const [motivo, setMotivo] = useState("")
  const [motivoTipo, setMotivoTipo] = useState("")
  const [confirmoCierre, setConfirmoCierre] = useState(false)
  const accion = useAccion()
  useEffect(() => { leerJson<{ compra: NonNullable<typeof c> }>(`/api/negocio/compras/${compraId}`).then((r) => setC(r.compra)).catch(() => undefined) }, [compraId, recarga])
  if (!c) return <p className="text-sm text-muted-foreground">Cargando…</p>
  return (
    <div className="space-y-3">
      <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => onCerrar()}><ArrowLeft className="mr-1 h-4 w-4" />Pedidos</Button>
      <h3 className="text-lg font-semibold">Pedido N° {c.numero} · {c.proveedor.nombre}</h3>
      <ul className="space-y-1" aria-label="Renglones del pedido">
        {c.lineas.map((l) => <li key={l.id} className="rounded-xl border p-2 text-sm"><span className="break-words font-medium">{l.producto}{l.variante ? ` — ${l.variante}` : ""}</span><span className="block text-xs text-muted-foreground">Pedido {num(l.pedida)} · aceptado {num(l.recibida)}{l.enRevision ? ` · enviado sin aprobar ${num(l.enRevision)}` : ""} · <strong className={cn(l.pendiente > 0 && "text-amber-700 dark:text-amber-300")}>pendiente {num(l.pendiente)}</strong>{l.costoUnitarioAcordado ? ` · ${formatoArs(l.costoUnitarioAcordado)} c/u sin IVA = ${formatoArs(Math.round(l.pedida * l.costoUnitarioAcordado * 100) / 100)}` : ""}</span></li>)}
      </ul>
      {c.totalInformado ? <p className="rounded-xl bg-sky-50 p-2 text-sm text-sky-950 dark:bg-sky-950/40 dark:text-sky-100" data-testid="pedido-total-informado">Total informado por el proveedor: <strong className="tabular-nums">{formatoArs(c.totalInformado)}</strong> ({IVA_TOTAL_INFORMADO[c.totalInformadoIva ?? ""] ?? c.totalInformadoIva}). Los costos de cada producto se completan al recibir, con la factura. Es una referencia: no genera deuda.</p> : null}
      {c.lineas.some((l) => l.costoUnitarioAcordado) && <p className="text-sm">Total acordado del pedido (sin IVA): <strong className="tabular-nums">{formatoArs(Math.round(c.lineas.reduce((t, l) => t + l.pedida * (l.costoUnitarioAcordado ?? 0), 0) * 100) / 100)}</strong>{c.lineas.some((l) => !l.costoUnitarioAcordado) ? " · hay productos sin costo acordado" : ""}</p>}
      {c.pagos && <PagosDelPedido compraId={c.id} pagos={c.pagos} abierto={c.estado === "ABIERTA"} estimado={c.totalInformado ?? (c.lineas.every((l) => l.costoUnitarioAcordado) ? Math.round(c.lineas.reduce((t, l) => t + l.pedida * (l.costoUnitarioAcordado ?? 0), 0) * 100) / 100 : null)} onCambio={() => setRecarga((x) => x + 1)} />}
      {c.recepciones.length > 0 && <div className="text-sm"><p className="font-medium">Recepciones</p><ul className="mt-1 flex flex-wrap gap-2">{c.recepciones.map((r) => <li key={r.id}><Button variant="outline" className="min-h-11 rounded-xl" onClick={() => onAbrirRecepcion(r.id)}>N° {r.numero} · {ESTADO_RECEPCION[r.estado]?.texto}</Button></li>)}</ul></div>}
      {(() => {
        // Cerrado: resumen fácil de leer de lo pedido, lo aceptado y lo que quedó pendiente, con el motivo.
        const cierre = [...c.historial].reverse().find((h) => h.tipo === "CIERRE_COMPRA")
        if (c.estado !== "CERRADA_CON_FALTANTE" || !cierre) return null
        return (
          <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50/60 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30" data-testid="resumen-cierre">
            <p className="font-semibold">{cierre.cierre?.lineas.some((l) => l.pendiente > 0) || c.lineas.some((l) => l.pendiente > 0) ? "Cerrado con pendientes" : "Completado y cerrado"}</p>
            <p className="text-xs">Cerró: {cierre.actor ?? "Dueño"} · {fecha(cierre.createdAt)} · Motivo: «{cierre.motivo}»</p>
            {cierre.cierre && (
              <ul className="space-y-1" aria-label="Lo que quedó sin recibir">
                {cierre.cierre.lineas.map((l) => <li key={l.compraLineaId} className="text-xs"><span className="font-medium">{l.producto}{l.variante ? ` — ${l.variante}` : ""}</span>: pedido {num(l.pedida)} · aceptado {num(l.aceptada)} · <strong>sin recibir {num(l.pendiente)}</strong></li>)}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">El cierre no movió stock, costos, pagos ni deuda. Las recepciones anteriores, con sus daños y rechazos, siguen disponibles.</p>
          </div>
        )
      })()}
      {c.estado === "ABIERTA" && !accionPedido && (
        <div className="flex flex-wrap gap-2">
          {c.lineas.some((l) => l.pendiente > 0) && <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => { accion.limpiar(); setAccionPedido("cierre") }}>Cerrar pedido con pendientes</Button>}
          {c.estadoRecepcion === "SIN_RECIBIR" && <Button variant="ghost" className="min-h-11 rounded-xl text-rose-700" onClick={() => { accion.limpiar(); setAccionPedido("anulacion") }}>Anular pedido</Button>}
        </div>
      )}
      {accionPedido === "cierre" && (
        <div className="space-y-3 rounded-2xl border border-amber-300 p-3" data-testid="cerrar-con-pendientes">
          <p className="text-sm font-semibold">Cerrar el pedido N° {c.numero} sin esperar lo pendiente</p>
          <ul className="space-y-1 text-sm" aria-label="Pendientes del pedido">
            {c.lineas.filter((l) => l.pendiente > 0).map((l) => <li key={l.id} className="rounded-lg bg-muted/40 p-2"><span className="font-medium">{l.producto}{l.variante ? ` — ${l.variante}` : ""}</span><span className="block text-xs text-muted-foreground">Pedido {num(l.pedida)} · aceptado {num(l.recibida)} · <strong className="text-amber-800 dark:text-amber-200">queda sin recibir {num(l.pendiente)}</strong></span></li>)}
          </ul>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">Motivo del cierre</legend>
            {Object.entries(MOTIVOS_CIERRE).map(([v, t]) => (
              <label key={v} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="motivo-cierre" className="h-4 w-4" checked={motivoTipo === v} onChange={() => setMotivoTipo(v)} />{t}</label>
            ))}
          </fieldset>
          <label className="block space-y-1 text-sm font-medium" htmlFor="ped-motivo"><span>{motivoTipo === "OTRO" ? "Contá el motivo" : "Detalle (opcional)"}</span><Textarea id="ped-motivo" maxLength={400} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded-xl" /></label>
          <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmoCierre} onChange={(e) => setConfirmoCierre(e.target.checked)} /><span>Confirmo que cierro el pedido y que lo pendiente <strong>no se va a recibir</strong>. No cambia stock, costos, pagos ni deuda, y no se podrán hacer nuevas recepciones de este pedido.</span></label>
          {accion.error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{accion.error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-xl" disabled={accion.enviando || !motivoTipo || (motivoTipo === "OTRO" && !motivo.trim()) || !confirmoCierre}
              onClick={() => void accion.ejecutar(`/api/negocio/compras/${compraId}/cierre`, { motivoTipo, motivo: motivo.trim() || null, confirmo: true }, () => onCerrar(`Pedido N° ${c.numero} cerrado con pendientes.`))}>{accion.enviando ? "Cerrando…" : "Cerrar pedido con pendientes"}</Button>
            <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => setAccionPedido(null)}>Volver</Button>
          </div>
        </div>
      )}
      {accionPedido === "anulacion" && (
        <div className="space-y-2 rounded-2xl border p-3">
          <label className="block space-y-1 text-sm font-medium" htmlFor="ped-motivo"><span>Motivo</span><Textarea id="ped-motivo" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded-xl" /></label>
          {accion.error && <p role="alert" className="text-sm text-rose-700">{accion.error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button className="min-h-11 rounded-xl" disabled={accion.enviando || !motivo.trim()} onClick={() => void accion.ejecutar(`/api/negocio/compras/${compraId}/${accionPedido}`, { motivo: motivo.trim() }, () => onCerrar(`Pedido N° ${c.numero} anulado.`))}>Anular pedido</Button>
            <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => setAccionPedido(null)}>Volver</Button>
          </div>
        </div>
      )}
      <ol className="space-y-1 text-xs text-muted-foreground" aria-label="Historial del pedido">{c.historial.map((h, i) => <li key={i}>{fecha(h.createdAt)} · {h.tipo === "CIERRE_COMPRA" ? "Cerrado con pendientes" : "Anulado"} · {h.actor ?? "Dueño"} · {h.motivo}</li>)}</ol>
    </div>
  )
}

type LineaPedido = { uid: string; productoId: string; varianteId: string; cantidad: string; costo: string }

function FormPedido({ onCerrar }: { onCerrar: (t?: string) => void }) {
  const [catalogo, setCatalogo] = useState<ProductoCatalogo[] | null>(null)
  const [proveedores, setProveedores] = useState<Array<{ id: string; nombre: string }>>([])
  const [f, setF] = useState<{ proveedorId: string; fechaPedido: string; notas: string; lineas: LineaPedido[] }>({ proveedorId: "", fechaPedido: new Date().toISOString().slice(0, 10), notas: "", lineas: [] })
  // A: «sé el costo de cada producto» (como siempre) · B: «sólo sé el total del pedido» (costos pendientes hasta recibir).
  const [modalidad, setModalidad] = useState<"PRECIOS" | "TOTAL">("PRECIOS")
  const [total, setTotal] = useState<{ importe: string; iva: string }>({ importe: "", iva: "" })
  const [error, setError] = useState<string | null>(null)
  const [pago, setPago] = useState<FormPagoPedido>(formPagoInicial)
  const accion = useAccion()
  useEffect(() => {
    Promise.all([leerJson<{ productos: ProductoCatalogo[] }>("/api/negocio/compras/catalogo"), leerJson<{ proveedores: Array<{ id: string; nombre: string; activo: boolean }> }>("/api/negocio/proveedores")])
      .then(([c, p]) => { setCatalogo(c.productos); setProveedores(p.proveedores.filter((x) => x.activo)) }).catch(() => setError("No se pudo cargar el catálogo."))
  }, [])
  const porId = useMemo(() => new Map((catalogo ?? []).map((p) => [p.id, p])), [catalogo])
  const setLinea = (u: string, c: Partial<LineaPedido>) => setF((x) => ({ ...x, lineas: x.lineas.map((l) => (l.uid === u ? { ...l, ...c } : l)) }))
  // Lo que entrega el proveedor elegido aparece primero; «Todo el catálogo» muestra el resto.
  const [delProveedor, setDelProveedor] = useState<{ proveedorId: string; claves: Set<string> } | null>(null)
  const [todoElCatalogo, setTodoElCatalogo] = useState(false)
  useEffect(() => {
    if (!f.proveedorId) return
    let cancelado = false
    leerJson<{ proveedorProductos?: string[] }>(`/api/negocio/compras/catalogo?proveedorId=${encodeURIComponent(f.proveedorId)}`)
      .then((r) => { if (!cancelado) setDelProveedor({ proveedorId: f.proveedorId, claves: new Set(r.proveedorProductos ?? []) }) }).catch(() => undefined)
    return () => { cancelado = true }
  }, [f.proveedorId])
  const claves = delProveedor && delProveedor.proveedorId === f.proveedorId ? delProveedor.claves : null
  const esDelProveedor = (p: ProductoCatalogo) => Boolean(claves && (claves.has(p.id) || p.variantes.some((v) => claves.has(`${p.id}:${v.id}`))))
  const hayDelProveedor = Boolean(claves && claves.size > 0)
  const propios = (catalogo ?? []).filter(esDelProveedor)
  const otros = (catalogo ?? []).filter((p) => !esDelProveedor(p))
  const subtotal = (l: LineaPedido) => {
    const p = porId.get(l.productoId)
    const cant = p ? parseCantidad(l.cantidad, p.fraccionable) : null
    const costo = l.costo.trim() ? parseImporteArs(l.costo) : null
    return cant && cant.ok && costo && costo.ok ? Math.round(cant.milesimas * Number(costo.valor) / 10) / 100 : null
  }
  const totalPedido = f.lineas.reduce<number | null>((t, l) => { const st = subtotal(l); return st === null ? t : (t ?? 0) + st }, null)
  const guardar = () => {
    if (!f.proveedorId) return setError("Elegí el proveedor.")
    if (!f.lineas.length) return setError("Agregá al menos un producto.")
    const lineas: Array<Record<string, unknown>> = []
    for (const l of f.lineas) {
      const p = porId.get(l.productoId)
      if (!p) return setError("Elegí el producto de cada renglón.")
      if (p.variantes.length && !l.varianteId) return setError(`«${p.nombre}»: elegí la variante.`)
      const cant = parseCantidad(l.cantidad, p.fraccionable)
      if (!cant.ok) return setError(`«${p.nombre}»: ${cant.error}`)
      // Modalidad B: el costo de cada producto queda pendiente (nunca cero ni un reparto del total).
      const costo = modalidad === "PRECIOS" && l.costo.trim() ? parseImporteArs(l.costo) : null
      if (costo && !costo.ok) return setError(`«${p.nombre}»: ${costo.error}`)
      lineas.push({ productoId: p.id, productoVarianteId: l.varianteId || null, cantidadPedida: cant.valor, costoUnitarioAcordado: costo && costo.ok ? costo.valor : null })
    }
    let extra: Record<string, unknown> = {}
    if (modalidad === "TOTAL") {
      const t = parseImporteArs(total.importe)
      if (!t.ok || Number(t.valor) <= 0) return setError("Escribí el total que informó el proveedor.")
      if (!total.iva) return setError("Indicá si ese total incluye IVA, no lo incluye o todavía no se sabe.")
      extra = { totalInformado: t.valor, totalInformadoIva: total.iva }
    }
    const estimado = modalidad === "TOTAL" ? Number(parseImporteArs(total.importe).ok ? (parseImporteArs(total.importe) as { valor: string }).valor : 0) || null : totalPedido
    const cp = cuerpoPagoPedido(pago, estimado)
    if (!cp.ok) return setError(cp.error)
    setError(null)
    void accion.ejecutar("/api/negocio/compras", { proveedorId: f.proveedorId, fechaPedido: f.fechaPedido, notas: f.notas.trim() || null, lineas, ...extra }, async (json) => {
      if (!cp.cuerpo) return onCerrar(`Pedido N° ${json.numero} creado.`)
      // El pedido ya existe: el pago va en su propio paso (idempotente). Si falla, se registra desde el detalle del pedido.
      const r = await enviarJson(`/api/negocio/compras/${json.compraId}/${cp.ruta}`, "POST", cp.cuerpo, newIdempotencyKey())
      if (r.ok) return onCerrar(`Pedido N° ${json.numero} creado con ${cp.ruta === "anticipo-efectivo" ? "el anticipo en efectivo de Caja registrado" : cp.cuerpo.realizada ? "el pago registrado" : "la transferencia programada (todavía no cuenta como pagada)"}.`)
      onCerrar(r.incierto
        ? `Pedido N° ${json.numero} creado. No pudimos confirmar el pago: abrí el pedido y revisá sus pagos antes de volver a cargarlo.`
        : `Pedido N° ${json.numero} creado, pero el pago no se registró (${r.error}). Registralo desde el detalle del pedido.`)
    })
  }
  if (!catalogo) return <p className="text-sm text-muted-foreground">{error ?? "Cargando…"}</p>
  return (
    <div className="space-y-3 rounded-2xl border p-3" aria-label="Nuevo pedido">
      <p className="text-sm font-semibold">Nuevo pedido</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block space-y-1 text-sm font-medium" htmlFor="ped-prov"><span>Proveedor</span><select id="ped-prov" className={SEL} value={f.proveedorId} onChange={(e) => setF((x) => ({ ...x, proveedorId: e.target.value }))}><option value="">Elegí…</option>{proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        <label className="block space-y-1 text-sm font-medium" htmlFor="ped-fecha"><span>Fecha</span><Input id="ped-fecha" type="date" value={f.fechaPedido} onChange={(e) => setF((x) => ({ ...x, fechaPedido: e.target.value }))} className="h-11 rounded-xl" /></label>
      </div>
      {hayDelProveedor && <label className="flex min-h-11 items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="h-4 w-4" checked={todoElCatalogo} onChange={(e) => setTodoElCatalogo(e.target.checked)} />Mostrar todo el catálogo (no sólo lo que entrega este proveedor)</label>}
      <fieldset className="grid gap-2 sm:grid-cols-2" data-testid="modalidad-pedido">
        <legend className="mb-1 text-sm font-medium">¿Qué sabés de los precios?</legend>
        <label className={cn("flex min-h-11 items-start gap-2 rounded-xl border p-2 text-sm", modalidad === "PRECIOS" && "border-primary bg-primary/5")}><input type="radio" name="modalidad-pedido" className="mt-0.5 h-4 w-4" checked={modalidad === "PRECIOS"} onChange={() => setModalidad("PRECIOS")} /><span><strong>Sé el costo de cada producto</strong><span className="block text-xs text-muted-foreground">Costo por unidad sin IVA, subtotales y total calculado.</span></span></label>
        <label className={cn("flex min-h-11 items-start gap-2 rounded-xl border p-2 text-sm", modalidad === "TOTAL" && "border-primary bg-primary/5")}><input type="radio" name="modalidad-pedido" className="mt-0.5 h-4 w-4" checked={modalidad === "TOTAL"} onChange={() => setModalidad("TOTAL")} /><span><strong>Sólo sé el total del pedido</strong><span className="block text-xs text-muted-foreground">Los costos de cada producto se completan al recibir, con la factura.</span></span></label>
      </fieldset>
      {modalidad === "PRECIOS"
        ? <p className="text-xs text-muted-foreground">El costo es <strong>por unidad y sin IVA</strong> (el IVA se carga al recibir). Es la referencia para avisar diferencias de costo al aprobar.</p>
        : <p className="text-xs text-muted-foreground">Cargá productos y cantidades. No hace falta el costo de cada uno: queda pendiente hasta que llegue la factura (no se inventa ni se reparte el total).</p>}
      <ul className="space-y-2">
        {f.lineas.map((l) => {
          const p = porId.get(l.productoId)
          const st = subtotal(l)
          const opciones = hayDelProveedor && !todoElCatalogo ? [...propios, ...(p && !esDelProveedor(p) ? [p] : [])] : null
          return (
            <li key={l.uid} className={cn("grid gap-2 rounded-xl border p-2", modalidad === "PRECIOS" ? "sm:grid-cols-[2fr_1fr_1fr_1fr_auto]" : "sm:grid-cols-[2fr_1fr_1fr_auto]")}>
              <select aria-label="Producto" className={SEL} value={l.productoId} onChange={(e) => setLinea(l.uid, { productoId: e.target.value, varianteId: "" })}><option value="">Producto…</option>
                {opciones
                  ? opciones.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)
                  : hayDelProveedor
                    ? <><optgroup label="De este proveedor">{propios.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</optgroup><optgroup label="Otros productos">{otros.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</optgroup></>
                    : catalogo.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
              </select>
              <select aria-label="Variante" className={SEL} value={l.varianteId} disabled={!p?.variantes.length} onChange={(e) => setLinea(l.uid, { varianteId: e.target.value })}><option value="">{p?.variantes.length ? "Variante…" : "Sin variantes"}</option>{(p?.variantes ?? []).map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}</select>
              <Input aria-label="Cantidad pedida" inputMode={p?.fraccionable ? "decimal" : "numeric"} placeholder={p ? `Cantidad (${p.fraccionable ? p.unidadMedida : "u."})` : "Cantidad"} value={l.cantidad} onChange={(e) => setLinea(l.uid, { cantidad: e.target.value })} className="h-11 rounded-xl" />
              {modalidad === "PRECIOS" && <Input aria-label="Costo unitario acordado sin IVA (opcional)" inputMode="decimal" placeholder="$ c/u sin IVA (opcional)" value={l.costo} onChange={(e) => setLinea(l.uid, { costo: e.target.value })} className="h-11 rounded-xl" />}
              <Button variant="ghost" className="min-h-11 rounded-xl" aria-label="Quitar renglón" onClick={() => setF((x) => ({ ...x, lineas: x.lineas.filter((y) => y.uid !== l.uid) }))}>Quitar</Button>
              {modalidad === "TOTAL" && <p className="text-xs text-muted-foreground sm:col-span-4">Costo unitario: pendiente (se completa al recibir).</p>}
              {modalidad === "PRECIOS" && st !== null && <p className="text-xs text-muted-foreground sm:col-span-5" data-testid="subtotal-pedido">Subtotal sin IVA: <strong className="tabular-nums text-foreground">{formatoArs(st)}</strong></p>}
            </li>
          )
        })}
      </ul>
      <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => setF((x) => ({ ...x, lineas: [...x.lineas, { uid: Math.random().toString(36).slice(2), productoId: "", varianteId: "", cantidad: "", costo: "" }] }))}><Plus className="mr-1 h-4 w-4" />Agregar producto</Button>
      {modalidad === "TOTAL" && (
        <div className="grid gap-2 rounded-xl border p-2 sm:grid-cols-2" data-testid="total-informado">
          <label className="block space-y-1 text-sm font-medium" htmlFor="ped-total"><span>Total informado por el proveedor ($)</span><Input id="ped-total" inputMode="decimal" placeholder="0,00" value={total.importe} onChange={(e) => setTotal((x) => ({ ...x, importe: e.target.value }))} className="h-11 rounded-xl" /></label>
          <label className="block space-y-1 text-sm font-medium" htmlFor="ped-total-iva"><span>¿Ese total incluye IVA?</span>
            <select id="ped-total-iva" className={SEL} value={total.iva} onChange={(e) => setTotal((x) => ({ ...x, iva: e.target.value }))}>
              <option value="">Elegí…</option><option value="INCLUYE_IVA">Sí, incluye IVA</option><option value="SIN_IVA">No, es sin IVA</option><option value="NO_SE_SABE">Todavía no se sabe</option>
            </select>
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">Es una referencia para comparar con la factura al aprobar: no genera deuda ni mueve stock.</p>
        </div>
      )}
      {modalidad === "PRECIOS" && totalPedido !== null && <p className="text-sm">Total del pedido (sin IVA): <strong className="tabular-nums" data-testid="total-pedido">{formatoArs(totalPedido)}</strong>{f.lineas.some((l) => subtotal(l) === null) ? <span className="text-xs text-muted-foreground"> · sin contar los productos sin costo</span> : null}</p>}
      <div className="rounded-xl border p-2"><CamposPagoPedido f={pago} setF={setPago} estimado={modalidad === "TOTAL" ? (parseImporteArs(total.importe).ok ? Number((parseImporteArs(total.importe) as { valor: string }).valor) || null : null) : totalPedido} conNoPague /></div>
      {(error || accion.error) && <p role="alert" className="text-sm text-rose-700">{error ?? accion.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11 rounded-xl" disabled={accion.enviando} onClick={guardar}>{accion.enviando ? "Guardando…" : "Crear pedido"}</Button>
        <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => onCerrar()}>Cancelar</Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Configuración tributaria
// ---------------------------------------------------------------------------

function ConfigImpuestos() {
  const [valor, setValor] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { leerJson<{ tratamientoImpuestos: string }>("/api/negocio/compras/configuracion").then((r) => setValor(r.tratamientoImpuestos)).catch(() => setError("No se pudo cargar.")) }, [])
  const guardar = async (v: string) => {
    setValor(v); setOk(null); setError(null)
    try {
      const res = await fetch("/api/negocio/compras/configuracion", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tratamientoImpuestos: v }) })
      const json = await res.json()
      if (!res.ok || json.ok === false) throw new Error(json.error)
      setOk("Guardado. Se aplica a las próximas aprobaciones (las ya aprobadas no cambian).")
    } catch {
      setError("No se pudo guardar.")
    }
  }
  if (valor === null) return <p className="text-sm text-muted-foreground">{error ?? "Cargando…"}</p>
  return (
    <div className="space-y-2 rounded-2xl border p-3">
      <label className="block space-y-1 text-sm font-medium" htmlFor="cfg-impuestos"><span>Impuestos en el costo de la mercadería</span>
        <select id="cfg-impuestos" className={SEL} value={valor} onChange={(e) => void guardar(e.target.value)}>
          <option value="IMPUESTOS_INTEGRAN_COSTO">El IVA integra el costo (monotributo / no lo recupero)</option>
          <option value="IMPUESTOS_RECUPERABLES">El IVA no integra el costo (responsable inscripto)</option>
        </select>
      </label>
      <p className="text-xs text-muted-foreground">En los dos casos la deuda con el proveedor incluye el IVA. Las percepciones siempre suman al costo.</p>
      {ok && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{ok}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
    </div>
  )
}

// Pagos E3 — permiso INDIVIDUAL de anticipos en efectivo de cada empleado (deshabilitado por defecto) con límites.
function PermisosAnticipos() {
  const q = useQuery<{ empleados: Array<{ id: string; nombre: string; habilitado: boolean; limiteOperacion: string | null; limiteDiario: string | null }> }>({ queryKey: ["permisos-anticipos"], queryFn: () => leerJson("/api/negocio/compras/permisos-anticipos") })
  return (
    <section className="space-y-2 rounded-2xl border p-3" aria-label="Anticipos en efectivo de empleados" data-testid="permisos-anticipos">
      <p className="text-sm font-semibold">Anticipos en efectivo a proveedores (empleados)</p>
      <p className="text-xs text-muted-foreground">Deshabilitado por defecto. Sólo el empleado habilitado puede pagar un anticipo de un pedido desde su propio turno, sin superar sus límites por operación y por día.</p>
      {q.isLoading ? <p className="text-xs text-muted-foreground">Cargando…</p> : (q.data?.empleados ?? []).map((e) => <FilaPermiso key={e.id} e={e} onHecho={() => void q.refetch()} />)}
    </section>
  )
}
function FilaPermiso({ e, onHecho }: { e: { id: string; nombre: string; habilitado: boolean; limiteOperacion: string | null; limiteDiario: string | null }; onHecho: () => void }) {
  const [hab, setHab] = useState(e.habilitado)
  const [op, setOp] = useState(e.limiteOperacion?.replace(".", ",") ?? "")
  const [dia, setDia] = useState(e.limiteDiario?.replace(".", ",") ?? "")
  const [msg, setMsg] = useState<string | null>(null)
  const guardar = async () => {
    const a = op.trim() ? parseImporteArs(op) : null, b = dia.trim() ? parseImporteArs(dia) : null
    if ((a && !a.ok) || (b && !b.ok)) return setMsg("Revisá los importes.")
    const r = await fetch("/api/negocio/compras/permisos-anticipos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empleadoId: e.id, habilitado: hab, limiteOperacion: a && a.ok ? a.valor : null, limiteDiario: b && b.ok ? b.valor : null }) })
    const j = (await r.json().catch(() => ({}))) as { error?: string }
    setMsg(r.ok ? "Guardado." : j.error ?? "No se pudo guardar.")
    if (r.ok) onHecho()
  }
  return (
    <div className="grid items-end gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_auto_8rem_8rem_auto]">
      <span className="text-sm font-medium">{e.nombre}</span>
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={hab} onChange={(x) => setHab(x.target.checked)} />Habilitado</label>
      <label className="block space-y-1 text-xs" htmlFor={`lo-${e.id}`}><span>Por operación ($)</span><Input id={`lo-${e.id}`} inputMode="decimal" value={op} onChange={(x) => setOp(x.target.value)} className="h-11 rounded-xl" /></label>
      <label className="block space-y-1 text-xs" htmlFor={`ld-${e.id}`}><span>Por día ($)</span><Input id={`ld-${e.id}`} inputMode="decimal" value={dia} onChange={(x) => setDia(x.target.value)} className="h-11 rounded-xl" /></label>
      <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => void guardar()}>Guardar</Button>
      {msg && <p className="text-xs sm:col-span-5" role="status">{msg}</p>}
    </div>
  )
}
