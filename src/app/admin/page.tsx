"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useAuthStore } from "@/store/auth-store"
import { useHydrated } from "@/hooks/use-hydrated"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ArrowLeft,
  Shield,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

const SuperAdminPanel = dynamic(
  () => import("@/components/superadmin/superadmin-panel").then((mod) => mod.SuperAdminPanel),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex flex-col bg-background animate-pulse">
        <div className="bg-purple-500/10 px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="h-6 w-20 rounded bg-purple-500/10" />
            <div className="flex gap-2">
              <div className="h-8 w-8 rounded-full bg-purple-500/10" />
              <div className="h-8 w-8 rounded-full bg-purple-500/10" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15" />
            <div>
              <div className="h-5 w-32 rounded bg-purple-500/10" />
              <div className="mt-1 h-3 w-28 rounded bg-purple-500/5" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-amber-500/10" />
            ))}
          </div>
        </div>
        <div className="px-4 py-1.5 flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-20 rounded-xl bg-muted/30" />
          ))}
        </div>
        <div className="max-w-5xl mx-auto px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl p-4 bg-muted/30">
                <div className="h-4 w-20 rounded bg-muted/50 mb-2" />
                <div className="h-8 w-16 rounded bg-muted/50" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  }
)

// ============================================
// SuperAdmin Login Form (shown when not authenticated)
// ============================================
function AdminLoginForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "superadmin", password }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Error al iniciar sesión")
        return
      }

      // Update auth store
      useAuthStore.getState().loginSuperAdmin({
        id: data.user.id,
        token: data.token,
      })

      toast.success("🔐 Panel de administración activado")
      router.replace("/")
    } catch {
      toast.error("Error de conexión. Intentá de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-purple-500/5" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-purple-500/3" />
      </div>

      <div className="relative w-full max-w-sm flex flex-col items-center gap-6">
        {/* Back link */}
        <Link
          href="/"
          className="self-start flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al inicio
        </Link>

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Panel de Admin</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Acceso exclusivo de administración
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="w-full border-border/50 shadow-lg shadow-purple-500/5">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-semibold">
                  Contraseña de administrador
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 rounded-xl"
                    required
                    minLength={6}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Acceder"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Security notice */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl p-3">
          <Shield className="h-4 w-4 shrink-0 text-purple-500" />
          <span>Este acceso es exclusivo para administradores autorizados de la plataforma.</span>
        </div>

        {/* Other roles */}
        <div className="w-full border-t border-border/50 pt-4 space-y-2">
          <p className="text-xs text-muted-foreground text-center">¿Tenés otro perfil?</p>
          <div className="flex gap-2 justify-center">
            <Link href="/login">
              <Button variant="outline" size="sm" className="rounded-full text-xs gap-1.5">
                🍔 Cliente
              </Button>
            </Link>
            <Link href="/negocio">
              <Button variant="outline" size="sm" className="rounded-full text-xs gap-1.5">
                🏪 Negocio
              </Button>
            </Link>
            <Link href="/repartidor">
              <Button variant="outline" size="sm" className="rounded-full text-xs gap-1.5">
                🛵 Repartidor
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Admin Page: Shows login or panel
// ============================================
export default function AdminPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userType = useAuthStore((s) => s.userType)

  // Wait for hydration
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-purple-500/10 animate-pulse" />
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      </div>
    )
  }

  // Not authenticated — show login form
  if (!isAuthenticated() || userType() !== "superadmin") {
    return <AdminLoginForm />
  }

  // Authenticated — show panel
  return <SuperAdminPanel />
}
