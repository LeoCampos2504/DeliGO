import type { Metadata, Viewport } from "next"
import {
  getPwaIdentityMetadata,
  getPwaIdentityViewport,
} from "@/lib/pwa-identity"

export const metadata: Metadata = getPwaIdentityMetadata("repartidor")
export const viewport: Viewport = getPwaIdentityViewport("repartidor")

export default function RepartidorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children
}
