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
// F10-B2.2-B adds shift status and controlled opening through the existing
// turn API. Opening stays unavailable outside the TESTING allowlist until a
// close/recovery flow exists; blind close, cash outflows, receptions,
// accounts, Mercado Pago and business statistics remain out of this screen.

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Store, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"
import { VenderView, type CajaVenderSource } from "@/components/business/caja-tab"
import { OperationalShiftPanel } from "@/components/business/operational-shift-panel"

interface CajaContexto {
  negocio: { id: string; nombre: string; slug: string; colorPrincipal: string; logoUrl: string | null }
  empleado: { id: string; nombre: string }
}

type PageState = { status: "loading" } | { status: "ready"; ctx: CajaContexto } | { status: "unavailable" }

export default function CajeroCajaPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const router = useRouter()
  const nav = useOperativoNav()
  const [state, setState] = useState<PageState>({ status: "loading" })

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

  return (
    <main className="min-h-screen bg-background pb-[env(safe-area-inset-bottom,0px)]">
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
        </header>

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
          <>
            <OperationalShiftPanel
              slug={state.ctx.negocio.slug}
              negocioId={state.ctx.negocio.id}
              empleadoId={state.ctx.empleado.id}
              empleadoNombre={state.ctx.empleado.nombre}
              onAccessLost={handleAccessLost}
            />
            <section aria-label="Ventas de Caja" className="space-y-3">
              <h2 className="px-1 text-base font-bold">Ventas</h2>
              <VenderView negocioId={state.ctx.negocio.id} source={source} />
            </section>
          </>
        )}
      </div>
    </main>
  )
}
