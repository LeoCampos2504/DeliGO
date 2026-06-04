import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Helper to normalize opcionesCompartidasIds (old: string[], new: {id, obligatorio, maximo}[])
function normalizeOpcionesCompartidasIds(raw: unknown): Array<{ id: string; obligatorio: boolean; maximo: number }> {
  const parsed = safeParseJSON(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed.map((item: unknown) => {
    if (typeof item === "string") return { id: item, obligatorio: false, maximo: 0 }
    const obj = item as { id?: string; obligatorio?: boolean; maximo?: number }
    return { id: obj.id ?? "", obligatorio: obj.obligatorio ?? false, maximo: obj.maximo ?? 0 }
  }).filter((c) => c.id)
}

// Helper to parse JSON fields safely
function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      // Accept both arrays and objects (e.g., horarios is an object)
      if (Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null)) {
        return parsed
      }
      return fallback
    } catch {
      return fallback
    }
  }
  // Already parsed — accept arrays and objects
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return value
  }
  return fallback
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const negocio = await db.negocio.findUnique({
      where: { slug },
      include: {
        productos: {
          orderBy: { orden: "asc" },
          include: {
            agregados: {
              include: {
                agregado: true,
              },
            },
            ingredientes: {
              include: {
                ingrediente: true,
              },
            },
          },
        },
        agregados: {
          orderBy: { categoria: "asc" },
        },
        ingredientes: {
          orderBy: { categoria: "asc" },
        },
        opcionesCompartidas: true,
        secciones: {
          include: {
            productos: {
              include: {
                producto: {
                  include: {
                    agregados: {
                      include: {
                        agregado: true,
                      },
                    },
                    ingredientes: {
                      include: {
                        ingrediente: true,
                      },
                    },
                  },
                },
              },
              orderBy: { orden: "asc" },
            },
          },
          orderBy: { orden: "asc" },
        },
        resenas: {
          orderBy: { fecha: "desc" },
          take: 20,
        },
        _count: {
          select: {
            pedidos: {
              where: { estado: "entregado" },
            },
          },
        },
      },
    })

    if (!negocio) {
      return NextResponse.json(
        { error: "Negocio no encontrado" },
        { status: 404 }
      )
    }

    if (!negocio.aprobado || negocio.suspendido) {
      return NextResponse.json(
        { error: "Negocio no disponible" },
        { status: 404 }
      )
    }

    // Transform the data for frontend consumption
    const productosTransformados = negocio.productos.map((p) => ({
      ...p,
      imagenesExtra: safeParseJSON(p.imagenesExtra, []),
      secciones: safeParseJSON(p.secciones, []),
      recomendados: safeParseJSON(p.recomendados, []),
      talles: safeParseJSON(p.talles, []),
      colores: safeParseJSON(p.colores, []),
      opcionesCompartidasIds: normalizeOpcionesCompartidasIds(p.opcionesCompartidasIds),
      agregados: p.agregados.map((pa) => ({
        id: pa.agregado.id,
        nombre: pa.agregado.nombre,
        precio: pa.agregado.precio,
        categoria: pa.agregado.categoria,
        imagenUrl: pa.agregado.imagenUrl,
      })),
      ingredientes: p.ingredientes.map((pi) => ({
        id: pi.ingrediente.id,
        nombre: pi.ingrediente.nombre,
        categoria: pi.ingrediente.categoria,
        imagenUrl: pi.ingrediente.imagenUrl,
      })),
      // Compute promo price
      precioPromo:
        p.descuentoActivo && p.valorDescuento > 0
          ? p.tipoDescuento === "porcentaje"
            ? Math.round(p.precio * (1 - p.valorDescuento / 100) * 100) / 100
            : Math.round((p.precio - p.valorDescuento) * 100) / 100
          : null,
      descuentoLabel:
        p.descuentoActivo && p.valorDescuento > 0
          ? p.tipoDescuento === "porcentaje"
            ? `${p.valorDescuento}% OFF`
            : `$${p.valorDescuento} OFF`
          : null,
    }))

    const seccionesTransformadas = negocio.secciones.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      orientacion: s.orientacion,
      orden: s.orden,
      color: s.color,
      productos: s.productos.map((sp) => {
        const p = sp.producto
        return {
          ...p,
          imagenesExtra: safeParseJSON(p.imagenesExtra, []),
          secciones: safeParseJSON(p.secciones, []),
          recomendados: safeParseJSON(p.recomendados, []),
          talles: safeParseJSON(p.talles, []),
          colores: safeParseJSON(p.colores, []),
          opcionesCompartidasIds: normalizeOpcionesCompartidasIds(p.opcionesCompartidasIds),
          agregados: p.agregados.map((pa) => ({
            id: pa.agregado.id,
            nombre: pa.agregado.nombre,
            precio: pa.agregado.precio,
            categoria: pa.agregado.categoria,
            imagenUrl: pa.agregado.imagenUrl,
          })),
          ingredientes: p.ingredientes.map((pi) => ({
            id: pi.ingrediente.id,
            nombre: pi.ingrediente.nombre,
            categoria: pi.ingrediente.categoria,
            imagenUrl: pi.ingrediente.imagenUrl,
          })),
          precioPromo:
            p.descuentoActivo && p.valorDescuento > 0
              ? p.tipoDescuento === "porcentaje"
                ? Math.round(p.precio * (1 - p.valorDescuento / 100) * 100) / 100
                : Math.round((p.precio - p.valorDescuento) * 100) / 100
              : null,
          descuentoLabel:
            p.descuentoActivo && p.valorDescuento > 0
              ? p.tipoDescuento === "porcentaje"
                ? `${p.valorDescuento}% OFF`
                : `$${p.valorDescuento} OFF`
              : null,
        }
      }),
    }))

    // Get IDs of products already in sections to exclude from the main grid
    const productosEnSecciones = new Set(
      negocio.secciones.flatMap((s) => s.productos.map((sp) => sp.productoId))
    )

    // Products not in any section go to the main grid
    const productosSinSeccion = productosTransformados.filter(
      (p) => !productosEnSecciones.has(p.id)
    )

    // Strip sensitive fields before sending
    const { password, pushSubscription, ...safeNegocio } = negocio

    return NextResponse.json({
      ...safeNegocio,
      categorias: safeParseJSON(negocio.categorias, []),
      agregadosCategorias: safeParseJSON(negocio.agregadosCategorias, []),
      ingredientesCategorias: safeParseJSON(negocio.ingredientesCategorias, []),
      horarios: safeParseJSON(negocio.horarios, {}),
      zonasDelivery: safeParseJSON(negocio.zonasDelivery, []),
      opcionesCompartidas: (negocio.opcionesCompartidas || []).map((oc) => ({
        ...oc,
        opciones: safeParseJSON(oc.opciones, []),
      })),
      productos: productosTransformados,
      productosSinSeccion,
      secciones: seccionesTransformadas,
      totalVentas: negocio._count.pedidos,
    })
  } catch (error) {
    console.error("Error fetching negocio:", error)
    return NextResponse.json(
      { error: "Error al obtener el negocio" },
      { status: 500 }
    )
  }
}
