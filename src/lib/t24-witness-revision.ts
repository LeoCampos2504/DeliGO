export type T24RevisionGapClassification =
  | "SERVER_REVISION_NOT_RECEIVED_REALTIME"
  | "SERVER_REVISION_RECEIVED_HTTP_ONLY"
  | "SERVER_REVISION_NOT_OBSERVED_BY_CLIENT"

/**
 * Pure witness-only classification. The server's published revision set is
 * the authority; HTTP/realtime observations are merely client evidence.
 */
export function classifyT24RevisionGap(
  serverPublished: boolean,
  receivedRealtime: boolean,
  receivedHttp: boolean,
): T24RevisionGapClassification | null {
  if (!serverPublished) return null
  if (receivedRealtime) return "SERVER_REVISION_NOT_RECEIVED_REALTIME"
  if (receivedHttp) return "SERVER_REVISION_RECEIVED_HTTP_ONLY"
  return "SERVER_REVISION_NOT_OBSERVED_BY_CLIENT"
}
