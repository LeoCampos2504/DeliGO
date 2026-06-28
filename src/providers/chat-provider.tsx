"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"

// Dynamic import chat components to reduce initial bundle size
const ChatFab = dynamic(
  () => import("@/components/chat/chat-fab").then((mod) => mod.ChatFab),
  { ssr: false }
)

const ChatSheet = dynamic(
  () => import("@/components/chat/chat-sheet").then((mod) => mod.ChatSheet),
  { ssr: false }
)

export function ChatProvider() {
  const pathname = usePathname()

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
