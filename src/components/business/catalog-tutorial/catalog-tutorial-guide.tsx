"use client"

// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R3 §10 — contextual coach card
// ============================================
// Renders inline in the normal document/form flow (never positioned by
// viewport coordinates, task §10). A placement names which target keys it
// is responsible for (`targetKeys`) so exactly one coach card renders at a
// time even though several placements may exist across a form (e.g. one
// at the "Agregar producto" button, another inside the product Drawer for
// the Basic Info / Advanced Options / Review phases).

import { Button } from "@/components/ui/button"
import { getGuidePhases } from "./catalog-tutorial-guides"
import { normalizeRubro, resolveStepCopy } from "./catalog-tutorial-steps"
import { useCatalogTutorialGuide } from "./catalog-tutorial-guide-context"
import type { CatalogTutorialTargetKey } from "./catalog-tutorial-targets"

export function CatalogTutorialGuideCoach({
  targetKeys,
  mode,
  rawRubro,
  onReturnToTutorial,
}: {
  targetKeys: CatalogTutorialTargetKey[]
  mode: "simple" | "expert"
  rawRubro: string
  onReturnToTutorial: () => void
}) {
  const guide = useCatalogTutorialGuide()
  if (!guide.activeGuideId || !guide.activeTargetKey) return null
  if (!targetKeys.includes(guide.activeTargetKey)) return null

  const rubro = normalizeRubro(rawRubro)
  const phase = getGuidePhases(guide.activeGuideId, { mode }).find((p) => p.targetKey === guide.activeTargetKey)
  if (!phase) return null

  return (
    <div className="mb-3 rounded-xl border border-primary/30 bg-primary/5 p-3" role="status">
      <p className="text-sm font-semibold">{resolveStepCopy(phase.title, rubro)}</p>
      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
        {resolveStepCopy(phase.body, rubro)}
      </p>
      <Button type="button" variant="ghost" size="sm" className="mt-2 -ml-2" onClick={onReturnToTutorial}>
        Volver al tutorial
      </Button>
    </div>
  )
}
