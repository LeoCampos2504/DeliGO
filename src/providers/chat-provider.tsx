"use client"

import { useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { useChatStore } from "@/store/chat-store"
import { useAuthStore } from "@/store/auth-store"

// Dynamic import chat components to reduce initial bundle size
const ChatFab = dynamic(
  () => import("@/components/chat/chat-fab").then((mod) => mod.ChatFab),
  { ssr: false }
)

const ChatSheet = dynamic(
  () => import("@/components/chat/chat-sheet").then((mod) => mod.ChatSheet),
  { ssr: false }
)

// Bugfix-4 [17]: abre el chat exacto cuando se llega desde el deep link de una
// notificación (`?chat=<pedidoId>`, agregado por el service worker en
// notificationclick). Se lee `window.location.search` directamente en vez de
// `useSearchParams()` para no forzar un límite de Suspense en el layout raíz,
// que envuelve TODA la app. Se limpia el parámetro de la URL después de
// abrir el chat para no reabrirlo en un refresh o al volver atrás.
//
// Bugfix-4D: antes esto solo corría una vez al montar (`useEffect(..., [])`).
// Si la PWA ya estaba abierta y el service worker navega esa ventana
// (`client.navigate()`) a una nueva notificación de chat, no hay garantía de
// que ChatProvider se desmonte/remonte — así que hace falta releer la URL al
// recuperar el foco/visibilidad, no solo al montar.
// Exportado (P2-T31-R23A) exclusivamente para poder montarlo aislado en
// tests reales de DOM (happy-dom + react-dom/client) sin arrastrar
// ChatFab/ChatSheet (`next/dynamic`, `ssr:false`) — el comportamiento del
// hook en sí, y su uso dentro de `ChatProvider` más abajo, no cambian.
export function useChatDeepLink() {
  const { openConversation, setSheetOpen } = useChatStore()
  const { isAuthenticated, userType } = useAuthStore()
  // P2-T31-R23A: `isAuthenticated()`/`userType()` leen el store de auth
  // ANTES de que termine de hidratarse en un arranque en frío (exactamente
  // el escenario de abrir la PWA desde un tap de notificación) — sin este
  // selector, el efecto de abajo podía correr una única vez con
  // `isAuthenticated()===false` (usuario todavía no rehidratado desde
  // localStorage) y nunca reintentar, descartando el deep-link `?chat=`
  // para siempre en silencio. Ver
  // P2_T31_R23_CHAT_PUSH_NOTIFICATION_TAP_DEEPLINK_ROOT_CAUSE_AUDIT.md.
  // Agregarlo a las dependencias del efecto hace que `consumeChatParam()`
  // se vuelva a ejecutar exactamente cuando la hidratación termina — el
  // guard `if (!chatPedidoId) return` ya evita un doble consumo si el
  // parámetro ya se había limpiado en una corrida anterior.
  const authHasHydrated = useAuthStore((state) => state._hasHydrated)

  useEffect(() => {
    function consumeChatParam() {
      const params = new URLSearchParams(window.location.search)
      const chatPedidoId = params.get("chat")
      if (!chatPedidoId) return
      if (!isAuthenticated() || userType() === "superadmin") return

      openConversation(chatPedidoId)
      setSheetOpen(true)

      params.delete("chat")
      const newSearch = params.toString()
      const newUrl = `${window.location.pathname}${newSearch ? `?${newSearch}` : ""}${window.location.hash}`
      window.history.replaceState(null, "", newUrl)
    }

    consumeChatParam()

    function onVisible() {
      if (document.visibilityState === "visible") consumeChatParam()
    }
    window.addEventListener("focus", consumeChatParam)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("focus", consumeChatParam)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [openConversation, setSheetOpen, isAuthenticated, userType, authHasHydrated])
}

function useChatActorReset() {
  const user = useAuthStore((state) => state.user)
  const actorKey = user ? `${user.type}:${user.id}` : null
  const previousActorKeyRef = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    if (previousActorKeyRef.current !== undefined && previousActorKeyRef.current !== actorKey) {
      useChatStore.getState().reset()
    }
    previousActorKeyRef.current = actorKey
  }, [actorKey])
}

export function ChatProvider() {
  const pathname = usePathname()
  useChatDeepLink()
  useChatActorReset()

  if (pathname === "/mozo" || pathname.startsWith("/mozo/")) {
    return null
  }

  return (
    <>
      <ChatFab />
      <ChatSheet />
    </>
  )
}
