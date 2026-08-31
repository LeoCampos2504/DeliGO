"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
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
 * BottomNav — floating dock, portaled to document.body.
 *
 * IOS-24-NAV-DOCK: this used to render as a descendant deep inside
 * src/app/cliente/page.tsx's scrollable subtree. On iPhone, manual scroll
 * (no keyboard involved at all) could visually detach it from the bottom
 * of the screen — a residual symptom left after IOS-24-POSITION-FIX, which
 * fixed keyboard-driven scroll but not this. Portaling to document.body
 * removes it from that subtree entirely and gives it the viewport as its
 * containing block. This is NOT presented as a magic WebKit fix — portal-
 * to-body alone did NOT fix the old Chat bug (see IOS-24-RESIDUAL-SCROLL-
 * AUDIT), which needed the real position-restore logic in
 * src/components/pwa/ios-keyboard-fix.tsx. Here it's used specifically to
 * isolate the nav from Cliente's content subtree.
 *
 * The bottom gap (safe-area + a constant 8px) is an intentional design
 * choice, never a keyboard-height compensation — it never reads
 * `--visual-viewport-height`, `--ios-keyboard-offset`, or `window.scrollY`.
 * The class below (`bottom-[calc(env(safe-area-inset-bottom,0px)+8px)]`) is
 * the base/default value. IOS-24-NAV-SAFEAREA-STABILITY found, via the
 * runtime diagnostic panel on a real device, that this dynamic env() value
 * itself changes at runtime on iOS Safari (8px vs 42px total, observed),
 * moving the dock. For iOS only, a higher-specificity CSS rule in
 * globals.css (`body.ios-device .ios-bottom-nav`) overrides `bottom` with a
 * static safe-area footprint instead — this file does not need a JS
 * conditional for that; non-iOS keeps using the class below unmodified.
 * Keyboard-open handling stays exactly as IOS-24-FIX-A left it:
 * `visibility:hidden` + `pointer-events:none` via the
 * `.ios-keyboard-open .ios-bottom-nav` rule in globals.css — no transform,
 * no JS keyboard detection here. z-40 (not z-50) is deliberate: Chat's
 * Sheet/Radix dialogs render at z-50, so the dock always stacks below them
 * regardless of portal mount order.
 */
export function BottomNav() {
  const user = useAuthStore((s) => s.user)
  const { activeTab, setActiveTab } = useNavStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // setMounted runs inside a deferred callback (not as a direct effect-body
    // statement) — same idiom already used elsewhere in this codebase for
    // this exact "detect client-only condition, then flip state" shape
    // (react-hooks/set-state-in-effect).
    const timer = window.setTimeout(() => setMounted(true), 0)
    return () => window.clearTimeout(timer)
  }, [])

  // Only show for logged-in clients, and only once mounted on the client —
  // document.body isn't available during SSR, and gating on `mounted` keeps
  // the first client render identical to the server render (both render
  // nothing), avoiding a hydration mismatch.
  if (!mounted || !user || user.type !== "cliente") return null

  const dock = (
    <nav
      className={cn(
        "ios-bottom-nav",
        "fixed z-40 left-3 right-3 mx-auto max-w-lg",
        "bottom-[calc(env(safe-area-inset-bottom,0px)+8px)]",
        "bg-card border border-border rounded-3xl shadow-lg overflow-hidden"
      )}
      data-ios-debug-role="bottom-nav"
    >
      <div className="flex items-center justify-around h-16">
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

  return createPortal(dock, document.body)
}
