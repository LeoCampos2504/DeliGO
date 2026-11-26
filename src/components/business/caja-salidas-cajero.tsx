"use client"

// ============================================
// F10-C1b — Operaciones → Caja: «Registrar salida de Caja» (cashier only)
// ============================================
// Cash outflows of the cashier's OWN open shift, through the cashier endpoints
// of F10-C1a only:
//   GET  /api/operativo/caja/[slug]/egresos  (own open shift: individual outflows)
//   POST /api/operativo/caja/[slug]/egresos  (Idempotency-Key required)
// The server decides everything (session, área caja, own open shift, the
// register); this screen never chooses a shift or a register and never sends a
// justification. Blind close: nothing here shows or hints at the expected cash,
// a balance, a difference or "insufficient funds" — the server never blocks
// for that and never tells the cashier. Errors are shown without any amount
// from the server. One attempt key per exact content (kept across a network
// error or a 5xx, so a retry replays instead of duplicating).
// F10-C1c: the history shows, read-only, the administrative state of the
// cashier's OWN withdrawals (Pendiente / Confirmado / Observado) and «Anulada
// por el dueño» for an own outflow the owner compensated. Never the owner's
// observation text, alerts or figures; the cashier cannot change any state.

import { useCallback, useEffect, useRef, useState } from "react"
import { Banknote, CheckCircle2, ReceiptText, RefreshCw, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"

// ---------------------------------------------------------------------------
// Vocabulary (same values as the C1a API)
// ---------------------------------------------------------------------------

export type NaturalezaSalida = "GASTO" | "PAGO_PROVEEDOR" | "RETIRO_DUENO"
export type CategoriaGastoSalida = "INSUMOS" | "SERVICIOS" | "TRANSPORTE" | "MANTENIMIENTO" | "OTRO"
export type DestinatarioRetiroSalida = "DUENO" | "AUTORIZADO_POR_DUENO"

export const NATURALEZAS_SALIDA: ReadonlyArray<{ valor: NaturalezaSalida; titulo: string; ayuda: string }> = [
  { valor: "GASTO", titulo: "Gasto", ayuda: "Insumos, servicios, transporte u otros gastos del negocio." },
  { valor: "PAGO_PROVEEDOR", titulo: "Pago a proveedor", ayuda: "Pago de mercadería o de una deuda con un proveedor." },
  { valor: "RETIRO_DUENO", titulo: "Retiro del dueño", ayuda: "Efectivo que se lleva el dueño o una persona autorizada por el dueño." },
]
export const CATEGORIAS_SALIDA: ReadonlyArray<{ valor: CategoriaGastoSalida; titulo: string }> = [
  { valor: "INSUMOS", titulo: "Insumos" },
  { valor: "SERVICIOS", titulo: "Servicios" },
  { valor: "TRANSPORTE", titulo: "Transporte" },
  { valor: "MANTENIMIENTO", titulo: "Mantenimiento" },
  { valor: "OTRO", titulo: "Otro" },
]
export const DESTINATARIOS_SALIDA: ReadonlyArray<{ valor: DestinatarioRetiroSalida; titulo: string }> = [
  { valor: "DUENO", titulo: "El dueño" },
  { valor: "AUTORIZADO_POR_DUENO", titulo: "Persona autorizada por el dueño" },
]
const TITULO_NATURALEZA: Record<NaturalezaSalida, string> = { GASTO: "Gasto", PAGO_PROVEEDOR: "Pago a proveedor", RETIRO_DUENO: "Retiro del dueño" }
const TITULO_CATEGORIA: Record<string, string> = Object.fromEntries(CATEGORIAS_SALIDA.map((c) => [c.valor, c.titulo]))
const TITULO_DESTINATARIO: Record<string, string> = Object.fromEntries(DESTINATARIOS_SALIDA.map((d) => [d.valor, d.titulo]))

export const MOTIVO_SALIDA_MAX = 500
const TEXTO_CORTO_MAX = 120
const IDENTIFICACION_MAX = 40

// ---------------------------------------------------------------------------
// Pure validation (exact cents, no floating point)
// ---------------------------------------------------------------------------

/**
 * Argentine-peso amount typed by the cashier → exact decimal string ("1500.5" → "1500.50").
 * Accepts a comma or a dot as the decimal separator and an optional leading "$";
 * rejects thousands separators, more than 2 decimals, zero, negatives and amounts
 * above NUMERIC(12,2). Never goes through a float.
 */
export function parseImporteArs(texto: string): { ok: true; valor: string } | { ok: false; error: string } {
  const limpio = texto.trim().replace(/^\$\s*/, "")
  if (!limpio) return { ok: false, error: "Ingresá el importe." }
  const m = /^(\d{1,10})(?:[.,](\d{1,2}))?$/.exec(limpio)
  if (!m) return { ok: false, error: "Ingresá el importe en pesos, sin puntos de miles y con hasta 2 decimales (por ejemplo 1500,50)." }
  const enteros = m[1].replace(/^0+(?=\d)/, "")
  const centavos = (m[2] ?? "").padEnd(2, "0")
  if (/^0+$/.test(enteros) && /^0+$/.test(centavos)) return { ok: false, error: "El importe tiene que ser mayor a cero." }
  return { ok: true, valor: `${enteros}.${centavos}` }
}

export function formatoArs(valor: string | number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(valor))
}

export interface FormularioSalida {
  naturaleza: NaturalezaSalida | ""
  categoria: CategoriaGastoSalida | ""
  importe: string
  motivo: string
  proveedorNombre: string
  proveedorIdentificacion: string
  comprobanteReferencia: string
  destinatarioTipo: DestinatarioRetiroSalida | ""
  destinatarioNombre: string
}

export const FORMULARIO_VACIO: FormularioSalida = {
  naturaleza: "", categoria: "", importe: "", motivo: "", proveedorNombre: "", proveedorIdentificacion: "", comprobanteReferencia: "", destinatarioTipo: "", destinatarioNombre: "",
}

export type CampoSalida = keyof FormularioSalida
export type CuerpoSalida = Record<string, string>

const normalizar = (texto: string) => texto.trim().replace(/\s+/g, " ")

/** Builds the exact C1a request body, or the per-field errors. Only the fields of the chosen type are sent. */
export function validarSalida(f: FormularioSalida): { ok: true; cuerpo: CuerpoSalida } | { ok: false; errores: Partial<Record<CampoSalida, string>> } {
  const errores: Partial<Record<CampoSalida, string>> = {}
  if (!f.naturaleza) errores.naturaleza = "Elegí el tipo de salida."
  if (f.naturaleza === "GASTO" && !f.categoria) errores.categoria = "Elegí la categoría del gasto."
  const importe = parseImporteArs(f.importe)
  if (!importe.ok) errores.importe = importe.error
  const motivo = normalizar(f.motivo)
  if (!motivo) errores.motivo = "Escribí el motivo de la salida."
  else if (motivo.length > MOTIVO_SALIDA_MAX) errores.motivo = `El motivo admite hasta ${MOTIVO_SALIDA_MAX} caracteres.`
  const conProveedor = f.naturaleza === "GASTO" || f.naturaleza === "PAGO_PROVEEDOR"
  if (conProveedor) {
    if (normalizar(f.proveedorNombre).length > TEXTO_CORTO_MAX) errores.proveedorNombre = `Hasta ${TEXTO_CORTO_MAX} caracteres.`
    if (normalizar(f.comprobanteReferencia).length > TEXTO_CORTO_MAX) errores.comprobanteReferencia = `Hasta ${TEXTO_CORTO_MAX} caracteres.`
    if (f.naturaleza === "PAGO_PROVEEDOR" && normalizar(f.proveedorIdentificacion).length > IDENTIFICACION_MAX) errores.proveedorIdentificacion = `Hasta ${IDENTIFICACION_MAX} caracteres.`
  }
  if (f.naturaleza === "RETIRO_DUENO") {
    if (!f.destinatarioTipo) errores.destinatarioTipo = "Indicá quién recibe el efectivo."
    const nombre = normalizar(f.destinatarioNombre)
    if (!nombre) errores.destinatarioNombre = "Escribí el nombre de quien recibe el efectivo."
    else if (nombre.length > TEXTO_CORTO_MAX) errores.destinatarioNombre = `Hasta ${TEXTO_CORTO_MAX} caracteres.`
  }
  if (Object.keys(errores).length > 0 || !importe.ok || !f.naturaleza) return { ok: false, errores }

  const cuerpo: CuerpoSalida = { naturaleza: f.naturaleza, importe: importe.valor, motivo }
  if (f.naturaleza === "GASTO") cuerpo.categoria = f.categoria
  if (conProveedor) {
    if (normalizar(f.proveedorNombre)) cuerpo.proveedorNombre = normalizar(f.proveedorNombre)
    if (normalizar(f.comprobanteReferencia)) cuerpo.comprobanteReferencia = normalizar(f.comprobanteReferencia)
    if (f.naturaleza === "PAGO_PROVEEDOR" && normalizar(f.proveedorIdentificacion)) cuerpo.proveedorIdentificacion = normalizar(f.proveedorIdentificacion)
  }
  if (f.naturaleza === "RETIRO_DUENO") {
    cuerpo.destinatarioTipo = f.destinatarioTipo
    cuerpo.destinatarioNombre = normalizar(f.destinatarioNombre)
  }
  return { ok: true, cuerpo }
}

// ---------------------------------------------------------------------------
// Server answers → messages that never carry financial data
// ---------------------------------------------------------------------------

export const MENSAJE_SIN_TURNO = "Para registrar una salida de Caja necesitás tener un turno abierto. Abrilo desde «Caja y turno»."
export const MENSAJE_TURNO_YA_NO_ABIERTO = "Tu turno de Caja ya no está abierto, así que la salida no se registró. Para registrarla, abrí un turno nuevo."
export const MENSAJE_CONEXION = "No pudimos confirmar la salida por un problema de conexión. Podés reintentar: no se va a registrar dos veces."
export const MENSAJE_SERVIDOR = "No pudimos registrar la salida por un error del servidor. Podés reintentar: no se va a registrar dos veces."
export const MENSAJE_INTENTO_REUSADO = "Este intento ya se había usado con otros datos. Revisá la salida y volvé a confirmarla."
const MENSAJE_GENERICO = "No pudimos registrar la salida. Revisá los datos e intentá de nuevo."

/** Only fixed texts: the server's own wording is never shown, so no amount or balance can leak through it. */
export function mensajeErrorSalida(status: number, code: string | undefined): string {
  if (code === "TURNO_REQUERIDO" || code === "TURNO_NO_DISPONIBLE") return MENSAJE_TURNO_YA_NO_ABIERTO
  if (code === "IDEMPOTENCY_KEY_REUSED") return MENSAJE_INTENTO_REUSADO
  if (status >= 500) return MENSAJE_SERVIDOR
  const porCodigo: Record<string, string> = {
    NATURALEZA_EGRESO_INVALIDA: "Elegí el tipo de salida.",
    CATEGORIA_EGRESO_INVALIDA: "Elegí una categoría válida para el gasto.",
    IMPORTE_EGRESO_INVALIDO: "Revisá el importe: tiene que ser mayor a cero y con hasta 2 decimales.",
    MOTIVO_EGRESO_REQUERIDO: "Escribí el motivo de la salida (hasta 500 caracteres).",
    DATOS_PROVEEDOR_INVALIDOS: "Revisá los datos del proveedor o del comprobante.",
    DESTINATARIO_RETIRO_REQUERIDO: "Indicá quién recibe el efectivo y su nombre.",
    DESTINATARIO_RETIRO_INVALIDO: "El destinatario sólo corresponde a un retiro del dueño.",
    CAMPOS_NO_PERMITIDOS: MENSAJE_GENERICO,
    IDEMPOTENCY_KEY_REQUIRED: MENSAJE_GENERICO,
  }
  return (code && porCodigo[code]) || MENSAJE_GENERICO
}

// ---------------------------------------------------------------------------
// Attempt keys (same contract as the shift panel: one key per exact content)
// ---------------------------------------------------------------------------

const PREFIJO_INTENTO = "deligo:caja:salida:v1:"
const intentosEnMemoria = new Map<string, string>()

function claveIntento(scope: string, canonico: string): string {
  const mapKey = `${PREFIJO_INTENTO}${scope}:${canonico}`
  const enMemoria = intentosEnMemoria.get(mapKey)
  if (enMemoria) return enMemoria
  try {
    const guardado = sessionStorage.getItem(PREFIJO_INTENTO + scope)
    if (guardado) {
      const parsed = JSON.parse(guardado) as { canonico?: string; key?: string }
      if (parsed.canonico === canonico && parsed.key) {
        intentosEnMemoria.set(mapKey, parsed.key)
        return parsed.key
      }
    }
    const key = newIdempotencyKey()
    sessionStorage.setItem(PREFIJO_INTENTO + scope, JSON.stringify({ canonico, key }))
    intentosEnMemoria.set(mapKey, key)
    return key
  } catch {
    const key = newIdempotencyKey()
    intentosEnMemoria.set(mapKey, key)
    return key
  }
}

function olvidarIntento(scope: string) {
  for (const key of intentosEnMemoria.keys()) if (key.startsWith(`${PREFIJO_INTENTO}${scope}:`)) intentosEnMemoria.delete(key)
  try { sessionStorage.removeItem(PREFIJO_INTENTO + scope) } catch { /* storage is optional */ }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface SalidaCaja {
  id: string
  naturaleza: NaturalezaSalida
  categoria: string | null
  importe: number
  motivo: string
  proveedorNombre: string | null
  comprobanteReferencia: string | null
  destinatarioTipo: string | null
  destinatarioNombre: string | null
  registradoPor: "PROPIO" | "DUENO" | "OTRO"
  /** F10-C1c (read-only): only on the cashier's own outflows; absent on an older server. */
  estadoAdministrativo?: EstadoAdministrativoSalida | null
  createdAt: string
}

export type EstadoAdministrativoSalida = "PENDIENTE" | "CONFIRMADO" | "OBSERVADO" | "ANULADO"
export const TEXTO_ESTADO_ADMINISTRATIVO: Record<EstadoAdministrativoSalida, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADO: "Confirmado",
  OBSERVADO: "Observado",
  ANULADO: "Anulada por el dueño",
}
const CLASE_ESTADO_ADMINISTRATIVO: Record<EstadoAdministrativoSalida, string> = {
  PENDIENTE: "bg-muted text-foreground/85 ring-foreground/20",
  CONFIRMADO: "bg-emerald-100 text-emerald-900 ring-emerald-300 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-700",
  OBSERVADO: "bg-amber-100 text-amber-950 ring-amber-300 dark:bg-amber-950 dark:text-amber-100 dark:ring-amber-700",
  ANULADO: "bg-muted text-foreground/85 ring-foreground/20",
}

type Paso = "cerrado" | "formulario" | "confirmar" | "comprobante"
type Lectura = { cargando: boolean; error: string | null; turnoAbierto: boolean; salidas: SalidaCaja[] }

/** Short, readable reference of an outflow id (the full id is shown too). */
export const referenciaSalida = (id: string) => `S-${id.slice(-8).toUpperCase()}`

// Stable element ids (labels, error descriptions and focus on the first field to fix).
const idOpcionNaturaleza = (valor: string) => `salida-naturaleza-${valor}`
const idOpcionDestinatario = (valor: string) => `salida-destinatario-tipo-${valor}`
const ORDEN_CAMPOS: CampoSalida[] = ["naturaleza", "categoria", "importe", "motivo", "proveedorNombre", "proveedorIdentificacion", "comprobanteReferencia", "destinatarioTipo", "destinatarioNombre"]
const ID_CAMPO: Record<CampoSalida, string> = {
  naturaleza: idOpcionNaturaleza(NATURALEZAS_SALIDA[0].valor),
  categoria: "salida-categoria",
  importe: "salida-importe",
  motivo: "salida-motivo",
  proveedorNombre: "salida-proveedor",
  proveedorIdentificacion: "salida-cuit",
  comprobanteReferencia: "salida-comprobante",
  destinatarioTipo: idOpcionDestinatario(DESTINATARIOS_SALIDA[0].valor),
  destinatarioNombre: "salida-destinatario",
}
const idCampo = (campo: CampoSalida) => ID_CAMPO[campo]
const fechaHora = (iso: string) => new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })
const registradoPorTexto = (s: SalidaCaja) => (s.registradoPor === "PROPIO" ? "Registrada por vos" : s.registradoPor === "DUENO" ? "Registrada por el responsable del negocio" : "Registrada por otra persona")

function detalleTipo(s: { naturaleza: NaturalezaSalida; categoria: string | null }) {
  return s.naturaleza === "GASTO" && s.categoria ? `${TITULO_NATURALEZA.GASTO} · ${TITULO_CATEGORIA[s.categoria] ?? s.categoria}` : TITULO_NATURALEZA[s.naturaleza] ?? s.naturaleza
}

export function CajaSalidasCajero({ slug, negocioId, empleadoId, turnoKey, onAccessLost }: {
  slug: string
  negocioId: string
  empleadoId: string
  /**
   * The open shift seen by the shift panel: re-read the outflows whenever it changes.
   * `undefined` = not known yet (the panel is still loading): nothing is read until it
   * is known, so the page reads the history once on load, not twice.
   */
  turnoKey?: string | null
  onAccessLost: (status: number, estado?: string) => void
}) {
  const [lectura, setLectura] = useState<Lectura>({ cargando: true, error: null, turnoAbierto: false, salidas: [] })
  const [paso, setPaso] = useState<Paso>("cerrado")
  const [form, setForm] = useState<FormularioSalida>(FORMULARIO_VACIO)
  const [errores, setErrores] = useState<Partial<Record<CampoSalida, string>>>({})
  const [cuerpo, setCuerpo] = useState<CuerpoSalida | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [comprobante, setComprobante] = useState<{ salida: SalidaCaja; repetida: boolean } | null>(null)
  // The last attempt ended without a definitive answer (connection lost / 5xx): it may have been
  // registered. Editing is locked until a retry with the SAME key settles it (replay or rejection).
  const [incierto, setIncierto] = useState(false)
  const enviandoRef = useRef(false)
  const comprobanteRef = useRef<HTMLDivElement | null>(null)
  const confirmarRef = useRef<HTMLParagraphElement | null>(null)
  const registrarRef = useRef<HTMLButtonElement | null>(null)
  const scope = `${negocioId}:${empleadoId}`
  const base = `/api/operativo/caja/${encodeURIComponent(slug)}/egresos`

  const leer = useCallback(async () => {
    setLectura((actual) => ({ ...actual, cargando: true, error: null }))
    try {
      const res = await fetch(base, { cache: "no-store" })
      const json = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 403) onAccessLost(res.status, json.estado)
      if (!res.ok || !json.ok) throw new Error("lectura")
      setLectura({ cargando: false, error: null, turnoAbierto: json.turnoAbierto === true, salidas: Array.isArray(json.egresos) ? json.egresos : [] })
    } catch {
      setLectura((actual) => ({ ...actual, cargando: false, error: "No pudimos cargar las salidas de este turno." }))
    }
  }, [base, onAccessLost])

  useEffect(() => { if (turnoKey !== undefined) void leer() }, [leer, turnoKey])

  // While the form, the confirmation or the receipt is open, the floating chat
  // button steps aside so it never covers these controls (globals.css rule).
  useEffect(() => {
    if (paso === "cerrado") return
    document.body.dataset.cajaSalidaActiva = "true"
    return () => { delete document.body.dataset.cajaSalidaActiva }
  }, [paso])

  // Focus follows the step: the first type option when the form opens, the summary at the
  // confirmation, the receipt once registered (screen readers announce each step), and back
  // to «Registrar salida de Caja» when the form or the receipt closes (never lost on <body>).
  const pasoAnteriorRef = useRef<Paso>("cerrado")
  useEffect(() => {
    const anterior = pasoAnteriorRef.current
    pasoAnteriorRef.current = paso
    if (paso === "formulario") document.getElementById(idOpcionNaturaleza(NATURALEZAS_SALIDA[0].valor))?.focus()
    if (paso === "confirmar") confirmarRef.current?.focus()
    if (paso === "comprobante") comprobanteRef.current?.focus()
    if (paso === "cerrado" && anterior !== "cerrado") registrarRef.current?.focus()
  }, [paso])

  const cambiar = <K extends CampoSalida>(campo: K, valor: FormularioSalida[K]) => {
    setForm((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => ({ ...actual, [campo]: undefined }))
  }

  function abrirFormulario() {
    setIncierto(false)
    setMensaje(null)
    setErrores({})
    setForm(FORMULARIO_VACIO)
    setPaso("formulario")
  }

  function revisar() {
    const r = validarSalida(form)
    if (!r.ok) {
      setErrores(r.errores)
      setMensaje("Revisá los campos marcados.")
      // Keyboard / screen-reader users land on the first field to fix.
      const primero = ORDEN_CAMPOS.find((campo) => r.errores[campo])
      if (primero) setTimeout(() => document.getElementById(idCampo(primero))?.focus(), 0)
      return
    }
    setErrores({})
    setMensaje(null)
    setCuerpo(r.cuerpo)
    setPaso("confirmar")
  }

  async function registrar() {
    if (!cuerpo || enviandoRef.current) return
    enviandoRef.current = true
    setEnviando(true)
    setMensaje(null)
    const canonico = JSON.stringify(cuerpo)
    try {
      let res: Response
      try {
        res = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": claveIntento(scope, canonico) }, body: canonico })
      } catch {
        setMensaje(MENSAJE_CONEXION) // key kept: the retry replays
        setIncierto(true)
        return
      }
      const json = await res.json().catch(() => ({}))
      if (res.status === 401 || res.status === 403) {
        onAccessLost(res.status, json.estado)
        return
      }
      setIncierto(res.status >= 500)
      if (res.ok && json.ok && json.egreso) {
        olvidarIntento(scope)
        setComprobante({ salida: json.egreso as SalidaCaja, repetida: json.replayed === true })
        setPaso("comprobante")
        setForm(FORMULARIO_VACIO)
        setCuerpo(null)
        void leer()
        return
      }
      if (res.status < 500) olvidarIntento(scope)
      const code = typeof json.code === "string" ? json.code : undefined
      setMensaje(mensajeErrorSalida(res.status, code))
      if (code === "TURNO_REQUERIDO" || code === "TURNO_NO_DISPONIBLE") {
        setPaso("cerrado")
        setCuerpo(null)
        void leer()
      } else if (res.status < 500 && code !== "IDEMPOTENCY_KEY_REUSED") {
        setPaso("formulario")
      }
    } finally {
      enviandoRef.current = false
      setEnviando(false)
    }
  }

  const naturaleza = form.naturaleza
  const errorDe = (campo: CampoSalida) => errores[campo]
  const describir = (campo: CampoSalida) => (errores[campo] ? `salida-error-${campo}` : undefined)
  const errorCampo = (campo: CampoSalida) =>
    errores[campo] ? <p id={`salida-error-${campo}`} className="text-xs font-medium text-destructive">{errores[campo]}</p> : null

  return (
    <section aria-labelledby="salidas-caja-titulo" className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="salidas-caja-titulo" className="flex items-center gap-2 text-base font-bold"><Wallet className="h-4 w-4" />Salidas de Caja</h2>
          <p className="mt-1 text-sm text-muted-foreground">Gastos, pagos a proveedores y retiros del dueño en efectivo de tu turno.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Actualizar salidas de Caja" onClick={() => void leer()} disabled={lectura.cargando || enviando}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {mensaje && <p role="alert" data-testid="mensaje-salida" className="mt-3 break-words rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">{mensaje}</p>}
      {lectura.error && <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{lectura.error}</p>}

      {paso === "cerrado" && (
        <div className="mt-4 space-y-2">
          {!lectura.cargando && !lectura.turnoAbierto && (
            <p id="salida-sin-turno" data-testid="salida-sin-turno" className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">{MENSAJE_SIN_TURNO}</p>
          )}
          <Button ref={registrarRef} type="button" onClick={abrirFormulario} disabled={lectura.cargando || !lectura.turnoAbierto} aria-describedby={!lectura.turnoAbierto ? "salida-sin-turno" : undefined} className="h-12 w-full rounded-xl font-bold sm:w-auto">
            <Banknote className="mr-2 h-4 w-4" />Registrar salida de Caja
          </Button>
        </div>
      )}

      {paso === "formulario" && (
        <form className="mt-4 space-y-4" noValidate onSubmit={(e) => { e.preventDefault(); revisar() }} aria-label="Nueva salida de Caja">
          <fieldset className="space-y-2" aria-describedby={describir("naturaleza")}>
            <legend className="text-sm font-semibold">Tipo de salida</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {NATURALEZAS_SALIDA.map((n) => (
                <label key={n.valor} htmlFor={idOpcionNaturaleza(n.valor)} className={`flex min-h-12 cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm focus-within:ring-2 focus-within:ring-ring ${naturaleza === n.valor ? "border-primary bg-primary/5" : "bg-background"}`}>
                  {/* Short accessible name («Gasto»…); the explanation is its description. */}
                  <input type="radio" id={idOpcionNaturaleza(n.valor)} name="naturaleza-salida" value={n.valor} checked={naturaleza === n.valor} onChange={() => cambiar("naturaleza", n.valor)} className="mt-1"
                    aria-labelledby={`${idOpcionNaturaleza(n.valor)}-titulo`} aria-describedby={`${idOpcionNaturaleza(n.valor)}-ayuda`} />
                  <span className="min-w-0"><span id={`${idOpcionNaturaleza(n.valor)}-titulo`} className="block font-semibold">{n.titulo}</span><span id={`${idOpcionNaturaleza(n.valor)}-ayuda`} className="block text-xs text-muted-foreground">{n.ayuda}</span></span>
                </label>
              ))}
            </div>
            {errorCampo("naturaleza")}
          </fieldset>

          {naturaleza === "GASTO" && (
            <div className="space-y-1">
              <label htmlFor="salida-categoria" className="text-sm font-medium">Categoría del gasto</label>
              <select id="salida-categoria" value={form.categoria} onChange={(e) => cambiar("categoria", e.target.value as CategoriaGastoSalida | "")} aria-invalid={Boolean(errorDe("categoria"))} aria-describedby={describir("categoria")}
                className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">Elegí una categoría</option>
                {CATEGORIAS_SALIDA.map((c) => <option key={c.valor} value={c.valor}>{c.titulo}</option>)}
              </select>
              {errorCampo("categoria")}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="salida-importe" className="text-sm font-medium">Importe en pesos</label>
              <Input id="salida-importe" inputMode="decimal" autoComplete="off" placeholder="0,00" value={form.importe} onChange={(e) => cambiar("importe", e.target.value)}
                aria-invalid={Boolean(errorDe("importe"))} aria-describedby={describir("importe") ?? "salida-importe-ayuda"} className="h-12 rounded-xl" />
              <p id="salida-importe-ayuda" className="text-xs text-muted-foreground">Sin puntos de miles; usá coma para los centavos (por ejemplo 1500,50).</p>
              {errorCampo("importe")}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium" id="salida-medio-titulo">Medio</p>
              <p aria-labelledby="salida-medio-titulo" className="flex h-12 items-center gap-2 rounded-xl border bg-muted/40 px-3 text-sm font-semibold"><Banknote className="h-4 w-4" />Efectivo de la caja</p>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="salida-motivo" className="text-sm font-medium">Motivo</label>
            <Textarea id="salida-motivo" value={form.motivo} maxLength={MOTIVO_SALIDA_MAX} onChange={(e) => cambiar("motivo", e.target.value)} rows={3}
              aria-invalid={Boolean(errorDe("motivo"))} aria-describedby={describir("motivo")} className="rounded-xl" placeholder="Por ejemplo: bolsas y servilletas" />
            <p className="text-right text-xs text-muted-foreground">{form.motivo.length}/{MOTIVO_SALIDA_MAX}</p>
            {errorCampo("motivo")}
          </div>

          {(naturaleza === "GASTO" || naturaleza === "PAGO_PROVEEDOR") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="salida-proveedor" className="text-sm font-medium">Proveedor (opcional)</label>
                <Input id="salida-proveedor" value={form.proveedorNombre} maxLength={TEXTO_CORTO_MAX} onChange={(e) => cambiar("proveedorNombre", e.target.value)} aria-describedby={describir("proveedorNombre")} className="h-12 rounded-xl" />
                {errorCampo("proveedorNombre")}
              </div>
              {naturaleza === "PAGO_PROVEEDOR" && (
                <div className="space-y-1">
                  <label htmlFor="salida-cuit" className="text-sm font-medium">CUIT del proveedor (opcional)</label>
                  <Input id="salida-cuit" inputMode="numeric" value={form.proveedorIdentificacion} maxLength={IDENTIFICACION_MAX} onChange={(e) => cambiar("proveedorIdentificacion", e.target.value)} aria-describedby={describir("proveedorIdentificacion")} className="h-12 rounded-xl" />
                  {errorCampo("proveedorIdentificacion")}
                </div>
              )}
              <div className="space-y-1">
                <label htmlFor="salida-comprobante" className="text-sm font-medium">Número de comprobante (opcional)</label>
                <Input id="salida-comprobante" value={form.comprobanteReferencia} maxLength={TEXTO_CORTO_MAX} onChange={(e) => cambiar("comprobanteReferencia", e.target.value)} aria-describedby={describir("comprobanteReferencia")} className="h-12 rounded-xl" placeholder="Factura o ticket" />
                {errorCampo("comprobanteReferencia")}
              </div>
            </div>
          )}

          {naturaleza === "RETIRO_DUENO" && (
            <div className="space-y-3 rounded-xl border p-3">
              <fieldset className="space-y-2" aria-describedby={describir("destinatarioTipo")}>
                <legend className="text-sm font-semibold">¿Quién recibe el efectivo?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {DESTINATARIOS_SALIDA.map((d) => (
                    <label key={d.valor} htmlFor={idOpcionDestinatario(d.valor)} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm focus-within:ring-2 focus-within:ring-ring ${form.destinatarioTipo === d.valor ? "border-primary bg-primary/5" : "bg-background"}`}>
                      <input type="radio" id={idOpcionDestinatario(d.valor)} name="destinatario-salida" value={d.valor} checked={form.destinatarioTipo === d.valor} onChange={() => cambiar("destinatarioTipo", d.valor)} />
                      <span className="font-medium">{d.titulo}</span>
                    </label>
                  ))}
                </div>
                {errorCampo("destinatarioTipo")}
              </fieldset>
              <div className="space-y-1">
                <label htmlFor="salida-destinatario" className="text-sm font-medium">Nombre de quien recibe</label>
                <Input id="salida-destinatario" value={form.destinatarioNombre} maxLength={TEXTO_CORTO_MAX} onChange={(e) => cambiar("destinatarioNombre", e.target.value)} aria-invalid={Boolean(errorDe("destinatarioNombre"))} aria-describedby={describir("destinatarioNombre")} className="h-12 rounded-xl" />
                {errorCampo("destinatarioNombre")}
              </div>
              <p className="text-xs text-muted-foreground">Vos quedás registrado como quien entrega el efectivo.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => { setPaso("cerrado"); setMensaje(null); setErrores({}) }} className="h-12 rounded-xl">Cancelar</Button>
            <Button type="submit" className="h-12 rounded-xl font-bold">Revisar salida</Button>
          </div>
        </form>
      )}

      {paso === "confirmar" && cuerpo && (
        <div className="mt-4 space-y-3 rounded-xl border bg-background p-3" role="group" aria-labelledby="salida-confirmar-titulo">
          <p id="salida-confirmar-titulo" ref={confirmarRef} tabIndex={-1} className="text-sm font-semibold outline-none">Confirmá la salida antes de registrarla</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Tipo</dt><dd className="min-w-0 break-words font-medium">{detalleTipo({ naturaleza: cuerpo.naturaleza as NaturalezaSalida, categoria: cuerpo.categoria ?? null })}</dd>
            <dt className="text-muted-foreground">Importe</dt><dd className="font-bold" data-testid="salida-confirmar-importe">{formatoArs(cuerpo.importe)}</dd>
            <dt className="text-muted-foreground">Medio</dt><dd>Efectivo de la caja</dd>
            <dt className="text-muted-foreground">Motivo</dt><dd className="min-w-0 break-words">{cuerpo.motivo}</dd>
            {cuerpo.proveedorNombre && <><dt className="text-muted-foreground">Proveedor</dt><dd className="min-w-0 break-words">{cuerpo.proveedorNombre}</dd></>}
            {cuerpo.proveedorIdentificacion && <><dt className="text-muted-foreground">CUIT</dt><dd className="min-w-0 break-words">{cuerpo.proveedorIdentificacion}</dd></>}
            {cuerpo.comprobanteReferencia && <><dt className="text-muted-foreground">Comprobante</dt><dd className="min-w-0 break-words">{cuerpo.comprobanteReferencia}</dd></>}
            {cuerpo.destinatarioNombre && <><dt className="text-muted-foreground">Recibe</dt><dd className="min-w-0 break-words">{cuerpo.destinatarioNombre} ({TITULO_DESTINATARIO[cuerpo.destinatarioTipo] ?? cuerpo.destinatarioTipo})</dd></>}
          </dl>
          <p className="text-xs text-muted-foreground">Una vez registrada, la salida no se puede borrar ni editar.</p>
          {incierto && <p id="salida-incierta" className="text-xs font-medium">Reintentá antes de cambiar los datos: así sabemos si la salida quedó registrada, sin duplicarla.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => setPaso("formulario")} disabled={enviando || incierto} aria-describedby={incierto ? "salida-incierta" : undefined} className="h-12 rounded-xl">Volver a editar</Button>
            <Button type="button" onClick={() => void registrar()} disabled={enviando} aria-busy={enviando} className="h-12 rounded-xl font-bold">{enviando ? "Registrando…" : "Confirmar y registrar"}</Button>
          </div>
        </div>
      )}

      {paso === "comprobante" && comprobante && (
        <div ref={comprobanteRef} tabIndex={-1} role="status" aria-labelledby="salida-comprobante-titulo" data-testid="comprobante-salida"
          className="mt-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 outline-none dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <p id="salida-comprobante-titulo" className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-5 w-5" />Salida registrada</p>
          {comprobante.repetida && <p className="text-sm">Esta salida ya estaba registrada: te mostramos el comprobante original, no se registró otra vez.</p>}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="opacity-80">Tipo</dt><dd className="min-w-0 break-words font-medium">{detalleTipo(comprobante.salida)}</dd>
            <dt className="opacity-80">Importe</dt><dd className="font-bold">{formatoArs(comprobante.salida.importe)}</dd>
            <dt className="opacity-80">Medio</dt><dd>Efectivo de la caja</dd>
            <dt className="opacity-80">Fecha y hora</dt><dd>{fechaHora(comprobante.salida.createdAt)}</dd>
            <dt className="opacity-80">Referencia</dt><dd className="font-mono">{referenciaSalida(comprobante.salida.id)}</dd>
            <dt className="opacity-80">Identificador</dt><dd className="min-w-0 break-all font-mono text-xs">{comprobante.salida.id}</dd>
            <dt className="opacity-80">Motivo</dt><dd className="min-w-0 break-words">{comprobante.salida.motivo}</dd>
            {comprobante.salida.proveedorNombre && <><dt className="opacity-80">Proveedor</dt><dd className="min-w-0 break-words">{comprobante.salida.proveedorNombre}</dd></>}
            {comprobante.salida.comprobanteReferencia && <><dt className="opacity-80">Comprobante</dt><dd className="min-w-0 break-words">{comprobante.salida.comprobanteReferencia}</dd></>}
            {comprobante.salida.destinatarioNombre && <><dt className="opacity-80">Recibió</dt><dd className="min-w-0 break-words">{comprobante.salida.destinatarioNombre} ({TITULO_DESTINATARIO[comprobante.salida.destinatarioTipo ?? ""] ?? comprobante.salida.destinatarioTipo})</dd></>}
          </dl>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={() => { setComprobante(null); setPaso("cerrado") }} className="h-12 rounded-xl bg-background">Listo</Button>
            <Button type="button" onClick={() => { setComprobante(null); abrirFormulario() }} className="h-12 rounded-xl font-bold">Registrar otra salida</Button>
          </div>
        </div>
      )}

      {/* T1-01: the history is folded by default (it never pushes the sale out of reach); unfolded it
          shows the WHOLE list in a height-limited, keyboard-scrollable region. Same data as leer(). */}
      <details className="group mt-5" data-testid="historial-salidas-plegable">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl py-2 text-sm font-bold">
          <ReceiptText className="h-4 w-4" />
          <span>Salidas de este turno{lectura.turnoAbierto && !(lectura.cargando && lectura.salidas.length === 0) ? ` (${lectura.salidas.length})` : ""}</span>
          <span className="ml-auto text-xs font-medium text-muted-foreground"><span className="group-open:hidden">Ver</span><span className="hidden group-open:inline">Ocultar</span></span>
        </summary>
        {lectura.cargando && lectura.salidas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Cargando…</p>
        ) : !lectura.turnoAbierto ? (
          <p className="mt-2 text-sm text-muted-foreground">Sin turno abierto no hay salidas para mostrar.</p>
        ) : lectura.salidas.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no registraste salidas en este turno.</p>
        ) : (
          <ul className="mt-2 max-h-[60vh] divide-y overflow-y-auto overscroll-contain rounded-xl border" tabIndex={0} aria-label="Salidas de este turno" data-testid="historial-salidas">
            {lectura.salidas.map((s) => (
              <li key={s.id} className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold">{detalleTipo(s)}{s.estadoAdministrativo && TEXTO_ESTADO_ADMINISTRATIVO[s.estadoAdministrativo] && (
                    <span data-testid="estado-administrativo" className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${CLASE_ESTADO_ADMINISTRATIVO[s.estadoAdministrativo]}`}>
                      <span className="sr-only">Estado: </span>{TEXTO_ESTADO_ADMINISTRATIVO[s.estadoAdministrativo]}
                    </span>
                  )}</p>
                  <p className="min-w-0 break-words text-muted-foreground">{s.motivo}</p>
                  {s.destinatarioNombre && <p className="text-xs text-muted-foreground">Recibió: {s.destinatarioNombre}</p>}
                  <p className="text-xs text-muted-foreground">{fechaHora(s.createdAt)} · {referenciaSalida(s.id)} · {registradoPorTexto(s)}</p>
                </div>
                <p className="shrink-0 font-bold sm:text-right">{formatoArs(s.importe)}</p>
              </li>
            ))}
          </ul>
        )}
      </details>
    </section>
  )
}
