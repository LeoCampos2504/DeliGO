"use client"

import { create } from "zustand"

// ============================================
// SuperAdmin store types
// ============================================

export type SuperAdminTab = "overview" | "pendientes" | "activos" | "promocionados" | "alertas" | "deudas" | "denuncias" | "solicitudes-destacado" | "moderacion-resenas" | "configuracion"

interface SuperAdminState {
  activeTab: SuperAdminTab
  setActiveTab: (tab: SuperAdminTab) => void

  refreshKey: number
  triggerRefresh: () => void

  // P2-T26-R2: entidad concreta a preseleccionar/resaltar en el tab de
  // destino tras hacer click en una notificación (ver
  // src/lib/superadmin-notification-navigation.ts). El tab consumidor la
  // lee UNA vez (típicamente en un efecto al montar) y llama
  // clearPendingEntity() — nunca queda "pegada" entre cambios de tab
  // posteriores no relacionados con una notificación.
  pendingEntityId: string | null
  navigateWithEntity: (tab: SuperAdminTab, entityId?: string) => void
  clearPendingEntity: () => void
}

export const useSuperAdminStore = create<SuperAdminState>()((set) => ({
  activeTab: "overview",
  // P2-T26-R2: cualquier navegación MANUAL (click directo en un tab) limpia
  // `pendingEntityId` — sólo `navigateWithEntity` (desde la campana) debe
  // dejarlo seteado. Sin esto, un click manual a "moderacion-resenas" DESPUÉS
  // de haber navegado por notificación a otro tab con una entidad pendiente
  // sin consumir todavía heredaría esa entidad ajena por error.
  setActiveTab: (tab) => set({ activeTab: tab, pendingEntityId: null }),

  refreshKey: 0,
  triggerRefresh: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),

  pendingEntityId: null,
  navigateWithEntity: (tab, entityId) => set({ activeTab: tab, pendingEntityId: entityId ?? null }),
  clearPendingEntity: () => set({ pendingEntityId: null }),
}))
