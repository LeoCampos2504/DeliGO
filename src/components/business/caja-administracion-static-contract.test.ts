import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

// T4 (operator, 2026-11-27) — owner navigation: Caja = Vender · Cajas y turnos · Egresos; Administración =
// Compras · Etiquetas · Proveedores · Resumen. Same components and endpoints; the cart is never lost.
const CAJA = readFileSync(resolve(import.meta.dir, "caja-tab.tsx"), "utf8").replace(/\r\n/g, "\n")
const PANEL = readFileSync(resolve(import.meta.dir, "business-panel.tsx"), "utf8").replace(/\r\n/g, "\n")
const seccion = (src: string, desde: string, hasta: string) => src.slice(src.indexOf(desde), src.indexOf(hasta, src.indexOf(desde)))

describe("T4 — Caja / Administración navigation", () => {
  test("Caja keeps only the cash sub-tabs; Administración holds purchases, labels, suppliers and the summary", () => {
    expect(CAJA).toContain('type CajaSubTab = "vender" | "turnos" | "egresos"')
    expect(CAJA).toContain('type AdministracionSubTab = "compras" | "etiquetas" | "proveedores" | "resumen"')
    const caja = seccion(CAJA, "export function CajaTab(", "\nfunction OwnerSaleRegisterSelector(")
    expect(caja).not.toMatch(/OwnerCompras|OwnerProveedores|EtiquetasPrecioLista|ResumenView/)
    const admin = seccion(CAJA, "export function AdministracionTab(", "\nexport function CajaTab(")
    for (const c of ["<OwnerCompras negocioId={negocio.id} onVerProveedor={(id) => { setProveedorAbrir(id); setSubTab(\"proveedores\") }} />", "<OwnerProveedores key={proveedorAbrir ?? \"lista\"}", "<EtiquetasPrecioLista url={ETIQUETAS_URL_DUENO} esDueno />", "<ResumenView negocioId={negocio.id} onIrAVender={onIrAVender} />"]) expect(admin).toContain(c)
    // Pending counters: same caches on the sub-tabs and on the main menu.
    expect(admin).toContain("`Compras (${pendientes.compras})`")
    expect(admin).toContain("`Etiquetas (${pendientes.etiquetas})`")
    expect(PANEL).toContain('tab.id === "administracion" ? administracionPendientes.total : 0')
  })

  test("«Vender» is never unmounted by a sub-tab or by the Caja ↔ Administración round trip (cart and sale start survive)", () => {
    const caja = seccion(CAJA, "export function CajaTab(", "\nfunction OwnerSaleRegisterSelector(")
    expect(caja).toContain('<div hidden={subTab !== "vender"} data-testid="caja-vender">')
    expect(caja).not.toMatch(/subTab === "vender" \?/)
    expect(PANEL).toContain('key={activeTab === "caja" || activeTab === "administracion" ? "caja-administracion" : activeTab}')
    expect(PANEL).toContain('{(activeTab === "caja" || (activeTab === "administracion" && cajaViva)) && (')
    expect(PANEL).toContain('<div hidden={activeTab !== "caja"}>')
  })

  test("navigation goes through the guarded panel navigation (notifications, ?tab= and Resumen → Vender)", () => {
    expect(PANEL.match(/administracion: "administracion",/g)).toHaveLength(2)
    expect(PANEL).toContain("setIrAVenderToken((t) => t + 1)\n    requestPanelNavigation(\"caja\")")
    expect(PANEL).toContain("<AdministracionTab negocio={negocio} onIrAVender={irAVenderDesdeAdministracion} />")
    // Icon-only main menu below 640 px keeps an accessible name per item.
    expect(PANEL).toContain("aria-label={badgeCount > 0 ? `${tab.label} (${badgeCount})` : tab.label}")
  })
})
