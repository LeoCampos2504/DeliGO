"use client"

import { Home, ClipboardList, Heart, Tag, User } from "lucide-react"
import { motion } from "framer-motion"
import { useEffect, useRef } from "react"
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

export function BottomNav() {
  const { isAuthenticated, userType } = useAuthStore()
  const { activeTab, setActiveTab } = useNavStore()
  const navRef = useRef<HTMLElement>(null)

  // Keyboard detection — hides nav when virtual keyboard opens.
  // Uses direct DOM manipulation for instant response.
  // After keyboard closes, repositions nav correctly via visualViewport.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return

    let isHidden = false
    let showTimer: ReturnType<typeof setTimeout> | null = null

    const hideNav = () => {
      if (showTimer) {
        clearTimeout(showTimer)
        showTimer = null
      }
      if (isHidden) return
      isHidden = true
      nav.style.transform = "translateY(100%)"
      nav.style.transition = "none"
    }

    const showNav = () => {
      if (!isHidden) return
      isHidden = false

      // On iOS PWA, after keyboard closes, `fixed; bottom: 0` may not
      // work correctly right away. Use visualViewport to position the nav
      // at the real bottom, then let CSS take over after viewport settles.
      if (window.visualViewport && window.innerWidth <= 768) {
        const vv = window.visualViewport
        const bottomPosition = vv.height - NAV_HEIGHT + vv.offsetTop
        nav.style.position = "absolute"
        nav.style.top = `${bottomPosition}px`
        nav.style.bottom = "auto"
        nav.style.transform = ""
        nav.style.transition = "none"

        // Switch back to CSS fixed positioning after viewport settles
        setTimeout(() => {
          nav.style.position = ""
          nav.style.top = ""
          nav.style.bottom = ""
          nav.style.transform = ""
        }, 500)
      } else {
        nav.style.transform = ""
        nav.style.transition = "transform 0.2s ease"
      }
    }

    const scheduleShow = (delay: number) => {
      if (showTimer) clearTimeout(showTimer)
      showTimer = setTimeout(() => {
        showTimer = null
        if (!isEditableTarget(document.activeElement)) {
          showNav()
        }
      }, delay)
    }

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      return Boolean(
        target.closest(
          'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [contenteditable="true"]'
        )
      )
    }

    const handleFocusIn = (e: FocusEvent) => {
      if (window.innerWidth <= 768 && isEditableTarget(e.target)) {
        hideNav()
      }
    }

    const handleFocusOut = () => {
      scheduleShow(200)
    }

    const handleViewportChange = () => {
      if (!window.visualViewport) return

      if (isEditableTarget(document.activeElement)) {
        hideNav()
        return
      }

      const vv = window.visualViewport
      const viewportIsFull = vv.height >= window.innerHeight - 50

      if (viewportIsFull && isHidden) {
        scheduleShow(50)
      }
    }

    document.addEventListener("focusin", handleFocusIn)
    document.addEventListener("focusout", handleFocusOut)

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewportChange)
      window.visualViewport.addEventListener("scroll", handleViewportChange)
    }

    return () => {
      document.removeEventListener("focusin", handleFocusIn)
      document.removeEventListener("focusout", handleFocusOut)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewportChange)
        window.visualViewport.removeEventListener("scroll", handleViewportChange)
      }
      if (showTimer) clearTimeout(showTimer)
    }
  }, [])

  // Only show for logged-in clients
  if (!isAuthenticated() || userType() !== "cliente") return null

  return (
    <nav
      ref={navRef}
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border pb-safe supports-[backdrop-filter]:bg-card/80"
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
