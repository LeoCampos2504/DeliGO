import { redirect } from "next/navigation"

// /e  (sin token) — no es una ruta válida para la app de empleados.
// Redirige a la home del cliente. El empleado accede a su panel vía magic link
// (/e/{token}) que le genera el negocio.
export default function EmpleadoNoTokenPage() {
  redirect("/")
}
