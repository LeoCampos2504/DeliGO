-- P2-T39-R3: modern Web Push owner for SuperAdmin. Additive enum value; the
-- legacy SuperAdmin.pushSubscription field remains untouched and unused by
-- the normalized owner path (P2-T17, dead/inert for the isolated SuperAdmin
-- session).
ALTER TYPE "PushSubscriptionOwnerType" ADD VALUE IF NOT EXISTS 'superadmin';
