"use client"

import { useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/store/auth-store"
import type { UserType } from "@/lib/auth"
import { ROLE_CONFIGS, type DeliGORole } from "@/lib/role-config"

/**
 * Map UserType to DeliGORole for logout redirect
 */
function userTypeToRole(userType: UserType | null): DeliGORole {
  switch (userType) {
    case "negocio": return "negocio"
    case "repartidor": return "repartidor"
    case "superadmin": return "admin"
    default: return "cliente"
  }
}

/**
 * Hook that syncs server-side session with client-side Zustand store.
 *
 * On mount, it calls /api/auth/me:
 * - If Zustand has no user → tries to restore session from httpOnly cookie
 * - If Zustand has a user → validates that the session is still active on server.
 *   If the session expired (401), clears the stale Zustand data so the app
 *   doesn't show a ghost logged-in state.
 *
 * The validation runs once on mount (not on every render) to avoid loops.
 */
export function useAuth() {
  const router = useRouter()
  const { user, isAuthenticated, userType, userName, logout } = useAuthStore()
  const hasValidated = useRef(false)

  const syncSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me")

      // Session is still valid — update store with latest server data
      if (res.ok) {
        const data = await res.json()
        if (data.ok && data.user) {
          const { user: serverUser } = data

          switch (serverUser.type as UserType) {
            case "cliente":
              useAuthStore.getState().loginCliente({
                id: serverUser.id,
                nombre: serverUser.nombre,
                email: serverUser.email,
              })
              break
            case "negocio":
              useAuthStore.getState().loginNegocio({
                id: serverUser.id,
                nombre: serverUser.nombre,
                slug: serverUser.slug,
                rubro: serverUser.rubro,
                aprobado: serverUser.aprobado,
                suspendido: serverUser.suspendido,
              })
              break
            case "repartidor":
              useAuthStore.getState().loginRepartidor({
                id: serverUser.id,
                nombre: serverUser.nombre,
                email: serverUser.email,
                activo: serverUser.activo,
              })
              break
            case "superadmin":
              useAuthStore.getState().loginSuperAdmin({
                id: serverUser.id,
              })
              break
          }
          return
        }
      }

      // 401 = session expired / no cookie — clear stale Zustand data
      if (res.status === 401) {
        const store = useAuthStore.getState()
        if (store.user) {
          store.logout()
        }
      }
    } catch {
      // Network error — don't clear, might be offline (PWA)
    }
  }, [])

  useEffect(() => {
    // Only validate once per mount to avoid infinite loops
    // (syncSession updates the store which would re-trigger this effect)
    if (hasValidated.current) return
    hasValidated.current = true
    syncSession()
  }, [syncSession])

  const handleLogout = useCallback(async () => {
    // Remember the role BEFORE clearing the store
    const currentRole = userTypeToRole(userType())
    const loginUrl = ROLE_CONFIGS[currentRole].loginUrl

    logout()

    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // Continue even if API call fails
    }

    // Redirect to the role-specific login page
    router.replace(loginUrl)
  }, [logout, userType, router])

  return {
    user,
    isAuthenticated,
    userType,
    userName,
    logout: handleLogout,
    syncSession,
  }
}
