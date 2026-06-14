"use client"

import { create } from "zustand"

// ============================================
// Notification Store
// ============================================

export interface NotificationItem {
  id: string
  userId: string
  userType: string
  tipo: string
  titulo: string
  cuerpo: string
  leido: boolean
  pedidoId: string | null
  negocioId: string | null
  datos: string // JSON string
  createdAt: string
}

interface NotificationState {
  noLeidos: number
  setNoLeidos: (count: number) => void
  decrementNoLeidos: (by?: number) => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  toggleOpen: () => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  noLeidos: 0,
  setNoLeidos: (count) => set({ noLeidos: count }),
  decrementNoLeidos: (by = 1) => set((state) => ({ noLeidos: Math.max(0, state.noLeidos - by) })),
  isOpen: false,
  setIsOpen: (open) => set({ isOpen: open }),
  toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
}))
