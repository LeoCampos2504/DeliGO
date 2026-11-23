"use client"

// ============================================
// F10-C2b / D-7 v2 — pago en efectivo al recibir mercadería (cajero)
// ============================================
// Una recepción NUNCA mueve efectivo por sí sola. Si el cajero realmente le paga al proveedor con
// el efectivo de su caja, lo registra DESDE la recepción: el servidor hace la salida PAGO_PROVEEDOR de
// F10-C1 (SU turno abierto, Idempotency-Key, confirmación explícita: un solo movimiento financiero) y,
// en la misma transacción, la deja asociada a esta recepción. Al aprobar, el dueño no busca ni vincula
// nada: el pago se aplica solo a la deuda. Si el dueño rechaza la recepción, el pago sigue registrado.

import { useCallback, useEffect, useRef, useState } from "react"
import { Banknote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { newIdempotencyKey } from "@/lib/caja-checkout-attempt"
import { formatoArs, parseImporteArs } from "@/components/business/caja-salidas-cajero"
import { enviarJson } from "@/components/business/recepcion-editor"

export const referenciaPagoRecepcion = (numero: number) => `Recepción N° ${numero}`
/** La referencia es EXACTAMENTE la de esa recepción («Recepción N° 12» no coincide con «Recepción N° 120»). */
export const esReferenciaDeRecepcion = (comprobante: string | null | undefined, numero: number) => {
  const ref = referenciaPagoRecepcion(numero)
  return comprobante === ref || (comprobante ?? "").startsWith(`${ref} · `)
}

/** Cuerpo EXACTO de la salida PAGO_PROVEEDOR de F10-C1 para una recepción. */
export function cuerpoPagoRecepcion(r: { numero: number; proveedorNombre: string; comprobante?: string | null }, importe: string) {
  const p = parseImporteArs(importe)
  if (!p.ok) return { ok: false as const, error: p.error }
  return {
    ok: true as const,
    cuerpo: {
      naturaleza: "PAGO_PROVEEDOR",
      importe: p.valor,
      motivo: `Pago de mercadería al recibir — ${referenciaPagoRecepcion(r.numero)}`.slice(0, 500),
      proveedorNombre: r.proveedorNombre.slice(0, 120),
      comprobanteReferencia: (r.comprobante ? `${referenciaPagoRecepcion(r.numero)} · ${r.comprobante}` : referenciaPagoRecepcion(r.numero)).slice(0, 120),
    },
  }
}

type PagoAsociado = { id: string; importe: string; fecha: string; caja: string | null; observado: boolean; anulado: boolean }

export function RecepcionPagoEfectivo({ pagosUrl, egresosUrl, recepcion, permitePagar = true }: { pagosUrl: string; egresosUrl: string; recepcion: { numero: number; proveedorNombre: string; comprobante?: string | null }; permitePagar?: boolean }) {
  const [turnoAbierto, setTurnoAbierto] = useState<boolean | null>(null)
  const [pagos, setPagos] = useState<PagoAsociado[]>([])
  const [abierto, setAbierto] = useState(false)
  const [importe, setImporte] = useState("")
  const [confirmo, setConfirmo] = useState(false)
  const [estado, setEstado] = useState<{ enviando: boolean; error: string | null; ok: string | null }>({ enviando: false, error: null, ok: null })
  const enCurso = useRef(false)
  const claves = useRef(new Map<string, string>())
  const ref = referenciaPagoRecepcion(recepcion.numero)

  // Pagos E1: lo que el dueño ya pagó por adelantado del pedido de esta recepción (para no pagar dos veces).
  const [anticipo, setAnticipo] = useState<{ confirmado: number; programado: number } | null>(null)
  const leer = useCallback(async () => {
    try {
      const [turno, asociados] = await Promise.all([
        permitePagar ? fetch(egresosUrl, { cache: "no-store" }).then((r) => r.json()) : Promise.resolve(null),
        fetch(pagosUrl, { cache: "no-store" }).then((r) => r.json()),
      ])
      if (turno) setTurnoAbierto(Boolean(turno.turnoAbierto))
      setPagos((asociados.pagos ?? []) as PagoAsociado[])
      setAnticipo((asociados.anticipoPedido ?? null) as { confirmado: number; programado: number } | null)
    } catch {
      setTurnoAbierto(null)
    }
  }, [egresosUrl, pagosUrl, permitePagar])
  useEffect(() => {
    let vigente = true
    // la carga corre en el callback de una promesa (nunca setState sincrónico dentro del efecto)
    void Promise.resolve().then(() => { if (vigente) void leer() })
    return () => { vigente = false }
  }, [leer])

  async function registrar() {
    const c = cuerpoPagoRecepcion(recepcion, importe)
    if (!c.ok) return setEstado({ enviando: false, error: c.error, ok: null })
    if (!confirmo) return setEstado({ enviando: false, error: "Confirmá que entregaste ese efectivo de tu caja.", ok: null })
    if (enCurso.current) return
    enCurso.current = true
    const canonico = JSON.stringify(c.cuerpo)
    let key = claves.current.get(canonico)
    if (!key) { key = newIdempotencyKey(); claves.current.set(canonico, key) }
    setEstado({ enviando: true, error: null, ok: null })
    // Sólo el importe: el servidor arma la salida de F10-C1 con el proveedor y la recepción.
    const r = await enviarJson(pagosUrl, "POST", { importe: c.cuerpo.importe }, key)
    enCurso.current = false
    if (!r.ok) {
      if (!r.incierto) claves.current.delete(canonico)
      setEstado({ enviando: false, error: r.code === "TURNO_REQUERIDO" || r.code === "TURNO_NO_DISPONIBLE" ? "Para pagar en efectivo necesitás tener tu turno de Caja abierto." : r.error, ok: null })
      return
    }
    claves.current.delete(canonico)
    setEstado({ enviando: false, error: null, ok: `Pago registrado: ${formatoArs(c.cuerpo.importe)} salieron de tu caja, una sola vez. Quedó asociado a esta recepción.` })
    setImporte("")
    setConfirmo(false)
    setAbierto(false)
    void leer()
  }

  return (
    <section className="space-y-2 rounded-2xl border p-3" aria-label="Pago en efectivo al proveedor">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold"><Banknote className="h-4 w-4" />Pago en efectivo al proveedor</h4>
      {anticipo && anticipo.confirmado > 0 && <p className="rounded-lg bg-violet-50 p-2 text-sm font-medium text-violet-950 dark:bg-violet-950/40 dark:text-violet-100" role="status" data-testid="aviso-anticipo-recepcion">Atención: ya se pagaron {formatoArs(anticipo.confirmado)} por adelantado de este pedido. No vuelvas a pagarlo salvo que el dueño te lo indique.</p>}
      <p className="text-xs text-muted-foreground">Sólo si le pagaste con el efectivo de tu caja. Recibir la mercadería no mueve dinero.</p>
      {pagos.length > 0 && (
        <ul className="space-y-1" aria-label="Pagos registrados para esta recepción">
          {pagos.map((p) => <li key={p.id} className="rounded-lg bg-muted/50 p-2 text-sm">{formatoArs(p.importe)} · {new Date(p.fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}{p.caja ? ` · ${p.caja}` : ""}{p.anulado ? " · anulado en Caja" : p.observado ? " · el dueño lo está revisando" : ""}</li>)}
        </ul>
      )}
      {estado.ok && <p role="status" className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">{estado.ok}</p>}
      {permitePagar && turnoAbierto === false && <p className="text-xs text-muted-foreground">No tenés un turno de Caja abierto: no podés registrar un pago en efectivo desde acá.</p>}
      {permitePagar && turnoAbierto && !abierto && <Button type="button" variant="outline" className="min-h-11 rounded-xl" onClick={() => setAbierto(true)}>Registrar pago en efectivo</Button>}
      {permitePagar && turnoAbierto && abierto && (
        <div className="space-y-2" data-testid="pago-efectivo-form">
          <label className="block space-y-1 text-sm font-medium" htmlFor="pago-recepcion-importe"><span>Importe entregado al proveedor</span>
            <Input id="pago-recepcion-importe" inputMode="decimal" placeholder="0,00" value={importe} onChange={(e) => { setImporte(e.target.value); setEstado((x) => ({ ...x, error: null })) }} className="h-11 rounded-xl" />
          </label>
          <label className="flex min-h-11 items-start gap-2 text-sm">
            <input id="pago-recepcion-confirmo" type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Confirmo que le entregué este efectivo de mi caja a «{recepcion.proveedorNombre}» por la {ref}.</span>
          </label>
          {estado.error && <p role="alert" className="rounded-lg bg-rose-50 p-2 text-sm text-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{estado.error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="min-h-11 rounded-xl" disabled={estado.enviando} onClick={() => void registrar()}>{estado.enviando ? "Registrando…" : "Registrar salida de efectivo"}</Button>
            <Button type="button" variant="ghost" className="min-h-11 rounded-xl" disabled={estado.enviando} onClick={() => setAbierto(false)}>Cancelar</Button>
          </div>
        </div>
      )}
    </section>
  )
}
