/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests: cardinalidad y comportamiento del rate limit de la
// cuenta pública de mesa (23-B-CORRECCIÓN-1)
// ============================================
// Puro: sin red, sin DB, sin React — llama directamente a `checkRateLimit`
// (src/lib/rate-limit.ts, store en memoria compartido por todo el proceso).
// Cubre la auditoría de cardinalidad de la sección 12 del prompt de
// corrección: el store es un `Map<tipo, Map<clave, entry>>` en memoria,
// sin límite de tamaño impuesto por el propio módulo — la única defensa
// contra una cardinalidad no acotada es que la CLAVE se construya a partir
// de datos ya validados/acotados ANTES de llegar acá (ver
// src/app/api/public/mesa-cuenta/route.ts: `parseSlug`/`parseMesaNumero`,
// probados por separado contra el endpoint real en
// mesa-cliente-cuenta.test.ts). Este archivo prueba el comportamiento del
// propio limitador: cardinalidad ilimitada de CLAVES distintas (cada una
// con su propio presupuesto, nunca interfieren entre sí) y el
// comportamiento correcto de conteo/bloqueo para los dos buckets nuevos.
//
// Usa sufijos `randomUUID()` en cada clave para que los tests de este
// archivo nunca interfieran entre sí ni con una corrida anterior del mismo
// proceso (el store es un singleton de módulo, compartido durante toda la
// vida del proceso de test).

import { describe, test, expect } from "bun:test"
import { randomUUID } from "crypto"
import { checkRateLimit, RATE_LIMITS } from "./rate-limit"

describe("23-B-CORRECCIÓN-1 — cardinalidad del store en memoria", () => {
  test("el store NO tiene límite de cardinalidad propio: cada clave distinta obtiene su propio presupuesto independiente", () => {
    // Esto demuestra POR QUÉ la validación de slug/mesa en el endpoint es
    // la defensa real (sección 12 del prompt) — el store en sí mismo
    // acepta cualquier string como clave, sin cota. 50 claves distintas,
    // todas permitidas en su primer request (ninguna interfiere con otra).
    const claves = Array.from({ length: 50 }, () => `cardinalidad-${randomUUID()}`)
    for (const clave of claves) {
      const r = checkRateLimit("mesaCuentaPublica", clave)
      expect(r.allowed).toBe(true)
      expect(r.remaining).toBe(RATE_LIMITS.mesaCuentaPublica.maxRequests - 1)
    }
  })

  test("claves con prefijo compartido pero distinto slug/mesa NO comparten presupuesto (confirma por qué la cardinalidad es la preocupación real)", () => {
    const base = randomUUID()
    const r1 = checkRateLimit("mesaCuentaPublica", `1.2.3.4:${base}-slugA:5`)
    const r2 = checkRateLimit("mesaCuentaPublica", `1.2.3.4:${base}-slugB:5`)
    expect(r1.remaining).toBe(RATE_LIMITS.mesaCuentaPublica.maxRequests - 1)
    expect(r2.remaining).toBe(RATE_LIMITS.mesaCuentaPublica.maxRequests - 1) // no heredó el consumo de r1
  })
})

describe("23-B-CORRECCIÓN-1 — bucket mesaCuentaPublica: conteo y bloqueo", () => {
  test("permite exactamente maxRequests, bloquea la siguiente dentro de la misma ventana", () => {
    const clave = `bucket-fino-${randomUUID()}`
    const max = RATE_LIMITS.mesaCuentaPublica.maxRequests
    for (let i = 0; i < max; i++) {
      const r = checkRateLimit("mesaCuentaPublica", clave)
      expect(r.allowed).toBe(true)
    }
    const bloqueado = checkRateLimit("mesaCuentaPublica", clave)
    expect(bloqueado.allowed).toBe(false)
    expect(bloqueado.remaining).toBe(0)
    expect(bloqueado.retryAfterMs).toBeGreaterThan(0)
  })

  test("polling legítimo de varios dispositivos reales de la MISMA mesa (comparten ip:slug:mesa) cabe dentro del límite: 9 dispositivos x 20 polls (15s durante 5min) = 180, ninguno bloqueado", () => {
    const clave = `polling-legitimo-${randomUUID()}`
    const dispositivos = 9
    const pollsPorDispositivo = 20 // 5 min / 15s
    let bloqueados = 0
    for (let poll = 0; poll < pollsPorDispositivo; poll++) {
      for (let dispositivo = 0; dispositivo < dispositivos; dispositivo++) {
        const r = checkRateLimit("mesaCuentaPublica", clave)
        if (!r.allowed) bloqueados += 1
      }
    }
    expect(bloqueados).toBe(0)
  })
})

describe("23-B-CORRECCIÓN-1 — bucket mesaCuentaPublicaIp (límite grueso por IP)", () => {
  test("permite exactamente maxRequests, bloquea la siguiente dentro de la misma ventana", () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 250) + 1}-${randomUUID()}`
    const max = RATE_LIMITS.mesaCuentaPublicaIp.maxRequests
    for (let i = 0; i < max; i++) {
      const r = checkRateLimit("mesaCuentaPublicaIp", ip)
      expect(r.allowed).toBe(true)
    }
    const bloqueado = checkRateLimit("mesaCuentaPublicaIp", ip)
    expect(bloqueado.allowed).toBe(false)
  })

  test("es estrictamente más generoso que el bucket fino (nunca corta antes que él para un único slug/mesa)", () => {
    expect(RATE_LIMITS.mesaCuentaPublicaIp.maxRequests).toBeGreaterThan(RATE_LIMITS.mesaCuentaPublica.maxRequests)
  })

  test("acota el abuso de variar slug/mesa: un mismo IP probando 700 combinaciones DISTINTAS (1 request cada una) queda bloqueado por el bucket de IP mucho antes de agotar cualquier bucket fino individual", () => {
    const ipUnico = `abuso-${randomUUID()}`
    let bloqueadosPorIp = 0
    for (let i = 0; i < 700; i++) {
      const r = checkRateLimit("mesaCuentaPublicaIp", ipUnico)
      if (!r.allowed) bloqueadosPorIp += 1
    }
    // maxRequests=600 -> de 700 intentos, al menos 100 quedan bloqueados,
    // sin importar que cada uno use una clave DISTINTA en el bucket fino
    // (que nunca vería más de 1 request por combinación y jamás bloquearía
    // nada por sí solo).
    expect(bloqueadosPorIp).toBeGreaterThanOrEqual(100)
  })
})
