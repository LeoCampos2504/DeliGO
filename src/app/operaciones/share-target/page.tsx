"use client"

import { Suspense } from "react"
import { ShareTargetFlow } from "@/components/chat/share-target-flow"

// Bugfix-4C: página de recepción de Web Share Target para la PWA Operaciones.
// Ver src/components/chat/share-target-flow.tsx para toda la lógica real.
export default function OperacionesShareTargetPage() {
  return (
    <Suspense fallback={null}>
      <ShareTargetFlow role="operaciones" />
    </Suspense>
  )
}
