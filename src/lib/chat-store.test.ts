import { describe, expect, test } from "bun:test"
import { useChatStore } from "@/store/chat-store"

describe("Chat store actor reset", () => {
  test("clears actor-sensitive conversations, messages, typing and active state", () => {
    useChatStore.setState({
      isSheetOpen: true,
      activePedidoId: "pedido-sensitive",
      conversations: [{
        pedidoId: "pedido-sensitive",
        negocioNombre: "Negocio",
        negocioSlug: "negocio",
        clienteNombre: "Cliente",
        estado: "EN_CURSO",
        total: 100,
        metodoEntrega: "delivery",
        metodoPago: "efectivo",
        fecha: "2026-01-01T00:00:00.000Z",
        lastMessage: "secreto",
        lastMessageDate: "2026-01-01T00:00:00.000Z",
        lastMessageRemitente: "cliente",
        unreadCount: 2,
        negocioLogoUrl: null,
      }],
      messages: { "pedido-sensitive": [{
        id: "message-sensitive",
        pedidoId: "pedido-sensitive",
        remitente: "cliente",
        texto: "secreto",
        imagenUrl: null,
        archivoUrl: null,
        archivoNombre: null,
        archivoTipo: null,
        leido: false,
        fecha: "2026-01-01T00:00:00.000Z",
        clienteId: "cliente-a",
      }] },
      pedidoInfo: { "pedido-sensitive": {
        id: "pedido-sensitive",
        negocioNombre: "Negocio",
        negocioSlug: "negocio",
        clienteNombre: "Cliente",
        estado: "EN_CURSO",
        total: 100,
        metodoEntrega: "delivery",
        metodoPago: "efectivo",
      } },
      unreadCount: 2,
      typingUsers: { "pedido-sensitive": [{ userId: "actor-a", userType: "cliente", userName: "Cliente" }] },
      isLoadingConversations: true,
      isLoadingMessages: { "pedido-sensitive": true },
      isSending: true,
    })

    useChatStore.getState().reset()
    const state = useChatStore.getState()
    expect(state.isSheetOpen).toBe(false)
    expect(state.activePedidoId).toBeNull()
    expect(state.conversations).toEqual([])
    expect(state.archivedConversations).toEqual([])
    expect(state.messages).toEqual({})
    expect(state.pedidoInfo).toEqual({})
    expect(state.unreadCount).toBe(0)
    expect(state.typingUsers).toEqual({})
    expect(state.isLoadingConversations).toBe(false)
    expect(state.isLoadingMessages).toEqual({})
    expect(state.isSending).toBe(false)
  })
})
