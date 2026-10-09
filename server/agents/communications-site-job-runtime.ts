import { z } from "zod";
import { communicationsDigest } from "./communications-contract";
import { COMMUNICATIONS_DRAFT_BUDGET, estimatedDraftMicros } from "./communications-draft-budget";
import { decryptFieldValue } from "../utils/field-encryption";
import { projectWebsiteCaptureRights } from "../utils/websiteTaskContext";

/** Optional server-installed authority for the owner's original eight-hour case.
 * It never enables outreach, workers, new credentials or another customer. */
export const SITE_JOB_RUNTIME_REQUEST_ID = "capture-cd43cdc3-b3f1-435c-b789-80484f304dbd";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const authoritySchema = z.object({
  schema_version: z.literal("blueprint.site-job-communications-runtime.v1"), owner: z.literal("Nijel Hunt"),
  request_id: z.literal(SITE_JOB_RUNTIME_REQUEST_ID), recipient_digest: hash,
  owner_instruction_ref: z.string().regex(/^gs:\/\/blueprint-8c1ca\.(?:appspot\.com|firebasestorage\.app)\/operations\/[A-Za-z0-9_./-]+$/),
  owner_instruction_sha256: hash, starts_at_ms: z.number().int().safe(), expires_at_ms: z.number().int().safe(),
  evidence_retention_deadline_ms: z.number().int().safe(),
}).strict();
export type SiteJobRuntimeAuthorization = z.infer<typeof authoritySchema>;
export class SiteJobRuntimeError extends Error {
  constructor(readonly code: string) { super(code); }
}
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
export function resolveSiteJobRuntimeAuthorization(requestId: string, recipient: string, now = Date.now()): SiteJobRuntimeAuthorization | null {
  let value: unknown;
  try { value = JSON.parse(process.env.BLUEPRINT_SITE_JOB_COMMUNICATIONS_AUTHORIZATION_JSON ?? "null"); } catch { return null; }
  const parsed = authoritySchema.safeParse(value);
  if (!parsed.success) return null;
  const a = parsed.data;
  if (a.request_id !== requestId || a.recipient_digest !== communicationsDigest({ recipient: normalize(recipient) })
    || a.starts_at_ms < Date.parse("2026-10-09T04:24:35Z") || a.expires_at_ms > Date.parse("2026-10-09T12:24:35Z")
    || a.expires_at_ms <= a.starts_at_ms || a.expires_at_ms - a.starts_at_ms > 8 * 3600000
    || a.evidence_retention_deadline_ms > 1791574084894 || a.expires_at_ms > a.evidence_retention_deadline_ms
    || !Number.isFinite(now) || now < a.starts_at_ms || now >= a.expires_at_ms) return null;
  return a;
}
function refs(db: FirebaseFirestore.Firestore, a: SiteJobRuntimeAuthorization, jobId: string) {
  if (!/^[a-f0-9]{64}$/.test(jobId)) throw new SiteJobRuntimeError("job_draft_binding_invalid");
  const root = db.doc(`inboundRequests/${a.request_id}`);
  return { root, admissions: root.collection("siteJobDraftAdmissions"),
    admission: root.collection("siteJobDraftAdmissions").doc(communicationsDigest({ jobId })),
    state: root.collection("siteJobDraftAccounting").doc("current"),
    communication: root.collection("communications").doc(jobId) };
}

/** Canonical case accounting, independent of unrelated outreach liability.
 * Unknown own creates/costs remain blocking; they are never reset or refunded. */
export async function reserveSiteJobDraft(db: FirebaseFirestore.Firestore, a: SiteJobRuntimeAuthorization,
  jobId: string, requestDigest: string, clock = Date.now) {
  if (!/^[a-f0-9]{64}$/.test(requestDigest)) throw new SiteJobRuntimeError("job_draft_binding_invalid");
  const r = refs(db, a, jobId), authorityDigest = communicationsDigest(a);
  return db.runTransaction(async tx => {
    const [job, communication, prior, state, unresolved] = await Promise.all([tx.get(r.root), tx.get(r.communication),
      tx.get(r.admission), tx.get(r.state), tx.get(r.admissions.where("state", "in", ["reserved", "usage_unknown"]).limit(1))]);
    const record = job.data(), row = communication.data(), recipient = normalize(await decryptFieldValue(record?.contact?.email ?? ""));
    const current = resolveSiteJobRuntimeAuthorization(a.request_id, recipient, clock());
    if (!record || projectWebsiteCaptureRights(record).consent_revoked || !current || communicationsDigest(current) !== authorityDigest)
      throw new SiteJobRuntimeError("job_runtime_authorization_unavailable");
    if (!row || row.binding?.requestId !== a.request_id || row.recipient !== recipient || row.state !== "drafting")
      throw new SiteJobRuntimeError("job_draft_binding_invalid");
    if (prior.exists) throw new SiteJobRuntimeError("job_draft_reservation_requires_reconciliation");
    if (state.data()?.activeAdmissionId || !unresolved.empty) throw new SiteJobRuntimeError("job_draft_cost_unresolved");
    // Check again after awaited canonical reads/decryption and transaction retries.
    if (!resolveSiteJobRuntimeAuthorization(a.request_id, recipient, clock())) throw new SiteJobRuntimeError("job_runtime_authorization_unavailable");
    tx.create(r.admission, { schema_version: "blueprint.site-job-draft-admission.v1", jobId, requestDigest,
      authority: a, authorityDigest, state: "reserved", usageState: "unresolved", estimatedModelMicros: null,
      reservationUsd: null, reservationBasis: "owner_authorized_no_numeric_cap_charge_unknown_until_provider_receipt",
      invoiceVerified: false, policy: COMMUNICATIONS_DRAFT_BUDGET, admittedAt: new Date(clock()).toISOString() });
    tx.set(r.state, { activeAdmissionId: r.admission.id }, { merge: true });
    return r.admission.id;
  });
}

/** Accounting of already-incurred usage remains possible after authorization
 * expires. Provider session/turn provenance stays on the communication checkpoint. */
export async function recordSiteJobDraftUsage(db: FirebaseFirestore.Firestore, a: SiteJobRuntimeAuthorization,
  jobId: string, requestDigest: string, usage: unknown, now = Date.now()) {
  const r = refs(db, a, jobId);
  return db.runTransaction(async tx => {
    const [saved, state] = await Promise.all([tx.get(r.admission), tx.get(r.state)]), row = saved.data();
    if (!row || row.jobId !== jobId || row.requestDigest !== requestDigest || row.authorityDigest !== communicationsDigest(a))
      throw new SiteJobRuntimeError("job_draft_usage_binding_changed");
    const estimate = estimatedDraftMicros(usage), previous = row.estimatedModelMicros;
    if (previous !== null && (!Number.isSafeInteger(previous) || previous < 0)) throw new SiteJobRuntimeError("job_draft_accounting_invalid");
    const retained = estimate === null ? previous : Math.max(previous ?? 0, estimate);
    tx.set(r.admission, { state: estimate === null ? "usage_unknown" : "usage_recorded",
      usageState: estimate === null ? "unresolved" : "best_effort_not_invoice", ...(estimate === null ? {} : { usage }),
      estimatedModelMicros: retained, checkedAt: new Date(now).toISOString() }, { merge: true });
    if (estimate !== null && state.data()?.activeAdmissionId === r.admission.id) tx.set(r.state, { activeAdmissionId: null }, { merge: true });
    if (estimate === null && !state.data()?.activeAdmissionId) tx.set(r.state, { activeAdmissionId: r.admission.id }, { merge: true });
    return estimate !== null;
  });
}

/** Resolve incurred accounting by its original immutable admission, independent
 * of current configuration. This grants no inference or send authority. */
export async function settleExistingSiteJobDraftUsage(db: FirebaseFirestore.Firestore, requestId: string,
  jobId: string, requestDigest: string, usage: unknown): Promise<boolean> {
  if (requestId !== SITE_JOB_RUNTIME_REQUEST_ID) return false;
  const path = `inboundRequests/${requestId}/siteJobDraftAdmissions/${communicationsDigest({ jobId })}`;
  const row = (await db.doc(path).get()).data();
  if (!row) return false;
  const parsed = authoritySchema.safeParse(row.authority);
  if (!parsed.success || parsed.data.request_id !== requestId || row.authorityDigest !== communicationsDigest(parsed.data)
    || row.jobId !== jobId || row.requestDigest !== requestDigest) throw new SiteJobRuntimeError("job_draft_usage_binding_changed");
  await recordSiteJobDraftUsage(db, parsed.data, jobId, requestDigest, usage);
  return true;
}
