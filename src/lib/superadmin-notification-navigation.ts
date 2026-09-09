// P2-T26-R2 §20-21: resolves where a SuperAdmin notification click should
// navigate, tolerating BOTH the legacy `datos` shape used by the two
// pre-existing review_moderation notifications
// ({navigateTo:{superadmin:"tab"}}, src/lib/review-moderation-notifications.ts
// — left untouched) and the flatter shape used by every notification type
// added in this task ({navigateTo:"tab", entityId:"..."}). Historical rows
// are never migrated — this resolver is the tolerant reader, not a writer.
//
// Never throws: malformed/unknown `datos` (bad JSON, unrecognized tab, wrong
// types) falls back to a known-safe tab instead of crashing the bell's click
// handler or leaving it on a blank/404 tab (P2-T26-R1 §20 requirement).

const KNOWN_TABS = new Set([
  "overview",
  "pendientes",
  "activos",
  "promocionados",
  "solicitudes-destacado",
  "moderacion-resenas",
  "alertas",
  "deudas",
  "configuracion",
  "denuncias",
])

const FALLBACK_TAB = "overview"

export interface SuperadminNotificationTarget {
  tab: string
  entityId?: string
}

export function resolveSuperadminNotificationTarget(datosRaw: string): SuperadminNotificationTarget {
  let datos: Record<string, unknown> = {}
  try {
    const parsed: unknown = JSON.parse(datosRaw)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      datos = parsed as Record<string, unknown>
    }
  } catch {
    // datos malformado — se resuelve con el fallback de abajo, nunca se lanza.
  }

  const legacyNavigateTo = datos.navigateTo as { superadmin?: unknown } | undefined
  const rawTab = typeof datos.navigateTo === "string" ? datos.navigateTo : legacyNavigateTo?.superadmin
  const tab = typeof rawTab === "string" && KNOWN_TABS.has(rawTab) ? rawTab : FALLBACK_TAB

  const entityIdCandidate = datos.entityId ?? datos.solicitudId ?? datos.negocioId ?? datos.denunciaId
  const entityId = typeof entityIdCandidate === "string" ? entityIdCandidate : undefined

  return { tab, entityId }
}
