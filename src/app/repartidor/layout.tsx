import type { Metadata, Viewport } from "next"
import {
  getPwaIdentityMetadata,
  getPwaIdentityViewport,
} from "@/lib/pwa-identity"
import { PushDebugTraceBootstrap } from "@/components/shared/push-debug-trace-bootstrap"

export const metadata: Metadata = getPwaIdentityMetadata("repartidor")
export const viewport: Viewport = getPwaIdentityViewport("repartidor")

export default function RepartidorLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <PushDebugTraceBootstrap />
    </>
  )
}
