"use client"

// ============================================
// F10-C1c — owner: «Egresos de Caja» (supervision, corrections, configuration)
// ============================================
// Owner endpoints only (session = business owner):
//   GET  /api/negocio/caja/egresos                       list + filters + pending supervision + filter options
//   POST /api/negocio/caja/egresos                       register (explicit register + the open shift the owner saw)
//   POST /api/negocio/caja/egresos/[id]/revision         REVISADO | OBSERVADO        (never moves money)
//   POST /api/negocio/caja/egresos/[id]/confirmacion-retiro  CONFIRMADO | NO_RECIBIDO (never moves money)
//   POST /api/negocio/caja/egresos/[id]/compensacion     total REVERSION while the outflow's shift is OPEN
//   GET/PATCH /api/negocio/caja/configuracion-egresos    optional notice threshold
// Financial actions always go through an explicit confirmation step, carry an
// Idempotency-Key per exact content (kept on a network error / 5xx so a retry
// replays, dropped on a 4xx or success) and are disabled while in flight.
// The register is NEVER chosen automatically, not even when only one is open.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Filter, HandCoins, Plus, ReceiptText, RefreshCw, Truck, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { cn } from "@/lib/utils"
import {
  CATEGORIAS_SALIDA,
  DESTINATARIOS_SALIDA,
  FORMULARIO_VACIO,
  NATURALEZAS_SALIDA,
  formatoArs,
  parseImporteArs,
  referenciaSalida,
  validarSalida,
  type CampoSalida,
  type FormularioSalida,
  type NaturalezaSalida,
} from "@/components/business/caja-salidas-cajero"
import { ownerRegisterQueryKey, type CajaFisicaResumen } from "@/components/business/owner-caja-turnos"

// ---------------------------------------------------------------------------
// Types (owner API shape)
// ---------------------------------------------------------------------------

export type EgresoDueno = {
  id: string
  operacionId: string
  naturaleza: NaturalezaSalida
  categoria: string | null
  importe: number
  motivo: string
  turnoCajaId: string
  cajaFisicaId: string
  cajaNombre: string
  registradoPor: { tipo: "NEGOCIO" | "EMPLEADO"; empleadoId?: string | null; nombre: string }
  proveedorNombre: string | null
  proveedorIdentificacion: string | null
  comprobanteReferencia: string | null
  destinatarioTipo: string | null
  destinatarioNombre: string | null
  confirmacionRetiro: { estado: "NO_REQUERIDA" | "PENDIENTE" | "CONFIRMADO" | "NO_RECIBIDO"; en: string | null } | null
  alertas: { excedeEsperado: boolean; efectivoEsperadoPrevio: number; efectivoEsperadoResultante: number; superaUmbral: boolean; umbralAviso: number | null }
  justificacion: string | null
  revision: { estado: "SIN_REVISAR" | "REVISADO" | "OBSERVADO"; en: string | null }
  historial: Array<{ accion: "REVISION" | "CONFIRMACION_RETIRO"; resultado: string; observacion: string | null; createdAt: string }>
  compensacion: { id: string; operacionId: string; momento: string; importe: number; motivo: string; createdAt: string } | null
  turnoAbierto: boolean
  compensacionDisponible: boolean
  compensacionBloqueada: "TURNO_CERRADO" | "VINCULADO_A_PROVEEDOR" | null
  // F5-A: link in force to a supplier account (optional for older payloads)
  vinculoProveedor?: { creditoId: string; proveedorId: string; proveedorNombre: string } | null
  pendienteSupervision: boolean
  pendiente: { confirmacion: boolean; revision: boolean }
  createdAt: string
}
type Pendientes = { confirmacionRetiro: number; revision: number; total: number }
type ListaResponse = { egresos: EgresoDueno[]; pendientes: Pendientes; responsables: Array<{ id: string; nombre: string }> }

export type FiltrosEgresos = {
  desde: string
  hasta: string
  cajaFisicaId: string
  empleadoId: string
  naturaleza: "" | NaturalezaSalida
  categoria: string
  estadoRevision: "" | "SIN_REVISAR" | "REVISADO" | "OBSERVADO"
  pendienteSupervision: boolean
}
export const FILTROS_VACIOS: FiltrosEgresos = { desde: "", hasta: "", cajaFisicaId: "", empleadoId: "", naturaleza: "", categoria: "", estadoRevision: "", pendienteSupervision: false }

export const egresosQueryKey = (negocioId: string) => ["negocio-caja-egresos", negocioId] as const
/** Room below the panel for the install notice (its height is published by install-prompt.tsx), so nothing stays under it. */
export const RESERVA_AVISO_INSTALACION = "calc(var(--deligo-install-prompt-h, 0px) + 1rem)"

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/** Local calendar day (yyyy-mm-dd) → ISO instant of its start; `fin` = start of the NEXT day (exclusive bound). */
export function inicioDiaLocal(fecha: string, fin = false): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (fin ? 1 : 0), 0, 0, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function queryFiltros(f: FiltrosEgresos): string {
  const p = new URLSearchParams()
  const desde = f.desde ? inicioDiaLocal(f.desde) : null
  const hasta = f.hasta ? inicioDiaLocal(f.hasta, true) : null
  if (desde) p.set("desde", desde)
  if (hasta) p.set("hasta", hasta)
  if (f.cajaFisicaId) p.set("cajaFisicaId", f.cajaFisicaId)
  if (f.empleadoId) p.set("empleadoId", f.empleadoId)
  if (f.naturaleza) p.set("naturaleza", f.naturaleza)
  if (f.categoria && (f.naturaleza === "" || f.naturaleza === "GASTO")) p.set("categoria", f.categoria)
  if (f.estadoRevision) p.set("estadoRevision", f.estadoRevision)
  if (f.pendienteSupervision) p.set("pendienteSupervision", "true")
  return p.toString()
}

export const ESTILO_NATURALEZA: Record<NaturalezaSalida, { titulo: string; clase: string }> = {
  GASTO: { titulo: "Gasto operativo", clase: "bg-sky-100 text-sky-950 ring-sky-300 dark:bg-sky-950 dark:text-sky-100 dark:ring-sky-700" },
  PAGO_PROVEEDOR: { titulo: "Pago a proveedor", clase: "bg-violet-100 text-violet-950 ring-violet-300 dark:bg-violet-950 dark:text-violet-100 dark:ring-violet-700" },
  RETIRO_DUENO: { titulo: "Retiro del dueño", clase: "bg-amber-100 text-amber-950 ring-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-700" },
}
const TITULO_CATEGORIA: Record<string, string> = Object.fromEntries(CATEGORIAS_SALIDA.map((c) => [c.valor, c.titulo]))
const TITULO_DESTINATARIO: Record<string, string> = Object.fromEntries(DESTINATARIOS_SALIDA.map((d) => [d.valor, d.titulo]))
const TITULO_REVISION: Record<string, string> = { SIN_REVISAR: "Sin revisar", REVISADO: "Revisado", OBSERVADO: "Observado" }
const TITULO_CONFIRMACION: Record<string, string> = { PENDIENTE: "Recepción por confirmar", CONFIRMADO: "Recepción confirmada", NO_RECIBIDO: "Informado como no recibido" }
const PILL = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset"
const PILL_NEUTRO = "bg-muted text-foreground/85 ring-foreground/20"
const PILL_ALERTA = "bg-rose-100 text-rose-900 ring-rose-300 dark:bg-rose-950 dark:text-rose-100 dark:ring-rose-700"
const PILL_OK = "bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-700"
const fecha = (iso: string) => new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })

function IconoNaturaleza({ naturaleza, className }: { naturaleza: NaturalezaSalida; className?: string }) {
  const Icono = naturaleza === "GASTO" ? ReceiptText : naturaleza === "PAGO_PROVEEDOR" ? Truck : HandCoins
  return <Icono className={className ?? "h-3.5 w-3.5"} aria-hidden="true" />
}

export function NaturalezaBadge({ naturaleza }: { naturaleza: NaturalezaSalida }) {
  const e = ESTILO_NATURALEZA[naturaleza]
  return <span className={cn(PILL, e.clase)} data-naturaleza={naturaleza}><IconoNaturaleza naturaleza={naturaleza} />{e.titulo}</span>
}

/** One attempt key per exact content. Kept after a network error or a 5xx (a retry replays); dropped otherwise. */
function useIntentos() {
  const claves = useRef(new Map<string, string>())
  return {
    clave: (canonico: string) => {
      let k = claves.current.get(canonico)
      if (!k) { k = newIdempotencyKey(); claves.current.set(canonico, k) }
      return k
    },
    olvidar: (canonico: string) => { claves.current.delete(canonico) },
  }
}

type Envio = { ok: true; json: Record<string, unknown> } | { ok: false; status: number; code?: string; error: string; detalle?: Record<string, unknown>; incierto: boolean }

async function enviar(url: string, body: Record<string, unknown>, key: string, method = "POST"): Promise<Envio> {
  let res: Response
  try {
    res = await fetch(url, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) })
  } catch {
    return { ok: false, status: 0, error: "No pudimos confirmar la operación por un problema de conexión. Podés reintentar: no se va a registrar dos veces.", incierto: true }
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (res.ok && json.ok !== false) return { ok: true, json }
  const incierto = res.status >= 500
  return {
    ok: false,
    status: res.status,
    code: typeof json.code === "string" ? json.code : undefined,
    error: incierto ? "No pudimos confirmar la operación por un error del servidor. Podés reintentar: no se va a registrar dos veces." : (typeof json.error === "string" ? json.error : "No se pudo completar la operación."),
    detalle: json.detalle && typeof json.detalle === "object" ? json.detalle as Record<string, unknown> : undefined,
    incierto,
  }
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function OwnerCajaEgresos({ negocioId }: { negocioId: string }) {
  const queryClient = useQueryClient()
  const [filtros, setFiltros] = useState<FiltrosEgresos>(FILTROS_VACIOS)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [registrando, setRegistrando] = useState<{ inicial: FormularioSalida; cajaFisicaId: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [accionAbierta, setAccionAbierta] = useState(false)
  const formularioAbierto = registrando !== null || accionAbierta
  // Same rule as the cashier's outflow form (C1b): while a financial form is open the
  // floating chat and the install notice step aside (globals.css); they come back after.
  useEffect(() => {
    if (!formularioAbierto) return
    document.body.dataset.cajaSalidaActiva = "true"
    return () => { delete document.body.dataset.cajaSalidaActiva }
  }, [formularioAbierto])
  const qs = queryFiltros(filtros)
  const lista = useQuery<ListaResponse>({
    queryKey: [...egresosQueryKey(negocioId), qs],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/caja/egresos${qs ? `?${qs}` : ""}`, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "No se pudieron cargar los egresos.")
      return json
    },
  })
  const cajas = useQuery<{ cajas: CajaFisicaResumen[] }>({
    queryKey: ownerRegisterQueryKey(negocioId),
    queryFn: async () => {
      const res = await fetch("/api/negocio/caja/cajas", { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "No se pudieron cargar las cajas.")
      return json
    },
  })
  const refrescar = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: egresosQueryKey(negocioId) })
    void queryClient.invalidateQueries({ queryKey: ownerRegisterQueryKey(negocioId) })
    void queryClient.invalidateQueries({ queryKey: ["negocio-caja-ventas-hoy", negocioId] })
  }, [queryClient, negocioId])

  const pendientes = lista.data?.pendientes
  const egresos = lista.data?.egresos ?? []
  const todasLasCajas = cajas.data?.cajas ?? []

  return (
    <section className="space-y-4" aria-labelledby="egresos-caja-titulo" style={{ paddingBottom: RESERVA_AVISO_INSTALACION }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="egresos-caja-titulo" className="text-base font-bold">Egresos de Caja</h3>
          <p className="text-sm text-muted-foreground">Gastos operativos, pagos a proveedores y retiros del dueño. Cada salida descuenta efectivo de una caja con turno abierto.</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Actualizar egresos" disabled={lista.isFetching} onClick={refrescar}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      {pendientes && (pendientes.total > 0 ? (
        <div role="status" data-testid="egresos-pendientes" className="flex flex-col gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="flex items-start gap-2 font-semibold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{pendientes.total === 1 ? "1 salida requiere supervisión" : `${pendientes.total} salidas requieren supervisión`}
              <span className="block font-normal">{pendientes.confirmacionRetiro} {pendientes.confirmacionRetiro === 1 ? "retiro" : "retiros"} por confirmar · {pendientes.revision} sin revisar</span></span>
          </p>
          <Button variant="outline" size="sm" className="min-h-10 shrink-0 rounded-xl" aria-pressed={filtros.pendienteSupervision} onClick={() => setFiltros((f) => ({ ...f, pendienteSupervision: !f.pendienteSupervision }))}>
            {filtros.pendienteSupervision ? "Ver todas" : "Ver pendientes"}
          </Button>
        </div>
      ) : (
        <p role="status" data-testid="egresos-sin-pendientes" className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"><CheckCircle2 className="h-4 w-4" aria-hidden="true" />No hay salidas pendientes de supervisión.</p>
      ))}

      {aviso && <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">{aviso}</p>}

      {registrando ? (
        <RegistrarEgresoDueno
          key={`${registrando.cajaFisicaId}|${JSON.stringify(registrando.inicial)}`}
          cajas={todasLasCajas}
          cajasCargando={cajas.isLoading}
          cajasError={cajas.isError}
          inicial={registrando.inicial}
          cajaInicial={registrando.cajaFisicaId}
          onRecargarCajas={() => void cajas.refetch()}
          onCancelar={() => setRegistrando(null)}
          onRegistrado={(egreso) => { setRegistrando(null); setAviso(`Egreso registrado (${referenciaSalida(egreso.id)}): ${formatoArs(egreso.importe)} de ${egreso.cajaNombre}.`); setAbierto(egreso.id); refrescar() }}
        />
      ) : (
        <Button className="min-h-11 w-full rounded-xl sm:w-auto" onClick={() => { setAviso(null); setRegistrando({ inicial: FORMULARIO_VACIO, cajaFisicaId: "" }) }}><Plus className="mr-1 h-4 w-4" />Registrar egreso</Button>
      )}

      <FiltrosPanel filtros={filtros} onChange={setFiltros} cajas={todasLasCajas} responsables={lista.data?.responsables ?? []} />

      {lista.isLoading ? <p className="text-sm text-muted-foreground">Cargando egresos…</p>
        : lista.isError ? <div role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm text-destructive">{lista.error.message} <Button variant="outline" size="sm" className="ml-2" onClick={() => void lista.refetch()}>Reintentar</Button></div>
        : egresos.length === 0 ? <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">No hay egresos para estos filtros.</p>
        : (
          <ul className="space-y-2" aria-label="Egresos de Caja" data-testid="lista-egresos">
            {egresos.map((e) => (
              <FilaEgreso
                key={e.id}
                egreso={e}
                abierto={abierto === e.id}
                onToggle={() => setAbierto(abierto === e.id ? null : e.id)}
                onAccionAbierta={setAccionAbierta}
                onCambio={refrescar}
                onRegistrarCorrecto={(inicial) => { setAviso(null); setRegistrando({ inicial, cajaFisicaId: e.cajaFisicaId }); window.scrollTo?.({ top: 0, behavior: "smooth" }) }}
              />
            ))}
          </ul>
        )}

      <ConfiguracionUmbral />
    </section>
  )
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

function FiltrosPanel({ filtros, onChange, cajas, responsables }: { filtros: FiltrosEgresos; onChange: (f: FiltrosEgresos) => void; cajas: CajaFisicaResumen[]; responsables: Array<{ id: string; nombre: string }> }) {
  const [visible, setVisible] = useState(false)
  const set = <K extends keyof FiltrosEgresos>(k: K, v: FiltrosEgresos[K]) => onChange({ ...filtros, [k]: v })
  const activos = Object.entries(filtros).filter(([k, v]) => v !== FILTROS_VACIOS[k as keyof FiltrosEgresos]).length
  const sel = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
  return (
    <div className="rounded-xl border bg-card">
      <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-sm font-semibold" aria-expanded={visible} aria-controls="egresos-filtros" onClick={() => setVisible((v) => !v)}>
        <span className="flex items-center gap-2"><Filter className="h-4 w-4" aria-hidden="true" />Filtros{activos > 0 ? ` (${activos} activos)` : ""}</span>
        {visible ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </button>
      {visible && (
        <div id="egresos-filtros" className="grid gap-3 border-t p-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1 text-sm font-medium" htmlFor="egresos-desde"><span>Desde</span><Input id="egresos-desde" type="date" value={filtros.desde} onChange={(e) => set("desde", e.target.value)} className="h-11 rounded-xl" /></label>
          <label className="space-y-1 text-sm font-medium" htmlFor="egresos-hasta"><span>Hasta (inclusive)</span><Input id="egresos-hasta" type="date" value={filtros.hasta} onChange={(e) => set("hasta", e.target.value)} className="h-11 rounded-xl" /></label>
          <label className="space-y-1 text-sm font-medium" htmlFor="egresos-caja"><span>Caja</span>
            <select id="egresos-caja" className={sel} value={filtros.cajaFisicaId} onChange={(e) => set("cajaFisicaId", e.target.value)}>
              <option value="">Todas</option>
              {cajas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></label>
          <label className="space-y-1 text-sm font-medium" htmlFor="egresos-responsable"><span>Registrado por</span>
            <select id="egresos-responsable" className={sel} value={filtros.empleadoId} onChange={(e) => set("empleadoId", e.target.value)}>
              <option value="">Todos</option>
              {responsables.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select></label>
          <label className="space-y-1 text-sm font-medium" htmlFor="egresos-tipo"><span>Tipo</span>
            <select id="egresos-tipo" className={sel} value={filtros.naturaleza} onChange={(e) => onChange({ ...filtros, naturaleza: e.target.value as FiltrosEgresos["naturaleza"], categoria: e.target.value && e.target.value !== "GASTO" ? "" : filtros.categoria })}>
              <option value="">Todos</option>
              {NATURALEZAS_SALIDA.map((n) => <option key={n.valor} value={n.valor}>{ESTILO_NATURALEZA[n.valor].titulo}</option>)}
            </select></label>
          <label className="space-y-1 text-sm font-medium" htmlFor="egresos-categoria"><span>Categoría (gastos)</span>
            <select id="egresos-categoria" className={sel} value={filtros.categoria} disabled={filtros.naturaleza !== "" && filtros.naturaleza !== "GASTO"} onChange={(e) => set("categoria", e.target.value)}>
              <option value="">Todas</option>
              {CATEGORIAS_SALIDA.map((c) => <option key={c.valor} value={c.valor}>{c.titulo}</option>)}
            </select></label>
          <label className="space-y-1 text-sm font-medium" htmlFor="egresos-revision"><span>Estado de revisión</span>
            <select id="egresos-revision" className={sel} value={filtros.estadoRevision} onChange={(e) => set("estadoRevision", e.target.value as FiltrosEgresos["estadoRevision"])}>
              <option value="">Todos</option>
              <option value="SIN_REVISAR">Sin revisar</option>
              <option value="REVISADO">Revisado</option>
              <option value="OBSERVADO">Observado</option>
            </select></label>
          <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium"><input type="checkbox" className="h-4 w-4" checked={filtros.pendienteSupervision} onChange={(e) => set("pendienteSupervision", e.target.checked)} />Sólo las que requieren supervisión</label>
          <Button variant="outline" className="min-h-11 rounded-xl sm:col-span-2 lg:col-span-4" disabled={activos === 0} onClick={() => onChange(FILTROS_VACIOS)}>Limpiar filtros</Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// One outflow: summary row + detail + actions
// ---------------------------------------------------------------------------

function FilaEgreso({ egreso: e, abierto, onToggle, onAccionAbierta, onCambio, onRegistrarCorrecto }: { egreso: EgresoDueno; abierto: boolean; onToggle: () => void; onAccionAbierta: (abierta: boolean) => void; onCambio: () => void; onRegistrarCorrecto: (inicial: FormularioSalida) => void }) {
  const detalleId = `egreso-detalle-${e.id}`
  return (
    <li className={cn("rounded-xl border bg-card", e.pendienteSupervision && "border-amber-400 dark:border-amber-600", e.compensacion && "opacity-90")} data-testid="egreso-fila" data-egreso-id={e.id}>
      <button type="button" className="flex w-full flex-col gap-1 p-3 text-left sm:flex-row sm:items-start sm:justify-between" aria-expanded={abierto} aria-controls={detalleId} onClick={onToggle}>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <NaturalezaBadge naturaleza={e.naturaleza} />
            {e.categoria && <span className={cn(PILL, PILL_NEUTRO)}>{TITULO_CATEGORIA[e.categoria] ?? e.categoria}</span>}
            {e.compensacion && <span className={cn(PILL, PILL_NEUTRO)}><Undo2 className="h-3 w-3" aria-hidden="true" />Compensado</span>}
            {e.pendienteSupervision && <span className={cn(PILL, "bg-amber-100 text-amber-950 ring-amber-400 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-600")}>Requiere supervisión</span>}
            {e.alertas.excedeEsperado && <span className={cn(PILL, PILL_ALERTA)}>Esperado negativo</span>}
            {e.alertas.superaUmbral && <span className={cn(PILL, PILL_ALERTA)}>Supera el umbral</span>}
          </div>
          <p className="break-words text-sm">{e.motivo}</p>
          <p className="text-xs text-muted-foreground">{fecha(e.createdAt)} · {e.cajaNombre} · {e.registradoPor.nombre} · {referenciaSalida(e.id)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
          <p className={cn("text-base font-bold tabular-nums", e.compensacion && "line-through decoration-2")}>{formatoArs(e.importe)}</p>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">{abierto ? "Ocultar" : "Ver detalle"}{abierto ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}</span>
        </div>
      </button>
      {abierto && <DetalleEgreso id={detalleId} egreso={e} onAccionAbierta={onAccionAbierta} onCambio={onCambio} onRegistrarCorrecto={onRegistrarCorrecto} />}
    </li>
  )
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-words text-sm font-medium">{children}</dd></div>
}

function DetalleEgreso({ id, egreso: e, onAccionAbierta, onCambio, onRegistrarCorrecto }: { id: string; egreso: EgresoDueno; onAccionAbierta: (abierta: boolean) => void; onCambio: () => void; onRegistrarCorrecto: (inicial: FormularioSalida) => void }) {
  const [accion, setAccion] = useState<null | "revision" | "confirmacion" | "compensacion">(null)
  useEffect(() => {
    onAccionAbierta(accion !== null)
    return () => onAccionAbierta(false)
  }, [accion, onAccionAbierta])
  const [exito, setExito] = useState<string | null>(null)
  const eventos = useMemo(() => {
    const items: Array<{ en: string; titulo: string; texto?: string | null }> = [
      { en: e.createdAt, titulo: `Registrado por ${e.registradoPor.nombre}: ${formatoArs(e.importe)} sale de ${e.cajaNombre}` },
      ...e.historial.map((h) => ({
        en: h.createdAt,
        titulo: h.accion === "REVISION" ? `Revisión: ${TITULO_REVISION[h.resultado] ?? h.resultado}` : `Recepción del retiro: ${h.resultado === "CONFIRMADO" ? "confirmada" : "informada como no recibida"}`,
        texto: h.observacion,
      })),
      ...(e.compensacion ? [{ en: e.compensacion.createdAt, titulo: `Compensación: ${formatoArs(e.compensacion.importe)} vuelven al efectivo esperado del turno`, texto: e.compensacion.motivo }] : []),
    ]
    return items.sort((a, b) => a.en.localeCompare(b.en))
  }, [e])

  const correcto = (): FormularioSalida => ({
    ...FORMULARIO_VACIO,
    naturaleza: e.naturaleza,
    categoria: (e.categoria ?? "") as FormularioSalida["categoria"],
    motivo: e.motivo,
    proveedorNombre: e.proveedorNombre ?? "",
    proveedorIdentificacion: e.proveedorIdentificacion ?? "",
    comprobanteReferencia: e.comprobanteReferencia ?? "",
    destinatarioTipo: (e.destinatarioTipo ?? "") as FormularioSalida["destinatarioTipo"],
    destinatarioNombre: e.destinatarioNombre ?? "",
  })
  const hecho = (texto: string) => { setAccion(null); setExito(texto); onCambio() }

  return (
    <div id={id} className="space-y-3 border-t p-3">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Dato label="Importe">{formatoArs(e.importe)}</Dato>
        <Dato label="Tipo">{ESTILO_NATURALEZA[e.naturaleza].titulo}{e.categoria ? ` · ${TITULO_CATEGORIA[e.categoria] ?? e.categoria}` : ""}</Dato>
        <Dato label="Fecha">{fecha(e.createdAt)}</Dato>
        <Dato label="Caja">{e.cajaNombre} · turno {e.turnoAbierto ? "abierto" : "cerrado"}</Dato>
        <Dato label="Responsable">{e.registradoPor.nombre}</Dato>
        {e.naturaleza === "RETIRO_DUENO"
          ? <Dato label="Recibió">{e.destinatarioNombre}{e.destinatarioTipo ? ` (${TITULO_DESTINATARIO[e.destinatarioTipo] ?? e.destinatarioTipo})` : ""}</Dato>
          : <Dato label="Proveedor">{e.proveedorNombre ? `${e.proveedorNombre}${e.proveedorIdentificacion ? ` · ${e.proveedorIdentificacion}` : ""}` : "—"}</Dato>}
        {e.naturaleza !== "RETIRO_DUENO" && <Dato label="Comprobante">{e.comprobanteReferencia ?? "—"}</Dato>}
        <Dato label="Revisión">{TITULO_REVISION[e.revision.estado]}</Dato>
        {e.confirmacionRetiro && e.confirmacionRetiro.estado !== "NO_REQUERIDA" && <Dato label="Recepción del retiro">{TITULO_CONFIRMACION[e.confirmacionRetiro.estado]}</Dato>}
        <div className="col-span-2 sm:col-span-3"><Dato label="Motivo">{e.motivo}</Dato></div>
      </dl>
      {e.naturaleza === "PAGO_PROVEEDOR" && <p className="rounded-lg bg-violet-50 p-2 text-xs text-violet-950 dark:bg-violet-950/40 dark:text-violet-100">Un pago a proveedor cancela una compra o una deuda: no se suma como gasto de rentabilidad.</p>}
      {e.naturaleza === "PAGO_PROVEEDOR" && (
        <p className="rounded-lg border border-violet-200 p-2 text-xs dark:border-violet-800" data-testid="vinculo-proveedor">
          {e.vinculoProveedor ? <>Vinculado a la cuenta de <span className="font-semibold">{e.vinculoProveedor.proveedorNombre}</span> (Proveedores).</> : "Todavía no está vinculado a la cuenta de un proveedor. Podés vincularlo desde Proveedores."}
        </p>
      )}
      {e.naturaleza === "RETIRO_DUENO" && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">Un retiro del dueño no es un gasto del negocio.</p>}
      {(e.alertas.excedeEsperado || e.alertas.superaUmbral) && (
        <div role="note" className="rounded-lg border border-rose-300 bg-rose-50 p-2 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          {e.alertas.excedeEsperado && <p>El efectivo esperado del turno quedó negativo: {formatoArs(e.alertas.efectivoEsperadoPrevio)} antes, {formatoArs(e.alertas.efectivoEsperadoResultante)} después.</p>}
          {e.alertas.superaUmbral && e.alertas.umbralAviso !== null && <p>Alcanza el umbral de aviso de {formatoArs(e.alertas.umbralAviso)}.</p>}
          {e.justificacion && <p className="mt-1">Justificación: {e.justificacion}</p>}
        </div>
      )}

      <div>
        <h5 className="text-sm font-semibold">Historial</h5>
        <ol className="mt-1 space-y-1.5" aria-label="Historial del egreso">
          {eventos.map((ev, i) => <li key={i} className="rounded-lg bg-muted/40 p-2 text-sm"><p className="font-medium">{ev.titulo}</p><p className="text-xs text-muted-foreground">{fecha(ev.en)}</p>{ev.texto && <p className="mt-1 whitespace-pre-wrap break-words">{ev.texto}</p>}</li>)}
        </ol>
      </div>

      {exito && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">{exito}</p>}

      {accion === null && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => { setExito(null); setAccion("revision") }}>{e.revision.estado === "SIN_REVISAR" ? "Revisar" : "Agregar revisión"}</Button>
          {e.confirmacionRetiro?.estado === "PENDIENTE" && !e.compensacion && <Button className="min-h-11 rounded-xl" onClick={() => { setExito(null); setAccion("confirmacion") }}>Confirmar recepción del retiro</Button>}
          {e.compensacionDisponible && <Button variant="outline" className="min-h-11 rounded-xl border-rose-300 text-rose-800 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-200" onClick={() => { setExito(null); setAccion("compensacion") }}><Undo2 className="mr-1 h-4 w-4" />Corregir con compensación</Button>}
          {e.compensacion && e.turnoAbierto && <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => onRegistrarCorrecto(correcto())}>Registrar la salida correcta</Button>}
        </div>
      )}
      {e.compensacionBloqueada === "VINCULADO_A_PROVEEDOR" && accion === null && (
        <p className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground" data-testid="compensacion-bloqueada-proveedor">Este pago está vinculado a la cuenta de un proveedor: para compensarlo, primero desvinculalo en Proveedores (con su motivo).</p>
      )}
      {e.compensacionBloqueada === "TURNO_CERRADO" && accion === null && (
        <p className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground" data-testid="compensacion-bloqueada">El turno de esta salida ya cerró: la corrección con dinero después del cierre todavía no está habilitada, porque el efectivo de ese turno ya se contó y se entregó. Si hay un error, dejá una observación.</p>
      )}
      {accion === "revision" && <FormRevision egreso={e} onCancelar={() => setAccion(null)} onHecho={() => hecho("Revisión registrada. No modificó dinero.")} />}
      {accion === "confirmacion" && <FormConfirmacion egreso={e} onCancelar={() => setAccion(null)} onHecho={(r) => hecho(r === "CONFIRMADO" ? "Recepción confirmada. No se generó otro movimiento: el efectivo ya había salido de la caja." : "Quedó registrado que no recibiste el efectivo. No se generó ningún movimiento.")} />}
      {accion === "compensacion" && <FormCompensacion egreso={e} onCancelar={() => setAccion(null)} onHecho={() => hecho(`Compensación registrada: ${formatoArs(e.importe)} vuelven al efectivo esperado de ${e.cajaNombre}. La salida original se conserva.`)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Owner decisions
// ---------------------------------------------------------------------------

function useEnvio() {
  const intentos = useIntentos()
  const [estado, setEstado] = useState<{ enviando: boolean; error: string | null; incierto: boolean }>({ enviando: false, error: null, incierto: false })
  const enCurso = useRef(false)
  const ejecutar = async (url: string, body: Record<string, unknown>, onOk: (json: Record<string, unknown>) => void) => {
    if (enCurso.current) return
    enCurso.current = true
    const canonico = `${url}|${JSON.stringify(body)}`
    setEstado({ enviando: true, error: null, incierto: false })
    const r = await enviar(url, body, intentos.clave(canonico))
    enCurso.current = false
    if (r.ok) { intentos.olvidar(canonico); setEstado({ enviando: false, error: null, incierto: false }); onOk(r.json); return }
    if (!r.incierto) intentos.olvidar(canonico)
    setEstado({ enviando: false, error: r.error, incierto: r.incierto })
  }
  return { ...estado, ejecutar }
}

function FormRevision({ egreso, onCancelar, onHecho }: { egreso: EgresoDueno; onCancelar: () => void; onHecho: () => void }) {
  const [resultado, setResultado] = useState<"REVISADO" | "OBSERVADO" | "">("")
  const [observacion, setObservacion] = useState("")
  const envio = useEnvio()
  const id = `revision-${egreso.id}`
  const faltaObs = resultado === "OBSERVADO" && !observacion.trim()
  return (
    <form className="space-y-2 rounded-lg border p-3" aria-labelledby={`${id}-titulo`} onSubmit={(ev) => { ev.preventDefault(); if (!resultado || faltaObs) return; void envio.ejecutar(`/api/negocio/caja/egresos/${encodeURIComponent(egreso.id)}/revision`, { resultado, observacion: observacion.trim() || null }, onHecho) }}>
      <p id={`${id}-titulo`} className="text-sm font-semibold">Revisión administrativa</p>
      <p className="text-xs text-muted-foreground">No modifica dinero. Queda en el historial junto con las anteriores.</p>
      <fieldset className="flex flex-wrap gap-3" disabled={envio.enviando || envio.incierto}>
        <legend className="sr-only">Resultado</legend>
        {(["REVISADO", "OBSERVADO"] as const).map((v) => <label key={v} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`${id}-resultado`} value={v} checked={resultado === v} onChange={() => setResultado(v)} className="h-4 w-4" />{v === "REVISADO" ? "Revisado, está bien" : "Observado"}</label>)}
      </fieldset>
      <label className="block space-y-1 text-sm font-medium" htmlFor={`${id}-obs`}><span>Observación{resultado === "OBSERVADO" ? " (obligatoria)" : " (opcional)"}</span>
        <Textarea id={`${id}-obs`} value={observacion} maxLength={500} onChange={(ev) => setObservacion(ev.target.value)} disabled={envio.enviando || envio.incierto} aria-invalid={faltaObs || undefined} /></label>
      {envio.error && <p role="alert" className="text-sm text-destructive">{envio.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={envio.enviando || envio.incierto} onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" className="min-h-11 rounded-xl" disabled={envio.enviando || !resultado || faltaObs}>{envio.enviando ? "Guardando…" : envio.incierto ? "Reintentar" : "Guardar revisión"}</Button>
      </div>
    </form>
  )
}

function FormConfirmacion({ egreso, onCancelar, onHecho }: { egreso: EgresoDueno; onCancelar: () => void; onHecho: (resultado: "CONFIRMADO" | "NO_RECIBIDO") => void }) {
  const [resultado, setResultado] = useState<"CONFIRMADO" | "NO_RECIBIDO" | "">("")
  const [observacion, setObservacion] = useState("")
  const envio = useEnvio()
  const id = `confirmacion-${egreso.id}`
  const faltaObs = resultado === "NO_RECIBIDO" && !observacion.trim()
  return (
    <form className="space-y-2 rounded-lg border border-amber-300 p-3 dark:border-amber-700" aria-labelledby={`${id}-titulo`} onSubmit={(ev) => { ev.preventDefault(); if (!resultado || faltaObs) return; void envio.ejecutar(`/api/negocio/caja/egresos/${encodeURIComponent(egreso.id)}/confirmacion-retiro`, { resultado, observacion: observacion.trim() || null }, () => onHecho(resultado as "CONFIRMADO" | "NO_RECIBIDO")) }}>
      <p id={`${id}-titulo`} className="text-sm font-semibold">¿Recibiste {formatoArs(egreso.importe)} de {egreso.registradoPor.nombre}?</p>
      <p className="text-xs text-muted-foreground">Recibió: {egreso.destinatarioNombre}. Se registra una sola vez y no genera otro movimiento: el efectivo ya salió de la caja cuando se registró el retiro.</p>
      <fieldset className="flex flex-wrap gap-3" disabled={envio.enviando || envio.incierto}>
        <legend className="sr-only">Recepción</legend>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`${id}-r`} checked={resultado === "CONFIRMADO"} onChange={() => setResultado("CONFIRMADO")} className="h-4 w-4" />Sí, lo recibí</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`${id}-r`} checked={resultado === "NO_RECIBIDO"} onChange={() => setResultado("NO_RECIBIDO")} className="h-4 w-4" />No lo recibí</label>
      </fieldset>
      <label className="block space-y-1 text-sm font-medium" htmlFor={`${id}-obs`}><span>Observación{resultado === "NO_RECIBIDO" ? " (obligatoria)" : " (opcional)"}</span>
        <Textarea id={`${id}-obs`} value={observacion} maxLength={500} onChange={(ev) => setObservacion(ev.target.value)} disabled={envio.enviando || envio.incierto} aria-invalid={faltaObs || undefined} /></label>
      {envio.error && <p role="alert" className="text-sm text-destructive">{envio.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={envio.enviando || envio.incierto} onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" className="min-h-11 rounded-xl" disabled={envio.enviando || !resultado || faltaObs}>{envio.enviando ? "Guardando…" : envio.incierto ? "Reintentar" : "Registrar recepción"}</Button>
      </div>
    </form>
  )
}

function FormCompensacion({ egreso, onCancelar, onHecho }: { egreso: EgresoDueno; onCancelar: () => void; onHecho: () => void }) {
  const [motivo, setMotivo] = useState("")
  const [efectivoEnCaja, setEfectivoEnCaja] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const envio = useEnvio()
  const id = `compensacion-${egreso.id}`
  const listo = motivo.trim().length > 0 && efectivoEnCaja
  return (
    <form className="space-y-2 rounded-lg border-2 border-rose-300 p-3 dark:border-rose-700" aria-labelledby={`${id}-titulo`} onSubmit={(ev) => { ev.preventDefault(); if (!listo) return; if (!confirmando) { setConfirmando(true); return } void envio.ejecutar(`/api/negocio/caja/egresos/${encodeURIComponent(egreso.id)}/compensacion`, { motivo: motivo.trim(), confirmoEfectivoEnCaja: true }, onHecho) }}>
      <p id={`${id}-titulo`} className="text-sm font-semibold">Corregir con una compensación</p>
      <p className="text-xs text-muted-foreground">Se registra una operación que devuelve {formatoArs(egreso.importe)} al efectivo esperado del turno de {egreso.cajaNombre}. La salida original no se borra ni se modifica. Usala sólo si ese efectivo nunca salió o ya volvió a la caja; para corregir el importe o el tipo, compensá y después registrá la salida correcta.</p>
      <label className="block space-y-1 text-sm font-medium" htmlFor={`${id}-motivo`}><span>Motivo (obligatorio)</span>
        <Textarea id={`${id}-motivo`} value={motivo} maxLength={500} onChange={(ev) => { setMotivo(ev.target.value); setConfirmando(false) }} disabled={envio.enviando || envio.incierto} /></label>
      <label className="flex items-start gap-2 text-sm font-medium"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={efectivoEnCaja} onChange={(ev) => { setEfectivoEnCaja(ev.target.checked); setConfirmando(false) }} disabled={envio.enviando || envio.incierto} /><span>Confirmo que {formatoArs(egreso.importe)} de esta salida están físicamente en {egreso.cajaNombre}.</span></label>
      {confirmando && !envio.error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm font-semibold text-rose-950 dark:bg-rose-950/40 dark:text-rose-100">¿Confirmás la compensación de {formatoArs(egreso.importe)}? No se puede deshacer y se hace una sola vez.</p>}
      {envio.error && <p role="alert" className="text-sm text-destructive">{envio.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={envio.enviando || envio.incierto} onClick={confirmando ? () => setConfirmando(false) : onCancelar}>{confirmando ? "Volver" : "Cancelar"}</Button>
        <Button type="submit" className="min-h-11 rounded-xl bg-rose-700 text-white hover:bg-rose-800" disabled={envio.enviando || !listo}>{envio.enviando ? "Registrando…" : envio.incierto ? "Reintentar" : confirmando ? "Confirmar compensación" : "Continuar"}</Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Owner registration (explicit register + confirmation)
// ---------------------------------------------------------------------------

function RegistrarEgresoDueno({ cajas, cajasCargando, cajasError, inicial, cajaInicial, onRecargarCajas, onCancelar, onRegistrado }: {
  cajas: CajaFisicaResumen[]
  cajasCargando: boolean
  cajasError: boolean
  inicial: FormularioSalida
  cajaInicial: string
  onRecargarCajas: () => void
  onCancelar: () => void
  onRegistrado: (egreso: EgresoDueno) => void
}) {
  const abiertas = cajas.filter((c) => c.activa && c.turnoAbierto)
  const [cajaId, setCajaId] = useState(() => (abiertas.some((c) => c.id === cajaInicial) ? cajaInicial : ""))
  const [form, setForm] = useState<FormularioSalida>(inicial)
  const [errores, setErrores] = useState<Partial<Record<CampoSalida | "caja", string>>>({})
  const [paso, setPaso] = useState<"formulario" | "confirmar">("formulario")
  const [justificacion, setJustificacion] = useState("")
  const [requiereJustificacion, setRequiereJustificacion] = useState<{ previo: string; resultante: string } | null>(null)
  const caja = abiertas.find((c) => c.id === cajaId) ?? null
  const set = <K extends keyof FormularioSalida>(k: K, v: FormularioSalida[K]) => { setForm((f) => ({ ...f, [k]: v })); setErrores((e) => ({ ...e, [k]: undefined })) }
  const tituloRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { tituloRef.current?.focus() }, [paso])

  const validado = validarSalida(form)
  const continuar = () => {
    const errs: Partial<Record<CampoSalida | "caja", string>> = validado.ok ? {} : { ...validado.errores }
    if (!caja) errs.caja = "Elegí la caja de la que sale el efectivo."
    setErrores(errs)
    if (Object.keys(errs).length === 0) setPaso("confirmar")
  }
  const sel = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
  const err = (campo: CampoSalida | "caja") => errores[campo] ? <p id={`egreso-dueno-${campo}-error`} className="text-xs font-medium text-destructive">{errores[campo]}</p> : null
  const describe = (campo: CampoSalida | "caja") => (errores[campo] ? `egreso-dueno-${campo}-error` : undefined)
  const conProveedor = form.naturaleza === "GASTO" || form.naturaleza === "PAGO_PROVEEDOR"

  if (paso === "confirmar" && validado.ok && caja?.turnoAbierto) {
    return (
      <ConfirmarEgresoDueno
        tituloRef={tituloRef}
        caja={caja}
        cuerpo={validado.cuerpo}
        justificacion={justificacion}
        onJustificacion={setJustificacion}
        requiereJustificacion={requiereJustificacion}
        onRequiereJustificacion={setRequiereJustificacion}
        onVolver={() => setPaso("formulario")}
        onRegistrado={onRegistrado}
        onTurnoCambio={() => { setCajaId(""); setPaso("formulario"); setErrores({ caja: "El turno de esa caja cambió. Elegí la caja de nuevo." }); onRecargarCajas() }}
      />
    )
  }

  return (
    <form className="space-y-3 rounded-2xl border-2 border-primary/30 bg-card p-4" aria-labelledby="egreso-dueno-titulo" noValidate onSubmit={(ev) => { ev.preventDefault(); continuar() }}>
      <h4 id="egreso-dueno-titulo" ref={tituloRef} tabIndex={-1} className="text-base font-bold outline-none">Registrar egreso</h4>
      <label className="block space-y-1 text-sm font-medium" htmlFor="egreso-dueno-caja"><span>¿De qué caja sale el efectivo?</span>
        {cajasCargando ? <p className="text-sm text-muted-foreground">Cargando cajas…</p>
          : cajasError ? <p role="alert" className="text-sm text-destructive">No se pudieron cargar las cajas. <Button type="button" variant="outline" size="sm" onClick={onRecargarCajas}>Reintentar</Button></p>
          : abiertas.length === 0 ? <p role="alert" className="rounded-lg bg-muted/50 p-2 text-sm">No hay cajas con turno abierto. Para registrar un egreso, abrí un turno en «Cajas y turnos».</p>
          : <select id="egreso-dueno-caja" className={sel} value={cajaId} onChange={(ev) => { setCajaId(ev.target.value); setErrores((e) => ({ ...e, caja: undefined })) }} aria-invalid={Boolean(errores.caja) || undefined} aria-describedby={describe("caja")}>
              <option value="">Elegí una caja…</option>
              {abiertas.map((c) => <option key={c.id} value={c.id}>{c.nombre} — turno de {c.turnoAbierto?.responsableNombre}</option>)}
            </select>}
        {err("caja")}
      </label>
      {caja && <p className="text-xs text-muted-foreground">El efectivo sale del turno de {caja.turnoAbierto?.responsableNombre} en {caja.nombre}. No se elige otra caja automáticamente.</p>}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tipo de egreso</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {NATURALEZAS_SALIDA.map((n) => (
            <label key={n.valor} className={cn("flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm", form.naturaleza === n.valor && "ring-2 ring-primary")}>
              <input type="radio" name="egreso-dueno-naturaleza" id={`egreso-dueno-naturaleza-${n.valor}`} value={n.valor} checked={form.naturaleza === n.valor} onChange={() => setForm((f) => ({ ...f, naturaleza: n.valor, categoria: n.valor === "GASTO" ? f.categoria : "" }))} className="mt-0.5 h-4 w-4" aria-labelledby={`egreso-dueno-naturaleza-${n.valor}-titulo`} aria-describedby={`egreso-dueno-naturaleza-${n.valor}-ayuda`} />
              <span className="min-w-0"><span id={`egreso-dueno-naturaleza-${n.valor}-titulo`} className="flex items-center gap-1.5 font-semibold"><IconoNaturaleza naturaleza={n.valor} />{ESTILO_NATURALEZA[n.valor].titulo}</span><span id={`egreso-dueno-naturaleza-${n.valor}-ayuda`} className="block text-xs text-muted-foreground">{n.ayuda}</span></span>
            </label>
          ))}
        </div>
        {err("naturaleza")}
      </fieldset>

      {form.naturaleza === "GASTO" && (
        <label className="block space-y-1 text-sm font-medium" htmlFor="egreso-dueno-categoria"><span>Categoría del gasto</span>
          <select id="egreso-dueno-categoria" className={sel} value={form.categoria} onChange={(ev) => set("categoria", ev.target.value as FormularioSalida["categoria"])} aria-invalid={Boolean(errores.categoria) || undefined} aria-describedby={describe("categoria")}>
            <option value="">Elegí una categoría…</option>
            {CATEGORIAS_SALIDA.map((c) => <option key={c.valor} value={c.valor}>{c.titulo}</option>)}
          </select>{err("categoria")}</label>
      )}

      <label className="block space-y-1 text-sm font-medium" htmlFor="egreso-dueno-importe"><span>Importe en pesos</span>
        <Input id="egreso-dueno-importe" inputMode="decimal" autoComplete="off" value={form.importe} onChange={(ev) => set("importe", ev.target.value)} className="h-11 rounded-xl" aria-invalid={Boolean(errores.importe) || undefined} aria-describedby={describe("importe")} />{err("importe")}</label>
      <label className="block space-y-1 text-sm font-medium" htmlFor="egreso-dueno-motivo"><span>Motivo</span>
        <Textarea id="egreso-dueno-motivo" value={form.motivo} maxLength={500} onChange={(ev) => set("motivo", ev.target.value)} aria-invalid={Boolean(errores.motivo) || undefined} aria-describedby={describe("motivo")} />{err("motivo")}</label>

      {conProveedor && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm font-medium" htmlFor="egreso-dueno-proveedor"><span>Proveedor (opcional)</span><Input id="egreso-dueno-proveedor" value={form.proveedorNombre} maxLength={120} onChange={(ev) => set("proveedorNombre", ev.target.value)} className="h-11 rounded-xl" />{err("proveedorNombre")}</label>
          {form.naturaleza === "PAGO_PROVEEDOR" && <label className="block space-y-1 text-sm font-medium" htmlFor="egreso-dueno-cuit"><span>CUIT o identificación (opcional)</span><Input id="egreso-dueno-cuit" value={form.proveedorIdentificacion} maxLength={40} onChange={(ev) => set("proveedorIdentificacion", ev.target.value)} className="h-11 rounded-xl" />{err("proveedorIdentificacion")}</label>}
          <label className="block space-y-1 text-sm font-medium" htmlFor="egreso-dueno-comprobante"><span>Comprobante (opcional)</span><Input id="egreso-dueno-comprobante" value={form.comprobanteReferencia} maxLength={120} onChange={(ev) => set("comprobanteReferencia", ev.target.value)} className="h-11 rounded-xl" />{err("comprobanteReferencia")}</label>
        </div>
      )}
      {form.naturaleza === "RETIRO_DUENO" && (
        <div className="space-y-2">
          <fieldset className="flex flex-wrap gap-3">
            <legend className="text-sm font-medium">¿Quién recibe el efectivo?</legend>
            {DESTINATARIOS_SALIDA.map((d) => <label key={d.valor} className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name="egreso-dueno-destinatario" id={`egreso-dueno-destinatario-${d.valor}`} checked={form.destinatarioTipo === d.valor} onChange={() => set("destinatarioTipo", d.valor)} className="h-4 w-4" />{d.titulo}</label>)}
          </fieldset>{err("destinatarioTipo")}
          <label className="block space-y-1 text-sm font-medium" htmlFor="egreso-dueno-destinatario-nombre"><span>Nombre de quien recibe</span><Input id="egreso-dueno-destinatario-nombre" value={form.destinatarioNombre} maxLength={120} onChange={(ev) => set("destinatarioNombre", ev.target.value)} className="h-11 rounded-xl" aria-invalid={Boolean(errores.destinatarioNombre) || undefined} aria-describedby={describe("destinatarioNombre")} />{err("destinatarioNombre")}</label>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" className="min-h-11 rounded-xl" disabled={abiertas.length === 0}>Revisar y confirmar</Button>
      </div>
    </form>
  )
}

function ConfirmarEgresoDueno({ tituloRef, caja, cuerpo, justificacion, onJustificacion, requiereJustificacion, onRequiereJustificacion, onVolver, onRegistrado, onTurnoCambio }: {
  tituloRef: React.RefObject<HTMLHeadingElement | null>
  caja: CajaFisicaResumen
  cuerpo: Record<string, string>
  justificacion: string
  onJustificacion: (v: string) => void
  requiereJustificacion: { previo: string; resultante: string } | null
  onRequiereJustificacion: (v: { previo: string; resultante: string } | null) => void
  onVolver: () => void
  onRegistrado: (egreso: EgresoDueno) => void
  onTurnoCambio: () => void
}) {
  const intentos = useIntentos()
  const [estado, setEstado] = useState<{ enviando: boolean; error: string | null; incierto: boolean }>({ enviando: false, error: null, incierto: false })
  const enCurso = useRef(false)
  const naturaleza = cuerpo.naturaleza as NaturalezaSalida
  const faltaJustificacion = Boolean(requiereJustificacion) && !justificacion.trim()

  const confirmar = async () => {
    if (enCurso.current || faltaJustificacion || !caja.turnoAbierto) return
    enCurso.current = true
    const body: Record<string, unknown> = { ...cuerpo, cajaFisicaId: caja.id, turnoCajaId: caja.turnoAbierto.id, ...(requiereJustificacion ? { justificacion: justificacion.trim() } : {}) }
    const canonico = JSON.stringify(body)
    setEstado({ enviando: true, error: null, incierto: false })
    const r = await enviar("/api/negocio/caja/egresos", body, intentos.clave(canonico))
    enCurso.current = false
    if (r.ok) { intentos.olvidar(canonico); onRegistrado(r.json.egreso as EgresoDueno); return }
    if (!r.incierto) intentos.olvidar(canonico)
    if (r.code === "JUSTIFICACION_REQUERIDA" && r.detalle) {
      onRequiereJustificacion({ previo: String(r.detalle.esperadoPrevio ?? ""), resultante: String(r.detalle.esperadoResultante ?? "") })
      setEstado({ enviando: false, error: null, incierto: false })
      return
    }
    if (r.code === "TURNO_CAMBIO" || r.code === "TURNO_REQUERIDO" || r.code === "TURNO_NO_DISPONIBLE") { onTurnoCambio(); return }
    setEstado({ enviando: false, error: r.error, incierto: r.incierto })
  }

  const filas: Array<[string, string]> = [
    ["Caja", `${caja.nombre} — turno de ${caja.turnoAbierto?.responsableNombre ?? ""}`],
    ["Tipo", `${ESTILO_NATURALEZA[naturaleza].titulo}${cuerpo.categoria ? ` · ${TITULO_CATEGORIA[cuerpo.categoria] ?? cuerpo.categoria}` : ""}`],
    ["Motivo", cuerpo.motivo],
    ...(cuerpo.proveedorNombre ? [["Proveedor", `${cuerpo.proveedorNombre}${cuerpo.proveedorIdentificacion ? ` · ${cuerpo.proveedorIdentificacion}` : ""}`] as [string, string]] : []),
    ...(cuerpo.comprobanteReferencia ? [["Comprobante", cuerpo.comprobanteReferencia] as [string, string]] : []),
    ...(cuerpo.destinatarioNombre ? [["Recibe", `${cuerpo.destinatarioNombre} (${TITULO_DESTINATARIO[cuerpo.destinatarioTipo] ?? ""})`] as [string, string]] : []),
  ]
  return (
    <section className="space-y-3 rounded-2xl border-2 border-primary bg-card p-4" aria-labelledby="egreso-dueno-confirmar-titulo">
      <h4 id="egreso-dueno-confirmar-titulo" ref={tituloRef} tabIndex={-1} className="text-base font-bold outline-none">Confirmá el egreso</h4>
      <p className="text-3xl font-extrabold tabular-nums">{formatoArs(cuerpo.importe)}</p>
      <dl className="space-y-1.5">{filas.map(([k, v]) => <div key={k} className="flex flex-col sm:flex-row sm:gap-2"><dt className="text-xs text-muted-foreground sm:w-28 sm:shrink-0 sm:text-sm">{k}</dt><dd className="break-words text-sm font-medium">{v}</dd></div>)}</dl>
      <p className="rounded-lg bg-muted/50 p-2 text-xs">El efectivo sale de {caja.nombre} al confirmar y baja el efectivo esperado de ese turno.</p>
      {requiereJustificacion && (
        <div role="alert" className="space-y-2 rounded-lg border border-rose-300 bg-rose-50 p-2 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100">
          <p>Esta salida deja el efectivo esperado del turno en negativo: {formatoArs(requiereJustificacion.previo)} antes, {formatoArs(requiereJustificacion.resultante)} después. No se registró nada todavía.</p>
          <label className="block space-y-1 font-medium" htmlFor="egreso-dueno-justificacion"><span>Justificación (obligatoria)</span>
            <Textarea id="egreso-dueno-justificacion" value={justificacion} maxLength={500} onChange={(ev) => onJustificacion(ev.target.value)} disabled={estado.enviando || estado.incierto} /></label>
        </div>
      )}
      {estado.error && <p role="alert" className="text-sm text-destructive">{estado.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={estado.enviando || estado.incierto} onClick={onVolver}>Volver a editar</Button>
        <Button type="button" className="min-h-11 rounded-xl" disabled={estado.enviando || faltaJustificacion} onClick={() => void confirmar()}>{estado.enviando ? "Registrando…" : estado.incierto ? "Reintentar" : "Confirmar egreso"}</Button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Notice threshold (optional, informative)
// ---------------------------------------------------------------------------

function ConfiguracionUmbral() {
  const [valor, setValor] = useState<string | null>(null)
  const [actual, setActual] = useState<number | null | undefined>(undefined)
  const [estado, setEstado] = useState<{ guardando: boolean; mensaje: string | null; error: string | null }>({ guardando: false, mensaje: null, error: null })
  useEffect(() => {
    let vivo = true
    fetch("/api/negocio/caja/configuracion-egresos", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { umbralAviso?: number | null }) => { if (vivo) setActual(j.umbralAviso ?? null) })
      .catch(() => { if (vivo) setActual(null) })
    return () => { vivo = false }
  }, [])
  const texto = valor ?? (actual ? String(actual).replace(".", ",") : "")
  const guardar = async () => {
    let umbralAviso: string | null = null
    if (texto.trim()) {
      const p = parseImporteArs(texto)
      if (!p.ok) { setEstado({ guardando: false, mensaje: null, error: p.error }); return }
      umbralAviso = p.valor
    }
    setEstado({ guardando: true, mensaje: null, error: null })
    try {
      const r = await fetch("/api/negocio/caja/configuracion-egresos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ umbralAviso }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setEstado({ guardando: false, mensaje: null, error: j.error ?? "No se pudo guardar." }); return }
      setActual(j.umbralAviso ?? null)
      setValor(null)
      setEstado({ guardando: false, mensaje: j.umbralAviso ? `Umbral guardado: ${formatoArs(j.umbralAviso)}.` : "Sin umbral: sólo los retiros y el esperado negativo se marcan como prioritarios.", error: null })
    } catch {
      setEstado({ guardando: false, mensaje: null, error: "No pudimos guardar por un problema de conexión." })
    }
  }
  return (
    <div className="space-y-2 rounded-xl border bg-card p-3">
      <label className="block space-y-1 text-sm font-medium" htmlFor="egresos-umbral"><span>Aviso por importe (opcional)</span>
        <span className="block text-xs font-normal text-muted-foreground">Recibís un aviso prioritario cuando un empleado registra una salida de este importe o más. No bloquea ninguna salida.</span>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="egresos-umbral" inputMode="decimal" placeholder="Sin umbral" value={texto} disabled={actual === undefined || estado.guardando} onChange={(ev) => setValor(ev.target.value)} className="h-11 rounded-xl" />
          <Button type="button" variant="outline" className="min-h-11 shrink-0 rounded-xl" disabled={actual === undefined || estado.guardando} onClick={() => void guardar()}>{estado.guardando ? "Guardando…" : "Guardar"}</Button>
        </div>
      </label>
      {estado.error && <p role="alert" className="text-sm text-destructive">{estado.error}</p>}
      {estado.mensaje && <p role="status" className="text-sm text-muted-foreground">{estado.mensaje}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared owner-only report pieces (shift detail and daily summary)
// ---------------------------------------------------------------------------

export type EgresosHoy = Record<NaturalezaSalida, { cantidad: number; importe: number; cantidadCompensaciones: number; compensado: number }> & { gastosPorCategoria: Record<string, number> }

/** Daily summary of cash outflows by nature (never one combined "expense" figure). */
export function ResumenEgresosHoy({ egresos }: { egresos: EgresosHoy }) {
  const tarjetas: Array<{ nat: NaturalezaSalida; titulo: string; nota: string }> = [
    { nat: "GASTO", titulo: "Gastos operativos", nota: "Gastos del negocio." },
    { nat: "PAGO_PROVEEDOR", titulo: "Pagos a proveedores", nota: "Cancelan compras: no se cuentan como gasto de rentabilidad." },
    { nat: "RETIRO_DUENO", titulo: "Retiros del dueño", nota: "No es un gasto del negocio." },
  ]
  const totalCompensado = egresos.GASTO.compensado + egresos.PAGO_PROVEEDOR.compensado + egresos.RETIRO_DUENO.compensado
  const categorias = Object.entries(egresos.gastosPorCategoria)
  return (
    <section className="space-y-2" aria-label="Egresos de Caja de hoy" data-testid="resumen-egresos-hoy">
      <p className="text-xs font-semibold text-muted-foreground">Egresos de Caja de hoy</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {tarjetas.map(({ nat, titulo, nota }) => (
          <div key={nat} className="rounded-2xl bg-muted/50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><IconoNaturaleza naturaleza={nat} />{titulo} ({egresos[nat].cantidad})</p>
            <p className="text-lg font-bold tabular-nums">{formatoArs(egresos[nat].importe)}</p>
            {egresos[nat].compensado > 0 && <p className="text-xs">Compensado: {formatoArs(egresos[nat].compensado)}</p>}
            <p className="text-[11px] text-muted-foreground">{nota}</p>
          </div>
        ))}
      </div>
      {categorias.length > 0 && <p className="text-xs text-muted-foreground">Gastos por categoría: {categorias.map(([c, v]) => `${TITULO_CATEGORIA[c] ?? c} ${formatoArs(v)}`).join(" · ")}</p>}
      {totalCompensado > 0 && <p className="text-xs text-muted-foreground">Compensaciones registradas hoy: {formatoArs(totalCompensado)} (devuelven efectivo esperado al turno; la salida original se conserva).</p>}
    </section>
  )
}
