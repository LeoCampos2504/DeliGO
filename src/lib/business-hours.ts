export const DEFAULT_BUSINESS_TIMEZONE = "America/Argentina/Buenos_Aires"

export interface BusinessHoursDay {
  abierto?: boolean
  apertura?: string
  cierre?: string
  turno2?: boolean
  apertura2?: string
  cierre2?: string
}

export type BusinessHoursData = Record<string, BusinessHoursDay>

export interface BusinessHoursInput {
  instant: Date
  timezone?: unknown
  horarios: string | BusinessHoursData | Record<string, unknown>
  horarioMode?: string
  abiertoManual?: boolean
}

export interface BusinessLocalDateParts {
  weekday: number
  hour: number
  minute: number
}

export interface BusinessHoursState {
  isOpen: boolean
  evaluatedAt: string
  timezone: string
  todayKey: string
}

const WEEKDAY_TO_ISO: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
}

function isValidIanaTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format()
    return true
  } catch {
    return false
  }
}

/** Normalizes the persisted value without allowing an arbitrary string to become authority. */
export function normalizeBusinessTimezone(timezone: unknown): string {
  if (typeof timezone !== "string") return DEFAULT_BUSINESS_TIMEZONE
  const normalized = timezone.trim()
  return normalized && isValidIanaTimezone(normalized)
    ? normalized
    : DEFAULT_BUSINESS_TIMEZONE
}

export function getBusinessLocalDateParts(instant: Date, timezone: unknown): BusinessLocalDateParts {
  const normalizedTimezone = normalizeBusinessTimezone(timezone)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizedTimezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant)

  const values: Record<string, string> = {}
  for (const part of parts) values[part.type] = part.value

  const weekday = WEEKDAY_TO_ISO[values.weekday]
  const hour = Number(values.hour)
  const minute = Number(values.minute)
  if (!weekday || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error("No se pudo convertir el instante a la zona del negocio")
  }

  return { weekday, hour, minute }
}

function parseHorarios(horarios: string | BusinessHoursData | Record<string, unknown>): BusinessHoursData {
  if (typeof horarios === "string") {
    try {
      return JSON.parse(horarios) as BusinessHoursData
    } catch {
      return {}
    }
  }
  return horarios as BusinessHoursData
}

function timeToMinutes(value: unknown): number | null {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  const [hour, minute] = value.split(":").map(Number)
  return hour * 60 + minute
}

function isCurrentRangeOpen(currentMinutes: number, apertura: unknown, cierre: unknown): boolean {
  const aperturaMinutes = timeToMinutes(apertura)
  const cierreMinutes = timeToMinutes(cierre)
  if (aperturaMinutes === null || cierreMinutes === null) return false

  if (cierreMinutes < aperturaMinutes) return currentMinutes >= aperturaMinutes
  return currentMinutes >= aperturaMinutes && currentMinutes <= cierreMinutes
}

function isPreviousOvernightRangeOpen(currentMinutes: number, apertura: unknown, cierre: unknown): boolean {
  const aperturaMinutes = timeToMinutes(apertura)
  const cierreMinutes = timeToMinutes(cierre)
  return aperturaMinutes !== null && cierreMinutes !== null && cierreMinutes < aperturaMinutes && currentMinutes <= cierreMinutes
}

function isScheduleDayOpen(day: BusinessHoursDay | undefined, currentMinutes: number): boolean {
  if (!day || day.abierto === false) return false
  return isCurrentRangeOpen(currentMinutes, day.apertura, day.cierre) ||
    Boolean(day.turno2 && isCurrentRangeOpen(currentMinutes, day.apertura2, day.cierre2))
}

function isPreviousDayOvernightOpen(day: BusinessHoursDay | undefined, currentMinutes: number): boolean {
  if (!day || day.abierto === false) return false
  return isPreviousOvernightRangeOpen(currentMinutes, day.apertura, day.cierre) ||
    Boolean(day.turno2 && isPreviousOvernightRangeOpen(currentMinutes, day.apertura2, day.cierre2))
}

/** Evaluates HH:MM as local wall-clock time in the supplied business timezone. */
export function isBusinessOpenAt(input: BusinessHoursInput): boolean {
  if (input.horarioMode === "simple") return input.abiertoManual ?? true

  try {
    const local = getBusinessLocalDateParts(input.instant, input.timezone)
    const horarios = parseHorarios(input.horarios)
    const currentMinutes = local.hour * 60 + local.minute
    if (isScheduleDayOpen(horarios[String(local.weekday)], currentMinutes)) return true

    const yesterday = local.weekday === 1 ? 7 : local.weekday - 1
    return isPreviousDayOvernightOpen(horarios[String(yesterday)], currentMinutes)
  } catch {
    return false
  }
}

/** Canonical payload shared by public displays and order gates. */
export function getBusinessHoursState(input: Omit<BusinessHoursInput, "instant"> & { instant?: Date }): BusinessHoursState {
  const instant = input.instant ?? new Date()
  const timezone = normalizeBusinessTimezone(input.timezone)
  const local = getBusinessLocalDateParts(instant, timezone)
  return {
    isOpen: isBusinessOpenAt({ ...input, instant, timezone }),
    evaluatedAt: instant.toISOString(),
    timezone,
    todayKey: String(local.weekday),
  }
}

/** Compatibility wrapper with an explicit Argentina-first default. */
export function isNegocioOpen(
  horarios: string | BusinessHoursData | Record<string, unknown>,
  horarioMode?: string,
  abiertoManual?: boolean,
  timezone: unknown = DEFAULT_BUSINESS_TIMEZONE,
  instant: Date = new Date()
): boolean {
  return isBusinessOpenAt({ instant, timezone, horarios, horarioMode, abiertoManual })
}
