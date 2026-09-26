"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Download, X, Share, Smartphone, ChevronRight, ChevronDown, ShieldCheck, Wifi, Globe, Chrome, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useInstallPrompt, detectAndroidBrowser } from "@/hooks/use-install-prompt"
import { getRoleFromPath, getRoleConfig } from "@/lib/role-config"

/**
 * InstallPrompt — Smart PWA install component
 *
 * Flow:
 * 1. Android + beforeinstallprompt → Direct "Instalar" button (native install dialog)
 * 2. Android + NO beforeinstallprompt → Step-by-step visual guide
 * 3. iOS Safari → Share → Add to home screen instructions
 * 4. Already installed → Nothing
 */
export function InstallPrompt() {
  const pathname = usePathname()
  if (isMozoRoute(pathname)) return null
  if (isLegacyOperationsTombstoneRoute(pathname)) return null

  return <InstallPromptInner pathname={pathname} />
}

// Exportadas (P2-T52-R1B) únicamente para permitir un contrato de test
// puro sobre la clasificación de ruta, sin necesitar montar el componente
// completo (que depende de framer-motion/beforeinstallprompt/hooks de
// navegador) — mismo patrón ya usado en otros archivos de este repo para
// lógica de exclusión por pathname.
export function isMozoRoute(pathname: string) {
  return pathname === "/mozo" || pathname.startsWith("/mozo/")
}

// P2-T52-R1B: /e y /s son tombstones legacy retirados (sirven únicamente
// <LegacyAccessRetired/>, cero funcionalidad real) — nunca deben promover
// instalar una PWA separada ("DeliGO Empleados"/"DeliGO Salón") cuyo único
// contenido posible sería esa pantalla de retiro. Distinto de /mozo (arriba):
// esa ruta sigue siendo un flujo funcional real y con compatibilidad activa,
// no un tombstone — su exclusión tiene otra razón y no se toca acá.
export function isLegacyOperationsTombstoneRoute(pathname: string) {
  return (
    pathname === "/e" ||
    pathname.startsWith("/e/") ||
    pathname === "/s" ||
    pathname.startsWith("/s/")
  )
}

function InstallPromptInner({ pathname }: { pathname: string }) {
  const { isInstallable, isInstalled, installationState, promptInstall, shouldShowManualPrompt, platform, secureContext, androidBrowser, isIosSafari } = useInstallPrompt()
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const successShownRef = useRef(false)

  const role = getRoleFromPath(pathname)
  const config = getRoleConfig(role)

  // Listen for appinstalled — the authoritative, OS-confirmed install event —
  // to show the success state exactly once, even if the event fires more
  // than once for this mount.
  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => {
      if (successShownRef.current) return
      successShownRef.current = true
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    }
    window.addEventListener("appinstalled", handler)
    return () => window.removeEventListener("appinstalled", handler)
  }, [])

  // Don't show if already installed
  if (isInstalled) {
    return (
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
          >
            <div className="bg-green-500 text-white rounded-2xl p-4 shadow-2xl flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">✅</div>
              <div>
                <p className="font-bold text-sm">¡App instalada!</p>
                <p className="text-white/80 text-xs">Encontrá {config.name} en tu pantalla de inicio</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  // Acceptance is not installation confirmation. Keep a visible, indefinite
  // state until the browser emits appinstalled; never imply numeric progress.
  if (platform === "android" && installationState === "installing-background") {
    return <AndroidInstallPending config={config} />
  }

  // Android with native prompt available — show direct install UI
  if (platform === "android" && isInstallable && !bannerDismissed) {
    return (
      <AndroidInstallBanner
        config={config}
        onInstall={handleNativeInstall}
        onDismiss={() => setBannerDismissed(true)}
        installing={installing}
      />
    )
  }

  // Android FAB after banner dismissed (so user can still install)
  if (platform === "android" && isInstallable && bannerDismissed) {
    return (
      <InstallFAB
        config={config}
        onInstall={handleNativeInstall}
        installing={installing}
      />
    )
  }

  // iOS Safari — instruction banner
  if (shouldShowManualPrompt && platform === "ios") {
    if (bannerDismissed) return null
    return (
      <IOSInstallBanner
        config={config}
        isSafari={isIosSafari}
        onDismiss={() => setBannerDismissed(true)}
      />
    )
  }

  // Android manual fallback — step-by-step visual guide
  if (shouldShowManualPrompt && platform === "android") {
    if (bannerDismissed) return null
    return (
      <AndroidManualGuide
        config={config}
        onDismiss={() => setBannerDismissed(true)}
        secureContext={secureContext}
        androidBrowser={androidBrowser}
      />
    )
  }

  return null

  async function handleNativeInstall() {
    setInstalling(true)
    try {
      await promptInstall()
    } finally {
      setInstalling(false)
    }
  }
}

function AndroidInstallPending({ config }: { config: ReturnType<typeof getRoleConfig> }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
    >
      <div className={`bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo} rounded-2xl p-4 shadow-2xl ${config.shadowColor} flex items-center gap-3 text-white`}>
        <motion.div
          aria-hidden="true"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          className="flex-shrink-0"
        >
          <Download className="w-6 h-6" />
        </motion.div>
        <div>
          <p className="font-bold text-sm">Terminando la instalación…</p>
          <p className="text-white/80 text-xs mt-0.5">
            Puede tardar unos segundos. Te avisamos cuando esté lista.
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================
// Android Native Install Banner — Direct button
// ============================================
function AndroidInstallBanner({
  config,
  onInstall,
  onDismiss,
  installing,
}: {
  config: ReturnType<typeof getRoleConfig>
  onInstall: () => void
  onDismiss: () => void
  installing: boolean
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-x-0 bottom-0 z-50 flex justify-center"
      >
        <div className="w-full max-w-lg mx-4 mb-4">
          <div className={`bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} rounded-3xl p-5 shadow-2xl ${config.shadowColor} relative overflow-hidden`}>
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/5 rounded-full" />

            {/* Close button */}
            <button
              onClick={onDismiss}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors z-10"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            <div className="flex items-start gap-4">
              {/* App icon */}
              <div className="flex-shrink-0 w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                <img
                  src={config.icon192}
                  alt={config.name}
                  className="w-10 h-10 rounded-xl"
                />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 pr-6">
                <h3 className="text-white font-bold text-base">Instalar {config.name}</h3>
                <p className="text-white/80 text-sm mt-1 leading-relaxed">
                  Accedé más rápido, usá la app sin conexión y recibí notificaciones
                </p>

                {/* Benefits chips */}
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/90 bg-white/15 rounded-full px-2 py-0.5">
                    <Smartphone className="w-3 h-3" /> Sin navegador
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/90 bg-white/15 rounded-full px-2 py-0.5">
                    🔔 Notificaciones
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-white/90 bg-white/15 rounded-full px-2 py-0.5">
                    ⚡ Más rápido
                  </span>
                </div>
              </div>
            </div>

            {/* Big install button */}
            <Button
              onClick={onInstall}
              disabled={installing}
              className="w-full mt-4 bg-white hover:bg-white/95 text-gray-900 font-bold text-base h-12 rounded-xl shadow-lg gap-2 transition-all active:scale-[0.98]"
            >
              {installing ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Download className="w-5 h-5" />
                  </motion.div>
                  Instalando...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Instalar en mi celular
                  <ChevronRight className="w-4 h-4 ml-auto opacity-60" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ============================================
// Floating Install FAB — Appears after banner dismissed
// ============================================
function InstallFAB({
  config,
  onInstall,
  installing,
}: {
  config: ReturnType<typeof getRoleConfig>
  onInstall: () => void
  installing: boolean
}) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onInstall}
      disabled={installing}
      className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} shadow-xl ${config.shadowColor} flex items-center justify-center text-white active:scale-90 transition-transform`}
      aria-label={`Instalar ${config.name}`}
    >
      {installing ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Download className="w-6 h-6" />
        </motion.div>
      ) : (
        <Download className="w-6 h-6" />
      )}

      {/* Pulse animation ring */}
      {!installing && (
        <span className={`absolute inset-0 rounded-full bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} animate-ping opacity-20`} />
      )}
    </motion.button>
  )
}

// ============================================
// Android Manual Guide — Step-by-step visual
// This shows when beforeinstallprompt didn't fire
// ============================================
function AndroidManualGuide({
  config,
  onDismiss,
  secureContext,
  androidBrowser,
}: {
  config: ReturnType<typeof getRoleConfig>
  onDismiss: () => void
  secureContext: boolean
  androidBrowser: ReturnType<typeof detectAndroidBrowser>
}) {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2500)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  // Get browser-specific instructions
  const browserSteps = getBrowserSteps(androidBrowser)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed inset-x-0 bottom-0 z-50"
      >
        <div className="mx-3 mb-3">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            {/* Header */}
            <div className={`bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo} px-5 pt-4 pb-5 relative`}>
              <button
                onClick={onDismiss}
                className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <img src={config.icon192} alt={config.name} className="w-8 h-8 rounded-lg" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Instalar {config.name}</h3>
                  <p className="text-white/80 text-xs mt-0.5">Seguí estos pasos para instalar la app</p>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="px-5 py-4">
              {/* HTTPS warning if not secure */}
              {!secureContext && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                  <div className="flex items-start gap-2">
                    <Globe className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">Conexión no segura</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 leading-relaxed">
                        Para instalar la app directamente, necesitás acceder por HTTPS. Probá abrir esta página desde un enlace seguro o usando Chrome.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Browser-specific steps */}
              <div className="space-y-3">
                {browserSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} flex items-center justify-center text-white font-bold text-xs`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{step.title}</p>
                      {step.description && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{step.description}</p>
                      )}
                      {step.visual && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5">
                          {step.visual}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Expandable: Why can't I install directly? */}
              <div className="mt-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  ¿Por qué no puedo instalar directamente?
                </button>
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed space-y-2">
                        {!secureContext ? (
                          <p>
                            <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-amber-500" />
                            Estás accediendo por una conexión no segura (HTTP). Chrome solo permite instalar apps directamente desde sitios seguros (HTTPS). Si accedés por HTTPS, aparecerá el botón de instalación automática.
                          </p>
                        ) : (
                          <p>
                            <Wifi className="w-3.5 h-3.5 inline mr-1 text-blue-500" />
                            A veces Chrome tarda un momento en detectar que la app es instalable. Si ya navegaste un rato, el botón directo debería aparecer automáticamente.
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Bottom action */}
            <div className="px-5 pb-4">
              <Button
                onClick={onDismiss}
                className="w-full h-11 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold rounded-xl transition-all"
              >
                Entendido
              </Button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ============================================
// iOS Install Banner — Instructions only
// ============================================
function IOSInstallBanner({
  config,
  isSafari,
  onDismiss,
}: {
  config: ReturnType<typeof getRoleConfig>
  isSafari: boolean
  onDismiss: () => void
}) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md"
      >
        <div className={`bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo} rounded-2xl p-4 shadow-2xl ${config.shadowColor} relative`}>
          <button
            onClick={onDismiss}
            className="absolute top-2 right-2 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex items-center gap-3 pr-7">
            <div className="flex-shrink-0 w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
              <img src={config.icon192} alt={config.name} className="w-8 h-8 rounded-lg" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Instalá {config.name}</h3>
              <p className="text-white/80 text-xs mt-0.5">Seguí estos pasos desde el navegador:</p>
            </div>
          </div>

          <ol className="mt-4 space-y-2.5">
            {(isSafari
              ? [
                  { icon: <MoreVertical className="w-4 h-4" />, title: "Abrí las opciones de Safari", detail: "Tocá el botón de opciones o menú del navegador." },
                  { icon: <Share className="w-4 h-4" />, title: "Elegí Compartir", detail: "Se abre la hoja para compartir de iOS." },
                  { icon: <ChevronDown className="w-4 h-4" />, title: "Si hace falta, tocá Ver más", detail: "La ubicación puede cambiar según la versión." },
                  { icon: <Smartphone className="w-4 h-4" />, title: "Seleccioná Agregar a pantalla de inicio" },
                  { icon: <Download className="w-4 h-4" />, title: "Confirmá tocando Agregar" },
                ]
              : [
                  { icon: <Share className="w-4 h-4" />, title: "Abrí el menú para compartir del navegador", detail: "La ubicación depende del navegador que estés usando." },
                  { icon: <Smartphone className="w-4 h-4" />, title: "Buscá Agregar a pantalla de inicio", detail: "La opción puede estar en otro menú o no estar disponible." },
                  { icon: <Download className="w-4 h-4" />, title: "Confirmá la acción en iOS" },
                ]
            ).map((step, index) => (
              <li key={step.title} className="flex items-start gap-2.5 text-white">
                <span className="w-7 h-7 flex-shrink-0 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <span className="w-7 h-7 flex-shrink-0 rounded-lg bg-white/15 flex items-center justify-center" aria-hidden="true">
                  {step.icon}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className="block text-xs font-semibold">{step.title}</span>
                  {step.detail && <span className="block text-[11px] text-white/75 mt-0.5">{step.detail}</span>}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-3 text-[11px] leading-relaxed text-white/75">
            Los nombres o la ubicación de estas opciones pueden variar según tu versión de iOS.
          </p>

          <Button
            onClick={onDismiss}
            size="sm"
            className="w-full mt-3 bg-white text-foreground hover:bg-white/90 font-semibold"
          >
            Entendido
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ============================================
// Browser-specific step definitions
// ============================================
interface InstallStep {
  title: string
  description?: string
  visual?: React.ReactNode
}

function getBrowserSteps(browser: ReturnType<typeof detectAndroidBrowser>): InstallStep[] {
  switch (browser) {
    case "chrome":
      return [
        {
          title: "Tocá el botón ⋮ del navegador",
          description: "Está en la esquina superior derecha de Chrome",
          visual: (
            <>
              <MoreVertical className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">⋮ Menú</span>
            </>
          ),
        },
        {
          title: 'Seleccioná "Instalar app"',
          description: 'O "Añadir a pantalla de inicio" en algunas versiones',
          visual: (
            <>
              <Download className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Instalar app</span>
            </>
          ),
        },
        {
          title: "Confirmá la instalación",
          description: "Tocá Instalar en el diálogo que aparece",
        },
      ]

    case "firefox":
      return [
        {
          title: "Tocá el botón ⋮ del navegador",
          description: "Está en la esquina inferior o superior derecha",
          visual: (
            <>
              <MoreVertical className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">⋮ Menú</span>
            </>
          ),
        },
        {
          title: 'Seleccioná "Instalar" o "Agregar a inicio"',
          description: "Puede estar dentro de un submenú",
        },
        {
          title: "Confirmá la instalación",
          description: "Tocá Agregar en el diálogo que aparece",
        },
      ]

    case "samsung":
      return [
        {
          title: "Tocá el botón ☰ del navegador",
          description: "Está en la esquina inferior derecha",
          visual: (
            <>
              <span className="text-sm">☰</span>
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Menú</span>
            </>
          ),
        },
        {
          title: 'Seleccioná "Añadir a pantalla de inicio"',
          description: "O buscá la opción Instalar en el menú",
        },
        {
          title: "Confirmá la instalación",
        },
      ]

    case "opera":
      return [
        {
          title: "Tocá el botón ⋮ del navegador",
          description: "Está en la esquina superior o inferior derecha",
          visual: (
            <>
              <MoreVertical className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">⋮ Menú</span>
            </>
          ),
        },
        {
          title: 'Seleccioná "Agregar a pantalla de inicio"',
        },
        {
          title: "Confirmá la instalación",
        },
      ]

    case "edge":
      return [
        {
          title: "Tocá el botón ⋯ del navegador",
          description: "Está en la esquina inferior derecha",
          visual: (
            <>
              <span className="text-sm">⋯</span>
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Menú</span>
            </>
          ),
        },
        {
          title: 'Seleccioná "Agregar a teléfono" o "Instalar app"',
          description: "Puede estar en \"Aplicaciones\"",
        },
        {
          title: "Confirmá la instalación",
        },
      ]

    default:
      return [
        {
          title: "Abrí el menú del navegador",
          description: "Generalmente es un ícono ⋮ o ☰ en la esquina",
          visual: (
            <>
              <MoreVertical className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Menú</span>
            </>
          ),
        },
        {
          title: 'Buscá "Instalar app" o "Agregar a inicio"',
        },
        {
          title: "Confirmá la instalación",
        },
      ]
  }
}
