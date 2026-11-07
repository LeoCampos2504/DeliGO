/// <reference types="bun-types" />

// ============================================
// F4-C3 — data model and SQL invariants of commercial exchanges (REAL ephemeral PostgreSQL)
// ============================================
// No exchange service exists yet (F4-C4): these tests write the rows directly,
// the way that service will (return of what goes out → linked CAMBIO sale →
// CambioVenta → internal credit cobro → real cobro of the charged difference,
// all in ONE transaction), and prove that PostgreSQL itself accepts only the
// coherent shapes: exact amounts, one difference at a time, one credit per
// exchange, same business everywhere, an open shift, the credit never in the
// ledger, cobros of the linked sale = its total, immutability, and the F4-A
// refund of exactly the refundable amount. Isolated fixtures (random ids).

import { afterAll, describe, expect, setDefaultTimeout, test } from "bun:test"
import { randomUUID } from "crypto"
import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"
import { parseVentaCajaRequestBody, registrarVentaCaja } from "@/lib/caja-venta-service"
import { registrarDevolucionVenta, registrarReintegroDevolucion } from "@/lib/caja-devoluciones-service"
import { cerrarTurnoCaja } from "@/lib/caja-turnos-service"
import { METODO_COBRO_CREDITO_CAMBIO, METODO_PAGO_VENTA_CAMBIO } from "@/lib/caja-venta"

setDefaultTimeout(240_000)

const testDatabaseUrl = process.env.DELIGO_TEST_DATABASE_URL
const isEphemeralIntegrationDb = process.env.DELIGO_EPHEMERAL_TEST_DB === "1"
if (!testDatabaseUrl || process.env.DATABASE_URL !== testDatabaseUrl) {
  throw new Error("Este test de integración requiere DELIGO_TEST_DATABASE_URL y DATABASE_URL apuntando a la misma base de prueba.")
}
const declaredEnvironment = process.env.DELIGO_ENVIRONMENT ?? process.env.RAILWAY_ENVIRONMENT_NAME ?? process.env.APP_ENV
if (!declaredEnvironment || declaredEnvironment.toUpperCase() !== "TESTING") {
  throw new Error("La suite F4-C3 sólo puede ejecutarse con DELIGO_ENVIRONMENT=TESTING.")
}

// Writes real rows: only against the ephemeral test database.
const ephemeralTest = isEphemeralIntegrationDb ? test : test.skip

afterAll(async () => {
  await db.$disconnect()
})

const D = (v: string | number) => new Prisma.Decimal(String(v))
type Tx = Prisma.TransactionClient

async function crearNegocio() {
  const suffix = randomUUID()
  return db.negocio.create({
    data: {
      slug: `test-f4c3-${suffix}`,
      nombre: `Test F4-C3 ${suffix}`,
      usuario: `test-f4c3-${suffix}`,
      email: `test-f4c3-${suffix}@example.test`,
      password: "fixture",
      rubro: "negocio",
      aprobado: true,
      suspendido: false,
      empleadosActivos: true,
      salonActivo: true,
      cajaTurnosModo: "OPCIONAL",
    },
  })
}

async function fixture() {
  const negocio = await crearNegocio()
  const saphirus = await db.producto.create({ data: { nombre: "Saphirus", precio: 2000, negocioId: negocio.id } })
  const redmi = await db.producto.create({ data: { nombre: "Redmi", precio: 1000, negocioId: negocio.id } })
  const vendida = await registrarVentaCaja(db, { negocioId: negocio.id, actor: { tipo: "NEGOCIO" }, metodoPago: "EFECTIVO", lines: [{ productoId: saphirus.id, cantidad: 2 }], idempotencyKey: randomUUID() })
  if (!vendida.ok) throw new Error(vendida.error)
  return { negocio, saphirus, redmi, original: vendida.venta }
}
type Fixture = Awaited<ReturnType<typeof fixture>>

// Amounts of an exchange (§5): salida = devuelto, entrada = new sale total.
function importes(salida: number, entrada: number) {
  const credito = Math.min(salida, entrada)
  return { salida, entrada, credito, cobrada: Math.max(0, entrada - salida), reintegro: Math.max(0, salida - entrada) }
}

interface Opciones {
  salida?: number
  entrada?: number
  /** overrides written to the CambioVenta row (to attack the checks) */
  cambio?: Partial<Prisma.CambioVentaUncheckedCreateInput>
  /** overrides of the new sale */
  venta?: Partial<Prisma.VentaUncheckedCreateInput>
  credito?: "omitir" | "doble" | number
  /** real cobros of the new sale (default: one EFECTIVO for the charged difference) */
  reales?: number[]
  compensado?: number
  turnoCajaId?: string | null
  idempotencyKey?: string
}

/** Writes one exchange exactly as the F4-C4 service will, inside the given transaction. */
async function escribirCambio(tx: Tx, f: Fixture, o: Opciones = {}) {
  const m = importes(o.salida ?? 2000, o.entrada ?? 3500)
  const devolucion = await tx.devolucionVenta.create({
    data: {
      negocioId: f.negocio.id,
      ventaId: f.original.id,
      tipo: "DEVOLUCION_PARCIAL",
      motivo: "Cambio por otro producto",
      actorTipo: "NEGOCIO",
      actorId: f.negocio.id,
      importeDecimal: D(m.salida),
      importeCompensadoDecimal: D(o.compensado ?? m.credito),
      metodoPagoVenta: "EFECTIVO",
      reintegroEstado: m.reintegro > 0 ? "PENDIENTE" : "NO_CORRESPONDE",
      idempotencyKey: randomUUID(),
      idempotencyFingerprint: "f4c3",
      items: { create: [{ negocioId: f.negocio.id, ventaId: f.original.id, ventaItemId: f.original.items[0].id, cantidad: m.salida / 2000, importeDecimal: D(m.salida), stockResultado: "NO_REINGRESA" }] },
    },
  })
  const nueva = await tx.venta.create({
    data: {
      negocioId: f.negocio.id,
      total: m.entrada,
      totalDecimal: D(m.entrada),
      metodoPago: METODO_PAGO_VENTA_CAMBIO,
      cantidadItems: m.entrada / 1000,
      actorTipo: "NEGOCIO",
      actorId: f.negocio.id,
      ventaOrigenId: f.original.id,
      vinculoTipo: "CAMBIO",
      ...o.venta,
      items: { create: [{ productoId: f.redmi.id, nombre: "Redmi", precio: 1000, cantidad: m.entrada / 1000, subtotal: m.entrada, subtotalDecimal: D(m.entrada) }] },
    },
  })
  const cambio = await tx.cambioVenta.create({
    data: {
      negocioId: f.negocio.id,
      ventaOrigenId: f.original.id,
      devolucionId: devolucion.id,
      ventaNuevaId: nueva.id,
      importeSalidaDecimal: D(m.salida),
      importeEntradaDecimal: D(m.entrada),
      creditoAplicadoDecimal: D(m.credito),
      diferenciaCobradaDecimal: D(m.cobrada),
      diferenciaReintegroDecimal: D(m.reintegro),
      liquidacion: m.cobrada > 0 ? "COBRO" : m.reintegro > 0 ? "REINTEGRO" : "SIN_DIFERENCIA",
      actorTipo: "NEGOCIO",
      actorId: f.negocio.id,
      turnoCajaId: o.turnoCajaId ?? null,
      motivo: "El cliente prefirió otro producto",
      idempotencyKey: o.idempotencyKey ?? randomUUID(),
      idempotencyFingerprint: "f4c3",
      ...o.cambio,
    },
  })
  const creditoImporte = typeof o.credito === "number" ? o.credito : m.credito
  if (o.credito !== "omitir" && creditoImporte > 0) {
    await tx.cobroVenta.create({ data: { negocioId: f.negocio.id, ventaId: nueva.id, metodo: METODO_COBRO_CREDITO_CAMBIO, importe: creditoImporte, importeDecimal: D(creditoImporte), cambioVentaId: cambio.id } })
    if (o.credito === "doble") {
      await tx.cobroVenta.create({ data: { negocioId: f.negocio.id, ventaId: nueva.id, metodo: METODO_COBRO_CREDITO_CAMBIO, importe: creditoImporte, importeDecimal: D(creditoImporte), cambioVentaId: cambio.id } })
    }
  }
  for (const real of o.reales ?? (m.cobrada > 0 ? [m.cobrada] : [])) {
    await tx.cobroVenta.create({ data: { negocioId: f.negocio.id, ventaId: nueva.id, metodo: "EFECTIVO", importe: real, importeDecimal: D(real) } })
  }
  return { devolucion, nueva, cambio, m }
}

const tx = <T>(fn: (tx: Tx) => Promise<T>) => db.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 15_000 })

async function conteos(negocioId: string) {
  const [cambios, devoluciones, ventas, cobros, operaciones] = await Promise.all([
    db.cambioVenta.count({ where: { negocioId } }),
    db.devolucionVenta.count({ where: { negocioId } }),
    db.venta.count({ where: { negocioId } }),
    db.cobroVenta.count({ where: { negocioId } }),
    db.operacionFinanciera.count({ where: { negocioId } }),
  ])
  return { cambios, devoluciones, ventas, cobros, operaciones }
}

/** The promise must fail with `pattern` (SQL exception text or constraint name) and write nothing. */
async function expectRechazo(f: Fixture, run: () => Promise<unknown>, pattern: RegExp) {
  const antes = await conteos(f.negocio.id)
  let error: unknown
  try {
    await run()
  } catch (e) {
    error = e
  }
  expect(error).toBeDefined()
  expect(String((error as Error)?.message ?? error)).toMatch(pattern)
  expect(await conteos(f.negocio.id)).toEqual(antes)
}

describe("F4-C3 — a coherent exchange is accepted (cases A, C, D)", () => {
  ephemeralTest("D (more expensive), A (same value) and C (cheaper) commit with exact amounts; no ledger entry for the credit", async () => {
    for (const [salida, entrada, liquidacion] of [[2000, 3500, "COBRO"], [2000, 2000, "SIN_DIFERENCIA"], [2000, 1000, "REINTEGRO"]] as const) {
      const f = await fixture()
      const r = await tx((t) => escribirCambio(t, f, { salida, entrada }))
      const cambio = await db.cambioVenta.findUniqueOrThrow({ where: { id: r.cambio.id }, include: { cobroCredito: true, devolucion: true, ventaNueva: { include: { cobros: true } } } })
      expect(cambio.liquidacion).toBe(liquidacion)
      expect(cambio.cobroCredito?.importeDecimal?.toFixed(2)).toBe(Math.min(salida, entrada).toFixed(2))
      expect(cambio.devolucion.importeCompensadoDecimal.toFixed(2)).toBe(Math.min(salida, entrada).toFixed(2))
      expect(cambio.ventaNueva.cobros.reduce((a, c) => a.plus(c.importeDecimal!), D(0)).toFixed(2)).toBe(entrada.toFixed(2))
      expect(cambio.ventaNueva).toMatchObject({ metodoPago: "CAMBIO", vinculoTipo: "CAMBIO", ventaOrigenId: f.original.id })
      // the internal credit never entered the ledger (only the original cash sale did)
      expect(await db.operacionFinanciera.count({ where: { negocioId: f.negocio.id } })).toBe(1)
    }
  })

  ephemeralTest("historical shapes are untouched: engine sales have no link, F4-A returns compensate 0 and refund their whole amount", async () => {
    const f = await fixture()
    expect(f.original).toMatchObject({ ventaOrigenId: null, vinculoTipo: null, metodoPago: "EFECTIVO" })
    const dev = await registrarDevolucionVenta(db, {
      negocioId: f.negocio.id,
      actor: { tipo: "NEGOCIO" },
      ventaId: f.original.id,
      idempotencyKey: randomUUID(),
      solicitud: { tipo: "DEVOLUCION_PARCIAL", motivo: "Devolución común", reintegro: { modo: "REALIZADO", medio: "EFECTIVO" }, lineas: [{ ventaItemId: f.original.items[0].id, cantidad: D(1), reingresaStock: false }], cajaFisicaId: null },
    })
    expect(dev.ok).toBe(true)
    const row = await db.devolucionVenta.findUniqueOrThrow({ where: { id: dev.ok ? dev.value.devolucion.id : "" }, include: { reintegroOperacion: { include: { movimientos: true } } } })
    expect(row.importeCompensadoDecimal.toFixed(2)).toBe("0.00")
    expect(row.reintegroOperacion!.movimientos.map((m) => m.importeDecimal!.toFixed(2))).toEqual(["-2000.00"])
    // the owner's sale JSON keeps its contract: no link columns
    const { ventaCajaParaRespuesta } = await import("@/lib/caja-venta-service")
    expect(Object.keys(ventaCajaParaRespuesta(f.original))).not.toEqual(expect.arrayContaining(["ventaOrigenId"]))
    expect(Object.keys(ventaCajaParaRespuesta(f.original))).not.toContain("vinculoTipo")
  })

  ephemeralTest("the normal checkout still rejects CAMBIO and CREDITO_CAMBIO as payment methods", () => {
    expect(parseVentaCajaRequestBody({ metodoPago: "CAMBIO", items: [{ productoId: "p", cantidad: 1 }] }).ok).toBe(false)
    expect(parseVentaCajaRequestBody({ metodoPago: "CREDITO_CAMBIO", items: [{ productoId: "p", cantidad: 1 }] }).ok).toBe(false)
  })
})

describe("F4-C3 — amounts are enforced by PostgreSQL", () => {
  ephemeralTest("inconsistent amounts, both differences, negatives and an incoherent settlement are rejected", async () => {
    const f = await fixture()
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { cambio: { importeSalidaDecimal: D(2100) } })), /cambios_venta_importes_cuadran_check|must match its return/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { cambio: { diferenciaReintegroDecimal: D(100), importeSalidaDecimal: D(2100), creditoAplicadoDecimal: D(2000) } })), /cambios_venta_|must match/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { cambio: { diferenciaCobradaDecimal: D(-1500) } })), /cambios_venta_importes/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { cambio: { liquidacion: "SIN_DIFERENCIA" } })), /cambios_venta_liquidacion_check/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { cambio: { liquidacion: "OTRA" } })), /cambios_venta_liquidacion_check/)
    // both a charge and a refund at once: amounts that add up and match the return and the new sale
    // (credit 1.500 compensated) still violate the CHECK constraints of the exchange row itself
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { compensado: 1500, credito: 1500, reales: [2000], cambio: { creditoAplicadoDecimal: D(1500), diferenciaCobradaDecimal: D(2000), diferenciaReintegroDecimal: D(500) } })), /cambios_venta_(una_diferencia|importes_cuadran)_check/)
  })

  ephemeralTest("the exchange must match its return and its new sale; the compensated amount must equal the credit", async () => {
    const f = await fixture()
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { compensado: 1500 })), /must match its return/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { cambio: { importeEntradaDecimal: D(3000), diferenciaCobradaDecimal: D(1000) } })), /must match its new sale/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { compensado: 2500 })), /devoluciones_venta_compensado_check/)
  })
})

describe("F4-C3 — the internal credit is unique, exact and never money", () => {
  ephemeralTest("missing, duplicated or wrong credit, and real cobros ≠ charged difference, fail at commit", async () => {
    const f = await fixture()
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { credito: "omitir" })), /internal credit must be exactly the applied credit|payments must equal its total/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { credito: "doble" })), /cambioVentaId|Unique constraint/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { credito: 1500 })), /exchange credit must equal the applied credit/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { reales: [1000] })), /real payments must equal the charged difference|payments must equal its total/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { reales: [1500, 100] })), /real payments must equal the charged difference|payments must equal its total/)
  })

  ephemeralTest("CREDITO_CAMBIO only with its exchange; never on another sale; never in the ledger; immutable", async () => {
    const f = await fixture()
    const r = await tx((t) => escribirCambio(t, f))
    const credito = await db.cobroVenta.findUniqueOrThrow({ where: { cambioVentaId: r.cambio.id } })
    // without an exchange / a normal method pointing at an exchange
    await expectRechazo(f, () => db.cobroVenta.create({ data: { negocioId: f.negocio.id, ventaId: f.original.id, metodo: "CREDITO_CAMBIO", importe: 10, importeDecimal: D(10) } }), /cobros_venta_credito_cambio_check/)
    await expectRechazo(f, () => db.cobroVenta.create({ data: { negocioId: f.negocio.id, ventaId: r.nueva.id, metodo: "EFECTIVO", importe: 2000, importeDecimal: D(2000), cambioVentaId: r.cambio.id } }), /cobros_venta_credito_cambio_check|cambioVentaId|Unique constraint/)
    // a second credit for the same exchange (reuse)
    await expectRechazo(f, () => db.cobroVenta.create({ data: { negocioId: f.negocio.id, ventaId: r.nueva.id, metodo: "CREDITO_CAMBIO", importe: 2000, importeDecimal: D(2000), cambioVentaId: r.cambio.id } }), /cambioVentaId|Unique constraint/)
    // the credit never becomes a financial operation
    await expectRechazo(f, () => db.operacionFinanciera.create({ data: { negocioId: f.negocio.id, tipo: "VENTA_COBRO", cobroVentaId: credito.id, actorTipo: "NEGOCIO", actorId: f.negocio.id } }), /never enters the ledger/)
    // immutable and never deleted on its own
    await expectRechazo(f, () => db.cobroVenta.update({ where: { id: credito.id }, data: { importe: 1 } }), /exchange credit is immutable/)
    await expectRechazo(f, () => db.cobroVenta.delete({ where: { id: credito.id } }), /exchange credit is immutable/)
    // an extra real cobro after commit breaks cobros = total
    await expectRechazo(f, () => db.cobroVenta.create({ data: { negocioId: f.negocio.id, ventaId: r.nueva.id, metodo: "EFECTIVO", importe: 1, importeDecimal: D(1) } }), /payments must equal its total/)
  })
})

describe("F4-C3 — links, business isolation, shifts and immutability", () => {
  ephemeralTest("a CAMBIO sale needs its exchange; CAMBIO method ⇔ CAMBIO link; links never change; ADICIONAL links within the business", async () => {
    const f = await fixture()
    const otro = await fixture()
    const base = { negocioId: f.negocio.id, total: 1000, totalDecimal: D(1000), cantidadItems: 1 }
    await expectRechazo(f, () => db.venta.create({ data: { ...base, metodoPago: "CAMBIO" } }), /ventas_caja_metodo_cambio_check/)
    await expectRechazo(f, () => db.venta.create({ data: { ...base, metodoPago: "EFECTIVO", ventaOrigenId: f.original.id, vinculoTipo: "CAMBIO" } }), /ventas_caja_metodo_cambio_check/)
    await expectRechazo(f, () => db.venta.create({ data: { ...base, metodoPago: "EFECTIVO", vinculoTipo: "ADICIONAL" } }), /ventas_caja_vinculo_check/)
    await expectRechazo(f, () => db.venta.create({ data: { ...base, metodoPago: "EFECTIVO", ventaOrigenId: f.original.id, vinculoTipo: "OTRO" } }), /ventas_caja_vinculo_check/)
    // a CAMBIO sale on its own (no exchange) fails at commit
    await expectRechazo(f, () => tx((t) => t.venta.create({ data: { ...base, metodoPago: "CAMBIO", ventaOrigenId: f.original.id, vinculoTipo: "CAMBIO", items: { create: [{ productoId: f.redmi.id, nombre: "Redmi", precio: 1000, cantidad: 1, subtotal: 1000 }] } } })), /exchange sale requires its exchange/)
    // ADICIONAL: allowed within the business, never across businesses
    const adicional = await db.venta.create({ data: { ...base, metodoPago: "EFECTIVO", ventaOrigenId: f.original.id, vinculoTipo: "ADICIONAL" } })
    await expectRechazo(f, () => db.venta.create({ data: { ...base, metodoPago: "EFECTIVO", ventaOrigenId: otro.original.id, vinculoTipo: "ADICIONAL" } }), /same business/)
    // the link is immutable; the F4-A sale lock (no-op UPDATE of another column) still works on linked sales
    await expectRechazo(f, () => db.venta.update({ where: { id: adicional.id }, data: { vinculoTipo: "CAMBIO" } }), /sale link is immutable|ventas_caja_metodo_cambio_check/)
    await expectRechazo(f, () => db.venta.update({ where: { id: adicional.id }, data: { ventaOrigenId: null, vinculoTipo: null } }), /sale link is immutable/)
    await db.$executeRaw`UPDATE "ventas_caja" SET "cantidadItems" = "cantidadItems" WHERE "id" = ${adicional.id}`
    // a sale with linked sales cannot be deleted on its own
    await expectRechazo(f, () => db.venta.delete({ where: { id: f.original.id } }), /Foreign key|foreign key|ventaOrigenId/)
  })

  ephemeralTest("every record of an exchange belongs to the same business; an exchange is immutable and never deleted on its own", async () => {
    const f = await fixture()
    const otro = await fixture()
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { cambio: { ventaOrigenId: otro.original.id } })), /same business|belong to the original sale/)
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { venta: { ventaOrigenId: otro.original.id } })), /same business/)
    const r = await tx((t) => escribirCambio(t, f))
    await expectRechazo(f, () => db.cambioVenta.update({ where: { id: r.cambio.id }, data: { motivo: "otro" } }), /sale exchange is immutable/)
    await expectRechazo(f, () => db.cambioVenta.delete({ where: { id: r.cambio.id } }), /sale exchange is immutable/)
    await expectRechazo(f, () => db.devolucionVenta.update({ where: { id: r.devolucion.id }, data: { importeCompensadoDecimal: D(0) } }), /compensated amount is immutable|sale return is immutable/)
    await expectRechazo(f, () => db.devolucionVenta.delete({ where: { id: r.devolucion.id } }), /Foreign key|foreign key|devolucionId/)
    // the same return or new sale can never back a second exchange
    await expectRechazo(f, () => db.cambioVenta.create({ data: { ...r.cambio, id: undefined, idempotencyKey: randomUUID(), advertencias: undefined } }), /devolucionId|ventaNuevaId|Unique constraint/)
    // a compensated return without its exchange fails at commit
    await expectRechazo(f, () => tx((t) => t.devolucionVenta.create({
      data: { negocioId: f.negocio.id, ventaId: f.original.id, tipo: "DEVOLUCION_PARCIAL", motivo: "x", actorTipo: "NEGOCIO", actorId: f.negocio.id, importeDecimal: D(0), importeCompensadoDecimal: D(0), metodoPagoVenta: "EFECTIVO", reintegroEstado: "NO_CORRESPONDE", idempotencyKey: randomUUID(), idempotencyFingerprint: "x" },
    }).then(() => t.$executeRaw`INSERT INTO "devoluciones_venta" ("id","negocioId","ventaId","tipo","motivo","actorTipo","actorId","importeDecimal","importeCompensadoDecimal","metodoPagoVenta","reintegroEstado","idempotencyKey","idempotencyFingerprint") VALUES (${randomUUID()}, ${f.negocio.id}, ${f.original.id}, 'DEVOLUCION_PARCIAL', 'x', 'NEGOCIO', ${f.negocio.id}, 10, 10, 'EFECTIVO', 'NO_CORRESPONDE', ${randomUUID()}, 'x')`)), /compensated sale return requires its exchange/)
  })

  ephemeralTest("the exchange's shift must be OPEN and of the same business (historical closings never move)", async () => {
    const f = await fixture()
    const abrir = async (negocioId: string, nombre: string) => {
      const caja = await db.cajaFisica.create({ data: { negocioId, nombre } })
      return db.turnoCaja.create({ data: { negocioId, cajaFisicaId: caja.id, responsableTipo: "NEGOCIO", responsableId: negocioId, fondoInicialDecimal: D(0), idempotencyKey: randomUUID(), idempotencyFingerprint: "x" } })
    }
    const turno = await abrir(f.negocio.id, "Caja F4-C3")
    const cierre = await cerrarTurnoCaja(db, { negocioId: f.negocio.id, turnoCajaId: turno.id, actor: { tipo: "NEGOCIO" }, efectivoContado: "0.00", idempotencyKey: randomUUID() })
    expect(cierre.ok).toBe(true)
    const cerrado = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })
    expect(cerrado.estado).not.toBe("ABIERTO")
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { turnoCajaId: turno.id })), /open shift of the same business/)
    const otro = await fixture()
    const ajeno = await abrir(otro.negocio.id, "Caja otro")
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { turnoCajaId: ajeno.id })), /open shift of the same business/)
    // an OPEN shift of the same business is accepted, and the closed shift's frozen snapshot never moved
    const abierto = await abrir(f.negocio.id, "Caja F4-C3 bis")
    const r = await tx((t) => escribirCambio(t, f, { turnoCajaId: abierto.id }))
    expect(r.cambio.turnoCajaId).toBe(abierto.id)
    const despues = await db.turnoCaja.findUniqueOrThrow({ where: { id: turno.id } })
    expect([despues.estado, despues.efectivoEsperadoDecimal?.toFixed(2), despues.efectivoContadoDecimal?.toFixed(2), despues.cerradoEn]).toEqual([cerrado.estado, cerrado.efectivoEsperadoDecimal?.toFixed(2), cerrado.efectivoContadoDecimal?.toFixed(2), cerrado.cerradoEn])
  })
})

describe("F4-C3 — F4-A refunds exactly the refundable amount", () => {
  ephemeralTest("case C: the pending refund of an exchange pays the difference (1.000), never the whole return (2.000)", async () => {
    const f = await fixture()
    const r = await tx((t) => escribirCambio(t, f, { salida: 2000, entrada: 1000 }))
    expect(r.devolucion.reintegroEstado).toBe("PENDIENTE")
    // a cash refund for more than what is refundable is rejected by SQL
    const cuenta = await db.cuentaFinanciera.findFirstOrThrow({ where: { negocioId: f.negocio.id } })
    await expectRechazo(f, () => tx(async (t) => {
      const op = await t.operacionFinanciera.create({ data: { negocioId: f.negocio.id, tipo: "DEVOLUCION_VENTA", actorTipo: "NEGOCIO", actorId: f.negocio.id, movimientos: { create: [{ negocioId: f.negocio.id, cuentaId: cuenta.id, importe: -2000, importeDecimal: D(-2000) }] } } })
      await t.devolucionVenta.update({ where: { id: r.devolucion.id }, data: { reintegroEstado: "REALIZADO", reintegroMedio: "EFECTIVO", reintegroRegistradoEn: new Date(), reintegroActorTipo: "NEGOCIO", reintegroActorId: f.negocio.id, reintegroOperacionId: op.id, reintegroIdempotencyKey: randomUUID() } })
    }), /refund must equal the refundable amount/)
    // the F4-A service pays exactly the refundable amount
    const pago = await registrarReintegroDevolucion(db, { negocioId: f.negocio.id, actor: { tipo: "NEGOCIO" }, devolucionId: r.devolucion.id, medio: "EFECTIVO", idempotencyKey: randomUUID() })
    expect(pago.ok).toBe(true)
    const row = await db.devolucionVenta.findUniqueOrThrow({ where: { id: r.devolucion.id }, include: { reintegroOperacion: { include: { movimientos: true } } } })
    expect(row.reintegroEstado).toBe("REALIZADO")
    expect(row.reintegroOperacion!.movimientos.map((m) => m.importeDecimal!.toFixed(2))).toEqual(["-1000.00"])
    // and only once
    const otraVez = await registrarReintegroDevolucion(db, { negocioId: f.negocio.id, actor: { tipo: "NEGOCIO" }, devolucionId: r.devolucion.id, medio: "EFECTIVO", idempotencyKey: randomUUID() })
    expect(otraVez).toMatchObject({ ok: false, code: "REINTEGRO_YA_REGISTRADO" })
  })
})

describe("F4-C3 — idempotency, concurrency and the business lifecycle", () => {
  ephemeralTest("the same Idempotency-Key never creates two exchanges, also concurrently", async () => {
    const f = await fixture()
    const key = randomUUID()
    await tx((t) => escribirCambio(t, f, { idempotencyKey: key }))
    await expectRechazo(f, () => tx((t) => escribirCambio(t, f, { idempotencyKey: key })), /idempotencyKey|Unique constraint/)
    const g = await fixture()
    const k2 = randomUUID()
    const res = await Promise.allSettled([tx((t) => escribirCambio(t, g, { idempotencyKey: k2, salida: 2000, entrada: 2000 })), tx((t) => escribirCambio(t, g, { idempotencyKey: k2, salida: 2000, entrada: 2000 }))])
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1)
    expect(await db.cambioVenta.count({ where: { negocioId: g.negocio.id } })).toBe(1)
    expect(await db.cobroVenta.count({ where: { negocioId: g.negocio.id, metodo: "CREDITO_CAMBIO" } })).toBe(1)
  })

  ephemeralTest("two exchanges racing for the last sold unit: the F4-A cap lets only one commit", async () => {
    const f = await fixture() // 2 units sold; each exchange returns 1 unit (2.000) → a third must fail
    await tx((t) => escribirCambio(t, f))
    const res = await Promise.allSettled([tx((t) => escribirCambio(t, f)), tx((t) => escribirCambio(t, f))])
    expect(res.filter((x) => x.status === "fulfilled")).toHaveLength(1)
    expect(await db.cambioVenta.count({ where: { negocioId: f.negocio.id } })).toBe(2)
    const devuelto = await db.devolucionVentaItem.aggregate({ where: { ventaItemId: f.original.items[0].id }, _sum: { cantidad: true } })
    expect(devuelto._sum.cantidad).toBe(2)
  })

  ephemeralTest("deleting the whole business still works (cascade), exchanges included", async () => {
    const f = await fixture()
    await tx((t) => escribirCambio(t, f))
    await db.negocio.delete({ where: { id: f.negocio.id } })
    expect(await db.cambioVenta.count({ where: { negocioId: f.negocio.id } })).toBe(0)
    expect(await db.venta.count({ where: { negocioId: f.negocio.id } })).toBe(0)
  })
})
