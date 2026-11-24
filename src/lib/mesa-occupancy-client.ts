"use client"

// ============================================
// DeliGO — Cliente compartido de ocupación de mesa (P0-D.3B)
// ============================================
// Lógica pura de fetch/clasificación para el endpoint canónico
// GET|POST /api/operaciones/mesas/[id]/ocupacion (P0-D.3A). Sin React, sin
// estado propio: cada llamador (componente) mantiene su propio estado.
// No abre ocupaciones, no toca pedidos/pagos/tickets — solo consulta y
// cierra una ocupación técnica existente. No duplicar este fetch en cada
// superficie (Negocio/Salón/Mozo); todas deben reusar este módulo.

// BUG-002: familia de sesión con la que la PANTALLA consulta (la fija cada host, nunca el usuario). El servidor
// valida sólo la credencial de esa familia; sin ella se mantiene el comportamiento anterior.
export type MesaOccupancyActorFamily = "negocio" | "cuenta_operativa" | "terminal"

function urlOcupacion(mesaId: string, actorFamily?: MesaOccupancyActorFamily) {
  return `/api/operaciones/mesas/${mesaId}/ocupacion${actorFamily ? `?actorFamily=${actorFamily}` : ""}`
}

export interface MesaOccupancyInfo {
  id: string
  startedAt: string
  lastActivityAt: string
}

export type MesaOccupancyStatusOutcome =
  | { kind: "active"; occupancy: MesaOccupancyInfo }
  // P2 corrección (Bloqueo 4): `lastClosedOcupacionId` es el id de la
  // última ocupación cerrada de esta mesa, si existe — permite a la UI
  // ofrecer reabrir/reimprimir ese ticket cerrado (GET .../cuenta acepta
  // ocupaciones cerradas). `null` si esta mesa nunca tuvo una ocupación
  // cerrada, o si el negocio/mesa no tiene ninguna registrada todavía.
  | { kind: "none"; lastClosedOcupacionId: string | null }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  // BUG-002: 404 (mesa inexistente o de otro negocio) y 409 (estado inconsistente) ya no se confunden con un error.
  | { kind: "not_found" }
  | { kind: "conflict" }
  | { kind: "error" }

export async function fetchMesaOccupancyStatus(
  mesaId: string,
  signal?: AbortSignal,
  actorFamily?: MesaOccupancyActorFamily
): Promise<MesaOccupancyStatusOutcome> {
  let res: Response
  try {
    res = await fetch(urlOcupacion(mesaId, actorFamily), { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error
    return { kind: "error" }
  }

  if (res.status === 401) return { kind: "unauthorized" }
  if (res.status === 403) return { kind: "forbidden" }
  if (res.status === 404) return { kind: "not_found" }
  if (res.status === 409) return { kind: "conflict" }
  if (!res.ok) return { kind: "error" }

  const data = await res.json().catch(() => null)
  if (!data || typeof data !== "object") return { kind: "error" }

  if (
    (data as Record<string, unknown>).hasActiveOccupancy &&
    (data as Record<string, unknown>).occupancy &&
    typeof ((data as Record<string, unknown>).occupancy as Record<string, unknown>).id === "string"
  ) {
    const occupancy = (data as Record<string, unknown>).occupancy as Record<string, unknown>
    return {
      kind: "active",
      occupancy: {
        id: occupancy.id as string,
        startedAt: typeof occupancy.startedAt === "string" ? occupancy.startedAt : "",
        lastActivityAt: typeof occupancy.lastActivityAt === "string" ? occupancy.lastActivityAt : "",
      },
    }
  }

  const lastClosedOcupacionId =
    typeof (data as Record<string, unknown>).lastClosedOcupacionId === "string"
      ? ((data as Record<string, unknown>).lastClosedOcupacionId as string)
      : null

  return { kind: "none", lastClosedOcupacionId }
}

export type MesaOccupancyCloseOutcome =
  | { kind: "closed" }
  | { kind: "no_active" }
  | { kind: "changed" }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "bad_request" }
  | { kind: "error" }

// Revalidación obligatoria: SIEMPRE vuelve a consultar el GET canónico antes
// de cerrar y usa exclusivamente el `occupancy.id` de esa respuesta fresca
// como `expectedOcupacionId`. Nunca acepta un id externo/cacheado/antiguo.
export async function closeMesaOccupancyWithRevalidation(
  mesaId: string,
  actorFamily?: MesaOccupancyActorFamily
): Promise<MesaOccupancyCloseOutcome> {
  const status = await fetchMesaOccupancyStatus(mesaId, undefined, actorFamily)
  if (status.kind === "unauthorized") return { kind: "unauthorized" }
  if (status.kind === "forbidden") return { kind: "forbidden" }
  if (status.kind === "conflict") return { kind: "changed" }
  if (status.kind === "error" || status.kind === "not_found") return { kind: "error" }
  if (status.kind === "none") return { kind: "no_active" }

  try {
    const res = await fetch(urlOcupacion(mesaId, actorFamily), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedOcupacionId: status.occupancy.id }),
    })

    if (res.status === 401) return { kind: "unauthorized" }
    if (res.status === 403) return { kind: "forbidden" }
    if (res.status === 400) return { kind: "bad_request" }
    if (res.status === 409) return { kind: "changed" }

    const data = await res.json().catch(() => null)
    if (
      res.ok &&
      data &&
      typeof data === "object" &&
      (data as Record<string, unknown>).success === true &&
      ((data as Record<string, unknown>).status === "closed" || (data as Record<string, unknown>).status === "no_active")
    ) {
      return (data as Record<string, unknown>).status === "closed" ? { kind: "closed" } : { kind: "no_active" }
    }

    return { kind: "error" }
  } catch {
    return { kind: "error" }
  }
}
