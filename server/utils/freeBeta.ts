/** Release scope, deliberately not an environment opt-in to customer charging. */
export const FREE_BETA_ONLY = true;
export const MAX_FREE_SPONSOR_CAP_USD = 20;
export const FREE_BETA_PAID_DISABLED = "paid_evaluations_disabled";
export const FREE_BETA_PAID_MESSAGE = "This beta offers free invited evaluations only. Private evaluations and balance top-ups are unavailable.";

/** Historical/unknown purposes never acquire permission to start new work. */
export function canDispatchFreeBetaRun(run: {
  evaluationPurpose?: string; quotedUsd?: number;
  executionAdmission?: { digestSha256?: string; envelope?: Record<string, unknown> };
}): boolean {
  if (!isBlueprintFundedRun(run)) return false;
  const funding = run.executionAdmission!.envelope!.funding as Record<string, unknown>;
  return Date.parse(String(funding.expires_at_iso)) > Date.now();
}

/** Settlement may arrive after expiry; it still must never charge the customer. */
export function isBlueprintFundedRun(run: {
  evaluationPurpose?: string; quotedUsd?: number;
  executionAdmission?: { digestSha256?: string; envelope?: Record<string, unknown> };
}): boolean {
  const funding = run.executionAdmission?.envelope?.funding as Record<string, unknown> | undefined;
  return run.evaluationPurpose === "pilot" && run.quotedUsd === 0
    && Boolean(run.executionAdmission?.digestSha256) && funding?.payer === "blueprint"
    && funding.customer_price_usd === 0 && funding.max_attempts === 1
    && typeof funding.cap_usd === "number" && Number.isFinite(funding.cap_usd)
    && funding.cap_usd > 0 && funding.cap_usd <= MAX_FREE_SPONSOR_CAP_USD
    && typeof funding.approved_by === "string" && funding.approved_by.length > 0
    && /^sha256:[a-f0-9]{64}$/.test(String(funding.approval_digest))
    && Number.isFinite(Date.parse(String(funding.expires_at_iso)));
}
