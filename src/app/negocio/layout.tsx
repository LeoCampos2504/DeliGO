import type { Metadata, Viewport } from "next"
import {
  getPwaIdentityMetadata,
  getPwaIdentityViewport,
} from "@/lib/pwa-identity"

export const metadata: Metadata = getPwaIdentityMetadata("negocio")
export const viewport: Viewport = getPwaIdentityViewport("negocio")

export default function NegocioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
