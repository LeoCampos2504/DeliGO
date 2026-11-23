"use client"

// ============================================
// F10-C2c — Etiquetas de góndola del cajero (área caja)
// ============================================
// Lista de precios autorizados por el dueño que esperan el cambio físico de la etiqueta. El cajero cambia la etiqueta
// y marca «Etiqueta actualizada» (una o varias a la vez): recién ahí el precio nuevo se cobra en las ventas que
// empiecen desde ese momento. Nunca elige ni modifica un precio; la autorización la decide el servidor (sesión
// operativa + área caja) en /api/operativo/caja/[slug]/etiquetas-precio.

import { useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"
import { EtiquetasPrecioLista } from "@/components/business/etiquetas-precio-lista"

const PADDING_INFERIOR = "calc(max(7rem, var(--deligo-install-prompt-h, 0px) + 1rem) + env(safe-area-inset-bottom, 0px))"

export default function CajeroEtiquetasPage() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const router = useRouter()
  const nav = useOperativoNav()
  const accesoPerdido = useCallback((status: number) => {
    if (status === 401) router.replace(nav.loginHref)
    else router.replace(nav.homeHref)
  }, [router, nav.loginHref, nav.homeHref])

  return (
    <main className="min-h-screen bg-background" style={{ paddingBottom: PADDING_INFERIOR }}>
      <div className="mx-auto w-full max-w-3xl space-y-3 p-3 sm:p-4">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0 rounded-full" aria-label="Volver a la Caja">
            <Link href={`${nav.homeHref}/${encodeURIComponent(slug)}/caja`}><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <p className="text-sm font-bold">Caja · Etiquetas</p>
        </header>
        <EtiquetasPrecioLista url={`/api/operativo/caja/${encodeURIComponent(slug)}/etiquetas-precio`} esDueno={false} onAccesoPerdido={accesoPerdido} />
      </div>
    </main>
  )
}
