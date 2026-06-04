"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

// ============================================
// Cart item types
// ============================================

export interface CartItemAgregado {
  id: string
  nombre: string
  precio: number
}

export interface CartItemSecciones {
  [sectionName: string]: string | Record<string, number> // string = single select, Record = multi-select with quantities
}

// ============================================
// Delivery address types
// ============================================

export interface DeliveryAddress {
  lat: number
  lng: number
  direccion: string
  referencia: string
  alias?: string
  direccionId?: string // links to the Direccion record in DB
}

export interface CartItem {
  key: string // unique identifier for this specific cart entry
  productoId: string
  nombre: string
  precio: number
  cantidad: number
  agregados: CartItemAgregado[]
  secciones: CartItemSecciones
  ingredientesQuitados: string[] // ingredient names removed
  talle: string
  color: string
  notas: string
}

// Generate a unique key for a cart item based on its options
export function generateCartItemKey(item: Omit<CartItem, "key">): string {
  const seccionesStr = Object.entries(item.secciones)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => {
      if (typeof v === "string") return `${k}:${v}`
      // Record<string, number> — sort entries for stable key
      const sorted = Object.entries(v as Record<string, number>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ok, ov]) => `${ok}x${ov}`)
        .join(",")
      return `${k}:{${sorted}}`
    })
    .join("|")

  const parts = [
    item.productoId,
    item.agregados.map((a) => a.id).sort().join(","),
    seccionesStr,
    item.ingredientesQuitados.sort().join(","),
    item.talle,
    item.color,
  ]
  return parts.join("::")
}

// ============================================
// Cart store state & actions
// ============================================

interface CartState {
  // Active business context
  activeNegocioId: string | null
  activeNegocioSlug: string | null
  activeNegocioNombre: string | null
  precioDelivery: number

  // Cart items (per business)
  items: CartItem[]

  // Delivery address
  deliveryAddress: DeliveryAddress | null
  savedAddresses: DeliveryAddress[]

  // Service fee fixed amount
  tarifaServicioFija: number

  // Hydration flag
  _hasHydrated: boolean

  // Actions
  setActiveNegocio: (
    negocioId: string,
    slug: string,
    nombre: string,
    precioDelivery: number
  ) => void
  clearActiveNegocio: () => void
  addItem: (item: Omit<CartItem, "key">) => void
  removeItem: (key: string) => void
  updateQuantity: (key: string, cantidad: number) => void
  clearCart: () => void
  setDeliveryAddress: (address: DeliveryAddress | null) => void
  addSavedAddress: (address: DeliveryAddress) => void
  removeSavedAddress: (index: number) => void
  setHasHydrated: (v: boolean) => void

  // Computed-like getters
  totalProductos: () => number
  tarifaServicio: () => number
  total: () => number
  totalItems: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      activeNegocioId: null,
      activeNegocioSlug: null,
      activeNegocioNombre: null,
      precioDelivery: 0,
      items: [],
      deliveryAddress: null,
      savedAddresses: [],
      tarifaServicioFija: 250, // Fixed service fee
      _hasHydrated: false,

      setActiveNegocio: (
        negocioId: string,
        slug: string,
        nombre: string,
        precioDelivery: number
      ) => {
        const state = get()
        // If switching to a different business, clear the cart
        if (state.activeNegocioId && state.activeNegocioId !== negocioId) {
          set({
            activeNegocioId: negocioId,
            activeNegocioSlug: slug,
            activeNegocioNombre: nombre,
            precioDelivery,
            items: [],
          })
        } else {
          set({
            activeNegocioId: negocioId,
            activeNegocioSlug: slug,
            activeNegocioNombre: nombre,
            precioDelivery,
          })
        }
      },

      clearActiveNegocio: () => {
        set({
          activeNegocioId: null,
          activeNegocioSlug: null,
          activeNegocioNombre: null,
          precioDelivery: 0,
          items: [],
        })
      },

      addItem: (item: Omit<CartItem, "key">) => {
        const key = generateCartItemKey(item)
        const state = get()
        const existingIndex = state.items.findIndex((i) => i.key === key)

        if (existingIndex >= 0) {
          // Same product + same options: increase quantity
          const updated = [...state.items]
          updated[existingIndex] = {
            ...updated[existingIndex],
            cantidad: updated[existingIndex].cantidad + item.cantidad,
          }
          set({ items: updated })
        } else {
          set({ items: [...state.items, { ...item, key }] })
        }
      },

      removeItem: (key: string) => {
        set({ items: get().items.filter((i) => i.key !== key) })
      },

      updateQuantity: (key: string, cantidad: number) => {
        if (cantidad <= 0) {
          get().removeItem(key)
          return
        }
        set({
          items: get().items.map((i) =>
            i.key === key ? { ...i, cantidad } : i
          ),
        })
      },

      clearCart: () => {
        set({ items: [], activeNegocioId: null, activeNegocioSlug: null, activeNegocioNombre: null, precioDelivery: 0 })
      },

      setDeliveryAddress: (address: DeliveryAddress | null) => {
        set({ deliveryAddress: address })
      },

      addSavedAddress: (address: DeliveryAddress) => {
        const current = get().savedAddresses
        // Avoid duplicates based on lat/lng proximity
        const isDuplicate = current.some(
          (a) => Math.abs(a.lat - address.lat) < 0.0001 && Math.abs(a.lng - address.lng) < 0.0001
        )
        if (!isDuplicate) {
          set({ savedAddresses: [...current, address] })
        }
      },

      removeSavedAddress: (index: number) => {
        const current = get().savedAddresses
        set({ savedAddresses: current.filter((_, i) => i !== index) })
      },

      setHasHydrated: (v: boolean) => {
        set({ _hasHydrated: v })
      },

      // Computed getters
      totalProductos: () => {
        return get().items.reduce((sum, item) => {
          const agregadosTotal = item.agregados.reduce(
            (aSum, a) => aSum + a.precio,
            0
          )
          return sum + (item.precio + agregadosTotal) * item.cantidad
        }, 0)
      },

      tarifaServicio: () => {
        return get().tarifaServicioFija
      },

      total: () => {
        const state = get()
        return state.totalProductos() + state.tarifaServicio() + state.precioDelivery
      },

      totalItems: () => {
        return get().items.reduce((sum, item) => sum + item.cantidad, 0)
      },
    }),
    {
      name: "deligo-cart-v2",
      partialize: (state) => ({
        activeNegocioId: state.activeNegocioId,
        activeNegocioSlug: state.activeNegocioSlug,
        activeNegocioNombre: state.activeNegocioNombre,
        precioDelivery: state.precioDelivery,
        items: state.items,
        deliveryAddress: state.deliveryAddress,
        savedAddresses: state.savedAddresses,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
