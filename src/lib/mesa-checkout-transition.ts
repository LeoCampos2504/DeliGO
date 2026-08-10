// ============================================
// DeliGO — Transición del modo mesa en el checkout (Tarea 20-CORRECCIÓN-2)
// ============================================
// Lógica pura, sin React/Next, extraída de src/app/n/[slug]/page.tsx y
// src/components/cart/cart-panel.tsx para poder probarla de forma
// determinista (ver mesa-checkout-transition.test.ts) sin renderizar nada.
//
// Motivo: `negocio.salonHabilitado` llega de una query asíncrona — en el
// primer render `negocio` todavía es `undefined`, y puede refetchear en
// cualquier dirección (true->false, false->true) mientras el checkout ya
// está montado. Cualquier estado (`useState`) inicializado UNA sola vez a
// partir de un valor derivado de esa condición quedaría "stale" apenas la
// condición cambia. La solución es nunca guardar una copia — ambos
// consumidores llaman a estas funciones en cada render, así que el
// resultado siempre está al día con el estado actual.

export interface EffectiveMesaInput {
  // `?mesa=N` de la URL del cliente — nunca es autoridad por sí solo.
  mesaNumero: number | null
  // Única fuente de verdad de si el negocio ofrece pedidos de mesa. `false`
  // tanto mientras `negocio` está cargando (undefined) como cuando ya
  // cargó y el Salón está deshabilitado — en ambos casos el resultado debe
  // ser el mismo: ningún comportamiento de mesa para el cliente.
  salonHabilitadoDelNegocio: boolean
  // Mesa seleccionada por un Mozo autenticado — nunca se re-gatea acá
  // porque la sesión de mozo ya exige salonActivo server-side
  // (transitivamente segura).
  mozoSelectedMesaNumero: number | null
  mozoSelectedMesaId: string | null
  // Id resuelto por la query a mesas-public (solo dispara cuando
  // corresponde — ver `shouldFetchCustomerMesaData`).
  customerMesaId: string | null
}

export interface EffectiveMesaResult {
  effectiveMesaNumero: number | null
  effectiveMesaId: string | null
  isEffectiveMesaOrder: boolean
}

// Único cómputo real de comportamiento de mesa de toda la página pública.
export function resolveEffectiveMesa(input: EffectiveMesaInput): EffectiveMesaResult {
  const effectiveMesaNumero =
    (input.salonHabilitadoDelNegocio ? input.mesaNumero : null) ?? input.mozoSelectedMesaNumero ?? null
  const effectiveMesaId =
    input.mozoSelectedMesaId ?? (input.salonHabilitadoDelNegocio ? input.customerMesaId : null) ?? null
  return {
    effectiveMesaNumero,
    effectiveMesaId,
    isEffectiveMesaOrder: !!effectiveMesaNumero,
  }
}

// La consulta a /api/negocio/mesas-public (customerMesaData) nunca debe
// dispararse mientras el negocio todavía está cargando o no tiene Salón.
export function shouldFetchCustomerMesaData(params: {
  mesaNumero: number | null
  slug: string | null
  isAuthenticatedMozo: boolean
  salonHabilitadoDelNegocio: boolean
}): boolean {
  return !!params.mesaNumero && !!params.slug && !params.isAuthenticatedMozo && params.salonHabilitadoDelNegocio
}

// La geocerca pública/panel de cuenta pública (23-B) nunca deben dispararse
// mientras la mesa efectiva no está confirmada.
export function shouldCheckMesaGeofence(params: {
  isEffectiveMesaOrder: boolean
  isAuthenticatedMozo: boolean
  mesaGeofenceReady: boolean
}): boolean {
  return params.isEffectiveMesaOrder && !params.isAuthenticatedMozo && params.mesaGeofenceReady
}

// ---------------------------------------------------------------------------
// CartPanel — método de entrega derivado, nunca una copia stale en estado.
// ---------------------------------------------------------------------------

export type MetodoEntrega = "retiro" | "domicilio" | "mesa"

export function defaultMetodoEntregaManual(ofreceDelivery: boolean): "retiro" | "domicilio" {
  return ofreceDelivery ? "domicilio" : "retiro"
}

// `isMesaOrder` (= !!mesaNumero, recalculado en cada render a partir del
// prop) SIEMPRE gana sobre la elección manual — nunca puede quedar
// "atascado" en mesa ni en retiro/domicilio porque nunca se guarda una
// copia de "mesa" en estado; solo se recuerda la última elección manual
// del usuario para el caso no-mesa (para no perderla si vuelve a esa mesa).
//
// T20-DK1: `ofreceDelivery`/`ofreceRetiro` son opcionales (default `true`,
// el comportamiento histórico de antes de que "retiro" tuviera su propia
// capability) para no romper ningún llamador existente. Cuando la elección
// manual apunta a un canal que dejó de estar habilitado (p. ej. el negocio
// desactivó Retiro mientras el Cliente lo tenía seleccionado), se deriva
// automáticamente el canal que sí sigue disponible — nunca se guarda una
// copia de esa corrección en estado, se recalcula en cada render igual que
// el resto de este archivo.
export function resolveMetodoEntrega(params: {
  isMesaOrder: boolean
  metodoEntregaManual: "retiro" | "domicilio"
  ofreceDelivery?: boolean
  ofreceRetiro?: boolean
}): MetodoEntrega {
  if (params.isMesaOrder) return "mesa"

  const ofreceDelivery = params.ofreceDelivery ?? true
  const ofreceRetiro = params.ofreceRetiro ?? true

  if (params.metodoEntregaManual === "retiro" && ofreceRetiro) return "retiro"
  if (params.metodoEntregaManual === "domicilio" && ofreceDelivery) return "domicilio"

  // La elección manual ya no es válida (su canal se deshabilitó) — cae al
  // otro canal si está disponible. Si ninguno lo está (0 canales, estado que
  // el servidor ya impide alcanzar), se devuelve la elección tal cual: no
  // hay nada válido para derivar.
  if (ofreceDelivery) return "domicilio"
  if (ofreceRetiro) return "retiro"
  return params.metodoEntregaManual
}
