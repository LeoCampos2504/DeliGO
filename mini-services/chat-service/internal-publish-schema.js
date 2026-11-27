const ORDER_ID_PATTERN = /^[^:]{1,128}$/
const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const USER_TYPES = new Set(["cliente", "negocio", "repartidor"])
const MESSAGE_SENDERS = new Set(["cliente", "vendedor", "repartidor"])
const EVENT_TYPES = new Set([
  "chat.message.created",
  "chat.messages.read",
  "tracking.location.updated",
])

const ENVELOPE_FIELDS = new Set([
  "version",
  "type",
  "eventId",
  "resourceId",
  "occurredAt",
  "payload",
  "traceId",
])

const MESSAGE_FIELDS = new Set([
  "id",
  "pedidoId",
  "remitente",
  "texto",
  "imagenUrl",
  "archivoUrl",
  "archivoNombre",
  "archivoTipo",
  "leido",
  "fecha",
  "clienteId",
])

const READ_FIELDS = new Set(["pedidoId", "readBy", "userType"])
const TRACKING_FIELDS = new Set(["pedidoId", "lat", "lng", "timestamp", "version"])

function schemaError(code) {
  const error = new Error(code)
  error.code = code
  return error
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function assertOnlyFields(value, fields) {
  for (const key of Object.keys(value)) {
    if (!fields.has(key)) throw schemaError("SCHEMA_UNKNOWN_FIELD")
  }
}

function assertIdentifier(value, code = "SCHEMA_INVALID_IDENTIFIER") {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) throw schemaError(code)
  return value
}

function assertOrderId(value) {
  if (typeof value !== "string" || !ORDER_ID_PATTERN.test(value)) {
    throw schemaError("SCHEMA_INVALID_RESOURCE")
  }
  return value
}

function assertString(value, maxLength, code = "SCHEMA_INVALID_STRING") {
  if (typeof value !== "string" || value.length > maxLength) throw schemaError(code)
  return value
}

function assertNullableString(value, maxLength, code = "SCHEMA_INVALID_STRING") {
  if (value !== null && value !== undefined) assertString(value, maxLength, code)
  return value ?? null
}

function assertIsoDate(value, code = "SCHEMA_INVALID_DATE") {
  if (typeof value !== "string" || value.length > 80 || Number.isNaN(Date.parse(value))) {
    throw schemaError(code)
  }
  return value
}

function validateMessagePayload(payload, resourceId) {
  if (!isPlainObject(payload)) throw schemaError("SCHEMA_INVALID_PAYLOAD")
  assertOnlyFields(payload, MESSAGE_FIELDS)
  if (assertIdentifier(payload.id) === "") throw schemaError("SCHEMA_INVALID_PAYLOAD")
  if (assertOrderId(payload.pedidoId) !== resourceId) throw schemaError("SCHEMA_RESOURCE_MISMATCH")
  if (!MESSAGE_SENDERS.has(payload.remitente)) throw schemaError("SCHEMA_INVALID_PAYLOAD")
  assertString(payload.texto, 10000)
  assertNullableString(payload.imagenUrl, 2048)
  assertNullableString(payload.archivoUrl, 2048)
  assertNullableString(payload.archivoNombre, 120)
  assertNullableString(payload.archivoTipo, 120)
  if (typeof payload.leido !== "boolean") throw schemaError("SCHEMA_INVALID_PAYLOAD")
  assertIsoDate(payload.fecha)
  assertNullableString(payload.clienteId, 128)
  return payload
}

function validateReadPayload(payload, resourceId) {
  if (!isPlainObject(payload)) throw schemaError("SCHEMA_INVALID_PAYLOAD")
  assertOnlyFields(payload, READ_FIELDS)
  if (assertOrderId(payload.pedidoId) !== resourceId) throw schemaError("SCHEMA_RESOURCE_MISMATCH")
  assertIdentifier(payload.readBy)
  if (!USER_TYPES.has(payload.userType)) throw schemaError("SCHEMA_INVALID_PAYLOAD")
  return payload
}

function validateTrackingPayload(payload, resourceId) {
  if (!isPlainObject(payload)) throw schemaError("SCHEMA_INVALID_PAYLOAD")
  assertOnlyFields(payload, TRACKING_FIELDS)
  if (assertOrderId(payload.pedidoId) !== resourceId) throw schemaError("SCHEMA_RESOURCE_MISMATCH")
  if (!Number.isFinite(payload.lat) || payload.lat < -90 || payload.lat > 90) {
    throw schemaError("SCHEMA_INVALID_PAYLOAD")
  }
  if (!Number.isFinite(payload.lng) || payload.lng < -180 || payload.lng > 180) {
    throw schemaError("SCHEMA_INVALID_PAYLOAD")
  }
  assertIsoDate(payload.timestamp)
  if (payload.version !== undefined) {
    if (
      (typeof payload.version !== "number" && typeof payload.version !== "string") ||
      (typeof payload.version === "number" && !Number.isSafeInteger(payload.version)) ||
      (typeof payload.version === "string" && payload.version.length > 128)
    ) {
      throw schemaError("SCHEMA_INVALID_PAYLOAD")
    }
  }
  return payload
}

function parseAndValidateEnvelope(rawBody) {
  let parsed
  try {
    parsed = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody))
  } catch {
    throw schemaError("SCHEMA_INVALID_JSON")
  }

  if (!isPlainObject(parsed)) throw schemaError("SCHEMA_INVALID_ENVELOPE")
  assertOnlyFields(parsed, ENVELOPE_FIELDS)
  if (parsed.version !== 1) throw schemaError("SCHEMA_INVALID_VERSION")
  if (!EVENT_TYPES.has(parsed.type)) throw schemaError("SCHEMA_UNKNOWN_TYPE")
  assertIdentifier(parsed.eventId, "SCHEMA_INVALID_EVENT_ID")
  const resourceId = assertOrderId(parsed.resourceId)
  assertIsoDate(parsed.occurredAt)
  if (parsed.traceId !== undefined) assertIdentifier(parsed.traceId, "SCHEMA_INVALID_TRACE_ID")

  if (parsed.type === "chat.message.created") {
    validateMessagePayload(parsed.payload, resourceId)
  } else if (parsed.type === "chat.messages.read") {
    validateReadPayload(parsed.payload, resourceId)
  } else {
    validateTrackingPayload(parsed.payload, resourceId)
  }

  return parsed
}

module.exports = {
  EVENT_TYPES,
  ORDER_ID_PATTERN,
  parseAndValidateEnvelope,
  schemaError,
}
