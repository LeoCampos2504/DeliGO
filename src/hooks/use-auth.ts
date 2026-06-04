"use client"

import { useEffect, useCallback } from "react"
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
 * On mount, it checks /api/auth/me and updates the store if a session exists.
 * This handles page refreshes where the cookie is still valid but Zustand is empty.
 */
export function useAuth() {
  const router = useRouter()
  const { user, token, isAuthenticated, userType, userName, logout } = useAuthStore()

  const syncSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me")
      if (!res.ok) return

      const data = await res.json()
      if (!data.ok || !data.user) return

      const { user: serverUser } = data

      // Update Zustand store based on user type
      switch (serverUser.type as UserType) {
        case "cliente":
          useAuthStore.getState().loginCliente({
            id: serverUser.id,
            nombre: serverUser.nombre,
            email: serverUser.email,
            token: "synced", // Token is in httpOnly cookie, not needed client-side
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
            token: "synced",
          })
          break
        case "repartidor":
          useAuthStore.getState().loginRepartidor({
            id: serverUser.id,
            nombre: serverUser.nombre,
            email: serverUser.email,
            activo: serverUser.activo,
            token: "synced",
          })
          break
        case "superadmin":
          useAuthStore.getState().loginSuperAdmin({
            id: serverUser.id,
            token: "synced",
          })
          break
      }
    } catch {
      // Silently fail — user just stays logged out
    }
  }, [])

  useEffect(() => {
    // Only sync if Zustand has no user but might have a cookie
    if (!user || !token) {
      syncSession()
    }
  }, [user, token, syncSession])

  const handleLogout = useCallback(async () => {
    // Remember the role BEFORE clearing the store
    const currentRole = userTypeToRole(userType())
    const loginUrl = ROLE_CONFIGS[currentRole].loginUrl

    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // Continue even if API call fails
    }
    logout()

    // Redirect to the role-specific login page
    router.replace(loginUrl)
  }, [logout, userType, router])

  return {
    user,
    token,
    isAuthenticated,
    userType,
    userName,
    logout: handleLogout,
    syncSession,
  }
}
