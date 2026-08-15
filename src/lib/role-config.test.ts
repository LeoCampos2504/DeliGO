/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { isChatEligibleUser } from "./chat-eligibility"
import { getRoleConfig, getRoleForUserType } from "./role-config"

describe("authenticated role to PWA routing", () => {
  test("maps supported session types to canonical roles", () => {
    expect(getRoleForUserType("cliente")).toBe("cliente")
    expect(getRoleForUserType("negocio")).toBe("negocio")
    expect(getRoleForUserType("repartidor")).toBe("repartidor")
  })

  test("uses canonical start URLs for wrong-role navigation", () => {
    expect(getRoleConfig(getRoleForUserType("cliente")).startUrl).toBe("/cliente")
    expect(getRoleConfig(getRoleForUserType("negocio")).startUrl).toBe("/negocio")
    expect(getRoleConfig(getRoleForUserType("repartidor")).startUrl).toBe("/repartidor")
    expect(getRoleConfig(getRoleForUserType("cliente")).loginUrl).toBe("/cliente/")
    expect(getRoleConfig(getRoleForUserType("negocio")).loginUrl).toBe("/negocio")
    expect(getRoleConfig(getRoleForUserType("repartidor")).loginUrl).toBe("/repartidor")
  })

  test("chat eligibility is actor-based and independent of pathname", () => {
    expect(isChatEligibleUser(null)).toBe(false)
    expect(isChatEligibleUser({ type: "cliente" })).toBe(true)
    expect(isChatEligibleUser({ type: "negocio" })).toBe(true)
    expect(isChatEligibleUser({ type: "repartidor" })).toBe(false)
    expect(isChatEligibleUser({ type: "superadmin" })).toBe(false)
  })
})
