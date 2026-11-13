/// <reference types="bun-types" />
// QA — experiment for the intermittent P1001 ("Can't reach database server")
// seen when the QA suite starts. Read-only: only SELECT count(*) on the isolated
// database deligo_qa_auto. Each iteration creates a fresh PrismaClient (cold
// pool) and fires 13 queries at once, like foto() in the QA suite, so the pool
// opens several connections in the same instant. Variant A uses the default
// connect_timeout; variant B a longer one. Prints failures and timings only.
import { PrismaClient } from "@prisma/client"

const base = process.env.QA_DATABASE_URL ?? ""
if (!base.includes("/deligo_qa_auto?") || !/@127\.0\.0\.1:55420\//.test(base)) throw new Error("Sólo deligo_qa_auto local.")
const ITER = Number(process.env.ITER ?? "30")

async function variante(nombre: string, url: string) {
  const resultados: Array<{ ok: boolean; ms: number; code?: string }> = []
  for (let i = 0; i < ITER; i++) {
    const client = new PrismaClient({ datasourceUrl: url })
    const t0 = performance.now()
    try {
      await Promise.all(Array.from({ length: 13 }, (_, k) => (k % 2 ? client.venta.count() : client.negocio.count())))
      resultados.push({ ok: true, ms: Math.round(performance.now() - t0) })
    } catch (error) {
      resultados.push({ ok: false, ms: Math.round(performance.now() - t0), code: (error as { code?: string }).code ?? (error as Error).name })
    } finally {
      await client.$disconnect().catch(() => {})
    }
  }
  const fallas = resultados.filter((r) => !r.ok)
  const ms = resultados.map((r) => r.ms).sort((a, b) => a - b)
  console.log(JSON.stringify({ variante: nombre, iteraciones: ITER, fallas: fallas.length, codigos: [...new Set(fallas.map((f) => f.code))], msFallas: fallas.map((f) => f.ms), ms: { min: ms[0], p50: ms[Math.floor(ms.length / 2)], max: ms[ms.length - 1] } }))
}

const sep = base.includes("?") ? "&" : "?"
await variante("A: connect_timeout por defecto", base)
await variante("B: connect_timeout=30", `${base}${sep}connect_timeout=30`)
