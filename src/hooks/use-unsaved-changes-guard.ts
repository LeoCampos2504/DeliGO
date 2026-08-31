"use client"

// ============================================
// BUSINESS-CATALOG-UX-HARDENING-R1 — reusable unsaved-changes guard
// ============================================
// One authority for every catalog editing Drawer/Sheet with Save semantics
// (Product, Ingredient, Addition, Shared Option, Catalog Section). A form is
// dirty only when its current field state differs from the snapshot taken
// when the form was opened (clean defaults for create, normalized loaded
// data for edit) — never merely because it was opened or because a field
// was touched and then reverted to its original value.

import { useCallback, useEffect, useRef, useState } from "react"

// Deep, key-order-independent structural equality for the plain
// JSON-serializable form-state shapes used by the catalog editors (strings,
// numbers, booleans, null, arrays, and plain objects — never functions,
// dates, or class instances). Never compares object/array references —
// value-based, so a brand-new object literal with identical contents is
// still equal.
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b
  if (typeof a !== "object") return false

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    return a.every((item, i) => deepEqual(item, b[i]))
  }

  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const aKeys = Object.keys(aObj)
  const bKeys = Object.keys(bObj)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => Object.prototype.hasOwnProperty.call(bObj, key) && deepEqual(aObj[key], bObj[key]))
}

export interface UseUnsavedChangesGuardResult {
  /** Whether the confirm-discard dialog should be shown right now. */
  confirmOpen: boolean
  /**
   * Attempt an app-controlled dismissal (close button, Cancelar, subtab
   * switch, Escape/outside-click via onOpenChange). Runs `action`
   * immediately when the form is clean; when dirty, defers it behind the
   * confirmation dialog instead of running it.
   */
  guardedClose: (action: () => void) => void
  /** "Descartar cambios" — runs the deferred action and closes the dialog. */
  confirmDiscard: () => void
  /** "Seguir editando" / Escape / outside-click on the dialog itself — discards nothing. */
  cancelDiscard: () => void
}

/**
 * `isDirty` is caller-computed (deep-equal an initial snapshot against the
 * current one) so this hook stays agnostic of any particular form's shape.
 */
export function useUnsavedChangesGuard(
  isDirty: boolean,
  options: { beforeUnload?: boolean } = {}
): UseUnsavedChangesGuardResult {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pendingActionRef = useRef<(() => void) | null>(null)
  const beforeUnloadEnabled = options.beforeUnload ?? true

  const guardedClose = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action()
        return
      }
      pendingActionRef.current = action
      setConfirmOpen(true)
    },
    [isDirty]
  )

  const confirmDiscard = useCallback(() => {
    const action = pendingActionRef.current
    pendingActionRef.current = null
    setConfirmOpen(false)
    action?.()
  }, [])

  const cancelDiscard = useCallback(() => {
    pendingActionRef.current = null
    setConfirmOpen(false)
  }, [])

  // A successful save or an explicit reset can make the form clean while a
  // confirmation is still queued. In that case there is nothing left to
  // discard and the stale action must never run later.
  useEffect(() => {
    if (!isDirty) {
      pendingActionRef.current = null
    }
  }, [isDirty])

  // Real browser/tab close or reload — registered ONLY while dirty, removed
  // the instant the form becomes clean (saved, reset, discarded) or unmounts.
  // Never a permanent global listener.
  useEffect(() => {
    if (!isDirty || !beforeUnloadEnabled) return
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [beforeUnloadEnabled, isDirty])

  return { confirmOpen, guardedClose, confirmDiscard, cancelDiscard }
}
