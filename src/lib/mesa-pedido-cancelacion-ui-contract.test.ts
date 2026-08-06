/// <reference types="bun-types" />
// ============================================
// DeliGO — Test contractual: integración de 23-A2 en las cuatro superficies
// ============================================
// Auditoría estática combinada con revisión estructural real (sección 24 del
// prompt 23-A2) — no es "solo grep frágil": combina (a) que el módulo
// compartido apunte al endpoint/patrón correctos (ya probado en detalle por
// mesa-pedido-cancelacion-client.test.ts), (b) que cada superficie real
// importe/use el componente/drawer compartido, y (c) que NINGÚN archivo de
// superficie contenga una implementación de fetch duplicada/legacy hacia el
// endpoint de cancelación — la única cadena literal del endpoint en toda la
// UI vive en un solo lugar: mesa-pedido-cancelacion-client.ts.

import { describe, test, expect } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

const ROOT = process.cwd()
function read(relPath: string): string {
  return readFileSync(join(ROOT, ...relPath.split("/")), "utf-8")
}

const ENDPOINT_LITERAL = "/api/operaciones/pedidos/"
const CANCEL_SUFFIX = "/cancelar"

const CLIENT_MODULE = "src/lib/mesa-pedido-cancelacion-client.ts"
const SHARED_DIALOG = "src/components/operativo/cancelar-pedido-mesa-dialog.tsx"
const SHARED_DRAWER = "src/components/operativo/pedido-detalle.tsx"

const SURFACES = {
  mozo: "src/app/mozo/panel/[slug]/page.tsx",
  salonPersonal: "src/app/operaciones/mi-panel/[slug]/salon/page.tsx",
  salonTerminal: "src/app/operaciones/salon/page.tsx",
  negocioAdmin: "src/components/business/salon-tab.tsx",
} as const

// Archivos de UI que SÍ pueden/deben tocar el dominio de cancelación de
// mesa, para acotar la búsqueda de "implementación duplicada" a lo real.
const ALL_RELEVANT_UI_FILES = [CLIENT_MODULE, SHARED_DIALOG, SHARED_DRAWER, ...Object.values(SURFACES)]

describe("23-A2 — contrato de integración: módulo compartido", () => {
  test("el endpoint 23-A1 completo aparece EXACTAMENTE una vez en toda la UI relevante: en el cliente compartido", () => {
    const withEndpoint = ALL_RELEVANT_UI_FILES.filter((f) => {
      const src = read(f)
      return src.includes(ENDPOINT_LITERAL) && src.includes(CANCEL_SUFFIX)
    })
    expect(withEndpoint).toEqual([CLIENT_MODULE])
  })

  test("el diálogo compartido importa el request desde el cliente compartido (nunca hace su propio fetch al endpoint)", () => {
    const dialogSrc = read(SHARED_DIALOG)
    expect(dialogSrc).toContain('from "@/lib/mesa-pedido-cancelacion-client"')
    expect(dialogSrc).toContain("cancelarPedidoMesaRequest")
    expect(dialogSrc).not.toMatch(/fetch\(\s*[`'"]\/api\/operaciones\/pedidos/)
  })

  test("el body armado por el cliente compartido nunca incluye campos de autoridad hardcodeados", () => {
    // Se busca el patrón FUNCIONAL de asignación de un campo (`campo:` como
    // clave de objeto/propiedad), no la palabra suelta — el propio archivo
    // menciona "negocioId" en un comentario explicando justamente que nunca
    // se envía, lo cual sería un falso positivo para un grep de texto plano.
    const clientSrc = read(CLIENT_MODULE)
    for (const forbidden of ["negocioId:", "mesaId:", "ocupacionMesaId:", "empleadoId:", "terminalId:", "cuentaOperativaId:", "userType:", "rol:"]) {
      expect(clientSrc).not.toContain(forbidden)
    }
    // El único objeto literal enviado como body es `{ motivo }`.
    expect(clientSrc).toContain("body: JSON.stringify({ motivo })")
  })
})

describe("23-A2 — contrato de integración: las cuatro superficies", () => {
  test("Mozo: integra la acción vía el drawer compartido (cancelarPedido prop)", () => {
    const src = read(SURFACES.mozo)
    expect(src).toContain("PedidoDetalleDrawer")
    expect(src).toMatch(/cancelarPedido=\{\{/)
    // Nunca implementa su propio fetch al endpoint de cancelación.
    expect(src).not.toMatch(/fetch\(\s*[`'"]\/api\/operaciones\/pedidos/)
  })

  test("Salón personal: integra la acción vía el mismo drawer compartido que Mozo", () => {
    const src = read(SURFACES.salonPersonal)
    expect(src).toContain("PedidoDetalleDrawer")
    expect(src).toMatch(/cancelarPedido=\{\{/)
    expect(src).not.toMatch(/fetch\(\s*[`'"]\/api\/operaciones\/pedidos/)
  })

  test("Salón terminal: integra el componente compartido directamente (superficie propia, sin drawer compartido)", () => {
    const src = read(SURFACES.salonTerminal)
    expect(src).toContain('import { CancelarPedidoMesaDialog } from "@/components/operativo/cancelar-pedido-mesa-dialog"')
    expect(src).toContain("<CancelarPedidoMesaDialog")
    expect(src).not.toMatch(/fetch\(\s*[`'"]\/api\/operaciones\/pedidos/)
  })

  test("Negocio/admin: integra el componente compartido directamente, nunca vía /api/superadmin", () => {
    const src = read(SURFACES.negocioAdmin)
    expect(src).toContain('import { CancelarPedidoMesaDialog } from "@/components/operativo/cancelar-pedido-mesa-dialog"')
    expect(src).toContain("<CancelarPedidoMesaDialog")
    expect(src).not.toContain("/api/superadmin")
    expect(src).not.toMatch(/fetch\(\s*[`'"]\/api\/operaciones\/pedidos/)
  })

  test("ninguna de las cuatro superficies pasa negocioId/rol/mesaId/ocupacionMesaId al componente compartido", () => {
    for (const [, file] of Object.entries(SURFACES)) {
      const src = read(file)
      // Busca específicamente props pasadas AL COMPONENTE, no cualquier
      // mención de esas palabras en otras partes del archivo (que sí las
      // usan legítimamente para otras funciones ajenas a 23-A2).
      const dialogUsages = src.match(/<CancelarPedidoMesaDialog[\s\S]*?\/>/g) ?? []
      const drawerCancelarPedidoBlocks = src.match(/cancelarPedido=\{\{[\s\S]*?\}\}/g) ?? []
      for (const block of [...dialogUsages, ...drawerCancelarPedidoBlocks]) {
        for (const forbidden of ["negocioId=", "mesaId=", "ocupacionMesaId=", "rol=", "userType=", "empleadoId="]) {
          expect(block).not.toContain(forbidden)
        }
      }
    }
  })
})

describe("23-A2 — contrato de identidad: el drawer compartido nunca ofrece la acción a PyR", () => {
  test("PyR reutiliza PedidoDetalleDrawer pero NUNCA pasa `cancelarPedido` (23-A1 no autoriza a PyR a cancelar mesa)", () => {
    const pyrSrc = read("src/app/operaciones/mi-panel/[slug]/pyr/pedidos/page.tsx")
    expect(pyrSrc).toContain("PedidoDetalleDrawer")
    expect(pyrSrc).not.toMatch(/cancelarPedido=\{\{/)
  })

  test("el prop `cancelarPedido` del drawer compartido es opcional (no rompe a PyR ni a ningún otro llamador que no lo pase)", () => {
    const drawerSrc = read(SHARED_DRAWER)
    expect(drawerSrc).toMatch(/cancelarPedido\?:/)
  })
})
