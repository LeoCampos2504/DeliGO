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
 *
 * NOTE on Zustand v5: we use explicit selectors instead of `useAuthStore()`
 * without a selector. In v5, calling the hook without a selector only
 * re-renders when the *entire* state object changes by reference, which can
 * cause subtle misses. Subscribing to `user` directly guarantees a re-render
 * whenever the user logs in or out.
 */
export function useAuth() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userType = useAuthStore((s) => s.userType)
  const userName = useAuthStore((s) => s.userName)
  const logout = useAuthStore((s) => s.logout)
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

    // 1. Clear the Zustand store FIRST so the UI updates immediately to the
    //    logged-out state. This avoids the "stuck logged-in" visual bug where
    //    the header still shows the user avatar/name until a navigation occurs.
    logout()

    // 2. Call the logout endpoint to delete the server session and clear the
    //    httpOnly cookie. Fire-and-forget: even if this fails (network error),
    //    the cookie will eventually expire and /api/auth/me will return 401 on
    //    the next mount, which clears any stale state via syncSession.
    try {
      await fetch("/api/auth/logout", { method: "POST" })
    } catch {
      // Ignore — store is already cleared, session will expire server-side.
    }

    // 3. Navigate to the role's login page. For the cliente role, loginUrl is
    //    "/cliente/" which is the SAME page we're already on, so router.replace
    //    would be a no-op and the client component would NOT re-mount. In that
    //    case we call router.refresh() to force a server-component re-fetch and
    //    guarantee a clean re-render cycle. For other roles we navigate away.
    if (typeof window !== "undefined") {
      const currentPath = window.location.pathname
      const loginPath = new URL(loginUrl, window.location.origin).pathname
      if (currentPath === loginPath || currentPath + "/" === loginPath) {
        // Same page — force a refresh so any server-rendered auth state is reset
        router.refresh()
      } else {
        router.replace(loginUrl)
      }
    } else {
      router.replace(loginUrl)
    }
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
