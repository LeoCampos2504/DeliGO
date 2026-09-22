import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const source = readFileSync(
  resolve(import.meta.dir, "delivery-tracking-map.tsx"),
  "utf8"
)

describe("P2-T02-R5A — Cliente tracking map iOS safe-area and header layout", () => {
  test("preserves the full-bleed fixed overlay and flex map layout", () => {
    expect(source).toContain('className="fixed inset-0 z-[100] flex flex-col bg-background"')
    expect(source).toContain('className="flex-1 relative"')
    expect(source).toContain('className="absolute inset-0"')
    expect(source).toContain("map.invalidateSize()")
  })

  test("makes the header content safe-area-aware without changing the full-bleed root", () => {
    expect(source).toContain(
      'grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3'
    )
    expect(source).not.toMatch(/className="relative z-10 flex items-center justify-between px-4 py-3/)
  })

  test("keeps the title centered independently from live-status and close-control widths", () => {
    expect(source).toContain('className="justify-self-start flex items-center gap-3 min-w-0"')
    expect(source).toContain('className="justify-self-center flex items-center gap-1.5"')
    expect(source).toContain('className="justify-self-end w-9 h-9')
    expect(source).toContain("Rastreando envío")
    expect(source).toContain('aria-label="Cerrar mapa"')
  })

  test("protects the client tracking footer from the iOS home indicator", () => {
    expect(source).toContain(
      'border-t border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]'
    )
    expect(source).not.toMatch(/border-t border-border px-4 py-3/)
  })

  test("does not introduce a second geolocation watcher or alter future navigation scope", () => {
    expect(source).not.toMatch(/navigator\.geolocation|watchPosition|watcher/i)
    expect(source).not.toContain("follow camera")
    expect(source).not.toContain("MapLibre")
  })
})
