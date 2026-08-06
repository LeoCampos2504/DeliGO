// ============================================
// DeliGO — Bandera central de impresión de cuentas (P3-PARK)
// ============================================
// Módulo pequeño, puro y client-safe. Controla ÚNICAMENTE si se muestra la
// impresión ESTÁNDAR del navegador (`window.print()`) para la cuenta de
// mesa (P2, `MesaCuentaDialog`) — nunca activa WebUSB/Web Serial/impresión
// directa. Toda la infraestructura de P3-A (`src/lib/thermal-print/*`) y
// P3-B1 (transporte WebUSB experimental) permanece intacta y sin cambios;
// esta bandera no la toca en absoluto, solo decide si el botón de
// impresión estándar existe en el DOM de `MesaCuentaDialog`.
//
// Nunca usa `window`/`navigator`, nunca falla en SSR (no depende de ningún
// objeto del navegador), nunca accede a la base de datos, nunca importa
// React. Default seguro: DESHABILITADO.
//
// No es un sistema general de feature flags — es deliberadamente mínimo y
// específico a esta única decisión de producto (ver CODEX_REPORT.md,
// sección de arquitectura futura, para la evolución planeada: bandera
// global -> preferencia por negocio -> impresión directa experimental).

/**
 * Regla estricta y determinista: únicamente el string exacto `"true"`
 * habilita la impresión — cualquier otro valor (`undefined`, `""`,
 * `"false"`, `"TRUE"`, `"True"`, `"1"`, `"yes"`, `" true "` con espacios,
 * o cualquier otra cadena) devuelve `false`. Nunca se hace `trim()`, nunca
 * se hace `toLowerCase()`, nunca se acepta un valor "parecido" — cualquier
 * ambigüedad se resuelve siempre hacia el lado seguro (deshabilitado).
 */
export function isAccountPrintingEnabled(value?: string): boolean {
  return value === "true"
}

/**
 * Constante client-safe, calculada una sola vez a partir de la variable
 * pública de Next.js `NEXT_PUBLIC_ENABLE_ACCOUNT_PRINTING`. Las variables
 * `NEXT_PUBLIC_*` se inyectan en tiempo de build y quedan disponibles tanto
 * en servidor como en cliente sin necesitar ningún objeto del navegador —
 * cambiar su valor requiere rebuild/redeploy, nunca es dinámica en runtime.
 *
 * Variable de entorno (documentada acá porque el repositorio no tiene
 * ningún `.env.example`/`.env.sample` trackeado — ver CODEX_REPORT.md,
 * sección de template de entorno):
 *   NEXT_PUBLIC_ENABLE_ACCOUNT_PRINTING=false   (default seguro)
 *   NEXT_PUBLIC_ENABLE_ACCOUNT_PRINTING=true    (habilita SOLO window.print())
 * Nunca habilita WebUSB, Web Serial, selección de impresora ni ningún
 * permiso de hardware.
 */
export const ACCOUNT_PRINTING_ENABLED = isAccountPrintingEnabled(process.env.NEXT_PUBLIC_ENABLE_ACCOUNT_PRINTING)
