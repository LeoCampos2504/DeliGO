import { redirect } from "next/navigation"

// ============================================
// Root page — redirects to the cliente PWA at /cliente/
//
// The cliente PWA lives under /cliente/ (scope: "/cliente/") so that it
// doesn't capture the entire origin and block the installation of the
// negocio, repartidor, salon, mozo, empleado and admin PWAs.
//
// Any internal link pointing to "/" will land here and be redirected to
// /cliente/ — this preserves backwards compatibility with existing links.
// ============================================
export default function RootPage() {
  redirect("/cliente/")
}
