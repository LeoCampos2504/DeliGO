"use client"

import React from "react"
import { motion } from "framer-motion"
import { ShoppingBag } from "lucide-react"
import { cn, formatPrice } from "@/lib/utils"
import { useCartStore } from "@/store/cart-store"

interface CartStickyBarProps {
  negocioColor: string
  negocioId: string
  onClick: () => void
}

export function CartStickyBar({ negocioColor, negocioId, onClick }: CartStickyBarProps) {
  const cartItems = useCartStore((s) => s.items)
  const totalItems = useCartStore((s) => s.totalItems())
  const totalProductos = useCartStore((s) => s.totalProductos())
  const activeNegocioId = useCartStore((s) => s.activeNegocioId)

  if (cartItems.length === 0 || activeNegocioId !== negocioId) return null

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed bottom-0 left-0 right-0 z-40"
    >
      <div className="max-w-lg md:max-w-2xl mx-auto px-3 pb-3">
        <button
          onClick={onClick}
          className="w-full flex items-center justify-between pl-4 pr-3 py-3 rounded-2xl text-white font-bold shadow-2xl hover:brightness-110 transition-all active:scale-[0.98]"
          style={{
            backgroundColor: negocioColor,
            boxShadow: `0 8px 30px ${negocioColor}40`,
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div className="text-left">
              <span className="text-sm font-extrabold block leading-tight">
                {totalItems} {totalItems === 1 ? "producto" : "productos"}
              </span>
              <span className="text-[10px] text-white/70 font-medium">
                Ver carrito
              </span>
            </div>
          </div>
          <span className="text-base font-extrabold">
            {formatPrice(totalProductos)}
          </span>
        </button>
      </div>
    </motion.div>
  )
}
