-- P2-T44-R1D: operational personal Push is owned by the account, not an area.
-- Additive enum value; existing employee rows and bindings remain compatible.
ALTER TYPE "PushSubscriptionOwnerType" ADD VALUE IF NOT EXISTS 'cuenta_operativa';
