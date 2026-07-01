// DeliGO Operaciones — Pedido manual de mesa (personal). Operaciones-1D.
// Reutiliza el mismo componente que /mozo/panel/[slug]/pedido/[mesaId] (mismos
// params y mismas APIs /api/operativo). La navegación se deriva del pathname
// vía `useOperativoNav`. No usa token legacy, mozoToken ni /m/[token].
export { default } from "@/app/mozo/panel/[slug]/pedido/[mesaId]/page"
