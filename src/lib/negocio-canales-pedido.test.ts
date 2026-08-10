/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { tieneAlMenosUnCanalDePedido, SIN_CANALES_PEDIDO_ERROR } from "./negocio-canales-pedido"

describe("T20-DK1 — al menos un canal de pedido", () => {
  test("salón solo (delivery/retiro OFF) es válido", () => {
    expect(tieneAlMenosUnCanalDePedido({ salonActivo: true, ofreceDelivery: false, ofreceRetiro: false })).toBe(true)
  })

  test("solo delivery (salón/retiro OFF) es válido", () => {
    expect(tieneAlMenosUnCanalDePedido({ salonActivo: false, ofreceDelivery: true, ofreceRetiro: false })).toBe(true)
  })

  test("solo retiro (salón/delivery OFF) es válido", () => {
    expect(tieneAlMenosUnCanalDePedido({ salonActivo: false, ofreceDelivery: false, ofreceRetiro: true })).toBe(true)
  })

  test("delivery + retiro (salón OFF) es válido", () => {
    expect(tieneAlMenosUnCanalDePedido({ salonActivo: false, ofreceDelivery: true, ofreceRetiro: true })).toBe(true)
  })

  test("los tres canales activos es válido", () => {
    expect(tieneAlMenosUnCanalDePedido({ salonActivo: true, ofreceDelivery: true, ofreceRetiro: true })).toBe(true)
  })

  test("los tres canales apagados es inválido", () => {
    expect(tieneAlMenosUnCanalDePedido({ salonActivo: false, ofreceDelivery: false, ofreceRetiro: false })).toBe(false)
  })

  test("el mensaje de error no menciona ningún dato interno", () => {
    expect(SIN_CANALES_PEDIDO_ERROR).not.toMatch(/negocioId|prisma|sql/i)
  })
})
