/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  CLIENTE_CATALOGO_BASE_PATH,
  esRutaCatalogoCliente,
  esRutaCatalogoNegocio,
  getCatalogoPathActual,
  getClienteCatalogoPath,
  getPublicCatalogoPath,
} from "./cliente-catalog-navigation"

const read = (path: string) => readFileSync(resolve(import.meta.dir, path), "utf8")

describe("PWA-21-B01 — navegación Cliente al catálogo", () => {
  test("distingue la ruta Cliente-scoped de la URL pública del mismo negocio", () => {
    expect(CLIENTE_CATALOGO_BASE_PATH).toBe("/cliente/n/")
    expect(getClienteCatalogoPath("burgerking")).toBe("/cliente/n/burgerking")
    expect(getPublicCatalogoPath("burgerking")).toBe("/n/burgerking")
    expect(getClienteCatalogoPath("burgerking")).not.toBe(getPublicCatalogoPath("burgerking"))
  })

  test("la ruta Cliente queda dentro de su scope y nunca usa otros namespaces", () => {
    const path = getClienteCatalogoPath("burgerking")

    expect(esRutaCatalogoCliente(path)).toBe(true)
    expect(esRutaCatalogoNegocio(path)).toBe(true)
    expect(path.startsWith("/cliente/")).toBe(true)
    expect(path.startsWith("/n/")).toBe(false)
    expect(path.startsWith("/negocio/")).toBe(false)
    expect(path.startsWith("/operaciones/")).toBe(false)
    expect(path.startsWith("/repartidor/")).toBe(false)
  })

  test("conserva la entrada correcta al limpiar parámetros del catálogo", () => {
    expect(getCatalogoPathActual("/cliente/n/burgerking", "burgerking")).toBe("/cliente/n/burgerking")
    expect(getCatalogoPathActual("/n/burgerking", "burgerking")).toBe("/n/burgerking")
  })

  test("las superficies Cliente usan la ruta scoped y la página pública conserva el share público", () => {
    const businessCard = read("../app/cliente/page.tsx")
    const favorites = read("../components/client/client-favorites-panel.tsx")
    const promos = read("../components/client/client-promos-panel.tsx")
    const orders = read("../components/client/client-orders-panel.tsx")
    const catalog = read("../app/n/[slug]/page.tsx")

    for (const source of [businessCard, favorites, promos, orders]) {
      expect(source).toContain('from "@/lib/cliente-catalog-navigation"')
      expect(source).toContain("getClienteCatalogoPath")
    }
    expect(catalog).toContain("getCatalogoPathActual(pathname, slug)")
    expect(catalog).toContain('`${window.location.origin}/n/${negocio.slug}`')
  })
})
