"use client"

// ============================================
// Rediseño de pagos — ETAPA 2: cuenta corriente del proveedor por pedidos y facturas
// ============================================
// Resumen arriba; debajo, filas compactas (cerradas por defecto) de pedidos y facturas/recepciones con total, pagado,
// saldo y estado. Cada pedido agrupa sus recepciones, cada una con su propia deuda y saldo. «Pagar deudas
// seleccionadas»: una transferencia realizada por el dueño y su reparto en UNA operación (el servidor aplica los topes).
// Pagos sin asignar, anticipos y transferencias programadas en apartados plegables propios. Sólo dueño.

import { useMemo, useRef, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { formatoArs, parseImporteArs } from "@/components/business/caja-salidas-cajero"
import { enviarJson } from "@/components/business/recepcion-editor"

type EstadoFactura = "PENDIENTE" | "PARCIAL" | "PAGADA"
type PagoVista = { creditoId: string; medio: string; estado: string; importeTotal: number; referencia: string | null; fecha: string; responsable: string; origenFondos: string | null; pedido: number | null }
type Factura = {
  obligacionId: string; tipo: string; titulo: string; comprobante: string | null; descripcion: string; fecha: string; compraId: string | null
  recepcion: { id: string; numero: number; aprobadaEn: string | null } | null
  importe: number; pagado: number; pendiente: number; estado: EstadoFactura
  productos: Array<{ producto: string; variante: string | null; cantidad: number; costoUnitario: number | null }>
  pagos: Array<PagoVista & { asignacionId: string; aplicado: number; aplicadoEn: string }>
  historial: Array<Partial<PagoVista> & { id: string; tipo: string; importe: number; fecha: string; vigente: boolean }>
}
type Pedido = { compraId: string; numero: number; fecha: string; estadoPedido: string; productos: Array<{ producto: string; variante: string | null; cantidad: number }>; facturas: Factura[]; total: number; pagado: number; pendiente: number; estado: EstadoFactura; anticipo: { disponible: number; programado: number } }
type Credito = PagoVista & { importe: number; asignado: number; disponible: number }
type Vista = { resumen: { deudaPendiente: number; pagosAplicados: number; aFavor: number; aFavorGeneral: number; anticiposPedidos: number; programadas: number }; pedidos: Pedido[]; sinPedido: Factura[]; otras: Factura[]; sinAsignar: Credito[]; programadas: Credito[] }
type Fila = { tipo: "pedido"; p: Pedido } | { tipo: "factura"; f: Factura }
type Filtro = "TODAS" | "CON_SALDO" | EstadoFactura

const ESTADO: Record<EstadoFactura, { t: string; c: string }> = {
  PENDIENTE: { t: "Pendiente", c: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100" },
  PARCIAL: { t: "Parcialmente pagada", c: "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100" },
  PAGADA: { t: "Pagada", c: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100" },
}
const fecha = (iso: string | null | undefined, hora = false) => (iso ? new Date(iso).toLocaleString("es-AR", hora ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "short" }) : "—")
const POR_PAGINA = 15
const hoy = () => new Date().toISOString().slice(0, 10)
const imp = (t: string) => { const p = parseImporteArs(t); return p.ok ? Number(p.valor) : NaN }

/**
 * T1-04 — Texto del reparto de «Pagar deudas seleccionadas». Lo que no se reparte de una transferencia queda como
 * SALDO A FAVOR DEL NEGOCIO con este proveedor (un crédito del negocio, no una deuda con el proveedor), y no se aplica
 * solo a otras deudas. Sólo texto: el reparto y los topes los decide el servidor como siempre.
 */
export function textoRepartoPago(repartido: number, total: number, queda: number): string {
  const base = Number.isFinite(total) && total > 0 ? `Se aplican ${formatoArs(repartido)} de los ${formatoArs(total)} pagados.` : `Se aplican ${formatoArs(repartido)}.`
  return queda > 0 ? `${base} Los ${formatoArs(queda)} restantes quedan como saldo a favor de tu negocio con este proveedor y no se aplicarán automáticamente a otras deudas.` : base
}

/** T1-05 — Datos que llegan del estado de cuenta completo (`/cuenta`), sólo para mostrarlos separados. */
export type ResumenCuentaExtra = { totalAcreditado: number; cancelados: { cantidad: number; importe: number } }

function Importe({ titulo, valor, nota, testid, tono = "normal" }: { titulo: string; valor: number; nota: string; testid: string; tono?: "normal" | "deuda" | "favor" | "fuera" }) {
  return (
    <div data-testid={testid} className={cn("rounded-xl border p-2", tono === "deuda" && "border-amber-300 dark:border-amber-800", tono === "favor" && "border-emerald-300 dark:border-emerald-800", tono === "fuera" && "border-dashed bg-muted/30")}>
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="text-lg font-semibold tabular-nums">{formatoArs(valor)}</p>
      <p className="text-xs text-muted-foreground">{nota}</p>
    </div>
  )
}

function Chip({ e }: { e: EstadoFactura }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", ESTADO[e].c)}>{ESTADO[e].t}</span>
}
function Montos({ total, pagado, pendiente }: { total: number; pagado: number; pendiente: number }) {
  return <span className="block text-xs tabular-nums text-muted-foreground">Total {formatoArs(total)} · pagado {formatoArs(pagado)} · <strong className="text-foreground">falta {formatoArs(pendiente)}</strong></span>
}

function DetalleFactura({ f }: { f: Factura }) {
  return (
    <div className="space-y-2 pt-2 text-xs">
      {f.comprobante && <p>Comprobante: {f.comprobante}</p>}
      {f.recepcion?.aprobadaEn && <p>Aprobada: {fecha(f.recepcion.aprobadaEn, true)}</p>}
      {f.productos.length > 0 && <ul className="space-y-0.5" aria-label="Productos">{f.productos.map((x, i) => <li key={i}>{x.producto}{x.variante ? ` — ${x.variante}` : ""} × {x.cantidad}{x.costoUnitario !== null ? ` · ${formatoArs(x.costoUnitario)} c/u` : ""}</li>)}</ul>}
      <div>
        <p className="font-medium">Pagos aplicados</p>
        {f.pagos.length === 0 ? <p className="text-muted-foreground">Sin pagos aplicados.</p> : (
          <ul className="space-y-1">{f.pagos.map((p) => <li key={p.asignacionId} className="rounded bg-muted/40 p-1.5">{formatoArs(p.aplicado)} · {p.medio}{p.referencia ? ` · ref. ${p.referencia}` : ""} · {p.responsable}{p.origenFondos ? ` · ${p.origenFondos}` : ""}{p.pedido ? ` · anticipo del pedido N° ${p.pedido}` : ""} · aplicado {fecha(p.aplicadoEn, true)}{p.importeTotal > p.aplicado ? <span className="text-muted-foreground"> (de un pago de {formatoArs(p.importeTotal)})</span> : null}</li>)}</ul>
        )}
      </div>
      {f.historial.some((h) => !h.vigente) && (
        <details><summary className="cursor-pointer">Historial completo</summary>
          <ul className="mt-1 space-y-0.5">{f.historial.map((h) => <li key={h.id}>{fecha(h.fecha, true)} · {h.tipo === "ASIGNACION" ? (h.vigente ? "Aplicado" : "Aplicado (luego desafectado)") : "Desafectado"} {formatoArs(h.importe)} · {h.medio}</li>)}</ul>
        </details>
      )}
    </div>
  )
}

function FilaFactura({ f, sel, onSel }: { f: Factura; sel: boolean; onSel: (v: boolean) => void }) {
  return (
    <li className={cn("rounded-xl border p-2", sel && "border-primary bg-primary/5")} data-testid="fila-factura">
      <div className="flex items-start gap-2">
        {f.pendiente > 0 ? <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={sel} onChange={(e) => onSel(e.target.checked)} aria-label={`Seleccionar ${f.titulo} para pagar`} /> : <span className="mt-1 h-5 w-5 shrink-0" />}
        <details className="min-w-0 flex-1">
          <summary className="cursor-pointer list-none">
            <span className="flex flex-wrap items-center justify-between gap-1"><span className="break-words text-sm font-medium">{f.titulo}{f.comprobante ? ` · ${f.comprobante}` : ""}</span><Chip e={f.estado} /></span>
            <span className="block text-xs text-muted-foreground">{fecha(f.fecha)}</span>
            <Montos total={f.importe} pagado={f.pagado} pendiente={f.pendiente} />
          </summary>
          <DetalleFactura f={f} />
        </details>
      </div>
    </li>
  )
}

function PagarSeleccionadas({ proveedorId, facturas, onCerrar, onHecho }: { proveedorId: string; facturas: Factura[]; onCerrar: () => void; onHecho: (t: string) => void }) {
  const [importe, setImporte] = useState("")
  const [f, setF] = useState(hoy())
  const [referencia, setReferencia] = useState("")
  const [reparto, setReparto] = useState<Record<string, string>>({})
  const [noDup, setNoDup] = useState(false)
  const [estado, setEstado] = useState<{ enviando: boolean; error: string | null; code?: string }>({ enviando: false, error: null })
  const claves = useRef(new Map<string, string>())
  // Sugerencia: de la más antigua a la más nueva (todavía no hay vencimientos), hasta el importe pagado. Editable.
  const ordenadas = useMemo(() => [...facturas].sort((a, b) => a.fecha.localeCompare(b.fecha)), [facturas])
  const sugerir = () => {
    let resto = imp(importe)
    if (!Number.isFinite(resto) || resto <= 0) return setEstado({ enviando: false, error: "Escribí primero el importe de la transferencia." })
    const r: Record<string, string> = {}
    for (const x of ordenadas) { const a = Math.min(x.pendiente, Math.max(resto, 0)); r[x.obligacionId] = a > 0 ? String(Math.round(a * 100) / 100).replace(".", ",") : ""; resto = Math.round((resto - a) * 100) / 100 }
    setReparto(r); setEstado({ enviando: false, error: null })
  }
  const total = imp(importe)
  const filas = ordenadas.map((x) => ({ x, v: reparto[x.obligacionId]?.trim() ? imp(reparto[x.obligacionId]) : 0 }))
  const repartido = Math.round(filas.reduce((t, r) => t + (Number.isFinite(r.v) ? r.v : 0), 0) * 100) / 100
  const queda = Number.isFinite(total) ? Math.round((total - repartido) * 100) / 100 : 0
  const errores = [
    ...filas.filter((r) => !Number.isFinite(r.v) || r.v < 0).map((r) => `${r.x.titulo}: importe inválido.`),
    ...filas.filter((r) => r.v > r.x.pendiente + 0.004).map((r) => `${r.x.titulo}: supera su saldo (${formatoArs(r.x.pendiente)}).`),
    ...(Number.isFinite(total) && repartido > total + 0.004 ? ["Repartís más de lo que pagaste."] : []),
  ]
  const confirmar = async () => {
    if (!Number.isFinite(total) || total <= 0) return setEstado({ enviando: false, error: "Escribí el importe de la transferencia." })
    if (!f) return setEstado({ enviando: false, error: "Indicá la fecha." })
    if (errores.length) return setEstado({ enviando: false, error: errores[0] })
    const renglones = filas.filter((r) => r.v > 0).map((r) => ({ obligacionId: r.x.obligacionId, importe: r.v.toFixed(2) }))
    if (!renglones.length) return setEstado({ enviando: false, error: "Indicá cuánto aplicar al menos a una deuda." })
    const body = { importe: total.toFixed(2), fechaPago: f, referencia: referencia.trim() || null, renglones, ...(noDup ? { confirmoNoDuplicado: true } : {}) }
    const canonico = JSON.stringify(body)
    let key = claves.current.get(canonico)
    if (!key) { key = newIdempotencyKey(); claves.current.set(canonico, key) }
    setEstado({ enviando: true, error: null })
    const r = await enviarJson(`/api/negocio/proveedores/${proveedorId}/pagos-deudas`, "POST", body, key)
    if (!r.ok) { if (!r.incierto) claves.current.delete(canonico); return setEstado({ enviando: false, error: r.error, code: r.code }) }
    claves.current.delete(canonico)
    onHecho(`Transferencia de ${formatoArs(total)} registrada y aplicada a ${renglones.length} ${renglones.length === 1 ? "deuda" : "deudas"}.${queda > 0 ? ` Los ${formatoArs(queda)} restantes quedan como saldo a favor de tu negocio con este proveedor.` : ""}`)
  }
  return (
    <div className="space-y-3 rounded-2xl border border-primary/40 bg-primary/5 p-3 text-sm" data-testid="pagar-seleccionadas">
      <p className="font-semibold">Pagar deudas seleccionadas</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block space-y-1 font-medium" htmlFor="pds-imp"><span>Importe transferido ($)</span><Input id="pds-imp" inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} className="h-11 rounded-xl" /></label>
        <label className="block space-y-1 font-medium" htmlFor="pds-fecha"><span>Fecha</span><Input id="pds-fecha" type="date" value={f} onChange={(e) => setF(e.target.value)} className="h-11 rounded-xl" /></label>
        <label className="block space-y-1 font-medium" htmlFor="pds-ref"><span>Referencia (opcional)</span><Input id="pds-ref" maxLength={120} value={referencia} onChange={(e) => setReferencia(e.target.value)} className="h-11 rounded-xl" /></label>
      </div>
      <Button variant="outline" className="min-h-11 rounded-xl" onClick={sugerir}>Repartir automáticamente (más antiguas primero)</Button>
      <ul className="space-y-2" aria-label="Cuánto se aplica a cada deuda">
        {ordenadas.map((x) => (
          <li key={x.obligacionId} className="grid items-center gap-2 sm:grid-cols-[1fr_10rem]">
            <span className="text-xs"><span className="font-medium">{x.titulo}</span> · {fecha(x.fecha)} · saldo {formatoArs(x.pendiente)}</span>
            <Input aria-label={`Aplicar a ${x.titulo}`} inputMode="decimal" placeholder="0,00" value={reparto[x.obligacionId] ?? ""} onChange={(e) => setReparto((r) => ({ ...r, [x.obligacionId]: e.target.value }))} className="h-11 rounded-xl" />
          </li>
        ))}
      </ul>
      <p className={cn("text-xs", queda > 0 && "font-semibold")} data-testid="texto-reparto">{textoRepartoPago(repartido, total, queda)}</p>
      <p className="text-xs text-muted-foreground">Se registra como transferencia realizada en este paso (es tu declaración: DeliGO no la verifica con el banco) y se aplica a las deudas elegidas en la misma operación. No sale de la Caja.</p>
      {estado.code === "POSIBLE_PAGO_DUPLICADO" && <label className="flex min-h-11 items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={noDup} onChange={(e) => setNoDup(e.target.checked)} /><span>Es una transferencia distinta, no un duplicado.</span></label>}
      {(estado.error || errores[0]) && <p role="alert" className="text-sm text-rose-700">{estado.error ?? errores[0]}</p>}
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11 rounded-xl" disabled={estado.enviando || errores.length > 0} onClick={() => void confirmar()}>{estado.enviando ? "Registrando…" : "Confirmar pago"}</Button>
        <Button variant="ghost" className="min-h-11 rounded-xl" onClick={onCerrar}>Cancelar</Button>
      </div>
    </div>
  )
}

export function CuentaProveedorPedidos({ proveedorId, version, activo, onAplicarManual, onCambio, extra, formularioAplicar }: {
  proveedorId: string; version: number; activo: boolean; onAplicarManual: (creditoId: string) => void; onCambio: () => void
  /** T1-05: total acreditado y pagos que no cuentan, tal como los entrega el estado de cuenta (sin fórmulas nuevas). */
  extra?: ResumenCuentaExtra | null
  /** T1-06: el formulario «Aplicar a deudas» se muestra junto al pago elegido. */
  formularioAplicar?: { creditoId: string; nodo: ReactNode } | null
}) {
  const q = useQuery<{ vista: Vista }>({
    queryKey: ["proveedor-cuenta-pedidos", proveedorId, version],
    queryFn: async () => { const r = await fetch(`/api/negocio/proveedores/${proveedorId}/cuenta-pedidos`, { cache: "no-store" }); if (!r.ok) throw new Error("cuenta"); return r.json() },
  })
  const [busca, setBusca] = useState("")
  const [filtro, setFiltro] = useState<Filtro>("TODAS")
  const [cantidad, setCantidad] = useState(POR_PAGINA)
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [pagando, setPagando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const v = q.data?.vista
  const todas = useMemo(() => (v ? [...v.pedidos.flatMap((p) => p.facturas), ...v.sinPedido, ...v.otras] : []), [v])
  const filas: Fila[] = useMemo(() => {
    if (!v) return []
    const t = busca.trim().toLowerCase()
    const pasaF = (f: Factura) => (filtro === "TODAS" || (filtro === "CON_SALDO" ? f.pendiente > 0 : f.estado === filtro)) && (!t || `${f.titulo} ${f.comprobante ?? ""} ${f.productos.map((x) => x.producto).join(" ")}`.toLowerCase().includes(t))
    const pedidos: Fila[] = v.pedidos.filter((p) => p.facturas.some(pasaF) || ((filtro === "TODAS" || filtro === "CON_SALDO") && !p.facturas.length && (!t || `pedido ${p.numero} ${p.productos.map((x) => x.producto).join(" ")}`.toLowerCase().includes(t))) || (!!t && `pedido n° ${p.numero}`.includes(t))).map((p) => ({ tipo: "pedido", p }))
    const sueltas: Fila[] = [...v.sinPedido, ...v.otras].filter(pasaF).map((f) => ({ tipo: "factura", f }))
    return [...pedidos, ...sueltas].sort((a, b) => (b.tipo === "pedido" ? b.p.fecha : b.f.fecha).localeCompare(a.tipo === "pedido" ? a.p.fecha : a.f.fecha))
  }, [v, busca, filtro])
  const seleccionadas = todas.filter((f) => sel.has(f.obligacionId) && f.pendiente > 0)
  const marcar = (id: string, x: boolean) => setSel((s) => { const n = new Set(s); if (x) n.add(id); else n.delete(id); return n })
  const transicion = async (creditoId: string, accion: "confirmacion" | "rechazo") => {
    if (enviando) return
    setEnviando(true)
    const r = await enviarJson(`/api/negocio/proveedores/creditos/${creditoId}/${accion}`, "POST", { motivo: accion === "rechazo" ? "Transferencia programada que no se hizo" : null }, newIdempotencyKey())
    setEnviando(false)
    setAviso(r.ok ? (accion === "confirmacion" ? "Transferencia marcada como realizada. Si es de un pedido, se aplica sola al aprobar sus recepciones; si no, aplicala desde «Pagos sin asignar»." : "Transferencia programada descartada.") : r.error)
    if (r.ok) onCambio()
  }
  if (q.isLoading) return <p className="text-sm text-muted-foreground">Cargando cuenta…</p>
  if (q.isError || !v) return <p role="alert" className="text-sm text-rose-700">No se pudo cargar la cuenta.</p>
  const R = v.resumen
  return (
    <section className="space-y-3" aria-label="Cuenta corriente por pedidos y facturas" data-testid="cuenta-por-pedidos">
      {/* T1-05: each concept on its own, with the values the server already computes. Money that was paid,
          what is still owed, and what is NOT money paid (scheduled, rejected/voided) never share a card. */}
      <div className="space-y-2" data-testid="resumen-cuenta">
        <div className="grid gap-2 sm:grid-cols-3">
          <Importe titulo="Deuda pendiente" valor={R.deudaPendiente} nota="Lo que todavía le debés a este proveedor" testid="resumen-deuda" tono="deuda" />
          {extra && <Importe titulo="Total pagado y acreditado" valor={extra.totalAcreditado} nota="Pagos confirmados y ajustes a favor (no incluye programados ni cancelados)" testid="resumen-total-acreditado" />}
          <Importe titulo="Pagos aplicados a deudas" valor={R.pagosAplicados} nota="Parte de lo pagado que ya cancela facturas o recepciones" testid="resumen-aplicado" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Importe titulo="Saldo a favor de tu negocio" valor={R.aFavorGeneral} nota="Pagado y todavía sin aplicar: se aplica a una deuda sólo cuando lo decidas" testid="resumen-a-favor" tono="favor" />
          <Importe titulo="Anticipos reservados a pedidos" valor={R.anticiposPedidos} nota="Pagos de pedidos abiertos: se aplican al aprobar sus recepciones" testid="resumen-anticipos" tono="favor" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Importe titulo="Transferencias programadas" valor={R.programadas} nota="Todavía no pagadas: no restan deuda ni cuentan como pago" testid="resumen-programadas" tono="fuera" />
          {extra && <Importe titulo={`Pagos cancelados${extra.cancelados.cantidad ? ` (${extra.cancelados.cantidad})` : ""}`} valor={extra.cancelados.importe} nota="Rechazados, anulados o desvinculados: no cuentan como pagados" testid="resumen-cancelados" tono="fuera" />}
        </div>
      </div>
      {aviso && <p role="status" className="rounded-xl bg-emerald-50 p-2 text-sm text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">{aviso}</p>}
      {/* T1-07: how to reach «Pagar deudas seleccionadas», visible while there is debt and nothing is selected. */}
      {R.deudaPendiente > 0 && seleccionadas.length === 0 && !pagando && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2 text-sm" data-testid="ayuda-pagar-deudas">
          <p className="min-w-0 flex-1">Para pagar con una transferencia, marcá las deudas con saldo (están dentro de cada pedido) y tocá <strong>«Pagar deudas seleccionadas»</strong>.</p>
          {filtro !== "CON_SALDO" && <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => { setFiltro("CON_SALDO"); setCantidad(POR_PAGINA) }}>Ver deudas con saldo</Button>}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={busca} onChange={(e) => { setBusca(e.target.value); setCantidad(POR_PAGINA) }} placeholder="Buscar pedido, recepción, comprobante o producto…" className="min-h-11 rounded-xl pl-9" aria-label="Buscar en la cuenta" /></div>
        <select className="min-h-11 rounded-xl border bg-background px-3 text-sm" value={filtro} onChange={(e) => { setFiltro(e.target.value as Filtro); setCantidad(POR_PAGINA) }} aria-label="Filtrar por estado">
          <option value="TODAS">Todas</option><option value="CON_SALDO">Con saldo</option><option value="PENDIENTE">Pendientes</option><option value="PARCIAL">Parcialmente pagadas</option><option value="PAGADA">Pagadas</option>
        </select>
      </div>

      {seleccionadas.length > 0 && !pagando && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 backdrop-blur">
          <span className="text-sm">{seleccionadas.length} {seleccionadas.length === 1 ? "deuda" : "deudas"} · saldo {formatoArs(Math.round(seleccionadas.reduce((t, f) => t + f.pendiente, 0) * 100) / 100)}</span>
          <Button className="min-h-11 rounded-xl" disabled={!activo} onClick={() => { setAviso(null); setPagando(true) }}>Pagar deudas seleccionadas</Button>
          <Button variant="ghost" className="min-h-11 rounded-xl" onClick={() => setSel(new Set())}>Quitar selección</Button>
        </div>
      )}
      {pagando && <PagarSeleccionadas proveedorId={proveedorId} facturas={seleccionadas} onCerrar={() => setPagando(false)} onHecho={(t) => { setPagando(false); setSel(new Set()); setAviso(t); onCambio() }} />}

      {filas.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">No hay pedidos ni facturas para mostrar.</p> : (
        <ul className="space-y-2" aria-label="Pedidos y facturas">
          {filas.slice(0, cantidad).map((x) => x.tipo === "factura" ? <FilaFactura key={x.f.obligacionId} f={x.f} sel={sel.has(x.f.obligacionId)} onSel={(b) => marcar(x.f.obligacionId, b)} /> : (
            <li key={x.p.compraId} className="rounded-xl border p-2" data-testid="fila-pedido">
              {/* T1-07: with «Con saldo» the orders open, so their debts (and checkboxes) are in view. */}
              <details open={filtro === "CON_SALDO" && x.p.pendiente > 0 ? true : undefined}>
                <summary className="cursor-pointer list-none">
                  <span className="flex flex-wrap items-center justify-between gap-1"><span className="text-sm font-medium">Pedido N° {x.p.numero}{x.p.estadoPedido !== "ABIERTA" ? " · cerrado" : ""}</span>{x.p.facturas.length ? <Chip e={x.p.estado} /> : <span className="text-xs text-muted-foreground">Sin facturas todavía</span>}</span>
                  <span className="block text-xs text-muted-foreground">{fecha(x.p.fecha)} · {x.p.facturas.length} {x.p.facturas.length === 1 ? "recepción" : "recepciones"}{x.p.anticipo.disponible > 0 ? ` · anticipo disponible ${formatoArs(x.p.anticipo.disponible)}` : ""}{x.p.anticipo.programado > 0 ? ` · programado ${formatoArs(x.p.anticipo.programado)}` : ""}</span>
                  {x.p.facturas.length > 0 && <Montos total={x.p.total} pagado={x.p.pagado} pendiente={x.p.pendiente} />}
                </summary>
                <div className="space-y-2 pt-2">
                  <p className="text-xs">Pedido: {x.p.productos.map((l) => `${l.producto}${l.variante ? ` — ${l.variante}` : ""} × ${l.cantidad}`).join(" · ")}</p>
                  <ul className="space-y-2">{x.p.facturas.map((f) => <FilaFactura key={f.obligacionId} f={f} sel={sel.has(f.obligacionId)} onSel={(b) => marcar(f.obligacionId, b)} />)}</ul>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      {filas.length > cantidad && <Button variant="outline" className="min-h-11 w-full rounded-xl" onClick={() => setCantidad((c) => c + POR_PAGINA)}>Ver más ({filas.length - cantidad})</Button>}

      <details className="rounded-xl border p-2" data-testid="seccion-sin-asignar">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Pagos sin asignar y saldo a favor ({formatoArs(R.aFavorGeneral)})</summary>
        {v.sinAsignar.length === 0 ? <p className="text-xs text-muted-foreground">No hay pagos sin asignar.</p> : (
          <ul className="space-y-1 text-xs">{v.sinAsignar.map((c) => (
            <li key={c.creditoId} className={cn("rounded bg-muted/40 p-2", formularioAplicar?.creditoId === c.creditoId && "ring-2 ring-primary")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{c.medio} {formatoArs(c.importe)} · {fecha(c.fecha)}{c.referencia ? ` · ref. ${c.referencia}` : ""} · {c.responsable}{c.pedido ? ` · del pedido N° ${c.pedido} (cerrado)` : ""} · <strong>disponible {formatoArs(c.disponible)}</strong></span>
                {formularioAplicar?.creditoId !== c.creditoId && <Button variant="outline" className="min-h-11 rounded-xl text-xs" disabled={Boolean(formularioAplicar)} onClick={() => onAplicarManual(c.creditoId)}>Aplicar a deudas</Button>}
              </div>
              {formularioAplicar?.creditoId === c.creditoId && <div className="mt-2 text-sm" data-testid="formulario-contextual">{formularioAplicar.nodo}</div>}
            </li>
          ))}</ul>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Nada se aplica solo: cada pago se aplica cuando lo decidas.</p>
      </details>

      <details className="rounded-xl border p-2" data-testid="seccion-programadas">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Transferencias programadas ({formatoArs(R.programadas)})</summary>
        {v.programadas.length === 0 ? <p className="text-xs text-muted-foreground">No hay transferencias programadas.</p> : (
          <ul className="space-y-1 text-xs">{v.programadas.map((c) => <li key={c.creditoId} className="flex flex-wrap items-center justify-between gap-2 rounded bg-muted/40 p-2"><span>{formatoArs(c.importe)} · prevista {fecha(c.fecha)}{c.referencia ? ` · ref. ${c.referencia}` : ""}{c.pedido ? ` · pedido N° ${c.pedido}` : ""}</span><span className="flex gap-2"><Button variant="outline" className="min-h-11 rounded-xl text-xs" disabled={enviando} onClick={() => void transicion(c.creditoId, "confirmacion")}>Ya la hice</Button><Button variant="ghost" className="min-h-11 rounded-xl text-xs" disabled={enviando} onClick={() => void transicion(c.creditoId, "rechazo")}>No se hizo</Button></span></li>)}</ul>
        )}
        <p className="mt-1 text-xs text-muted-foreground">Una transferencia programada no descuenta deuda hasta que la marques como realizada.</p>
      </details>
    </section>
  )
}
