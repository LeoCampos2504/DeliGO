"use client"

// ============================================
// BUSINESS-CATALOG-UX-HARDENING-R1 — shared discard-confirmation dialog
// ============================================
// One presentational component reused by every catalog editing Drawer
// (Product, Ingredient, Addition, Shared Option, Catalog Section) instead of
// five copy-pasted AlertDialogs or window.confirm(). Dismissing the dialog
// itself (Escape / outside click) always resolves to "Seguir editando" —
// never a silent discard — via onOpenChange below.

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function CatalogUnsavedChangesDialog({
  open,
  onContinueEditing,
  onDiscard,
}: {
  open: boolean
  onContinueEditing: () => void
  onDiscard: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) onContinueEditing() }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Descartar los cambios?</AlertDialogTitle>
          <AlertDialogDescription>
            Tenés cambios sin guardar. Si salís ahora, los vas a perder.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onContinueEditing}>Seguir editando</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard}>Descartar cambios</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
