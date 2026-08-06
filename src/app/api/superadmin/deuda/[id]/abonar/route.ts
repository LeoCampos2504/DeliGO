import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireSuperadminSession } from "@/lib/superadmin-auth"

// Seguridad-6B.2: abono de deuda de un negocio — dato financiero, nunca cacheable.
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const

async function verifySuperAdmin(req: NextRequest) {
  const auth = await requireSuperadminSession(req)
  if (!auth.ok) return null
  return auth.admin
}

type AbonoOutcome =
  | { kind: "not_found" }
  | { kind: "sin_deuda" }
  | { kind: "conflict" }
  | { kind: "abonado"; montoAbonado: number; negocioNombre: string }

// POST - Abonar (clear) deuda for a negocio
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifySuperAdmin(req)
    if (!user) return NextResponse.json({ error: "Acceso denegado" }, { status: 403, headers: NO_STORE_HEADERS })

    const { id } = await params

    // No acepta monto/negocioId/saldo desde body o query: el contrato existente no
    // soporta abono parcial (siempre abona el total leído en servidor); el negocio
    // objetivo sale exclusivamente del segmento de ruta [id], nunca del body.
    const outcome: AbonoOutcome = await db.$transaction(async (tx) => {
      const negocio = await tx.negocio.findUnique({
        where: { id },
        select: { id: true, nombre: true, deudaTarifa: true },
      })
      if (!negocio) return { kind: "not_found" as const }

      if (negocio.deudaTarifa <= 0) {
        return { kind: "sin_deuda" as const }
      }

      const montoAbonado = negocio.deudaTarifa

      // updateMany condicional: solo gana si deudaTarifa sigue siendo exactamente el
      // valor recién leído. Si una confirmación de recepción concurrente cargó una
      // tarifa nueva (u otro abono ya corrió) entre la lectura y este update, la
      // condición deja de cumplirse y el abono se aborta sin tocar nada — nunca un
      // reset absoluto a 0 que borraría ese cargo nuevo.
      const negocioUpdate = await tx.negocio.updateMany({
        where: { id, deudaTarifa: montoAbonado },
        data: { deudaTarifa: { decrement: montoAbonado } },
      })

      if (negocioUpdate.count !== 1) {
        return { kind: "conflict" as const }
      }

      // El historial se crea únicamente dentro de la misma transacción que ganó el
      // decremento. Si esta escritura falla, la excepción se propaga fuera de
      // `$transaction` sin capturarse aquí, y Prisma revierte también el decremento de
      // deudaTarifa ya aplicado arriba.
      await tx.deudaHistorial.create({
        data: {
          negocioId: negocio.id,
          negocioNombre: negocio.nombre,
          montoAbonado,
          deudaAnterior: montoAbonado,
          tipo: "abono_total",
        },
      })

      return { kind: "abonado" as const, montoAbonado, negocioNombre: negocio.nombre }
    })

    if (outcome.kind === "not_found") {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404, headers: NO_STORE_HEADERS })
    }

    if (outcome.kind === "sin_deuda") {
      return NextResponse.json({ error: "No hay deuda para abonar" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    if (outcome.kind === "conflict") {
      return NextResponse.json(
        { error: "La deuda cambió antes de completarse el abono. Actualizá y reintentá." },
        { status: 409, headers: NO_STORE_HEADERS }
      )
    }

    return NextResponse.json({
      ok: true,
      mensaje: `Deuda de ${outcome.montoAbonado.toLocaleString("es-AR", { style: "currency", currency: "ARS" })} saldada para ${outcome.negocioNombre}`,
      montoAbonado: outcome.montoAbonado,
    }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Error clearing debt:", error)
    return NextResponse.json({ error: "Error al abonar deuda" }, { status: 500, headers: NO_STORE_HEADERS })
  }
}
