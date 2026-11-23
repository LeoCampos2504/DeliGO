// Catálogo — lectura de archivos de importación EN EL NAVEGADOR (sin dependencias nuevas).
// .xlsx: es un ZIP con XML; se descomprime con DecompressionStream («deflate-raw», nativo del navegador) y se lee la
// PRIMERA hoja (textos compartidos, textos en línea, números). .csv: separador «;», «,» o tabulador detectado en el
// encabezado; UTF-8 o, si no es válido, Windows-1252 (CSV guardado por Excel en español). No se sube el archivo: al
// servidor sólo viajan las filas ya relacionadas con los campos del catálogo.

export type Celda = string | number
export type FilaArchivo = { numero: number; valores: Celda[] }
export type Hoja = { encabezados: string[]; filas: FilaArchivo[] }
export const MAX_BYTES_ARCHIVO = 5 * 1024 * 1024

export async function leerArchivo(file: File): Promise<Hoja> {
  if (file.size > MAX_BYTES_ARCHIVO) throw new Error("El archivo supera los 5 MB. Dividilo en partes.")
  const nombre = file.name.toLowerCase()
  const buf = await file.arrayBuffer()
  const filas = nombre.endsWith(".xlsx") ? await leerXlsx(buf) : nombre.endsWith(".csv") || nombre.endsWith(".txt") ? leerCsv(buf) : null
  if (!filas) throw new Error("Formato no soportado: usá .xlsx o .csv (los .xls antiguos: abrilos y guardalos como .xlsx).")
  const conDatos = filas.filter((f) => f.valores.some((v) => String(v).trim() !== ""))
  if (!conDatos.length) throw new Error("El archivo está vacío.")
  const [enc, ...resto] = conDatos
  const ancho = Math.max(enc.valores.length, ...resto.map((f) => f.valores.length))
  const encabezados = Array.from({ length: ancho }, (_, i) => String(enc.valores[i] ?? "").trim() || `Columna ${i + 1}`)
  return { encabezados, filas: resto }
}

// ---------- CSV ----------
function decodificar(buf: ArrayBuffer) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf) } catch { return new TextDecoder("windows-1252").decode(buf) }
}
function leerCsv(buf: ArrayBuffer): FilaArchivo[] {
  const t = decodificar(buf).replace(/^﻿/, "")
  const primera = t.slice(0, t.search(/\r?\n/) >= 0 ? t.search(/\r?\n/) : t.length)
  const sep = [";", ",", "\t"].map((s) => ({ s, n: primera.split(s).length })).sort((a, b) => b.n - a.n)[0].s
  const filas: FilaArchivo[] = []
  let fila: string[] = [], campo = "", comillas = false, numero = 1, inicio = 1
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (comillas) {
      if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++ } else comillas = false } else { if (c === "\n") numero++; campo += c }
    } else if (c === '"' && campo === "") comillas = true
    else if (c === sep) { fila.push(campo); campo = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++
      fila.push(campo); filas.push({ numero: inicio, valores: fila }); fila = []; campo = ""; numero++; inicio = numero
    } else campo += c
  }
  if (campo !== "" || fila.length) { fila.push(campo); filas.push({ numero: inicio, valores: fila }) }
  return filas
}

// ---------- XLSX ----------
async function inflar(datos: Uint8Array, metodo: number): Promise<Uint8Array> {
  if (metodo === 0) return datos
  if (metodo !== 8 || typeof DecompressionStream === "undefined") throw new Error("Este navegador no puede leer el .xlsx: guardalo como .csv o actualizá el navegador.")
  const copia = new Uint8Array(datos)
  const flujo = new Blob([copia]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(flujo).arrayBuffer())
}
function zip(buf: ArrayBuffer) {
  const u = new Uint8Array(buf), dv = new DataView(buf)
  let fin = -1
  for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { fin = i; break }
  if (fin < 0) throw new Error("El archivo .xlsx está dañado o no es un Excel válido.")
  const total = dv.getUint16(fin + 10, true)
  let off = dv.getUint32(fin + 16, true)
  const archivos = new Map<string, () => Promise<Uint8Array>>()
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(off, true) !== 0x02014b50) throw new Error("El archivo .xlsx está dañado.")
    const metodo = dv.getUint16(off + 10, true), comp = dv.getUint32(off + 20, true)
    const nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true)
    const local = dv.getUint32(off + 42, true)
    const nombre = new TextDecoder().decode(u.subarray(off + 46, off + 46 + nl))
    const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true)
    archivos.set(nombre, () => inflar(u.subarray(ini, ini + comp), metodo))
    off += 46 + nl + el + cl
  }
  return archivos
}
const xml = async (a: Map<string, () => Promise<Uint8Array>>, ruta: string) => {
  const f = a.get(ruta)
  return f ? new DOMParser().parseFromString(new TextDecoder().decode(await f()), "application/xml") : null
}
const hijos = (n: Element | Document, tag: string) => Array.from(n.getElementsByTagNameNS("*", tag))
function columna(ref: string) { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1 }

async function leerXlsx(buf: ArrayBuffer): Promise<FilaArchivo[]> {
  const a = zip(buf)
  const libro = await xml(a, "xl/workbook.xml")
  const rels = await xml(a, "xl/_rels/workbook.xml.rels")
  let ruta = "xl/worksheets/sheet1.xml"
  const hoja = libro ? hijos(libro, "sheet")[0] : null
  const rid = hoja?.getAttribute("r:id") ?? hoja?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id")
  const rel = rid && rels ? hijos(rels, "Relationship").find((r) => r.getAttribute("Id") === rid) : null
  const destino = rel?.getAttribute("Target")
  if (destino) ruta = destino.startsWith("/") ? destino.slice(1) : `xl/${destino.replace(/^\.\//, "")}`
  const compartidos = await xml(a, "xl/sharedStrings.xml")
  const textos = compartidos ? hijos(compartidos, "si").map((si) => hijos(si, "t").filter((t) => (t.parentElement?.localName ?? "") !== "rPh").map((t) => t.textContent ?? "").join("")) : []
  const doc = await xml(a, ruta)
  if (!doc) throw new Error("No se encontró la primera hoja del Excel.")
  const filas: FilaArchivo[] = []
  for (const r of hijos(doc, "row")) {
    const numero = Number(r.getAttribute("r")) || filas.length + 1
    const valores: Celda[] = []
    hijos(r, "c").forEach((c, i) => {
      const ref = c.getAttribute("r"); const col = ref ? columna(ref) : i
      const t = c.getAttribute("t"); const v = hijos(c, "v")[0]?.textContent ?? ""
      let val: Celda = ""
      if (t === "s") val = textos[Number(v)] ?? ""
      else if (t === "inlineStr") val = hijos(c, "t").map((x) => x.textContent ?? "").join("")
      else if (t === "str") val = v
      else if (t === "b") val = v === "1" ? "VERDADERO" : "FALSO"
      else if (t === "e") val = ""
      else if (v !== "") { const n = Number(v); val = Number.isFinite(n) ? n : v }
      valores[col] = val
    })
    for (let i = 0; i < valores.length; i++) if (valores[i] === undefined) valores[i] = ""
    filas.push({ numero, valores })
  }
  return filas
}

// ---------- CSV de salida (plantilla / filas con error) ----------
export function descargarCsv(nombre: string, filas: Celda[][]) {
  const texto = filas.map((f) => f.map((v) => { const s = String(v ?? ""); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }).join(";")).join("\r\n")
  const url = URL.createObjectURL(new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a"); a.href = url; a.download = nombre; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
