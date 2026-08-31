/**
 * Normalize the two representations that can cross the product API boundary:
 * persisted JSON strings and the arrays returned by the product endpoints.
 * A gallery is always represented as an ordered string[] in editor state.
 */
export function parseProductImageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string")
  }

  if (typeof value !== "string") return []

  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : []
  } catch {
    return []
  }
}
