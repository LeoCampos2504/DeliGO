/// <reference types="bun-types" />

import { readdirSync, readFileSync } from "fs"
import { join } from "path"
import { expect, test } from "bun:test"
import { NextRequest } from "next/server"
import { v2 as cloudinary } from "cloudinary"
import { db } from "@/lib/db"
import { RATE_LIMITS, checkRateLimit } from "./rate-limit"
import { POST as uploadEvidence } from "@/app/api/negocio/solicitudes-revision-resenas/[id]/eventos/[eventoId]/evidencias/route"
import { GET as downloadBusinessEvidence } from "@/app/api/negocio/solicitudes-revision-resenas/[id]/evidencias/[evidenciaId]/route"
import { GET as downloadSuperadminEvidence } from "@/app/api/superadmin/solicitudes-revision-resenas/[id]/evidencias/[evidenciaId]/route"

const root = process.cwd()
const uploadRoute = readFileSync(join(root, "src/app/api/negocio/solicitudes-revision-resenas/[id]/eventos/[eventoId]/evidencias/route.ts"), "utf8")
const businessDownload = readFileSync(join(root, "src/app/api/negocio/solicitudes-revision-resenas/[id]/evidencias/[evidenciaId]/route.ts"), "utf8")
const superadminDownload = readFileSync(join(root, "src/app/api/superadmin/solicitudes-revision-resenas/[id]/evidencias/[evidenciaId]/route.ts"), "utf8")
const businessProjection = readFileSync(join(root, "src/lib/review-moderation-business.ts"), "utf8")
const superadminProjection = readFileSync(join(root, "src/lib/review-moderation-superadmin.ts"), "utf8")
const publicReviewRoute = readFileSync(join(root, "src/app/api/negocios/[slug]/route.ts"), "utf8")

test("upload route is session-owned, multipart-only, rate-limited and maps sanitized HTTP errors", () => {
  expect(uploadRoute).toContain('req.cookies.get(SESSION_COOKIE_NAME)')
  expect(uploadRoute).toContain('user.type !== "negocio"')
  expect(uploadRoute).toContain('checkRateLimit("reviewModerationEvidenceUpload", user.id)')
  expect(uploadRoute).toContain("const form = await req.formData()")
  expect(uploadRoute).toContain('Array.from(form.keys()).length !== 1 || !form.has("archivo")')
  expect(uploadRoute).toContain('const archivo = form.get("archivo")')
  expect(uploadRoute).toContain('status: 400')
  expect(uploadRoute).toContain('status: 413')
  expect(uploadRoute).toContain('? 413 : 415')
  expect(uploadRoute).toContain('status: 503')
  expect(uploadRoute).toContain('status: 409')
  expect(uploadRoute).not.toContain("negocioId: req")
  expect(uploadRoute).not.toContain("storageKey")
  expect(uploadRoute).not.toContain("secure_url")
})

test("real upload and download routes reject missing sessions before accessing evidence", async () => {
  const upload = await uploadEvidence(new NextRequest("http://localhost/api/negocio/solicitudes-revision-resenas/request/eventos/event/evidencias", { method: "POST" }), { params: Promise.resolve({ id: "request", eventoId: "event" }) })
  const business = await downloadBusinessEvidence(new NextRequest("http://localhost/api/negocio/solicitudes-revision-resenas/request/evidencias/evidence"), { params: Promise.resolve({ id: "request", evidenciaId: "evidence" }) })
  const superadmin = await downloadSuperadminEvidence(new NextRequest("http://localhost/api/superadmin/solicitudes-revision-resenas/request/evidencias/evidence"), { params: Promise.resolve({ id: "request", evidenciaId: "evidence" }) })
  expect(upload.status).toBe(401)
  expect(business.status).toBe(401)
  expect(superadmin.status).toBe(401)
  expect(await upload.json()).toEqual({ error: "No autenticado" })
})

test("real download routes return private bytes and headers, including terminal history and IDOR", async () => {
  const mutableDb = db as unknown as {
    sesion: { findUnique: (...args: unknown[]) => Promise<unknown> }
    negocio: { findUnique: (...args: unknown[]) => Promise<unknown> }
    superAdmin: { findUnique: (...args: unknown[]) => Promise<unknown> }
    evidenciaSolicitudRevisionResena: { findFirst: (...args: unknown[]) => Promise<unknown> }
  }
  const cloud = cloudinary as unknown as { utils: { private_download_url: (...args: unknown[]) => string } }
  const originals = {
    session: mutableDb.sesion.findUnique,
    business: mutableDb.negocio.findUnique,
    superadmin: mutableDb.superAdmin.findUnique,
    evidence: mutableDb.evidenciaSolicitudRevisionResena.findFirst,
    privateDownload: cloud.utils.private_download_url,
    fetch: globalThis.fetch,
    env: [process.env.PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME, process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_KEY, process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET],
  }
  const bytes = new Uint8Array([7, 8, 9])
  try {
    process.env.PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME = "test-private"
    process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_KEY = "test-key"
    process.env.PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET = "test-secret"
    mutableDb.sesion.findUnique = async () => ({ userId: "business", userType: "negocio", expiresAt: new Date(Date.now() + 60_000) })
    mutableDb.negocio.findUnique = async () => ({ id: "business", nombre: "Business", slug: "business", rubro: "food", aprobado: true, suspendido: false, usuario: "business" })
    mutableDb.evidenciaSolicitudRevisionResena.findFirst = async () => ({ storageKey: "private-key", mimeType: "image/png", nombrePresentacion: "terminal/evidence.png" })
    cloud.utils.private_download_url = () => "https://private.invalid/evidence"
    globalThis.fetch = (async () => new Response(bytes, { status: 200 })) as unknown as typeof fetch
    const business = await downloadBusinessEvidence(new NextRequest("http://localhost/api/negocio/solicitudes-revision-resenas/request/evidencias/evidence", { headers: { cookie: "deligo_session=token" } }), { params: Promise.resolve({ id: "request", evidenciaId: "evidence" }) })
    expect(business.status).toBe(200)
    expect(Array.from(new Uint8Array(await business.arrayBuffer()))).toEqual([7, 8, 9])
    expect(Object.fromEntries(business.headers)).toMatchObject({ "cache-control": "private, no-store", "content-type": "image/png", "x-content-type-options": "nosniff" })
    expect(business.headers.get("content-disposition")).toBe('attachment; filename="terminal_evidence.png"')

    mutableDb.evidenciaSolicitudRevisionResena.findFirst = async () => null
    const forbidden = await downloadBusinessEvidence(new NextRequest("http://localhost/api/negocio/solicitudes-revision-resenas/foreign/evidencias/evidence", { headers: { cookie: "deligo_session=token" } }), { params: Promise.resolve({ id: "foreign", evidenciaId: "evidence" }) })
    expect(forbidden.status).toBe(404)

    mutableDb.evidenciaSolicitudRevisionResena.findFirst = async () => ({ storageKey: "private-key", mimeType: "image/png", nombrePresentacion: "terminal/evidence.png" })
    globalThis.fetch = (async () => { throw new Error("storage get failed") }) as unknown as typeof fetch
    const failedGet = await downloadBusinessEvidence(new NextRequest("http://localhost/api/negocio/solicitudes-revision-resenas/request/evidencias/evidence", { headers: { cookie: "deligo_session=token" } }), { params: Promise.resolve({ id: "request", evidenciaId: "evidence" }) })
    expect(failedGet.status).toBe(500)
    expect(await failedGet.json()).toEqual({ error: "Error interno del servidor" })

    mutableDb.sesion.findUnique = async () => ({ userId: "admin", userType: "superadmin", expiresAt: new Date(Date.now() + 60_000) })
    mutableDb.superAdmin.findUnique = async () => ({ id: "admin", email: "admin@example.invalid", activo: true, googleSub: "subject" })
    mutableDb.evidenciaSolicitudRevisionResena.findFirst = async () => ({ storageKey: "private-key", mimeType: "image/png", nombrePresentacion: "terminal/evidence.png" })
    globalThis.fetch = (async () => new Response(bytes, { status: 200 })) as unknown as typeof fetch
    const superadmin = await downloadSuperadminEvidence(new NextRequest("http://localhost/api/superadmin/solicitudes-revision-resenas/request/evidencias/evidence", { headers: { cookie: "deligo_superadmin_session=token" } }), { params: Promise.resolve({ id: "request", evidenciaId: "evidence" }) })
    expect(superadmin.status).toBe(200)
    expect(Array.from(new Uint8Array(await superadmin.arrayBuffer()))).toEqual([7, 8, 9])
    expect(superadmin.headers.get("cache-control")).toBe("private, no-store")
    expect(superadmin.headers.get("content-disposition")).toBe('attachment; filename="terminal_evidence.png"')
  } finally {
    mutableDb.sesion.findUnique = originals.session
    mutableDb.negocio.findUnique = originals.business
    mutableDb.superAdmin.findUnique = originals.superadmin
    mutableDb.evidenciaSolicitudRevisionResena.findFirst = originals.evidence
    cloud.utils.private_download_url = originals.privateDownload
    globalThis.fetch = originals.fetch
    const names = ["PRIVATE_EVIDENCE_CLOUDINARY_CLOUD_NAME", "PRIVATE_EVIDENCE_CLOUDINARY_API_KEY", "PRIVATE_EVIDENCE_CLOUDINARY_API_SECRET"] as const
    names.forEach((name, index) => { if (originals.env[index]) process.env[name] = originals.env[index]; else delete process.env[name] })
  }
})

test("download routes keep their own auth boundary and no redirect/provider URL", () => {
  expect(businessDownload).toContain('getBusinessReviewModerationEvidence({ negocioId: user.id')
  expect(businessDownload).toContain('error("No autenticado", 401)')
  expect(businessDownload).toContain('error("Evidencia no encontrada", 404)')
  expect(superadminDownload).toContain("requireSuperadminSession(req)")
  expect(superadminDownload).toContain('error("No autenticado", 401)')
  for (const source of [businessDownload, superadminDownload]) {
    expect(source).toContain("reviewModerationEvidenceDownloadHeaders")
    expect(source).toContain("getPrivateEvidenceStorage().get")
    expect(source).not.toContain("redirect(")
    expect(source).not.toContain("secure_url")
    expect(source).not.toContain("signedUrl")
  }
})

test("projections and public API omit private evidence fields, and upload emits no notification", () => {
  for (const source of [businessProjection, superadminProjection]) {
    expect(source).toContain("nombrePresentacion: true, mimeType: true, bytes: true, createdAt: true")
    expect(source).not.toContain("storageKey: true")
    expect(source).not.toContain("sha256: true")
    expect(source).not.toContain("uploaderId: true")
  }
  expect(publicReviewRoute).not.toContain("evidencias")
  expect(publicReviewRoute).not.toContain("storageKey")
  expect(uploadRoute).not.toContain("notifyReviewModeration")
})

test("the evidence upload rate limit is business-bound and isolated", () => {
  expect(RATE_LIMITS.reviewModerationEvidenceUpload).toEqual({ maxRequests: 20, windowMs: 60 * 60 * 1000 })
  const one = `test-t19f2a-rate-one-${Date.now()}`
  const two = `test-t19f2a-rate-two-${Date.now()}`
  for (let index = 0; index < RATE_LIMITS.reviewModerationEvidenceUpload.maxRequests; index += 1) expect(checkRateLimit("reviewModerationEvidenceUpload", one).allowed).toBe(true)
  expect(checkRateLimit("reviewModerationEvidenceUpload", one).allowed).toBe(false)
  expect(checkRateLimit("reviewModerationEvidenceUpload", two).allowed).toBe(true)
})

test("no evidence delete endpoint was introduced", () => {
  const folders = [
    join(root, "src/app/api/negocio/solicitudes-revision-resenas"),
    join(root, "src/app/api/superadmin/solicitudes-revision-resenas"),
  ]
  for (const folder of folders) {
    const files = readdirSync(folder, { recursive: true }).filter((entry) => String(entry).endsWith("route.ts"))
    for (const file of files) expect(readFileSync(join(folder, String(file)), "utf8")).not.toContain("export async function DELETE")
  }
})
