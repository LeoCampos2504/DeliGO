// ============================================
// DeliGO - Chat Push Dedupe Bridge (D2)
// ============================================
// Único punto donde el cliente le avisa al Service Worker que un mensaje de
// Chat ya se le mostró al usuario en foreground (vía socket), para que la
// Push de OS redundante para ese mismo mensaje se suprima. Fail-open: ante
// cualquier duda (SSR, sin soporte de SW, sin controller activo, id
// inválido, postMessage que tira) simplemente no hace nada — nunca lanza,
// nunca bloquea, y la Push sigue mostrándose normalmente si esto falla.

export function notifyServiceWorkerMessagePresented(messageId: string): void {
  if (typeof navigator === "undefined") return
  if (!("serviceWorker" in navigator)) return
  const controller = navigator.serviceWorker.controller
  if (!controller) return
  if (typeof messageId !== "string" || messageId.length === 0) return

  try {
    controller.postMessage({ type: "CHAT_MESSAGE_PRESENTED", messageId })
  } catch {
    // Silencioso a propósito — ver nota fail-open arriba.
  }
}
