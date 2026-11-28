"use client"

// ============================================
// T7-F1 — Administración → Resumen → Retiros personales (sólo el dueño)
// ============================================
// Resumen por período, tipo de beneficiario y persona; detalle por persona con productos, valor comercial, costo
// conocido, quién registró, observaciones y estado; decisiones INFORMATIVAS de recuperación (nada, todo, una parte o
// pendiente) con historial; anulación por error y devolución física auditadas; permisos individuales de los
// empleados de Caja. Nada de esto mueve dinero: no hay cobros ni descuentos de sueldo.

import { useMemo, useState } from "react"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronLeft, PackageMinus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn, formatPrice } from "@/lib/utils"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { ETIQUETA_BENEFICIARIO, type BeneficiarioTipo } from "@/lib/retiros-personales"

const BASE = "/api/negocio/caja/retiros-personales"

// ---------------------------------------------------------------------------
// Períodos (hora local del dispositivo del dueño)
// ---------------------------------------------------------------------------

export type Periodo = "hoy" | "semana" | "mes" | "rango"

/** Límites [desde, hasta) de un período. Semana = desde el lunes; rango = días completos, ambos incluidos. */
export function limitesPeriodo(periodo: Periodo, ahora: Date, rango?: { desde: string; hasta: string }): { desde: Date; hasta: Date } | null {
  const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const hoy = inicioDia(ahora)
  if (periodo === "hoy") return { desde: hoy, hasta: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1) }
  if (periodo === "semana") {
    const offset = (hoy.getDay() + 6) % 7
    const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - offset)
    return { desde: lunes, hasta: new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 7) }
  }
  if (periodo === "mes") return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1) }
  if (!rango?.desde || !rango?.hasta) return null
  const [ay, am, ad] = rango.desde.split("-").map(Number)
  const [by, bm, bd] = rango.hasta.split("-").map(Number)
  if (!ay || !by) return null
  const desde = new Date(ay, am - 1, ad)
  const hasta = new Date(by, bm - 1, bd + 1)
  return desde < hasta ? { desde, hasta } : null
}

// ---------------------------------------------------------------------------
// Tipos de la API
// ---------------------------------------------------------------------------

interface ResumenPersona { clave: string; tipo: BeneficiarioTipo; nombre: string; cantidad: number; valor: number; costo: number; decidido: number; pendiente: number }
interface ResumenRetiros {
  valorComercial: number
  costoConocido: number
  retirosConCostoIncompleto: number
  cantidadRetiros: number
  cantidadAnulados: number
  porTipo: Record<BeneficiarioTipo, number>
  importeDecididoRecuperar: number
  importePendienteDecision: number
  importeRecuperadoRegistrado: null
  personas: ResumenPersona[]
}
interface LineaRetiro { id: string; nombre: string; varianteNombre: string | null; cantidad: number; devuelto: number; precioUnitario: number; subtotal: number; costoUnitario: number | null; costoTotal: number | null; movioStock: boolean }
export interface RetiroDueno {
  id: string
  createdAt: string
  estado: "VIGENTE" | "ANULADO"
  beneficiarioTipo: BeneficiarioTipo
  beneficiarioId: string | null
  beneficiarioNombre: string
  registradoPorTipo: "NEGOCIO" | "EMPLEADO"
  registradoPorNombre: string
  observaciones: string | null
  valorComercial: number
  costoConocido: number
  costoCompleto: boolean
  valorVigente: number
  costoVigente: number
  valorDevuelto: number
  admiteDecision: boolean
  decision: { id: string; importeRecuperar: number; asignado: number; motivo: string | null; decididoPorNombre: string; createdAt: string } | null
  lineas: LineaRetiro[]
  devoluciones: Array<{ id: string; tipo: "ANULACION" | "DEVOLUCION"; motivo: string; registradoPorNombre: string; valor: number; createdAt: string }>
}
interface DecisionHistorial { id: string; estado: "VIGENTE" | "REEMPLAZADA" | "ANULADA"; importeRecuperar: number; valorElegible: number; motivo: string | null; decididoPorNombre: string; createdAt: string; finalizadaEn: string | null; retiros: Array<{ retiroId: string; elegible: number; asignado: number }> }

const fecha = (iso: string) => new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init })
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(json.error ?? "No se pudo completar la operación.")
  return json
}

/** Estado visible de un retiro (anulado, devuelto total/parcial, vigente). */
export function estadoRetiro(r: Pick<RetiroDueno, "estado" | "valorDevuelto" | "valorComercial">): string {
  if (r.estado === "ANULADO") return "Anulado"
  if (r.valorDevuelto > 0 && r.valorDevuelto >= r.valorComercial) return "Devuelto"
  if (r.valorDevuelto > 0) return "Devolución parcial"
  return "Vigente"
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function OwnerRetirosPersonales() {
  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const [rango, setRango] = useState({ desde: "", hasta: "" })
  const [tipo, setTipo] = useState<"" | BeneficiarioTipo>("")
  const [persona, setPersona] = useState<ResumenPersona | null>(null)
  const limites = useMemo(() => limitesPeriodo(periodo, new Date(), rango), [periodo, rango])
  const qs = limites ? `desde=${encodeURIComponent(limites.desde.toISOString())}&hasta=${encodeURIComponent(limites.hasta.toISOString())}${tipo ? `&tipo=${tipo}` : ""}` : ""

  const resumen = useQuery<{ resumen: ResumenRetiros }>({
    queryKey: ["retiros-personales-resumen", qs],
    enabled: Boolean(limites),
    queryFn: () => pedir(`${BASE}/resumen?${qs}`),
  })
  const r = resumen.data?.resumen

  return (
    <details className="rounded-2xl border p-3" data-testid="owner-retiros-personales">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold"><PackageMinus className="h-4 w-4" /> Retiros personales</summary>
      <p className="mt-1 text-xs text-muted-foreground">Mercadería que salió de Caja sin pago (empleados, familiares y dueño). No son ventas ni movimientos de dinero.</p>

      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Período">
          {(["hoy", "semana", "mes", "rango"] as Periodo[]).map((p) => (
            <button key={p} type="button" onClick={() => { setPeriodo(p); setPersona(null) }} className={cn("min-h-9 rounded-full px-3 text-xs font-semibold", periodo === p ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground")}>
              {p === "hoy" ? "Hoy" : p === "semana" ? "Esta semana" : p === "mes" ? "Este mes" : "Rango"}
            </button>
          ))}
        </div>
        {periodo === "rango" && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-xs"><span className="block">Desde</span><Input type="date" value={rango.desde} onChange={(e) => setRango((v) => ({ ...v, desde: e.target.value }))} className="h-10 rounded-xl" /></label>
            <label className="space-y-1 text-xs"><span className="block">Hasta</span><Input type="date" value={rango.hasta} onChange={(e) => setRango((v) => ({ ...v, hasta: e.target.value }))} className="h-10 rounded-xl" /></label>
          </div>
        )}
        <label className="flex items-center gap-2 text-xs">
          <span>Beneficiario</span>
          <select value={tipo} onChange={(e) => { setTipo(e.target.value as "" | BeneficiarioTipo); setPersona(null) }} className="h-9 rounded-xl border bg-background px-2">
            <option value="">Todos</option>
            <option value="EMPLEADO">Empleados</option>
            <option value="FAMILIAR">Familiares</option>
            <option value="DUENO">Dueño</option>
          </select>
          {r && r.personas.length > 0 && (
            <select aria-label="Persona" value={persona?.clave ?? ""} onChange={(e) => setPersona(r.personas.find((p) => p.clave === e.target.value) ?? null)} className="h-9 min-w-0 flex-1 rounded-xl border bg-background px-2">
              <option value="">Todas las personas</option>
              {r.personas.map((p) => <option key={p.clave} value={p.clave}>{p.nombre} · {ETIQUETA_BENEFICIARIO[p.tipo]}</option>)}
            </select>
          )}
        </label>
      </div>

      {!limites ? <p className="mt-3 text-xs text-muted-foreground">Elegí las fechas del rango.</p>
        : resumen.isLoading ? <p className="mt-3 text-xs text-muted-foreground">Cargando…</p>
        : resumen.isError ? <p className="mt-3 text-xs text-rose-700 dark:text-rose-300">{(resumen.error as Error).message}</p>
        : persona && limites ? <DetallePersona persona={persona} limites={limites} onVolver={() => setPersona(null)} />
        : r && <ResumenGeneral r={r} onPersona={setPersona} />}

      <PermisosRetiro />
    </details>
  )
}

function Tarjeta({ label, value, nota }: { label: string; value: string; nota?: string }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
      {nota && <p className="text-[11px] text-muted-foreground">{nota}</p>}
    </div>
  )
}

function ResumenGeneral({ r, onPersona }: { r: ResumenRetiros; onPersona: (p: ResumenPersona) => void }) {
  return (
    <div className="mt-3 space-y-3" data-testid="retiros-resumen">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tarjeta label="Valor comercial" value={formatPrice(r.valorComercial)} />
        <Tarjeta label="Costo conocido" value={formatPrice(r.costoConocido)} nota={r.retirosConCostoIncompleto ? `${r.retirosConCostoIncompleto} con costo desconocido` : undefined} />
        <Tarjeta label="Retiros" value={String(r.cantidadRetiros)} nota={r.cantidadAnulados ? `${r.cantidadAnulados} anulados` : undefined} />
        <Tarjeta label="Empleados" value={formatPrice(r.porTipo.EMPLEADO)} />
        <Tarjeta label="Familiares" value={formatPrice(r.porTipo.FAMILIAR)} />
        <Tarjeta label="Dueño" value={formatPrice(r.porTipo.DUENO)} />
        <Tarjeta label="Decidido recuperar" value={formatPrice(r.importeDecididoRecuperar)} />
        <Tarjeta label="Pendiente de decisión" value={formatPrice(r.importePendienteDecision)} />
      </div>
      <p className="text-[11px] text-muted-foreground">El importe a recuperar es una decisión informativa: DeliGO no registra cobros ni descuentos de sueldo por estos retiros.</p>
      {r.personas.length === 0 ? <p className="text-xs text-muted-foreground">No hay retiros en este período.</p> : (
        <ul className="divide-y rounded-xl border" data-testid="retiros-personas">
          {r.personas.map((p) => (
            <li key={p.clave}>
              <button type="button" onClick={() => onPersona(p)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{p.nombre}</span>
                  <span className="block text-[11px] text-muted-foreground">{ETIQUETA_BENEFICIARIO[p.tipo]} · {p.cantidad} {p.cantidad === 1 ? "retiro" : "retiros"} · costo {formatPrice(p.costo)}{p.tipo === "EMPLEADO" ? ` · pendiente ${formatPrice(p.pendiente)}` : ""}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatPrice(p.valor)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Detalle de una persona: retiros, decisiones, correcciones y devoluciones
// ---------------------------------------------------------------------------

function DetallePersona({ persona, limites, onVolver }: { persona: ResumenPersona; limites: { desde: Date; hasta: Date }; onVolver: () => void }) {
  const queryClient = useQueryClient()
  const qs = `desde=${encodeURIComponent(limites.desde.toISOString())}&hasta=${encodeURIComponent(limites.hasta.toISOString())}&persona=${encodeURIComponent(persona.clave)}`
  // Detalle paginado (más recientes primero); los totales vienen del resumen del período completo.
  const lista = useInfiniteQuery({
    queryKey: ["retiros-personales-lista", qs],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => pedir<{ retiros: RetiroDueno[]; siguienteCursor: string | null }>(`${BASE}?${qs}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    getNextPageParam: (ultima) => ultima.siguienteCursor,
  })
  const empleadoId = persona.tipo === "EMPLEADO" ? persona.clave.slice("EMPLEADO:".length) : null
  const historial = useQuery<{ decisiones: DecisionHistorial[] }>({ queryKey: ["retiros-personales-decisiones", empleadoId], enabled: Boolean(empleadoId), queryFn: () => pedir(`${BASE}/decisiones?empleadoId=${encodeURIComponent(empleadoId!)}`) })
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [decidiendo, setDecidiendo] = useState<{ reemplaza: string | null } | null>(null)
  const [corrigiendo, setCorrigiendo] = useState<RetiroDueno | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const refrescar = () => {
    void queryClient.invalidateQueries({ queryKey: ["retiros-personales-lista"] })
    void queryClient.invalidateQueries({ queryKey: ["retiros-personales-resumen"] })
    void queryClient.invalidateQueries({ queryKey: ["retiros-personales-decisiones"] })
  }
  const retiros = lista.data?.pages.flatMap((pagina) => pagina.retiros) ?? []
  const seleccionados = retiros.filter((r) => seleccion.has(r.id))
  const elegibleSeleccion = seleccionados.reduce((s, r) => s + r.valorVigente, 0)

  const volverAPendiente = async (decisionId: string) => {
    setMsg(null)
    try {
      await pedir(`${BASE}/decisiones/${encodeURIComponent(decisionId)}/anulacion`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ motivo: "Vuelve a pendiente" }) })
      setMsg("La decisión volvió a pendiente.")
      refrescar()
    } catch (e) { setMsg((e as Error).message) }
  }
  const modificar = (decisionId: string) => {
    setSeleccion(new Set(retiros.filter((r) => r.decision?.id === decisionId).map((r) => r.id)))
    setDecidiendo({ reemplaza: decisionId })
  }

  return (
    <div className="mt-3 space-y-3" data-testid="retiros-detalle-persona">
      <button type="button" onClick={onVolver} className="flex min-h-9 items-center gap-1 text-xs font-semibold text-primary"><ChevronLeft className="h-4 w-4" /> Volver al resumen</button>
      <div>
        <p className="text-sm font-semibold">{persona.nombre} <span className="font-normal text-muted-foreground">· {ETIQUETA_BENEFICIARIO[persona.tipo]}</span></p>
        <p className="text-xs text-muted-foreground">{persona.cantidad} {persona.cantidad === 1 ? "retiro" : "retiros"} · valor {formatPrice(persona.valor)} · costo conocido {formatPrice(persona.costo)}{persona.tipo === "EMPLEADO" ? ` · decidido ${formatPrice(persona.decidido)} · pendiente ${formatPrice(persona.pendiente)}` : ""}</p>
      </div>
      {msg && <p className="text-xs" role="status">{msg}</p>}
      {lista.isLoading ? <p className="text-xs text-muted-foreground">Cargando…</p> : (
        <ul className="space-y-2">
          {retiros.map((r) => {
            const seleccionable = r.admiteDecision && r.estado === "VIGENTE" && r.valorVigente > 0 && (!r.decision || r.decision.id === decidiendo?.reemplaza)
            return (
              <li key={r.id} className={cn("rounded-xl border p-2 text-xs", r.estado === "ANULADO" && "opacity-70")} data-testid="retiro-item">
                <div className="flex items-start justify-between gap-2">
                  <label className="flex min-w-0 items-start gap-2">
                    {r.admiteDecision && <input type="checkbox" className="mt-0.5 h-4 w-4" disabled={!seleccionable} checked={seleccion.has(r.id)} onChange={(e) => setSeleccion((s) => { const n = new Set(s); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n })} aria-label="Incluir en la decisión" />}
                    <span className="min-w-0">
                      <span className="block font-semibold">{fecha(r.createdAt)} · {estadoRetiro(r)}</span>
                      <span className="block text-muted-foreground">Registró: {r.registradoPorTipo === "NEGOCIO" ? "Dueño" : r.registradoPorNombre}</span>
                    </span>
                  </label>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className="block font-semibold">{formatPrice(r.valorVigente)}</span>
                    <span className="block text-muted-foreground">costo {r.costoCompleto ? formatPrice(r.costoVigente) : `${formatPrice(r.costoVigente)} (parcial)`}</span>
                  </span>
                </div>
                <ul className="mt-1 space-y-0.5">
                  {r.lineas.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{l.cantidad} × {l.nombre}{l.varianteNombre ? ` — ${l.varianteNombre}` : ""}{l.devuelto > 0 ? ` (devuelto ${l.devuelto})` : ""}</span>
                      <span className="shrink-0 tabular-nums">{formatPrice(l.subtotal)}{l.costoTotal === null ? " · costo ?" : ""}</span>
                    </li>
                  ))}
                </ul>
                {r.observaciones && <p className="mt-1 text-muted-foreground">Obs.: {r.observaciones}</p>}
                {r.devoluciones.map((d) => <p key={d.id} className="mt-1 text-muted-foreground">{d.tipo === "ANULACION" ? "Anulado" : "Devolución"} · {fecha(d.createdAt)} · {formatPrice(d.valor)} · {d.motivo}</p>)}
                {r.decision && (
                  <div className="mt-1 rounded-lg bg-muted/50 px-2 py-1">
                    <p>Decisión: recuperar {formatPrice(r.decision.asignado)} de este retiro{r.decision.motivo ? ` · ${r.decision.motivo}` : ""}</p>
                    <div className="mt-0.5 flex gap-3">
                      <button type="button" className="font-semibold underline underline-offset-2" onClick={() => modificar(r.decision!.id)}>Modificar</button>
                      <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void volverAPendiente(r.decision!.id)}>Volver a pendiente</button>
                    </div>
                  </div>
                )}
                {r.estado === "VIGENTE" && r.valorVigente > 0 && (
                  <button type="button" className="mt-1 font-semibold text-rose-700 underline underline-offset-2 dark:text-rose-300" onClick={() => setCorrigiendo(r)}>Anular o registrar devolución</button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {lista.hasNextPage && (
        <div className="space-y-1 text-center" data-testid="retiros-ver-mas">
          <p className="text-[11px] text-muted-foreground">Se muestran los {retiros.length} retiros más recientes. Los totales de arriba incluyen todo el período.</p>
          <Button variant="outline" className="min-h-10 rounded-xl" disabled={lista.isFetchingNextPage} onClick={() => void lista.fetchNextPage()}>{lista.isFetchingNextPage ? "Cargando…" : "Ver más retiros"}</Button>
        </div>
      )}

      {persona.tipo === "EMPLEADO" && empleadoId && (
        <div className="space-y-2">
          {!decidiendo ? (
            <Button variant="outline" className="min-h-11 w-full rounded-xl" disabled={seleccionados.length === 0} onClick={() => setDecidiendo({ reemplaza: null })}>
              Decidir recuperación de {seleccionados.length || "los"} {seleccionados.length === 1 ? "retiro elegido" : "retiros elegidos"}{seleccionados.length ? ` · ${formatPrice(elegibleSeleccion)}` : ""}
            </Button>
          ) : (
            <FormDecision
              empleadoId={empleadoId}
              retiros={seleccionados}
              reemplazaDecisionId={decidiendo.reemplaza}
              onCancelar={() => { setDecidiendo(null); setSeleccion(new Set()) }}
              onHecho={(texto) => { setMsg(texto); setDecidiendo(null); setSeleccion(new Set()); refrescar() }}
            />
          )}
          {(historial.data?.decisiones.length ?? 0) > 0 && (
            <details className="rounded-xl border p-2 text-xs" data-testid="retiros-historial-decisiones">
              <summary className="cursor-pointer font-semibold">Historial de decisiones</summary>
              <ul className="mt-1 space-y-1">
                {historial.data!.decisiones.map((d) => (
                  <li key={d.id}>{fecha(d.createdAt)} · {d.estado === "VIGENTE" ? "Vigente" : d.estado === "REEMPLAZADA" ? "Reemplazada" : "Vuelta a pendiente"} · recuperar {formatPrice(d.importeRecuperar)} de {formatPrice(d.valorElegible)} · {d.retiros.length} {d.retiros.length === 1 ? "retiro" : "retiros"}{d.motivo ? ` · ${d.motivo}` : ""}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {corrigiendo && <FormCorreccion retiro={corrigiendo} onCancelar={() => setCorrigiendo(null)} onHecho={(texto) => { setMsg(texto); setCorrigiendo(null); refrescar() }} />}
    </div>
  )
}

function FormDecision({ empleadoId, retiros, reemplazaDecisionId, onCancelar, onHecho }: { empleadoId: string; retiros: RetiroDueno[]; reemplazaDecisionId: string | null; onCancelar: () => void; onHecho: (texto: string) => void }) {
  const elegible = Math.round(retiros.reduce((s, r) => s + r.valorVigente, 0) * 100) / 100
  const [importe, setImporte] = useState("")
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const valor = Number(importe.replace(",", "."))
  const valido = importe.trim() !== "" && Number.isFinite(valor) && valor >= 0 && valor <= elegible
  const guardar = async () => {
    setError(null)
    setEnviando(true)
    try {
      await pedir(`${BASE}/decisiones`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empleadoId, retiroIds: retiros.map((r) => r.id), importe: importe.trim().replace(",", "."), motivo: motivo.trim() || null, reemplazaDecisionId }) })
      onHecho(valor === 0 ? "Decisión registrada: no se recupera nada." : valor === elegible ? `Decisión registrada: recuperar el total (${formatPrice(valor)}).` : `Decisión registrada: recuperar ${formatPrice(valor)} y asumir ${formatPrice(elegible - valor)}.`)
    } catch (e) { setError((e as Error).message) } finally { setEnviando(false) }
  }
  return (
    <div className="space-y-2 rounded-xl border p-2 text-xs" data-testid="retiros-form-decision">
      <p className="font-semibold">{reemplazaDecisionId ? "Modificar decisión" : "Decisión de recuperación"} · {retiros.length} {retiros.length === 1 ? "retiro" : "retiros"} · valor {formatPrice(elegible)}</p>
      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" className="h-9 rounded-xl" onClick={() => setImporte("0")}>No recuperar</Button>
        <Button variant="outline" className="h-9 rounded-xl" onClick={() => setImporte(elegible.toFixed(2))}>Recuperar todo</Button>
      </div>
      <label className="block space-y-1"><span>Importe a recuperar (0 a {formatPrice(elegible)})</span><Input inputMode="decimal" value={importe} onChange={(e) => setImporte(e.target.value)} className="h-10 rounded-xl" /></label>
      <label className="block space-y-1"><span>Motivo u observación (opcional)</span><Input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} className="h-10 rounded-xl" /></label>
      <p className="text-muted-foreground">Es una decisión informativa: no registra un cobro ni descuenta el sueldo.</p>
      {error && <p className="text-rose-700 dark:text-rose-300" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button className="min-h-10 flex-1 rounded-xl" disabled={!valido || enviando || retiros.length === 0} onClick={() => void guardar()}>{enviando ? "Guardando…" : "Guardar decisión"}</Button>
        <Button variant="ghost" className="min-h-10 rounded-xl" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  )
}

function FormCorreccion({ retiro, onCancelar, onHecho }: { retiro: RetiroDueno; onCancelar: () => void; onHecho: (texto: string) => void }) {
  const [tipo, setTipo] = useState<"DEVOLUCION" | "ANULACION">("DEVOLUCION")
  const [cantidades, setCantidades] = useState<Record<string, string>>({})
  const [motivo, setMotivo] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [clave] = useState(() => newIdempotencyKey())
  const lineas = retiro.lineas.map((l) => ({ ...l, quedan: Math.max(0, l.cantidad - l.devuelto) })).filter((l) => l.quedan > 0)
  const pedidas = lineas.map((l) => ({ lineaId: l.id, cantidad: Number((cantidades[l.id] ?? "").replace(",", ".")) })).filter((p) => Number.isFinite(p.cantidad) && p.cantidad > 0)
  const valido = motivo.trim().length > 0 && (tipo === "ANULACION" ? confirmo : pedidas.length > 0 && pedidas.every((p) => p.cantidad <= (lineas.find((l) => l.id === p.lineaId)?.quedan ?? 0)))
  const guardar = async () => {
    setError(null)
    setEnviando(true)
    try {
      const body = tipo === "ANULACION" ? { tipo, motivo: motivo.trim(), confirmado: true } : { tipo, motivo: motivo.trim(), lineas: pedidas }
      await pedir(`${BASE}/${encodeURIComponent(retiro.id)}/devoluciones`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": clave }, body: JSON.stringify(body) })
      onHecho(tipo === "ANULACION" ? "Retiro anulado: el stock que había salido volvió al inventario." : "Devolución registrada: las unidades devueltas volvieron al inventario.")
    } catch (e) { setError((e as Error).message) } finally { setEnviando(false) }
  }
  return (
    <div className="space-y-2 rounded-xl border border-rose-300 p-2 text-xs dark:border-rose-800" data-testid="retiros-form-correccion">
      <p className="font-semibold">Corregir el retiro del {fecha(retiro.createdAt)}</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" onClick={() => setTipo("DEVOLUCION")} className={cn("min-h-10 rounded-xl border px-2 font-semibold", tipo === "DEVOLUCION" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>Devolución física</button>
        <button type="button" onClick={() => setTipo("ANULACION")} className={cn("min-h-10 rounded-xl border px-2 font-semibold", tipo === "ANULACION" ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>Anular (error de registro)</button>
      </div>
      {tipo === "DEVOLUCION" ? (
        <ul className="space-y-1">
          {lineas.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">{l.nombre}{l.varianteNombre ? ` — ${l.varianteNombre}` : ""} (quedan {l.quedan})</span>
              <Input aria-label={`Cantidad devuelta de ${l.nombre}`} inputMode="decimal" value={cantidades[l.id] ?? ""} onChange={(e) => setCantidades((c) => ({ ...c, [l.id]: e.target.value }))} className="h-9 w-20 rounded-xl" />
            </li>
          ))}
        </ul>
      ) : (
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} /><span>El retiro se registró por error: la mercadería nunca salió. Se conserva el registro original.</span></label>
      )}
      <label className="block space-y-1"><span>Motivo</span><Input value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} className="h-10 rounded-xl" /></label>
      {error && <p className="text-rose-700 dark:text-rose-300" role="alert">{error}</p>}
      <div className="flex gap-2">
        <Button className="min-h-10 flex-1 rounded-xl" disabled={!valido || enviando} onClick={() => void guardar()}>{enviando ? "Guardando…" : tipo === "ANULACION" ? "Anular retiro" : "Registrar devolución"}</Button>
        <Button variant="ghost" className="min-h-10 rounded-xl" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Permisos individuales (empleados del área Caja)
// ---------------------------------------------------------------------------

function PermisosRetiro() {
  const q = useQuery<{ empleados: Array<{ id: string; nombre: string; habilitado: boolean; areaCaja: boolean }> }>({ queryKey: ["permisos-retiro"], queryFn: () => pedir("/api/negocio/empleados/permisos-retiro") })
  const [msg, setMsg] = useState<string | null>(null)
  const cambiar = async (empleadoId: string, habilitado: boolean) => {
    setMsg(null)
    try {
      await pedir("/api/negocio/empleados/permisos-retiro", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ empleadoId, habilitado }) })
      setMsg(habilitado ? "Permiso habilitado." : "Permiso revocado: vale también para las sesiones abiertas.")
      void q.refetch()
    } catch (e) { setMsg((e as Error).message) }
  }
  return (
    <details className="mt-3 rounded-xl border p-2 text-xs" data-testid="permisos-retiro">
      <summary className="min-h-9 cursor-pointer py-1 font-semibold">Quién puede registrar retiros</summary>
      <p className="text-muted-foreground">Deshabilitado por defecto. El dueño siempre puede. Un cajero habilitado registra retiros sin pedir aprobación, pero no ve costos ni decide recuperaciones.</p>
      {q.isLoading ? <p className="mt-1 text-muted-foreground">Cargando…</p> : (q.data?.empleados.length ?? 0) === 0 ? <p className="mt-1 text-muted-foreground">No hay empleados del área Caja.</p> : (
        <ul className="mt-1 divide-y">
          {q.data!.empleados.map((e) => (
            <li key={e.id} className="flex min-h-11 items-center justify-between gap-2">
              <span>{e.nombre}{!e.areaCaja ? " (ya no está en Caja)" : ""}</span>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={e.habilitado} disabled={!e.habilitado && !e.areaCaja} onChange={(x) => void cambiar(e.id, x.target.checked)} aria-label={`Permitir a ${e.nombre} registrar retiros`} />
                <span>{e.habilitado ? "Habilitado" : "Sin permiso"}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="mt-1" role="status">{msg}</p>}
    </details>
  )
}
