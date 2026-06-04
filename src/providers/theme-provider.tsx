"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"

type Theme = "dark" | "light" | "system"

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: "dark" | "light"
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = "deligo-theme"

// ---- External store for theme (useSyncExternalStore) ----
let currentTheme: Theme = "light"
const listeners = new Set<() => void>()

function getThemeSnapshot(): Theme {
  return currentTheme
}

function getThemeServerSnapshot(): Theme {
  return "light"
}

function subscribeToTheme(callback: () => void): () => void {
  listeners.add(callback)
  return () => listeners.delete(callback)
}

function setThemeExternal(theme: Theme) {
  currentTheme = theme
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // localStorage not available
  }
  // Notify subscribers
  listeners.forEach((l) => l())
}

// Initialize from localStorage on the client
if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored && ["light", "dark", "system"].includes(stored)) {
      currentTheme = stored
    }
  } catch {
    // localStorage not available
  }
}

// ---- Helpers ----
function getSystemTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "light"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

function applyTheme(resolved: "dark" | "light") {
  const root = document.documentElement
  root.classList.remove("light", "dark")
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

// ---- Provider ----
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getThemeServerSnapshot
  )

  // Apply theme to DOM whenever it changes
  useEffect(() => {
    const resolved = theme === "system" ? getSystemTheme() : theme
    applyTheme(resolved)
  }, [theme])

  // Listen for system theme changes when theme is "system"
  useEffect(() => {
    if (theme !== "system") return
    const mql = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = () => {
      applyTheme(getSystemTheme())
    }
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [theme])

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeExternal(newTheme)
  }, [])

  const resolvedTheme = useMemo(() => {
    return theme === "system" ? getSystemTheme() : theme
  }, [theme])

  const value = useMemo(
    () => ({ theme, setTheme, resolvedTheme }),
    [theme, setTheme, resolvedTheme]
  )

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
