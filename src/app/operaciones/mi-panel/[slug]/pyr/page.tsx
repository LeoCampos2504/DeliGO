import { redirect } from "next/navigation"

// ============================================
// DeliGO Operaciones — PyR personal: raíz (UX-1)
// ============================================
// Server component puro, sin "use client" ni hooks: solo redirige a la pantalla
// principal de PyR (pedidos activos). No hace fetch, no decide autorización ni
// sesión — eso lo resuelve por completo /pyr/pedidos al montar. Reseñas pasó a
// vivir en /pyr/resenas, accesible desde una tarjeta en /pyr/pedidos.
export default async function PyRRootPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  redirect(`/operaciones/mi-panel/${encodeURIComponent(slug)}/pyr/pedidos`)
}
