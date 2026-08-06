import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

const productPublicSelect = {
  id: true,
  nombre: true,
  precio: true,
  categoria: true,
  imagenUrl: true,
  imagenesExtra: true,
  stock: true,
  descuentoActivo: true,
  tipoDescuento: true,
  valorDescuento: true,
  descripcion: true,
  secciones: true,
  recomendados: true,
  opcionesCompartidasIds: true,
  talles: true,
  colores: true,
  material: true,
  genero: true,
  agregados: {
    select: {
      agregado: {
        select: {
          id: true,
          nombre: true,
          precio: true,
          categoria: true,
          imagenUrl: true,
        },
      },
    },
  },
  ingredientes: {
    select: {
      ingrediente: {
        select: {
          id: true,
          nombre: true,
          categoria: true,
          imagenUrl: true,
        },
      },
    },
  },
} as const

type ProductRecord = {
  id: string
  nombre: string
  precio: number
  categoria: string
  imagenUrl: string | null
  imagenesExtra: unknown
  stock: boolean
  descuentoActivo: boolean
  tipoDescuento: string
  valorDescuento: number
  descripcion: string | null
  secciones: unknown
  recomendados: unknown
  opcionesCompartidasIds: unknown
  talles: unknown
  colores: unknown
  material: string
  genero: string
  agregados: Array<{
    agregado: {
      id: string
      nombre: string
      precio: number
      categoria: string
      imagenUrl: string | null
    }
  }>
  ingredientes: Array<{
    ingrediente: {
      id: string
      nombre: string
      categoria: string
      imagenUrl: string | null
    }
  }>
}

type ProductSection = {
  nombre: string
  opciones: string[]
  obligatorio: boolean
  maximo: number
}

type SharedOption = {
  nombre: string
  precio: number
}

// Helper to normalize opcionesCompartidasIds (old: string[], new: {id, obligatorio, maximo}[])
function normalizeOpcionesCompartidasIds(raw: unknown): Array<{ id: string; obligatorio: boolean; maximo: number }> {
  const parsed = safeParseJSON(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item: unknown) => {
      if (typeof item === "string") return { id: item, obligatorio: false, maximo: 0 }
      if (typeof item !== "object" || item === null) return null
      const obj = item as Record<string, unknown>
      const id = typeof obj.id === "string" ? obj.id : ""
      if (!id) return null
      return {
        id,
        obligatorio: typeof obj.obligatorio === "boolean" ? obj.obligatorio : false,
        maximo: typeof obj.maximo === "number" ? obj.maximo : 0,
      }
    })
    .filter((item): item is { id: string; obligatorio: boolean; maximo: number } => item !== null)
}

// Helper to parse JSON fields safely
function safeParseJSON(value: unknown, fallback: unknown = []) {
  if (!value) return fallback
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed) || (typeof parsed === "object" && parsed !== null)) {
        return parsed
      }
      return fallback
    } catch {
      return fallback
    }
  }
  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return value
  }
  return fallback
}

function normalizeStringArray(raw: unknown): string[] {
  const parsed = safeParseJSON(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter((item): item is string => typeof item === "string")
}

function normalizeProductSections(raw: unknown): ProductSection[] {
  const parsed = safeParseJSON(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item: unknown) => {
      if (typeof item !== "object" || item === null) return null
      const section = item as Record<string, unknown>
      return {
        nombre: typeof section.nombre === "string" ? section.nombre : "",
        opciones: Array.isArray(section.opciones)
          ? section.opciones.filter((option): option is string => typeof option === "string")
          : [],
        obligatorio: typeof section.obligatorio === "boolean" ? section.obligatorio : false,
        maximo: typeof section.maximo === "number" ? section.maximo : 0,
      }
    })
    .filter((section): section is ProductSection => section !== null)
}

function normalizeSharedOptions(raw: unknown): SharedOption[] {
  const parsed = safeParseJSON(raw, [])
  if (!Array.isArray(parsed)) return []
  return parsed
    .map((item: unknown) => {
      if (typeof item === "string") return { nombre: item, precio: 0 }
      if (typeof item !== "object" || item === null) return null
      const option = item as Record<string, unknown>
      const nombre = typeof option.nombre === "string" ? option.nombre : ""
      if (!nombre) return null
      return {
        nombre,
        precio: typeof option.precio === "number" ? option.precio : 0,
      }
    })
    .filter((option): option is SharedOption => option !== null)
}

function buildPublicProduct(product: ProductRecord) {
  const precioPromo =
    product.descuentoActivo && product.valorDescuento > 0
      ? product.tipoDescuento === "porcentaje"
        ? Math.round(product.precio * (1 - product.valorDescuento / 100) * 100) / 100
        : Math.round((product.precio - product.valorDescuento) * 100) / 100
      : null

  const descuentoLabel =
    product.descuentoActivo && product.valorDescuento > 0
      ? product.tipoDescuento === "porcentaje"
        ? `${product.valorDescuento}% OFF`
        : `$${product.valorDescuento} OFF`
      : null

  return {
    id: product.id,
    nombre: product.nombre,
    precio: product.precio,
    categoria: product.categoria,
    imagenUrl: product.imagenUrl,
    imagenesExtra: normalizeStringArray(product.imagenesExtra),
    stock: product.stock,
    descuentoActivo: product.descuentoActivo,
    tipoDescuento: product.tipoDescuento,
    valorDescuento: product.valorDescuento,
    descripcion: product.descripcion,
    secciones: normalizeProductSections(product.secciones),
    recomendados: normalizeStringArray(product.recomendados),
    talles: normalizeStringArray(product.talles),
    colores: normalizeStringArray(product.colores),
    material: product.material,
    genero: product.genero,
    opcionesCompartidasIds: normalizeOpcionesCompartidasIds(product.opcionesCompartidasIds),
    agregados: product.agregados.map((item) => ({
      id: item.agregado.id,
      nombre: item.agregado.nombre,
      precio: item.agregado.precio,
      categoria: item.agregado.categoria,
      imagenUrl: item.agregado.imagenUrl,
    })),
    ingredientes: product.ingredientes.map((item) => ({
      id: item.ingrediente.id,
      nombre: item.ingrediente.nombre,
      categoria: item.ingrediente.categoria,
      imagenUrl: item.ingrediente.imagenUrl,
    })),
    precioPromo,
    descuentoLabel,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const negocio = await db.negocio.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        nombre: true,
        rubro: true,
        aprobado: true,
        suspendido: true,
        colorPrincipal: true,
        mensajeBienvenida: true,
        categorias: true,
        horarios: true,
        horarioMode: true,
        abiertoManual: true,
        whatsapp: true,
        instagram: true,
        facebook: true,
        logoUrl: true,
        bannerUrl: true,
        ofreceDelivery: true,
        precioDelivery: true,
        deliveryMode: true,
        tiempoEntrega: true,
        lat: true,
        lng: true,
        // P0-C.1: server-only — nunca se devuelven directamente al cliente.
        // Solo se usan para calcular el booleano sanitizado mesaGeofenceReady.
        salonActivo: true,
        ubicacionCalibradaEn: true,
        mostrarVentas: true,
        aceptaTransferencia: true,
        aliasBancario: true,
        puntuacionPromedio: true,
        totalResenas: true,
        productos: {
          where: { eliminado: false },
          orderBy: { orden: "asc" },
          select: productPublicSelect,
        },
        opcionesCompartidas: {
          select: {
            id: true,
            nombre: true,
            opciones: true,
            obligatorio: true,
            maximo: true,
          },
        },
        secciones: {
          orderBy: { orden: "asc" },
          select: {
            id: true,
            nombre: true,
            orientacion: true,
            orden: true,
            color: true,
            productos: {
              where: { producto: { eliminado: false } },
              orderBy: { orden: "asc" },
              select: {
                producto: {
                  select: productPublicSelect,
                },
              },
            },
          },
        },
        resenas: {
          orderBy: { fecha: "desc" },
          take: 20,
          select: {
            id: true,
            clienteNombre: true,
            puntuacion: true,
            rapidez: true,
            calidad: true,
            precio: true,
            comentario: true,
            respuestaNegocio: true,
            fechaRespuesta: true,
            fecha: true,
          },
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

    const productos = negocio.productos.map(buildPublicProduct)

    const secciones = negocio.secciones.map((section) => ({
      id: section.id,
      nombre: section.nombre,
      orientacion: section.orientacion,
      orden: section.orden,
      color: section.color,
      productos: section.productos.map((item) => buildPublicProduct(item.producto)),
    }))

    const productosEnSecciones = new Set(
      negocio.secciones.flatMap((section) => section.productos.map((item) => item.producto.id))
    )

    const productosSinSeccion = productos.filter(
      (product) => !productosEnSecciones.has(product.id)
    )

    const resenas = negocio.resenas.map((review) => ({
      id: review.id,
      clienteNombre: review.clienteNombre,
      puntuacion: review.puntuacion,
      rapidez: review.rapidez,
      calidad: review.calidad,
      precio: review.precio,
      comentario: review.comentario,
      respuestaNegocio: review.respuestaNegocio,
      fechaRespuesta: review.fechaRespuesta ? review.fechaRespuesta.toISOString() : null,
      fecha: review.fecha.toISOString(),
    }))

    return NextResponse.json({
      id: negocio.id,
      slug: negocio.slug,
      nombre: negocio.nombre,
      rubro: negocio.rubro,
      colorPrincipal: negocio.colorPrincipal,
      mensajeBienvenida: negocio.mensajeBienvenida,
      logoUrl: negocio.logoUrl,
      bannerUrl: negocio.bannerUrl,
      categorias: normalizeStringArray(negocio.categorias),
      horarios: safeParseJSON(negocio.horarios, {}),
      horarioMode: negocio.horarioMode,
      abiertoManual: negocio.abiertoManual,
      whatsapp: negocio.whatsapp,
      instagram: negocio.instagram,
      facebook: negocio.facebook,
      ofreceDelivery: negocio.ofreceDelivery,
      precioDelivery: negocio.precioDelivery,
      deliveryMode: negocio.deliveryMode,
      tiempoEntrega: negocio.tiempoEntrega,
      lat: negocio.lat,
      lng: negocio.lng,
      // P0-C.1: booleano sanitizado — nunca se expone ubicacionCalibradaEn
      // (fecha de calibración) en esta respuesta pública.
      mesaGeofenceReady: !!(negocio.salonActivo && negocio.lat != null && negocio.lng != null && negocio.ubicacionCalibradaEn != null),
      // Tarea 20 (Dark Kitchen): a diferencia de `mesaGeofenceReady` (que
      // combina varias condiciones), este booleano expone EXCLUSIVAMENTE la
      // capacidad de Salón — la UI pública lo necesita para decidir si
      // `?mesa=N` activa el modo mesa en este negocio, o si debe degradar
      // silenciosamente al menú normal (nunca mostrar mesa/QR/cuenta si el
      // negocio no tiene Salón). No es información sensible: ya se puede
      // inferir indirectamente por el comportamiento observable de
      // mesa-geofence/mesa-cuenta/mesas-public, que ya lo usan como gate.
      salonHabilitado: negocio.salonActivo === true,
      mostrarVentas: negocio.mostrarVentas,
      aceptaTransferencia: negocio.aceptaTransferencia,
      aliasBancario: negocio.aliasBancario,
      puntuacionPromedio: negocio.puntuacionPromedio,
      totalResenas: negocio.totalResenas,
      opcionesCompartidas: negocio.opcionesCompartidas.map((option) => ({
        id: option.id,
        nombre: option.nombre,
        opciones: normalizeSharedOptions(option.opciones),
        obligatorio: option.obligatorio,
        maximo: option.maximo,
      })),
      productos,
      productosSinSeccion,
      secciones,
      resenas,
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
