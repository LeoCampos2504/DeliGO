import { afterEach, describe, expect, test } from "bun:test"
import { notifyServiceWorkerMessagePresented } from "@/lib/chat-push-dedupe-bridge"

const originalNavigator = globalThis.navigator

afterEach(() => {
  if (originalNavigator === undefined) {
    // @ts-expect-error - restoring the pre-test absence of `navigator`.
    delete globalThis.navigator
  } else {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    })
  }
})

function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, "navigator", {
    value,
    configurable: true,
    writable: true,
  })
}

describe("notifyServiceWorkerMessagePresented", () => {
  test("no-op, never throws, when navigator is undefined (SSR)", () => {
    // @ts-expect-error - simulating an SSR-like environment.
    delete globalThis.navigator
    expect(() => notifyServiceWorkerMessagePresented("msg-1")).not.toThrow()
  })

  test("no-op when navigator has no serviceWorker support", () => {
    setNavigator({})
    expect(() => notifyServiceWorkerMessagePresented("msg-1")).not.toThrow()
  })

  test("no-op when there is no active controller (page not yet controlled)", () => {
    setNavigator({ serviceWorker: { controller: null } })
    expect(() => notifyServiceWorkerMessagePresented("msg-1")).not.toThrow()
  })

  test("no-op for an empty messageId, even with a valid controller", () => {
    let called = false
    setNavigator({
      serviceWorker: { controller: { postMessage: () => { called = true } } },
    })
    notifyServiceWorkerMessagePresented("")
    expect(called).toBe(false)
  })

  test("no-op for a non-string messageId", () => {
    let called = false
    setNavigator({
      serviceWorker: { controller: { postMessage: () => { called = true } } },
    })
    // @ts-expect-error - deliberately passing an invalid type to prove the runtime guard.
    notifyServiceWorkerMessagePresented(null)
    expect(called).toBe(false)
  })

  test("swallows a postMessage that throws", () => {
    setNavigator({
      serviceWorker: {
        controller: {
          postMessage: () => {
            throw new Error("boom")
          },
        },
      },
    })
    expect(() => notifyServiceWorkerMessagePresented("msg-1")).not.toThrow()
  })

  test("posts the exact CHAT_MESSAGE_PRESENTED shape to the controller when everything is valid", () => {
    let received: unknown = null
    setNavigator({
      serviceWorker: {
        controller: {
          postMessage: (msg: unknown) => { received = msg },
        },
      },
    })
    notifyServiceWorkerMessagePresented("msg-42")
    expect(received).toEqual({ type: "CHAT_MESSAGE_PRESENTED", messageId: "msg-42" })
  })
})
