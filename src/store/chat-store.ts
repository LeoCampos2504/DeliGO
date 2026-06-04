"use client"

import { create } from "zustand"

// ============================================
// Types
// ============================================
export interface ChatMessage {
  id: string
  pedidoId: string
  remitente: string // "cliente" | "vendedor" | "repartidor"
  texto: string
  imagenUrl: string | null
  archivoUrl: string | null
  archivoNombre: string | null
  archivoTipo: string | null
  leido: boolean
  fecha: string
  clienteId: string | null
}

export interface Conversation {
  pedidoId: string
  negocioNombre: string
  negocioSlug: string
  clienteNombre: string
  estado: string
  total: number
  metodoEntrega: string
  metodoPago: string
  fecha: string
  lastMessage: string | null
  lastMessageDate: string | null
  lastMessageRemitente: string | null
  unreadCount: number
  negocioLogoUrl: string | null
}

export interface PedidoInfo {
  id: string
  negocioNombre: string
  negocioSlug: string
  clienteNombre: string
  estado: string
  total: number
  metodoEntrega: string
  metodoPago: string
}

interface TypingUser {
  userId: string
  userType: string
  userName: string
}

interface ChatState {
  // UI state
  isSheetOpen: boolean
  activePedidoId: string | null
  isConnecting: boolean
  isConnected: boolean

  // Data
  conversations: Conversation[]
  messages: Record<string, ChatMessage[]> // pedidoId -> messages
  pedidoInfo: Record<string, PedidoInfo>
  unreadCount: number

  // Typing state
  typingUsers: Record<string, TypingUser[]> // pedidoId -> typing users

  // Loading states
  isLoadingConversations: boolean
  isLoadingMessages: Record<string, boolean>
  isSending: boolean

  // Actions
  setSheetOpen: (open: boolean) => void
  openConversation: (pedidoId: string) => void
  closeConversation: () => void
  setConnected: (connected: boolean) => void
  setConnecting: (connecting: boolean) => void

  // Data actions
  setConversations: (conversations: Conversation[]) => void
  setMessages: (pedidoId: string, messages: ChatMessage[]) => void
  addMessage: (pedidoId: string, message: ChatMessage) => void
  setPedidoInfo: (pedidoId: string, info: PedidoInfo) => void
  setUnreadCount: (count: number) => void
  updateConversationUnread: (pedidoId: string, count: number) => void

  // Typing actions
  addTypingUser: (pedidoId: string, user: TypingUser) => void
  removeTypingUser: (pedidoId: string, userId: string) => void

  // Loading actions
  setLoadingConversations: (loading: boolean) => void
  setLoadingMessages: (pedidoId: string, loading: boolean) => void
  setSending: (sending: boolean) => void
}

export const useChatStore = create<ChatState>()((set) => ({
  // UI state
  isSheetOpen: false,
  activePedidoId: null,
  isConnecting: false,
  isConnected: false,

  // Data
  conversations: [],
  messages: {},
  pedidoInfo: {},
  unreadCount: 0,

  // Typing state
  typingUsers: {},

  // Loading states
  isLoadingConversations: false,
  isLoadingMessages: {},
  isSending: false,

  // Actions
  setSheetOpen: (open) => set({ isSheetOpen: open }),

  openConversation: (pedidoId) =>
    set({ activePedidoId: pedidoId }),

  closeConversation: () =>
    set({ activePedidoId: null }),

  setConnected: (connected) => set({ isConnected: connected }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),

  // Data actions
  setConversations: (conversations) => set({ conversations }),

  setMessages: (pedidoId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [pedidoId]: messages },
    })),

  addMessage: (pedidoId, message) =>
    set((state) => {
      const existing = state.messages[pedidoId] || []
      // Avoid duplicates
      if (existing.some((m) => m.id === message.id)) return state
      return {
        messages: { ...state.messages, [pedidoId]: [...existing, message] },
      }
    }),

  setPedidoInfo: (pedidoId, info) =>
    set((state) => ({
      pedidoInfo: { ...state.pedidoInfo, [pedidoId]: info },
    })),

  setUnreadCount: (count) => set({ unreadCount: count }),

  updateConversationUnread: (pedidoId, count) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.pedidoId === pedidoId ? { ...c, unreadCount: count } : c
      ),
    })),

  // Typing actions
  addTypingUser: (pedidoId, user) =>
    set((state) => {
      const current = state.typingUsers[pedidoId] || []
      if (current.some((u) => u.userId === user.userId)) return state
      return {
        typingUsers: {
          ...state.typingUsers,
          [pedidoId]: [...current, user],
        },
      }
    }),

  removeTypingUser: (pedidoId, userId) =>
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [pedidoId]: (state.typingUsers[pedidoId] || []).filter(
          (u) => u.userId !== userId
        ),
      },
    })),

  // Loading actions
  setLoadingConversations: (loading) =>
    set({ isLoadingConversations: loading }),

  setLoadingMessages: (pedidoId, loading) =>
    set((state) => ({
      isLoadingMessages: { ...state.isLoadingMessages, [pedidoId]: loading },
    })),

  setSending: (sending) => set({ isSending: sending }),
}))
