"use client"

// Catálogo — importación masiva de productos (EMPLEADO con «Importar productos» vigente; el servidor lo verifica).
import { useParams } from "next/navigation"
import { useOperativoNav } from "@/components/operativo/use-operativo-nav"
import { ImportarProductos } from "@/components/business/importar-productos"

export default function ImportarProductosEmpleadoPage() {
  const { slug } = useParams<{ slug: string }>()
  const nav = useOperativoNav()
  return (
    <main className="min-h-screen bg-background" style={{ paddingBottom: "calc(max(7rem, var(--deligo-install-prompt-h, 0px) + 1rem) + env(safe-area-inset-bottom, 0px))" }}>
      <ImportarProductos api={`/api/operativo/caja/${encodeURIComponent(slug)}/catalogo/importar`} volverHref={`${nav.homeHref}/${encodeURIComponent(slug)}/productos`} volverTexto="Volver a Productos" />
    </main>
  )
}
