"use client"

// ============================================
// BUSINESS-CATALOG-INAPP-TUTORIAL-R1/R3 — companion panel
// ============================================
// Optional, non-blocking guided tutorial for the business catalog (task
// §3-4). Deliberately NOT a full-screen spotlight tour: it's a compact
// side panel (Sheet) the owner opens/minimizes at will. Pressing an
// "Ir a..." action closes the panel, performs a REAL navigation through
// the host's own component state (never a DOM click hack), and — R3 §6-9
// — starts a contextual workflow guide that highlights the real next
// action in place (see catalog-tutorial-guide-context.tsx). The owner
// always performs the real click/fill/save themselves; nothing here ever
// creates, edits, or deletes a business entity automatically (task §5,
// §24).
//
// Mount this once, as a child of ProductsTab, passing the already-owned
// subtab/mode state down (see products-tab.tsx / business-panel.tsx for
// the wiring) — never reach into the DOM to find those controls. Must be
// rendered under <CatalogTutorialGuideProvider> (mounted once around
// <ProductsTab> in business-panel.tsx, OUTSIDE it, so the guide survives
// ProductsTab's own subtab-driven re-renders).

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  computeProgressSummary,
  createInitialProgress,
  dismissIntroCard,
  isTutorialFinished,
  isTutorialStarted,
  markStepCompleted,
  resetTutorialProgress,
  setCurrentStep,
  type CatalogTutorialProgress,
} from "./catalog-tutorial-progress"
import {
  CATALOG_TUTORIAL_DECISION_TABLE,
  CATALOG_TUTORIAL_OWN_VS_SHARED_COMPARISON,
  getVisibleSteps,
  normalizeRubro,
  resolveStepCopy,
} from "./catalog-tutorial-steps"
import { readTutorialProgress, writeTutorialProgress } from "./catalog-tutorial-storage"
import { useCatalogTutorialGuide } from "./catalog-tutorial-guide-context"
import { getFirstGuidePhase, hasGuide } from "./catalog-tutorial-guides"
import type { CatalogTutorialActionKey, CatalogTutorialStep } from "./catalog-tutorial-types"

export type CatalogTutorialSubTab = "productos" | "agregados" | "ingredientes" | "secciones" | "opciones"
export type CatalogTutorialPanelMode = "simple" | "expert"

export interface CatalogTutorialProps {
  negocio: { id: string; slug: string; rubro: string }
  mode: CatalogTutorialPanelMode
  onModeChange: (mode: CatalogTutorialPanelMode) => void
  onNavigateSubTab: (subTab: CatalogTutorialSubTab) => void
}

type TutorialView = "home" | "step" | "steps-list" | "help"

export function CatalogTutorial({ negocio, mode, onModeChange, onNavigateSubTab }: CatalogTutorialProps) {
  const rubro = useMemo(() => normalizeRubro(negocio.rubro), [negocio.rubro])
  const visibleSteps = useMemo(() => getVisibleSteps(rubro), [rubro])
  const visibleStepIds = useMemo(() => visibleSteps.map((s) => s.id), [visibleSteps])
  const guide = useCatalogTutorialGuide()

  // Same SSR-safe "mounted" gate used elsewhere in this codebase (e.g.
  // BottomNav, IOSViewportDebugPanel) — server and first client render
  // both render nothing tutorial-related, avoiding a hydration mismatch
  // against localStorage-derived state.
  const [mounted, setMounted] = useState(false)
  const [progress, setProgress] = useState<CatalogTutorialProgress>(() => createInitialProgress())
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<TutorialView>("home")
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)

  useEffect(() => {
    // setMounted/setProgress run inside a deferred callback (not as a
    // direct effect-body statement) — same idiom already used elsewhere
    // in this codebase for this exact "detect client-only condition, then
    // flip state" shape (react-hooks/set-state-in-effect), e.g.
    // BottomNav/IOSViewportDebugPanel.
    const timer = window.setTimeout(() => {
      setMounted(true)
      setProgress(readTutorialProgress(negocio.id))
    }, 0)
    return () => window.clearTimeout(timer)
  }, [negocio.id])

  const persist = (next: CatalogTutorialProgress) => {
    setProgress(next)
    writeTutorialProgress(negocio.id, next)
  }

  const started = isTutorialStarted(progress)
  const finished = isTutorialFinished(progress, visibleStepIds)
  const summary = computeProgressSummary(progress, visibleStepIds)
  const currentStep =
    (progress.currentStepId && visibleSteps.find((s) => s.id === progress.currentStepId)) || null

  // task §5: the ONLY real navigation surface. Never a DOM click — every
  // branch calls the host's own state setters/callbacks.
  const runAction = (actionKey: CatalogTutorialActionKey | undefined) => {
    if (!actionKey || actionKey === "none") return
    switch (actionKey) {
      case "goToProducts":
        onNavigateSubTab("productos")
        return
      case "goToIngredients":
        // ProductsTab upgrades to Expert inside the same guarded navigation
        // transaction when this subtab is reached from Simple mode. Keeping
        // the two state changes together prevents a dirty editor from
        // producing two competing discard dialogs.
        onNavigateSubTab("ingredientes")
        return
      case "goToAdditions":
        // See goToIngredients: mode and subtab are one guarded transition.
        onNavigateSubTab("agregados")
        return
      case "goToCatalogSections":
        onNavigateSubTab("secciones")
        return
      case "goToSharedOptions":
        onNavigateSubTab("opciones")
        return
      case "setModeSimple":
        onModeChange("simple")
        return
      case "setModeExpert":
        onModeChange("expert")
        return
      case "openPreview":
        if (typeof window !== "undefined") {
          // BUSINESS-CATALOG-INAPP-TUTORIAL-R2 §20, §25: previewSource=business
          // is a presentation-only hint (return destination + read-only
          // detail-viewing policy on /n/[slug]) — never authorization.
          // Opened in a new tab so this Sheet's own progress/state (in
          // this same tab) is untouched regardless of how the preview tab
          // is closed.
          window.open(
            `/n/${negocio.slug}?preview=true&previewSource=business`,
            "_blank",
            "noopener,noreferrer"
          )
        }
        return
    }
  }

  const openAtStep = (stepId: string) => {
    // R3 §22: navigating directly to a (possibly different) step always
    // ends whatever guide was running — a stale guide from a step the
    // owner is no longer looking at must never keep highlighting.
    guide.stopGuide()
    persist(setCurrentStep(progress, stepId, Date.now()))
    setView("step")
    setOpen(true)
  }

  const startOrContinue = () => {
    if (currentStep) {
      setView("step")
      setOpen(true)
      return
    }
    const firstIncomplete = visibleSteps.find((s) => !progress.completedStepIds.includes(s.id))
    const target = firstIncomplete ?? visibleSteps[0]
    if (target) openAtStep(target.id)
  }

  const handleGoToAction = (step: CatalogTutorialStep) => {
    persist(setCurrentStep(progress, step.id, Date.now()))
    runAction(step.actionKey)
    // R3 §11: closing here is what leaves the real business UI fully
    // usable — the owner performs the real action outside this panel.
    setOpen(false)
    // R3 §6, §12-19: replaces R2's separate "show me" click — the
    // contextual guide starts automatically on the real next action the
    // moment the owner navigates there, no extra step.
    if (hasGuide(step.id)) {
      const firstPhase = getFirstGuidePhase(step.id, { mode })
      if (firstPhase) guide.startGuide(step.id, firstPhase.targetKey)
    }
  }

  const advanceAfter = (step: CatalogTutorialStep, base: CatalogTutorialProgress) => {
    const idx = visibleStepIds.indexOf(step.id)
    const nextStepId = visibleSteps[idx + 1]?.id ?? null
    const next = setCurrentStep(base, nextStepId, Date.now())
    persist(next)
    if (!nextStepId) setView("home")
  }

  const handleCompleteStep = (step: CatalogTutorialStep) => {
    guide.stopGuideIfActive(step.id)
    const completed = markStepCompleted(progress, step.id, Date.now())
    advanceAfter(step, completed)
  }

  const handleSkipStep = (step: CatalogTutorialStep) => {
    guide.stopGuideIfActive(step.id)
    advanceAfter(step, progress)
  }

  const handleBackStep = (step: CatalogTutorialStep) => {
    guide.stopGuideIfActive(step.id)
    const idx = visibleStepIds.indexOf(step.id)
    const prevStepId = visibleSteps[idx - 1]?.id
    if (prevStepId) persist(setCurrentStep(progress, prevStepId, Date.now()))
  }

  const handleDismissIntro = () => {
    persist(dismissIntroCard(progress, Date.now()))
  }

  const handleReset = () => {
    guide.stopGuide()
    persist(resetTutorialProgress())
    setResetConfirmOpen(false)
    setOpen(false)
    setView("home")
  }

  // R3 §21: ends the contextual guide, clears the active target, and
  // reopens the main tutorial at the SAME step that started the guide
  // (guide id === step id, see catalog-tutorial-guides.ts) — progress is
  // untouched (no complete/skip is implied by returning). Registered with
  // the guide context so any coach card, wherever it renders, can trigger
  // this exact real Sheet-reopening behavior (task §21) without needing
  // to be a descendant of this component.
  useEffect(() => {
    guide.setReturnHandler(() => {
      const originStepId = guide.activeGuideId
      guide.stopGuide()
      if (originStepId) {
        persist(setCurrentStep(progress, originStepId, Date.now()))
        setView("step")
        setOpen(true)
      }
    })
    return () => guide.setReturnHandler(null)
  }, [progress, guide.activeGuideId])

  if (!mounted) return null

  const showIntroCard = !started && !progress.dismissedIntro
  const guideTargetMissing = guide.isGuideActive && guide.activeTargetKey !== null && !guide.isTargetMounted(guide.activeTargetKey)

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setView("home")
            setOpen(true)
          }}
          aria-label="Abrir tutorial del catálogo"
        >
          Tutorial del catálogo
        </Button>
        {/* R3 §11: small, non-obstructive indicator — reuses the same
            inline (never position:fixed) header slot R1/R2 already had for
            "Continuar tutorial", so a guide in progress never needs a new
            floating overlay. R3 §22: a target that stopped being mounted
            (form closed/changed unexpectedly) shows the fail-safe copy
            here instead of silently doing nothing. */}
        {!open && guide.isGuideActive && (
          <Button type="button" variant="ghost" size="sm" onClick={() => guide.requestReturn()} role="status">
            {guideTargetMissing
              ? "El formulario cambió. Volvé al tutorial para continuar."
              : "Tutorial activo · Volver al tutorial"}
          </Button>
        )}
        {!open && !guide.isGuideActive && started && !finished && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={startOrContinue}
            aria-label={`Continuar tutorial, paso ${summary.completed + 1} de ${summary.total}`}
          >
            Continuar tutorial · Paso {Math.min(summary.completed + 1, summary.total)}/{summary.total}
          </Button>
        )}
      </div>

      {showIntroCard && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold">¿Es tu primera vez?</h3>
              <p className="text-sm text-muted-foreground">
                Aprendé a cargar tu catálogo paso a paso.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" size="sm" onClick={startOrContinue}>
                Empezar tutorial
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleDismissIntro}>
                Ahora no
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
          {view === "home" && (
            <TutorialHome
              started={started}
              finished={finished}
              summary={summary}
              onStart={startOrContinue}
              onViewSteps={() => setView("steps-list")}
              onViewHelp={() => setView("help")}
              onReset={() => setResetConfirmOpen(true)}
            />
          )}

          {view === "steps-list" && (
            <TutorialStepsList
              steps={visibleSteps}
              rubro={rubro}
              progress={progress}
              onSelectStep={(stepId) => openAtStep(stepId)}
              onBack={() => setView("home")}
            />
          )}

          {view === "help" && <TutorialHelp rubro={rubro} onBack={() => setView("home")} />}

          {view === "step" && currentStep && (
            <TutorialStepView
              step={currentStep}
              rubro={rubro}
              index={visibleStepIds.indexOf(currentStep.id)}
              total={visibleSteps.length}
              isCompleted={progress.completedStepIds.includes(currentStep.id)}
              canGoBack={visibleStepIds.indexOf(currentStep.id) > 0}
              canGoNext={visibleStepIds.indexOf(currentStep.id) < visibleSteps.length - 1}
              onGoToAction={() => handleGoToAction(currentStep)}
              onComplete={() => handleCompleteStep(currentStep)}
              onSkip={() => handleSkipStep(currentStep)}
              onBack={() => handleBackStep(currentStep)}
              onClose={() => setOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reiniciar tutorial</DialogTitle>
            <DialogDescription>
              Esto reinicia únicamente el progreso del tutorial. Tu catálogo no se modifica.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResetConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={handleReset}>
              Reiniciar progreso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TutorialHome({
  started,
  finished,
  summary,
  onStart,
  onViewSteps,
  onViewHelp,
  onReset,
}: {
  started: boolean
  finished: boolean
  summary: { completed: number; total: number }
  onStart: () => void
  onViewSteps: () => void
  onViewHelp: () => void
  onReset: () => void
}) {
  const percent = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0
  return (
    <>
      <SheetHeader>
        <SheetTitle>Aprendé a cargar tu catálogo</SheetTitle>
        <SheetDescription>
          Te guiamos paso a paso para crear, personalizar y administrar tus productos.
        </SheetDescription>
      </SheetHeader>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              {summary.completed} de {summary.total} pasos
            </span>
            <span className="text-muted-foreground">{percent}%</span>
          </div>
          <Progress value={percent} aria-label={`Progreso del tutorial: ${percent}%`} />
        </div>
        <p className="text-sm text-muted-foreground">
          Podés hacerlo de a poco y continuar después.
        </p>
        {finished && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="pt-4 text-sm">
              Ya completaste todos los pasos disponibles. Podés repasarlos cuando quieras desde
              &quot;Ver pasos&quot;.
            </CardContent>
          </Card>
        )}
        <div className="flex flex-col gap-2">
          <Button type="button" onClick={onStart}>
            {started ? "Continuar" : "Empezar tutorial"}
          </Button>
          <Button type="button" variant="outline" onClick={onViewSteps}>
            Ver pasos
          </Button>
          <Button type="button" variant="outline" onClick={onViewHelp}>
            ¿Qué debería usar?
          </Button>
        </div>
      </div>
      <SheetFooter>
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          Reiniciar progreso
        </Button>
      </SheetFooter>
    </>
  )
}

function TutorialStepsList({
  steps,
  rubro,
  progress,
  onSelectStep,
  onBack,
}: {
  steps: CatalogTutorialStep[]
  rubro: ReturnType<typeof normalizeRubro>
  progress: CatalogTutorialProgress
  onSelectStep: (stepId: string) => void
  onBack: () => void
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>Pasos del tutorial</SheetTitle>
        <SheetDescription>Elegí un paso para ir directamente a él.</SheetDescription>
      </SheetHeader>
      <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4" aria-label="Lista de pasos del tutorial">
        {steps.map((step, i) => {
          const done = progress.completedStepIds.includes(step.id)
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onSelectStep(step.id)}
              className="flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-current={done ? undefined : "step"}
            >
              <span>
                <span className="text-muted-foreground">{i + 1}. </span>
                {resolveStepCopy(step.title, rubro)}
              </span>
              <span aria-hidden="true">{done ? "✓" : ""}</span>
              <span className="sr-only">{done ? "Completado" : "Pendiente"}</span>
            </button>
          )
        })}
      </nav>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          Volver
        </Button>
      </SheetFooter>
    </>
  )
}

function TutorialHelp({
  rubro,
  onBack,
}: {
  rubro: ReturnType<typeof normalizeRubro>
  onBack: () => void
}) {
  return (
    <>
      <SheetHeader>
        <SheetTitle>¿Qué debería usar?</SheetTitle>
        <SheetDescription>Guía rápida para elegir la herramienta correcta.</SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        <div className="space-y-2">
          {CATALOG_TUTORIAL_DECISION_TABLE.map((row) => (
            <Card key={row.need}>
              <CardContent className="pt-4 text-sm">
                <p className="text-muted-foreground">Quiero: {resolveStepCopy(row.need, rubro)}</p>
                <p className="font-semibold">→ {row.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {CATALOG_TUTORIAL_OWN_VS_SHARED_COMPARISON.map((col) => (
            <Card key={col.title}>
              <CardContent className="pt-4">
                <h4 className="mb-2 font-semibold">{col.title}</h4>
                <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {col.points.map((point) => (
                    <li key={point}>{resolveStepCopy(point, rubro)}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <SheetFooter>
        <Button type="button" variant="outline" onClick={onBack}>
          Volver
        </Button>
      </SheetFooter>
    </>
  )
}

function TutorialStepView({
  step,
  rubro,
  index,
  total,
  isCompleted,
  canGoBack,
  canGoNext,
  onGoToAction,
  onComplete,
  onSkip,
  onBack,
  onClose,
}: {
  step: CatalogTutorialStep
  rubro: ReturnType<typeof normalizeRubro>
  index: number
  total: number
  isCompleted: boolean
  canGoBack: boolean
  canGoNext: boolean
  onGoToAction: () => void
  onComplete: () => void
  onSkip: () => void
  onBack: () => void
  onClose: () => void
}) {
  return (
    <>
      <SheetHeader>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Paso {index + 1} de {total} · {resolveStepCopy(step.chapterTitle, rubro)}
        </p>
        <SheetTitle>{resolveStepCopy(step.title, rubro)}</SheetTitle>
        <SheetDescription>{resolveStepCopy(step.description, rubro)}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {step.details && step.details.length > 0 && (
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
            {step.details.map((detail) => (
              <li key={detail}>{resolveStepCopy(detail, rubro)}</li>
            ))}
          </ul>
        )}

        {step.actionKey && step.actionKey !== "none" && step.actionLabel && (
          <Button type="button" onClick={onGoToAction} className="w-full">
            {resolveStepCopy(step.actionLabel, rubro)}
          </Button>
        )}
      </div>
      <SheetFooter className="flex-col gap-2">
        <Button type="button" onClick={onComplete} className="w-full">
          {isCompleted ? "Continuar" : step.completionLabel}
        </Button>
        <div className="flex w-full items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={!canGoBack}>
            Atrás
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSkip} disabled={!canGoNext}>
            Saltar
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </SheetFooter>
    </>
  )
}
