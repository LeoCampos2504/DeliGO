-- Seguridad-5B: persistent uniqueness guard against duplicate active blocks in
-- "clientes_bloqueados" (Prisma model ClienteBloqueado).
--
-- This table has no soft-delete / active flag / "desbloqueadoAt" column at all.
-- Every current code path that unblocks a cliente (src/app/api/superadmin/
-- clientes/[id]/desbloquear/route.ts, and the auto-unblock branches in
-- src/app/api/denuncias/route.ts and src/app/api/superadmin/denuncias/[id]/
-- route.ts) hard-deletes the matching rows via deleteMany — it never marks them
-- inactive. That means every row that exists in this table right now already
-- IS an "active" block by construction; there is no historical/desbloqueado
-- state retained to preserve, so no WHERE-active-flag condition is needed for
-- that reason.
--
-- The application already enforces two independent pre-checks before creating
-- a row (findFirst by {ip, clienteId} and, separately, by {fingerprint,
-- clienteId} — see the same two files above), but only at the application
-- layer, inside a Serializable transaction with no persistent backstop. This
-- migration adds that backstop as two partial unique indexes, mirroring
-- exactly those two existing checks — not a single combined (ip, fingerprint,
-- clienteId) index, since the app treats an IP-based block and a
-- fingerprint-based block as two independently-guarded facts about the same
-- cliente.
--
-- "clienteId" is nullable ("may be null if just IP block" per the Prisma
-- schema comment), so both indexes are partial (WHERE "clienteId" IS NOT
-- NULL) — this leaves any hypothetical clienteId-less IP-only block rows
-- completely unconstrained (Postgres already treats NULL as distinct from
-- NULL in a plain unique index, but the explicit partial WHERE makes the
-- intent unambiguous, following the same precedent already used for
-- "denuncias" in Seguridad-3B). No existing row is read, altered, or deleted
-- by this migration, and no column or table other than these two new indexes
-- is touched.
CREATE UNIQUE INDEX "clientes_bloqueados_ip_cliente_key"
ON "clientes_bloqueados" ("ip", "clienteId")
WHERE "clienteId" IS NOT NULL;

CREATE UNIQUE INDEX "clientes_bloqueados_fingerprint_cliente_key"
ON "clientes_bloqueados" ("fingerprint", "clienteId")
WHERE "clienteId" IS NOT NULL;
