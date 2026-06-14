"use client"

import { create } from "zustand"

// ============================================
// SuperAdmin store types
// ============================================

export type SuperAdminTab = "overview" | "pendientes" | "activos" | "promocionados" | "alertas" | "deudas" | "denuncias" | "solicitudes-destacado"

interface SuperAdminState {
  activeTab: SuperAdminTab
  setActiveTab: (tab: SuperAdminTab) => void

  refreshKey: number
  triggerRefresh: () => void
}

export const useSuperAdminStore = create<SuperAdminState>()((set) => ({
  activeTab: "overview",
  setActiveTab: (tab) => set({ activeTab: tab }),

  refreshKey: 0,
  triggerRefresh: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
}))
