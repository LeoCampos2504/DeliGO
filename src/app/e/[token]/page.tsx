import { LegacyAccessRetired } from "@/components/legacy/legacy-access-retired"

// Legacy-Cleanup-1B: se retiró por completo el panel legacy de pedidos +
// reseñas (fetch a /api/empleado/*, bearer token, auto-refresh, push). El
// segmento dinámico [token] sigue existiendo (Next.js lo exige para esta
// ruta), pero el valor nunca se lee ni se usa acá — este componente no
// declara ningún parámetro. Pantalla server-rendered, sin "use client", sin
// fetch, sin efectos, sin temporizadores.
export default function EmpleadoTokenPage() {
  return <LegacyAccessRetired label="E" badgeClassName="bg-cyan-100 text-cyan-700" />
}
