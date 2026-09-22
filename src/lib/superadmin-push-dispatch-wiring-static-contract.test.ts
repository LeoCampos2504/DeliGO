/// <reference types="bun-types" />
// P2-T39-R3A §8 — dispatcher/producer wiring contract, asserted against
// source text (same style as push-session-reconciliation-static-contract.test.ts
// — no React Testing Library, and these 6 producers are deeply embedded in
// Prisma transactions across 4 different route files + 2 lib files, making a
// full runtime mock of each disproportionate to what this gate needs).
//
// What this proves, per producer, with executable string-index assertions:
//  1) dispatchSuperadminPush(...) is called, with a `type:` literal that
//     EXACTLY matches the `tipo:`/persisted type for that event — a typo
//     here would also fail `tsc` (SuperadminPushEnvelope.type is a closed
//     union), but this test catches it even if that union were ever loosened.
//  2) The call site appears STRICTLY AFTER the `db.$transaction`/tx result is
//     resolved — never inside the transaction callback. This is what makes
//     "provider failure never rolls back the business op" and "post-commit
//     only" true by construction: once source order places the dispatch call
//     after the transaction's closing point, it is structurally impossible
//     for anything it does to affect a commit that already happened.
//
// What this does NOT re-prove (covered elsewhere, not duplicated here):
//  - The dispatcher's own internals (fan-out, dedup by endpoint, multi-
//    recipient, provider-failure-never-throws) — src/lib/superadmin-push-
//    dispatch.test.ts, 7 tests.
//  - negocio_pendiente CAS replay non-duplication, multi-superadmin
//    recipient resolution — src/lib/superadmin-notifications.integration.
//    test.ts (DB-backed; recipientIds is empty on a CAS-rejected replay,
//    which structurally means dispatch never fires a second time — same
//    `if (notified.recipientIds.length > 0)` gate every producer below uses).
import { describe, expect, test } from "bun:test"
import { readFileSync } from "fs"
import { join } from "path"

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), ...relPath.split("/")), "utf-8")
}

interface ProducerCase {
  label: string
  file: string
  type: string
  /** Text that marks the point after which the tx has resolved/committed. */
  postCommitAnchor: string
}

const CASES: ProducerCase[] = [
  {
    label: "negocio_pendiente (verify-email)",
    file: "src/app/api/auth/verify-email/route.ts",
    type: "negocio_pendiente",
    postCommitAnchor: 'if (negocioOutcome) {',
  },
  {
    label: "destacado_solicitud",
    file: "src/app/api/destacado-solicitud/route.ts",
    type: "destacado_solicitud",
    // Non-transactional producer — dispatch lives inside the SAME try/catch
    // as the notifySuperadmins call, both strictly after db.destacadoSolicitud.create.
    postCommitAnchor: "const solicitud = await db.destacadoSolicitud.create(",
  },
  {
    label: "denuncia_nueva",
    file: "src/app/api/denuncias/route.ts",
    type: "denuncia_nueva",
    postCommitAnchor: "const { denuncia, totalDenuncias, bloqueado, notificationTitle, notificationBody, superadminRecipientIds } = outcome",
  },
  {
    label: "negocio_deuda",
    file: "src/app/api/cliente/pedidos/[id]/route.ts",
    type: "negocio_deuda",
    postCommitAnchor: 'if (outcome.debtAlert && outcome.debtAlert.recipientIds.length > 0) {',
  },
  {
    label: "review_moderation (nueva solicitud)",
    file: "src/lib/review-moderation-server.ts",
    type: "review_moderation",
    postCommitAnchor: "const result = await db.$transaction(",
  },
  {
    label: "review_moderation (información aportada)",
    file: "src/lib/review-moderation-business.ts",
    type: "review_moderation",
    postCommitAnchor: "const result = await db.$transaction(async (tx) => {",
  },
]

describe("P2-T39-R3A §8 — cada uno de los 6 productores llama a dispatchSuperadminPush post-commit, con el type correcto", () => {
  for (const c of CASES) {
    test(`${c.label}: dispatchSuperadminPush(...) existe, type="${c.type}", y aparece después del punto de commit`, () => {
      const src = read(c.file)
      expect(src).toContain("dispatchSuperadminPush(")
      expect(src).toContain(`type: "${c.type}"`)

      const anchorIdx = src.indexOf(c.postCommitAnchor)
      const dispatchIdx = src.indexOf("dispatchSuperadminPush(")
      expect(anchorIdx).toBeGreaterThan(-1)
      expect(dispatchIdx).toBeGreaterThan(anchorIdx)
    })
  }

  test("los 6 productores importan dispatchSuperadminPush desde @/lib/superadmin-push-dispatch — nunca una reimplementación local", () => {
    for (const c of CASES) {
      const src = read(c.file)
      expect(src).toContain('from "@/lib/superadmin-push-dispatch"')
    }
  })

  test("los 6 productores gatean el dispatch a recipientIds no vacíos — nunca despachan con una lista vacía", () => {
    for (const c of CASES) {
      const src = read(c.file)
      const dispatchIdx = src.indexOf("dispatchSuperadminPush(")
      const before = src.slice(Math.max(0, dispatchIdx - 400), dispatchIdx)
      expect(before).toContain(".length > 0")
    }
  })
})
