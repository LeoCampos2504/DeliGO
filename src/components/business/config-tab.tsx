"use client"

import { useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { motion } from "framer-motion"
import {
  Store,
  MessageSquare,
  Palette,
  Truck,
  CreditCard,
  Clock,
  Instagram,
  Facebook,
  Save,
  Loader2,
  Check,
  Camera,
  ImagePlus,
  Bell,
  BellOff,
  Copy,
  RefreshCw,
  Users,
  MapPin,
  ShoppingBag,
  DoorOpen,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ImageUpload } from "@/components/shared/image-upload"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { DeliveryZonesSection } from "./delivery-zones-section"

// ============================================
// Types
// ============================================
interface ConfigTabProps {
  negocio: {
    id: string
    nombre: string
    slug: string
    rubro: string
    colorPrincipal: string
    mostrarVentas?: boolean
  }
  horarioMode?: string
  abiertoManual?: boolean
  onHorarioChange?: (changes: { horarioMode?: string; abiertoManual?: boolean }) => void
}

interface DiaHorario {
  abierto: boolean
  apertura: string
  cierre: string
  turno2: boolean
  apertura2: string
  cierre2: string
}

interface NegocioConfig {
  nombre: string
  whatsapp: string
  mensajeBienvenida: string
  colorPrincipal: string
  ofreceDelivery: boolean
  seguimientoDeliveryActivo: boolean
  precioDelivery: number
  tiempoEntrega: number
  aceptaTransferencia: boolean
  aliasBancario: string
  toleranciaCancelacion: number
  mostrarVentas: boolean
  horarios?: Record<string, DiaHorario>
  instagram: string
  facebook: string
  logoUrl: string | null
  bannerUrl: string | null
  repartidorCodigo: string | null
  lat: number | null
  lng: number | null
  horarioMode?: string
  abiertoManual?: boolean
}

// ============================================
// Config Tab Component
// ============================================
export function ConfigTab({ negocio, horarioMode: horarioModeProp, abiertoManual: abiertoManualProp, onHorarioChange }: ConfigTabProps) {
  const queryClient = useQueryClient()

  // Fetch config
  const { data: config, isLoading } = useQuery<NegocioConfig>({
    queryKey: ["negocio-config", negocio.id],
    queryFn: async () => {
      const res = await fetch(`/api/negocio/config?negocioId=${negocio.id}`)
      if (!res.ok) throw new Error("Error cargando configuración")
      const json = await res.json()
      return json.data ?? json
    },
  })

  // Use prop-driven values with config query as fallback
  const effectiveHorarioMode = horarioModeProp ?? config?.horarioMode ?? "experto"
  const effectiveAbiertoManual = abiertoManualProp ?? config?.abiertoManual ?? true

  // Local state for each section
  const [info, setInfo] = useState<Partial<NegocioConfig>>({})
  const [delivery, setDelivery] = useState<Partial<NegocioConfig>>({})
  const [payments, setPayments] = useState<Partial<NegocioConfig>>({})
  const [orders, setOrders] = useState<Partial<NegocioConfig>>({})
  const [horarios, setHorarios] = useState<Record<string, DiaHorario> | null>(null)
  const [social, setSocial] = useState<Partial<NegocioConfig>>({})
  const [images, setImages] = useState<Partial<NegocioConfig>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [regeneratingCode, setRegeneratingCode] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  // Days map for horarios
  const dayLabels: Record<string, string> = {
    "1": "Lunes",
    "2": "Martes",
    "3": "Miércoles",
    "4": "Jueves",
    "5": "Viernes",
    "6": "Sábado",
    "7": "Domingo",
  }

  // Default horarios
  const defaultHorarios: Record<string, DiaHorario> = Object.fromEntries(
    Object.keys(dayLabels).map((d) => [d, { abierto: true, apertura: "09:00", cierre: "22:00", turno2: false, apertura2: "", cierre2: "" }])
  )

  // Initialize local state from fetched config
  const initialized = config !== undefined
  const mergedInfo = { ...config, ...info }
  const mergedDelivery = { ...config, ...delivery }
  const mergedPayments = { ...config, ...payments }
  const mergedOrders = { ...config, ...orders }
  const mergedSocial = { ...config, ...social }
  const mergedImages = { ...config, ...images }
  const mergedHorarios = horarios ?? config?.horarios ?? defaultHorarios

  // Real-time name availability check
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null)
  const [nameChecking, setNameChecking] = useState(false)
  const nameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentNombre = mergedInfo.nombre ?? ""

  useEffect(() => {
    const trimmed = currentNombre.trim()
    // Don't check if name hasn't changed from original
    if (!trimmed || trimmed === negocio.nombre) {
      setNameAvailable(null)
      setNameChecking(false)
      return
    }

    setNameChecking(true)
    setNameAvailable(null)

    if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current)

    nameCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/check-negocio-name?nombre=${encodeURIComponent(trimmed)}`
        )
        const data = await res.json()
        setNameAvailable(data.available)
      } catch {
        setNameAvailable(null)
      } finally {
        setNameChecking(false)
      }
    }, 400)

    return () => {
      if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current)
    }
  }, [currentNombre, negocio.nombre])

  // Helper to update a single day's horario safely
  const updateDia = (dayNum: string, update: Partial<DiaHorario>) => {
    setHorarios((prev) => {
      const current = prev ?? config?.horarios ?? defaultHorarios
      return {
        ...current,
        [dayNum]: { ...(current[dayNum] ?? defaultHorarios[dayNum]), ...update },
      }
    })
  }

  // Save mutation
  const saveSection = async (section: string, data: Partial<NegocioConfig>) => {
    setSaving(section)
    try {
      // Clean data: remove internal hacks like _showLocationPicker
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([key]) => !key.startsWith("_"))
      ) as Partial<NegocioConfig>

      const res = await fetch(`/api/negocio/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cleanData, negocioId: negocio.id }),
      })
      if (!res.ok) {
        let errorMsg = "Error al guardar la configuración"
        try {
          const errBody = await res.json()
          if (errBody.error) errorMsg = errBody.error
        } catch {}
        throw new Error(errorMsg)
      }
      // Reset local state so server data is used after refetch
      if (section === "horarios") setHorarios(null)
      queryClient.invalidateQueries({ queryKey: ["negocio-config", negocio.id] })
      toast.success("Configuración guardada")
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar la configuración"
      toast.error(msg)
    } finally {
      setSaving(null)
    }
  }

  // Regenerate repartidor code
  const regenerateCode = async () => {
    setRegeneratingCode(true)
    try {
      const newCode = `NF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const res = await fetch(`/api/negocio/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repartidorCodigo: newCode, negocioId: negocio.id }),
      })
      if (!res.ok) throw new Error("Error regenerando código")
      queryClient.invalidateQueries({ queryKey: ["negocio-config", negocio.id] })
      toast.success("Código regenerado correctamente")
    } catch {
      toast.error("Error al regenerar el código")
    } finally {
      setRegeneratingCode(false)
    }
  }

  // Copy repartidor code to clipboard
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(true)
      toast.success("Código copiado al portapapeles")
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      toast.error("No se pudo copiar el código")
    }
  }

  if (isLoading || !initialized) {
    return <ConfigSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* ===== LOGO Y BANNER ===== */}
      <ConfigSection
        title="Logo y banner"
        icon={<ImagePlus className="h-4 w-4" />}
        color={negocio.colorPrincipal}
        delay={0}
      >
        <div className="space-y-4">
          {/* Banner */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">Banner del negocio</Label>
            <ImageUpload
              value={mergedImages.bannerUrl ?? null}
              onChange={(url) => {
                setImages((p) => ({ ...p, bannerUrl: url }))
                saveSection("images", { bannerUrl: url })
              }}
              onRemove={() => {
                setImages((p) => ({ ...p, bannerUrl: null }))
                saveSection("images", { bannerUrl: null as unknown as string })
              }}
              category="banners"
              slug={negocio.slug}
              variant="banner"
              placeholder="Subir banner (recomendado 1200x400)"
            />
          </div>

          {/* Logo */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">Logo del negocio</Label>
            <ImageUpload
              value={mergedImages.logoUrl ?? null}
              onChange={(url) => {
                setImages((p) => ({ ...p, logoUrl: url }))
                saveSection("images", { logoUrl: url })
              }}
              onRemove={() => {
                setImages((p) => ({ ...p, logoUrl: null }))
                saveSection("images", { logoUrl: null as unknown as string })
              }}
              category="logos"
              slug={negocio.slug}
              variant="avatar"
              placeholder="Subir logo"
            />
          </div>
        </div>
      </ConfigSection>

      {/* ===== INFO GENERAL ===== */}
      <ConfigSection
        title="Info general"
        icon={<Store className="h-4 w-4" />}
        color={negocio.colorPrincipal}
        delay={0.025}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">Nombre del negocio</Label>
            <div className="relative">
              <Input
                value={mergedInfo.nombre ?? ""}
                onChange={(e) => setInfo((p) => ({ ...p, nombre: e.target.value }))}
                className={`rounded-xl pr-9 ${
                  currentNombre.trim() && currentNombre.trim() !== negocio.nombre
                    ? nameAvailable === false
                      ? "border-red-400 focus-visible:ring-red-400"
                      : nameAvailable === true
                      ? "border-emerald-400 focus-visible:ring-emerald-400"
                      : ""
                    : ""
                }`}
                placeholder="Mi negocio"
              />
              {currentNombre.trim() && currentNombre.trim() !== negocio.nombre && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {nameChecking ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : nameAvailable === false ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : nameAvailable === true ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : null}
                </span>
              )}
            </div>
            {currentNombre.trim() && currentNombre.trim() !== negocio.nombre && !nameChecking && nameAvailable === false && (
              <p className="text-xs text-red-500 font-medium mt-1">
                Ya existe un local con ese nombre. Elegí otro.
              </p>
            )}
            {currentNombre.trim() && currentNombre.trim() !== negocio.nombre && !nameChecking && nameAvailable === true && (
              <p className="text-xs text-emerald-600 font-medium mt-1">
                Nombre disponible
              </p>
            )}
          </div>
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">WhatsApp</Label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={mergedInfo.whatsapp ?? ""}
                onChange={(e) => setInfo((p) => ({ ...p, whatsapp: e.target.value }))}
                className="rounded-xl pl-10"
                placeholder="+549 11 1234-5678"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">Mensaje de bienvenida</Label>
            <Textarea
              value={mergedInfo.mensajeBienvenida ?? ""}
              onChange={(e) => setInfo((p) => ({ ...p, mensajeBienvenida: e.target.value }))}
              className="rounded-xl min-h-[80px] resize-none"
              placeholder="¡Bienvenido a nuestro catálogo!"
            />
          </div>
          {/* Ubicación del local */}
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              Ubicación del local
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Seteá la ubicación para que los clientes vean desde dónde sale su pedido en el rastreo en vivo
            </p>
            {mergedInfo.lat != null && mergedInfo.lng != null ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                  <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                    Ubicación guardada ({mergedInfo.lat.toFixed(4)}, {mergedInfo.lng.toFixed(4)})
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl text-xs gap-1.5"
                    onClick={() => {
                      setInfo((p) => ({ ...p, _showLocationPicker: true as unknown as number }))
                    }}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    Cambiar ubicación
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="rounded-xl text-xs text-destructive hover:text-destructive"
                    onClick={() => {
                      setInfo((p) => {
                        const { lat, lng, ...rest } = p
                        return rest
                      })
                      saveSection("location", { lat: null as unknown as number, lng: null as unknown as number })
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5 w-full"
                onClick={() => {
                  setInfo((p) => ({ ...p, _showLocationPicker: true as unknown as number }))
                }}
              >
                <MapPin className="h-3.5 w-3.5" />
                Setear ubicación del local
              </Button>
            )}
          </div>

          {/* Location Picker Modal */}
          {(info as Record<string, unknown>)._showLocationPicker && (
            <LocationPickerInline
              initialLat={mergedInfo.lat ?? undefined}
              initialLng={mergedInfo.lng ?? undefined}
              colorPrincipal={negocio.colorPrincipal}
              logoUrl={mergedImages.logoUrl ?? undefined}
              onConfirm={(lat, lng) => {
                setInfo((p) => {
                  const { _showLocationPicker, ...rest } = p as Record<string, unknown>
                  return { ...rest, lat, lng } as Partial<NegocioConfig>
                })
                saveSection("location", { lat, lng })
              }}
              onCancel={() => {
                setInfo((p) => {
                  const { _showLocationPicker, ...rest } = p as Record<string, unknown>
                  return rest as Partial<NegocioConfig>
                })
              }}
            />
          )}

          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              Color principal
            </Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={mergedInfo.colorPrincipal ?? "#FB8C00"}
                onChange={(e) => setInfo((p) => ({ ...p, colorPrincipal: e.target.value }))}
                className="w-10 h-10 rounded-xl border border-border cursor-pointer"
              />
              <Input
                value={mergedInfo.colorPrincipal ?? "#FB8C00"}
                onChange={(e) => setInfo((p) => ({ ...p, colorPrincipal: e.target.value }))}
                className="rounded-xl max-w-[120px]"
                maxLength={7}
              />
              <div
                className="w-8 h-8 rounded-full shrink-0 border"
                style={{ backgroundColor: mergedInfo.colorPrincipal ?? "#FB8C00" }}
              />
            </div>
          </div>
        </div>
        <SectionSaveButton
          onClick={() => saveSection("info", info)}
          loading={saving === "info"}
          disabled={nameAvailable === false}
        />
      </ConfigSection>

      {/* ===== DELIVERY ===== */}
      <ConfigSection
        title="Delivery"
        icon={<Truck className="h-4 w-4" />}
        color={negocio.colorPrincipal}
        delay={0.05}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div>
              <p className="text-sm font-semibold">Ofrecer delivery</p>
              <p className="text-xs text-muted-foreground">Permitir envíos a domicilio</p>
            </div>
            <Switch
              checked={mergedDelivery.ofreceDelivery ?? false}
              onCheckedChange={(v) => {
                setDelivery((p) => ({ ...p, ofreceDelivery: v }))
                saveSection("delivery", { ...delivery, ofreceDelivery: v })
              }}
            />
          </div>

          {(mergedDelivery.ofreceDelivery ?? false) && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <div>
                <p className="text-sm font-semibold">Seguimiento en tiempo real</p>
                <p className="text-xs text-muted-foreground">Los clientes podrán ver al repartidor en el mapa</p>
              </div>
              <Switch
                checked={mergedDelivery.seguimientoDeliveryActivo ?? true}
                onCheckedChange={(v) => {
                  setDelivery((p) => ({ ...p, seguimientoDeliveryActivo: v }))
                  saveSection("delivery", { ...delivery, seguimientoDeliveryActivo: v })
                }}
              />
            </div>
          )}

          {(mergedDelivery.ofreceDelivery ?? false) && (
            <>
              <DeliveryZonesSection negocio={negocio} />

              <div>
                <Label className="text-sm font-semibold mb-1.5 block">
                  Tiempo de entrega: {mergedDelivery.tiempoEntrega ?? 30} min
                </Label>
                <Slider
                  value={[mergedDelivery.tiempoEntrega ?? 30]}
                  onValueChange={([v]) => setDelivery((p) => ({ ...p, tiempoEntrega: v }))}
                  min={10}
                  max={120}
                  step={5}
                  className="mt-2"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>10 min</span>
                  <span>120 min</span>
                </div>
              </div>

              {/* Código de repartidor */}
              <div className="p-3 rounded-xl bg-muted/50 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Código para repartidores</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Compartí este código con los repartidores para que se unan a tu local
                </p>
                {mergedDelivery.repartidorCodigo ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-background border border-border/80">
                      <code className="text-sm font-mono font-bold tracking-wider flex-1">
                        {mergedDelivery.repartidorCodigo}
                      </code>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-10 px-3 shrink-0"
                      onClick={() => copyCode(mergedDelivery.repartidorCodigo!)}
                    >
                      {copiedCode ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-10 px-3 shrink-0"
                      onClick={regenerateCode}
                      disabled={regeneratingCode}
                    >
                      <RefreshCw className={cn("h-4 w-4", regeneratingCode && "animate-spin")} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground flex-1 italic">
                      No se generó un código aún
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl h-8 px-3 gap-1.5"
                      onClick={regenerateCode}
                      disabled={regeneratingCode}
                    >
                      {regeneratingCode ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Generar código
                    </Button>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-2">
                  Al regenerar el código, el anterior dejará de funcionar y los repartidores asociados tendrán que volver a vincularse con el nuevo código
                </p>
              </div>
            </>
          )}
        </div>
        {(mergedDelivery.ofreceDelivery ?? false) && (
          <SectionSaveButton
            onClick={() => saveSection("delivery", delivery)}
            loading={saving === "delivery"}
          />
        )}
      </ConfigSection>

      {/* ===== PAGOS ===== */}
      <ConfigSection
        title="Métodos de pago"
        icon={<CreditCard className="h-4 w-4" />}
        color={negocio.colorPrincipal}
        delay={0.1}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div>
              <p className="text-sm font-semibold">Efectivo</p>
              <p className="text-xs text-muted-foreground">Siempre habilitado</p>
            </div>
            <Switch checked disabled />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div>
              <p className="text-sm font-semibold">Transferencia</p>
              <p className="text-xs text-muted-foreground">Pagos por transferencia bancaria</p>
            </div>
            <Switch
              checked={mergedPayments.aceptaTransferencia ?? false}
              onCheckedChange={(v) => setPayments((p) => ({ ...p, aceptaTransferencia: v }))}
            />
          </div>

          {(mergedPayments.aceptaTransferencia ?? false) && (
            <div>
              <Label className="text-sm font-semibold mb-1.5 block">Alias bancario</Label>
              <Input
                value={mergedPayments.aliasBancario ?? ""}
                onChange={(e) => setPayments((p) => ({ ...p, aliasBancario: e.target.value }))}
                className="rounded-xl"
                placeholder="MI.ALIAS.CBU"
              />
            </div>
          )}
        </div>
        <SectionSaveButton
          onClick={() => saveSection("payments", payments)}
          loading={saving === "payments"}
        />
      </ConfigSection>

      {/* ===== PEDIDOS ===== */}
      <ConfigSection
        title="Configuración de pedidos"
        icon={<Clock className="h-4 w-4" />}
        color={negocio.colorPrincipal}
        delay={0.15}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold mb-1.5 block">
              Tolerancia de cancelación: {mergedOrders.toleranciaCancelacion ?? 5} min
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Tiempo que tiene el cliente para cancelar un pedido
            </p>
            <Slider
              value={[mergedOrders.toleranciaCancelacion ?? 5]}
              onValueChange={([v]) => setOrders((p) => ({ ...p, toleranciaCancelacion: v }))}
              min={0}
              max={30}
              step={1}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0 min</span>
              <span>30 min</span>
            </div>
          </div>
        </div>
        <SectionSaveButton
          onClick={() => saveSection("orders", orders)}
          loading={saving === "orders"}
        />
      </ConfigSection>

      {/* ===== VISIBILIDAD ===== */}
      <ConfigSection
        title="Visibilidad"
        icon={<ShoppingBag className="h-4 w-4" />}
        color={negocio.colorPrincipal}
        delay={0.16}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <div>
              <p className="text-sm font-semibold">Mostrar ventas</p>
              <p className="text-xs text-muted-foreground">
                Los clientes verán cuántos pedidos completados tuvo tu local
              </p>
            </div>
            <Switch
              checked={mergedOrders.mostrarVentas ?? false}
              onCheckedChange={(v) => {
                setOrders((p) => ({ ...p, mostrarVentas: v }))
                saveSection("visibility", { mostrarVentas: v })
              }}
            />
          </div>
        </div>
      </ConfigSection>

      {/* ===== NOTIFICACIONES ===== */}
      <ConfigSection
        title="Notificaciones push"
        icon={<Bell className="h-4 w-4" />}
        color={negocio.colorPrincipal}
        delay={0.175}
      >
        <PushNotificationsConfig color={negocio.colorPrincipal} />
      </ConfigSection>

      {/* ===== HORARIOS ===== */}
      <ConfigSection
        title="Horarios"
        icon={<Clock className="h-4 w-4" />}
        color={negocio.colorPrincipal}
        delay={0.175}
      >
        <div className="space-y-3">
          {/* Mode selector */}
          <div className="p-3 rounded-xl bg-muted/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold">Modo de horarios</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {effectiveHorarioMode === "simple"
                    ? "Abrís y cerrás manualmente con un botón"
                    : "Configurás los horarios por día de la semana"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className={cn(
                  "flex-1 py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all text-center",
                  effectiveHorarioMode !== "simple"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                )}
                style={effectiveHorarioMode !== "simple" ? { borderColor: negocio.colorPrincipal, backgroundColor: `${negocio.colorPrincipal}15`, color: negocio.colorPrincipal } : undefined}
                onClick={() => {
                  if (onHorarioChange) {
                    onHorarioChange({ horarioMode: "experto" })
                  } else {
                    saveSection("horarioMode", { horarioMode: "experto" } as unknown as Partial<NegocioConfig>)
                  }
                }}
              >
                <Clock className="h-3.5 w-3.5 mx-auto mb-1" />
                Experto
              </button>
              <button
                className={cn(
                  "flex-1 py-2 px-3 rounded-xl text-xs font-semibold border-2 transition-all text-center",
                  effectiveHorarioMode === "simple"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                )}
                style={effectiveHorarioMode === "simple" ? { borderColor: negocio.colorPrincipal, backgroundColor: `${negocio.colorPrincipal}15`, color: negocio.colorPrincipal } : undefined}
                onClick={() => {
                  if (onHorarioChange) {
                    onHorarioChange({ horarioMode: "simple" })
                  } else {
                    saveSection("horarioMode", { horarioMode: "simple" } as unknown as Partial<NegocioConfig>)
                  }
                }}
              >
                <DoorOpen className="h-3.5 w-3.5 mx-auto mb-1" />
                Simple
              </button>
            </div>
          </div>

          {/* Simple mode notice */}
          {effectiveHorarioMode === "simple" && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                Modo simple activado: usá el botón "Abierto/Cerrado" en la parte superior del panel para cambiar tu estado en tiempo real.
              </p>
            </div>
          )}

          {/* Expert mode: show schedule config */}
          {effectiveHorarioMode !== "simple" && (
          <>
          {Object.entries(dayLabels).map(([dayNum, dayName]) => {
            const dia = mergedHorarios[dayNum] ?? { abierto: true, apertura: "09:00", cierre: "22:00", turno2: false, apertura2: "", cierre2: "" }
            return (
              <div key={dayNum} className="p-3 rounded-xl bg-muted/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{dayName}</span>
                  <Switch
                    checked={dia.abierto}
                    onCheckedChange={(v) => updateDia(dayNum, { abierto: v })}
                  />
                </div>
                {dia.abierto && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-14 shrink-0">Apertura</Label>
                      <Input
                        type="time"
                        value={dia.apertura}
                        onChange={(e) => updateDia(dayNum, { apertura: e.target.value })}
                        className="rounded-xl h-8 text-sm"
                      />
                      <Label className="text-xs text-muted-foreground w-14 shrink-0">Cierre</Label>
                      <Input
                        type="time"
                        value={dia.cierre}
                        onChange={(e) => updateDia(dayNum, { cierre: e.target.value })}
                        className="rounded-xl h-8 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-14 shrink-0">2do turno</Label>
                      <Switch
                        checked={dia.turno2}
                        onCheckedChange={(v) => updateDia(dayNum, { turno2: v })}
                      />
                    </div>
                    {dia.turno2 && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-14 shrink-0">Apertura</Label>
                        <Input
                          type="time"
                          value={dia.apertura2}
                          onChange={(e) => updateDia(dayNum, { apertura2: e.target.value })}
                          className="rounded-xl h-8 text-sm"
                        />
                        <Label className="text-xs text-muted-foreground w-14 shrink-0">Cierre</Label>
                        <Input
                          type="time"
                          value={dia.cierre2}
                          onChange={(e) => updateDia(dayNum, { cierre2: e.target.value })}
                          className="rounded-xl h-8 text-sm"
                        />
                      </div>
                    )}
                  </>
                )}
                {!dia.abierto && (
                  <p className="text-xs text-muted-foreground italic">Cerrado</p>
                )}
              </div>
            )
          })}
          </>
          )}
        </div>
        {effectiveHorarioMode !== "simple" && (
        <SectionSaveButton
          onClick={() => saveSection("horarios", { horarios: mergedHorarios } as unknown as Partial<NegocioConfig>)}
          loading={saving === "horarios"}
        />
        )}
      </ConfigSection>

      {/* ===== REDES SOCIALES ===== */}
      <ConfigSection
        title="Redes sociales"
        icon={<Instagram className="h-4 w-4" />}
        color={negocio.colorPrincipal}
        delay={0.225}
      >
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
              <Instagram className="h-3.5 w-3.5" />
              Instagram
            </Label>
            <Input
              value={mergedSocial.instagram ?? ""}
              onChange={(e) => setSocial((p) => ({ ...p, instagram: e.target.value }))}
              className="rounded-xl"
              placeholder="@mi_negocio"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold mb-1.5 flex items-center gap-1.5">
              <Facebook className="h-3.5 w-3.5" />
              Facebook
            </Label>
            <Input
              value={mergedSocial.facebook ?? ""}
              onChange={(e) => setSocial((p) => ({ ...p, facebook: e.target.value }))}
              className="rounded-xl"
              placeholder="facebook.com/mi.negocio"
            />
          </div>
        </div>
        <SectionSaveButton
          onClick={() => saveSection("social", social)}
          loading={saving === "social"}
        />
      </ConfigSection>
    </div>
  )
}

// ============================================
// Config Section Card
// ============================================
function ConfigSection({
  title,
  icon,
  color,
  delay,
  children,
}: {
  title: string
  icon: React.ReactNode
  color: string
  delay: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="rounded-2xl border-border/50 overflow-hidden">
        <CardContent className="p-0">
          {/* Section header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-muted/20">
            <div className="hidden sm:flex p-1.5 rounded-lg items-center justify-center" style={{ backgroundColor: `${color}15` }}>
              <span style={{ color }}>{icon}</span>
            </div>
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>

          {/* Section content */}
          <div className="p-4">
            {children}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ============================================
// Save Button
// ============================================
function SectionSaveButton({
  onClick,
  loading,
  disabled,
}: {
  onClick: () => void
  loading: boolean
  disabled?: boolean
}) {
  return (
    <div className="mt-4 pt-3 border-t border-border/30">
      <Button
        size="sm"
        className="rounded-xl w-full gap-2 font-semibold"
        onClick={onClick}
        disabled={loading || disabled}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {loading ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  )
}

// ============================================
// Push Notifications Config
// ============================================
function PushNotificationsConfig({ color }: { color: string }) {
  const push = usePushNotifications()
  const [enabled, setEnabled] = useState(push.isSubscribed)

  const handleToggle = async (val: boolean) => {
    setEnabled(val)
    if (val) {
      await push.subscribe()
      if (!push.isSubscribed) {
        setEnabled(false)
      }
    } else {
      await push.unsubscribe()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
            {enabled ? (
              <Bell className="h-5 w-5" style={{ color }} />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">Notificaciones de pedidos</p>
            <p className="text-xs text-muted-foreground">
              {push.loading
                ? "Procesando..."
                : !push.isSupported
                ? "No disponibles en este navegador"
                : enabled
                ? "Recibirás notificaciones de nuevos pedidos"
                : "No recibirás notificaciones"}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={handleToggle}
          disabled={!push.isSupported || push.loading}
        />
      </div>

      {!push.isSupported && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Las notificaciones push no están disponibles en este navegador. Probá con Chrome o Firefox.
          </p>
        </div>
      )}

      {enabled && push.permission !== "granted" && (
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            Necesitás permitir las notificaciones en tu navegador. Hacé clic en el ícono de candado en la barra de direcciones.
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================
// Skeleton
// ============================================
function ConfigSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="rounded-2xl border-border/50">
          <CardContent className="p-0">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-muted/20">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="p-4 space-y-4">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-8 w-full rounded-xl" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ============================================
// Dynamic import for LocationPickerInline (Leaflet requires window)
// ============================================
const LocationPickerInline = dynamic(
  () => import("./location-picker-inline").then((mod) => mod.LocationPickerInline),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3">
        <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/30 animate-pulse" style={{ height: 250 }}>
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">Cargando mapa...</p>
      </div>
    ),
  }
)
