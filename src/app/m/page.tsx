import { redirect } from "next/navigation"

// /m  (sin token) — no es una ruta válida para la app del mozo.
// Redirige a la home del cliente. El mozo accede a su app vía magic link
// (/m/{token}) que le genera el sistema al asignarle mesas.
export default function MozoNoTokenPage() {
  redirect("/")
}
