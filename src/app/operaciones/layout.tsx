import type { Metadata, Viewport } from "next"
import {
  getPwaIdentityMetadata,
  getPwaIdentityViewport,
} from "@/lib/pwa-identity"

export const metadata: Metadata = getPwaIdentityMetadata("operaciones")
export const viewport: Viewport = getPwaIdentityViewport("operaciones")

export default function OperacionesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
