"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  UtensilsCrossed,
  QrCode,
  Loader2,
  AlertCircle,
  Camera,
  X,
  CheckCircle2,
  ArrowRight,
  WifiOff,
  Armchair,
  UserCheck,
  ShoppingCart,
  Clock,
  Flame,
  Plus,
  Minus,
  ExternalLink,
  Bell,
  BellOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ============================================
// Types
// ============================================
interface MozoInfo {
  id: string
  nombre: string
  codigo: string
  rol: string
  hasPushSubscription: boolean
  negocio: {
    id: string
    nombre: string
    slug: string
    colorPrincipal: string
    logoUrl: string | null
    salonActivo: boolean
  }
}

interface MozoMesa {
  id: string
  numero: number
  nombre: string
  zona: string
  capacidad: number
  empleadoId: string | null
  empleado?: { id: string; nombre: string; codigo: string } | null
  orders: Array<{ id: string; mesaNumero: number | null; estado: string; total: number }>
  hasActiveOrders: boolean
  isAssignedToMe: boolean
}

interface ScannedMesa {
  slug: string
  mesaNumero: number
  negocioNombre: string
}

function mozoTokenStorageKey(slug: string, codigo: string) {
  return `deligo:mozo-token:${slug}:${codigo.toUpperCase()}`
}

// ============================================
// Main Mozo Page
// ============================================
export default function MozoPage() {
  const { token } = useParams<{ token: string }>()
  const [mozoInfo, setMozoInfo] = useState<MozoInfo | null>(null)
  const [mesas, setMesas] = useState<MozoMesa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [assigningMesa, setAssigningMesa] = useState<string | null>(null)
  const [unassigningMesa, setUnassigningMesa] = useState<string | null>(null)
  const [isPushSubscribed, setIsPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  // Validate token and fetch mesas
  const fetchMozoData = useCallback(async () => {
    try {
      const res = await fetch("/api/mozo", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
        referrerPolicy: "no-referrer",
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Token inválido")
        return
      }
      const data = await res.json()
      setMozoInfo({
        id: data.id,
        nombre: data.nombre,
        codigo: data.codigo,
        rol: data.rol,
        hasPushSubscription: data.hasPushSubscription || false,
        negocio: data.negocio,
      })
      setMesas(data.mesas || [])
      setIsPushSubscribed(data.hasPushSubscription || false)
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    if (token) fetchMozoData()
  }, [token, fetchMozoData])

  // Auto-refresh mesas every 10s
  useEffect(() => {
    if (!mozoInfo) return
    const interval = setInterval(fetchMozoData, 10000)
    return () => clearInterval(interval)
  }, [mozoInfo, fetchMozoData])

  // Assign mesa to this mozo
  const assignMesa = async (mesaId: string) => {
    if (!mozoInfo) return
    setAssigningMesa(mesaId)
    try {
      const res = await fetch("/api/negocio/mesas-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesaId,
          empleadoCodigo: mozoInfo.codigo,
          negocioId: mozoInfo.negocio.id,
          mozoToken: token,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al asignar mesa")
      }
      toast.success("Mesa asignada correctamente")
      // Update local state
      setMesas((prev) =>
        prev.map((m) =>
          m.id === mesaId
            ? { ...m, empleadoId: mozoInfo.id, empleado: { id: mozoInfo.id, nombre: mozoInfo.nombre, codigo: mozoInfo.codigo }, isAssignedToMe: true }
            : m
        )
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al asignar mesa")
    } finally {
      setAssigningMesa(null)
    }
  }

  // Unassign mesa from this mozo
  const unassignMesa = async (mesaId: string) => {
    if (!mozoInfo) return
    setUnassigningMesa(mesaId)
    try {
      const res = await fetch("/api/negocio/mesas-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mesaId,
          empleadoCodigo: mozoInfo.codigo,
          negocioId: mozoInfo.negocio.id,
          unassign: true,
          mozoToken: token,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Error al desasignar mesa")
      }
      toast.success("Mesa desasignada")
      setMesas((prev) =>
        prev.map((m) =>
          m.id === mesaId
            ? { ...m, empleadoId: null, empleado: null, isAssignedToMe: false }
            : m
        )
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al desasignar mesa")
    } finally {
      setUnassigningMesa(null)
    }
  }

  // Push notification subscription
  const subscribeToPush = async () => {
    if (!token || pushLoading) return
    setPushLoading(true)
    try {
      // Request permission
      const result = await Notification.requestPermission()
      if (result !== "granted") {
        toast.error("Necesitás permitir las notificaciones en tu navegador")
        return
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register("/sw.js")
      await navigator.serviceWorker.ready

      // Get VAPID key
      const vapidRes = await fetch("/api/push/vapid-key")
      if (!vapidRes.ok) {
        toast.error("Notificaciones push no configuradas")
        return
      }
      const { publicKey } = await vapidRes.json()
      if (!publicKey) {
        toast.error("Notificaciones push no configuradas")
        return
      }

      // Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey,
      })

      // Save to server via mozo token
      const res = await fetch("/api/mozo/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mozoToken: token,
          subscription: JSON.stringify(subscription),
        }),
      })

      if (res.ok) {
        setIsPushSubscribed(true)
        setMozoInfo(prev => prev ? { ...prev, hasPushSubscription: true } : prev)
        toast.success("Notificaciones activadas 🔔")
      } else {
        // Subscribe failed — unsubscribe locally so the bell state stays honest
        try { await subscription.unsubscribe() } catch { /* ignore */ }
        toast.error("Error al activar notificaciones")
      }
    } catch (err) {
      console.error("Push subscribe error:", err)
      toast.error("Error al activar notificaciones")
    } finally {
      setPushLoading(false)
    }
  }

  const unsubscribeFromPush = async () => {
    if (!token || pushLoading) return
    setPushLoading(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) await subscription.unsubscribe()

      await fetch("/api/mozo/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mozoToken: token }),
      })

      setIsPushSubscribed(false)
      setMozoInfo(prev => prev ? { ...prev, hasPushSubscription: false } : prev)
      toast.success("Notificaciones desactivadas")
    } catch (err) {
      console.error("Push unsubscribe error:", err)
      toast.error("Error al desactivar notificaciones")
    } finally {
      setPushLoading(false)
    }
  }

  // Open the menu for a specific mesa
  const openMenuForMesa = (mesaNumero: number) => {
    if (!mozoInfo) return
    window.sessionStorage.setItem(
      mozoTokenStorageKey(mozoInfo.negocio.slug, mozoInfo.codigo),
      token
    )
    const url = `/n/${mozoInfo.negocio.slug}?mesa=${mesaNumero}&mozo=${mozoInfo.codigo}`
    window.location.assign(url)
  }

  // Handle scanned QR: extract mesa info and redirect
  const handleScannedMesa = useCallback((slug: string, mesaNumero: number) => {
    if (!mozoInfo?.codigo) return
    window.sessionStorage.setItem(
      mozoTokenStorageKey(slug, mozoInfo.codigo),
      token
    )
    const url = `/n/${slug}?mesa=${mesaNumero}&mozo=${mozoInfo?.codigo || ""}`
    window.location.assign(url)
  }, [mozoInfo, token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    )
  }

  if (error || !mozoInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-sm w-full rounded-2xl border-destructive/30">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-red-50 dark:bg-red-950/30">
              <AlertCircle className="h-7 w-7 text-red-500" />
            </div>
            <div>
              <p className="font-bold text-lg">Acceso denegado</p>
              <p className="text-sm text-muted-foreground mt-1">
                {error || "Link de mozo inválido"}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Si creés que esto es un error, contactá al administrador del negocio.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const color = mozoInfo.negocio.colorPrincipal || "#FB8C00"

  // Group mesas
  const myMesas = mesas.filter((m) => m.isAssignedToMe)
  const availableMesas = mesas.filter((m) => !m.isAssignedToMe && !m.empleadoId)
  const otherMozosMesas = mesas.filter((m) => !m.isAssignedToMe && m.empleadoId)

  // Mesa status helper
  const getMesaStatus = (mesa: MozoMesa) => {
    if (!mesa.hasActiveOrders) return "libre"
    const orders = mesa.orders
    if (orders.some((o) => o.estado === "recibido")) return "nuevo"
    if (orders.some((o) => o.estado === "preparando")) return "preparando"
    if (orders.some((o) => o.estado === "listo_para_retirar")) return "listo"
    return "libre"
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div
        className="p-4 pb-6 text-white relative"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
      >
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-3 opacity-80">
            <UtensilsCrossed className="h-4 w-4" />
            <span className="text-xs font-medium">{mozoInfo.negocio.nombre}</span>
          </div>
          <p className="text-2xl font-bold">¡Hola, {mozoInfo.nombre}!</p>
          <p className="text-sm opacity-80 mt-1">Seleccioná las mesas que estás atendiendo</p>
        </div>
        {/* Notification bell */}
        <button
          onClick={isPushSubscribed ? unsubscribeFromPush : subscribeToPush}
          disabled={pushLoading}
          className={cn(
            "absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-50",
            isPushSubscribed
              ? "bg-white/20 hover:bg-white/30 text-white"
              : "bg-white/90 hover:bg-white text-gray-800"
          )}
          title={isPushSubscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
        >
          {pushLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isPushSubscribed ? (
            <Bell className="h-3.5 w-3.5" />
          ) : (
            <BellOff className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">
            {isPushSubscribed ? "Activadas" : "Notificarme"}
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto p-4 -mt-3 space-y-5">
        {/* Quick scan button */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="rounded-2xl border-2 overflow-hidden" style={{ borderColor: `${color}30` }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <QrCode className="h-6 w-6" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">Escanear QR de mesa</p>
                  <p className="text-xs text-muted-foreground">Tomá un pedido escaneando el código</p>
                </div>
                <Button
                  size="sm"
                  className="rounded-xl gap-1.5 font-semibold shrink-0"
                  style={{ backgroundColor: color }}
                  onClick={() => setScannerOpen(true)}
                >
                  <Camera className="h-4 w-4" />
                  Escanear
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* My assigned mesas */}
        {myMesas.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="flex items-center gap-2 mb-2">
              <UserCheck className="h-3.5 w-3.5" style={{ color }} />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tus mesas ({myMesas.length})</span>
            </div>
            <div className="space-y-2">
              {myMesas.map((mesa) => {
                const status = getMesaStatus(mesa)
                return (
                  <motion.div key={mesa.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <Card className={cn(
                      "rounded-xl border-2 overflow-hidden",
                      status === "nuevo" && "border-amber-300 dark:border-amber-700",
                      status === "preparando" && "border-orange-300 dark:border-orange-700",
                      status === "listo" && "border-emerald-300 dark:border-emerald-700",
                      status === "libre" && "border-border/50",
                    )}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {/* Mesa number */}
                          <div
                            className={cn(
                              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-extrabold text-lg",
                              status === "libre" && "bg-muted/50 text-foreground",
                              status === "nuevo" && "bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300",
                              status === "preparando" && "bg-orange-100 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300",
                              status === "listo" && "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
                            )}
                          >
                            {mesa.numero}
                          </div>
                          {/* Mesa info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">Mesa {mesa.numero}</p>
                              {mesa.nombre && (
                                <span className="text-xs text-muted-foreground truncate">{mesa.nombre}</span>
                              )}
                            </div>
                            {/* Status badge */}
                            {status !== "libre" ? (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {status === "nuevo" && (
                                  <Badge className="text-[9px] h-4 px-1.5 border-0 bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                                    {mesa.orders.length} {mesa.orders.length === 1 ? "pedido nuevo" : "pedidos"}
                                  </Badge>
                                )}
                                {status === "preparando" && (
                                  <Badge className="text-[9px] h-4 px-1.5 border-0 bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400">
                                    <Flame className="h-2.5 w-2.5 mr-0.5" />
                                    Preparando
                                  </Badge>
                                )}
                                {status === "listo" && (
                                  <Badge className="text-[9px] h-4 px-1.5 border-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                    Listo para servir
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">Sin pedidos activos</span>
                            )}
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-lg h-8 gap-1 text-xs font-semibold"
                              style={{ borderColor: `${color}40`, color }}
                              onClick={() => openMenuForMesa(mesa.numero)}
                            >
                              <ShoppingCart className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Pedido</span>
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-red-500"
                              onClick={() => unassignMesa(mesa.id)}
                              disabled={unassigningMesa === mesa.id}
                              title="Dejar de atender esta mesa"
                            >
                              {unassigningMesa === mesa.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <X className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Available mesas to assign */}
        {availableMesas.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-2 mb-2">
              <Armchair className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mesas disponibles ({availableMesas.length})</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableMesas.map((mesa) => {
                const status = getMesaStatus(mesa)
                return (
                  <motion.button
                    key={mesa.id}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => assignMesa(mesa.id)}
                    disabled={assigningMesa === mesa.id}
                    className={cn(
                      "relative flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all cursor-pointer",
                      status === "libre" && "border-border/50 bg-card hover:border-primary/30",
                      status === "nuevo" && "border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700",
                      status === "preparando" && "border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700",
                      status === "listo" && "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700",
                      assigningMesa === mesa.id && "opacity-50",
                    )}
                  >
                    {assigningMesa === mesa.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                        <Loader2 className="h-5 w-5 animate-spin" style={{ color }} />
                      </div>
                    )}
                    <span className={cn(
                      "text-xl font-extrabold",
                      status === "libre" && "text-foreground/80",
                      status === "nuevo" && "text-amber-700 dark:text-amber-300",
                      status === "preparando" && "text-orange-700 dark:text-orange-300",
                      status === "listo" && "text-emerald-700 dark:text-emerald-300",
                    )}>
                      {mesa.numero}
                    </span>
                    {mesa.nombre && (
                      <span className="text-[9px] text-muted-foreground truncate max-w-[90%] mt-0.5">{mesa.nombre}</span>
                    )}
                    <span className="text-[9px] mt-1 flex items-center gap-0.5 text-primary/60 font-semibold">
                      <Plus className="h-2.5 w-2.5" />
                      Asignar
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Other mozos' mesas (read-only) */}
        {otherMozosMesas.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <div className="flex items-center gap-2 mb-2">
              <Armchair className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-xs font-bold text-muted-foreground/50 uppercase tracking-wider">Otro mozo ({otherMozosMesas.length})</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {otherMozosMesas.map((mesa) => (
                <div
                  key={mesa.id}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-border/30 bg-muted/20 opacity-50"
                >
                  <span className="text-lg font-bold text-muted-foreground">{mesa.numero}</span>
                  {mesa.empleado && (
                    <span className="text-[8px] text-muted-foreground truncate max-w-[90%] mt-0.5">
                      {mesa.empleado.nombre.split(" ")[0]}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {mesas.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center bg-muted/30">
                  <Armchair className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-semibold text-muted-foreground">No hay mesas activas</p>
                <p className="text-xs text-muted-foreground">El salón aún no tiene mesas configuradas</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Info card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tu información</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nombre</span>
                  <span className="text-sm font-semibold">{mozoInfo.nombre}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Código</span>
                  <span className="text-sm font-bold font-mono bg-muted px-2 py-0.5 rounded">{mozoInfo.codigo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Negocio</span>
                  <span className="text-sm font-semibold">{mozoInfo.negocio.nombre}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* How it works */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="rounded-2xl border-border/50">
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cómo funciona</p>
              <div className="space-y-2.5">
                {[
                  { step: "1", text: "Seleccioná las mesas que estás atendiendo" },
                  { step: "2", text: "Tocá \"Pedido\" para abrir el menú y cargar un pedido" },
                  { step: "3", text: "Los pedidos por QR también cuentan para vos" },
                  { step: "4", text: "Dejá de atender una mesa cuando termines" },
                ].map((item) => (
                  <div key={item.step} className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ backgroundColor: color }}
                    >
                      {item.step}
                    </div>
                    <span className="text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {scannerOpen && (
          <MozoQRScanner
            mozoInfo={mozoInfo}
            onScan={(slug, mesaNumero) => handleScannedMesa(slug, mesaNumero)}
            onClose={() => setScannerOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// QR Scanner Component
// ============================================
function MozoQRScanner({
  mozoInfo,
  onScan,
  onClose,
}: {
  mozoInfo: MozoInfo
  onScan: (slug: string, mesaNumero: number) => void
  onClose: () => void
}) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const scannerInstanceRef = useRef<ReturnType<typeof createScanner> | null>(null)
  const isRunningRef = useRef(false)
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "scanned">("loading")
  const [errorMsg, setErrorMsg] = useState("")
  const [scannedMesa, setScannedMesa] = useState<ScannedMesa | null>(null)
  const lastScanRef = useRef<string>("")

  function createScanner(elementId: string) {
    const { Html5Qrcode } = require("html5-qrcode")
    return new Html5Qrcode(elementId)
  }

  useEffect(() => {
    let mounted = true

    async function startScanner() {
      try {
        const scanner = createScanner("mozo-qr-reader")
        scannerInstanceRef.current = scanner

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
          },
          (decodedText: string) => {
            // Prevent duplicate scans
            if (decodedText === lastScanRef.current) return
            lastScanRef.current = decodedText

            // Parse the URL: expected format /n/{slug}?mesa={num}
            try {
              const url = new URL(decodedText)
              const pathParts = url.pathname.split("/")
              const slug = pathParts[pathParts.length - 1]
              const mesaParam = url.searchParams.get("mesa")
              const mesaNumero = mesaParam ? parseInt(mesaParam, 10) : null

              if (slug && mesaNumero && !isNaN(mesaNumero)) {
                if (mounted) {
                  setStatus("scanned")
                  setScannedMesa({ slug, mesaNumero, negocioNombre: "" })
                  isRunningRef.current = false
                  scanner.stop().then(() => {
                    scanner.clear()
                  }).catch(() => {})
                }
              } else {
                setErrorMsg("Este QR no es de una mesa válida")
                setTimeout(() => setErrorMsg(""), 2000)
              }
            } catch {
              setErrorMsg("QR no reconocido — escaneá el código de una mesa")
              setTimeout(() => setErrorMsg(""), 2000)
            }
          },
          () => {}
        )

        if (mounted) {
          isRunningRef.current = true
          setStatus("ready")
        }
      } catch {
        if (mounted) {
          setStatus("error")
          setErrorMsg("No se pudo acceder a la cámara. Verificá los permisos.")
        }
      }
    }

    startScanner()

    return () => {
      mounted = false
      if (scannerInstanceRef.current && isRunningRef.current) {
        isRunningRef.current = false
        scannerInstanceRef.current.stop().then(() => {
          scannerInstanceRef.current?.clear()
        }).catch(() => {})
      }
    }
  }, [])

  const handleConfirmScan = () => {
    if (scannedMesa) {
      onScan(scannedMesa.slug, scannedMesa.mesaNumero)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/95 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5" style={{ color: mozoInfo.negocio.colorPrincipal }} />
          <span className="font-semibold text-sm">Escanear mesa</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scanner area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {status === "scanned" && scannedMesa ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm text-center space-y-4"
          >
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-emerald-500/20">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <div>
              <p className="text-white font-bold text-xl">¡Mesa detectada!</p>
              <p className="text-white/60 text-sm mt-1">Mesa {scannedMesa.mesaNumero}</p>
            </div>
            <Button
              className="w-full rounded-xl gap-2 font-semibold h-12"
              style={{ backgroundColor: mozoInfo.negocio.colorPrincipal }}
              onClick={handleConfirmScan}
            >
              Abrir menú de la mesa
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-xl h-10 text-white border-white/20 hover:bg-white/10"
              onClick={() => {
                setStatus("loading")
                setScannedMesa(null)
                lastScanRef.current = ""
                setTimeout(() => {
                  if (scannerInstanceRef.current) {
                    scannerInstanceRef.current.start(
                      { facingMode: "environment" },
                      { fps: 10, qrbox: { width: 250, height: 250 } },
                      (decodedText: string) => {
                        if (decodedText === lastScanRef.current) return
                        lastScanRef.current = decodedText
                        try {
                          const url = new URL(decodedText)
                          const pathParts = url.pathname.split("/")
                          const slug = pathParts[pathParts.length - 1]
                          const mesaParam = url.searchParams.get("mesa")
                          const mesaNumero = mesaParam ? parseInt(mesaParam, 10) : null
                          if (slug && mesaNumero) {
                            setStatus("scanned")
                            setScannedMesa({ slug, mesaNumero, negocioNombre: "" })
                            scannerInstanceRef.current?.stop().catch(() => {})
                          }
                        } catch { /* ignore */ }
                      },
                      () => {}
                    ).then(() => setStatus("ready")).catch(() => setStatus("error"))
                  }
                }, 500)
              }}
            >
              Escanear otra mesa
            </Button>
          </motion.div>
        ) : (
          <>
            <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden border-2 border-white/20">
              <div id="mozo-qr-reader" ref={scannerRef} className="w-full h-full" />
              {status === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="text-center space-y-2">
                    <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
                    <p className="text-white/60 text-xs">Iniciando cámara...</p>
                  </div>
                </div>
              )}
              {status === "error" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6">
                  <div className="text-center space-y-3">
                    <WifiOff className="h-8 w-8 text-red-400 mx-auto" />
                    <p className="text-white/80 text-sm">{errorMsg}</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-white/40 text-xs mt-4">
              Apuntá la cámara al código QR ubicado en la mesa
            </p>
            {errorMsg && status !== "error" && (
              <p className="text-amber-400 text-xs mt-2">{errorMsg}</p>
            )}
          </>
        )}
      </div>
    </motion.div>
  )
}
