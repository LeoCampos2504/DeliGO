/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { chunkArray } from "./chunk-array"

const MAX = 50

function idsCount(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1)
}

describe("T20-DK2B — chunkArray", () => {
  test("0 elementos -> []", () => {
    expect(chunkArray(idsCount(0), MAX)).toEqual([])
  })

  test("1 elemento -> [[1]]", () => {
    expect(chunkArray(idsCount(1), MAX)).toEqual([[1]])
  })

  test("49 elementos -> 1 chunk de 49", () => {
    const chunks = chunkArray(idsCount(49), MAX)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(49)
  })

  test("exactamente 50 -> 1 chunk de 50", () => {
    const chunks = chunkArray(idsCount(50), MAX)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toHaveLength(50)
  })

  test("51 -> 2 chunks: 50 y 1", () => {
    const chunks = chunkArray(idsCount(51), MAX)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(50)
    expect(chunks[1]).toHaveLength(1)
  })

  test("99 -> 2 chunks: 50 y 49", () => {
    const chunks = chunkArray(idsCount(99), MAX)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(50)
    expect(chunks[1]).toHaveLength(49)
  })

  test("100 -> 2 chunks: 50 y 50", () => {
    const chunks = chunkArray(idsCount(100), MAX)
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toHaveLength(50)
    expect(chunks[1]).toHaveLength(50)
  })

  test("101 -> 3 chunks: 50, 50 y 1", () => {
    const chunks = chunkArray(idsCount(101), MAX)
    expect(chunks).toHaveLength(3)
    expect(chunks[0]).toHaveLength(50)
    expect(chunks[1]).toHaveLength(50)
    expect(chunks[2]).toHaveLength(1)
  })

  test("120 -> 3 chunks: 50, 50 y 20", () => {
    const chunks = chunkArray(idsCount(120), MAX)
    expect(chunks).toHaveLength(3)
    expect(chunks.map((c) => c.length)).toEqual([50, 50, 20])
  })

  test("orden determinista: preserva el orden original dentro y entre chunks", () => {
    const chunks = chunkArray(idsCount(101), MAX)
    const flattened = chunks.flat()
    expect(flattened).toEqual(idsCount(101))
  })

  test("sin pérdida ni duplicación para varios tamaños", () => {
    for (const n of [0, 1, 49, 50, 51, 99, 100, 101, 120]) {
      const input = idsCount(n)
      const chunks = chunkArray(input, MAX)
      const flattened = chunks.flat()
      expect(flattened).toEqual(input)
      expect(new Set(flattened).size).toBe(n)
    }
  })

  test("size <= 0 no entra en loop infinito — devuelve todo en un único chunk", () => {
    expect(chunkArray(idsCount(5), 0)).toEqual([idsCount(5)])
    expect(chunkArray(idsCount(5), -1)).toEqual([idsCount(5)])
  })
})
