"use client"

import { create } from "zustand"

// ============================================
// Repartidor store types
// ============================================

interface NegocioAsociado {
  id: string
  negocioId: string
  negocioSlug: string
  negocioNombre: string
  negocioLogoUrl: string | null
  codigoAcceso: string
  fechaAsociacion: string
  negocio?: {
    id: string
    nombre: string
    slug: string
    logoUrl: string | null
    ofreceDelivery: boolean
    suspendido: boolean
  }
}

interface RepartidorState {
  // Tab navigation
  activeTab: RepartidorTab
  setActiveTab: (tab: RepartidorTab) => void

  // Refresh trigger
  refreshKey: number
  triggerRefresh: () => void

  // Negocios cache
  negocios: NegocioAsociado[]
  setNegocios: (negocios: NegocioAsociado[]) => void

  // Stats
  pedidosPendientes: number
  pedidosEntregadosHoy: number
  setStats: (pendientes: number, entregados: number) => void
}

export type RepartidorTab = "entregas" | "negocios" | "historial" | "perfil"

export const useRepartidorStore = create<RepartidorState>()((set) => ({
  activeTab: "entregas",
  setActiveTab: (tab) => set({ activeTab: tab }),

  refreshKey: 0,
  triggerRefresh: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),

  negocios: [],
  setNegocios: (negocios) => set({ negocios }),

  pedidosPendientes: 0,
  pedidosEntregadosHoy: 0,
  setStats: (pendientes, entregados) =>
    set({ pedidosPendientes: pendientes, pedidosEntregadosHoy: entregados }),
}))
