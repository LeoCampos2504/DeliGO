import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getUserFromToken, SESSION_COOKIE_NAME } from "@/lib/auth"

/**
 * Get the authenticated cliente from the request cookie.
 * Returns the cliente record or null if not authenticated / not a cliente.
 */
export async function getAuthenticatedCliente(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null

  const user = await getUserFromToken(token)
  if (!user || user.type !== "cliente") return null

  const cliente = await db.cliente.findUnique({
    where: { id: user.id },
    include: {
      direcciones: true,
      favoritos: { include: { negocio: { select: { id: true, nombre: true, slug: true, logoUrl: true, rubro: true } } } },
      _count: { select: { pedidos: true, resenas: true } },
    },
  })

  return cliente
}
