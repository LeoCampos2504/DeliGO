"use client"

// ============================================
// F10-B1 — DeliGO Operaciones: Caja del cajero (mobile-first)
// ============================================
// Personal PWA screen for an employee with área "caja" in a generic business.
// It renders the SAME selling view as the owner's Caja (VenderView: catalog,
// search, F9 continuous scanner, cart, quantities, variants, checkout with
// idempotent attempts) pointed at the cashier endpoints:
//   GET  /api/operativo/caja/[slug]/productos  (selling fields only)
//   POST /api/operativo/caja/[slug]/ventas     (Idempotency-Key required)
// Authorization is decided ONLY by the server (personal operational session +
// área "caja"); this page just follows its answers: 401 → login, área lost →
// personal home, business unavailable → message.
// F10-B2.2-B adds shift status and opening through the existing turn API (T5:
// every authorized cashier, the former TESTING pilot allowlist is retired).
// Mercado Pago and business statistics remain out of this screen.
// F4-A adds the business's previous sales (search by day or reference) to void
// them or return products, through the cashier's own operativo endpoints only.
// F4-C5 adds exchanges and linked additional sales of those sales (cashier
// endpoints only; attempts isolated per business + employee on this device).
// F10-C1b adds «Salidas de Caja»: cash outflows of the cashier's OWN open shift
// (cashier endpoints only; no expected cash, balance or difference anywhere).
// T1-01 (presentation only): the sections follow the shift CONFIRMED by the server —
// without a shift «Caja y turno» comes first; with an open shift the sale comes first,
// with a compact «Turno abierto · <Caja>» indicator and the shift detail folded below.
// Outflows always go after the sale (history folded) and the label/catalog accesses
// after them. CajaSeccionesOrdenadas MOVES the keyed sections (never remounts them), so
// the sale in progress (cart, sale start, price protection, attempt) is never lost.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, BadgeCheck, Package, PackageCheck, Store, Tag, UserRound } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"
import { VenderView, type CajaVenderSource } from "@/components/business/caja-tab"
// «Gestionar venta» reuses this page's catalog (same endpoint and cache as the selling view).
import { OperationalShiftPanel } from "@/components/business/operational-shift-panel"
import { CajaVentasHistorial, type CajaDevolucionesEndpoints } from "@/components/business/caja-devoluciones"
import { CajaSalidasCajero } from "@/components/business/caja-salidas-cajero"
import { CajaSeccionesOrdenadas } from "@/components/business/caja-cajero-secciones"

interface CajaContexto {
  negocio: { id: string; nombre: string; slug: string; colorPrincipal: string; logoUrl: string | null }
  empleado: { id: string; nombre: string }
}

type PageState = { status: "loading" } | { status: "ready"; ctx: CajaContexto } | { status: "unavailable" }

// F10-C1b: room below the last control — at least 7rem (floating chat button) or the PWA
// install notice's live height + 1rem, plus the device's safe area.
const PADDING_INFERIOR ="calc(max(7rem, var(--deligo-install-prompt-h, 0px) + 1rem) + env(safe-area-inset-bottom, 0px))"

export default function CajeroCajaPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const router = useRouter()
  const nav = useOperativoNav()
  const [state, setState] = useState<PageState>({ status: "loading" })
  // F10-C1b: the open shift seen by the shift panel; the outflow section re-reads when it changes.
  const [turnoAbiertoId, setTurnoAbiertoId] = useState<string | null | undefined>(undefined)
  // T1-01: register name of the confirmed open shift, for the compact indicator only.
  const [turnoResumen, setTurnoResumen] = useState<{ id: string; cajaNombre: string } | null>(null)
  const conTurno = typeof turnoAbiertoId === "string"

  const handleAccessLost = useCallback(
    (status: number, estado?: string) => {
      if (status === 401 || estado === "sin_sesion") router.replace(nav.loginHref)
      else if (estado === "area_no_habilitada") router.replace(nav.homeHref)
      else setState({ status: "unavailable" })
    },
    [router, nav.loginHref, nav.homeHref]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/operativo/caja/${encodeURIComponent(slug)}/productos`, { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok || !data.ok) {
          handleAccessLost(res.status, data.estado)
          return
        }
        setState({ status: "ready", ctx: { negocio: data.negocio, empleado: data.empleado } })
      } catch {
        if (!cancelled) setState({ status: "unavailable" })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, handleAccessLost])

  const source = useMemo<CajaVenderSource | null>(() => {
    if (state.status !== "ready") return null
    const { negocio, empleado } = state.ctx
    return {
      // Attempt scope bound to employee + business: an uncertain sale is only
      // ever recovered by the same person in the same business.
      attemptScope: `operativo:${empleado.id}:${negocio.id}`,
      productosUrl: `/api/operativo/caja/${encodeURIComponent(negocio.slug)}/productos`,
      productosQueryKey: ["operativo-caja-productos", empleado.id, negocio.id],
      categoriasUrl: null,
      categoriasQueryKey: ["operativo-caja-categorias", empleado.id, negocio.id],
      ventasUrl: `/api/operativo/caja/${encodeURIComponent(negocio.slug)}/ventas`,
      ventasHoyQueryKey: null,
      onAccessLost: (status) => handleAccessLost(status),
    }
  }, [state, handleAccessLost])

  const devoluciones = useMemo<CajaDevolucionesEndpoints | null>(() => {
    if (state.status !== "ready") return null
    const { negocio, empleado } = state.ctx
    const base = `/api/operativo/caja/${encodeURIComponent(negocio.slug)}`
    return {
      historialUrl: `${base}/ventas/historial`,
      ventaUrl: (id) => `${base}/ventas/${encodeURIComponent(id)}/devoluciones`,
      reintegroUrl: (id) => `${base}/devoluciones/${encodeURIComponent(id)}/reintegro`,
      queryScope: ["operativo-caja-devoluciones", empleado.id, negocio.id],
      invalidateAlso: [["operativo-caja-productos", empleado.id, negocio.id]],
      // «Gestionar venta»: a new purchase is a normal sale (the selling view of this page).
      irAVender: () => document.getElementById("caja-vender")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      comercial: source
        ? {
            contexto: { negocioId: negocio.id, actor: `EMPLEADO:${empleado.id}` },
            cambioUrl: (id) => `${base}/ventas/${encodeURIComponent(id)}/cambios`,
            cotizacionUrl: (id) => `${base}/ventas/${encodeURIComponent(id)}/cambios/cotizacion`,
            verificarCambioUrl: (id) => `${base}/ventas/${encodeURIComponent(id)}/cambios/verificacion`,
            verificarAdicionalUrl: (id) => `${base}/ventas/${encodeURIComponent(id)}/adicionales/verificacion`,
            cadenaUrl: (id) => `${base}/ventas/${encodeURIComponent(id)}/cadena`,
            // Same catalog and cache as the selling view.
            catalogo: { productosUrl: source.productosUrl, queryKey: source.productosQueryKey },
          }
        : undefined,
    }
  }, [state, source])

  return (
    // Extra bottom room (F10-C1b): the last controls can always scroll above the floating chat
    // button and above the PWA install notice (its live height, published by install-prompt.tsx).
    // Inline style: a Tailwind arbitrary class does not emit this max()/var() expression.
    <main className="min-h-screen bg-background" style={{ paddingBottom: PADDING_INFERIOR }}>
      <div className="mx-auto w-full max-w-5xl space-y-3 p-3 sm:p-4">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full" aria-label="Volver">
            <Link href={nav.homeHref}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-sm font-bold">
              <Store className="h-4 w-4 shrink-0" />
              {state.status === "ready" ? state.ctx.negocio.nombre : "Caja"}
            </p>
            {state.status === "ready" && (
              <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                <UserRound className="h-3.5 w-3.5 shrink-0" /> Vendiendo como {state.ctx.empleado.nombre}
              </p>
            )}
          </div>
          {state.status === "ready" && (
            // F10-C2b: «Recibir mercadería» (borradores del cajero; aprueba sólo el dueño).
            <Button asChild variant="outline" className="h-11 shrink-0 rounded-xl px-3 text-xs">
              <Link href={`${nav.homeHref}/${encodeURIComponent(state.ctx.negocio.slug)}/recepciones`}>
                <PackageCheck className="mr-1 h-4 w-4" />
                Recibir mercadería
              </Link>
            </Button>
          )}
        </header>
        {state.status === "ready" && conTurno && turnoResumen?.id === turnoAbiertoId && (
          <p data-testid="indicador-turno" className="flex min-w-0 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
            <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Turno abierto · {turnoResumen.cajaNombre}</span>
          </p>
        )}

        {state.status === "loading" && (
          <div className="space-y-3">
            <Skeleton className="h-11 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
              ))}
            </div>
          </div>
        )}

        {state.status === "unavailable" && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm font-semibold">La Caja no está disponible en este momento.</p>
            <p className="mt-1 text-xs text-muted-foreground">Si el problema continúa, avisale al administrador del negocio.</p>
            <Button asChild variant="outline" className="mt-4 rounded-xl">
              <Link href={nav.homeHref}>Volver a mi panel</Link>
            </Button>
          </div>
        )}

        {state.status === "ready" && source && (
          // T1-01: ONE container, keyed sections, order by the CONFIRMED shift (never remounted).
          <CajaSeccionesOrdenadas
            conTurno={conTurno}
            secciones={{
              turno: (
                <OperationalShiftPanel
                  slug={state.ctx.negocio.slug}
                  negocioId={state.ctx.negocio.id}
                  empleadoId={state.ctx.empleado.id}
                  empleadoNombre={state.ctx.empleado.nombre}
                  onAccessLost={handleAccessLost}
                  onTurnoChange={setTurnoAbiertoId}
                  onTurnoResumen={setTurnoResumen}
                  plegableConTurno
                />
              ),
              ventas: (
                <section id="caja-vender" aria-labelledby="caja-vender-titulo" className="scroll-mt-3 space-y-3">
                  <h2 id="caja-vender-titulo" tabIndex={-1} data-foco-seccion="" className="px-1 text-base font-bold outline-none">Ventas</h2>
                  <VenderView negocioId={state.ctx.negocio.id} source={source} />
                </section>
              ),
              salidas: (
                <CajaSalidasCajero
                  slug={state.ctx.negocio.slug}
                  negocioId={state.ctx.negocio.id}
                  empleadoId={state.ctx.empleado.id}
                  turnoKey={turnoAbiertoId}
                  onAccessLost={handleAccessLost}
                />
              ),
              // Secondary, compact accesses (same permissions and pending-label warning as before).
              herramientas: (
                <nav aria-label="Herramientas de Caja" className="grid gap-2 sm:grid-cols-2">
                  <EtiquetasAcceso slug={state.ctx.negocio.slug} href={`${nav.homeHref}/${encodeURIComponent(state.ctx.negocio.slug)}/etiquetas`} />
                  <CatalogoAcceso slug={state.ctx.negocio.slug} href={`${nav.homeHref}/${encodeURIComponent(state.ctx.negocio.slug)}/productos`} />
                </nav>
              ),
              historial: devoluciones ? (
                <section aria-label="Historial de ventas" className="min-w-0 rounded-2xl border border-border bg-card p-3">
                  <CajaVentasHistorial endpoints={devoluciones} titulo="Ventas anteriores: gestionar, devolver o anular" />
                </section>
              ) : null,
            }}
          />
        )}
      </div>
    </main>
  )
}

// F10-C2c: acceso a «Etiquetas de góndola» con el conteo de pendientes (el cajero sólo confirma etiquetas).
function EtiquetasAcceso({ slug, href }: { slug: string; href: string }) {
  const { data } = useQuery<{ pendientes: number }>({
    queryKey: ["operativo-etiquetas-pendientes", slug],
    queryFn: async () => {
      const res = await fetch(`/api/operativo/caja/${encodeURIComponent(slug)}/etiquetas-precio?estado=PENDIENTES`, { cache: "no-store" })
      if (!res.ok) throw new Error("etiquetas")
      return res.json()
    },
  })
  const n = data?.pendientes ?? 0
  return (
    <Button asChild variant={n > 0 ? "default" : "outline"} className="h-11 w-full justify-start rounded-xl text-sm" data-testid="acceso-etiquetas">
      <Link href={href}>
        <Tag className="mr-2 h-4 w-4" />
        {n > 0 ? `Etiquetas de góndola: ${n} ${n === 1 ? "pendiente" : "pendientes"} de cambiar` : "Etiquetas de góndola"}
      </Link>
    </Button>
  )
}

// Catálogo: acceso a «Productos» sólo con permiso VIGENTE (lo decide el servidor en cada operación).
function CatalogoAcceso({ slug, href }: { slug: string; href: string }) {
  const { data } = useQuery<{ permisos: { vigente: boolean; hasta: string | null } }>({
    queryKey: ["operativo-catalogo-permisos", slug],
    queryFn: async () => { const res = await fetch(`/api/operativo/caja/${encodeURIComponent(slug)}/catalogo?soloPermisos=1`, { cache: "no-store" }); if (!res.ok) throw new Error("catalogo"); return res.json() },
  })
  if (!data?.permisos.vigente) return null
  return (
    <Button asChild variant="outline" className="h-11 w-full justify-start rounded-xl text-sm" data-testid="acceso-catalogo">
      <Link href={href}><Package className="mr-2 h-4 w-4" />Productos (carga del catálogo)</Link>
    </Button>
  )
}
