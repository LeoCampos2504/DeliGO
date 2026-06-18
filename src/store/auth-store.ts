"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { UserType } from "@/lib/auth"

// ============================================
// Auth store types
// ============================================

interface AuthUser {
  id: string
  type: UserType
  nombre: string
  email?: string
  slug?: string
  rubro?: string
  aprobado?: boolean
  suspendido?: boolean
  activo?: boolean
}

interface AuthState {
  user: AuthUser | null
  _hasHydrated: boolean

  // Actions
  // NOTE: The session token is NEVER exposed to the client. Authentication is
  // handled exclusively via an httpOnly cookie set by the login API. These
  // actions only hydrate the non-sensitive user profile used for UI state.
  loginCliente: (data: { id: string; nombre: string; email: string }) => void
  loginNegocio: (data: { id: string; nombre: string; slug: string; rubro: string; aprobado: boolean; suspendido?: boolean }) => void
  loginRepartidor: (data: { id: string; nombre: string; email: string; activo: boolean }) => void
  loginSuperAdmin: (data: { id: string }) => void
  logout: () => void
  setSuspendido: (suspendido: boolean) => void
  setHasHydrated: (v: boolean) => void

  // Getters
  isAuthenticated: () => boolean
  userType: () => UserType | null
  userName: () => string | null
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      _hasHydrated: false,

      loginCliente: (data) => {
        set({
          user: {
            id: data.id,
            type: "cliente",
            nombre: data.nombre,
            email: data.email,
          },
        })
      },

      loginNegocio: (data) => {
        set({
          user: {
            id: data.id,
            type: "negocio",
            nombre: data.nombre,
            slug: data.slug,
            rubro: data.rubro,
            aprobado: data.aprobado,
            suspendido: data.suspendido,
          },
        })
      },

      loginRepartidor: (data) => {
        set({
          user: {
            id: data.id,
            type: "repartidor",
            nombre: data.nombre,
            email: data.email,
            activo: data.activo,
          },
        })
      },

      loginSuperAdmin: (data) => {
        set({
          user: {
            id: data.id,
            type: "superadmin",
            nombre: "SuperAdmin",
          },
        })
      },

      logout: () => {
        set({ user: null })
      },

      setSuspendido: (suspendido: boolean) => {
        const current = get().user
        if (current && current.type === "negocio") {
          set({ user: { ...current, suspendido } })
        }
      },

      setHasHydrated: (v: boolean) => {
        set({ _hasHydrated: v })
      },

      isAuthenticated: () => {
        return get().user !== null
      },

      userType: () => {
        return get().user?.type ?? null
      },

      userName: () => {
        return get().user?.nombre ?? null
      },
    }),
    {
      name: "deligo-auth",
      partialize: (state) => ({
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
