"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useChatStore } from "@/store/chat-store"
import { useAuthStore } from "@/store/auth-store"

export function ChatFab() {
  const { unreadCount, setSheetOpen, setUnreadCount } = useChatStore()
  const { isAuthenticated, userType } = useAuthStore()
  const pathname = usePathname()

  const canChat = isAuthenticated() && userType() !== "superadmin"
  // Hide chat on: catalog page (/n/), mozo/mesas link (/m/), salon link (/s/), repartidor page
  // Show chat on: employee orders/reviews link (/e/) — chat is for cliente-negocio only, not for mozo mesas or delivery
  const isHidden = pathname.startsWith("/n/") || pathname.startsWith("/m/") || pathname.startsWith("/s/") || pathname.startsWith("/repartidor")

  // Periodically fetch unread count
  useEffect(() => {
    if (!canChat) return

    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/chat/no-leidos")
        if (!res.ok) return
        const data = await res.json()
        setUnreadCount(data.noLeidos || 0)
      } catch {
        // silently fail
      }
    }

    // Fetch immediately
    fetchUnread()

    // Then every 15 seconds
    const interval = setInterval(fetchUnread, 15000)
    return () => clearInterval(interval)
  }, [canChat, setUnreadCount])

  if (!canChat || isHidden) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setSheetOpen(true)}
        className="ios-keyboard-hide keyboard-hide-when-editing fixed right-4 bottom-20 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 transition-colors"
        aria-label="Abrir chat"
      >
        <MessageCircle className="h-6 w-6" />
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1"
          >
            <Badge className="h-5 min-w-5 px-1.5 flex items-center justify-center bg-red-500 text-white border-2 border-background text-[10px] font-bold p-0">
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          </motion.div>
        )}
      </motion.button>
    </AnimatePresence>
  )
}
