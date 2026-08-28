"use client"

import { useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { activeSessionFamily, useAuthStore } from "@/store/auth-store"
import type { UserType } from "@/lib/auth"
import { ROLE_CONFIGS, type DeliGORole } from "@/lib/role-config"

// P2-T18-BLOCKER-AUTH2-R8 (Phase 2): construye la URL de un endpoint
// compartido (allowlist congelado por Fase 1: /api/auth/me,
// /api/auth/logout, /api/realtime/token, /api/realtime/authorize)
// adjuntando el selector ?actorFamily= sólo cuando hay una familia
// conocida — mismo transporte ya certificado server-side, nunca uno nuevo.
function withActorFamily(path: string, family: string | null): string {
  return family ? `${path}?actorFamily=${family}` : path
}

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

async function getCurrentPushSubscription(): Promise<string | null> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return null
  }

  const registration = await navigator.serviceWorker.getRegistration("/")
  const subscription = await registration?.pushManager.getSubscription()
  return subscription ? JSON.stringify(subscription) : null
}

async function unlinkCurrentPushSubscription(): Promise<void> {
  const subscription = await getCurrentPushSubscription()
  if (!subscription) return

  await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription }),
  })
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
type UseAuthOptions = {
  autoSync?: boolean
}

export function useAuth({ autoSync = true }: UseAuthOptions = {}) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userType = useAuthStore((s) => s.userType)
  const userName = useAuthStore((s) => s.userName)
  const logout = useAuthStore((s) => s.logout)
  const hasValidated = useRef(false)

  const syncSession = useCallback(async (): Promise<boolean> => {
    try {
      // P2-T18-BLOCKER-AUTH2-R8 (Phase 2): en el bootstrap, el store de
      // ESTA pestaña todavía no tiene un user conocido — la única fuente
      // de familia disponible en este punto es el pathname de la propia
      // pestaña (nunca localStorage/query arbitrario).
      const family = activeSessionFamily(window.location.pathname)
      const res = await fetch(withActorFamily("/api/auth/me", family), {
        cache: "no-store",
        credentials: "same-origin",
      })

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
          return true
        }
      }

      // 401 = session expired / no cookie — clear stale Zustand data
      if (res.status === 401) {
        const store = useAuthStore.getState()
        if (store.user) {
          store.logout()
        }
      }
      return false
    } catch {
      // Network error — don't clear, might be offline (PWA)
      return false
    }
  }, [])

  useEffect(() => {
    if (!autoSync) return

    // Only validate once per mount to avoid infinite loops
    // (syncSession updates the store which would re-trigger this effect)
    if (hasValidated.current) return
    hasValidated.current = true
    syncSession()
  }, [autoSync, syncSession])

  const handleLogout = useCallback(async () => {
    // Remember the role BEFORE clearing the store
    // P2-T18-BLOCKER-AUTH2-R8 (Phase 2): family también se captura ACÁ,
    // antes de logout() — es la única fuente confiable en este punto (el
    // store real de esta sesión), se pierde en cuanto logout() limpia el
    // store. superadmin/null nunca envían selector (fuera del esquema de
    // familias, comportamiento actual preservado).
    const family = userType()
    const currentRole = userTypeToRole(family)
    const loginUrl = ROLE_CONFIGS[currentRole].loginUrl
    const selectorFamily = family === "cliente" || family === "negocio" || family === "repartidor" ? family : null

    logout()

    try {
      await unlinkCurrentPushSubscription()
    } catch {
      // Continue even if push cleanup fails
    }

    try {
      await fetch(withActorFamily("/api/auth/logout", selectorFamily), { method: "POST" })
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
