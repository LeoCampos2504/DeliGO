import { LegacyAccessRetired } from "@/components/legacy/legacy-access-retired"

// Legacy-Cleanup-1B: se retiró por completo el panel legacy de mesas +
// pedidos (fetch a /api/salon/*, bearer token, auto-refresh, push). El
// segmento dinámico [token] sigue existiendo (Next.js lo exige para esta
// ruta), pero el valor nunca se lee ni se usa acá — este componente no
// declara ningún parámetro. Pantalla server-rendered, sin "use client", sin
// fetch, sin efectos, sin temporizadores.
export default function SalonTokenPage() {
  return <LegacyAccessRetired label="S" badgeClassName="bg-slate-100 text-slate-700" />
}
