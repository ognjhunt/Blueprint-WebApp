/** Capture names are a shape check only. Supplements additionally require their retained lineage. */
export function isWebsiteCaptureId(requestId: string, sceneId: string, captureId: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(requestId)
    && sceneId === `site-${requestId}`
    && (captureId === `walkthrough-${requestId}` || /^supplement-[a-f0-9]{40}$/.test(captureId));
}
