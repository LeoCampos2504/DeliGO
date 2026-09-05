"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Bell, CheckCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSuperAdminStore, type SuperAdminTab } from "@/store/superadmin-store"
import { resolveSuperadminNotificationTarget } from "@/lib/superadmin-notification-navigation"

type Notification = { id: string; titulo: string; cuerpo: string; leido: boolean; datos: string; createdAt: string }

// P2-T26-R2: ya no recibe `onModeration` — la campana ahora resuelve el tab
// de destino (y, cuando corresponde, la entidad concreta a resaltar) por
// tipo de notificación vía resolveSuperadminNotificationTarget(), tolerante
// al shape legacy de review_moderation y al nuevo shape plano de los 5
// tipos agregados en esta tarea. Navega directo contra el store global
// (ya era Zustand) en vez de pasar un callback específico de un solo tipo.
export function SuperadminNotificationBell() {
  const [open, setOpen] = useState(false); const client = useQueryClient()
  const navigateWithEntity = useSuperAdminStore((state) => state.navigateWithEntity)
  const unread = useQuery<{ noLeidos: number }>({ queryKey: ["superadmin-notifications-unread"], queryFn: async () => { const r = await fetch("/api/superadmin/notificaciones?limit=1"); return r.ok ? r.json() : { noLeidos: 0 } }, refetchInterval: 10_000 })
  const list = useQuery<{ notificaciones: Notification[]; noLeidos: number }>({ queryKey: ["superadmin-notifications"], enabled: open, queryFn: async () => { const r = await fetch("/api/superadmin/notificaciones?limit=30"); return r.ok ? r.json() : { notificaciones: [], noLeidos: 0 } } })
  const mark = async (notificationId?: string) => { await fetch("/api/superadmin/notificaciones", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(notificationId ? { action: "mark_read", notificationId } : { action: "mark_all_read" }) }); client.invalidateQueries({ queryKey: ["superadmin-notifications"] }); client.invalidateQueries({ queryKey: ["superadmin-notifications-unread"] }) }
  const count = unread.data?.noLeidos ?? 0
  return <Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full" title="Notificaciones"><Bell className="h-4 w-4" />{count > 0 && <Badge className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[9px]">{count > 99 ? "99+" : count}</Badge>}</Button></PopoverTrigger><PopoverContent align="end" className="w-80 p-0"><div className="flex items-center justify-between border-b p-3"><p className="text-sm font-semibold">Notificaciones</p>{count > 0 && <Button variant="ghost" size="sm" onClick={() => mark()}><CheckCheck className="mr-1 h-3.5 w-3.5" />Leer todas</Button>}</div><div className="max-h-96 overflow-y-auto">{(list.data?.notificaciones ?? []).map((notification) => <button key={notification.id} onClick={async () => { if (!notification.leido) await mark(notification.id); const target = resolveSuperadminNotificationTarget(notification.datos); navigateWithEntity(target.tab as SuperAdminTab, target.entityId); setOpen(false) }} className="w-full border-b p-3 text-left hover:bg-muted/50"><p className="text-sm font-medium">{notification.titulo}</p><p className="mt-1 text-xs text-muted-foreground">{notification.cuerpo}</p></button>)}{!list.data?.notificaciones?.length && <p className="p-6 text-center text-sm text-muted-foreground">No hay notificaciones</p>}</div></PopoverContent></Popover>
}
