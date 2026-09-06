// P2-T31-R13/R13A (ANDROID-PUSHMANAGER-ABORTERROR-AND-STALE-UI-ROOT-CAUSE /
// PUSH-FAILURE-REPORTING-HARDENING): direct behavioral tests for
// `reportMutationFailureSafely` — the tiny helper extracted specifically
// because a physical Android trace proved an unguarded console.error/
// toast.error pair inside subscribe()'s catch block can throw and silently
// skip `finishMutation`/`SUBSCRIBE_FINISH` entirely (both were previously
// documented as unconditional, but weren't). R13A hardened this further:
// logging and toast now have INDEPENDENT failure boundaries — a throw from
// console.error can never skip the toast attempt (contract requirement E),
// matching R13A's own case matrix (§8 of that task) exactly: CASO 1
// (logger throws, toast still attempted), CASO 2 (toast throws alone), CASO
// 3 (both throw), CASO 4 (no message → no toast), CASO 5 (normal path). No
// React/DOM needed (this repo has neither jsdom nor React Testing Library)
// — `sonner`'s `toast` export is mocked so its real runtime behavior (which
// may itself depend on a mounted <Toaster/>) never influences this test.
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"

const toastErrorMock = mock((..._args: unknown[]) => {})

mock.module("sonner", () => ({
  toast: { error: toastErrorMock, success: mock(() => {}) },
}))

// Imported AFTER the mock is registered so use-push-notifications.ts picks
// up the mocked "sonner" module.
const { reportMutationFailureSafely } = await import("./use-push-notifications")

const originalConsoleError = console.error

beforeEach(() => {
  toastErrorMock.mockClear()
  console.error = mock(() => {})
})

afterEach(() => {
  console.error = originalConsoleError
})

describe("reportMutationFailureSafely — CASO 5: normal path", () => {
  test("logs via console.error and shows the toast when a message is given", () => {
    reportMutationFailureSafely("Push subscribe error:", new Error("boom"), "Error al activar notificaciones")

    expect(console.error).toHaveBeenCalledTimes(1)
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock.mock.calls[0]?.[0]).toBe("Error al activar notificaciones")
  })

  test("never throws for a non-Error thrown value", () => {
    expect(() => reportMutationFailureSafely("Push subscribe error:", "a plain string throw", "msg")).not.toThrow()
  })
})

describe("reportMutationFailureSafely — CASO 4: no message means no toast", () => {
  test("never shows a toast when the message is null (the stale-operation gate)", () => {
    reportMutationFailureSafely("Push subscribe error:", new Error("boom"), null)

    expect(console.error).toHaveBeenCalledTimes(1)
    expect(toastErrorMock).not.toHaveBeenCalled()
  })
})

describe("reportMutationFailureSafely — CASO 1: logger throws, toast is STILL attempted (independent boundaries)", () => {
  test("a throw from console.error never skips the toast.error attempt, and the helper itself never throws", () => {
    console.error = mock(() => {
      throw new Error("console.error itself threw")
    })

    expect(() => reportMutationFailureSafely("Push subscribe error:", new Error("boom"), "Error al activar notificaciones")).not.toThrow()
    // P2-T31-R13A hardening: unlike the single-shared-boundary version, the
    // toast MUST still be attempted even though logging failed first.
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock.mock.calls[0]?.[0]).toBe("Error al activar notificaciones")
  })
})

describe("reportMutationFailureSafely — CASO 2/3: toast throws alone, or both throw — never propagates", () => {
  test("CASO 2: swallows a throw from toast.error alone and still never throws", () => {
    toastErrorMock.mockImplementationOnce(() => {
      throw new Error("toast.error itself threw")
    })

    expect(() => reportMutationFailureSafely("Push subscribe error:", new Error("boom"), "msg")).not.toThrow()
    expect(console.error).toHaveBeenCalledTimes(1)
  })

  test("CASO 3: both console.error AND toast.error throw — helper still never throws, both were attempted", () => {
    console.error = mock(() => {
      throw new Error("console.error itself threw")
    })
    toastErrorMock.mockImplementationOnce(() => {
      throw new Error("toast.error itself threw")
    })

    expect(() => reportMutationFailureSafely("Push subscribe error:", new Error("boom"), "msg")).not.toThrow()
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
  })
})
