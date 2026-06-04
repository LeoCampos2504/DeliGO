"use client"

import { cn } from "@/lib/utils"

interface LogoProps {
  size?: "sm" | "md" | "lg"
  className?: string
}

const sizeMap = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
}

export function Logo({ size = "md", className }: LogoProps) {
  return (
    <span className={cn("font-extrabold tracking-tight", sizeMap[size], className)}>
      <span className="text-foreground">Deli</span>
      <span className="text-primary">GO</span>
    </span>
  )
}
