"use client"

import { Home, ClipboardList, Heart, Tag, User } from "lucide-react"
import { motion } from "framer-motion"
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

/**
 * BottomNav — Pure CSS-driven keyboard handling.
 *
 * NO inline style manipulation, NO useEffect for keyboard detection,
 * NO manual position: absolute hacks.
 *
 * The global IOSKeyboardFix component adds `ios-keyboard-open` to <html>/<body>
 * when the virtual keyboard is open on iOS. CSS rules in globals.css use that
 * class to hide this nav with transform + pointer-events.
 *
 * This component is stateless — it only renders the nav and lets CSS do the rest.
 */
export function BottomNav() {
  const { isAuthenticated, userType } = useAuthStore()
  const { activeTab, setActiveTab } = useNavStore()

  // Only show for logged-in clients
  if (!isAuthenticated() || userType() !== "cliente") return null

  return (
    <nav
      className={cn(
        "ios-bottom-nav",
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-card/95 backdrop-blur-md border-t border-border",
        "pb-safe",
        "supports-[backdrop-filter]:bg-card/80",
        "transition-transform duration-200 ease-in-out"
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
