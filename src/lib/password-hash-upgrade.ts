import { db } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import { safeErrorForLog } from "@/lib/log-safe-error"

// ============================================
// DeliGO — Rehash oportunista de password (PASSWORD-HASH-WORKFACTOR-MIGRATION)
// ============================================
// Aislado de src/lib/auth.ts a propósito: ese archivo exporta `UserType`,
// importado (sólo `import type`, erasable en compile-time — nunca código
// real en el bundle) desde 4 archivos client-side. Aunque auth.ts ya
// depende de Prisma para sesiones, no es "inequívocamente" server-only en
// el sentido más estricto — este módulo, que SÍ necesita Prisma con
// certeza para el CAS de rehash, vive separado para no ampliar esa
// superficie mixta. Nunca debe importarse desde código que se ejecute en
// el navegador.

export type PasswordHashAccountType = "cliente" | "negocio" | "repartidor" | "cuenta_operativa"

async function casUpdatePassword(
  accountType: PasswordHashAccountType,
  id: string,
  oldStoredHash: string,
  newHash: string
): Promise<number> {
  switch (accountType) {
    case "cliente": {
      const result = await db.cliente.updateMany({ where: { id, password: oldStoredHash }, data: { password: newHash } })
      return result.count
    }
    case "negocio": {
      const result = await db.negocio.updateMany({ where: { id, password: oldStoredHash }, data: { password: newHash } })
      return result.count
    }
    case "repartidor": {
      const result = await db.repartidor.updateMany({ where: { id, password: oldStoredHash }, data: { password: newHash } })
      return result.count
    }
    case "cuenta_operativa": {
      const result = await db.cuentaOperativa.updateMany({ where: { id, password: oldStoredHash }, data: { password: newHash } })
      return result.count
    }
  }
}

/**
 * Rehash oportunista tras un login YA exitoso (password correcta + todos los
 * status gates que aplican ya autorizaron el login). Debe llamarse desde el
 * punto exacto post-gates de cada tipo de cuenta — nunca antes.
 *
 * - `needsUpgrade===false` → no hace nada (ni deriva un hash nuevo ni toca la DB).
 * - Escritura vía CAS (`updateMany` condicionado a `id` + `oldStoredHash`):
 *   si el password cambió concurrentemente (reset/change de otro proceso)
 *   entre la verificación y este punto, `count===0` y NO se sobreescribe —
 *   comportamiento esperado, no un error, nunca se reintenta.
 * - Cualquier error (derivación del hash o el propio UPDATE) se loguea
 *   sanitizado (nunca password/hash/salt/email) y se ignora — el login que
 *   ya ocurrió nunca se bloquea por un fallo de esta mejora oportunista; el
 *   hash legacy queda para reintentar en un login futuro.
 */
export async function maybeUpgradePasswordHash(params: {
  accountType: PasswordHashAccountType
  accountId: string
  plainPassword: string
  oldStoredHash: string
  needsUpgrade: boolean
}): Promise<void> {
  if (!params.needsUpgrade) return

  try {
    const newHash = await hashPassword(params.plainPassword)
    await casUpdatePassword(params.accountType, params.accountId, params.oldStoredHash, newHash)
  } catch (error) {
    console.error("[PasswordHashUpgrade] rehash failed (non-blocking):", safeErrorForLog(error))
  }
}
