// ============================================
// DeliGO — Ticket térmico (P3-A: modelo puro)
// ============================================
// Modelo serializable e independiente de React/Prisma/DOM — representa
// exactamente lo que un ticket térmico necesita imprimir, nunca el HTML del
// diálogo de cuenta (`MesaCuentaDialog`) ni las respuestas crudas de la API.
// Nunca incluye tokens, cookies, IDs de sesión/ocupación, hashes,
// credenciales, negocioId, empleadoId, IP ni coordenadas — solo datos que ya
// son visibles en la vista previa/impresión estándar existente
// (`window.print()`, sin cambios en esta etapa).

/** Nombre del negocio tal como ya lo devuelve el endpoint de cuenta. */
export interface ThermalTicketNegocio {
  nombre: string
}

/** Número de mesa visible — nunca el id interno de `Mesa`. */
export interface ThermalTicketMesa {
  numero: number
}

/**
 * Fechas en ISO 8601 (mismo formato que ya devuelve el endpoint) — el
 * generador de texto/ESC-POS decide cómo formatearlas para impresión, este
 * modelo no las formatea. `cerradaEn` es `null` mientras la ocupación sigue
 * activa.
 */
export interface ThermalTicketOcupacion {
  iniciadaEn: string
  cerradaEn: string | null
  estado: "activa" | "cerrada"
}

/**
 * Línea de producto ya resuelta — nunca un id de `Pedido`/`PedidoItem`, nunca
 * `undefined` como texto visible. Los arreglos son siempre arreglos (vacíos
 * si no aplica), nunca `undefined`.
 */
export interface ThermalTicketItem {
  cantidad: number
  nombre: string
  /** Subtotal de línea ya calculado (informativo — nunca el total autoritativo). */
  subtotal: number
  agregados: string[]
  secciones: string[]
  ingredientesQuitados: string[]
  talle: string
  color: string
}

/**
 * Un pedido dentro del ticket. `numero` es el correlativo DENTRO de este
 * ticket (1, 2, 3…) — nunca el id real del pedido. `cancelado` y `pendiente`
 * son mutuamente excluyentes con la inclusión en el total (ver
 * `mesa-account-ticket.ts`): un pedido cancelado nunca suma, uno pendiente
 * solo aparece en la vista previa de una cuenta todavía activa.
 */
export interface ThermalTicketPedido {
  numero: number
  fecha: string
  cancelado: boolean
  pendiente: boolean
  items: ThermalTicketItem[]
  /**
   * Subtotal ya normalizado tal como lo muestra la cuenta actual: 0 si
   * `cancelado` es `true` (mismo criterio que `MesaCuentaDialog`), el
   * `Pedido.total` autoritativo en cualquier otro caso. Nunca se recalcula
   * a partir de los ítems.
   */
  subtotal: number
}

/**
 * Leyenda final del ticket — exactamente los dos estados reales que ya
 * muestra `MesaCuentaDialog` ("Vista previa — todavía no se cerró la
 * cuenta" / "Cuenta cerrada"). Nunca se inventa un tercer estado.
 */
export type ThermalTicketLeyenda = "vista_previa" | "cuenta_cerrada"

export interface ThermalTicket {
  negocio: ThermalTicketNegocio
  mesa: ThermalTicketMesa
  ocupacion: ThermalTicketOcupacion
  pedidos: ThermalTicketPedido[]
  /** Total autoritativo recibido del servidor — nunca recalculado acá. */
  totalGeneral: number
  leyenda: ThermalTicketLeyenda
}

// ---------------------------------------------------------------------------
// Perfil de papel / impresora (P3-A, sección 7)
// ---------------------------------------------------------------------------
// Valores de referencia, NUNCA una garantía universal — la cantidad real de
// columnas que entran en una línea depende de la fuente configurada, la
// densidad de impresión, el modelo de impresora, el firmware y el modo de
// caracteres activo. Estos perfiles son puntos de partida razonables, no
// una promesa de compatibilidad física (ver CODEX_REPORT.md, sección de
// riesgos).

export type ThermalCutStrategy = "none" | "full" | "partial"

/** Única estrategia implementada en P3-A: transliteración a ASCII seguro (ver `text-layout.ts`). */
export type ThermalUnsupportedCharStrategy = "transliterate-ascii"

/** Único encoder implementado en P3-A — deliberadamente no se afirma soporte UTF-8 real de impresora. */
export type ThermalEncodingStrategy = "ascii-safe"

export interface ThermalPaperProfile {
  id: string
  nombre: string
  /** Ancho aproximado en mm — solo referencia, no una medida física verificada por hardware. */
  anchoMm: number
  /** Columnas monoespaciadas asumidas para este perfil — ver advertencia arriba. */
  columnas: number
  /** Avances de línea antes de un eventual corte. */
  saltosAntesDeCorte: number
  corte: ThermalCutStrategy
  estrategiaCaracteresNoSoportados: ThermalUnsupportedCharStrategy
  encoding: ThermalEncodingStrategy
}
