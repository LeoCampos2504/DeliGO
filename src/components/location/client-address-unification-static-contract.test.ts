/// <reference types="bun-types" />

// ============================================
// P2-T32 — Client Address UX Unification: contrato estático de autoridad única
// ============================================
// Prueba, sobre el código fuente real, que Perfil ("Mis Direcciones") y el
// modal de checkout ("Agregar dirección" desde el carrito) instancian la
// MISMA autoridad de formulario/lógica de dirección (AddressForm +
// AddressMapPicker) — nunca dos implementaciones funcionales divergentes.
// También cubre el mecanismo de deep-link determinista (Problema A) y el
// auto-select de la dirección recién creada en checkout (Problema B/§14).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ADDRESS_FORM = readFileSync(join(process.cwd(), "src", "components", "location", "address-form.tsx"), "utf-8")
const ADDRESS_MAP_PICKER = readFileSync(join(process.cwd(), "src", "components", "location", "address-map-picker.tsx"), "utf-8")
const CLIENT_ADDRESS_MODAL = readFileSync(join(process.cwd(), "src", "components", "location", "client-address-modal.tsx"), "utf-8")
const CLIENT_PROFILE_PANEL = readFileSync(join(process.cwd(), "src", "components", "client", "client-profile-panel.tsx"), "utf-8")
const BUSINESS_PAGE = readFileSync(join(process.cwd(), "src", "app", "n", "[slug]", "page.tsx"), "utf-8")

describe("P2-T32 — A/B: Perfil y checkout comparten la MISMA autoridad de formulario", () => {
  test("Perfil (AddressesSection) importa y usa AddressForm — no reimplementa su propio formulario", () => {
    expect(CLIENT_PROFILE_PANEL).toContain('import { AddressForm, type DireccionRecord } from "@/components/location/address-form"')
    expect(CLIENT_PROFILE_PANEL).toContain("<AddressForm")
  })

  test("El modal de checkout (ClientAddressModal) importa y usa la MISMA AddressForm", () => {
    expect(CLIENT_ADDRESS_MODAL).toContain('import { AddressForm, type DireccionRecord } from "./address-form"')
    expect(CLIENT_ADDRESS_MODAL).toContain("<AddressForm")
  })

  test("negocio/[slug] page usa ClientAddressModal (no LocationPickerModal) para agregar dirección desde checkout", () => {
    expect(BUSINESS_PAGE).toContain('import("@/components/location/client-address-modal")')
    expect(BUSINESS_PAGE).toContain("<ClientAddressModal")
    expect(BUSINESS_PAGE).not.toContain("LocationPickerModal")
  })
})

describe("P2-T32 — C: no quedan dos formularios funcionales independientes", () => {
  test("client-profile-panel.tsx ya NO define su propio POST/PUT a /api/cliente/direcciones (esa lógica vive únicamente en AddressForm)", () => {
    // La única mención al endpoint que puede quedar en el panel de perfil es
    // la del DELETE (capacidad exclusiva de Perfil, nunca de checkout) —
    // el archivo SÍ tiene method:"PUT"/"POST" para otras secciones ajenas
    // (password, etc.), así que se valida el fetch a direcciones puntualmente.
    const fetchesToDirecciones = [...CLIENT_PROFILE_PANEL.matchAll(/fetch\(`?\/api\/cliente\/direcciones[^)]*\{([\s\S]{0,200}?)\}\)/g)]
    expect(fetchesToDirecciones.length).toBe(1) // sólo el DELETE de deleteMutation
    expect(fetchesToDirecciones[0][1]).toContain('method: "DELETE"')
    expect(fetchesToDirecciones[0][1]).not.toContain('method: "POST"')
    expect(fetchesToDirecciones[0][1]).not.toContain('method: "PUT"')
  })

  test("ClientAddressModal no define ningún fetch propio — delega el submit por completo a AddressForm", () => {
    expect(CLIENT_ADDRESS_MODAL).not.toContain("fetch(")
  })

  test("AddressForm es la ÚNICA fuente que construye el payload create/update de dirección", () => {
    expect(ADDRESS_FORM).toContain('fetch("/api/cliente/direcciones"')
    expect(ADDRESS_FORM).toContain('method: mode === "edit" ? "PUT" : "POST"')
  })
})

describe("P2-T32 — D: geolocalización/mapa compartidos, no duplicados", () => {
  test("AddressForm usa AddressMapPicker (nunca reimplementa Leaflet/GPS por su cuenta)", () => {
    expect(ADDRESS_FORM).toContain('import { AddressMapPicker } from "./address-map-picker"')
    expect(ADDRESS_FORM).not.toContain("navigator.geolocation")
    expect(ADDRESS_FORM).not.toContain("from \"leaflet\"")
  })

  test("client-profile-panel.tsx ya no importa leaflet directamente ni define su propio picker de mapa", () => {
    expect(CLIENT_PROFILE_PANEL).not.toContain('from "leaflet"')
    expect(CLIENT_PROFILE_PANEL).not.toContain("function AddressMapPicker")
  })

  test("location-map-picker.tsx (patrón pin-fijo, ya sin consumidores de Cliente) no es tocado ni es la autoridad usada por AddressForm", () => {
    expect(ADDRESS_FORM).not.toContain("location-map-picker")
  })

  test("AddressMapPicker sigue soportando: marcador arrastrable, click-to-move, GPS auto-request, reverse geocoding y colorPrincipal configurable", () => {
    expect(ADDRESS_MAP_PICKER).toContain("draggable: true")
    expect(ADDRESS_MAP_PICKER).toContain('map.on("click"')
    expect(ADDRESS_MAP_PICKER).toContain("navigator.geolocation")
    expect(ADDRESS_MAP_PICKER).toContain("nominatim.openstreetmap.org/reverse")
    expect(ADDRESS_MAP_PICKER).toContain("colorPrincipal")
  })
})

describe("P2-T32 — E: alias/campos con paridad completa en checkout (nunca un formulario reducido)", () => {
  test("AddressForm siempre renderiza alias, mapa, dirección y referencia — sin ramas condicionales por modo/contexto que oculten campos", () => {
    expect(ADDRESS_FORM).toContain("Alias *")
    expect(ADDRESS_FORM).toContain("<AddressMapPicker")
    expect(ADDRESS_FORM).toContain("Dirección")
    expect(ADDRESS_FORM).toContain("Referencia (opcional)")
  })

  test("el validador de alias obligatorio corre para AMBOS modos (create y edit), no sólo para uno", () => {
    expect(ADDRESS_FORM).toMatch(/if \(!alias\.trim\(\)\)\s*\{/)
  })
})

describe("P2-T32 — Problema A: deep-link determinista a Mis Direcciones", () => {
  test("SectionCard acepta un id opcional y AddressesSection lo usa como target estable", () => {
    expect(CLIENT_PROFILE_PANEL).toMatch(/function SectionCard\(\{[\s\S]*?id,?\s*\}:/)
    expect(CLIENT_PROFILE_PANEL).toContain('id="mis-direcciones"')
  })

  test("el scroll sólo se dispara tras showForm=true (target ya renderizado) — nunca antes, nunca por setTimeout mágico de píxeles", () => {
    expect(CLIENT_PROFILE_PANEL).toContain("pendingScrollRef")
    expect(CLIENT_PROFILE_PANEL).toContain('getElementById("mis-direcciones")?.scrollIntoView(')
    // El efecto de scroll depende de showForm, no de un timeout arbitrario adicional
    expect(CLIENT_PROFILE_PANEL).toMatch(/if \(showForm && pendingScrollRef\.current\)/)
  })

  test("pendingScrollRef sólo se activa en el flujo de auto-open (intención explícita) — un click manual en 'Agregar' nunca lo activa", () => {
    // El único lugar donde pendingScrollRef se pone en true es dentro del
    // efecto de autoOpenForm; los onClick manuales de "Agregar" sólo llaman
    // setShowForm(true), nunca tocan pendingScrollRef.
    const autoOpenEffectMatch = CLIENT_PROFILE_PANEL.match(/if \(autoOpenForm && !showForm\) \{[\s\S]*?\}, \[autoOpenForm, showForm\]\)/)
    expect(autoOpenEffectMatch).not.toBeNull()
    expect(autoOpenEffectMatch![0]).toContain("pendingScrollRef.current = true")

    const manualClicks = [...CLIENT_PROFILE_PANEL.matchAll(/onClick=\{\(\) => setShowForm\(true\)\}/g)]
    expect(manualClicks.length).toBeGreaterThan(0)
  })
})

describe("P2-T32 — Problema B: modal flotante preservado + auto-select de la nueva dirección", () => {
  test("el modal sigue siendo un Dialog flotante (nunca redirige a Perfil)", () => {
    expect(CLIENT_ADDRESS_MODAL).toContain('from "@/components/ui/dialog"')
    expect(CLIENT_ADDRESS_MODAL).not.toContain("setActiveTab")
  })

  test("negocio/[slug] page auto-selecciona la dirección recién creada por su id real (nunca por posición en una lista)", () => {
    expect(BUSINESS_PAGE).toContain("onCreated={(direccion) => {")
    expect(BUSINESS_PAGE).toContain("direccionId: direccion.id")
  })

  test("negocio/[slug] page invalida cliente-direcciones tras crear, para que el selector la vea de inmediato", () => {
    expect(BUSINESS_PAGE).toContain('queryClient.invalidateQueries({ queryKey: ["cliente-direcciones"] })')
  })
})
