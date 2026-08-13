// OBSERVABILITY + LOAD/PERFORMANCE CERTIFICATION — target hard gate
// ============================================
// Módulo ESM puro (sin imports de Node ni de k6) para poder ser importado
// tanto por el orquestador Bun/TS (runner/orchestrate.ts) como por los
// scripts k6 (k6/scenarios/*.js) — un único lugar de verdad para la URL
// permitida. Nunca apunta a producción ni a `main`.

export const TARGET_URL = "https://deligo-copy-production.up.railway.app"

/** Lanza si `url` no es EXACTAMENTE el target de certificación permitido. */
export function assertAllowedTarget(url) {
  if (url !== TARGET_URL) {
    throw new Error(
      `TARGET_HARD_GATE: target no permitido para esta certificación: "${url}". Único target autorizado: "${TARGET_URL}".`
    )
  }
  return url
}
