/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  esRutaPwaRepartidor,
  REPARTIDOR_POST_LOGIN_PATH,
} from "./repartidor-post-login-navigation"

describe("P2-T02-B1 — navegación post-login de Repartidor", () => {
  test("login exitoso apunta al namespace de Repartidor y no a Cliente ni a root", () => {
    expect(REPARTIDOR_POST_LOGIN_PATH).toBe("/repartidor/")
    expect(esRutaPwaRepartidor(REPARTIDOR_POST_LOGIN_PATH)).toBe(true)
    expect(esRutaPwaRepartidor("/")).toBe(false)
    expect(esRutaPwaRepartidor("/cliente/")).toBe(false)
  })

  test("la forma canónica sin slash y los subpaths permanecen en Repartidor", () => {
    expect(esRutaPwaRepartidor("/repartidor")).toBe(true)
    expect(esRutaPwaRepartidor("/repartidor/pedidos")).toBe(true)
    expect(esRutaPwaRepartidor("/negocio")).toBe(false)
  })

  test("el formulario de Repartidor usa la política de destino post-login (nunca router.replace(\"/\"))", () => {
    const pageSource = readFileSync(
      resolve(import.meta.dir, "../app/repartidor/page.tsx"),
      "utf8"
    )

    expect(pageSource).toContain('from "@/lib/repartidor-post-login-navigation"')
    expect(pageSource).toContain("router.replace(REPARTIDOR_POST_LOGIN_PATH)")
    expect(pageSource).not.toContain('router.replace("/")')
  })
})
