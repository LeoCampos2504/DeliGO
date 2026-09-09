// P2-T26-R2: certifies the store additions that back the notification
// deep-link (navigateWithEntity/pendingEntityId/clearPendingEntity) and the
// cross-contamination fix — a manual tab click (setActiveTab) must always
// clear any leftover pendingEntityId from a previous notification click, so
// an unrelated tab never inherits an entity id it was never meant to have.

import { beforeEach, describe, expect, test } from "bun:test"
import { useSuperAdminStore } from "./superadmin-store"

function resetStore() {
  useSuperAdminStore.setState({ activeTab: "overview", pendingEntityId: null, refreshKey: 0 })
}

beforeEach(() => {
  resetStore()
})

describe("useSuperAdminStore — P2-T26-R2 additions", () => {
  test("navigateWithEntity sets both activeTab and pendingEntityId atomically", () => {
    useSuperAdminStore.getState().navigateWithEntity("moderacion-resenas", "sol-123")
    expect(useSuperAdminStore.getState().activeTab).toBe("moderacion-resenas")
    expect(useSuperAdminStore.getState().pendingEntityId).toBe("sol-123")
  })

  test("navigateWithEntity without an entityId clears pendingEntityId (tab-only notifications)", () => {
    useSuperAdminStore.getState().navigateWithEntity("moderacion-resenas", "sol-123")
    useSuperAdminStore.getState().navigateWithEntity("pendientes")
    expect(useSuperAdminStore.getState().activeTab).toBe("pendientes")
    expect(useSuperAdminStore.getState().pendingEntityId).toBeNull()
  })

  test("clearPendingEntity clears it without touching activeTab", () => {
    useSuperAdminStore.getState().navigateWithEntity("denuncias", "d-1")
    useSuperAdminStore.getState().clearPendingEntity()
    expect(useSuperAdminStore.getState().activeTab).toBe("denuncias")
    expect(useSuperAdminStore.getState().pendingEntityId).toBeNull()
  })

  test("a manual setActiveTab (regular tab click) clears a stale pendingEntityId from an unrelated notification", () => {
    // Bell navigated to "denuncias" with an entity, but the tab hasn't
    // consumed/cleared it yet (component not mounted, or user never opened
    // the dialog) — a completely unrelated manual click to another tab must
    // not let "moderacion-resenas" (or any tab) inherit that stale id.
    useSuperAdminStore.getState().navigateWithEntity("denuncias", "d-1")
    useSuperAdminStore.getState().setActiveTab("moderacion-resenas")
    expect(useSuperAdminStore.getState().activeTab).toBe("moderacion-resenas")
    expect(useSuperAdminStore.getState().pendingEntityId).toBeNull()
  })

  test("triggerRefresh still increments refreshKey (pre-existing behavior unchanged)", () => {
    const before = useSuperAdminStore.getState().refreshKey
    useSuperAdminStore.getState().triggerRefresh()
    expect(useSuperAdminStore.getState().refreshKey).toBe(before + 1)
  })
})
