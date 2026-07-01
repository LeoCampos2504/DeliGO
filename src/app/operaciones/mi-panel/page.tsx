// DeliGO Operaciones — Panel personal (home). Operaciones-1D.
// Reutiliza EXACTAMENTE el mismo componente del flujo personal moderno de Mozo
// (sin duplicar lógica, fetch ni autorización). La navegación se deriva del
// pathname vía `useOperativoNav`: bajo /operaciones/mi-panel usa login
// /operaciones/ingresar y redirige si no hay sesión personal. Usa solo el
// contrato personal (/api/operativo + deligo_operativo_session).
export { default } from "@/app/mozo/page"
