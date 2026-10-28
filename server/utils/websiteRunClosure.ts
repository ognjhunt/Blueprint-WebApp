/** Owner-directed stop of one capture run; preserves consent, evidence and settlement. */
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeDigest as digest } from "./crossRuntimeCanonical";
import { websiteAtlasSourceVideoIdentity } from "./websiteAtlasAuthorization";
import type { TaskOutcome } from "../../client/src/types/taskOutcome";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);
const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const closureSchema = z.object({
  schema_version: z.literal("website_run_closure.v1"), request_id: id, capture_id: id,
  decision: z.literal("conservative_abstention"), actor: z.literal("signed_owner_link"),
  source_identity_digest: sha, closed_at_iso: z.string().datetime(),
  new_execution_authorized: z.literal(false), explicit_resume_required: z.literal(true),
  physical_validation: z.literal(false), closure_digest: sha,
}).strict();
export type WebsiteRunClosure = z.infer<typeof closureSchema>;

export function websiteRunClosure(record: Record<string, any> | undefined, requestId: string,
  captureId: string): WebsiteRunClosure | null {
  const closures = record?.website_run_closures;
  if (closures === undefined) return null;
  if (!closures || typeof closures !== "object" || Array.isArray(closures)) throw new Error("website_run_closure_invalid");
  if (!Object.prototype.hasOwnProperty.call(closures, captureId)) return null;
  const saved = closures[captureId];
  const parsed = closureSchema.safeParse(saved);
  if (!parsed.success) throw new Error("website_run_closure_invalid");
  const { closure_digest, ...value } = parsed.data;
  if (value.request_id !== requestId || value.capture_id !== captureId || digest(value) !== closure_digest)
    throw new Error("website_run_closure_invalid");
  return parsed.data;
}

export function assertWebsiteRunOpen(record: Record<string, any> | undefined, requestId: string, captureId: string) {
  if (websiteRunClosure(record, requestId, captureId)) throw new Error("website_run_closed_by_owner");
}

export async function closeWebsiteRun(requestId: string, captureId: string): Promise<WebsiteRunClosure> {
  id.parse(requestId); id.parse(captureId);
  if (!db) throw new Error("website_run_closure_store_unavailable");
  const requestRef = db.collection("inboundRequests").doc(requestId);
  const sessionRef = db.collection("captureUploadSessions").doc(captureId);
  return db.runTransaction(async tx => {
    const [request, session] = await Promise.all([tx.get(requestRef), tx.get(sessionRef)]);
    const record = request.data();
    if (!request.exists || record?.request?.buyerType !== "site_operator") throw new Error("website_run_request_missing");
    const savedSession = session.data();
    const sourceOwner = savedSession?.browser_pending_delivery ?? savedSession?.site_capture_bundle;
    if (sourceOwner?.request_id !== requestId || sourceOwner?.capture_id !== captureId
      || sourceOwner?.scene_id !== `site-${requestId}`) throw new Error("website_run_source_changed");
    const identity = websiteAtlasSourceVideoIdentity(savedSession);
    if (!identity) throw new Error("website_run_source_unavailable");
    const source_identity_digest = digest(identity);
    const existing = websiteRunClosure(record, requestId, captureId);
    if (existing) {
      if (existing.source_identity_digest !== source_identity_digest) throw new Error("website_run_source_changed");
      return existing;
    }
    const value = { schema_version: "website_run_closure.v1" as const, request_id: requestId, capture_id: captureId,
      decision: "conservative_abstention" as const, actor: "signed_owner_link" as const,
      source_identity_digest, closed_at_iso: new Date().toISOString(), new_execution_authorized: false as const,
      explicit_resume_required: true as const, physical_validation: false as const };
    const closure = { ...value, closure_digest: digest(value) };
    tx.update(requestRef, { website_run_closures: { ...record.website_run_closures, [captureId]: closure } });
    return closure;
  });
}

export function projectWebsiteRunClosure(record: Record<string, any> | undefined, requestId: string,
  captureId: string): TaskOutcome | null {
  const closure = websiteRunClosure(record, requestId, captureId);
  if (!closure) return null;
  return { category: "insufficient_evidence", basis: "missing_evidence", title: "Run closed with a conservative abstention",
    reason: "The owner chose to close this run without making a new robot decision. This closure does not establish the scene's robot feasibility.",
    scope: "Owner-directed closure of this capture run. No new robot incompatibility, policy score or physical validation is established by closing it; earlier evidence remains retained.",
    nextStep: "Blueprint will keep this run closed and block new processing and paid work. A new explicit instruction is required to resume. Your recording and retained evidence stay saved.",
    actionOwner: "blueprint", reference: `bp-close-${closure.closure_digest.slice(7, 23)}`,
    evidence: [{ label: "Owner closure decision", digest: closure.closure_digest }] };
}
