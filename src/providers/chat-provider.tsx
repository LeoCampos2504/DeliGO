"use client"

import { useEffect } from "react"
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
function useChatDeepLink() {
  const { openConversation, setSheetOpen } = useChatStore()
  const { isAuthenticated, userType } = useAuthStore()

  useEffect(() => {
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
    // Se ejecuta una sola vez al montar: solo interesa el deep link inicial.
  }, [])
}

export function ChatProvider() {
  const pathname = usePathname()
  useChatDeepLink()

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
