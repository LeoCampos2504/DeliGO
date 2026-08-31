export type SharedOptionItem = {
  nombre: string
  precio: number
}

type SharedOptionPayload = {
  opciones?: unknown
  obligatorio?: unknown
  maximo?: unknown
}

type SharedOptionPayloadResult =
  | { ok: true; opciones: SharedOptionItem[]; obligatorio: boolean; maximo: number }
  | { ok: false; error: string }

export function validateSharedOptionPayload(payload: SharedOptionPayload): SharedOptionPayloadResult {
  const opciones = payload.opciones ?? []
  if (!Array.isArray(opciones)) {
    return { ok: false, error: "Las opciones deben ser un array" }
  }

  const normalized: SharedOptionItem[] = []
  for (const item of opciones) {
    if (!item || typeof item !== "object") {
      return { ok: false, error: "Las opciones tienen un formato invalido" }
    }
    const record = item as { nombre?: unknown; precio?: unknown }
    if (typeof record.nombre !== "string") {
      return { ok: false, error: "Cada opción debe tener un nombre válido" }
    }
    const precio = record.precio ?? 0
    if (typeof precio !== "number" || !Number.isFinite(precio) || precio < 0) {
      return { ok: false, error: "Cada opción debe tener un precio válido" }
    }
    normalized.push({ nombre: record.nombre, precio })
  }

  const obligatorio = payload.obligatorio ?? false
  if (typeof obligatorio !== "boolean") {
    return { ok: false, error: "El campo obligatorio debe ser booleano" }
  }

  const maximo = payload.maximo ?? 0
  if (typeof maximo !== "number" || !Number.isSafeInteger(maximo) || maximo < 0) {
    return { ok: false, error: "El máximo debe ser un entero no negativo" }
  }

  return { ok: true, opciones: normalized, obligatorio, maximo }
}
