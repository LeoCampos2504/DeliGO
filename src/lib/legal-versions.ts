// ============================================
// LEGAL-TERMS-ACCEPTANCE-VERSIONING-R1 — version source of truth
// ============================================
// Server-authoritative identifiers for the Terms/Privacy documents a user
// accepted. Never derived from client input, never parsed from the legal
// copy's rendered text at runtime — a plain constant is the only source of
// truth, matching the "Última actualización: Septiembre 2026" currently
// shown for both TermsContent() and PrivacyContent() in
// src/components/shared/legal-content.tsx.
//
// Terms and Privacy happen to share the same update month today, so both
// constants currently have the same value — this is a coincidence of when
// they were last revised together, not a structural requirement. They are
// independent identifiers and may diverge whenever either document changes
// on its own schedule; update ONLY the constant(s) for the document(s) that
// actually changed, and bump src/components/shared/legal-content.tsx's own
// "Última actualización" line for that document at the same time.
export const CURRENT_TERMS_VERSION = "2026-09"
export const CURRENT_PRIVACY_VERSION = "2026-09"
