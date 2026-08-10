/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests puros: transición asíncrona del modo mesa (TAREA-20-CORRECCIÓN-2)
// ============================================
// Sin PostgreSQL, sin React, sin DOM — prueba directamente la lógica pura
// extraída de src/app/n/[slug]/page.tsx y src/components/cart/cart-panel.tsx
// (mesa-checkout-transition.ts). Cubre los 15 escenarios pedidos por la
// corrección, numerados explícitamente para trazabilidad con el informe.

import { describe, test, expect } from "bun:test"
import {
  resolveEffectiveMesa,
  shouldFetchCustomerMesaData,
  shouldCheckMesaGeofence,
  resolveMetodoEntrega,
  defaultMetodoEntregaManual,
  type EffectiveMesaInput,
} from "./mesa-checkout-transition"

const base: EffectiveMesaInput = {
  mesaNumero: 3,
  salonHabilitadoDelNegocio: false,
  mozoSelectedMesaNumero: null,
  mozoSelectedMesaId: null,
  customerMesaId: null,
}

describe("1. negocio todavía cargando + URL con mesa", () => {
  test("effectiveMesaNumero es null, isEffectiveMesaOrder es false — nunca se activa nada por adelantado", () => {
    const result = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: false })
    expect(result).toEqual({ effectiveMesaNumero: null, effectiveMesaId: null, isEffectiveMesaOrder: false })
  })
})

describe("2. carga final con Salón true", () => {
  test("effectiveMesaNumero toma el mesaNumero real de la URL", () => {
    const result = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: true })
    expect(result.effectiveMesaNumero).toBe(3)
    expect(result.isEffectiveMesaOrder).toBe(true)
  })
})

describe("3. carga final con Salón false", () => {
  test("effectiveMesaNumero queda en null aunque la URL traiga ?mesa=N", () => {
    const result = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: false })
    expect(result.effectiveMesaNumero).toBeNull()
    expect(result.isEffectiveMesaOrder).toBe(false)
  })
})

describe("4. refetch: false -> true", () => {
  test("la misma mesaNumero pasa de invisible a efectiva sin necesidad de recargar la página", () => {
    const antes = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: false })
    const despues = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: true })
    expect(antes.isEffectiveMesaOrder).toBe(false)
    expect(despues.isEffectiveMesaOrder).toBe(true)
    expect(despues.effectiveMesaNumero).toBe(3)
  })
})

describe("5. refetch: true -> false", () => {
  test("una mesa efectiva deja de serlo de inmediato si el Salón se desactiva mientras el checkout está abierto", () => {
    const antes = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: true })
    const despues = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: false })
    expect(antes.effectiveMesaNumero).toBe(3)
    expect(despues.effectiveMesaNumero).toBeNull()
  })

  test("el método de entrega derivado nunca se queda 'atascado' en mesa — CartPanel lo recalcula, no lo guarda", () => {
    const metodoAntes = resolveMetodoEntrega({ isMesaOrder: true, metodoEntregaManual: "retiro" })
    const metodoDespues = resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "retiro" })
    expect(metodoAntes).toBe("mesa")
    expect(metodoDespues).toBe("retiro") // nunca sigue en "mesa"
  })
})

describe("6. cambio de slug (negocio A con Salón, negocio B sin Salón)", () => {
  test("defaultMetodoEntregaManual depende solo del negocio actual (ofreceDelivery) — dos negocios nunca comparten resultado por accidente", () => {
    const negocioA = defaultMetodoEntregaManual(true) // ofrece delivery
    const negocioB = defaultMetodoEntregaManual(false) // no ofrece delivery
    expect(negocioA).toBe("domicilio")
    expect(negocioB).toBe("retiro")
  })

  test("effectiveMesaNumero de un negocio no se filtra al computar el de otro (cada llamada es independiente, sin estado compartido)", () => {
    const negocioAConSalon = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: true, mesaNumero: 7 })
    const negocioBSinSalon = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: false, mesaNumero: 7 })
    expect(negocioAConSalon.effectiveMesaNumero).toBe(7)
    expect(negocioBSinSalon.effectiveMesaNumero).toBeNull()
  })
})

describe("7. cambio de mesa (?mesa=1 -> ?mesa=2) con Salón ya confirmado", () => {
  test("isEffectiveMesaOrder se mantiene true durante todo el cambio — nunca pasa por false en el medio", () => {
    const mesa1 = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: true, mesaNumero: 1 })
    const mesa2 = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: true, mesaNumero: 2 })
    expect(mesa1.isEffectiveMesaOrder).toBe(true)
    expect(mesa2.isEffectiveMesaOrder).toBe(true)
    expect(mesa1.effectiveMesaNumero).toBe(1)
    expect(mesa2.effectiveMesaNumero).toBe(2)
  })
})

describe("8. método mesa eliminado al deshabilitar Salón", () => {
  test("resolveMetodoEntrega nunca devuelve 'mesa' si isMesaOrder es false, sea cual sea la elección manual previa", () => {
    expect(resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "retiro" })).not.toBe("mesa")
    expect(resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "domicilio" })).not.toBe("mesa")
  })
})

describe("9. productos preservados durante cualquier transición", () => {
  test("ninguna función de transición referencia ni puede tocar el carrito — no reciben ni devuelven items", () => {
    // Verificación estructural: las firmas de estas funciones no incluyen
    // ningún parámetro ni campo relacionado con items/carrito — la
    // preservación del carrito es una consecuencia directa de que estas
    // funciones son puras sobre datos de mesa/negocio únicamente (el
    // carrito vive en el store de Zustand, nunca se deriva de esto).
    const result = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: true })
    expect(Object.keys(result).sort()).toEqual(["effectiveMesaId", "effectiveMesaNumero", "isEffectiveMesaOrder"])
  })
})

describe("10. delivery/retiro disponibles cuando no es pedido de mesa", () => {
  test("metodoEntregaManual (retiro/domicilio) siempre queda disponible como resultado cuando isMesaOrder es false", () => {
    expect(resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "retiro" })).toBe("retiro")
    expect(resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "domicilio" })).toBe("domicilio")
  })
})

describe("11. sin geocerca durante estado desconocido (negocio cargando)", () => {
  test("shouldCheckMesaGeofence es false mientras isEffectiveMesaOrder es false", () => {
    expect(
      shouldCheckMesaGeofence({ isEffectiveMesaOrder: false, isAuthenticatedMozo: false, mesaGeofenceReady: true })
    ).toBe(false)
  })

  test("shouldCheckMesaGeofence es true solo cuando los 3 factores coinciden", () => {
    expect(
      shouldCheckMesaGeofence({ isEffectiveMesaOrder: true, isAuthenticatedMozo: false, mesaGeofenceReady: true })
    ).toBe(true)
    expect(
      shouldCheckMesaGeofence({ isEffectiveMesaOrder: true, isAuthenticatedMozo: true, mesaGeofenceReady: true })
    ).toBe(false) // mozo nunca pasa por geocerca de cliente
    expect(
      shouldCheckMesaGeofence({ isEffectiveMesaOrder: true, isAuthenticatedMozo: false, mesaGeofenceReady: false })
    ).toBe(false) // negocio sin calibrar
  })
})

describe("12. sin consulta de cuenta pública durante estado desconocido", () => {
  test("el gate de <MesaClienteCuentaPanel> (isEffectiveMesaOrder && effectiveMesaNumero) es false mientras el negocio carga", () => {
    const { isEffectiveMesaOrder, effectiveMesaNumero } = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: false })
    expect(isEffectiveMesaOrder && !!effectiveMesaNumero).toBe(false)
  })
})

describe("13. sin consulta de mesas-public durante estado desconocido", () => {
  test("shouldFetchCustomerMesaData es false mientras salonHabilitadoDelNegocio es false (negocio cargando o sin Salón)", () => {
    expect(
      shouldFetchCustomerMesaData({ mesaNumero: 3, slug: "negocio-x", isAuthenticatedMozo: false, salonHabilitadoDelNegocio: false })
    ).toBe(false)
  })

  test("shouldFetchCustomerMesaData es true solo con los 4 factores en regla", () => {
    expect(
      shouldFetchCustomerMesaData({ mesaNumero: 3, slug: "negocio-x", isAuthenticatedMozo: false, salonHabilitadoDelNegocio: true })
    ).toBe(true)
    expect(
      shouldFetchCustomerMesaData({ mesaNumero: null, slug: "negocio-x", isAuthenticatedMozo: false, salonHabilitadoDelNegocio: true })
    ).toBe(false)
    expect(
      shouldFetchCustomerMesaData({ mesaNumero: 3, slug: null, isAuthenticatedMozo: false, salonHabilitadoDelNegocio: true })
    ).toBe(false)
    expect(
      shouldFetchCustomerMesaData({ mesaNumero: 3, slug: "negocio-x", isAuthenticatedMozo: true, salonHabilitadoDelNegocio: true })
    ).toBe(false)
  })
})

describe("14. sin payload de mesa antes de confirmar la capacidad del negocio", () => {
  test("pipeline completo (resolveEffectiveMesa -> CartPanel -> resolveMetodoEntrega) nunca produce 'mesa' mientras el negocio está cargando", () => {
    const { effectiveMesaNumero } = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: false })
    const isMesaOrderEnCartPanel = !!effectiveMesaNumero // mismo cómputo que hace CartPanel con el prop mesaNumero
    const metodoEntrega = resolveMetodoEntrega({ isMesaOrder: isMesaOrderEnCartPanel, metodoEntregaManual: "retiro" })
    expect(metodoEntrega).not.toBe("mesa")
  })
})

describe("15. negocio con Salón termina correctamente en modo mesa", () => {
  test("pipeline completo: cargando -> Salón confirmado true -> CartPanel entra en modo mesa", () => {
    const cargando = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: false })
    expect(cargando.isEffectiveMesaOrder).toBe(false)

    const cargado = resolveEffectiveMesa({ ...base, salonHabilitadoDelNegocio: true })
    expect(cargado.isEffectiveMesaOrder).toBe(true)

    const isMesaOrderEnCartPanel = !!cargado.effectiveMesaNumero
    const metodoEntrega = resolveMetodoEntrega({ isMesaOrder: isMesaOrderEnCartPanel, metodoEntregaManual: "retiro" })
    expect(metodoEntrega).toBe("mesa")
  })
})

describe("Casos adicionales — mozo autenticado (transitividad, no re-gateado por salonHabilitadoDelNegocio)", () => {
  test("mozoSelectedMesaNumero cuenta como mesa efectiva incluso con salonHabilitadoDelNegocio false (la sesión de mozo ya exige Salón server-side)", () => {
    const result = resolveEffectiveMesa({
      mesaNumero: null,
      salonHabilitadoDelNegocio: false,
      mozoSelectedMesaNumero: 9,
      mozoSelectedMesaId: "mesa-9",
      customerMesaId: null,
    })
    expect(result.effectiveMesaNumero).toBe(9)
    expect(result.effectiveMesaId).toBe("mesa-9")
    expect(result.isEffectiveMesaOrder).toBe(true)
  })
})

describe("16. T20-DK1 — resolveMetodoEntrega con capability de Retiro independiente", () => {
  test("sin ofreceDelivery/ofreceRetiro (llamadores viejos): se comporta exactamente igual que antes — ambos canales disponibles", () => {
    expect(resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "retiro" })).toBe("retiro")
    expect(resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "domicilio" })).toBe("domicilio")
  })

  test("Solo retiro (delivery OFF, retiro ON): domicilio manual nunca es válido, retiro siempre lo es", () => {
    expect(
      resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "retiro", ofreceDelivery: false, ofreceRetiro: true })
    ).toBe("retiro")
    expect(
      resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "domicilio", ofreceDelivery: false, ofreceRetiro: true })
    ).toBe("retiro") // elección manual stale (domicilio ya no existe para este negocio) — cae a retiro
  })

  test("Delivery + retiro (ambos ON): honra la elección manual tal cual, sin forzar ningún canal", () => {
    expect(
      resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "retiro", ofreceDelivery: true, ofreceRetiro: true })
    ).toBe("retiro")
    expect(
      resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "domicilio", ofreceDelivery: true, ofreceRetiro: true })
    ).toBe("domicilio")
  })

  test("Solo delivery (delivery ON, retiro OFF): siempre domicilio, incluso si la elección manual quedó en retiro", () => {
    expect(
      resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "domicilio", ofreceDelivery: true, ofreceRetiro: false })
    ).toBe("domicilio")
    expect(
      resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "retiro", ofreceDelivery: true, ofreceRetiro: false })
    ).toBe("domicilio") // nunca devuelve "retiro" — Retiro está deshabilitado para este negocio
  })

  test("isMesaOrder siempre gana, sin importar las capabilities de retiro/delivery", () => {
    expect(
      resolveMetodoEntrega({ isMesaOrder: true, metodoEntregaManual: "retiro", ofreceDelivery: true, ofreceRetiro: false })
    ).toBe("mesa")
  })

  test("cambio dinámico: manual retiro + Retiro pasa a OFF -> domicilio (si Delivery sigue ON)", () => {
    const antes = resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "retiro", ofreceDelivery: true, ofreceRetiro: true })
    const despues = resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "retiro", ofreceDelivery: true, ofreceRetiro: false })
    expect(antes).toBe("retiro")
    expect(despues).toBe("domicilio")
  })

  test("cambio dinámico: manual domicilio + Delivery pasa a OFF -> retiro (si Retiro sigue ON)", () => {
    const antes = resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "domicilio", ofreceDelivery: true, ofreceRetiro: true })
    const despues = resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "domicilio", ofreceDelivery: false, ofreceRetiro: true })
    expect(antes).toBe("domicilio")
    expect(despues).toBe("retiro")
  })

  test("0 canales no-mesa (delivery OFF + retiro OFF, estado que el servidor ya impide alcanzar): no explota, devuelve la elección manual tal cual", () => {
    expect(
      resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "retiro", ofreceDelivery: false, ofreceRetiro: false })
    ).toBe("retiro")
    expect(
      resolveMetodoEntrega({ isMesaOrder: false, metodoEntregaManual: "domicilio", ofreceDelivery: false, ofreceRetiro: false })
    ).toBe("domicilio")
  })
})
