/**
 * The stored finding, as the readiness model wants it.
 *
 * `assessReadiness` takes an `EvidenceOnFile`, and until now every caller built
 * one from adjacent facts. This is the reader that makes those two call sites
 * report what was measured instead of what was assumed.
 *
 * Absent is not `coversScene: false`. A submission nobody has reviewed for
 * coverage is one we do not know about, and the caller decides what to do with
 * that -- which for the supply query means falling back to "a scene exists,
 * therefore coverage sufficed", and for the operator means saying nothing yet
 * rather than naming views we never looked for.
 */
export function coverageEvidenceFrom(request: {
  capture_coverage?: {
    covers_scene?: boolean | null;
    missing_coverage?: string[] | null;
    supplement_would_finish?: boolean | null;
  } | null;
}): { coversScene: boolean; missingCoverage: string[] } | null {
  const stored = request.capture_coverage;
  if (!stored || typeof stored.covers_scene !== "boolean") return null;
  return {
    coversScene: stored.covers_scene,
    missingCoverage: Array.isArray(stored.missing_coverage) ? stored.missing_coverage : [],
  };
}
