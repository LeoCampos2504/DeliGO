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
  CheckCircle2,
  Loader2,
  LogOut,
  Minus,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  UserCheck,
  X,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn, formatPrice } from "@/lib/utils"

interface MesaOperativa {
  id: string
  numero: number
  nombre: string
  zona: string
  capacidad: number
  activa: boolean
  asignadaAMi: boolean
  asignadaAOtro: boolean
  pedidosActivos: Array<{
    estado: string
    total: number
  }>
  pedidosActivosCount: number
  pedidosActivosTotal: number
}

interface PanelData {
  estado: "operativo"
  empleado: {
    nombre: string
    codigo: string
    rol: string
    activo: boolean
  }
  negocio: {
    nombre: string
    slug: string
    colorPrincipal: string
    logoUrl: string | null
    salonActivo: boolean
  }
  resumen: {
    mesasActivas: number
    misMesas: number
    mesasConPedidos: number
  }
  mesas: MesaOperativa[]
  accionesDisponibles: string[]
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
    rubro: string
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
  | { status: "ready"; data: PanelData }
  | { status: "no-session" }
  | { status: "unavailable" }
  | { status: "error"; message: string }

const ESTADO_LABEL: Record<string, string> = {
  recibido: "Nuevo",
  preparando: "Preparando",
  listo_para_retirar: "Listo",
}

export default function MozoSalonPanelPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const slug = params.slug
  const [state, setState] = useState<PageState>({ status: "loading" })
  const [actionMesaId, setActionMesaId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [orderingMesa, setOrderingMesa] = useState<MesaOperativa | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  const loadPanel = useCallback(async () => {
    setState({ status: "loading" })
    setActionError(null)
    try {
      const res = await fetch(`/api/operativo/mozo/panel/${encodeURIComponent(slug)}`, {
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 401 || data.estado === "sin_sesion") {
        setState({ status: "no-session" })
        return
      }

      if (res.status === 403 || data.estado === "acceso_no_disponible") {
        setState({ status: "unavailable" })
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar el salon")
      }

      setState({ status: "ready", data })
    } catch {
      setState({
        status: "error",
        message: "No se pudo conectar. Revisa tu conexion e intenta de nuevo.",
      })
    }
  }, [slug])

  useEffect(() => {
    loadPanel()
  }, [loadPanel])

  const zonas = useMemo(() => {
    if (state.status !== "ready") return []
    const groups = new Map<string, MesaOperativa[]>()
    for (const mesa of state.data.mesas) {
      const key = mesa.zona || "Salon"
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(mesa)
    }
    return Array.from(groups.entries())
  }, [state])

  const handleMesaAction = async (mesa: MesaOperativa) => {
    setActionMesaId(mesa.id)
    setActionError(null)
    try {
      const res = await fetch(`/api/operativo/mozo/panel/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          mesaId: mesa.id,
          accion: mesa.asignadaAMi ? "liberar_mesa" : "tomar_mesa",
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.status === 401) {
        setState({ status: "no-session" })
        return
      }

      if (res.status === 403 || data.estado === "acceso_no_disponible") {
        setState({ status: "unavailable" })
        return
      }

      if (!res.ok) {
        throw new Error(data.error || "No se pudo completar la accion")
      }

      await loadPanel()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo completar la accion")
    } finally {
      setActionMesaId(null)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await fetch("/api/operativo/logout", {
        method: "POST",
        cache: "no-store",
      })
    } finally {
      setLoggingOut(false)
      router.replace("/mozo/iniciar-sesion")
    }
  }

  if (state.status === "loading") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" />
          <p className="text-sm font-medium">Cargando salon operativo</p>
        </div>
      </main>
    )
  }

  if (state.status === "no-session") {
    return (
      <StatusShell
        icon={<AlertTriangle className="h-6 w-6" />}
        title="Sesion requerida"
        description="Inicia sesion con tu cuenta de mozo para entrar al salon."
      >
        <Button asChild className="w-full">
          <Link href="/mozo/iniciar-sesion">Iniciar sesion</Link>
        </Button>
      </StatusShell>
    )
  }

  if (state.status === "unavailable") {
    return (
      <StatusShell
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Salon no disponible"
        description="No tenes acceso operativo activo para este salon. Volve al panel y elegi un negocio disponible."
      >
        <Button asChild className="w-full">
          <Link href="/mozo">Volver a mi panel</Link>
        </Button>
      </StatusShell>
    )
  }

  if (state.status === "error") {
    return (
      <StatusShell
        icon={<AlertTriangle className="h-6 w-6" />}
        title="No pudimos cargar el salon"
        description={state.message}
      >
        <Button className="w-full gap-2" onClick={loadPanel}>
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </StatusShell>
    )
  }

  const { data } = state

  return (
    <main className="min-h-screen bg-background p-4">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 py-4 sm:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="outline" className="w-fit gap-2">
            <Link href="/mozo">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
          <Button variant="outline" className="w-fit gap-2" onClick={handleLogout} disabled={loggingOut}>
            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Cerrar sesion
          </Button>
        </div>

        <section className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <Badge className="w-fit gap-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Salon operativo
              </Badge>
              <div>
                <h1 className="text-2xl font-bold tracking-normal sm:text-3xl">
                  {data.negocio.nombre}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.empleado.nombre} - {data.empleado.codigo}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard icon={<Armchair className="h-4 w-4" />} label="Mesas activas" value={data.resumen.mesasActivas} />
          <SummaryCard icon={<UserCheck className="h-4 w-4" />} label="Mis mesas" value={data.resumen.misMesas} />
          <SummaryCard icon={<ShoppingBag className="h-4 w-4" />} label="Con pedidos" value={data.resumen.mesasConPedidos} />
        </div>

        <div className="space-y-4">
          {actionError && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </p>
          )}

          {zonas.length === 0 ? (
            <Card className="rounded-xl border-border/60">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No hay mesas activas en este salon.
              </CardContent>
            </Card>
          ) : (
            zonas.map(([zona, mesas]) => (
              <section key={zona} className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">{zona}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {mesas.map((mesa) => (
                    <MesaCard
                      key={mesa.id}
                      mesa={mesa}
                      loading={actionMesaId === mesa.id}
                      actionDisabled={!!actionMesaId}
                      onMesaAction={() => handleMesaAction(mesa)}
                      onOrder={() => setOrderingMesa(mesa)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {orderingMesa && (
        <ManualOrderSheet
          slug={slug}
          mesa={orderingMesa}
          negocio={data.negocio}
          onClose={() => setOrderingMesa(null)}
          onCreated={async () => {
            setOrderingMesa(null)
            await loadPanel()
          }}
        />
      )}
    </main>
  )
}

function MesaCard({
  mesa,
  loading,
  actionDisabled,
  onMesaAction,
  onOrder,
}: {
  mesa: MesaOperativa
  loading: boolean
  actionDisabled: boolean
  onMesaAction: () => void
  onOrder: () => void
}) {
  return (
    <Card
      className={cn(
        "rounded-xl border-border/60",
        mesa.asignadaAMi && "border-emerald-300 dark:border-emerald-800",
        mesa.asignadaAOtro && "opacity-70"
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">Mesa {mesa.numero}</p>
            {mesa.nombre && (
              <p className="text-sm text-muted-foreground">{mesa.nombre}</p>
            )}
          </div>
          <MesaBadge mesa={mesa} />
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{mesa.capacidad} lugares</p>
          {mesa.pedidosActivosCount > 0 ? (
            <p>
              {mesa.pedidosActivosCount} pedido{mesa.pedidosActivosCount === 1 ? "" : "s"} activo{mesa.pedidosActivosCount === 1 ? "" : "s"} - {formatPrice(mesa.pedidosActivosTotal)}
            </p>
          ) : (
            <p>Sin pedidos activos</p>
          )}
        </div>

        {mesa.pedidosActivos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {mesa.pedidosActivos.map((pedido, index) => (
              <Badge key={`${mesa.id}:${index}`} variant="outline" className="text-[10px]">
                {ESTADO_LABEL[pedido.estado] ?? pedido.estado}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid gap-2">
          {mesa.asignadaAMi && (
            <Button className="w-full gap-2" onClick={onOrder} disabled={actionDisabled}>
              <Receipt className="h-4 w-4" />
              Tomar pedido
            </Button>
          )}
          <Button
            className="w-full"
            variant={mesa.asignadaAMi ? "outline" : "default"}
            onClick={onMesaAction}
            disabled={actionDisabled || mesa.asignadaAOtro}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mesa.asignadaAMi ? (
              "Liberar mesa"
            ) : mesa.asignadaAOtro ? (
              "Asignada a otro mozo"
            ) : (
              "Tomar mesa"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ManualOrderSheet({
  slug,
  mesa,
  negocio,
  onClose,
  onCreated,
}: {
  slug: string
  mesa: MesaOperativa
  negocio: PanelData["negocio"]
  onClose: () => void
  onCreated: () => Promise<void>
}) {
  const [menuState, setMenuState] = useState<
    | { status: "loading" }
    | { status: "ready"; data: MenuData }
    | { status: "error"; message: string }
  >({ status: "loading" })
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("Todas")
  const [cart, setCart] = useState<OrderItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<MenuProduct | null>(null)
  const [metodoPago, setMetodoPago] = useState<"efectivo" | "transferencia">("efectivo")
  const [notas, setNotas] = useState("")
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const loadMenu = useCallback(async () => {
    setMenuState({ status: "loading" })
    setError("")
    try {
      const res = await fetch(`/api/operativo/mozo/panel/${encodeURIComponent(slug)}/pedidos`, {
        cache: "no-store",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || "No se pudo cargar el menu")
      }
      setMenuState({ status: "ready", data })
    } catch (loadError) {
      setMenuState({
        status: "error",
        message: loadError instanceof Error ? loadError.message : "No se pudo cargar el menu",
      })
    }
  }, [slug])

  useEffect(() => {
    loadMenu()
  }, [loadMenu])

  const categories = useMemo(() => {
    if (menuState.status !== "ready") return ["Todas"]
    const set = new Set(menuState.data.categorias.filter(Boolean))
    for (const product of menuState.data.productos) set.add(product.categoria)
    return ["Todas", ...Array.from(set)]
  }, [menuState])

  const filteredProducts = useMemo(() => {
    if (menuState.status !== "ready") return []
    const normalizedQuery = query.trim().toLowerCase()
    return menuState.data.productos.filter((product) => {
      if (category !== "Todas" && product.categoria !== category) return false
      if (!normalizedQuery) return true
      return (
        product.nombre.toLowerCase().includes(normalizedQuery) ||
        (product.descripcion?.toLowerCase().includes(normalizedQuery) ?? false)
      )
    })
  }, [category, menuState, query])

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
        : current.map((item) => item.key === key ? { ...item, cantidad } : item)
    )
  }

  const submitOrder = async () => {
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch(`/api/operativo/mozo/panel/${encodeURIComponent(slug)}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          idempotencyKey,
          mesaId: mesa.id,
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
      await onCreated()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo crear el pedido")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col">
        <div className="shrink-0 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">{negocio.nombre}</p>
              <h2 className="text-lg font-bold">Pedido manual - Mesa {mesa.numero}</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} disabled={submitting}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_360px]">
          <div className="min-h-0 overflow-y-auto p-4">
            {menuState.status === "loading" && (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}

            {menuState.status === "error" && (
              <StatusBlock message={menuState.message} onRetry={loadMenu} />
            )}

            {menuState.status === "ready" && (
              <div className="space-y-4 pb-24 lg:pb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar productos"
                    className="pl-9"
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
                      className="shrink-0"
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
                      className="rounded-xl border border-border/60 bg-card p-3 text-left transition hover:border-primary/40"
                    >
                      <div className="flex gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          {product.imagenUrl ? (
                            <img src={product.imagenUrl} alt={product.nombre} className="h-full w-full rounded-lg object-cover" />
                          ) : (
                            <Store className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 font-semibold">{product.nombre}</p>
                          <p className="text-xs text-muted-foreground">{product.categoria}</p>
                          <p className="mt-1 text-sm font-bold">
                            {formatPrice(product.precioPromo ?? product.precio)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="flex min-h-0 flex-col border-t border-border bg-card lg:border-l lg:border-t-0">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-4">
                <h3 className="font-bold">Pedido</h3>
                <p className="text-sm text-muted-foreground">Mesa {mesa.numero}</p>
              </div>

              {cart.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Agrega productos para tomar el pedido.
                </p>
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
                  >
                    Efectivo
                  </Button>
                  <Button
                    type="button"
                    variant={metodoPago === "transferencia" ? "default" : "outline"}
                    onClick={() => setMetodoPago("transferencia")}
                    disabled={menuState.status === "ready" && !menuState.data.negocio.aceptaTransferencia}
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
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Aclaraciones de cocina"
                  />
                </div>

                {error && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-border p-4">
              <div className="mb-3 flex items-center justify-between font-bold">
                <span>Total estimado</span>
                <span>{formatPrice(total)}</span>
              </div>
              <Button className="w-full gap-2" onClick={submitOrder} disabled={submitting || cart.length === 0}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirmar pedido
              </Button>
            </div>
          </aside>
        </div>
      </div>

      {selectedProduct && (
        <ProductConfigurator
          product={selectedProduct}
          colorPrincipal={negocio.colorPrincipal}
          onClose={() => setSelectedProduct(null)}
          onAdd={addItem}
        />
      )}
    </div>
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
    <div className="fixed inset-0 z-[60] bg-background">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
        <div className="shrink-0 border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{product.categoria}</p>
              <h3 className="text-lg font-bold">{product.nombre}</h3>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
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

        <div className="shrink-0 border-t border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <QuantityStepper
              value={quantity}
              onDecrease={() => setQuantity((current) => Math.max(1, current - 1))}
              onIncrease={() => setQuantity((current) => Math.min(99, current + 1))}
            />
            <p className="font-bold">{formatPrice(unitTotal * quantity)}</p>
          </div>
          <Button
            className="w-full"
            disabled={!canAdd}
            onClick={addConfiguredProduct}
            style={{ backgroundColor: colorPrincipal }}
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
    <div className="rounded-xl border border-border/60 p-3">
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
        <Button variant="ghost" size="icon" onClick={() => onQuantityChange(item.key, 0)}>
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
      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={onDecrease}>
        {value <= 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
      </Button>
      <span className="w-7 text-center text-sm font-bold">{value}</span>
      <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={onIncrease}>
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
        "inline-flex min-h-9 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:border-primary/30"
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

function StatusBlock({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <AlertTriangle className="h-7 w-7 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" className="gap-2" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Reintentar
      </Button>
    </div>
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

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number
}) {
  return (
    <Card className="rounded-xl border-border/60">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <p className="text-xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MesaBadge({ mesa }: { mesa: MesaOperativa }) {
  if (mesa.asignadaAMi) {
    return (
      <Badge className="border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
        Mia
      </Badge>
    )
  }

  if (mesa.asignadaAOtro) {
    return <Badge variant="outline">Ocupada</Badge>
  }

  return <Badge variant="outline">Libre</Badge>
}

function StatusShell({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-xl border-border/60">
        <CardContent className="p-5 space-y-5">
          <div className="space-y-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div>
              <h1 className="text-xl font-bold">{title}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <div>{children}</div>
        </CardContent>
      </Card>
    </main>
  )
}
