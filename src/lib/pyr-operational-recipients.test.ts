// P2-T44-R1P2: contrato de resolvePyrOperationalRecipients — único
// responsable de traducir "negocio X" en "empleados PyR elegibles",
// factorizado desde notifyOperationsOrderCancelled/resolveSalonEmpleados
// para no triplicarlo entre notifyPyrNewOrder/notifyPyrNewReview/
// notifyPyrChatMessage. No envía Push, no persiste Notificacion.
import { beforeEach, describe, expect, mock, test } from "bun:test"

let findManyCalls: Array<{ where: Record<string, unknown> }> = []
let empleadosFixture: unknown[] = []

mock.module("@/lib/db", () => ({
  db: {
    empleado: {
      findMany: async (args: { where: Record<string, unknown> }) => {
        findManyCalls.push(args)
        return empleadosFixture
      },
    },
  },
}))

const { resolvePyrOperationalRecipients } = await import("./pyr-operational-recipients")

beforeEach(() => {
  findManyCalls = []
  empleadosFixture = [{ id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: null }]
})

describe("resolvePyrOperationalRecipients", () => {
  test("consulta exactamente negocioId, areaOperativa=pyr, activo/eliminado y cuentaOperativa activa", async () => {
    await resolvePyrOperationalRecipients("negocio-1")

    expect(findManyCalls.length).toBe(1)
    expect(findManyCalls[0].where).toEqual({
      negocioId: "negocio-1",
      activo: true,
      eliminado: false,
      areaOperativa: "pyr",
      cuentaOperativaId: { not: null },
      cuentaOperativa: { activo: true, eliminado: false },
    })
  })

  test("devuelve exactamente lo que resuelve la query, sin transformar filas", async () => {
    empleadosFixture = [
      { id: "empleado-1", cuentaOperativaId: "cuenta-1", pushSubscription: null },
      { id: "empleado-2", cuentaOperativaId: "cuenta-2", pushSubscription: "legacy" },
    ]
    const result = await resolvePyrOperationalRecipients("negocio-1")
    expect(result).toEqual(empleadosFixture as never)
  })

  test("negocio sin empleados PyR -> lista vacía, una sola query", async () => {
    empleadosFixture = []
    const result = await resolvePyrOperationalRecipients("negocio-2")
    expect(result).toEqual([])
    expect(findManyCalls.length).toBe(1)
  })

  test("negocioId distinto produce una query aislada por negocio (nunca global)", async () => {
    await resolvePyrOperationalRecipients("negocio-a")
    await resolvePyrOperationalRecipients("negocio-b")
    expect(findManyCalls[0].where.negocioId).toBe("negocio-a")
    expect(findManyCalls[1].where.negocioId).toBe("negocio-b")
  })
})
