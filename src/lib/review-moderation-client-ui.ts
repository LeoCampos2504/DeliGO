// DeliGO — 19-H1: copy neutral para el Cliente autor sobre su propia reseña.
// Puro (sin JSX) para poder testearlo sin React Testing Library. Nunca debe
// mencionar al Negocio como solicitante, al Superadmin, un motivo/explicación
// interna, ni insinuar culpabilidad.

import type { ClientReviewVisibility } from "@/lib/review-moderation-policy"

export function getClientReviewVisibilityCopy(visibility: ClientReviewVisibility): string {
  if (visibility === "en_revision") return "Tu reseña está temporalmente en revisión."
  if (visibility === "no_publicada") return "Tu reseña ya no está publicada."
  return "Tu reseña"
}
