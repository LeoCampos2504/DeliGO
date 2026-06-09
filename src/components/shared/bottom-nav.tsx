"use client"

import { Home, ClipboardList, Heart, Tag, User } from "lucide-react"
import { motion } from "framer-motion"
import { useEffect, useState, type CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { useAuthStore } from "@/store/auth-store"
import { useNavStore, type ClientTab } from "@/store/nav-store"

const tabs: { id: ClientTab; icon: typeof Home; label: string }[] = [
  { id: "inicio", icon: Home, label: "Inicio" },
  { id: "pedidos", icon: ClipboardList, label: "Pedidos" },
  { id: "favoritos", icon: Heart, label: "Favoritos" },
  { id: "promos", icon: Tag, label: "Promos" },
  { id: "perfil", icon: User, label: "Perfil" },
]

const NAV_HEIGHT = 64

function isIOSLike() {
  if (typeof navigator === "undefined") return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}

export function BottomNav() {
  const { isAuthenticated, userType } = useAuthStore()
  const { activeTab, setActiveTab } = useNavStore()
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [iosNavTop, setIosNavTop] = useState<number | null>(null)

  useEffect(() => {
    const isMobileViewport = () => window.innerWidth <= 768

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      return Boolean(
        target.closest(
          'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [contenteditable="true"]'
        )
      )
    }

    const handleFocusIn = (event: FocusEvent) => {
      if (isMobileViewport() && isEditableTarget(event.target)) {
        setKeyboardOpen(true)
      }
    }

    const handleFocusOut = () => {
      window.setTimeout(() => {
        if (!isEditableTarget(document.activeElement)) {
          setKeyboardOpen(false)
        }
      }, 120)
    }

    document.addEventListener("focusin", handleFocusIn)
    document.addEventListener("focusout", handleFocusOut)

    return () => {
      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
    }
  }, [])

  useEffect(() => {
    if (!isIOSLike()) return

    let frame = 0

    const updatePosition = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        if (window.innerWidth > 768 || !window.visualViewport) {
          setIosNavTop(null)
          return
        }

        const viewportBottom =
          window.visualViewport.pageTop + window.visualViewport.height
        setIosNavTop(Math.max(0, Math.round(viewportBottom - NAV_HEIGHT)))
      })
    }

    updatePosition()

    window.addEventListener("resize", updatePosition)
    window.addEventListener("scroll", updatePosition, { passive: true })
    window.visualViewport?.addEventListener("resize", updatePosition)
    window.visualViewport?.addEventListener("scroll", updatePosition)

    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("resize", updatePosition)
      window.removeEventListener("scroll", updatePosition)
      window.visualViewport?.removeEventListener("resize", updatePosition)
      window.visualViewport?.removeEventListener("scroll", updatePosition)
    }
  }, [])

  // Only show for logged-in clients
  if (!isAuthenticated() || userType() !== "cliente") {
    return null
  }

  if (keyboardOpen) {
    return null
  }

  const navStyle: CSSProperties | undefined =
    iosNavTop === null
      ? undefined
      : { position: "absolute", top: iosNavTop, bottom: "auto" }

  return (
    <nav
      style={navStyle}
      className={cn(
        "keyboard-hide-when-editing fixed left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border supports-[backdrop-filter]:bg-card/80",
        iosNavTop === null && "bottom-0"
      )}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
