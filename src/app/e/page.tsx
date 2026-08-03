import { LegacyAccessRetired } from "@/components/legacy/legacy-access-retired"

// Legacy-Cleanup-1B: /e (sin token) ya no manda a /cliente/ — ese destino no
// tenía relación con el rol "empleado". Pantalla informativa estática, sin
// lógica alguna.
export default function EmpleadoNoTokenPage() {
  return <LegacyAccessRetired label="E" badgeClassName="bg-cyan-100 text-cyan-700" />
}
