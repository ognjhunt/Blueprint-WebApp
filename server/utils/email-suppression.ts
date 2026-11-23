import crypto from "node:crypto";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin.js";
import { COMPANY_POSTAL_LINE } from "../../client/src/data/company.js";

export type EmailSuppressionScope =
  | "all"
  | "lifecycle"
  | "growth_campaign"
  | "optional_updates";

const SUPPRESSION_COLLECTION = "email_suppressions";
const BLUEPRINT_MAILING_ADDRESS = COMPANY_POSTAL_LINE;

export function normalizeSuppressionEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeScope(value: unknown): EmailSuppressionScope {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "all" || normalized === "growth_campaign" || normalized === "lifecycle" || normalized === "optional_updates") {
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

/** The same secret resolution as the project's other signed links (`jobOutcomeToken.ts`). */
function unsubscribeTokenKey() {
  const secret = (
    process.env.BLUEPRINT_REQUEST_REVIEW_TOKEN_SECRET?.trim() ||
    process.env.BLUEPRINT_SESSION_UI_TOKEN_SECRET?.trim() ||
    process.env.PIPELINE_SYNC_TOKEN?.trim()
  );
  if (!secret && process.env.NODE_ENV === "production") throw new Error("Capture and review signing secret is required");
  return crypto.createHash("sha256").update(`email_unsubscribe:${secret || "blueprint-request-review-dev-secret"}`).digest();
}

/**
 * The unsubscribe link's token: the address and scope, sealed (AES-256-GCM) so the link neither shows the address nor
 * can be made for another one. It does not expire: an unsubscribe link must keep working.
 */
export function createUnsubscribeToken(params: { email: string; scope?: EmailSuppressionScope | string | null }): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", unsubscribeTokenKey(), iv);
  const sealed = Buffer.concat([cipher.update(JSON.stringify({ kind: "email_unsubscribe",
    e: normalizeSuppressionEmail(params.email), s: normalizeScope(params.scope) }), "utf-8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString("base64url");
}

export function verifyUnsubscribeToken(token: unknown): { email: string; scope: EmailSuppressionScope } | null {
  try {
    const value = typeof token === "string" ? token : "";
    if (!value || value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
    const bytes = Buffer.from(value, "base64url");
    if (bytes.length <= 28) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", unsubscribeTokenKey(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const payload = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf-8"));
    const email = normalizeSuppressionEmail(payload?.e);
    if (payload?.kind !== "email_unsubscribe" || !email) return null;
    return { email, scope: normalizeScope(payload.s) };
  } catch { return null; }
}

export function buildUnsubscribeUrl(params: {
  email: string;
  scope?: EmailSuppressionScope | string | null;
  campaignId?: string | null;
  cadenceId?: string | null;
}) {
  const url = new URL("/api/growth/email/unsubscribe", publicAppOrigin());
  url.searchParams.set("token", createUnsubscribeToken(params));
  if (params.campaignId) url.searchParams.set("campaignId", params.campaignId);
  if (params.cadenceId) url.searchParams.set("cadenceId", params.cadenceId);
  return url.toString();
}

/** What an unsubscribe stops, in the reader's words. Only `optional_updates` is linked from an email today. */
export const OPTIONAL_UPDATES_EMAILS = "new-job emails and Blueprint updates";

/** The emails a scope's unsubscribe stops, as a reader would name them; a scope no email links to is "these emails". */
function unsubscribeScopeWords(scope: unknown): string {
  return normalizeScope(scope) === "optional_updates" ? OPTIONAL_UPDATES_EMAILS : "these emails";
}

const UNSUBSCRIBE_LINE = /\nUnsubscribe from [^\n:]+: (https:\/\/\S+)\s*$/;

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
    `Unsubscribe from ${unsubscribeScopeWords(params.scope)}: ${unsubscribeUrl}`,
  ].join("\n");
}

/**
 * The unsubscribe link a commercial footer ends with (`appendCommercialEmailFooter`), or null: the HTML part shows it as
 * the layout's own "Unsubscribe" link, and the footer stays in the text part.
 */
export function commercialUnsubscribeUrl(text: string): string | null {
  return UNSUBSCRIBE_LINE.exec(text)?.[1] ?? null;
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
