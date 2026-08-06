/// <reference types="bun-types" />
// ============================================
// DeliGO — Tests permanentes: cuenta pública de mesa vía sesión QR (23-B,
// corregido en 23-B-CORRECCIÓN-1)
// ============================================
// Integración real contra PostgreSQL (misma base que usa `db` en runtime —
// sin mocks de Prisma). Cubre:
//   - contrato de autorización (token válido/ausente/manipulado/revocado,
//     binding a ocupación-mesa-negocio);
//   - persistencia (cálculo de cuenta, reflejo de cancelaciones);
//   - aislamiento cross-negocio/cross-mesa;
//   - CONCURRENCIA DETERMINISTA (23-B-CORRECCIÓN-1): cierre/reapertura/
//     expiración/revocación/cancelación ocurriendo exactamente entre la
//     primera validación y la revalidación final de `resolveMesaClienteCuenta`,
//     usando barreras de sincronización reales (rendezvous de dos promesas)
//     — NUNCA un `Promise.all` sin control de orden.
//
// Reutiliza el mismo patrón de fixtures que
// src/lib/mesa-pedido-cancelacion.test.ts (23-A1): cada `describe` crea su
// propio negocio/mesa/ocupación en `beforeAll` y limpia todo en `afterAll`
// (el cascade de Prisma en `sesiones_ocupacion_mesa -> credenciales_ocupacion_mesa`
// limpia las credenciales automáticamente).

import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { randomUUID } from "crypto"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { hashMesaOccupancyToken, generateMesaOccupancyToken, MESA_OCCUPANCY_COOKIE_NAME } from "@/lib/mesa-occupancy"
import { expireStaleMesaOccupancies } from "@/lib/mesa-occupancy-expiration"
import { resolveMesaClienteCuenta } from "./mesa-cliente-cuenta"
import { GET as getMesaCuentaPublica } from "@/app/api/public/mesa-cuenta/route"

// ---------------------------------------------------------------------------
// Helpers de fixture (reales, sin mocks) — mismo estilo que 23-A1
// ---------------------------------------------------------------------------

async function crearNegocio() {
  const suffix = randomUUID()
  const negocio = await db.negocio.create({
    data: {
      slug: `test-23b-${suffix}`,
      nombre: `Test 23-B ${suffix}`,
      usuario: `test23b_${suffix}`,
      email: `test23b-${suffix}@example.com`,
      password: "no-usado-en-estos-tests",
      aprobado: true,
      suspendido: false,
      salonActivo: true,
    },
  })
  return negocio.id
}

let mesaCounter = 0
async function crearMesa(negocioId: string) {
  mesaCounter += 1
  const mesa = await db.mesa.create({ data: { negocioId, numero: 2000 + mesaCounter } })
  return mesa.id
}

async function crearOcupacion(
  negocioId: string,
  mesaId: string,
  estado: "activa" | "cerrada" | "expirada" = "activa",
  iniciadaEn?: Date
) {
  const ocupacion = await db.sesionOcupacionMesa.create({
    data: {
      negocioId,
      mesaId,
      estado,
      iniciadaEn: iniciadaEn ?? new Date(),
      cerradaEn: estado === "activa" ? null : new Date(),
    },
  })
  if (estado === "activa") {
    await db.mesa.update({ where: { id: mesaId }, data: { ocupacionActualId: ocupacion.id } })
  }
  return ocupacion.id
}

async function crearCredencial(ocupacionId: string, options: { revocada?: boolean } = {}) {
  const rawToken = generateMesaOccupancyToken()
  await db.credencialOcupacionMesa.create({
    data: {
      ocupacionId,
      tokenHash: hashMesaOccupancyToken(rawToken),
      revocadaEn: options.revocada ? new Date() : null,
    },
  })
  return rawToken
}

async function crearPedidoMesa(negocioId: string, mesaId: string, ocupacionId: string, estado: string, total: number) {
  const pedido = await db.pedido.create({
    data: {
      negocioId,
      negocioSlug: `test-23b-pedido-${randomUUID()}`,
      negocioNombre: "Negocio Test 23-B",
      clienteNombre: "Cliente Test",
      mesaId,
      mesaNumero: 1,
      ocupacionMesaId: ocupacionId,
      metodoEntrega: "mesa",
      estado,
      total,
      totalProductos: total,
      items: {
        create: [{ nombre: "Producto Test", precio: total, cantidad: 1 }],
      },
    },
  })
  return pedido.id
}

async function limpiarNegocio(negocioId: string) {
  await db.pedidoEvento.deleteMany({ where: { pedido: { negocioId } } }).catch(() => {})
  await db.pedido.deleteMany({ where: { negocioId } })
  await db.sesionOcupacionMesa.deleteMany({ where: { negocioId } }) // cascade -> credenciales
  await db.mesa.deleteMany({ where: { negocioId } })
  await db.negocio.delete({ where: { id: negocioId } })
}

function reqPublico(query: string, cookieToken?: string): NextRequest {
  return new NextRequest(`http://localhost/api/public/mesa-cuenta?${query}`, {
    headers: cookieToken ? { cookie: `${MESA_OCCUPANCY_COOKIE_NAME}=${cookieToken}` } : undefined,
  })
}

// ---------------------------------------------------------------------------
// Rendezvous determinista de dos vías (23-B-CORRECCIÓN-1) — NUNCA un
// `Promise.all` sin control de orden. Permite pausar `resolveMesaClienteCuenta`
// exactamente en un punto conocido (vía `testHooks`) y garantizar, con una
// señal explícita de ida y vuelta, que la mutación concurrente del test se
// ejecuta y COMMITEA realmente ANTES de reanudar la lectura pausada.
// ---------------------------------------------------------------------------

function crearRendezvous() {
  let resolverLlegada!: () => void
  const llegada = new Promise<void>((resolve) => {
    resolverLlegada = resolve
  })
  let resolverContinuar!: () => void
  const continuar = new Promise<void>((resolve) => {
    resolverContinuar = resolve
  })
  return {
    /** El test hace `await` de esto para saber que la función llegó al punto de pausa. */
    llegada,
    /** El hook dentro de la función hace `await` de esto para reanudar. */
    continuar,
    /** Llamado DESDE DENTRO del hook — señaliza que se llegó a la pausa. */
    señalizarLlegada: () => resolverLlegada(),
    /** Llamado DESDE EL TEST, después de la mutación concurrente — libera la pausa. */
    liberar: () => resolverContinuar(),
  }
}

// ---------------------------------------------------------------------------
// Contrato de autorización — resolveMesaClienteCuenta
// ---------------------------------------------------------------------------

describe("23-B — resolveMesaClienteCuenta (contrato)", () => {
  let negocioId: string
  let mesaId: string
  let ocupacionId: string
  let tokenValido: string

  beforeAll(async () => {
    negocioId = await crearNegocio()
    mesaId = await crearMesa(negocioId)
    ocupacionId = await crearOcupacion(negocioId, mesaId, "activa")
    tokenValido = await crearCredencial(ocupacionId)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioId)
  })

  test("1. token válido, ocupación activa, mesa/negocio coinciden -> activa con cuenta adjunta", async () => {
    const result = await resolveMesaClienteCuenta({ negocioId, mesaId, token: tokenValido })
    expect(result.status).toBe("activa")
    if (result.status === "activa") {
      expect(result.ocupacionId).toBe(ocupacionId)
      expect(result.cuenta.totalGeneral).toBe(0)
    }
  })

  test("2. token ausente (null) -> sin_sesion", async () => {
    const result = await resolveMesaClienteCuenta({ negocioId, mesaId, token: null })
    expect(result).toEqual({ status: "sin_sesion" })
  })

  test("token vacío/solo espacios -> sin_sesion", async () => {
    expect(await resolveMesaClienteCuenta({ negocioId, mesaId, token: "" })).toEqual({ status: "sin_sesion" })
    expect(await resolveMesaClienteCuenta({ negocioId, mesaId, token: "   " })).toEqual({ status: "sin_sesion" })
  })

  test("3. token manipulado/inexistente (no corresponde a ninguna credencial real) -> sin_sesion", async () => {
    const result = await resolveMesaClienteCuenta({ negocioId, mesaId, token: "token-que-nunca-existio" })
    expect(result).toEqual({ status: "sin_sesion" })
  })

  test("varios dispositivos: dos credenciales distintas de la MISMA ocupación ven la misma cuenta, y revocar una no afecta a la otra", async () => {
    const mesaMultiDispositivo = await crearMesa(negocioId)
    const ocupacionCompartida = await crearOcupacion(negocioId, mesaMultiDispositivo, "activa")
    const tokenDispositivo1 = await crearCredencial(ocupacionCompartida)
    const tokenDispositivo2 = await crearCredencial(ocupacionCompartida)
    expect(tokenDispositivo1).not.toBe(tokenDispositivo2)

    const resultado1 = await resolveMesaClienteCuenta({ negocioId, mesaId: mesaMultiDispositivo, token: tokenDispositivo1 })
    const resultado2 = await resolveMesaClienteCuenta({ negocioId, mesaId: mesaMultiDispositivo, token: tokenDispositivo2 })
    expect(resultado1.status).toBe("activa")
    expect(resultado2.status).toBe("activa")
    if (resultado1.status === "activa" && resultado2.status === "activa") {
      expect(resultado1.ocupacionId).toBe(ocupacionCompartida)
      expect(resultado2.ocupacionId).toBe(ocupacionCompartida)
    }

    // 11. Revocar la credencial del dispositivo 1 nunca debe afectar al 2.
    await db.credencialOcupacionMesa.update({
      where: { tokenHash: hashMesaOccupancyToken(tokenDispositivo1) },
      data: { revocadaEn: new Date() },
    })
    expect((await resolveMesaClienteCuenta({ negocioId, mesaId: mesaMultiDispositivo, token: tokenDispositivo1 })).status).toBe(
      "cerrada"
    )
    expect((await resolveMesaClienteCuenta({ negocioId, mesaId: mesaMultiDispositivo, token: tokenDispositivo2 })).status).toBe(
      "activa"
    )

    // Cerrar la OCUPACIÓN (no una credencial puntual) sí invalida a ambos.
    await db.sesionOcupacionMesa.update({ where: { id: ocupacionCompartida }, data: { estado: "cerrada", cerradaEn: new Date() } })
    expect((await resolveMesaClienteCuenta({ negocioId, mesaId: mesaMultiDispositivo, token: tokenDispositivo2 })).status).toBe(
      "cerrada"
    )
  })

  test("6/7. hash correcto: el token crudo NUNCA se guarda en DB — solo el hash coincide", async () => {
    const credencial = await db.credencialOcupacionMesa.findUnique({
      where: { tokenHash: hashMesaOccupancyToken(tokenValido) },
    })
    expect(credencial).not.toBeNull()
    expect(credencial?.tokenHash).not.toBe(tokenValido)
    const filaConTokenCrudo = await db.credencialOcupacionMesa.findFirst({ where: { tokenHash: tokenValido } })
    expect(filaConTokenCrudo).toBeNull()
  })

  test("16. ocupación cerrada -> cerrada, nunca cuenta", async () => {
    const mesaCerrada = await crearMesa(negocioId)
    const ocupacionCerrada = await crearOcupacion(negocioId, mesaCerrada, "cerrada")
    const tokenDeCerrada = await crearCredencial(ocupacionCerrada)
    const result = await resolveMesaClienteCuenta({ negocioId, mesaId: mesaCerrada, token: tokenDeCerrada })
    expect(result).toEqual({ status: "cerrada" })
  })

  test("17. ocupación expirada (estado 'expirada') -> cerrada, nunca cuenta", async () => {
    const mesaExpirada = await crearMesa(negocioId)
    const ocupacionExpirada = await crearOcupacion(negocioId, mesaExpirada, "expirada")
    const tokenDeExpirada = await crearCredencial(ocupacionExpirada)
    const result = await resolveMesaClienteCuenta({ negocioId, mesaId: mesaExpirada, token: tokenDeExpirada })
    expect(result).toEqual({ status: "cerrada" })
  })

  test("18. nueva ocupación en la misma mesa no reutiliza la sesión anterior -> cerrada", async () => {
    const mesaRotativa = await crearMesa(negocioId)
    const ocupacionVieja = await crearOcupacion(negocioId, mesaRotativa, "activa")
    const tokenViejo = await crearCredencial(ocupacionVieja)
    await db.sesionOcupacionMesa.update({ where: { id: ocupacionVieja }, data: { estado: "cerrada", cerradaEn: new Date() } })
    const ocupacionNueva = await crearOcupacion(negocioId, mesaRotativa, "activa")
    expect(ocupacionNueva).not.toBe(ocupacionVieja)

    expect(await resolveMesaClienteCuenta({ negocioId, mesaId: mesaRotativa, token: tokenViejo })).toEqual({ status: "cerrada" })

    const tokenNuevo = await crearCredencial(ocupacionNueva)
    const resultNuevo = await resolveMesaClienteCuenta({ negocioId, mesaId: mesaRotativa, token: tokenNuevo })
    expect(resultNuevo.status).toBe("activa")
    if (resultNuevo.status === "activa") expect(resultNuevo.ocupacionId).toBe(ocupacionNueva)
  })

  test("19/9. negocio distinto (token válido pero de otro negocio) -> sin_sesion, nunca revela el negocio real", async () => {
    const otroNegocioId = await crearNegocio()
    try {
      const result = await resolveMesaClienteCuenta({ negocioId: otroNegocioId, mesaId, token: tokenValido })
      expect(result).toEqual({ status: "sin_sesion" })
    } finally {
      await limpiarNegocio(otroNegocioId)
    }
  })

  test("20/11. mesa distinta del mismo negocio (token válido pero de otra mesa) -> sin_sesion, nunca revela la mesa real", async () => {
    const otraMesaId = await crearMesa(negocioId)
    const result = await resolveMesaClienteCuenta({ negocioId, mesaId: otraMesaId, token: tokenValido })
    expect(result).toEqual({ status: "sin_sesion" })
  })

  test("27. parámetros manipulados (mesaId inventado que no existe) -> sin_sesion, nunca lanza", async () => {
    const result = await resolveMesaClienteCuenta({ negocioId, mesaId: "mesa-inexistente-xyz", token: tokenValido })
    expect(result).toEqual({ status: "sin_sesion" })
  })
})

// ---------------------------------------------------------------------------
// Persistencia — cálculo de cuenta dentro de resolveMesaClienteCuenta
// ---------------------------------------------------------------------------

describe("23-B — persistencia (cálculo de cuenta, sin duplicar reglas financieras)", () => {
  let negocioId: string
  let mesaId: string
  let ocupacionId: string
  let token: string

  beforeAll(async () => {
    negocioId = await crearNegocio()
    mesaId = await crearMesa(negocioId)
    ocupacionId = await crearOcupacion(negocioId, mesaId, "activa")
    token = await crearCredencial(ocupacionId)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioId)
  })

  test("22. la cuenta se reconstruye desde DB: pedido entregado incluido, cancelado excluido, pendiente bloquea", async () => {
    await crearPedidoMesa(negocioId, mesaId, ocupacionId, "entregado", 1500)
    const pedidoCanceladoId = await crearPedidoMesa(negocioId, mesaId, ocupacionId, "cancelado", 9999)
    await crearPedidoMesa(negocioId, mesaId, ocupacionId, "preparando", 500)

    const resultado = await resolveMesaClienteCuenta({ negocioId, mesaId, token })
    expect(resultado.status).toBe("activa")
    if (resultado.status !== "activa") return
    const { cuenta } = resultado

    expect(cuenta.totalGeneral).toBe(1500) // el cancelado NUNCA suma, aunque su total sea mayor
    expect(cuenta.pedidosIncluidosCount).toBe(1)
    expect(cuenta.pedidosExcluidosCount).toBe(1)
    expect(cuenta.pedidosPendientesCount).toBe(1)
    expect(cuenta.puedeCerrar).toBe(false)
    expect(cuenta.pedidos.some((p) => p.id === pedidoCanceladoId && p.excluido)).toBe(true)
  })

  test("filtra estrictamente por ocupacionId + negocioId + metodoEntrega mesa — nunca mezcla pedidos de otra ocupación", async () => {
    const otraMesaId = await crearMesa(negocioId)
    const otraOcupacionId = await crearOcupacion(negocioId, otraMesaId, "activa")
    await crearPedidoMesa(negocioId, otraMesaId, otraOcupacionId, "entregado", 88888)

    const resultado = await resolveMesaClienteCuenta({ negocioId, mesaId, token })
    expect(resultado.status).toBe("activa")
    if (resultado.status !== "activa") return
    expect(resultado.cuenta.pedidos.every((p) => p.subtotalPedido !== 88888)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// CONCURRENCIA DETERMINISTA (23-B-CORRECCIÓN-1) — barreras reales, nunca
// Promise.all sin control de orden.
// ---------------------------------------------------------------------------

describe("23-B-CORRECCIÓN-1 — concurrencia: cierre", () => {
  let negocioId: string
  let mesaId: string

  beforeAll(async () => {
    negocioId = await crearNegocio()
    mesaId = await crearMesa(negocioId)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioId)
  })

  test("Caso 1 — la lectura completa gana: termina ANTES del cierre -> activa consistente con la cuenta previa", async () => {
    const ocupacionId = await crearOcupacion(negocioId, mesaId, "activa")
    const token = await crearCredencial(ocupacionId)
    await crearPedidoMesa(negocioId, mesaId, ocupacionId, "entregado", 111)

    // Secuencial, sin ninguna pausa: la lectura completa (incluida su
    // revalidación final) TERMINA antes de que el cierre siquiera empiece.
    const resultado = await resolveMesaClienteCuenta({ negocioId, mesaId, token })
    await db.sesionOcupacionMesa.update({ where: { id: ocupacionId }, data: { estado: "cerrada", cerradaEn: new Date() } })

    expect(resultado.status).toBe("activa")
    if (resultado.status === "activa") {
      expect(resultado.ocupacionId).toBe(ocupacionId)
      expect(resultado.cuenta.totalGeneral).toBe(111)
    }
  })

  test("Caso 2 — el cierre gana: COMMITEADO antes de empezar la lectura -> cerrada, sin pedidos ni total", async () => {
    const ocupacionId = await crearOcupacion(negocioId, mesaId, "activa")
    const token = await crearCredencial(ocupacionId)
    await crearPedidoMesa(negocioId, mesaId, ocupacionId, "entregado", 222)

    // El cierre se confirma (commit real) ANTES de siquiera llamar a la lectura.
    await db.sesionOcupacionMesa.update({ where: { id: ocupacionId }, data: { estado: "cerrada", cerradaEn: new Date() } })
    const resultado = await resolveMesaClienteCuenta({ negocioId, mesaId, token })

    expect(resultado).toEqual({ status: "cerrada" })
    expect(resultado).not.toHaveProperty("cuenta")
  })

  test("Caso 3 (obligatorio) — cierre ENTRE la primera validación y la carga de pedidos -> detectado por la revalidación, nunca activa", async () => {
    const ocupacionId = await crearOcupacion(negocioId, mesaId, "activa")
    const token = await crearCredencial(ocupacionId)
    await crearPedidoMesa(negocioId, mesaId, ocupacionId, "entregado", 333)

    const rendezvous = crearRendezvous()
    const lecturaPromise = resolveMesaClienteCuenta(
      { negocioId, mesaId, token },
      {
        beforeLoadPedidos: async () => {
          rendezvous.señalizarLlegada()
          await rendezvous.continuar
        },
      }
    )

    // Esperamos la señal real de que la primera validación YA terminó y la
    // función está pausada, exactamente antes de leer los pedidos.
    await rendezvous.llegada

    // Mutación concurrente, COMMITEADA de verdad (consulta directa e
    // independiente de la lectura pausada) — simula un cierre real hecho
    // por otro request mientras el nuestro estaba pausado.
    await db.sesionOcupacionMesa.update({ where: { id: ocupacionId }, data: { estado: "cerrada", cerradaEn: new Date() } })

    rendezvous.liberar()
    const resultado = await lecturaPromise

    expect(resultado).toEqual({ status: "cerrada" })
    expect(resultado).not.toHaveProperty("cuenta")
  })
})

describe("23-B-CORRECCIÓN-1 — concurrencia: expiración", () => {
  let negocioId: string
  let mesaId: string

  beforeAll(async () => {
    negocioId = await crearNegocio()
    mesaId = await crearMesa(negocioId)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioId)
  })

  test("expiración commiteada ENTRE la primera validación y la carga -> cerrada, cookie limpiada, sin datos de cuenta", async () => {
    // `iniciadaEn` muy en el pasado — se le pasa un `now` de referencia muy
    // futuro a expireStaleMesaOccupancies para no depender del reloj real
    // ni esperar 6 horas (mismo parámetro inyectable que ya expone el cron).
    const haceMucho = new Date(Date.now() - 7 * 60 * 60 * 1000)
    const ocupacionId = await crearOcupacion(negocioId, mesaId, "activa", haceMucho)
    const token = await crearCredencial(ocupacionId)
    await crearPedidoMesa(negocioId, mesaId, ocupacionId, "entregado", 444)

    const rendezvous = crearRendezvous()
    const lecturaPromise = resolveMesaClienteCuenta(
      { negocioId, mesaId, token },
      {
        beforeLoadPedidos: async () => {
          rendezvous.señalizarLlegada()
          await rendezvous.continuar
        },
      }
    )

    await rendezvous.llegada
    // Invoca DIRECTAMENTE la misma función que usa el cron real (nunca se
    // duplica su lógica de expiración) — commitea el cierre por expiración.
    const resultadoExpiracion = await expireStaleMesaOccupancies({ now: new Date() })
    expect(resultadoExpiracion.expired).toBeGreaterThanOrEqual(1)
    rendezvous.liberar()

    const resultado = await lecturaPromise
    expect(resultado).toEqual({ status: "cerrada" })
    expect(resultado).not.toHaveProperty("cuenta")

    // El endpoint real también debe limpiar la cookie en este escenario.
    const negocio = await db.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { slug: true } })
    const mesa = await db.mesa.findUniqueOrThrow({ where: { id: mesaId }, select: { numero: true } })
    const tokenNuevo = await crearCredencial(await crearOcupacion(negocioId, mesaId, "activa")) // ocupación nueva, no relacionada
    // Usamos el token YA expirado (de la ocupación vencida) contra el
    // endpoint real para confirmar la limpieza de cookie end-to-end.
    void tokenNuevo
    const req = reqPublico(`slug=${negocio.slug}&mesa=${mesa.numero}`, token)
    const res = await getMesaCuentaPublica(req)
    const body = await res.json()
    expect(body.status).toBe("cerrada")
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie.toLowerCase()).toMatch(/max-age=0/)
  })
})

describe("23-B-CORRECCIÓN-1 — concurrencia: reapertura", () => {
  let negocioId: string
  let mesaId: string

  beforeAll(async () => {
    negocioId = await crearNegocio()
    mesaId = await crearMesa(negocioId)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioId)
  })

  test("reapertura (cierre ocupación 1 + apertura ocupación 2) ENTRE validación y carga -> credencial 1 nunca ve pedidos de ocupación 2", async () => {
    const ocupacion1 = await crearOcupacion(negocioId, mesaId, "activa")
    const token1 = await crearCredencial(ocupacion1)
    // Importes claramente distintos para detectar cualquier mezcla.
    await crearPedidoMesa(negocioId, mesaId, ocupacion1, "entregado", 1001)

    const rendezvous = crearRendezvous()
    const lecturaPromise = resolveMesaClienteCuenta(
      { negocioId, mesaId, token: token1 },
      {
        beforeLoadPedidos: async () => {
          rendezvous.señalizarLlegada()
          await rendezvous.continuar
        },
      }
    )

    await rendezvous.llegada

    // Reapertura real: cerrar ocupación 1, abrir ocupación 2 en la misma
    // mesa, actualizar Mesa.ocupacionActualId — con un importe MUY distinto.
    await db.sesionOcupacionMesa.update({ where: { id: ocupacion1 }, data: { estado: "cerrada", cerradaEn: new Date() } })
    const ocupacion2 = await crearOcupacion(negocioId, mesaId, "activa")
    await crearPedidoMesa(negocioId, mesaId, ocupacion2, "entregado", 9002)
    const token2 = await crearCredencial(ocupacion2)

    rendezvous.liberar()
    const resultado = await lecturaPromise

    expect(resultado).toEqual({ status: "cerrada" })
    expect(resultado).not.toHaveProperty("cuenta")

    // La credencial nueva SÍ funciona, y ve EXCLUSIVAMENTE el importe de la
    // ocupación 2 — nunca una mezcla con el 1001 de la ocupación anterior.
    const resultado2 = await resolveMesaClienteCuenta({ negocioId, mesaId, token: token2 })
    expect(resultado2.status).toBe("activa")
    if (resultado2.status === "activa") {
      expect(resultado2.ocupacionId).toBe(ocupacion2)
      expect(resultado2.cuenta.totalGeneral).toBe(9002)
    }

    // La credencial vieja sigue sin funcionar después de la reapertura.
    const resultado1DeNuevo = await resolveMesaClienteCuenta({ negocioId, mesaId, token: token1 })
    expect(resultado1DeNuevo).toEqual({ status: "cerrada" })
  })
})

describe("23-B-CORRECCIÓN-1 — concurrencia: revocación de credencial", () => {
  let negocioId: string
  let mesaId: string

  beforeAll(async () => {
    negocioId = await crearNegocio()
    mesaId = await crearMesa(negocioId)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioId)
  })

  test("revocación de la credencial ENTRE validación y carga -> cerrada, nunca cuenta activa; otra credencial de la misma ocupación sigue funcionando", async () => {
    const ocupacionId = await crearOcupacion(negocioId, mesaId, "activa")
    const tokenPropio = await crearCredencial(ocupacionId)
    const tokenOtroDispositivo = await crearCredencial(ocupacionId)
    await crearPedidoMesa(negocioId, mesaId, ocupacionId, "entregado", 555)

    const rendezvous = crearRendezvous()
    const lecturaPromise = resolveMesaClienteCuenta(
      { negocioId, mesaId, token: tokenPropio },
      {
        beforeLoadPedidos: async () => {
          rendezvous.señalizarLlegada()
          await rendezvous.continuar
        },
      }
    )

    await rendezvous.llegada
    await db.credencialOcupacionMesa.update({
      where: { tokenHash: hashMesaOccupancyToken(tokenPropio) },
      data: { revocadaEn: new Date() },
    })
    rendezvous.liberar()

    const resultado = await lecturaPromise
    expect(resultado).toEqual({ status: "cerrada" })
    expect(resultado).not.toHaveProperty("cuenta")

    // La otra credencial de la MISMA ocupación (nunca revocada) sigue activa.
    const resultadoOtroDispositivo = await resolveMesaClienteCuenta({ negocioId, mesaId, token: tokenOtroDispositivo })
    expect(resultadoOtroDispositivo.status).toBe("activa")
  })
})

describe("23-B-CORRECCIÓN-1 — concurrencia: cancelación de pedido", () => {
  let negocioId: string

  beforeAll(async () => {
    negocioId = await crearNegocio()
  })

  afterAll(async () => {
    await limpiarNegocio(negocioId)
  })

  test("la cancelación gana (commitea ANTES de cargar los pedidos) -> la lectura devuelve íntegramente el estado nuevo", async () => {
    // Mesa propia de este test: ninguno de los dos tests de este describe
    // cierra su ocupación al terminar (la cancelación de un pedido no
    // cierra la ocupación) — reutilizar la misma mesa violaría el índice
    // único parcial (máx. 1 ocupación "activa" por mesa).
    const mesaId = await crearMesa(negocioId)
    const ocupacionId = await crearOcupacion(negocioId, mesaId, "activa")
    const token = await crearCredencial(ocupacionId)
    const pedidoId = await crearPedidoMesa(negocioId, mesaId, ocupacionId, "listo_para_retirar", 700)

    const rendezvous = crearRendezvous()
    const lecturaPromise = resolveMesaClienteCuenta(
      { negocioId, mesaId, token },
      {
        beforeLoadPedidos: async () => {
          rendezvous.señalizarLlegada()
          await rendezvous.continuar
        },
      }
    )

    await rendezvous.llegada
    // Misma mutación que ya hace 23-A1 al cancelar.
    await db.pedido.update({ where: { id: pedidoId }, data: { estado: "cancelado", canceladoFecha: new Date(), canceladoMotivo: "test" } })
    rendezvous.liberar()

    const resultado = await lecturaPromise
    expect(resultado.status).toBe("activa")
    if (resultado.status !== "activa") return
    const linea = resultado.cuenta.pedidos.find((p) => p.id === pedidoId)
    // Estado y total del pedido SIEMPRE consistentes entre sí: nunca
    // "incluido en el total" con la fila marcada como cancelada, ni
    // viceversa — ambos vienen de la MISMA fila leída en la MISMA consulta.
    expect(linea?.excluido).toBe(true)
    expect(linea?.incluido).toBe(false)
    expect(resultado.cuenta.pedidosExcluidosCount).toBe(1)
    expect(resultado.cuenta.pedidosIncluidosCount).toBe(0)
    expect(resultado.cuenta.totalGeneral).toBe(0)
  })

  test("la lectura ya ganó (pedidos ya cargados ANTES de que la cancelación commitee) -> devuelve íntegramente el estado previo, sin mezcla", async () => {
    const mesaId = await crearMesa(negocioId)
    const ocupacionId = await crearOcupacion(negocioId, mesaId, "activa")
    const token = await crearCredencial(ocupacionId)
    const pedidoId = await crearPedidoMesa(negocioId, mesaId, ocupacionId, "listo_para_retirar", 800)

    const rendezvous = crearRendezvous()
    // Pausa DESPUÉS de cargar los pedidos (ya tiene el estado "listo_para_retirar"
    // en memoria), justo antes de la revalidación final.
    const lecturaPromise = resolveMesaClienteCuenta(
      { negocioId, mesaId, token },
      {
        beforeFinalRevalidation: async () => {
          rendezvous.señalizarLlegada()
          await rendezvous.continuar
        },
      }
    )

    await rendezvous.llegada
    await db.pedido.update({ where: { id: pedidoId }, data: { estado: "cancelado", canceladoFecha: new Date(), canceladoMotivo: "test" } })
    rendezvous.liberar()

    const resultado = await lecturaPromise
    // La cancelación no afecta el binding de la ocupación (no la cierra ni
    // revoca nada) — la revalidación final sigue pasando, y la cuenta
    // devuelta es íntegramente la que ya se había cargado (estado previo,
    // "listo_para_retirar", pendiente) — nunca una mezcla con el nuevo
    // estado "cancelado" que ni siquiera se volvió a leer.
    expect(resultado.status).toBe("activa")
    if (resultado.status !== "activa") return
    const linea = resultado.cuenta.pedidos.find((p) => p.id === pedidoId)
    expect(linea?.pendiente).toBe(true)
    expect(linea?.excluido).toBe(false)
    expect(resultado.cuenta.pedidosPendientesCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Aislamiento cross-negocio / cross-mesa — 3 mundos reales, + limpieza de
// respuesta (sección 13 del prompt de corrección)
// ---------------------------------------------------------------------------

describe("23-B — aislamiento: negocio A/mesa A, negocio A/mesa B, negocio B/mesa C", () => {
  let negocioAId: string
  let negocioBId: string
  let mesaAId: string
  let mesaBId: string
  let mesaCId: string
  let ocupacionAId: string
  let ocupacionBId: string
  let ocupacionCId: string
  let tokenA: string
  let tokenB: string
  let tokenC: string

  beforeAll(async () => {
    negocioAId = await crearNegocio()
    negocioBId = await crearNegocio()
    mesaAId = await crearMesa(negocioAId)
    mesaBId = await crearMesa(negocioAId)
    mesaCId = await crearMesa(negocioBId)
    ocupacionAId = await crearOcupacion(negocioAId, mesaAId, "activa")
    ocupacionBId = await crearOcupacion(negocioAId, mesaBId, "activa")
    ocupacionCId = await crearOcupacion(negocioBId, mesaCId, "activa")
    tokenA = await crearCredencial(ocupacionAId)
    tokenB = await crearCredencial(ocupacionBId)
    tokenC = await crearCredencial(ocupacionCId)
    await crearPedidoMesa(negocioAId, mesaAId, ocupacionAId, "entregado", 111)
    await crearPedidoMesa(negocioAId, mesaBId, ocupacionBId, "entregado", 222)
    await crearPedidoMesa(negocioBId, mesaCId, ocupacionCId, "entregado", 333)
  })

  afterAll(async () => {
    await limpiarNegocio(negocioAId)
    await limpiarNegocio(negocioBId)
  })

  test("1. sesión A no accede a la cuenta de B (misma empresa, otra mesa)", async () => {
    expect(await resolveMesaClienteCuenta({ negocioId: negocioAId, mesaId: mesaBId, token: tokenA })).toEqual({
      status: "sin_sesion",
    })
  })

  test("2. sesión A no accede a la cuenta de C (otro negocio)", async () => {
    expect(await resolveMesaClienteCuenta({ negocioId: negocioBId, mesaId: mesaCId, token: tokenA })).toEqual({
      status: "sin_sesion",
    })
  })

  test("5. cada cuenta contiene EXCLUSIVAMENTE los pedidos de su propia ocupación", async () => {
    const rA = await resolveMesaClienteCuenta({ negocioId: negocioAId, mesaId: mesaAId, token: tokenA })
    const rB = await resolveMesaClienteCuenta({ negocioId: negocioAId, mesaId: mesaBId, token: tokenB })
    const rC = await resolveMesaClienteCuenta({ negocioId: negocioBId, mesaId: mesaCId, token: tokenC })
    expect(rA.status === "activa" && rA.cuenta.totalGeneral).toBe(111)
    expect(rB.status === "activa" && rB.cuenta.totalGeneral).toBe(222)
    expect(rC.status === "activa" && rC.cuenta.totalGeneral).toBe(333)
  })

  test("4. endpoint GET real: mesa/negocio inexistentes -> 200 genérico 'sin_sesion' (nunca 404 que confirme/niegue existencia)", async () => {
    const req = reqPublico("slug=negocio-que-no-existe-23b&mesa=1")
    const res = await getMesaCuentaPublica(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, status: "sin_sesion" })
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
  })

  test("endpoint GET real: token de la mesa A vía slug/mesa de la mesa B -> sin_sesion (nunca filtra la cuenta de B)", async () => {
    const negocioA = await db.negocio.findUniqueOrThrow({ where: { id: negocioAId }, select: { slug: true } })
    const mesaB = await db.mesa.findUniqueOrThrow({ where: { id: mesaBId }, select: { numero: true } })
    const req = reqPublico(`slug=${negocioA.slug}&mesa=${mesaB.numero}`, tokenA)
    const res = await getMesaCuentaPublica(req)
    const body = await res.json()
    expect(body).toEqual({ ok: true, status: "sin_sesion" })
  })

  test("endpoint GET real: token correcto para su propia mesa -> activa con la cuenta correcta", async () => {
    const negocioA = await db.negocio.findUniqueOrThrow({ where: { id: negocioAId }, select: { slug: true } })
    const mesaA = await db.mesa.findUniqueOrThrow({ where: { id: mesaAId }, select: { numero: true } })
    const req = reqPublico(`slug=${negocioA.slug}&mesa=${mesaA.numero}`, tokenA)
    const res = await getMesaCuentaPublica(req)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe("activa")
    expect(body.totalGeneral).toBe(111)
    expect(body.mesa.numero).toBe(mesaA.numero)
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
  })

  test("13. respuesta 'sin_sesion': nunca contiene pedidos/total/ocupacionId/mesaId/negocioId/token/hash", async () => {
    const req = reqPublico("slug=negocio-que-no-existe-23b&mesa=1")
    const res = await getMesaCuentaPublica(req)
    const body = await res.json()
    for (const campo of ["pedidos", "totalGeneral", "ocupacionId", "mesaId", "negocioId", "token", "tokenHash"]) {
      expect(body).not.toHaveProperty(campo)
    }
    expect(Object.keys(body).sort()).toEqual(["ok", "status"])
  })

  test("13. respuesta 'cerrada': nunca contiene pedidos/total/ocupacionId/mesaId/negocioId/token/hash", async () => {
    const mesaCierre = await crearMesa(negocioAId)
    const ocupacionCierre = await crearOcupacion(negocioAId, mesaCierre, "activa")
    const tokenCierre = await crearCredencial(ocupacionCierre)
    await db.sesionOcupacionMesa.update({ where: { id: ocupacionCierre }, data: { estado: "cerrada", cerradaEn: new Date() } })

    const negocioA = await db.negocio.findUniqueOrThrow({ where: { id: negocioAId }, select: { slug: true } })
    const mesa = await db.mesa.findUniqueOrThrow({ where: { id: mesaCierre }, select: { numero: true } })
    const req = reqPublico(`slug=${negocioA.slug}&mesa=${mesa.numero}`, tokenCierre)
    const res = await getMesaCuentaPublica(req)
    const body = await res.json()
    expect(body).toEqual({ ok: true, status: "cerrada" })
    for (const campo of ["pedidos", "totalGeneral", "ocupacionId", "mesaId", "negocioId", "token", "tokenHash"]) {
      expect(body).not.toHaveProperty(campo)
    }

    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain(MESA_OCCUPANCY_COOKIE_NAME)
    expect(setCookie.toLowerCase()).toMatch(/max-age=0/)
  })

  test("endpoint GET real: body nunca incluye ids internos completos (ocupacionId/mesaId/negocioId) ni el token/hash en texto", async () => {
    const negocioA = await db.negocio.findUniqueOrThrow({ where: { id: negocioAId }, select: { slug: true } })
    const mesaA = await db.mesa.findUniqueOrThrow({ where: { id: mesaAId }, select: { numero: true } })
    const req = reqPublico(`slug=${negocioA.slug}&mesa=${mesaA.numero}`, tokenA)
    const res = await getMesaCuentaPublica(req)
    const bodyText = await res.text()
    expect(bodyText).not.toContain(negocioAId)
    expect(bodyText).not.toContain(mesaAId)
    expect(bodyText).not.toContain(ocupacionAId)
    expect(bodyText).not.toContain(tokenA)
    expect(bodyText.toLowerCase()).not.toContain("hash")
  })

  test("endpoint GET real: slug/mesa faltantes -> 400", async () => {
    const req = reqPublico("slug=&mesa=")
    const res = await getMesaCuentaPublica(req)
    expect(res.status).toBe(400)
  })
})

// ---------------------------------------------------------------------------
// 23-B-CORRECCIÓN-1 — validación de entrada de slug/mesa (cardinalidad del
// rate limit, sección 12 del prompt de corrección). Ninguno de estos casos
// llega a tocar la base de datos ni el rate limiter — se rechazan por
// formato antes de ambos.
// ---------------------------------------------------------------------------

describe("23-B-CORRECCIÓN-1 — validación de slug/mesa antes del rate limit", () => {
  test("slug demasiado largo (81 caracteres) -> 400", async () => {
    const slugLargo = "a".repeat(81)
    const res = await getMesaCuentaPublica(reqPublico(`slug=${slugLargo}&mesa=1`))
    expect(res.status).toBe(400)
  })

  test("slug de 80 caracteres exactos (límite permitido) -> pasa la validación (puede seguir devolviendo sin_sesion, pero nunca 400)", async () => {
    const slugLimite = "a".repeat(80)
    const res = await getMesaCuentaPublica(reqPublico(`slug=${slugLimite}&mesa=1`))
    expect(res.status).toBe(200)
  })

  test("slug con mayúsculas se normaliza a minúsculas (no se rechaza) — igual que Negocio.slug siempre se genera en minúsculas", async () => {
    const res = await getMesaCuentaPublica(reqPublico(`slug=${encodeURIComponent("Slug-Con-Mayus")}&mesa=1`))
    expect(res.status).toBe(200) // normaliza y sigue de largo — no hay ningún negocio real con ese slug, responde sin_sesion genérico
    const body = await res.json()
    expect(body).toEqual({ ok: true, status: "sin_sesion" })
  })

  test("slug con caracteres fuera de [a-z0-9-] tras normalizar (espacios, símbolos, path traversal, null byte) -> 400", async () => {
    for (const slugInvalido of ["slug con espacio", "slug/../otro", "slug<script>", "slug%00nulo"]) {
      const res = await getMesaCuentaPublica(reqPublico(`slug=${encodeURIComponent(slugInvalido)}&mesa=1`))
      expect(res.status).toBe(400)
    }
  })

  test("mesa inválida (no numérica) -> 400", async () => {
    const res = await getMesaCuentaPublica(reqPublico("slug=algun-slug&mesa=abc"))
    expect(res.status).toBe(400)
  })

  test("mesa negativa -> 400", async () => {
    const res = await getMesaCuentaPublica(reqPublico("slug=algun-slug&mesa=-5"))
    expect(res.status).toBe(400)
  })

  test("mesa decimal -> 400", async () => {
    const res = await getMesaCuentaPublica(reqPublico("slug=algun-slug&mesa=5.5"))
    expect(res.status).toBe(400)
  })

  test("mesa cero -> 400", async () => {
    const res = await getMesaCuentaPublica(reqPublico("slug=algun-slug&mesa=0"))
    expect(res.status).toBe(400)
  })

  test("mesa en notación científica o con signo -> 400", async () => {
    for (const mesaInvalida of ["1e10", "+5", "5,000", "0x5"]) {
      const res = await getMesaCuentaPublica(reqPublico(`slug=algun-slug&mesa=${encodeURIComponent(mesaInvalida)}`))
      expect(res.status).toBe(400)
    }
  })

  test("mesa que excede el tope defensivo (100001) -> 400", async () => {
    const res = await getMesaCuentaPublica(reqPublico("slug=algun-slug&mesa=100001"))
    expect(res.status).toBe(400)
  })

  test("mesa en el tope exacto permitido (100000) -> pasa la validación (nunca 400)", async () => {
    const res = await getMesaCuentaPublica(reqPublico("slug=algun-slug&mesa=100000"))
    expect(res.status).toBe(200)
  })

  test("mesa como string absurdamente largo (20 dígitos) -> 400, nunca llega a construirse una clave de rate limit gigante", async () => {
    const res = await getMesaCuentaPublica(reqPublico(`slug=algun-slug&mesa=${"9".repeat(20)}`))
    expect(res.status).toBe(400)
  })

  test("múltiples variaciones manipuladas de slug/mesa en la MISMA llamada -> todas 400, ninguna consume el rate limiter", async () => {
    const variaciones = [
      "slug=" + "x".repeat(500) + "&mesa=1",
      "slug=valido&mesa=" + "9".repeat(50),
      "slug=" + encodeURIComponent("válido-con-ñ") + "&mesa=1",
      "slug=valido&mesa=NaN",
      "slug=valido&mesa=Infinity",
    ]
    for (const query of variaciones) {
      const res = await getMesaCuentaPublica(reqPublico(query))
      expect(res.status).toBe(400)
    }
  })
})
