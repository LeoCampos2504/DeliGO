"use client"

import { useRef, useCallback } from "react"
import { Search, SlidersHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onFilterClick?: () => void
  placeholder?: string
  className?: string
}

export function SearchBar({
  value,
  onChange,
  onFilterClick,
  placeholder = "Buscar restaurantes, productos...",
  className,
}: SearchBarProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onChange(val)
      }, 300)
    },
    [onChange]
  )

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          defaultValue={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="pl-9 pr-4 h-10 rounded-full bg-muted border-none focus-visible:ring-primary"
        />
      </div>
      {onFilterClick && (
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full shrink-0"
          onClick={onFilterClick}
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
