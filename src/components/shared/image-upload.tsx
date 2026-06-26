"use client"

import { useState, useRef, useCallback } from "react"
import { Camera, X, Loader2, Upload, ImagePlus } from "lucide-react"
import { cn } from "@/lib/utils"

// ============================================
// Types
// ============================================
interface ImageUploadProps {
  /** Current image URL (controlled) */
  value: string | null
  /** Called when image is uploaded successfully with the new URL */
  onChange: (url: string) => void
  /** Called when image is removed */
  onRemove?: () => void
  /** Upload category for Cloudinary folder */
  category: "productos" | "agregados" | "ingredientes" | "logos" | "banners" | "fondos" | "chat"
  /** Negocio slug or pedido ID for folder path */
  slug: string
  /** Variant of upload UI */
  variant?: "avatar" | "banner" | "square" | "circle" | "compact"
  /** Placeholder text */
  placeholder?: string
  /** Whether to show the remove button */
  showRemove?: boolean
  /** Additional class name */
  className?: string
  /** Accept file types */
  accept?: string
  /** Disabled state */
  disabled?: boolean
}

// ============================================
// Main Component
// ============================================
export function ImageUpload({
  value,
  onChange,
  onRemove,
  category,
  slug,
  variant = "square",
  placeholder,
  showRemove = true,
  className,
  accept = "image/png,image/jpeg,image/webp",
  disabled = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(
    async (file: File) => {
      if (disabled || uploading) return

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("El archivo es muy grande. Máximo 5MB.")
        return
      }

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("category", category)
        formData.append("slug", slug)
        formData.append("type", "image")

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Error al subir imagen")
        }

        const data = await res.json()
        onChange(data.url)
      } catch (err) {
        console.error("Upload error:", err)
        alert(err instanceof Error ? err.message : "Error al subir la imagen")
      } finally {
        setUploading(false)
      }
    },
    [category, slug, onChange, disabled, uploading]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    // Reset input so same file can be selected again
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleUpload(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  // Size classes based on variant
  const sizeClasses: Record<string, string> = {
    avatar: "w-20 h-20 rounded-full",
    banner: "w-full h-32 rounded-xl",
    square: "w-24 h-24 rounded-xl",
    circle: "w-16 h-16 rounded-full",
    compact: "w-12 h-12 rounded-lg",
  }

  const containerClass = cn(
    "relative group overflow-hidden border-2 border-dashed border-border/60 bg-muted/30 flex items-center justify-center transition-all cursor-pointer",
    sizeClasses[variant],
    dragOver && "border-primary bg-primary/5",
    uploading && "opacity-60 pointer-events-none",
    disabled && "opacity-50 pointer-events-none",
    className
  )

  return (
    <div className="relative">
      {value ? (
        <div className={cn("relative group overflow-hidden", sizeClasses[variant], className)}>
          <img
            src={value}
            alt="Imagen subida"
            className="w-full h-full object-cover"
          />
          {/* Overlay with actions */}
          {!disabled && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="p-1.5 rounded-full bg-white/90 text-foreground hover:bg-white transition-colors"
                title="Cambiar imagen"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              {showRemove && onRemove && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="p-1.5 rounded-full bg-red-500/90 text-white hover:bg-red-600 transition-colors"
                  title="Eliminar imagen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div
          className={containerClass}
          onClick={() => !disabled && inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click()
          }}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
          ) : variant === "banner" ? (
            <div className="flex flex-col items-center gap-1 text-muted-foreground">
              <Upload className="h-5 w-5" />
              <span className="text-xs font-medium">
                {placeholder || "Arrastrá o tocá para subir"}
              </span>
            </div>
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || uploading}
      />
    </div>
  )
}

// ============================================
// Multi-Image Upload (for product gallery)
// ============================================
interface MultiImageUploadProps {
  /** Current image URLs */
  value: string[]
  /** Called when images change */
  onChange: (urls: string[]) => void
  /** Upload category */
  category: "productos" | "agregados" | "ingredientes" | "logos" | "banners" | "fondos" | "chat"
  /** Negocio slug */
  slug: string
  /** Max images */
  max?: number
  /** Disabled */
  disabled?: boolean
}

export function MultiImageUpload({
  value,
  onChange,
  category,
  slug,
  max = 6,
  disabled = false,
}: MultiImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (files: FileList) => {
    if (disabled || uploading) return
    setUploading(true)

    const newUrls: string[] = []
    const remaining = max - value.length

    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i]
      if (file.size > 5 * 1024 * 1024) continue

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("category", category)
        formData.append("slug", slug)
        formData.append("type", "image")

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          newUrls.push(data.url)
        }
      } catch {
        // Skip failed uploads
      }
    }

    if (newUrls.length > 0) {
      onChange([...value, ...newUrls])
    }
    setUploading(false)
  }

  const removeImage = (index: number) => {
    const updated = [...value]
    updated.splice(index, 1)
    onChange(updated)
  }

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return
    const updated = [...value]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved)
    onChange(updated)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {value.map((url, idx) => (
          <div
            key={idx}
            className="relative group w-20 h-20 rounded-xl overflow-hidden border border-border/50"
          >
            <img
              src={url}
              alt={`Imagen ${idx + 1}`}
              className="w-full h-full object-cover"
            />
            {/* Primary badge */}
            {idx === 0 && (
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] font-bold text-center py-0.5">
                Principal
              </span>
            )}
            {/* Actions overlay */}
            {!disabled && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {idx > 0 && (
                  <button
                    type="button"
                    onClick={() => moveImage(idx, idx - 1)}
                    className="p-1 rounded-full bg-white/90 text-foreground text-[10px] font-bold"
                    title="Mover izquierda"
                  >
                    ←
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="p-1 rounded-full bg-red-500/90 text-white"
                  title="Eliminar"
                >
                  <X className="h-3 w-3" />
                </button>
                {idx < value.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveImage(idx, idx + 1)}
                    className="p-1 rounded-full bg-white/90 text-foreground text-[10px] font-bold"
                    title="Mover derecha"
                  >
                    →
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Add button */}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-border/60 bg-muted/30 flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 transition-all disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <ImagePlus className="h-5 w-5" />
                <span className="text-[9px] font-medium">Agregar</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(e) => {
          if (e.target.files) handleUpload(e.target.files)
          e.target.value = ""
        }}
        className="hidden"
        disabled={disabled || uploading}
      />

      <p className="text-[10px] text-muted-foreground">
        {value.length}/{max} imágenes · Máximo 5MB cada una · PNG, JPG, WEBP
      </p>
    </div>
  )
}
