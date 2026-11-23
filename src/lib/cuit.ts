// ============================================
// F5-A — CUIT / CUIL argentino (puro; misma regla que la función SQL f5a_cuit_valido)
// ============================================
// 11 dígitos, prefijo válido (20, 23, 24, 25, 26, 27, 30, 33, 34) y dígito verificador
// módulo 11 con pesos 5,4,3,2,7,6,5,4,3,2 (resultado 11 → 0; resultado 10 → inválido).
// Se aceptan guiones, puntos y espacios al escribirlo; se guarda sólo con dígitos.

const PREFIJOS_VALIDOS = new Set(["20", "23", "24", "25", "26", "27", "30", "33", "34"])
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]

export type CuitResultado = { ok: true; valor: string | null } | { ok: false; error: string }

export function cuitValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos)) return false
  if (!PREFIJOS_VALIDOS.has(digitos.slice(0, 2))) return false
  const suma = PESOS.reduce((acc, peso, i) => acc + Number(digitos[i]) * peso, 0)
  let dv = 11 - (suma % 11)
  if (dv === 11) dv = 0
  if (dv === 10) return false
  return dv === Number(digitos[10])
}

/** "" / null / undefined → sin CUIT; si no, exige un CUIT válido (con o sin guiones). */
export function normalizarCuit(entrada: unknown): CuitResultado {
  if (entrada === undefined || entrada === null) return { ok: true, valor: null }
  if (typeof entrada !== "string") return { ok: false, error: "El CUIT no es válido." }
  const texto = entrada.trim()
  if (!texto) return { ok: true, valor: null }
  if (!/^[\d\s.-]+$/.test(texto)) return { ok: false, error: "El CUIT sólo puede tener números y guiones." }
  const digitos = texto.replace(/\D/g, "")
  if (digitos.length !== 11) return { ok: false, error: "El CUIT tiene que tener 11 dígitos." }
  if (!cuitValido(digitos)) return { ok: false, error: "El CUIT no es válido: revisá los números (el dígito verificador no coincide)." }
  return { ok: true, valor: digitos }
}

export function formatearCuit(digitos: string | null | undefined): string {
  if (!digitos || digitos.length !== 11) return digitos ?? ""
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`
}

/** Para advertir nombres similares (nunca para bloquear): minúsculas, sin tildes, sin signos, espacios simples. */
export function normalizarNombreProveedor(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}
