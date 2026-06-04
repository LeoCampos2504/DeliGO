"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

// ============================================
// Client navigation tabs
// ============================================

export type ClientTab = "inicio" | "pedidos" | "favoritos" | "promos" | "perfil"

interface NavState {
  activeTab: ClientTab
  setActiveTab: (tab: ClientTab) => void
  openAddressForm: boolean // flag to auto-open address form in profile
  setOpenAddressForm: (v: boolean) => void
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
}

export const useNavStore = create<NavState>()(
  persist(
    (set) => ({
      activeTab: "inicio" as ClientTab,
      setActiveTab: (tab: ClientTab) => set({ activeTab: tab }),
      openAddressForm: false,
      setOpenAddressForm: (v: boolean) => set({ openAddressForm: v }),
      _hasHydrated: false,
      setHasHydrated: (v: boolean) => set({ _hasHydrated: v }),
    }),
    {
      name: "deligo-nav",
      partialize: (state) => ({ activeTab: state.activeTab }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
