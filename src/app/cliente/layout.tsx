import type { Metadata, Viewport } from "next"
import {
  getPwaIdentityMetadata,
  getPwaIdentityViewport,
} from "@/lib/pwa-identity"
import { PushDebugTraceBootstrap } from "@/components/shared/push-debug-trace-bootstrap"

export const metadata: Metadata = getPwaIdentityMetadata("cliente")
export const viewport: Viewport = getPwaIdentityViewport("cliente")

export default function ClienteLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <PushDebugTraceBootstrap />
    </>
  )
}
