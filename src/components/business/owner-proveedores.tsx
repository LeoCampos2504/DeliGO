"use client"

// ============================================
// F5-A — owner: «Proveedores» (ficha + cuenta corriente con un ÚNICO motor de asignaciones)
// ============================================
// Endpoints de DUEÑO (el negocio sale de la sesión; ningún cajero llega acá):
//   GET/POST  /api/negocio/proveedores                           lista con saldos / alta (CUIT opcional validado)
//   GET/PATCH /api/negocio/proveedores/[id]                      ficha + historial / edición (con historial)
//   GET       /api/negocio/proveedores/[id]/cuenta               estado de cuenta con fórmulas explícitas
//   POST      /api/negocio/proveedores/[id]/obligaciones         saldo inicial | ajuste de deuda
//   POST      /api/negocio/proveedores/[id]/creditos             pago declarado (sin confirmar) | ajuste a favor
//   POST      /api/negocio/proveedores/[id]/creditos/caja        vincular un pago a proveedor de Caja (F10-C1)
//   GET       /api/negocio/proveedores/[id]/sugerencia           sugerencia FIFO (sólo sugerencia, editable)
//   POST      /api/negocio/proveedores/[id]/asignaciones         ASIGNAR | DESAFECTAR | REASIGNAR
//   POST      /api/negocio/proveedores/obligaciones/[id]/anulacion
//   POST      /api/negocio/proveedores/creditos/[id]/(confirmacion|rechazo|anulacion|desvinculacion)
//   GET       /api/negocio/proveedores/pagos-caja-sin-vincular
// Cada acción económica pasa por un paso de confirmación explícito, lleva una Idempotency-Key
// por contenido exacto (se conserva ante un error de red / 5xx para que el reintento sea un
// replay; se descarta ante 4xx o éxito) y queda deshabilitada mientras está en curso.
// Los importes se suman en centavos enteros (nunca coma flotante).

import { useMemo, useRef, useState, type ReactNode } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, CheckCircle2, Link2, Pencil, Plus, RefreshCw, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CuentaProveedorPedidos, type ResumenCuentaExtra } from "@/components/business/cuenta-proveedor-pedidos"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { cn } from "@/lib/utils"
import { matchesCajaSearch } from "@/lib/product-variant-search"
import type { ProductoCatalogo } from "@/components/business/recepcion-editor"
import { formatoArs, parseImporteArs } from "@/components/business/caja-salidas-cajero"
import { formatearCuit } from "@/lib/cuit"

// ---------------------------------------------------------------------------
// Tipos (forma de la API del dueño)
// ---------------------------------------------------------------------------

export type Totales = {
  deudaVigente: number
  obligacionesPendientes: number
  creditosConfirmados: number
  creditosAsignados: number
  anticiposDisponibles: number
  pagosDeclaradosPendientes: number
  // saldoNeto con signo; deudaExigible y saldoAFavor nunca negativos (uno de los dos es 0)
  saldoNeto: number
  deudaExigible: number
  saldoAFavor: number
  identidadOk: boolean
}
export type ProveedorLista = { id: string; nombre: string; cuit: string | null; cuitFormateado: string | null; telefono: string | null; email: string | null; notas: string | null; activo: boolean; totales: Totales | null }
type ListaResponse = { proveedores: ProveedorLista[]; pagosCajaSinVincular: number }
type HistorialFicha = Array<{ id: string; campos: string[]; valoresAnteriores: Record<string, unknown>; createdAt: string }>
type FichaResponse = { proveedor: ProveedorLista; historial: HistorialFicha }
export type Obligacion = { id: string; origen: string; naturalezaAjuste: string | null; importe: number; asignado: number; pendiente: number; fecha: string; descripcion: string; comprobante: { tipo: string | null; numero: string | null; fecha: string | null } | null; estado: "VIGENTE" | "ANULADA"; anuladaEn: string | null; createdAt: string }
export type Credito = {
  id: string; origen: "PAGO_CAJA" | "PAGO_DECLARADO" | "AJUSTE_A_FAVOR"; estado: string; efectivo: boolean; importe: number; asignado: number; disponible: number
  medio: string | null; referencia: string | null; fechaPago: string | null; cuentaOrigenDeclarada: string | null; naturalezaAjuste: string | null; motivo: string | null
  confirmadoEn: string | null; cerradoEn: string | null
  egresoCaja: { id: string; createdAt: string; motivo: string; proveedorNombre: string | null; comprobante: string | null; caja: string } | null
  createdAt: string
}
export type Asignacion = { id: string; operacionId: string; creditoId: string; obligacionId: string; tipo: "ASIGNACION" | "DESAFECTACION"; importe: number; revierteAsignacionId: string | null; vigente: boolean; createdAt: string }
type Cuenta = { totales: Totales; obligaciones: Obligacion[]; creditos: Credito[]; asignaciones: Asignacion[]; operaciones: Array<{ id: string; tipo: string; motivo: string | null; createdAt: string }>; eventos: Array<{ id: string; tipo: string; motivo: string | null; obligacionId: string | null; creditoId: string | null; createdAt: string }> }
type PagoCaja = { id: string; importe: number; motivo: string; proveedorNombre: string | null; proveedorIdentificacion: string | null; comprobante: string | null; createdAt: string; registradoPor: "DUENO" | "EMPLEADO"; caja: string }

// Mismos valores que el panel de Egresos (no se importa: ese panel sólo lo usa la pestaña Caja del dueño).
// Espacio inferior: el último control queda siempre por encima del botón flotante del chat (que en el panel del dueño ocupa hasta ~136 px desde abajo) y del aviso de instalación PWA.
const RESERVA_AVISO_INSTALACION = "calc(max(9.5rem, var(--deligo-install-prompt-h, 0px) + 1rem) + env(safe-area-inset-bottom, 0px))"
const egresosQueryKey = (negocioId: string) => ["negocio-caja-egresos", negocioId] as const

const qk = {
  lista: (negocioId: string) => ["negocio-proveedores", negocioId] as const,
  ficha: (negocioId: string, id: string) => ["negocio-proveedores", negocioId, "ficha", id] as const,
  cuenta: (negocioId: string, id: string) => ["negocio-proveedores", negocioId, "cuenta", id] as const,
  sinVincular: (negocioId: string) => ["negocio-proveedores", negocioId, "pagos-caja-sin-vincular"] as const,
}

// ---------------------------------------------------------------------------
// Helpers puros (exportados para tests)
// ---------------------------------------------------------------------------

export const ETIQUETA_NATURALEZA: Record<string, string> = { ERROR_DE_CARGA: "Error de carga", DIFERENCIA_ACORDADA: "Diferencia acordada", RECARGO: "Recargo", BONIFICACION: "Bonificación", OTRO: "Otro" }
export const ETIQUETA_MEDIO: Record<string, string> = { TRANSFERENCIA: "Transferencia", MERCADO_PAGO: "Mercado Pago", OTRO: "Otro medio" }
export const ETIQUETA_ESTADO_CREDITO: Record<string, string> = {
  VIGENTE: "Vigente", DECLARADO: "Declarado · sin confirmar", CONFIRMADO_DUENO: "Confirmado por vos", RECHAZADO: "Rechazado", ANULADO: "Anulado", DESVINCULADO: "Desvinculado",
}

/** Importe en centavos enteros (los montos de la API tienen como máximo 2 decimales). */
export const centavos = (n: number) => Math.round(n * 100)
export const desdeCentavos = (c: number) => (c / 100).toFixed(2)
/** "1500.5" → "1500,50" (formato de entrada editable). */
export const aEntrada = (n: number) => n.toFixed(2).replace(".", ",")

/** Deuda exigible o saldo a favor (nunca una «deuda negativa»). */
export function textoSaldo(t: Pick<Totales, "deudaExigible" | "saldoAFavor">): { titulo: string; texto: string; tono: "deuda" | "favor" | "cero" } {
  if (centavos(t.deudaExigible) > 0) return { titulo: "Deuda exigible", texto: `Le debés ${formatoArs(t.deudaExigible)}`, tono: "deuda" }
  if (centavos(t.saldoAFavor) > 0) return { titulo: "Saldo a favor", texto: `Tenés ${formatoArs(t.saldoAFavor)} a favor`, tono: "favor" }
  return { titulo: "Saldo", texto: "Sin saldo", tono: "cero" }
}

export function etiquetaOrigenCredito(c: Pick<Credito, "origen" | "medio" | "naturalezaAjuste">): string {
  if (c.origen === "PAGO_CAJA") return "Pago en efectivo desde Caja"
  if (c.origen === "PAGO_DECLARADO") return `Pago por ${ETIQUETA_MEDIO[c.medio ?? ""]?.toLowerCase() ?? "otro medio"}`
  return `Ajuste a favor · ${ETIQUETA_NATURALEZA[c.naturalezaAjuste ?? ""] ?? "Otro"}`
}

/** Título de una deuda según su origen (F5-A: saldo inicial / ajuste; F10-C2a: recepción / cargo accesorio). */
export function tituloObligacion(o: Pick<Obligacion, "origen" | "naturalezaAjuste">): string {
  if (o.origen === "SALDO_INICIAL") return "Saldo inicial"
  if (o.origen === "RECEPCION") return "Recepción de mercadería"
  if (o.origen === "CARGO_ACCESORIO") return "Cargo accesorio de una recepción"
  return `Ajuste de deuda · ${ETIQUETA_NATURALEZA[o.naturalezaAjuste ?? ""] ?? ""}`
}
/** Sólo el saldo inicial y los ajustes se anulan; la deuda de una recepción se corrige con un ajuste o una devolución. */
export const obligacionAnulable = (o: Pick<Obligacion, "origen" | "estado" | "asignado">) =>
  o.estado === "VIGENTE" && (o.origen === "SALDO_INICIAL" || o.origen === "AJUSTE_DEUDA") && centavos(o.asignado) === 0

export type AccionCredito = "confirmacion" | "rechazo" | "anulacion" | "desvinculacion" | "asignar"
/** Acciones que la UI ofrece para un crédito (el servidor y la base las vuelven a validar). */
export function accionesCredito(c: Pick<Credito, "origen" | "estado" | "asignado" | "disponible">): AccionCredito[] {
  const a: AccionCredito[] = []
  if (c.origen === "PAGO_DECLARADO" && c.estado === "DECLARADO") a.push("confirmacion", "rechazo")
  const efectivo = c.estado === "VIGENTE" || c.estado === "CONFIRMADO_DUENO"
  if (efectivo && centavos(c.disponible) > 0) a.push("asignar")
  if (efectivo && centavos(c.asignado) === 0) a.push(c.origen === "PAGO_CAJA" ? "desvinculacion" : "anulacion")
  return a
}

export type RenglonEntrada = { obligacionId: string; pendiente: number; valor: string }
/** Valida renglones de asignación en centavos: cada uno ≤ pendiente y el total ≤ disponible. */
export function validarRenglones(renglones: RenglonEntrada[], disponible: number):
  | { ok: true; asignar: Array<{ obligacionId: string; importe: string }>; totalCentavos: number; restanteCentavos: number }
  | { ok: false; error: string; obligacionId?: string } {
  const asignar: Array<{ obligacionId: string; importe: string }> = []
  let total = 0
  for (const r of renglones) {
    if (!r.valor.trim()) continue
    const p = parseImporteArs(r.valor)
    if (!p.ok) return { ok: false, error: p.error, obligacionId: r.obligacionId }
    const c = Math.round(Number(p.valor) * 100)
    if (c > centavos(r.pendiente)) return { ok: false, error: `No podés asignar más de lo pendiente (${formatoArs(r.pendiente)}).`, obligacionId: r.obligacionId }
    total += c
    asignar.push({ obligacionId: r.obligacionId, importe: p.valor })
  }
  if (asignar.length === 0) return { ok: false, error: "Indicá cuánto asignar al menos a una deuda." }
  if (total > centavos(disponible)) return { ok: false, error: `El total (${formatoArs(desdeCentavos(total))}) supera lo disponible del pago (${formatoArs(disponible)}).` }
  return { ok: true, asignar, totalCentavos: total, restanteCentavos: centavos(disponible) - total }
}

function fecha(iso: string | null | undefined, conHora = true): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-AR", conHora ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" })
}
/** "2026-10-31" → "31/10/2026" (sólo para mostrar). */
const diaLegible = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : d)
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }

// ---------------------------------------------------------------------------
// Red: lectura + envío idempotente
// ---------------------------------------------------------------------------

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.ok === false) throw new Error(typeof json.error === "string" ? json.error : "No se pudo cargar.")
  return json as T
}

type Fallo = { error: string; code?: string; detalle?: Record<string, unknown>; incierto: boolean }

function useAccion() {
  const claves = useRef(new Map<string, string>())
  const enCurso = useRef(false)
  const [estado, setEstado] = useState<{ enviando: boolean; fallo: Fallo | null }>({ enviando: false, fallo: null })
  const ejecutar = async (url: string, body: Record<string, unknown>, onOk: (json: Record<string, unknown>) => void, method: "POST" | "PATCH" = "POST") => {
    if (enCurso.current) return
    enCurso.current = true
    const canonico = `${method} ${url}|${JSON.stringify(body)}`
    let key = claves.current.get(canonico)
    if (!key) { key = newIdempotencyKey(); claves.current.set(canonico, key) }
    setEstado({ enviando: true, fallo: null })
    let res: Response | null = null
    try {
      res = await fetch(url, { method, headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(body) })
    } catch {
      res = null
    }
    enCurso.current = false
    if (!res) {
      setEstado({ enviando: false, fallo: { error: "No pudimos confirmar la operación por un problema de conexión. Podés reintentar: no se va a registrar dos veces.", incierto: true } })
      return
    }
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (res.ok && json.ok !== false) {
      claves.current.delete(canonico)
      setEstado({ enviando: false, fallo: null })
      onOk(json)
      return
    }
    const incierto = res.status >= 500
    if (!incierto) claves.current.delete(canonico)
    setEstado({
      enviando: false,
      fallo: {
        error: incierto ? "No pudimos confirmar la operación por un error del servidor. Podés reintentar: no se va a registrar dos veces." : typeof json.error === "string" ? json.error : "No se pudo completar la operación.",
        code: typeof json.code === "string" ? json.code : undefined,
        detalle: json.detalle && typeof json.detalle === "object" ? (json.detalle as Record<string, unknown>) : undefined,
        incierto,
      },
    })
  }
  return { ...estado, ejecutar, limpiar: () => setEstado({ enviando: false, fallo: null }) }
}

function useRefrescar(negocioId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ["negocio-proveedores", negocioId] })
    void qc.invalidateQueries({ queryKey: egresosQueryKey(negocioId) })
  }
}

// ---------------------------------------------------------------------------
// Piezas de UI
// ---------------------------------------------------------------------------

const SEL = "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"

function Campo({ id, label, children, ayuda }: { id: string; label: string; children: React.ReactNode; ayuda?: string }) {
  return (
    <label htmlFor={id} className="block space-y-1 text-sm font-medium">
      <span>{label}</span>
      {children}
      {ayuda && <span className="block text-xs font-normal text-muted-foreground">{ayuda}</span>}
    </label>
  )
}

function AvisoError({ fallo }: { fallo: Fallo | null }) {
  if (!fallo) return null
  return <p role="alert" className={cn("rounded-lg border p-2 text-sm", fallo.incierto ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" : "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100")}>{fallo.error}</p>
}

function Exito({ texto }: { texto: string | null }) {
  if (!texto) return null
  return <p role="status" className="flex items-start gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{texto}</p>
}

/** Paso de confirmación explícito antes de cualquier acción económica. */
function Confirmacion({ titulo, filas, aviso, enviando, deshabilitado, fallo, textoBoton, onConfirmar, onVolver, children }: { titulo: string; filas: Array<[string, string]>; aviso?: string; enviando: boolean; deshabilitado?: boolean; fallo: Fallo | null; textoBoton: string; onConfirmar: () => void; onVolver: () => void; children?: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-3" data-testid="confirmacion">
      <p className="text-sm font-semibold">{titulo}</p>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        {filas.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="break-words font-medium">{v}</dd></div>)}
      </dl>
      {aviso && <p className="rounded-lg bg-background/70 p-2 text-xs text-muted-foreground">{aviso}</p>}
      {children}
      <AvisoError fallo={fallo} />
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11 rounded-xl" disabled={enviando || deshabilitado} onClick={onConfirmar}>{enviando ? "Registrando…" : fallo?.incierto ? "Reintentar" : textoBoton}</Button>
        <Button variant="outline" className="min-h-11 rounded-xl" disabled={enviando} onClick={onVolver}>Volver</Button>
      </div>
    </div>
  )
}

function Tarjeta({ titulo, valor, nota, destacado, testid }: { titulo: string; valor: string; nota?: string; destacado?: boolean; testid?: string }) {
  return (
    <div className={cn("min-w-0 rounded-xl border p-3", destacado && "border-primary/50 bg-primary/5")} data-testid={testid}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className={cn("break-words font-semibold tabular-nums", destacado ? "text-lg" : "text-base")}>{valor}</p>
      {nota && <p className="mt-0.5 text-xs text-muted-foreground">{nota}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function OwnerProveedores({ negocioId, proveedorInicialId = null }: { negocioId: string; proveedorInicialId?: string | null }) {
  // F10-C2b: «Ver cuenta del proveedor» desde una recepción abre directamente su ficha.
  const [seleccionado, setSeleccionado] = useState<string | null>(proveedorInicialId)
  return (
    <section className="space-y-4" aria-labelledby="proveedores-titulo" style={{ paddingBottom: RESERVA_AVISO_INSTALACION }}>
      {seleccionado
        ? <FichaProveedor negocioId={negocioId} proveedorId={seleccionado} onVolver={() => setSeleccionado(null)} />
        : <ListaProveedores negocioId={negocioId} onAbrir={setSeleccionado} />}
    </section>
  )
}

function ListaProveedores({ negocioId, onAbrir }: { negocioId: string; onAbrir: (id: string) => void }) {
  const [inactivos, setInactivos] = useState(false)
  const [busqueda, setBusqueda] = useState("")
  const [alta, setAlta] = useState(false)
  const [exito, setExito] = useState<string | null>(null)
  const q = useQuery({ queryKey: [...qk.lista(negocioId), inactivos], queryFn: () => getJson<ListaResponse>(`/api/negocio/proveedores${inactivos ? "?inactivos=1" : ""}`) })
  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase()
    const lista = q.data?.proveedores ?? []
    return t ? lista.filter((p) => p.nombre.toLowerCase().includes(t) || (p.cuit ?? "").includes(t.replace(/\D/g, "") || "\u0000")) : lista
  }, [q.data, busqueda])

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 id="proveedores-titulo" className="flex items-center gap-1.5 text-base font-semibold"><Truck className="h-4 w-4" />Proveedores</h3>
          <p className="text-xs text-muted-foreground">Lo que les debés, lo que les pagaste y a qué deuda corresponde cada pago.</p>
        </div>
        {!alta && <Button className="min-h-11 rounded-xl" onClick={() => { setExito(null); setAlta(true) }}><Plus className="mr-1 h-4 w-4" />Nuevo proveedor</Button>}
      </div>
      <Exito texto={exito} />
      {alta && <FormProveedor negocioId={negocioId} onCancelar={() => setAlta(false)} onHecho={(p) => { setAlta(false); setExito(`Proveedor «${p.nombre}» creado.`) }} />}
      {(q.data?.pagosCajaSinVincular ?? 0) > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg border border-violet-200 bg-violet-50 p-2 text-sm text-violet-950 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100" data-testid="aviso-sin-vincular">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Hay {q.data!.pagosCajaSinVincular} {q.data!.pagosCajaSinVincular === 1 ? "pago a proveedor de Caja" : "pagos a proveedor de Caja"} sin vincular. Abrí el proveedor y elegí «Vincular pago de Caja».</span>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Buscar proveedor" placeholder="Buscar por nombre o CUIT" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="h-11 min-w-0 flex-1 rounded-xl" />
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={inactivos} onChange={(e) => setInactivos(e.target.checked)} className="h-4 w-4" />Ver inactivos</label>
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Cargando proveedores…</p>}
      {q.isError && <p role="alert" className="text-sm text-rose-700">No se pudieron cargar los proveedores. <button className="underline" onClick={() => q.refetch()}>Reintentar</button></p>}
      {q.data && filtrados.length === 0 && <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">{busqueda ? "Ningún proveedor coincide con la búsqueda." : "Todavía no cargaste proveedores."}</p>}
      <ul className="space-y-2" aria-label="Lista de proveedores">
        {filtrados.map((p) => {
          const s = p.totales ? textoSaldo(p.totales) : null
          return (
            <li key={p.id}>
              <button onClick={() => onAbrir(p.id)} className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-left hover:bg-muted/40">
                <span className="min-w-0">
                  <span className="block break-words font-semibold">{p.nombre}{!p.activo && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal">Inactivo</span>}</span>
                  <span className="block text-xs text-muted-foreground">{p.cuitFormateado ? `CUIT ${p.cuitFormateado}` : "Sin CUIT"}</span>
                </span>
                <span className="text-right">
                  {s && <span className={cn("block text-sm font-semibold tabular-nums", s.tono === "deuda" && "text-rose-700 dark:text-rose-300", s.tono === "favor" && "text-emerald-700 dark:text-emerald-300")}>{s.texto}</span>}
                  {p.totales && p.totales.pagosDeclaradosPendientes > 0 && <span className="block text-xs text-amber-700 dark:text-amber-300">{formatoArs(p.totales.pagosDeclaradosPendientes)} declarados sin confirmar</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

// ---------------------------------------------------------------------------
// Alta / edición de ficha
// ---------------------------------------------------------------------------

function FormProveedor({ negocioId, actual, onCancelar, onHecho }: { negocioId: string; actual?: ProveedorLista; onCancelar: () => void; onHecho: (p: ProveedorLista) => void }) {
  const refrescar = useRefrescar(negocioId)
  const accion = useAccion()
  const [f, setF] = useState({ nombre: actual?.nombre ?? "", cuit: actual?.cuitFormateado ?? "", telefono: actual?.telefono ?? "", email: actual?.email ?? "", notas: actual?.notas ?? "", activo: actual?.activo ?? true })
  const [confirmoSimilar, setConfirmoSimilar] = useState(false)
  const set = (k: keyof typeof f, v: string | boolean) => { setF((x) => ({ ...x, [k]: v })); setConfirmoSimilar(false); accion.limpiar() }
  const coincidencias = accion.fallo?.code === "PROVEEDOR_NOMBRE_SIMILAR" ? ((accion.fallo.detalle?.coincidencias as Array<{ id: string; nombre: string; cuit: string | null }>) ?? []) : []
  const enviar = (confirmar: boolean) => {
    if (!f.nombre.trim()) return
    const body: Record<string, unknown> = { nombre: f.nombre, cuit: f.cuit, telefono: f.telefono, email: f.email, notas: f.notas, confirmoNombreSimilar: confirmar }
    if (actual) body.activo = f.activo
    void accion.ejecutar(actual ? `/api/negocio/proveedores/${actual.id}` : "/api/negocio/proveedores", body, (json) => { refrescar(); onHecho(json.proveedor as ProveedorLista) }, actual ? "PATCH" : "POST")
  }
  return (
    <form className="space-y-3 rounded-xl border p-3" onSubmit={(e) => { e.preventDefault(); enviar(confirmoSimilar) }} aria-label={actual ? "Editar proveedor" : "Nuevo proveedor"}>
      <p className="text-sm font-semibold">{actual ? "Editar ficha" : "Nuevo proveedor"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="prov-nombre" label="Nombre o razón social"><Input id="prov-nombre" required maxLength={120} value={f.nombre} onChange={(e) => set("nombre", e.target.value)} className="h-11 rounded-xl" /></Campo>
        <Campo id="prov-cuit" label="CUIT (opcional)" ayuda="11 números, con o sin guiones. Se valida el dígito verificador."><Input id="prov-cuit" inputMode="numeric" maxLength={13} value={f.cuit} onChange={(e) => set("cuit", e.target.value)} className="h-11 rounded-xl" /></Campo>
        <Campo id="prov-tel" label="Teléfono (opcional)"><Input id="prov-tel" maxLength={40} value={f.telefono} onChange={(e) => set("telefono", e.target.value)} className="h-11 rounded-xl" /></Campo>
        <Campo id="prov-email" label="Email (opcional)"><Input id="prov-email" type="email" maxLength={160} value={f.email} onChange={(e) => set("email", e.target.value)} className="h-11 rounded-xl" /></Campo>
      </div>
      <Campo id="prov-notas" label="Notas (opcional)"><Textarea id="prov-notas" maxLength={500} value={f.notas} onChange={(e) => set("notas", e.target.value)} className="rounded-xl" /></Campo>
      {actual && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} className="h-4 w-4" />Proveedor activo</label>}
      {coincidencias.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="alert" data-testid="nombre-similar">
          <p>{accion.fallo?.error}</p>
          <ul className="list-disc pl-5">{coincidencias.map((c) => <li key={c.id}>{c.nombre}{c.cuit ? ` · CUIT ${formatearCuit(c.cuit)}` : ""}</li>)}</ul>
          <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={accion.enviando} onClick={() => { setConfirmoSimilar(true); enviar(true) }}>Es otro proveedor: {actual ? "guardar" : "crearlo"} igual</Button>
        </div>
      ) : <AvisoError fallo={accion.fallo} />}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11 rounded-xl" disabled={accion.enviando || !f.nombre.trim()}>{accion.enviando ? "Guardando…" : actual ? "Guardar cambios" : "Crear proveedor"}</Button>
        <Button type="button" variant="outline" className="min-h-11 rounded-xl" disabled={accion.enviando} onClick={onCancelar}>Cancelar</Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Ficha + estado de cuenta
// ---------------------------------------------------------------------------

/** T1-05: pagos que NO cuentan como pagados (se muestran aparte, nunca sumados a lo pagado). */
const ESTADOS_CREDITO_CANCELADOS = new Set(["RECHAZADO", "ANULADO", "DESVINCULADO"])
/** T1-05: lo que el estado de cuenta ya entrega, ordenado para mostrarlo separado (sin fórmulas nuevas). */
export function resumenCuentaExtra(cuenta: { totales: Totales; creditos: Credito[] }): ResumenCuentaExtra {
  const cancelados = cuenta.creditos.filter((c) => ESTADOS_CREDITO_CANCELADOS.has(c.estado))
  return {
    totalAcreditado: cuenta.totales.creditosConfirmados,
    cancelados: { cantidad: cancelados.length, importe: Number(desdeCentavos(cancelados.reduce((t, c) => t + centavos(c.importe), 0))) },
  }
}

/** T1-06: dónde se abre cada formulario — junto al pago, la deuda o la asignación sobre la que se opera. */
export type AnclaFormulario = `cuenta:${string}` | `pago:${string}` | `deuda:${string}` | `asignacion:${string}`
type FormularioContextual = { ancla: AnclaFormulario; nodo: ReactNode } | null
function anclaDe(modo: Modo): AnclaFormulario | null {
  if (modo.tipo === "asignar") return modo.origen === "cuenta" ? `cuenta:${modo.credito.id}` : `pago:${modo.credito.id}`
  if (modo.tipo === "reasignar") return `asignacion:${modo.asignacion.id}`
  if (modo.tipo === "motivo") return modo.accion === "desafectar" ? `asignacion:${modo.id}` : modo.accion === "anular-obligacion" ? `deuda:${modo.id}` : `pago:${modo.id}`
  return null
}
function EnContexto({ contextual, ancla }: { contextual: FormularioContextual; ancla: AnclaFormulario }) {
  if (contextual?.ancla !== ancla) return null
  return <div className="mt-2" data-testid="formulario-contextual">{contextual.nodo}</div>
}

type Modo =
  | { tipo: "ninguno" }
  | { tipo: "editar" }
  | { tipo: "obligacion" }
  | { tipo: "credito" }
  | { tipo: "vincular" }
  | { tipo: "asignar"; credito: Credito; origen?: "cuenta" | "avanzadas" }
  | { tipo: "reasignar"; asignacion: Asignacion }
  | { tipo: "motivo"; accion: "anular-obligacion" | "confirmacion" | "rechazo" | "anulacion" | "desvinculacion" | "desafectar"; id: string; resumen: Array<[string, string]> }

function FichaProveedor({ negocioId, proveedorId, onVolver }: { negocioId: string; proveedorId: string; onVolver: () => void }) {
  const ficha = useQuery({ queryKey: qk.ficha(negocioId, proveedorId), queryFn: () => getJson<FichaResponse>(`/api/negocio/proveedores/${proveedorId}`) })
  const cuentaQ = useQuery({ queryKey: qk.cuenta(negocioId, proveedorId), queryFn: () => getJson<{ cuenta: Cuenta }>(`/api/negocio/proveedores/${proveedorId}/cuenta`) })
  const [modo, setModo] = useState<Modo>({ tipo: "ninguno" })
  const [exito, setExito] = useState<string | null>(null)
  const p = ficha.data?.proveedor
  const cuenta = cuentaQ.data?.cuenta
  // Pagos E2: la cuenta por pedidos se recarga después de cualquier acción (versión en su clave de consulta).
  const [version, setVersion] = useState(0)
  const hecho = (t: string) => { setModo({ tipo: "ninguno" }); setExito(t); setVersion((v) => v + 1); void cuentaQ.refetch() }
  const abrir = (m: Modo) => { setExito(null); setModo(m) }
  const obligacionPorId = useMemo(() => new Map((cuenta?.obligaciones ?? []).map((o) => [o.id, o])), [cuenta])
  const creditoPorId = useMemo(() => new Map((cuenta?.creditos ?? []).map((c) => [c.id, c])), [cuenta])
  const nombreObligacion = (id: string) => { const o = obligacionPorId.get(id); return o ? `${o.origen === "SALDO_INICIAL" ? "Saldo inicial" : o.origen === "RECEPCION" || o.origen === "CARGO_ACCESORIO" ? "Recepción" : "Ajuste"} · ${o.descripcion}` : "Deuda" }
  const nombreCredito = (id: string) => { const c = creditoPorId.get(id); return c ? `${etiquetaOrigenCredito(c)} · ${formatoArs(c.importe)}` : "Pago" }
  const extraCuenta = useMemo(() => (cuenta ? resumenCuentaExtra(cuenta) : null), [cuenta])
  // T1-06: «Asignar», «Reasignar», «Desafectar», «Anular»… se abren JUNTO al elemento elegido (mismos formularios,
  // mismas confirmaciones y validaciones). Mientras uno está abierto, los demás botones quedan bloqueados como antes.
  const ancla = anclaDe(modo)
  const nodoContextual = !cuenta ? null
    : modo.tipo === "asignar" ? <FormAsignar negocioId={negocioId} proveedorId={proveedorId} credito={modo.credito} obligaciones={cuenta.obligaciones} onCancelar={() => setModo({ tipo: "ninguno" })} onHecho={hecho} />
    : modo.tipo === "reasignar" ? <FormReasignar negocioId={negocioId} proveedorId={proveedorId} asignacion={modo.asignacion} obligaciones={cuenta.obligaciones} nombreCredito={nombreCredito} nombreObligacion={nombreObligacion} onCancelar={() => setModo({ tipo: "ninguno" })} onHecho={hecho} />
    : modo.tipo === "motivo" ? <FormMotivo negocioId={negocioId} proveedorId={proveedorId} modo={modo} onCancelar={() => setModo({ tipo: "ninguno" })} onHecho={hecho} />
    : null
  const contextual: FormularioContextual = ancla && nodoContextual ? { ancla, nodo: nodoContextual } : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" className="min-h-11 rounded-xl" onClick={onVolver}><ArrowLeft className="mr-1 h-4 w-4" />Proveedores</Button>
        <Button variant="ghost" className="min-h-11 rounded-xl" aria-label="Actualizar" onClick={() => { void ficha.refetch(); void cuentaQ.refetch() }}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      {(ficha.isLoading || cuentaQ.isLoading) && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {(ficha.isError || cuentaQ.isError) && <p role="alert" className="text-sm text-rose-700">No se pudo cargar el proveedor.</p>}
      {p && (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 id="proveedores-titulo" className="break-words text-lg font-semibold">{p.nombre}{!p.activo && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-normal">Inactivo</span>}</h3>
            <p className="text-xs text-muted-foreground">{p.cuitFormateado ? `CUIT ${p.cuitFormateado}` : "Sin CUIT"}{p.telefono ? ` · ${p.telefono}` : ""}{p.email ? ` · ${p.email}` : ""}</p>
          </div>
          {modo.tipo !== "editar" && <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => abrir({ tipo: "editar" })}><Pencil className="mr-1 h-4 w-4" />Editar ficha</Button>}
        </div>
      )}
      {p && modo.tipo === "editar" && <FormProveedor negocioId={negocioId} actual={p} onCancelar={() => setModo({ tipo: "ninguno" })} onHecho={() => hecho("Ficha actualizada. El cambio quedó en el historial.")} />}

      <Exito texto={exito} />
      {p && cuenta && (
        <CuentaProveedorPedidos proveedorId={proveedorId} version={version} activo={p.activo} extra={extraCuenta}
          formularioAplicar={contextual?.ancla.startsWith("cuenta:") ? { creditoId: contextual.ancla.slice("cuenta:".length), nodo: contextual.nodo } : null}
          onCambio={() => { setVersion((v) => v + 1); void cuentaQ.refetch() }}
          onAplicarManual={(creditoId) => { const c = cuenta.creditos.find((x) => x.id === creditoId); if (c) abrir({ tipo: "asignar", credito: c, origen: "cuenta" }) }} />
      )}

      {cuenta && modo.tipo === "obligacion" && <FormObligacion negocioId={negocioId} proveedorId={proveedorId} tieneSaldoInicial={cuenta.obligaciones.some((o) => o.origen === "SALDO_INICIAL" && o.estado === "VIGENTE")} onCancelar={() => setModo({ tipo: "ninguno" })} onHecho={hecho} />}
      {modo.tipo === "credito" && <FormCredito negocioId={negocioId} proveedorId={proveedorId} onCancelar={() => setModo({ tipo: "ninguno" })} onHecho={hecho} />}
      {modo.tipo === "vincular" && p && <FormVincular negocioId={negocioId} proveedorId={proveedorId} proveedorNombre={p.nombre} onCancelar={() => setModo({ tipo: "ninguno" })} onHecho={hecho} />}

      {p && modo.tipo === "ninguno" && <SeccionProductosProveedor proveedorId={proveedorId} />}

      {/* Pagos E2: lo técnico (saldo inicial, ajustes, declarar o vincular pagos, asignar / reasignar / desafectar,
          movimientos e historial) sigue disponible, plegado fuera de la vista principal. */}
      <details className="rounded-2xl border p-3" data-testid="opciones-avanzadas">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Opciones avanzadas y movimientos técnicos</summary>
        <div className="space-y-4 pt-2">
      {cuenta && <Totalesview t={cuenta.totales} />}
      {p && cuenta && modo.tipo === "ninguno" && (
        <div className="flex flex-wrap gap-2" aria-label="Acciones de la cuenta">
          <Button variant="outline" className="min-h-11 rounded-xl" disabled={!p.activo} onClick={() => abrir({ tipo: "obligacion" })}>Saldo inicial o ajuste de deuda</Button>
          <Button variant="outline" className="min-h-11 rounded-xl" disabled={!p.activo} onClick={() => abrir({ tipo: "credito" })}>Pago por transferencia o ajuste a favor</Button>
          <Button variant="outline" className="min-h-11 rounded-xl" disabled={!p.activo} onClick={() => abrir({ tipo: "vincular" })}><Link2 className="mr-1 h-4 w-4" />Vincular pago de Caja</Button>
        </div>
      )}
      {p && !p.activo && modo.tipo === "ninguno" && <p className="text-xs text-muted-foreground">El proveedor está inactivo: activalo desde «Editar ficha» para registrar movimientos. Igual podés asignar, desafectar o anular lo ya registrado.</p>}

      {cuenta && (
        <>
          <SeccionDeudas obligaciones={cuenta.obligaciones} contextual={contextual} onAnular={(o) => abrir({ tipo: "motivo", accion: "anular-obligacion", id: o.id, resumen: [["Deuda", o.descripcion], ["Importe", formatoArs(o.importe)]] })} bloqueado={modo.tipo !== "ninguno"} />
          <SeccionPagos creditos={cuenta.creditos} contextual={contextual} bloqueado={modo.tipo !== "ninguno"} onAccion={(c, a) => {
            if (a === "asignar") return abrir({ tipo: "asignar", credito: c, origen: "avanzadas" })
            abrir({ tipo: "motivo", accion: a, id: c.id, resumen: [["Pago", etiquetaOrigenCredito(c)], ["Importe", formatoArs(c.importe)], ...(c.referencia ? [["Referencia", c.referencia] as [string, string]] : [])] })
          }} />
          <SeccionAsignaciones asignaciones={cuenta.asignaciones} contextual={contextual} nombreCredito={nombreCredito} nombreObligacion={nombreObligacion} bloqueado={modo.tipo !== "ninguno"}
            onDesafectar={(a) => abrir({ tipo: "motivo", accion: "desafectar", id: a.id, resumen: [["Pago", nombreCredito(a.creditoId)], ["Deuda", nombreObligacion(a.obligacionId)], ["Importe asignado", formatoArs(a.importe)]] })}
            onReasignar={(a) => abrir({ tipo: "reasignar", asignacion: a })} />
          <SeccionHistorial cuenta={cuenta} historial={ficha.data?.historial ?? []} nombreCredito={nombreCredito} nombreObligacion={nombreObligacion} />
        </>
      )}
        </div>
      </details>
    </div>
  )
}

type Asociacion = { id: string; productoId: string; productoVarianteId: string | null; producto: string; variante: string | null; origen: "MANUAL" | "RECEPCION" }
type ProductoCat = ProductoCatalogo

/** Qué productos (o variantes) entrega este proveedor: aparecen primero al pedir y al recibir. Sólo configuración. */
function SeccionProductosProveedor({ proveedorId }: { proveedorId: string }) {
  const lista = useQuery({ queryKey: ["negocio-proveedores", "productos", proveedorId], queryFn: () => getJson<{ asociaciones: Asociacion[] }>(`/api/negocio/proveedores/${proveedorId}/productos`) })
  const [abierto, setAbierto] = useState(false)
  const catalogo = useQuery({ queryKey: ["negocio-compras-catalogo"], queryFn: () => getJson<{ productos: ProductoCat[] }>("/api/negocio/compras/catalogo"), enabled: abierto })
  const [busqueda, setBusqueda] = useState("")
  // Catálogo: selección múltiple (producto o variantes) y UNA operación para asociarlos todos.
  const [marcados, setMarcados] = useState<Map<string, { productoId: string; productoVarianteId: string | null; etiqueta: string }>>(new Map())
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const asociaciones = lista.data?.asociaciones ?? []
  const yaEsta = (productoId: string, varianteId: string | null) => asociaciones.some((a) => a.productoId === productoId && a.productoVarianteId === varianteId)
  const resultados = busqueda.trim() ? (catalogo.data?.productos ?? []).filter((x) => matchesCajaSearch(x, busqueda)).slice(0, 20) : []
  const alternar = (productoId: string, varianteId: string | null, etiqueta: string) => setMarcados((m) => { const n = new Map(m); const k = `${productoId}:${varianteId ?? ""}`; if (n.has(k)) n.delete(k); else n.set(k, { productoId, productoVarianteId: varianteId, etiqueta }); return n })
  // T1-08: «Todas las variantes» is ONE general association (productoVarianteId null). Marking it drops any variant of
  // that product marked on its own, so the same choice is never sent twice; unmarking it restores nothing by itself.
  const todasIncluidas = (productoId: string, cantidadVariantes: number) => cantidadVariantes > 0 && (yaEsta(productoId, null) || marcados.has(`${productoId}:`))
  const alternarTodas = (productoId: string, varianteIds: string[], etiqueta: string) => setMarcados((m) => {
    const n = new Map(m)
    const k = `${productoId}:`
    if (n.has(k)) n.delete(k)
    else { n.set(k, { productoId, productoVarianteId: null, etiqueta }); for (const v of varianteIds) n.delete(`${productoId}:${v}`) }
    return n
  })
  // T1-08: in the associated list a general association of a product WITH variants says so explicitly.
  const conVariantes = useMemo(() => new Set((catalogo.data?.productos ?? []).filter((x) => x.variantes.length > 0).map((x) => x.id)), [catalogo.data])
  const enviar = async (method: "POST" | "DELETE", body?: unknown, query = "") => {
    if (enviando) return
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch(`/api/negocio/proveedores/${proveedorId}/productos${query}`, { method, headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.ok === false) setError(typeof json.error === "string" ? json.error : "No se pudo guardar. Probá de nuevo.")
      await lista.refetch()
    } catch {
      setError("No se pudo guardar por un problema de conexión. Probá de nuevo.")
    } finally {
      setEnviando(false)
    }
  }
  const asociarMarcados = async () => {
    const items = [...marcados.values()].map(({ productoId, productoVarianteId }) => ({ productoId, productoVarianteId }))
    if (!items.length) return
    await enviar("POST", { items })
    setMarcados(new Map()); setBusqueda("")
  }
  return (
    <details className="rounded-2xl border p-3" open={abierto} onToggle={(e) => setAbierto((e.target as HTMLDetailsElement).open)} data-testid="productos-proveedor">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Productos que entrega ({asociaciones.length})</summary>
      <div className="mt-2 space-y-2">
        <p className="text-xs text-muted-foreground">Al hacer un pedido o recibir mercadería de este proveedor, estos productos aparecen primero. Las recepciones aprobadas suman los productos nuevos solas. No cambia el stock ni los precios.</p>
        <Input aria-label="Buscar producto para asociar" placeholder="Buscar producto para agregar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="h-11 rounded-xl" />
        {resultados.length > 0 && (
          <ul className="space-y-1" aria-label="Resultados del catálogo">
            {resultados.map((x) => {
              const opciones: Array<{ v: string | null; t: string }> = x.variantes.length ? [{ v: null, t: "Todas las variantes" }, ...x.variantes.map((v) => ({ v: v.id, t: v.nombre }))] : [{ v: null, t: "" }]
              return (
                <li key={x.id} className="rounded-xl border px-3 py-1 text-sm">
                  <span className="block break-words font-medium">{x.nombre}{x.marca ? ` · ${x.marca}` : ""}</span>
                  <span className="flex flex-wrap gap-x-3">
                    {opciones.map((o) => {
                      const ya = yaEsta(x.id, o.v)
                      const etiqueta = `${x.nombre}${o.v ? ` — ${o.t}` : x.variantes.length ? " — todas las variantes" : ""}`
                      // T1-08: with «Todas las variantes» (already associated or marked now) every variant shows as
                      // INCLUDED — checked and disabled, never marked on its own (no extra record is created).
                      const incluida = o.v !== null && todasIncluidas(x.id, x.variantes.length)
                      return <label key={o.v ?? "p"} className={cn("flex min-h-11 items-center gap-2 text-xs", incluida && "text-muted-foreground")} data-testid={o.v === null && x.variantes.length ? "opcion-todas-variantes" : undefined}><input type="checkbox" className="h-4 w-4" disabled={ya || enviando || incluida} checked={ya || incluida || marcados.has(`${x.id}:${o.v ?? ""}`)} onChange={() => (o.v === null && x.variantes.length ? alternarTodas(x.id, x.variantes.map((v) => v.id), etiqueta) : alternar(x.id, o.v, etiqueta))} />{o.t || "Agregar"}{ya ? " (ya está)" : incluida ? " (incluida en «Todas las variantes»)" : ""}</label>
                    })}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {marcados.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2" data-testid="asociar-seleccionados">
            <span className="text-xs">{marcados.size} {marcados.size === 1 ? "seleccionado" : "seleccionados"}: {[...marcados.values()].map((m) => m.etiqueta).join(", ")}</span>
            <Button type="button" className="min-h-11 rounded-xl" disabled={enviando} onClick={() => void asociarMarcados()}>{enviando ? "Asociando…" : `Asociar seleccionados (${marcados.size})`}</Button>
            <Button type="button" variant="ghost" className="min-h-11 rounded-xl" onClick={() => setMarcados(new Map())}>Limpiar</Button>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
        {lista.isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
        {!lista.isLoading && asociaciones.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay productos asociados.</p>}
        <ul className="space-y-1" aria-label="Productos asociados">
          {asociaciones.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-1 text-sm">
              <span className="min-w-0 break-words">{a.producto}{a.variante ? ` — ${a.variante}` : a.productoVarianteId === null && conVariantes.has(a.productoId) ? " — todas las variantes" : ""}{a.origen === "RECEPCION" && <span className="ml-1 text-xs text-muted-foreground">(por una recepción)</span>}</span>
              <Button type="button" variant="ghost" className="min-h-11 shrink-0 rounded-xl text-rose-700" disabled={enviando} aria-label={`Quitar ${a.producto}${a.variante ? ` ${a.variante}` : ""}`} onClick={() => void enviar("DELETE", undefined, `?asociacionId=${encodeURIComponent(a.id)}`)}>Quitar</Button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

function Totalesview({ t }: { t: Totales }) {
  const s = textoSaldo(t)
  return (
    <div className="space-y-2" aria-label="Estado de cuenta">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3"><Tarjeta titulo={s.titulo} valor={s.texto} destacado testid="saldo-exigible" nota={s.tono === "favor" ? "Pagos confirmados que superan toda la deuda vigente" : "Deuda vigente − pagos confirmados"} /></div>
        <Tarjeta titulo="Deuda vigente" valor={formatoArs(t.deudaVigente)} testid="deuda-vigente" />
        <Tarjeta titulo="Pagos confirmados" valor={formatoArs(t.creditosConfirmados)} testid="creditos-confirmados" />
        <Tarjeta titulo="Deudas sin pago asignado" valor={formatoArs(t.obligacionesPendientes)} testid="obligaciones-pendientes" />
        <Tarjeta titulo="Anticipos disponibles" valor={formatoArs(t.anticiposDisponibles)} nota="Pagos confirmados todavía sin asignar" testid="anticipos" />
        <Tarjeta titulo="Pagos declarados sin confirmar" valor={formatoArs(t.pagosDeclaradosPendientes)} nota="No restan de la deuda hasta que los confirmes" testid="declarados" />
      </div>
      {centavos(t.deudaExigible) > 0 && centavos(t.anticiposDisponibles) > 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-200" data-testid="anticipos-sin-asignar">Tenés {formatoArs(t.anticiposDisponibles)} en pagos confirmados sin asignar: ya restan del saldo; asignalos para saber qué deudas cancelan.</p>
      )}
      <p className="text-xs text-muted-foreground">Asignar un pago a una deuda no cambia el saldo: sólo indica qué deuda cancela.</p>
      {!t.identidadOk && <p role="alert" className="text-xs text-rose-700">Los totales no cierran entre sí. No registres movimientos y avisá a soporte.</p>}
    </div>
  )
}

function Estado({ texto, tono }: { texto: string; tono: "ok" | "aviso" | "off" }) {
  return <span className={cn("rounded px-1.5 py-0.5 text-xs", tono === "ok" && "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100", tono === "aviso" && "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100", tono === "off" && "bg-muted text-muted-foreground")}>{texto}</span>
}

function SeccionDeudas({ obligaciones, onAnular, bloqueado, contextual = null }: { obligaciones: Obligacion[]; onAnular: (o: Obligacion) => void; bloqueado: boolean; contextual?: FormularioContextual }) {
  return (
    <div>
      <h4 className="text-sm font-semibold">Deudas</h4>
      {obligaciones.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Sin deudas registradas. Si ya le debías antes de usar DeliGO, cargá un saldo inicial.</p>}
      <ul className="mt-1 space-y-2" aria-label="Deudas">
        {obligaciones.map((o) => (
          <li key={o.id} className={cn("rounded-xl border p-3 text-sm", o.estado === "ANULADA" && "opacity-70")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium">{tituloObligacion(o)}</p>
                <p className="break-words text-xs text-muted-foreground">{o.descripcion} · {fecha(o.fecha, false)}{o.comprobante?.numero && !o.descripcion.includes(o.comprobante.numero) ? ` · ${o.comprobante.tipo ?? "Comp."} ${o.comprobante.numero}` : ""}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="font-semibold tabular-nums">{formatoArs(o.importe)}</p>
                {o.estado === "VIGENTE" ? <p className="text-xs text-muted-foreground">Pendiente {formatoArs(o.pendiente)}</p> : <Estado texto="Anulada" tono="off" />}
              </div>
            </div>
            {obligacionAnulable(o) && !bloqueado && <Button variant="ghost" className="mt-1 min-h-11 rounded-xl text-rose-700" onClick={() => onAnular(o)}>Anular</Button>}
            <EnContexto contextual={contextual} ancla={`deuda:${o.id}`} />
          </li>
        ))}
      </ul>
    </div>
  )
}

const TEXTO_ACCION: Record<AccionCredito, string> = { confirmacion: "Confirmar pago", rechazo: "Rechazar", anulacion: "Anular", desvinculacion: "Desvincular", asignar: "Asignar a deudas" }

function SeccionPagos({ creditos, onAccion, bloqueado, contextual = null }: { creditos: Credito[]; onAccion: (c: Credito, a: AccionCredito) => void; bloqueado: boolean; contextual?: FormularioContextual }) {
  return (
    <div>
      <h4 className="text-sm font-semibold">Pagos y créditos</h4>
      {creditos.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Sin pagos registrados.</p>}
      <ul className="mt-1 space-y-2" aria-label="Pagos y créditos">
        {creditos.map((c) => (
          <li key={c.id} className={cn("rounded-xl border p-3 text-sm", !c.efectivo && c.estado !== "DECLARADO" && "opacity-70")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-medium">{etiquetaOrigenCredito(c)}</p>
                <p className="break-words text-xs text-muted-foreground">
                  {c.egresoCaja ? `${c.egresoCaja.caja} · ${fecha(c.egresoCaja.createdAt)} · ${c.egresoCaja.motivo}` : c.fechaPago ? fecha(c.fechaPago, false) : fecha(c.createdAt)}
                  {c.referencia ? ` · Ref. ${c.referencia}` : ""}{c.motivo ? ` · ${c.motivo}` : ""}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="font-semibold tabular-nums">{formatoArs(c.importe)}</p>
                <Estado texto={ETIQUETA_ESTADO_CREDITO[c.estado] ?? c.estado} tono={c.efectivo ? "ok" : c.estado === "DECLARADO" ? "aviso" : "off"} />
                {c.efectivo && <p className="text-xs text-muted-foreground">Sin asignar {formatoArs(c.disponible)}</p>}
              </div>
            </div>
            {c.estado === "DECLARADO" && <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">Todavía no resta de la deuda ni se puede asignar: confirmalo cuando verifiques que el pago se hizo.</p>}
            {!bloqueado && accionesCredito(c).length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {accionesCredito(c).map((a) => <Button key={a} variant={a === "asignar" || a === "confirmacion" ? "outline" : "ghost"} className={cn("min-h-11 rounded-xl", (a === "anulacion" || a === "rechazo" || a === "desvinculacion") && "text-rose-700")} onClick={() => onAccion(c, a)}>{TEXTO_ACCION[a]}</Button>)}
              </div>
            )}
            <EnContexto contextual={contextual} ancla={`pago:${c.id}`} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function SeccionAsignaciones({ asignaciones, nombreCredito, nombreObligacion, onDesafectar, onReasignar, bloqueado, contextual = null }: { asignaciones: Asignacion[]; nombreCredito: (id: string) => string; nombreObligacion: (id: string) => string; onDesafectar: (a: Asignacion) => void; onReasignar: (a: Asignacion) => void; bloqueado: boolean; contextual?: FormularioContextual }) {
  const vigentes = asignaciones.filter((a) => a.vigente)
  return (
    <div>
      <h4 className="text-sm font-semibold">Asignaciones vigentes</h4>
      {vigentes.length === 0 && <p className="mt-1 text-sm text-muted-foreground">Ningún pago asignado a una deuda todavía.</p>}
      <ul className="mt-1 space-y-2" aria-label="Asignaciones vigentes">
        {vigentes.map((a) => (
          <li key={a.id} className="rounded-xl border p-3 text-sm">
            <p className="break-words"><span className="font-medium">{formatoArs(a.importe)}</span> de {nombreCredito(a.creditoId)}</p>
            <p className="break-words text-xs text-muted-foreground">→ {nombreObligacion(a.obligacionId)} · {fecha(a.createdAt)}</p>
            {!bloqueado && (
              <div className="mt-1 flex flex-wrap gap-1">
                <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => onReasignar(a)}>Reasignar</Button>
                <Button variant="ghost" className="min-h-11 rounded-xl text-rose-700" onClick={() => onDesafectar(a)}>Desafectar</Button>
              </div>
            )}
            <EnContexto contextual={contextual} ancla={`asignacion:${a.id}`} />
          </li>
        ))}
      </ul>
    </div>
  )
}

const TITULO_EVENTO: Record<string, string> = { ANULACION: "Anulación", CONFIRMACION: "Pago confirmado", RECHAZO: "Pago rechazado", DESVINCULACION: "Pago de Caja desvinculado" }
const TITULO_OPERACION: Record<string, string> = { ASIGNAR: "Asignación", DESAFECTAR: "Desafectación", REASIGNAR: "Reasignación" }

function SeccionHistorial({ cuenta, historial, nombreCredito, nombreObligacion }: { cuenta: Cuenta; historial: HistorialFicha; nombreCredito: (id: string) => string; nombreObligacion: (id: string) => string }) {
  const [abierto, setAbierto] = useState(false)
  const items = useMemo(() => {
    const porOperacion = new Map<string, Asignacion[]>()
    for (const a of cuenta.asignaciones) porOperacion.set(a.operacionId, [...(porOperacion.get(a.operacionId) ?? []), a])
    const lista: Array<{ id: string; en: string; titulo: string; texto: string }> = [
      ...cuenta.obligaciones.map((o) => ({ id: `o-${o.id}`, en: o.createdAt, titulo: o.origen === "SALDO_INICIAL" ? "Saldo inicial registrado" : o.origen === "RECEPCION" ? "Recepción aprobada" : o.origen === "CARGO_ACCESORIO" ? "Cargo accesorio registrado" : "Ajuste de deuda registrado", texto: `${formatoArs(o.importe)} · ${o.descripcion}` })),
      ...cuenta.creditos.map((c) => ({ id: `c-${c.id}`, en: c.createdAt, titulo: c.origen === "PAGO_CAJA" ? "Pago de Caja vinculado" : c.origen === "PAGO_DECLARADO" ? "Pago declarado" : "Ajuste a favor registrado", texto: `${formatoArs(c.importe)} · ${etiquetaOrigenCredito(c)}` })),
      ...cuenta.eventos.map((e) => ({ id: `e-${e.id}`, en: e.createdAt, titulo: TITULO_EVENTO[e.tipo] ?? e.tipo, texto: `${e.creditoId ? nombreCredito(e.creditoId) : e.obligacionId ? nombreObligacion(e.obligacionId) : ""}${e.motivo ? ` · Motivo: ${e.motivo}` : ""}` })),
      ...cuenta.operaciones.map((op) => ({ id: `op-${op.id}`, en: op.createdAt, titulo: TITULO_OPERACION[op.tipo] ?? op.tipo, texto: `${(porOperacion.get(op.id) ?? []).map((a) => `${a.tipo === "ASIGNACION" ? "+" : "−"}${formatoArs(a.importe)} → ${nombreObligacion(a.obligacionId)}`).join(" · ")}${op.motivo ? ` · Motivo: ${op.motivo}` : ""}` })),
      ...historial.map((h) => ({ id: `h-${h.id}`, en: h.createdAt, titulo: "Ficha editada", texto: `Cambió: ${h.campos.join(", ")}` })),
    ]
    return lista.sort((a, b) => b.en.localeCompare(a.en))
  }, [cuenta, historial, nombreCredito, nombreObligacion])
  return (
    <div>
      <Button variant="ghost" className="min-h-11 rounded-xl px-0 text-sm font-semibold" aria-expanded={abierto} onClick={() => setAbierto((x) => !x)}>Historial ({items.length})</Button>
      {abierto && (
        <ol className="space-y-1.5" aria-label="Historial de la cuenta">
          {items.map((i) => <li key={i.id} className="rounded-lg bg-muted/40 p-2 text-sm"><p className="font-medium">{i.titulo}</p><p className="text-xs text-muted-foreground">{fecha(i.en)}</p>{i.texto && <p className="mt-0.5 break-words text-xs">{i.texto}</p>}</li>)}
        </ol>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Advertencia de posibles pagos duplicados (409 POSIBLE_PAGO_DUPLICADO, confirmable)
// ---------------------------------------------------------------------------

export type CandidatoDuplicado = { tipo: "PAGO_CAJA_SIN_VINCULAR" | "PAGO_CAJA_VINCULADO" | "PAGO_DECLARADO"; id: string; importe: number; fecha: string; referencia: string | null; estado: string | null; caja: string | null; coincidencia: "IMPORTE_Y_FECHA" | "REFERENCIA" }

export function describirCandidato(c: CandidatoDuplicado): string {
  const base = `${formatoArs(c.importe)} · ${fecha(c.fecha, c.tipo !== "PAGO_DECLARADO")}${c.referencia ? ` · Ref. ${c.referencia}` : ""}`
  if (c.tipo === "PAGO_CAJA_SIN_VINCULAR") return `Pago de Caja sin vincular (${c.caja ?? "Caja"}) · ${base}`
  if (c.tipo === "PAGO_CAJA_VINCULADO") return `Pago de Caja ya vinculado a este proveedor (${c.caja ?? "Caja"}) · ${base}`
  return `Pago declarado ${c.estado === "CONFIRMADO_DUENO" ? "confirmado" : "sin confirmar"} · ${base}${c.coincidencia === "REFERENCIA" ? " · misma referencia" : ""}`
}

const candidatosDe = (fallo: Fallo | null) => (fallo?.code === "POSIBLE_PAGO_DUPLICADO" ? ((fallo.detalle?.candidatos as CandidatoDuplicado[] | undefined) ?? []) : [])

function AvisoDuplicados({ fallo, textoBoton, enviando, onConfirmar }: { fallo: Fallo | null; textoBoton: string; enviando: boolean; onConfirmar: () => void }) {
  const candidatos = candidatosDe(fallo)
  if (candidatos.length === 0) return null
  return (
    <div role="alert" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" data-testid="posible-duplicado">
      <p>{fallo?.error}</p>
      <ul className="list-disc space-y-0.5 pl-5">{candidatos.map((c) => <li key={`${c.tipo}-${c.id}`} className="break-words">{describirCandidato(c)}</li>)}</ul>
      <Button variant="outline" className="min-h-11 rounded-xl" disabled={enviando} onClick={onConfirmar}>{textoBoton}</Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formularios económicos (cada uno con paso de confirmación)
// ---------------------------------------------------------------------------

type PropsForm = { negocioId: string; proveedorId: string; onCancelar: () => void; onHecho: (texto: string) => void }

function FormObligacion({ negocioId, proveedorId, tieneSaldoInicial, onCancelar, onHecho }: PropsForm & { tieneSaldoInicial: boolean }) {
  const refrescar = useRefrescar(negocioId)
  const accion = useAccion()
  const [f, setF] = useState({ origen: tieneSaldoInicial ? "AJUSTE_DEUDA" : "SALDO_INICIAL", naturalezaAjuste: "", importe: "", fecha: hoy(), descripcion: "", comprobanteTipo: "", comprobanteNumero: "" })
  const [revisar, setRevisar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setError(null) }
  const imp = parseImporteArs(f.importe)
  const continuar = () => {
    if (!imp.ok) return setError(imp.error)
    if (f.origen === "AJUSTE_DEUDA" && !f.naturalezaAjuste) return setError("Elegí la naturaleza del ajuste.")
    if (!f.descripcion.trim()) return setError("Escribí una descripción.")
    if (!f.fecha) return setError("Indicá la fecha.")
    setRevisar(true)
  }
  if (revisar && imp.ok) {
    return (
      <Confirmacion titulo="Revisá la deuda antes de registrarla" textoBoton="Registrar deuda" enviando={accion.enviando} fallo={accion.fallo}
        filas={[["Tipo", f.origen === "SALDO_INICIAL" ? "Saldo inicial (deuda previa a DeliGO)" : `Ajuste de deuda · ${ETIQUETA_NATURALEZA[f.naturalezaAjuste]}`], ["Importe", formatoArs(imp.valor)], [f.origen === "SALDO_INICIAL" ? "Fecha de corte" : "Fecha", diaLegible(f.fecha)], ["Descripción", f.descripcion], ...(f.comprobanteNumero ? [["Comprobante", `${f.comprobanteTipo} ${f.comprobanteNumero}`.trim()] as [string, string]] : [])]}
        aviso="Suma a lo que le debés. No mueve dinero de la caja. Una vez registrada no se edita: si hay un error, se anula (sin pagos asignados) o se corrige con un ajuste."
        onVolver={() => { setRevisar(false); accion.limpiar() }}
        onConfirmar={() => void accion.ejecutar(`/api/negocio/proveedores/${proveedorId}/obligaciones`, { origen: f.origen, naturalezaAjuste: f.origen === "AJUSTE_DEUDA" ? f.naturalezaAjuste : null, importe: imp.valor, fecha: f.fecha, descripcion: f.descripcion, comprobanteTipo: f.comprobanteTipo, comprobanteNumero: f.comprobanteNumero }, () => { refrescar(); onHecho(`Deuda registrada por ${formatoArs(imp.valor)}.`) })} />
    )
  }
  return (
    <div className="space-y-3 rounded-xl border p-3" aria-label="Registrar deuda">
      <p className="text-sm font-semibold">Saldo inicial o ajuste de deuda</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="obl-origen" label="Tipo">
          <select id="obl-origen" className={SEL} value={f.origen} onChange={(e) => set("origen", e.target.value)}>
            <option value="SALDO_INICIAL" disabled={tieneSaldoInicial}>Saldo inicial{tieneSaldoInicial ? " (ya cargado)" : ""}</option>
            <option value="AJUSTE_DEUDA">Ajuste de deuda</option>
          </select>
        </Campo>
        {f.origen === "AJUSTE_DEUDA" && (
          <Campo id="obl-naturaleza" label="Naturaleza del ajuste">
            <select id="obl-naturaleza" className={SEL} value={f.naturalezaAjuste} onChange={(e) => set("naturalezaAjuste", e.target.value)}>
              <option value="">Elegí…</option>
              {["ERROR_DE_CARGA", "DIFERENCIA_ACORDADA", "RECARGO", "OTRO"].map((n) => <option key={n} value={n}>{ETIQUETA_NATURALEZA[n]}</option>)}
            </select>
          </Campo>
        )}
        <Campo id="obl-importe" label="Importe"><Input id="obl-importe" inputMode="decimal" placeholder="0,00" value={f.importe} onChange={(e) => set("importe", e.target.value)} className="h-11 rounded-xl" /></Campo>
        <Campo id="obl-fecha" label={f.origen === "SALDO_INICIAL" ? "Fecha de corte" : "Fecha"}><Input id="obl-fecha" type="date" max={hoy()} value={f.fecha} onChange={(e) => set("fecha", e.target.value)} className="h-11 rounded-xl" /></Campo>
        <Campo id="obl-comp-tipo" label="Comprobante (opcional)"><Input id="obl-comp-tipo" placeholder="Factura, remito…" maxLength={40} value={f.comprobanteTipo} onChange={(e) => set("comprobanteTipo", e.target.value)} className="h-11 rounded-xl" /></Campo>
        <Campo id="obl-comp-num" label="Número (opcional)"><Input id="obl-comp-num" maxLength={60} value={f.comprobanteNumero} onChange={(e) => set("comprobanteNumero", e.target.value)} className="h-11 rounded-xl" /></Campo>
      </div>
      <Campo id="obl-desc" label="Descripción"><Textarea id="obl-desc" maxLength={500} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} className="rounded-xl" placeholder={f.origen === "SALDO_INICIAL" ? "Ej.: saldo según la libreta al 31/10" : "Ej.: recargo por pago fuera de término"} /></Campo>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2"><Button className="min-h-11 rounded-xl" onClick={continuar}>Continuar</Button><Button variant="outline" className="min-h-11 rounded-xl" onClick={onCancelar}>Cancelar</Button></div>
    </div>
  )
}

function FormCredito({ negocioId, proveedorId, onCancelar, onHecho }: PropsForm) {
  const refrescar = useRefrescar(negocioId)
  const accion = useAccion()
  const [f, setF] = useState({ origen: "PAGO_DECLARADO", medio: "TRANSFERENCIA", importe: "", fechaPago: hoy(), referencia: "", cuentaOrigenDeclarada: "", naturalezaAjuste: "", motivo: "" })
  const [fueraDeCaja, setFueraDeCaja] = useState(false)
  const [revisar, setRevisar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => { setF((x) => ({ ...x, [k]: v })); setError(null) }
  const imp = parseImporteArs(f.importe)
  const declarado = f.origen === "PAGO_DECLARADO"
  const continuar = () => {
    if (!imp.ok) return setError(imp.error)
    if (!declarado && !f.naturalezaAjuste) return setError("Elegí la naturaleza del ajuste.")
    if (!declarado && !f.motivo.trim()) return setError("Escribí el motivo del ajuste.")
    if (declarado && f.medio === "OTRO" && !f.motivo.trim()) return setError("Para «Otro medio», indicá en la nota cuál fue.")
    if (declarado && !fueraDeCaja) return setError("Confirmá que este pago no salió del efectivo de la Caja. Si salió de la Caja, usá «Vincular pago de Caja».")
    setRevisar(true)
  }
  if (revisar && imp.ok) {
    const body: Record<string, unknown> = declarado
      ? { origen: f.origen, medio: f.medio, importe: imp.valor, fechaPago: f.fechaPago, referencia: f.referencia, cuentaOrigenDeclarada: f.cuentaOrigenDeclarada, motivo: f.motivo, confirmoNoSalioDeCaja: true }
      : { origen: f.origen, naturalezaAjuste: f.naturalezaAjuste, importe: imp.valor, motivo: f.motivo }
    const enviar = (confirmoNoDuplicado: boolean) => void accion.ejecutar(`/api/negocio/proveedores/${proveedorId}/creditos`, confirmoNoDuplicado ? { ...body, confirmoNoDuplicado: true } : body, () => { refrescar(); onHecho(declarado ? `Pago declarado por ${formatoArs(imp.valor)}. Confirmalo cuando verifiques que se hizo.` : `Ajuste a favor registrado por ${formatoArs(imp.valor)}.`) })
    const dup = candidatosDe(accion.fallo).length > 0
    return (
      <Confirmacion titulo={declarado ? "Revisá el pago declarado" : "Revisá el ajuste a favor"} textoBoton={declarado ? "Registrar como declarado" : "Registrar ajuste"} enviando={accion.enviando} deshabilitado={dup} fallo={dup ? null : accion.fallo}
        filas={declarado ? [["Medio", ETIQUETA_MEDIO[f.medio]], ["Importe", formatoArs(imp.valor)], ["Fecha del pago", diaLegible(f.fechaPago)], ...(f.referencia ? [["Referencia", f.referencia] as [string, string]] : []), ...(f.cuentaOrigenDeclarada ? [["Cuenta de origen", f.cuentaOrigenDeclarada] as [string, string]] : [])] : [["Naturaleza", ETIQUETA_NATURALEZA[f.naturalezaAjuste]], ["Importe", formatoArs(imp.valor)], ["Motivo", f.motivo]]}
        aviso={declarado ? "Queda DECLARADO: no resta de la deuda ni se puede asignar hasta que lo confirmes. No es un pago de la caja: el efectivo no cambia." : "Resta de lo que le debés sin mover dinero. Si hay un error, se anula con su motivo."}
        onVolver={() => { setRevisar(false); accion.limpiar() }}
        onConfirmar={() => enviar(false)}>
        <AvisoDuplicados fallo={accion.fallo} enviando={accion.enviando} textoBoton="Es otro pago: registrarlo igual" onConfirmar={() => enviar(true)} />
      </Confirmacion>
    )
  }
  return (
    <div className="space-y-3 rounded-xl border p-3" aria-label="Registrar pago o ajuste a favor">
      <p className="text-sm font-semibold">Pago por transferencia u otro medio, o ajuste a favor</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="cr-origen" label="Tipo">
          <select id="cr-origen" className={SEL} value={f.origen} onChange={(e) => set("origen", e.target.value)}>
            <option value="PAGO_DECLARADO">Pago (transferencia, Mercado Pago u otro)</option>
            <option value="AJUSTE_A_FAVOR">Ajuste a favor (sin dinero)</option>
          </select>
        </Campo>
        {declarado ? (
          <Campo id="cr-medio" label="Medio">
            <select id="cr-medio" className={SEL} value={f.medio} onChange={(e) => set("medio", e.target.value)}>
              {Object.entries(ETIQUETA_MEDIO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Campo>
        ) : (
          <Campo id="cr-naturaleza" label="Naturaleza del ajuste">
            <select id="cr-naturaleza" className={SEL} value={f.naturalezaAjuste} onChange={(e) => set("naturalezaAjuste", e.target.value)}>
              <option value="">Elegí…</option>
              {["ERROR_DE_CARGA", "BONIFICACION", "DIFERENCIA_ACORDADA", "OTRO"].map((n) => <option key={n} value={n}>{ETIQUETA_NATURALEZA[n]}</option>)}
            </select>
          </Campo>
        )}
        <Campo id="cr-importe" label="Importe"><Input id="cr-importe" inputMode="decimal" placeholder="0,00" value={f.importe} onChange={(e) => set("importe", e.target.value)} className="h-11 rounded-xl" /></Campo>
        {declarado && <Campo id="cr-fecha" label="Fecha del pago"><Input id="cr-fecha" type="date" max={hoy()} value={f.fechaPago} onChange={(e) => set("fechaPago", e.target.value)} className="h-11 rounded-xl" /></Campo>}
        {declarado && <Campo id="cr-ref" label="Referencia o N° de operación (opcional)"><Input id="cr-ref" maxLength={120} value={f.referencia} onChange={(e) => set("referencia", e.target.value)} className="h-11 rounded-xl" /></Campo>}
        {declarado && <Campo id="cr-cuenta" label="Cuenta de origen (opcional)"><Input id="cr-cuenta" maxLength={120} value={f.cuentaOrigenDeclarada} onChange={(e) => set("cuentaOrigenDeclarada", e.target.value)} className="h-11 rounded-xl" /></Campo>}
      </div>
      <Campo id="cr-motivo" label={declarado ? (f.medio === "OTRO" ? "Nota: ¿qué medio fue?" : "Nota (opcional)") : "Motivo"}><Textarea id="cr-motivo" maxLength={500} value={f.motivo} onChange={(e) => set("motivo", e.target.value)} className="rounded-xl" /></Campo>
      {declarado && (
        <label className="flex min-h-11 items-start gap-2 rounded-lg border border-amber-200 p-2 text-sm dark:border-amber-800">
          <input id="cr-fuera-caja" type="checkbox" checked={fueraDeCaja} onChange={(e) => { setFueraDeCaja(e.target.checked); setError(null) }} className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Este pago <strong>no salió del efectivo de la Caja</strong>. Los pagos en efectivo de la Caja ya están en Egresos: se vinculan con «Vincular pago de Caja», no se declaran.</span>
        </label>
      )}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2"><Button className="min-h-11 rounded-xl" onClick={continuar}>Continuar</Button><Button variant="outline" className="min-h-11 rounded-xl" onClick={onCancelar}>Cancelar</Button></div>
    </div>
  )
}

function FormVincular({ negocioId, proveedorId, proveedorNombre, onCancelar, onHecho }: PropsForm & { proveedorNombre: string }) {
  const refrescar = useRefrescar(negocioId)
  const accion = useAccion()
  const q = useQuery({ queryKey: qk.sinVincular(negocioId), queryFn: () => getJson<{ pagos: PagoCaja[] }>("/api/negocio/proveedores/pagos-caja-sin-vincular") })
  const [elegido, setElegido] = useState<PagoCaja | null>(null)
  if (elegido) {
    const enviar = (confirmoNoDuplicado: boolean) => void accion.ejecutar(`/api/negocio/proveedores/${proveedorId}/creditos/caja`, confirmoNoDuplicado ? { egresoCajaId: elegido.id, confirmoNoDuplicado: true } : { egresoCajaId: elegido.id }, () => { refrescar(); onHecho(`Pago de Caja por ${formatoArs(elegido.importe)} vinculado.`) })
    const dup = candidatosDe(accion.fallo).length > 0
    return (
      <Confirmacion titulo={`Vincular este pago de Caja a ${proveedorNombre}`} textoBoton="Vincular pago" enviando={accion.enviando} deshabilitado={dup} fallo={dup ? null : accion.fallo}
        filas={[["Importe", formatoArs(elegido.importe)], ["Caja", elegido.caja], ["Fecha", fecha(elegido.createdAt)], ["Motivo en Caja", elegido.motivo], ...(elegido.proveedorNombre ? [["Proveedor anotado en Caja", elegido.proveedorNombre] as [string, string]] : [])]}
        aviso="Resta de lo que le debés por el importe exacto del pago. La salida de Caja no se modifica. Mientras esté vinculado, ese pago no se puede compensar en Egresos: primero hay que desvincularlo."
        onVolver={() => { setElegido(null); accion.limpiar() }}
        onConfirmar={() => enviar(false)}>
        <AvisoDuplicados fallo={accion.fallo} enviando={accion.enviando} textoBoton="Son pagos distintos: vincular igual" onConfirmar={() => enviar(true)} />
      </Confirmacion>
    )
  }
  return (
    <div className="space-y-3 rounded-xl border p-3" aria-label="Vincular pago de Caja">
      <p className="text-sm font-semibold">Pagos a proveedor registrados en Caja, sin vincular</p>
      {q.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {q.data && q.data.pagos.length === 0 && <p className="text-sm text-muted-foreground">No hay pagos a proveedor de Caja pendientes de vincular. Los pagos compensados no aparecen.</p>}
      <ul className="space-y-2">
        {q.data?.pagos.map((pg) => (
          <li key={pg.id}>
            <button onClick={() => setElegido(pg)} className="flex min-h-14 w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm hover:bg-muted/40">
              <span className="min-w-0"><span className="block break-words font-medium">{pg.proveedorNombre || "Sin proveedor anotado"}{pg.proveedorIdentificacion ? ` · ${pg.proveedorIdentificacion}` : ""}</span><span className="block break-words text-xs text-muted-foreground">{pg.caja} · {fecha(pg.createdAt)} · {pg.motivo}</span></span>
              <span className="font-semibold tabular-nums">{formatoArs(pg.importe)}</span>
            </button>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="min-h-11 rounded-xl" onClick={onCancelar}>Cancelar</Button>
    </div>
  )
}

function FormAsignar({ negocioId, proveedorId, credito, obligaciones, onCancelar, onHecho }: PropsForm & { credito: Credito; obligaciones: Obligacion[] }) {
  const refrescar = useRefrescar(negocioId)
  const accion = useAccion()
  const abiertas = obligaciones.filter((o) => o.estado === "VIGENTE" && centavos(o.pendiente) > 0)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [revisar, setRevisar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sug = useQuery({ queryKey: [...qk.cuenta(negocioId, proveedorId), "sugerencia", credito.id], queryFn: () => getJson<{ sugerencia: { renglones: Array<{ obligacionId: string; importe: number }> } }>(`/api/negocio/proveedores/${proveedorId}/sugerencia?creditoId=${encodeURIComponent(credito.id)}`) })
  const aplicarSugerencia = () => { setValores(Object.fromEntries((sug.data?.sugerencia.renglones ?? []).map((r) => [r.obligacionId, aEntrada(r.importe)]))); setError(null) }
  const renglones: RenglonEntrada[] = abiertas.map((o) => ({ obligacionId: o.id, pendiente: o.pendiente, valor: valores[o.id] ?? "" }))
  const v = validarRenglones(renglones, credito.disponible)
  if (revisar && v.ok) {
    return (
      <Confirmacion titulo="Revisá la asignación" textoBoton="Asignar" enviando={accion.enviando} fallo={accion.fallo}
        filas={[["Pago", `${etiquetaOrigenCredito(credito)} · ${formatoArs(credito.importe)}`], ...v.asignar.map((a) => [abiertas.find((o) => o.id === a.obligacionId)?.descripcion ?? "Deuda", formatoArs(a.importe)] as [string, string]), ["Queda sin asignar (anticipo)", formatoArs(desdeCentavos(v.restanteCentavos))]]}
        aviso="Asignar sólo indica qué deudas cancela este pago: el saldo con el proveedor no cambia. Podés desafectar o reasignar después."
        onVolver={() => { setRevisar(false); accion.limpiar() }}
        onConfirmar={() => void accion.ejecutar(`/api/negocio/proveedores/${proveedorId}/asignaciones`, { tipo: "ASIGNAR", asignar: v.asignar.map((a) => ({ creditoId: credito.id, obligacionId: a.obligacionId, importe: a.importe })) }, () => { refrescar(); onHecho(`Asignaste ${formatoArs(desdeCentavos(v.totalCentavos))}.`) })} />
    )
  }
  return (
    <div className="space-y-3 rounded-xl border p-3" aria-label="Asignar pago a deudas">
      <p className="text-sm font-semibold">Asignar {etiquetaOrigenCredito(credito).toLowerCase()} · disponible {formatoArs(credito.disponible)}</p>
      {abiertas.length === 0 ? <p className="text-sm text-muted-foreground">No hay deudas vigentes con saldo pendiente. El pago queda como anticipo.</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="min-h-11 rounded-xl" disabled={!sug.data} onClick={aplicarSugerencia}>Sugerir (de la más antigua a la más nueva)</Button>
            <span className="text-xs text-muted-foreground">Es sólo una sugerencia: podés cambiar cada importe.</span>
          </div>
          <ul className="space-y-2">
            {abiertas.map((o) => (
              <li key={o.id} className={cn("grid gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_10rem] sm:items-center", !v.ok && v.obligacionId === o.id && "border-rose-400")}>
                <label htmlFor={`asig-${o.id}`} className="min-w-0 text-sm"><span className="block break-words font-medium">{o.descripcion}</span><span className="block text-xs text-muted-foreground">{fecha(o.fecha, false)} · pendiente {formatoArs(o.pendiente)}</span></label>
                <Input id={`asig-${o.id}`} inputMode="decimal" placeholder="0,00" value={valores[o.id] ?? ""} onChange={(e) => { setValores((x) => ({ ...x, [o.id]: e.target.value })); setError(null) }} className="h-11 rounded-xl" />
              </li>
            ))}
          </ul>
          <p className="text-sm tabular-nums" data-testid="total-asignacion">{v.ok ? <>Total {formatoArs(desdeCentavos(v.totalCentavos))} · queda sin asignar {formatoArs(desdeCentavos(v.restanteCentavos))}</> : null}</p>
        </>
      )}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {abiertas.length > 0 && <Button className="min-h-11 rounded-xl" onClick={() => (v.ok ? setRevisar(true) : setError(v.error))}>Continuar</Button>}
        <Button variant="outline" className="min-h-11 rounded-xl" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  )
}

function FormReasignar({ negocioId, proveedorId, asignacion, obligaciones, nombreCredito, nombreObligacion, onCancelar, onHecho }: PropsForm & { asignacion: Asignacion; obligaciones: Obligacion[]; nombreCredito: (id: string) => string; nombreObligacion: (id: string) => string }) {
  const refrescar = useRefrescar(negocioId)
  const accion = useAccion()
  const destinos = obligaciones.filter((o) => o.estado === "VIGENTE" && o.id !== asignacion.obligacionId && centavos(o.pendiente) > 0)
  const [destino, setDestino] = useState("")
  const [importe, setImporte] = useState(aEntrada(asignacion.importe))
  const [motivo, setMotivo] = useState("")
  const [revisar, setRevisar] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const o = destinos.find((x) => x.id === destino)
  const imp = parseImporteArs(importe)
  const continuar = () => {
    if (!o) return setError("Elegí la deuda de destino.")
    if (!imp.ok) return setError(imp.error)
    const c = Math.round(Number(imp.valor) * 100)
    if (c > centavos(asignacion.importe)) return setError(`No podés reasignar más de lo asignado (${formatoArs(asignacion.importe)}).`)
    if (c > centavos(o.pendiente)) return setError(`La deuda de destino tiene pendiente ${formatoArs(o.pendiente)}.`)
    if (!motivo.trim()) return setError("Escribí el motivo.")
    setRevisar(true)
  }
  if (revisar && o && imp.ok) {
    const resto = centavos(asignacion.importe) - Math.round(Number(imp.valor) * 100)
    return (
      <Confirmacion titulo="Revisá la reasignación" textoBoton="Reasignar" enviando={accion.enviando} fallo={accion.fallo}
        filas={[["Pago", nombreCredito(asignacion.creditoId)], ["Se desafecta de", `${nombreObligacion(asignacion.obligacionId)} · ${formatoArs(asignacion.importe)}`], ["Se asigna a", `${o.descripcion} · ${formatoArs(imp.valor)}`], ...(resto > 0 ? [["Queda sin asignar", formatoArs(desdeCentavos(resto))] as [string, string]] : []), ["Motivo", motivo]]}
        aviso="Se hace en una sola operación: la asignación original queda en el historial como desafectada."
        onVolver={() => { setRevisar(false); accion.limpiar() }}
        onConfirmar={() => void accion.ejecutar(`/api/negocio/proveedores/${proveedorId}/asignaciones`, { tipo: "REASIGNAR", desafectar: [asignacion.id], asignar: [{ creditoId: asignacion.creditoId, obligacionId: o.id, importe: imp.valor }], motivo }, () => { refrescar(); onHecho("Reasignación registrada.") })} />
    )
  }
  return (
    <div className="space-y-3 rounded-xl border p-3" aria-label="Reasignar">
      <p className="text-sm font-semibold">Reasignar {formatoArs(asignacion.importe)} de {nombreObligacion(asignacion.obligacionId)}</p>
      {destinos.length === 0 ? <p className="text-sm text-muted-foreground">No hay otra deuda vigente con saldo pendiente. Podés desafectar la asignación y el importe queda como anticipo.</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo id="reasig-destino" label="Nueva deuda">
            <select id="reasig-destino" className={SEL} value={destino} onChange={(e) => { setDestino(e.target.value); setError(null) }}>
              <option value="">Elegí…</option>
              {destinos.map((d) => <option key={d.id} value={d.id}>{d.descripcion} · pendiente {formatoArs(d.pendiente)}</option>)}
            </select>
          </Campo>
          <Campo id="reasig-importe" label="Importe a reasignar"><Input id="reasig-importe" inputMode="decimal" value={importe} onChange={(e) => { setImporte(e.target.value); setError(null) }} className="h-11 rounded-xl" /></Campo>
        </div>
      )}
      {destinos.length > 0 && <Campo id="reasig-motivo" label="Motivo"><Textarea id="reasig-motivo" maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setError(null) }} className="rounded-xl" /></Campo>}
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {destinos.length > 0 && <Button className="min-h-11 rounded-xl" onClick={continuar}>Continuar</Button>}
        <Button variant="outline" className="min-h-11 rounded-xl" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  )
}

const CONFIG_MOTIVO = {
  "anular-obligacion": { titulo: "Anular deuda", boton: "Anular deuda", requerido: true, aviso: "La deuda deja de contar. Queda en el historial con su motivo.", exito: "Deuda anulada." },
  confirmacion: { titulo: "Confirmar pago declarado", boton: "Confirmar pago", requerido: false, aviso: "Confirmás que el pago se hizo: empieza a restar de la deuda y se puede asignar. No es una conciliación bancaria.", exito: "Pago confirmado. Ya resta de la deuda." },
  rechazo: { titulo: "Rechazar pago declarado", boton: "Rechazar", requerido: true, aviso: "El pago no se hizo o no corresponde: nunca restó de la deuda y queda en el historial.", exito: "Pago rechazado." },
  anulacion: { titulo: "Anular", boton: "Anular", requerido: true, aviso: "Deja de restar de la deuda. Queda en el historial con su motivo.", exito: "Anulado." },
  desvinculacion: { titulo: "Desvincular pago de Caja", boton: "Desvincular", requerido: true, aviso: "Deja de restar de la deuda de este proveedor. La salida de Caja no cambia; después podés vincularla a otro proveedor o compensarla en Egresos.", exito: "Pago desvinculado." },
  desafectar: { titulo: "Desafectar asignación", boton: "Desafectar", requerido: true, aviso: "El importe vuelve a quedar sin asignar (anticipo). El saldo con el proveedor no cambia.", exito: "Asignación desafectada." },
} as const

function FormMotivo({ negocioId, proveedorId, modo, onCancelar, onHecho }: PropsForm & { modo: Extract<Modo, { tipo: "motivo" }> }) {
  const refrescar = useRefrescar(negocioId)
  const accion = useAccion()
  const [motivo, setMotivo] = useState("")
  const cfg = CONFIG_MOTIVO[modo.accion]
  const url = modo.accion === "anular-obligacion" ? `/api/negocio/proveedores/obligaciones/${modo.id}/anulacion`
    : modo.accion === "desafectar" ? `/api/negocio/proveedores/${proveedorId}/asignaciones`
      : `/api/negocio/proveedores/creditos/${modo.id}/${modo.accion}`
  const body: Record<string, unknown> = modo.accion === "desafectar" ? { tipo: "DESAFECTAR", desafectar: [modo.id], motivo } : { motivo }
  const falta = cfg.requerido && !motivo.trim()
  return (
    <div className="space-y-3">
      <Campo id="motivo-accion" label={cfg.requerido ? "Motivo" : "Nota (opcional)"}><Textarea id="motivo-accion" maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); accion.limpiar() }} className="rounded-xl" /></Campo>
      <Confirmacion titulo={cfg.titulo} textoBoton={cfg.boton} filas={modo.resumen} aviso={cfg.aviso} enviando={accion.enviando} deshabilitado={falta} fallo={accion.fallo}
        onVolver={onCancelar}
        onConfirmar={() => { if (!falta) void accion.ejecutar(url, body, () => { refrescar(); onHecho(cfg.exito) }) }} />
      {falta && <p className="text-xs text-muted-foreground">Escribí el motivo para continuar.</p>}
    </div>
  )
}
