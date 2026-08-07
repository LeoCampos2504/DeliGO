/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  esRutaPwaNegocio,
  NEGOCIO_POST_LOGIN_PATH,
} from "./negocio-post-login-navigation"

describe("PWA-21-C01 — navegación post-login de Negocio", () => {
  test("login exitoso apunta al namespace de Negocio y no a Cliente ni a root", () => {
    expect(NEGOCIO_POST_LOGIN_PATH).toBe("/negocio/")
    expect(esRutaPwaNegocio(NEGOCIO_POST_LOGIN_PATH)).toBe(true)
    expect(esRutaPwaNegocio("/")).toBe(false)
    expect(esRutaPwaNegocio("/cliente/")).toBe(false)
  })

  test("la forma canónica sin slash y los subpaths permanecen en Negocio", () => {
    expect(esRutaPwaNegocio("/negocio")).toBe(true)
    expect(esRutaPwaNegocio("/negocio/pedidos")).toBe(true)
    expect(esRutaPwaNegocio("/repartidor")).toBe(false)
  })

  test("el formulario de Negocio usa la política de destino post-login", () => {
    const pageSource = readFileSync(
      resolve(import.meta.dir, "../app/negocio/page.tsx"),
      "utf8"
    )

    expect(pageSource).toContain('from "@/lib/negocio-post-login-navigation"')
    expect(pageSource).toContain("router.replace(NEGOCIO_POST_LOGIN_PATH)")
    expect(pageSource).not.toContain('router.replace("/")')
  })
})
