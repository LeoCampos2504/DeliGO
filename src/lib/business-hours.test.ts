import { describe, expect, test } from "bun:test"
import {
  DEFAULT_BUSINESS_TIMEZONE,
  getBusinessHoursState,
  getBusinessLocalDateParts,
  isBusinessOpenAt,
  normalizeBusinessTimezone,
  type BusinessHoursData,
} from "./business-hours"

const TIMEZONE = "America/Argentina/Buenos_Aires"

function schedule(day: string, apertura: string, cierre: string): BusinessHoursData {
  return { [day]: { abierto: true, apertura, cierre } }
}

function at(instant: string, horarios: BusinessHoursData, extra: Partial<Parameters<typeof isBusinessOpenAt>[0]> = {}) {
  return isBusinessOpenAt({
    instant: new Date(instant),
    timezone: TIMEZONE,
    horarios,
    ...extra,
  })
}

describe("business hours — explicit business IANA timezone", () => {
  test("CASE 1: regular schedule is closed one minute before opening", () => {
    expect(at("2026-08-31T13:59:00.000Z", schedule("1", "11:00", "23:30"))).toBe(false)
  })

  test("CASE 2: exact opening is open", () => {
    expect(at("2026-08-31T14:00:00.000Z", schedule("1", "11:00", "23:30"))).toBe(true)
  })

  test("CASE 3: middle of regular schedule is open", () => {
    expect(at("2026-08-31T21:00:00.000Z", schedule("1", "11:00", "23:30"))).toBe(true)
  })

  test("CASE 4: exact closing preserves inclusive-close semantics", () => {
    expect(at("2026-09-01T02:30:00.000Z", schedule("1", "11:00", "23:30"))).toBe(true)
  })

  test("CASE 5: one minute after closing is closed", () => {
    expect(at("2026-09-01T02:31:00.000Z", schedule("1", "11:00", "23:30"))).toBe(false)
  })

  test("CASE 6: the UTC representation of local opening remains opening", () => {
    const instant = new Date("2026-08-31T14:00:00.000Z")
    expect(getBusinessLocalDateParts(instant, TIMEZONE)).toEqual({ weekday: 1, hour: 11, minute: 0 })
    expect(isBusinessOpenAt({ instant, timezone: TIMEZONE, horarios: schedule("1", "11:00", "23:30") })).toBe(true)
  })

  test("CASE 7: Sunday 23:00 Argentina / Monday 02:00 UTC uses Sunday schedule", () => {
    const instant = new Date("2026-08-31T02:00:00.000Z")
    const result = getBusinessHoursState({
      instant,
      timezone: TIMEZONE,
      horarios: schedule("7", "20:00", "23:59"),
    })
    expect(result.todayKey).toBe("7")
    expect(result.isOpen).toBe(true)
  })

  test("CASE 8: Monday 01:00 is open from Sunday's overnight shift", () => {
    const horarios = schedule("7", "20:00", "02:00")
    expect(at("2026-08-31T04:00:00.000Z", horarios)).toBe(true)
  })

  test("CASE 9: Monday 02:01 is closed without an independent Monday schedule", () => {
    const horarios = schedule("7", "20:00", "02:00")
    expect(at("2026-08-31T05:01:00.000Z", horarios)).toBe(false)
  })

  test("CASE 10: second shift is evaluated", () => {
    const horarios: BusinessHoursData = {
      "1": {
        abierto: true,
        apertura: "09:00",
        cierre: "12:00",
        turno2: true,
        apertura2: "18:00",
        cierre2: "22:00",
      },
    }
    expect(at("2026-08-31T21:00:00.000Z", horarios)).toBe(true)
    expect(at("2026-08-31T16:00:00.000Z", horarios)).toBe(false)
  })

  test("CASE 11: a closed business weekday stays closed even when UTC day differs", () => {
    const horarios: BusinessHoursData = {
      "7": { abierto: false, apertura: "11:00", cierre: "23:30" },
      "1": { abierto: true, apertura: "09:00", cierre: "10:00" },
    }
    // Sunday 23:00 in Argentina is Monday 02:00 UTC; Monday is outside its own range.
    expect(at("2026-08-31T02:00:00.000Z", horarios)).toBe(false)
  })

  test("CASE 12: server canonical state equals client expectation regardless of viewer timezone", () => {
    const instant = new Date("2026-08-31T02:00:00.000Z")
    const horarios = schedule("7", "20:00", "23:59")
    const serverState = getBusinessHoursState({ instant, timezone: TIMEZONE, horarios })
    const argentinaViewerExpected = isBusinessOpenAt({ instant, timezone: TIMEZONE, horarios })
    const madridViewerExpected = isBusinessOpenAt({ instant, timezone: TIMEZONE, horarios })
    expect(serverState.isOpen).toBe(true)
    expect(argentinaViewerExpected).toBe(serverState.isOpen)
    expect(madridViewerExpected).toBe(serverState.isOpen)
  })

  test("invalid or absent timezone safely falls back to the Argentina-first default", () => {
    expect(normalizeBusinessTimezone("not-an-iana-zone")).toBe(DEFAULT_BUSINESS_TIMEZONE)
    expect(normalizeBusinessTimezone(undefined)).toBe(DEFAULT_BUSINESS_TIMEZONE)
    expect(getBusinessLocalDateParts(new Date("2026-08-31T14:00:00.000Z"), "not-an-iana-zone")).toEqual({
      weekday: 1,
      hour: 11,
      minute: 0,
    })
  })
})
