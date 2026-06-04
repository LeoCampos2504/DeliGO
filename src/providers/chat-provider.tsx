"use client"

import dynamic from "next/dynamic"

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
  return (
    <>
      <ChatFab />
      <ChatSheet />
    </>
  )
}
