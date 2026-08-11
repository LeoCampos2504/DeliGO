import { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

// ============================================
// DeliGO — Enforcement anti-evasión de ClienteBloqueado (SEC-BLOCK-1)
// ============================================
// Señal fuerte = igualdad EXACTA de ClienteBloqueado.fingerprint contra
// deviceIdentity.deviceId (SEC-DEVICE-1: hash server-managed derivado de la
// cookie HttpOnly `deligo_device`) — nunca fuzzy/contains/regex. Ver
// auditoría SEC-BLOCK-0 (Policy E).
//
// La IP JAMÁS participa en el matching de este archivo: es una señal débil,
// compartible entre clientes reales (mismo hogar, misma red de oficina/wifi
// pública, mismo NAT de operador móvil) y nunca puede, por sí sola, disparar
// un bloqueo automático. Sigue guardándose como dato de contexto en cada fila
// ClienteBloqueado (igual que ya hacía src/app/api/denuncias/route.ts), pero
// ninguna función de acá la usa como criterio de coincidencia.

interface DeviceBlockRecordParams {
  clienteId: string
  clienteNombre: string
  deviceId: string
  ip: string
}

/**
 * Busca una fila ClienteBloqueado cuyo fingerprint coincide EXACTAMENTE con
 * `deviceId` y que NO pertenece a `currentClienteId` — huérfana (clienteId
 * null, p. ej. de una cuenta eliminada) o de una cuenta distinta. Un match acá
 * es la señal fuerte de evasión: la misma cookie de dispositivo server-managed
 * que ya causó un bloqueo está siendo reutilizada desde `currentClienteId`.
 *
 * Nota: `{ clienteId: { not: currentClienteId } }` solo, sin el `OR` con
 * `clienteId: null`, excluiría también las filas huérfanas (Postgres `<>`
 * nunca matchea NULL) — por eso ambas ramas son necesarias acá.
 */
export async function findForeignDeviceBlockMatch(
  deviceId: string,
  currentClienteId: string
): Promise<{ id: string; clienteId: string | null } | null> {
  if (!deviceId) return null
  return db.clienteBloqueado.findFirst({
    where: {
      fingerprint: deviceId,
      OR: [{ clienteId: null }, { clienteId: { not: currentClienteId } }],
    },
    select: { id: true, clienteId: true },
  })
}

/**
 * Asegura que exista una fila ClienteBloqueado para (clienteId, deviceId),
 * sin duplicar — mismo patrón dedupe-before-create ya usado en
 * src/app/api/denuncias/route.ts (findFirst + create condicional, sin
 * depender de una constraint única nueva). Se usa tanto para enriquecer el
 * registro de un cliente YA bloqueado (login, checkout) como, junto con
 * `applyDeviceEvasionAutoBlock`, para vincular el dispositivo evasor a una
 * cuenta recién auto-bloqueada.
 */
export async function ensureClienteBloqueadoRecordForDevice(
  client: Prisma.TransactionClient,
  params: DeviceBlockRecordParams
): Promise<void> {
  const { clienteId, clienteNombre, deviceId, ip } = params
  if (!deviceId) return

  const existing = await client.clienteBloqueado.findFirst({
    where: { clienteId, fingerprint: deviceId },
    select: { id: true },
  })
  if (existing) return

  await client.clienteBloqueado.create({
    data: {
      clienteId,
      clienteNombre,
      fingerprint: deviceId,
      ip: ip || "",
    },
  })
}

/**
 * Auto-bloqueo por evasión: se llama cuando `findForeignDeviceBlockMatch`
 * encontró una señal fuerte para una cuenta que todavía no estaba marcada
 * `bloqueado`. Marca `Cliente.bloqueado=true` / `bloqueadoFecha=now` y crea
 * (dedupe) la fila ClienteBloqueado que vincula el dispositivo evasor a esta
 * cuenta — atómico en una única transacción para que un fallo a mitad de
 * camino nunca deje el flag sin la fila, o viceversa.
 *
 * No invalida la sesión, no cancela pedidos existentes, no toca ningún otro
 * cliente — el llamador es responsable de rechazar el pedido en curso
 * después de esto (nunca se crea un Pedido para una cuenta recién marcada
 * bloqueada por esta función).
 */
export async function applyDeviceEvasionAutoBlock(params: DeviceBlockRecordParams): Promise<void> {
  const { clienteId, clienteNombre, deviceId, ip } = params
  await db.$transaction(async (tx) => {
    await tx.cliente.updateMany({
      where: { id: clienteId, bloqueado: false },
      data: { bloqueado: true, bloqueadoFecha: new Date() },
    })
    await ensureClienteBloqueadoRecordForDevice(tx, { clienteId, clienteNombre, deviceId, ip })
  })
}
