import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin.js";

export type EmailSuppressionScope =
  | "all"
  | "lifecycle"
  | "growth_campaign";

const SUPPRESSION_COLLECTION = "email_suppressions";
const BLUEPRINT_MAILING_ADDRESS = "Blueprint | 1005 Crete St, Durham, NC 27707";

export function normalizeSuppressionEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeScope(value: unknown): EmailSuppressionScope {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "all" || normalized === "growth_campaign" || normalized === "lifecycle") {
    return normalized;
  }
  return "lifecycle";
}

function publicAppOrigin() {
  return (
    process.env.VITE_PUBLIC_APP_URL?.trim()
    || process.env.APP_URL?.trim()
    || "https://tryblueprint.io"
  ).replace(/\/+$/, "");
}

export function buildUnsubscribeUrl(params: {
  email: string;
  scope?: EmailSuppressionScope | string | null;
  campaignId?: string | null;
  cadenceId?: string | null;
}) {
  const url = new URL("/api/growth/email/unsubscribe", publicAppOrigin());
  url.searchParams.set("email", normalizeSuppressionEmail(params.email));
  url.searchParams.set("scope", normalizeScope(params.scope));
  if (params.campaignId) url.searchParams.set("campaignId", params.campaignId);
  if (params.cadenceId) url.searchParams.set("cadenceId", params.cadenceId);
  return url.toString();
}

export function appendCommercialEmailFooter(params: {
  text: string;
  email: string;
  scope?: EmailSuppressionScope | string | null;
  campaignId?: string | null;
  cadenceId?: string | null;
}) {
  const text = params.text.trimEnd();
  if (/unsubscribe/i.test(text) && /\/privacy/i.test(text)) {
    return text;
  }
  const unsubscribeUrl = buildUnsubscribeUrl(params);
  return [
    text,
    "",
    "--",
    BLUEPRINT_MAILING_ADDRESS,
    `Privacy: ${publicAppOrigin()}/privacy`,
    `Unsubscribe from ${normalizeScope(params.scope).replace("_", " ")} emails: ${unsubscribeUrl}`,
  ].join("\n");
}

export async function recordEmailSuppression(params: {
  email: string;
  scope?: EmailSuppressionScope | EmailSuppressionScope[] | string | string[] | null;
  reason: string;
  source: string;
  campaignId?: string | null;
  cadenceId?: string | null;
}) {
  const email = normalizeSuppressionEmail(params.email);
  if (!email || !db) {
    return { persisted: false, email };
  }

  const incomingScopes = Array.isArray(params.scope)
    ? params.scope.map(normalizeScope)
    : [normalizeScope(params.scope)];
  const ref = db.collection(SUPPRESSION_COLLECTION).doc(email);
  const existing = await ref.get();
  const existingData = existing.exists ? existing.data() || {} : {};
  const existingScopes = Array.isArray(existingData.suppressed_scopes)
    ? existingData.suppressed_scopes.filter((value: unknown): value is string => typeof value === "string")
    : [];
  const suppressedScopes = [...new Set([...existingScopes, ...incomingScopes])];
  const nowIso = new Date().toISOString();

  await ref.set(
    {
      email,
      suppressed_scopes: suppressedScopes,
      reason: params.reason,
      source: params.source,
      campaign_id: params.campaignId || existingData.campaign_id || null,
      cadence_id: params.cadenceId || existingData.cadence_id || null,
      suppressed_at_iso: existingData.suppressed_at_iso || nowIso,
      updated_at_iso: nowIso,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { persisted: true, email, scopes: suppressedScopes };
}

export async function isEmailSuppressed(
  emailInput: string,
  scopeInput: EmailSuppressionScope | string = "lifecycle",
) {
  const email = normalizeSuppressionEmail(emailInput);
  if (!email || !db) {
    return false;
  }
  const doc = await db.collection(SUPPRESSION_COLLECTION).doc(email).get();
  if (!doc.exists) {
    return false;
  }
  const data = doc.data() || {};
  if (data.global_suppressed === true) {
    return true;
  }
  const scope = normalizeScope(scopeInput);
  const scopes = Array.isArray(data.suppressed_scopes)
    ? data.suppressed_scopes.filter((value: unknown): value is string => typeof value === "string")
    : [];
  return scopes.includes("all") || scopes.includes(scope);
}
