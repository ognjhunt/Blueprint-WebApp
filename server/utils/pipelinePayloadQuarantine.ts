/**
 * A Pipeline payload this release cannot parse is kept, never forgotten.
 *
 * The screening contracts are strict, and the two repositories deploy
 * independently. A signed payload that failed its parse used to get a bare 400
 * and leave no trace here, while the Pipeline re-sent it on every pass: a
 * contract mismatch once lost a site's results that way
 * (`screeningCampaignIdentity`). Now a payload that passed the request
 * signature and its own digest but not the schema is:
 *
 * - stored once per payload digest, bounded in size, with the parse error
 *   (`pipelinePayloadQuarantine`, a server-only collection);
 * - reported once per payload digest on the existing ops-alert path
 *   (`recordBetaOpsFailureSignal`);
 * - answered `422 schema_not_accepted`, so the sender can tell it from every
 *   other refusal. The Pipeline then delivers the same result in the newest
 *   version this release does accept.
 *
 * Quarantine is a record, never acceptance: nothing is ingested, the schema
 * stays strict, and a payload whose own digest does not verify is not one the
 * Pipeline sealed, so it keeps the plain 400.
 */
import type { ZodType } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { matchesCrossRuntimeArtifactDigest } from "./crossRuntimeCanonical";
import { recordBetaOpsFailureSignal } from "./ops-alerts";

export const PIPELINE_PAYLOAD_QUARANTINE_COLLECTION = "pipelinePayloadQuarantine";
export const PIPELINE_PAYLOAD_QUARANTINE_SCHEMA = "pipeline_payload_quarantine.v1";
/** The typed refusal of a payload whose schema this release does not accept, and its status. */
export const PIPELINE_SCHEMA_NOT_ACCEPTED = "schema_not_accepted";
export const PIPELINE_SCHEMA_NOT_ACCEPTED_STATUS = 422;
/** The stored payload is cut at this many characters; its full length is recorded beside it. */
export const QUARANTINED_PAYLOAD_MAX_CHARS = 200_000;
const PARSE_ISSUES_MAX = 20;

export type QuarantinedPayloadKind = "beta_policy_screening_publication" | "beta_policy_screening_hold";

/** The payload's own digest when it verifies over the payload; null for anything the Pipeline did not seal. */
export function sealedPayloadDigest(body: unknown, digestField: string): string | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const digest = (body as Record<string, unknown>)[digestField];
  return typeof digest === "string" && /^sha256:[a-f0-9]{64}$/.test(digest)
    && matchesCrossRuntimeArtifactDigest(body as Record<string, unknown>, digestField) ? digest : null;
}

/**
 * Keep a sealed payload the schema refused and report it once. Returns null when the payload is not
 * sealed or the schema does accept it (the caller's own refusal then stands). Throws
 * `screening_store_unavailable` when it cannot be stored, so the sender retries rather than move on
 * from a payload nobody kept.
 */
export async function quarantineRejectedPayload(args: { kind: QuarantinedPayloadKind; digestField: string; body: unknown;
  schema: ZodType }): Promise<{ payload_digest: string; first_seen: boolean } | null> {
  const payloadDigest = sealedPayloadDigest(args.body, args.digestField);
  if (!payloadDigest) return null;
  const parsed = args.schema.safeParse(args.body);
  if (parsed.success) return null;
  if (!db) throw new Error("screening_store_unavailable");
  const store = db;
  const text = JSON.stringify(args.body);
  const declared = (args.body as Record<string, unknown>).schema_version;
  const issues = parsed.error.issues.slice(0, PARSE_ISSUES_MAX).map(issue => ({
    path: issue.path.map(String).join(".").slice(0, 300), code: String(issue.code), message: String(issue.message).slice(0, 300) }));
  const ref = store.collection(PIPELINE_PAYLOAD_QUARANTINE_COLLECTION).doc(`${args.kind}-${payloadDigest.slice(7)}`);
  const now = new Date().toISOString();
  let firstSeen = false, alerted = false;
  try {
    await store.runTransaction(async transaction => {
      const existing = (await transaction.get(ref)).data();
      firstSeen = !existing;
      alerted = existing?.alerted_at_iso != null;
      if (existing) {
        transaction.set(ref, { last_seen_at_iso: now, seen_count: (Number(existing.seen_count) || 1) + 1 }, { merge: true });
        return;
      }
      transaction.create(ref, { schema_version: PIPELINE_PAYLOAD_QUARANTINE_SCHEMA, kind: args.kind, payload_digest: payloadDigest,
        declared_schema_version: typeof declared === "string" ? declared.slice(0, 200) : null, accepted: false,
        parse_issue_count: parsed.error.issues.length, parse_issues: issues,
        payload_json: text.slice(0, QUARANTINED_PAYLOAD_MAX_CHARS), payload_chars: text.length,
        payload_truncated: text.length > QUARANTINED_PAYLOAD_MAX_CHARS,
        first_seen_at_iso: now, last_seen_at_iso: now, seen_count: 1, alerted_at_iso: null });
    });
  } catch (error) {
    logger.error({ event: "pipeline_payload_quarantine_failed", kind: args.kind, payloadDigest, err: error },
      "A rejected Pipeline payload could not be stored");
    throw new Error("screening_store_unavailable");
  }
  // One alert per payload digest. A payload stored before its alert went out is reported on its next delivery.
  if (!alerted) {
    try {
      await recordBetaOpsFailureSignal({ kind: "pipeline_payload_rejected", scopeId: `${args.kind}:${payloadDigest}`, severity: "critical",
        summary: `The Pipeline sent a ${args.kind} this release does not accept`
          + `${typeof declared === "string" ? ` (${declared.slice(0, 80)})` : ""}. Nothing was ingested. `
          + `It is kept in ${PIPELINE_PAYLOAD_QUARANTINE_COLLECTION}/${ref.id} with the parse error.`,
        details: { kind: args.kind, payload_digest: payloadDigest, quarantine_id: ref.id,
          first_issue: issues[0] ?? null, issue_count: parsed.error.issues.length } });
      await ref.set({ alerted_at_iso: new Date().toISOString() }, { merge: true });
    } catch (error) {
      logger.error({ event: "pipeline_payload_quarantine_alert_failed", kind: args.kind, payloadDigest, err: error },
        "A quarantined Pipeline payload could not be reported; it is reported on its next delivery");
    }
  }
  return { payload_digest: payloadDigest, first_seen: firstSeen };
}
