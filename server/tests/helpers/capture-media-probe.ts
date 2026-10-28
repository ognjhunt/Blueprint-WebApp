/** Signature-only route fixtures do not claim to be playable video. */
export function fixtureCaptureMediaMetadata() {
  return { widthPx: 1920, heightPx: 1080, fps: 30, durationSeconds: 61,
    recordedAtEpochMs: 1_758_000_000_000 };
}
