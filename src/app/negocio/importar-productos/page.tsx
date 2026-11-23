"use client"

// Catálogo — importación masiva de productos (DUEÑO). La ruta del servidor exige la sesión del dueño.
import { ImportarProductos } from "@/components/business/importar-productos"

export default function ImportarProductosDuenoPage() {
  return (
    <main className="min-h-screen bg-background pb-24">
      <ImportarProductos api="/api/negocio/productos/importar" volverHref="/negocio" volverTexto="Volver al panel" />
    </main>
  )
}
