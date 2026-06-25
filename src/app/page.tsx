import { redirect } from "next/navigation"

type RootPageProps = {
  searchParams?: Promise<{ register?: string | string[] }>
}

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
export default async function RootPage({ searchParams }: RootPageProps) {
  const params = await searchParams
  const rawRegister = Array.isArray(params?.register)
    ? params.register[0]
    : params?.register
  const register = rawRegister === "delivery" ? "repartidor" : rawRegister

  if (register === "repartidor") {
    redirect("/repartidor/registro/")
  }

  if (register === "negocio") {
    redirect("/cliente/?register=negocio")
  }

  redirect("/cliente/")
}
