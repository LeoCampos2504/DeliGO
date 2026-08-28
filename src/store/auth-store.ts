"use client"

import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"
import type { UserType } from "@/lib/auth"

// ============================================
// P2-T18-BLOCKER-AUTH2-R8 (Phase 2) — active session family
// ============================================
// Fuente de verdad congelada en AUTH2-R7: la familia activa de UNA pestaña
// se deriva exclusivamente de su propio window.location.pathname, nunca de
// un valor almacenado (localStorage/sessionStorage) ni de un string
// arbitrario suministrado por el usuario/atacante — nunca es autoridad de
// seguridad (Fase 1, sin cambio, sigue re-validando todo server-side), sólo
// decide qué namespace de persistencia y qué selector usar.

/** Familias de sesión genéricas que participan en el namespacing de Fase 2
 * (coincide exactamente con SessionFamily de src/lib/auth.ts/src/proxy.ts,
 * redeclarado localmente para no importar código server-only de @/lib/auth
 * en un módulo "use client"). SuperAdmin queda deliberadamente fuera —
 * sistema de cookie aislado (24-A), nunca pasa por este namespacing. */
export type ActiveSessionFamily = "cliente" | "negocio" | "repartidor"

/** Deriva la familia activa de ESTA pestaña a partir de su propio pathname
 * — nunca de almacenamiento ni de query strings. `null` para cualquier
 * pathname fuera de /cliente, /negocio, /repartidor (p. ej. /admin): esas
 * rutas preservan el comportamiento legacy sin namespacing, sin cambio. */
function matchesFamilyPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function activeSessionFamily(pathname: string): ActiveSessionFamily | null {
  if (matchesFamilyPrefix(pathname, "/cliente")) return "cliente"
  if (matchesFamilyPrefix(pathname, "/negocio")) return "negocio"
  if (matchesFamilyPrefix(pathname, "/repartidor")) return "repartidor"
  return null
}

function familyScopedKey(name: string): string {
  if (typeof window === "undefined") return name
  const family = activeSessionFamily(window.location.pathname)
  return family ? `${name}:${family}` : name
}

/** Adapter de storage que remapea la clave fija que Zustand persist pide
 * ("deligo-auth") a una clave namespaced por familia en cada operación —
 * nunca cachea la familia, siempre la deriva fresca del pathname actual.
 * La clave legacy plana ("deligo-auth", sin sufijo) queda intacta y se
 * sigue usando tal cual para cualquier pathname sin familia (p. ej.
 * /admin) — comportamiento 100% preservado ahí. Para pathnames de familia,
 * la clave legacy nunca se lee ni se escribe — evita cualquier ambigüedad
 * sobre a qué familia pertenecía un valor legacy global (ver
 * codex-reports/archive/P2-T18-BLOCKER-AUTH2-R7.md §LEGACY_STORAGE_MIGRATION).
 */
function familyScopedStorage(): StateStorage {
  return {
    getItem: (name) => {
      if (typeof window === "undefined") return null
      return window.localStorage.getItem(familyScopedKey(name))
    },
    setItem: (name, value) => {
      if (typeof window === "undefined") return
      window.localStorage.setItem(familyScopedKey(name), value)
    },
    removeItem: (name) => {
      if (typeof window === "undefined") return
      window.localStorage.removeItem(familyScopedKey(name))
    },
  }
}

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

function getPersistedUser(persistedState: unknown): AuthUser | null {
  if (!persistedState || typeof persistedState !== "object") return null
  const state = persistedState as { user?: AuthUser | null }
  return state.user ?? null
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
      version: 1,
      storage: createJSONStorage(familyScopedStorage),
      migrate: (persistedState) => ({
        user: getPersistedUser(persistedState),
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        user: getPersistedUser(persistedState),
      }),
      partialize: (state) => ({
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
