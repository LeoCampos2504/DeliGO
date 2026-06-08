"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Logo } from "@/components/shared/logo"
import { Loader2, Store, AtSign, Lock, Mail, Tag } from "lucide-react"
import { toast } from "sonner"

export default function NegocioRegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nombre_local: "",
    usuario: "",
    email: "",
    password: "",
    rubro: "restaurante",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role: "negocio" }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Error al registrar")
        return
      }
      toast.success("¡Cuenta creada! Revisá tu email para verificarla.")
      router.push("/negocio")
    } catch {
      toast.error("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  const rubros = [
    { value: "restaurante", label: "🍔 Restaurante / Comida" },
    { value: "ropa", label: "👕 Ropa / Indumentaria" },
    { value: "negocio", label: "🏪 Otro negocio" },
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-emerald-50/30 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Logo className="h-10 w-auto mx-auto" />
          <h1 className="text-xl font-bold">Registrá tu local</h1>
          <p className="text-sm text-muted-foreground">Creá tu cuenta y empezá a vender en DeliGO</p>
        </div>

        <Card className="border-border/50 shadow-lg shadow-emerald-500/5">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre" className="text-sm font-semibold">
                  Nombre del local
                </Label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nombre"
                    placeholder="Mi Negocio"
                    value={form.nombre_local}
                    onChange={(e) => setForm({ ...form, nombre_local: e.target.value })}
                    className="pl-10 h-11 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="usuario" className="text-sm font-semibold">
                  Usuario
                </Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="usuario"
                    placeholder="mi_negocio"
                    value={form.usuario}
                    onChange={(e) => setForm({ ...form, usuario: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                    className="pl-10 h-11 rounded-xl"
                    required
                    minLength={3}
                    maxLength={30}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">3-30 caracteres, letras, números y _</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="mi@negocio.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="pl-10 h-11 rounded-xl"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="pl-10 h-11 rounded-xl"
                    required
                    minLength={6}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Mínimo 6 caracteres</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rubro" className="text-sm font-semibold">
                  Rubro
                </Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <select
                    id="rubro"
                    value={form.rubro}
                    onChange={(e) => setForm({ ...form, rubro: e.target.value })}
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-input bg-background text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    required
                  >
                    {rubros.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Crear cuenta"}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tenés cuenta?{" "}
                <a href="/negocio" className="text-emerald-600 hover:text-emerald-700 font-semibold underline underline-offset-2">
                  Ingresar
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
