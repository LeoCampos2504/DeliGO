import { LegacyAccessRetired } from "@/components/legacy/legacy-access-retired"

// Legacy-Cleanup-1B: /s (sin token) ya no manda a /cliente/ — ese destino no
// tenía relación con el rol "salón". Pantalla informativa estática, sin
// lógica alguna.
export default function SalonNoTokenPage() {
  return <LegacyAccessRetired label="S" badgeClassName="bg-slate-100 text-slate-700" />
}
