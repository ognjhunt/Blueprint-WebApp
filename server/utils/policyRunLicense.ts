import { crossRuntimeDigest } from "./crossRuntimeCanonical";

/** A policy token permits authentication; this grant permits the requested use. */
export function buildPolicyRunLicense(input: {
  ownerUid: string; requestId: string; opportunityId: string; setupId: string;
  setup: Record<string, unknown>; grantedAtIso?: string;
}) {
  return {
    schemaVersion: "blueprint.policy_run_license.v1",
    grantedByUid: input.ownerUid,
    requestId: input.requestId,
    opportunityId: input.opportunityId,
    setupId: input.setupId,
    setupDigest: crossRuntimeDigest({ ...input.setup, id: input.setupId }),
    grantedAtIso: input.grantedAtIso ?? new Date().toISOString(),
  };
}

export function hasCurrentPolicyRunLicense(input: Parameters<typeof buildPolicyRunLicense>[0], value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const grant = value as Record<string, unknown>;
  const at = typeof grant.grantedAtIso === "string" ? Date.parse(grant.grantedAtIso) : NaN;
  if (!Number.isFinite(at) || at > Date.now() || grant.revokedAtIso != null) return false;
  const expected = buildPolicyRunLicense({ ...input, grantedAtIso: String(grant.grantedAtIso) });
  return Object.entries(expected).every(([key, expectedValue]) => grant[key] === expectedValue);
}
