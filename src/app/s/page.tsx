import { redirect } from "next/navigation"

// /s  (sin token) — no es una ruta válida para la app del salón.
// Redirige a la home del cliente. El salón accede a su vista vía magic link
// (/s/{token}) que le genera el negocio.
export default function SalonNoTokenPage() {
  redirect("/")
}
