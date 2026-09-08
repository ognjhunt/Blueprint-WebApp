/** Only pass the principal established by Firebase token verification, never request data. */
export function taskEvaluationFirebaseTenant(principal: unknown): string {
  if (!principal || typeof principal !== "object") return "";
  const value = principal as { tenantId?: unknown; tenant_id?: unknown; firebase?: { tenant?: unknown } };
  const supplied = [value.firebase?.tenant, value.tenantId, value.tenant_id].filter((entry) => entry !== undefined && entry !== null && entry !== "");
  if (supplied.some((entry) => typeof entry !== "string" || !entry.trim())) return "";
  const identities = new Set((supplied as string[]).map((entry) => entry.trim()));
  return identities.size === 1 ? [...identities][0] : "";
}
