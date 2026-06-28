"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import type { ReactNode } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Armchair,
  ArrowLeft,
  Check,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Logo } from "@/components/shared/logo"
import { cn, formatPrice } from "@/lib/utils"

interface MesaOperativa {
  id: string
  numero: number
  nombre: string
  zona: string
  asignadaAMi: boolean
}

interface PanelData {
  empleado: {
    nombre: string
    codigo: string
  }
  negocio: {
    nombre: string
    slug: string
    colorPrincipal: string
  }
  mesas: MesaOperativa[]
}

interface MenuProduct {
  id: string
  nombre: string
  descripcion: string | null
  categoria: string
  precio: number
  precioPromo: number | null
  imagenUrl: string | null
  stock: boolean
  secciones: Array<{ nombre: string; opciones: string[]; obligatorio: boolean; maximo: number }>
  talles: string[]
  colores: string[]
  agregados: Array<{ id: string; nombre: string; precio: number; categoria: string }>
  ingredientes: Array<{ id: string; nombre: string; categoria: string }>
  opcionesCompartidas: Array<{
    id: string
    nombre: string
    opciones: Array<{ nombre: string; precio?: number }>
    obligatorio: boolean
    maximo: number
  }>
}

interface MenuData {
  negocio: {
    nombre: string
    slug: string
    colorPrincipal: string
    aceptaTransferencia: boolean
  }
  categorias: string[]
  productos: MenuProduct[]
}

type SectionSelection = string | Record<string, number>

interface OrderItem {
  key: string
  productoId: string
  nombre: string
  precio: number
  cantidad: number
  agregados: Array<{ id: string; nombre: string; precio: number }>
  secciones: Record<string, SectionSelection>
  ingredientesQuitados: string[]
  talle: string
  color: string
}

type PageState =
  | { status: "loading" }
  | { status: "ready"; panel: PanelData; menu: MenuData; mesa: MesaOperativa }
  | { status: "no-session" }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string }

export default function MozoPedidoManualPage() {
  const params = useParams<{ slug: string; mesaId: string }>()
  const router = useRouter()
  const slug = params.slug
  const mesaId = params.mesaId
  const [state, setState] = useState<PageState>({ status: "loading" })
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("Todas")
  const [cart, setCart] = useState<OrderItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(null)
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo")
  const [notas, setNotas] = useState("")
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  const salonHref = `/mozo/panel/${encodeURIComponent(slug)}`

  const loadPage = useCallback(async () => {
    setState({ status: "loading" })
    setSubmitError("")
    try {
      const [panelRes, menuRes] = await Promise.all([
        fetch(`/api/operativo/mozo/panel/${encodeURIComponent(slug)}`, { cache: "no-store" }),
        fetch(`/api/operativo/mozo/panel/${encodeURIComponent(slug)}/pedidos`, { cache: "no-store" }),
      ])

      const panelData = await panelRes.json().catch(() => ({}))
      const menuData = await menuRes.json().catch(() => ({}))

      if (panelRes.status === 401 || panelData.estado === "sin_sesion") {
        setState({ status: "no-session" })
        return
      }

      if (
        panelRes.status === 403 ||
        menuRes.status === 403 ||
        panelData.estado === "acceso_no_disponible"
      ) {
        setState({ status: "unavailable", message: "No tenes acceso operativo a este salon." })
        return
      }

      if (!panelRes.ok) throw new Error(panelData.error || "No se pudo cargar el salon")
      if (!menuRes.ok) throw new Error(menuData.error || "No se pudo cargar el menu")

      const mesa = (panelData.mesas || []).find((item: MesaOperativa) => item.id === mesaId)
      if (!mesa || !mesa.asignadaAMi) {
        setState({
          status: "unavailable",
          message: "La mesa no esta disponible para tomar pedidos con tu cuenta.",
        })
        return
      }

      setState({ status: "ready", panel: panelData, menu: menuData, mesa })
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar el pedido",
      })
    }
  }, [mesaId, slug])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  const categories = useMemo(() => {
    if (state.status !== "ready") return ["Todas"]
    const set = new Set(state.menu.categorias.filter(Boolean))
    for (const product of state.menu.productos) set.add(product.categoria)
    return ["Todas", ...Array.from(set)]
  }, [state])

  const filteredProducts = useMemo(() => {
    if (state.status !== "ready") return []
    const normalizedQuery = query.trim().toLowerCase()
    return state.menu.productos.filter((product) => {
      if (category !== "Todas" && product.categoria !== category) return false
      if (!normalizedQuery) return true
      return (
        product.nombre.toLowerCase().includes(normalizedQuery) ||
        (product.descripcion?.toLowerCase().includes(normalizedQuery) ?? false)
      )
    })
  }, [category, query, state])

  const total = useMemo(() => {
    return cart.reduce((sum, item) => sum + getOrderItemTotal(item), 0)
  }, [cart])

  const addItem = (item: OrderItem) => {
    setCart((current) => {
      const index = current.findIndex((existing) => existing.key === item.key)
      if (index < 0) return [...current, item]
      return current.map((existing, currentIndex) =>
        currentIndex === index
          ? { ...existing, cantidad: existing.cantidad + item.cantidad }
          : existing
      )
    })
    setSelectedProduct(null)
  }

  const updateQuantity = (key: string, cantidad: number) => {
    setCart((current) =>
      cantidad <= 0
        ? current.filter((item) => item.key !== key)
        : current.map((item) => (item.key === key ? { ...item, cantidad } : item))
    )
  }

  const submitOrder = async () => {
    if (state.status !== "ready") return
    setSubmitError("")
    setSubmitting(true)
    try {
      const res = await fetch(`/api/operativo/mozo/panel/${encodeURIComponent(slug)}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          idempotencyKey,
          mesaId: state.mesa.id,
          metodoPago,
          notas,
          items: cart.map((item) => ({
            productoId: item.productoId,
            cantidad: item.cantidad,
            agregados: item.agregados.map((agregado) => ({ id: agregado.id })),
            secciones: item.secciones,
            ingredientesQuitados: item.ingredientesQuitados,
            talle: item.talle,
            color: item.color,
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "No se pudo crear el pedido")
      }
      router.replace(salonHref)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No se pudo crear el pedido")
    } finally {
      setSubmitting(false)
    }
  }

  if (state.status === "loading") {
    return <OrderSkeleton />
  }

  if (state.status === "no-session") {
    return (
      <StatusPage
        title="Sesion requerida"
        description="Inicia sesion con tu cuenta de mozo para tomar pedidos."
        action={<Button asChild><Link href="/mozo/iniciar-sesion">Iniciar sesion</Link></Button>}
      />
    )
  }

  if (state.status === "unavailable") {
    return (
      <StatusPage
        title="Mesa no disponible"
        description={state.message}
        action={<Button asChild><Link href={salonHref}>Volver al salon</Link></Button>}
      />
    )
  }

  if (state.status === "error") {
    return (
      <StatusPage
        title="No pudimos cargar el pedido"
        description={state.message}
        action={
          <div className="grid gap-2">
            <Button onClick={loadPage}>Reintentar</Button>
            <Button asChild variant="outline"><Link href={salonHref}>Volver al salon</Link></Button>
          </div>
        }
      />
    )
  }

  const { panel, menu, mesa } = state

  return (
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="outline" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
              <Link href={salonHref} aria-label="Volver al salon">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <Logo size="sm" />
              <p className="truncate text-xs text-muted-foreground">
                {panel.negocio.nombre} - Mesa {mesa.numero}
              </p>
            </div>
          </div>
          <Badge className="rounded-full border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            Pedido manual
          </Badge>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-4 p-4 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
            <CardContent className="p-0">
              <div className="border-b border-border/60 bg-gradient-to-r from-amber-500/12 via-orange-500/8 to-transparent p-4">
                <Badge className="mb-3 rounded-full border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                  Mesa asignada
                </Badge>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      <Armchair className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">{panel.negocio.nombre}</p>
                      <h1 className="text-2xl font-extrabold tracking-tight">Mesa {mesa.numero}</h1>
                      <p className="text-sm text-muted-foreground">
                        {mesa.nombre || mesa.zona || "Salon"} - {panel.empleado.nombre} ({panel.empleado.codigo})
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="h-10 rounded-xl">
                    <Link href={salonHref}>Volver al salon</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar productos"
              className="h-11 rounded-xl pl-9"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <Button
                key={cat}
                type="button"
                size="sm"
                variant={category === cat ? "default" : "outline"}
                onClick={() => setCategory(cat)}
                className={cn(
                  "h-9 shrink-0 rounded-full",
                  category === cat && "bg-amber-500 text-white hover:bg-amber-600"
                )}
              >
                {cat}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setSelectedProduct(product)}
                className="group overflow-hidden rounded-2xl border border-border/60 bg-card p-3 text-left shadow-sm transition hover:border-amber-300/70 hover:shadow-md dark:hover:border-amber-800"
              >
                <div className="flex gap-3">
                  {product.imagenUrl ? (
                    <img
                      src={product.imagenUrl}
                      alt={product.nombre}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      <Store className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-semibold">{product.nombre}</p>
                    <p className="mt-1 text-sm font-bold text-amber-700 dark:text-amber-300">{formatPrice(product.precioPromo ?? product.precio)}</p>
                    {product.descripcion && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{product.descripcion}</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="h-fit overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm lg:sticky lg:top-20">
          <div className="border-b border-border/60 bg-gradient-to-r from-amber-500/10 to-transparent p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">Pedido</h2>
                <p className="text-sm text-muted-foreground">Mesa {mesa.numero}</p>
              </div>
              <Badge variant="outline" className="rounded-full">{cart.length} item{cart.length === 1 ? "" : "s"}</Badge>
            </div>
          </div>
          <div className="max-h-[55vh] overflow-y-auto p-4 lg:max-h-[calc(100vh-260px)]">
            {cart.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                Agrega productos para tomar el pedido.
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <CartLine key={item.key} item={item} onQuantityChange={updateQuantity} />
                ))}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={metodoPago === "efectivo" ? "default" : "outline"}
                  onClick={() => setMetodoPago("efectivo")}
                  className={cn("rounded-xl", metodoPago === "efectivo" && "bg-amber-500 text-white hover:bg-amber-600")}
                >
                  Efectivo
                </Button>
                <Button
                  type="button"
                  variant={metodoPago === "transferencia" ? "default" : "outline"}
                  onClick={() => setMetodoPago("transferencia")}
                  disabled={!menu.negocio.aceptaTransferencia}
                  className={cn("rounded-xl", metodoPago === "transferencia" && "bg-amber-500 text-white hover:bg-amber-600")}
                >
                  Transferencia
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notas-pedido">Notas</Label>
                <textarea
                  id="notas-pedido"
                  value={notas}
                  onChange={(event) => setNotas(event.target.value.slice(0, 500))}
                  className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Aclaraciones de cocina"
                />
              </div>

              {submitError && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {submitError}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-border/60 bg-background/60 p-4">
            <div className="mb-3 flex items-center justify-between font-bold">
              <span>Total estimado</span>
              <span className="text-lg text-amber-700 dark:text-amber-300">{formatPrice(total)}</span>
            </div>
            <Button className="h-11 w-full gap-2 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/15 hover:bg-amber-600" onClick={submitOrder} disabled={submitting || cart.length === 0}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Confirmar pedido
            </Button>
          </div>
        </aside>
      </div>

      {selectedProduct && (
        <ProductConfigurator
          product={selectedProduct}
          colorPrincipal={panel.negocio.colorPrincipal}
          onClose={() => setSelectedProduct(null)}
          onAdd={addItem}
        />
      )}
    </main>
  )
}

function ProductConfigurator({
  product,
  colorPrincipal,
  onClose,
  onAdd,
}: {
  product: MenuProduct
  colorPrincipal: string
  onClose: () => void
  onAdd: (item: OrderItem) => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [selectedAgregados, setSelectedAgregados] = useState<Record<string, { id: string; nombre: string; precio: number }>>({})
  const [selectedShared, setSelectedShared] = useState<Record<string, { id: string; nombre: string; precio: number }>>({})
  const [selectedSections, setSelectedSections] = useState<Record<string, SectionSelection>>({})
  const [removedIngredientes, setRemovedIngredientes] = useState<Record<string, string>>({})
  const [selectedTalle, setSelectedTalle] = useState("")
  const [selectedColor, setSelectedColor] = useState("")

  const selectedAddons = useMemo(() => {
    return [...Object.values(selectedAgregados), ...Object.values(selectedShared)]
  }, [selectedAgregados, selectedShared])

  const unitTotal = (product.precioPromo ?? product.precio) + selectedAddons.reduce((sum, addon) => sum + addon.precio, 0)
  const canAdd = useMemo(() => {
    const sectionsOk = product.secciones
      .filter((section) => section.obligatorio)
      .every((section) => {
        const value = selectedSections[section.nombre]
        if (!value) return false
        if (typeof value === "string") return !!value
        return Object.values(value).reduce((sum, current) => sum + current, 0) > 0
      })
    const sharedOk = product.opcionesCompartidas
      .filter((option) => option.obligatorio)
      .every((option) =>
        Object.keys(selectedShared).some((key) => key.startsWith(`${option.id}::`))
      )
    return sectionsOk && sharedOk
  }, [product.opcionesCompartidas, product.secciones, selectedSections, selectedShared])

  const toggleAgregado = (agregado: { id: string; nombre: string; precio: number }) => {
    setSelectedAgregados((current) => {
      const next = { ...current }
      if (next[agregado.id]) delete next[agregado.id]
      else next[agregado.id] = agregado
      return next
    })
  }

  const toggleShared = (
    group: MenuProduct["opcionesCompartidas"][number],
    option: { nombre: string; precio?: number }
  ) => {
    const key = `${group.id}::${option.nombre}`
    setSelectedShared((current) => {
      const next = { ...current }
      if (next[key]) {
        delete next[key]
        return next
      }
      const selectedCount = Object.keys(next).filter((itemKey) => itemKey.startsWith(`${group.id}::`)).length
      const max = group.maximo > 0 ? group.maximo : 1
      if (selectedCount >= max) return next
      next[key] = {
        id: key,
        nombre: option.nombre,
        precio: typeof option.precio === "number" ? option.precio : 0,
      }
      return next
    })
  }

  const setSectionValue = (section: MenuProduct["secciones"][number], option: string, delta?: number) => {
    setSelectedSections((current) => {
      if (section.maximo > 1) {
        const currentValue = typeof current[section.nombre] === "object"
          ? { ...(current[section.nombre] as Record<string, number>) }
          : {}
        const nextQuantity = Math.max(0, (currentValue[option] || 0) + (delta ?? 1))
        if (nextQuantity === 0) delete currentValue[option]
        else currentValue[option] = nextQuantity

        const totalSelected = Object.values(currentValue).reduce((sum, value) => sum + value, 0)
        if (section.maximo > 0 && totalSelected > section.maximo) return current
        return { ...current, [section.nombre]: currentValue }
      }

      return { ...current, [section.nombre]: option }
    })
  }

  const addConfiguredProduct = () => {
    const item: OrderItem = {
      key: buildOrderItemKey({
        productoId: product.id,
        agregados: selectedAddons,
        secciones: selectedSections,
        ingredientesQuitados: Object.values(removedIngredientes),
        talle: selectedTalle,
        color: selectedColor,
      }),
      productoId: product.id,
      nombre: product.nombre,
      precio: product.precioPromo ?? product.precio,
      cantidad: quantity,
      agregados: selectedAddons,
      secciones: selectedSections,
      ingredientesQuitados: Object.values(removedIngredientes),
      talle: selectedTalle,
      color: selectedColor,
    }
    onAdd(item)
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
        <div className="shrink-0 border-b border-border/60 bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{product.categoria}</p>
                <h3 className="truncate text-lg font-bold">{product.nombre}</h3>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-28">
          <div className="space-y-5">
            {product.descripcion && <p className="text-sm text-muted-foreground">{product.descripcion}</p>}

            {product.talles.length > 0 && (
              <OptionGroup title="Talle">
                {product.talles.map((talle) => (
                  <ChoiceButton key={talle} active={selectedTalle === talle} onClick={() => setSelectedTalle(talle)}>
                    {talle}
                  </ChoiceButton>
                ))}
              </OptionGroup>
            )}

            {product.colores.length > 0 && (
              <OptionGroup title="Color">
                {product.colores.map((color) => (
                  <ChoiceButton key={color} active={selectedColor === color} onClick={() => setSelectedColor(color)}>
                    {color}
                  </ChoiceButton>
                ))}
              </OptionGroup>
            )}

            {product.secciones.map((section) => (
              <OptionGroup
                key={section.nombre}
                title={`${section.nombre}${section.obligatorio ? " *" : ""}`}
                description={section.maximo > 1 ? `Hasta ${section.maximo}` : undefined}
              >
                {section.opciones.map((option) => {
                  const selection = selectedSections[section.nombre]
                  const quantitySelected = typeof selection === "object" ? selection[option] || 0 : 0
                  if (section.maximo > 1) {
                    return (
                      <div key={option} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                        <span className="text-sm font-medium">{option}</span>
                        <QuantityStepper
                          value={quantitySelected}
                          onDecrease={() => setSectionValue(section, option, -1)}
                          onIncrease={() => setSectionValue(section, option, 1)}
                        />
                      </div>
                    )
                  }
                  return (
                    <ChoiceButton key={option} active={selection === option} onClick={() => setSectionValue(section, option)}>
                      {option}
                    </ChoiceButton>
                  )
                })}
              </OptionGroup>
            ))}

            {product.opcionesCompartidas.map((group) => (
              <OptionGroup
                key={group.id}
                title={`${group.nombre}${group.obligatorio ? " *" : ""}`}
                description={group.maximo > 0 ? `Hasta ${group.maximo}` : undefined}
              >
                {group.opciones.map((option) => {
                  const key = `${group.id}::${option.nombre}`
                  return (
                    <ChoiceButton key={key} active={!!selectedShared[key]} onClick={() => toggleShared(group, option)}>
                      <span>{option.nombre}</span>
                      {typeof option.precio === "number" && option.precio > 0 && (
                        <span className="text-xs text-muted-foreground">+{formatPrice(option.precio)}</span>
                      )}
                    </ChoiceButton>
                  )
                })}
              </OptionGroup>
            ))}

            {product.agregados.length > 0 && (
              <OptionGroup title="Agregados">
                {product.agregados.map((agregado) => (
                  <ChoiceButton key={agregado.id} active={!!selectedAgregados[agregado.id]} onClick={() => toggleAgregado(agregado)}>
                    <span>{agregado.nombre}</span>
                    {agregado.precio > 0 && <span className="text-xs text-muted-foreground">+{formatPrice(agregado.precio)}</span>}
                  </ChoiceButton>
                ))}
              </OptionGroup>
            )}

            {product.ingredientes.length > 0 && (
              <OptionGroup title="Quitar ingredientes">
                {product.ingredientes.map((ingrediente) => (
                  <ChoiceButton
                    key={ingrediente.id}
                    active={!!removedIngredientes[ingrediente.id]}
                    onClick={() => {
                      setRemovedIngredientes((current) => {
                        const next = { ...current }
                        if (next[ingrediente.id]) delete next[ingrediente.id]
                        else next[ingrediente.id] = ingrediente.nombre
                        return next
                      })
                    }}
                  >
                    Sin {ingrediente.nombre}
                  </ChoiceButton>
                ))}
              </OptionGroup>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <QuantityStepper
              value={quantity}
              onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
              onIncrease={() => setQuantity((current) => Math.min(99, current + 1))}
            />
            <p className="font-bold text-amber-700 dark:text-amber-300">{formatPrice(unitTotal * quantity)}</p>
          </div>
          <Button
            className="h-11 w-full rounded-xl bg-amber-500 text-white hover:bg-amber-600"
            disabled={!canAdd}
            onClick={addConfiguredProduct}
            style={{ backgroundColor: canAdd ? colorPrincipal : undefined }}
          >
            Agregar al pedido
          </Button>
        </div>
      </div>
    </div>
  )
}

function CartLine({
  item,
  onQuantityChange,
}: {
  item: OrderItem
  onQuantityChange: (key: string, quantity: number) => void
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{item.nombre}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {item.agregados.map((agregado) => (
              <Badge key={agregado.id} variant="outline" className="text-[10px]">
                + {agregado.nombre}
              </Badge>
            ))}
            {Object.entries(item.secciones).map(([section, value]) => (
              <Badge key={section} variant="outline" className="text-[10px]">
                {section}: {typeof value === "string" ? value : Object.entries(value).map(([name, quantity]) => `${name} x${quantity}`).join(", ")}
              </Badge>
            ))}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => onQuantityChange(item.key, 0)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <QuantityStepper
          value={item.cantidad}
          onDecrease={() => onQuantityChange(item.key, item.cantidad - 1)}
          onIncrease={() => onQuantityChange(item.key, item.cantidad + 1)}
        />
        <p className="font-bold">{formatPrice(getOrderItemTotal(item))}</p>
      </div>
    </div>
  )
}

function QuantityStepper({
  value,
  onDecrease,
  onIncrease,
}: {
  value: number
  onDecrease: () => void
  onIncrease: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={onDecrease}>
        {value <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
      </Button>
      <span className="w-7 text-center text-sm font-bold">{value}</span>
      <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-xl" onClick={onIncrease}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition",
        active
          ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
          : "border-border bg-card hover:border-amber-300/70 dark:hover:border-amber-800"
      )}
    >
      {children}
    </button>
  )
}

function OptionGroup({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold">{title}</h4>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

function StatusPage({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action: ReactNode
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
      </div>
      <Card className="relative w-full max-w-md rounded-2xl border-border/60 shadow-xl shadow-amber-950/5 dark:shadow-black/20">
        <CardContent className="space-y-4 p-5">
          <Logo size="sm" />
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div>{action}</div>
        </CardContent>
      </Card>
    </main>
  )
}

function OrderSkeleton() {
  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border/60 px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1">
              <Skeleton className="h-6 w-24 rounded-lg" />
              <Skeleton className="h-3 w-40 rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[1fr_380px]">
        <section className="space-y-4">
          <Card className="rounded-2xl border-border/60">
            <CardContent className="space-y-4 p-4">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-8 w-40 rounded-lg" />
              <Skeleton className="h-4 w-full max-w-md rounded-lg" />
            </CardContent>
          </Card>
          <Skeleton className="h-11 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </div>
        </section>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </main>
  )
}

function buildOrderItemKey(item: {
  productoId: string
  agregados: Array<{ id: string }>
  secciones: Record<string, SectionSelection>
  ingredientesQuitados: string[]
  talle: string
  color: string
}) {
  const sectionKey = Object.entries(item.secciones)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => {
      if (typeof value === "string") return `${name}:${value}`
      return `${name}:${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([option, quantity]) => `${option}x${quantity}`).join(",")}`
    })
    .join("|")
  return [
    item.productoId,
    item.agregados.map((agregado) => agregado.id).sort().join(","),
    sectionKey,
    item.ingredientesQuitados.slice().sort().join(","),
    item.talle,
    item.color,
  ].join("::")
}

function getOrderItemTotal(item: OrderItem) {
  return (item.precio + item.agregados.reduce((sum, agregado) => sum + agregado.precio, 0)) * item.cantidad
}
