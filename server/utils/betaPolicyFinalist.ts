/** Durable, no-spend preparation and owner-authorized continuation of beta screening. */
import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { parseBetaPolicyScreeningPublication, type BetaPolicyScreeningPublication } from "./betaPolicyScreeningContract";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { managedJobTask, assertManagedScreeningCaptureCurrent, readManagedJobSourceSession, readManagedScreeningCapture } from "./jobManagedEvaluation";
import { reservationTtlMs } from "./agentRunRecord";
import { MAX_FREE_SPONSOR_CAP_USD } from "./freeBeta";
import { resolveExecutionAccessContext } from "./access-control";
import type { Response } from "express";
import type { TaskItemInventoryRecord } from "./taskItemInventory";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const finalistRequestSchema = z.object({
  schema_version: z.literal("beta_policy_finalist_request.v1"),
  campaign_id: id, publication_digest: digest, candidate_id: id,
  job_id: id, brief_digest: digest, source_fingerprint: digest,
}).strict();
export type FinalistRequest = z.infer<typeof finalistRequestSchema>;
export const finalistApprovalSchema = z.object({
  episodes: z.literal(200), sponsorCapUsd: z.number().finite().positive().max(MAX_FREE_SPONSOR_CAP_USD),
  expiresAtIso: z.string().datetime(), maxAttempts: z.literal(1), evidenceScope: z.literal("development_only"),
}).strict();
export const admitFinalistSchema = finalistApprovalSchema.extend({ finalistId: id, planDigest: digest }).strict();

export function finalistIdForRequest(request: FinalistRequest) {
  const { campaign_id, candidate_id, job_id, brief_digest, source_fingerprint } = request;
  return `finalist-${crossRuntimeDigest({ campaign_id, candidate_id, job_id, brief_digest, source_fingerprint }).slice(7, 39)}`;
}

/** Preparing a scored candidate is free; selecting paid finalists is still the owner's decision. */
export function buildFinalistContinuations(publication: BetaPolicyScreeningPublication, args: {
  jobId: string; briefDigest: string; sourceFingerprint: string; intakeId: string;
  ownerUserId: string; teamNamespace: string; now: string;
}) {
  if (publication.purpose !== "screening" || publication.status !== "completed") return [];
  return publication.candidates.filter(row => row.status === "completed" && row.episodes_scored > 0
    && row.episodes_succeeded > 0 && row.blockers.length === 0).map(candidate => {
    const request = finalistRequestSchema.parse({ schema_version: "beta_policy_finalist_request.v1",
      campaign_id: publication.campaign_id, publication_digest: publication.publication_digest,
      candidate_id: candidate.candidate_id, job_id: args.jobId, brief_digest: args.briefDigest,
      source_fingerprint: args.sourceFingerprint });
    const runId = finalistIdForRequest(request);
    return { run_id: runId, run_kind: "beta_policy_finalist", state: "preparing",
      owner_user_id: args.ownerUserId, team_namespace: args.teamNamespace,
      job_evidence_binding: { job_id: args.jobId, brief_digest: args.briefDigest },
      job_task_context_digest: publication.source.task_context_digest, job_source_fingerprint: args.sourceFingerprint,
      source_scene_intake_id: args.intakeId, source_scene_intent_id: publication.source.scene_intent_id,
      source_scene_revision_digest: publication.source.scene_revision_digest,
      finalist_request: request, finalist_source: publication.source,
      finalist_candidate_configuration_digest: candidate.configuration_digest,
      finalist_state: "preparation_pending", finalist_forward_pending: true,
      finalist_forward_attempts: 0, finalist_next_at_ms: 0,
      created_at_iso: args.now, updated_at_iso: args.now };
  });
}

export function parseFinalistReceipt(value: unknown, record: Record<string, any>) {
  const raw = value as Record<string, any> | null;
  const request = finalistRequestSchema.parse(record.finalist_request);
  if (!raw || raw.schema_version !== "beta_policy_finalist_receipt.v1"
    || raw.finalist_id !== finalistIdForRequest(request) || !digest.safeParse(raw.plan_digest).success
    || raw.job_id !== request.job_id || raw.brief_digest !== request.brief_digest
    || raw.source_fingerprint !== request.source_fingerprint || raw.candidate_id !== request.candidate_id
    || raw.episodes !== 200 || raw.recommendation_eligible !== false
    || typeof raw.maximum_planned_cost_usd !== "string" || !/^(0|[1-9][0-9]*)(\.[0-9]{1,6})?$/.test(raw.maximum_planned_cost_usd)
    || !(Number(raw.maximum_planned_cost_usd) > 0 && Number(raw.maximum_planned_cost_usd) <= MAX_FREE_SPONSOR_CAP_USD)
    || crossRuntimeDigest(raw.source) !== crossRuntimeDigest(record.finalist_source)
    || !["awaiting_owner_authority", "authorized", "preparing", "launching", "queued", "running", "completed", "blocked", "reconciliation_required"].includes(raw.state))
    throw new Error("finalist_receipt_binding_invalid");
  if (record.finalist_preparation?.plan_digest && raw.plan_digest !== record.finalist_preparation.plan_digest)
    throw new Error("finalist_receipt_plan_changed");
  return raw;
}

/** Uses the existing Pipeline service identity and nonce-bound signature. Never calls a provider. */
export async function requestPipelineFinalist(path: string, body?: unknown) {
  const configured = process.env.TASK_EVALUATION_LAUNCH_URL || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL;
  const token = process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
  if (!configured || !token) throw new Error("finalist_forwarding_not_configured");
  const url = new URL(configured);
  if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:"
    && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))) throw new Error("finalist_forwarding_url_invalid");
  url.pathname = `/api/live-pipeline/beta-policy-finalists${path}`;
  url.search = ""; url.hash = "";
  const text = body === undefined ? "" : JSON.stringify(body);
  const timestamp = new Date().toISOString(), nonce = randomUUID(), client = "blueprint-webapp";
  const signature = createHmac("sha256", token).update(`${timestamp}.${client}.${nonce}.${text}`).digest("hex");
  const response = await fetch(url, { method: body === undefined ? "GET" : "POST", redirect: "error",
    headers: { "content-type": "application/json", "x-blueprint-pipeline-timestamp": timestamp,
      "x-blueprint-pipeline-client-id": client, "x-blueprint-pipeline-nonce": nonce,
      "x-blueprint-pipeline-signature": `sha256=${signature}` },
    ...(body === undefined ? {} : { body: text }), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    const refusal = await response.json().catch(() => ({})) as { detail?: unknown };
    if ([400, 409, 422].includes(response.status) && typeof refusal.detail === "string"
      && /^beta_finalist_[a-z_]+$/.test(refusal.detail)) throw new Error(refusal.detail);
    throw new Error(`finalist_pipeline_http_${response.status}`);
  }
  return response.json();
}

/** Re-read the same job, permissions, immutable intake and screening evidence before every handoff. */
export async function assertFinalistSourceCurrent(record: Record<string, any>,
  read: (ref: FirebaseFirestore.DocumentReference) => Promise<FirebaseFirestore.DocumentSnapshot>) {
  if (!db) throw new Error("finalist_store_unavailable");
  const request = finalistRequestSchema.parse(record.finalist_request);
  if (record.run_id !== finalistIdForRequest(request) || record.run_kind !== "beta_policy_finalist")
    throw new Error("finalist_request_identity_conflict");
  const [job, brief, inventory, intake, screening] = await Promise.all([
    read(db.collection("inboundRequests").doc(request.job_id)), read(db.collection("siteTaskBriefs").doc(request.job_id)),
    read(db.collection("siteTaskItemInventories").doc(request.job_id)),
    read(db.collection("taskEvaluationSceneIntakes").doc(record.source_scene_intake_id)),
    read(db.collection("taskEvaluationPolicyRuns").doc(request.campaign_id)),
  ]);
  const original = screening.data();
  if (!original?.result_record_id || original.run_kind !== "beta_policy_screening"
    || original.job_evidence_binding?.job_id !== request.job_id) throw new Error("finalist_screening_source_unavailable");
  const result = await read(db.collection("captureTaskEvaluationRuns").doc(original.result_record_id));
  const publication = parseBetaPolicyScreeningPublication(publicationFromResultRecord(result.data() ?? {}));
  const candidate = publication?.candidates.find(row => row.candidate_id === request.candidate_id);
  if (!publication || publication.purpose !== "screening" || publication.status !== "completed"
    || publication.campaign_id !== request.campaign_id || publication.publication_digest !== original.publication_digest
    || candidate?.status !== "completed" || candidate.episodes_scored === 0 || candidate.episodes_succeeded === 0
    || candidate.configuration_digest !== record.finalist_candidate_configuration_digest
    || crossRuntimeDigest(publication.source) !== crossRuntimeDigest(record.finalist_source))
    throw new Error("finalist_screening_source_changed");
  const sourceSession = await readManagedJobSourceSession(job.data(), read);
  const capture = sourceSession ? { captureId: publication.source.capture_id }
    : await readManagedScreeningCapture(request.job_id, publication.source.capture_id);
  await assertManagedScreeningCaptureCurrent(request.job_id, capture, read);
  const scope = managedJobTask({ binding: { job_id: request.job_id, brief_digest: request.brief_digest },
    record: job.data(), brief: brief.data(), inventory: inventory.exists ? inventory.data() as TaskItemInventoryRecord : null,
    sourceSession, screeningCapture: capture, allowProposedScreening: true });
  const { assertScreeningSceneSource } = await import("./betaPolicyScreeningIngest");
  assertScreeningSceneSource(publication, intake.data() ?? {}, scope);
  if (scope.sourceFingerprint !== request.source_fingerprint) throw new Error("finalist_job_source_changed");
  return scope;
}

/** Existing execution-role route records exact authority; HTTP does not launch paid execution. */
export async function admitBetaPolicyFinalist(jobId: string, input: unknown, approvedBy: string) {
  id.parse(jobId);
  const command = admitFinalistSchema.parse(input);
  if (!db || !approvedBy) throw new Error("finalist_authority_unavailable");
  const { finalistId, planDigest, ...approval } = command;
  const expiry = Date.parse(approval.expiresAtIso);
  const ref = db.collection("taskEvaluationPolicyRuns").doc(finalistId);
  return db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record || record.finalist_request?.job_id !== jobId) throw new Error("finalist_job_mismatch");
    await assertFinalistSourceCurrent(record, reference => tx.get(reference));
    if (record.finalist_preparation?.plan_digest !== planDigest) throw new Error("finalist_plan_changed");
    if (approval.sponsorCapUsd < Number(record.finalist_preparation.maximum_planned_cost_usd))
      throw new Error("finalist_owner_cap_insufficient");
    const authority = { plan_digest: planDigest, approved_by: approvedBy, approval };
    const authorityDigest = crossRuntimeDigest(authority);
    if (record.finalist_authority) {
      if (record.finalist_owner_authority_digest !== authorityDigest) throw new Error("finalist_approval_conflict");
      return { created: false, runId: finalistId, evidenceScope: approval.evidenceScope };
    }
    if (expiry <= Date.now() || expiry > Date.now() + reservationTtlMs()) throw new Error("finalist_approval_expired");
    if (record.finalist_state !== "awaiting_owner_authority") throw new Error("finalist_preparation_not_ready");
    tx.set(ref, { finalist_authority: authority, finalist_owner_authority_digest: authorityDigest,
      finalist_state: "authorization_pending", finalist_forward_pending: true, finalist_next_at_ms: 0,
      finalist_forward_attempts: 0, updated_at_iso: new Date().toISOString() }, { merge: true });
    return { created: true, runId: finalistId, evidenceScope: approval.evidenceScope };
  });
}

/** Drained by the existing launch worker; each request is immutable and idempotent in Pipeline. */
export async function processBetaPolicyFinalistQueue(limit = 10, transport = requestPipelineFinalist) {
  if (!db) return { processed: 0 };
  const store = db;
  const rows = await store.collection("taskEvaluationPolicyRuns").where("finalist_forward_pending", "==", true).limit(limit).get();
  let processed = 0;
  for (const doc of rows.docs) {
    const token = randomUUID(), now = Date.now();
    const record = await store.runTransaction(async tx => {
      const current = (await tx.get(doc.ref)).data();
      if (!current || current.finalist_forward_pending !== true || current.finalist_next_at_ms > now
        || current.finalist_forward_lease_until_ms > now) return null;
      await assertFinalistSourceCurrent(current, reference => tx.get(reference));
      tx.set(doc.ref, { finalist_forward_lease_token: token, finalist_forward_lease_until_ms: now + 60_000 }, { merge: true });
      return current;
    }).catch(async error => {
      const code = error instanceof Error ? error.message : "finalist_store_unavailable";
      const sourceRefused = /^(job_|screening_|finalist_(request_identity|screening_source|job_source))/.test(code);
      await doc.ref.set({ ...(sourceRefused ? { finalist_forward_pending: false, finalist_state: "blocked", state: "blocked" } : {}),
        finalist_next_at_ms: Date.now() + 60_000, finalist_blocker: code }, { merge: true });
      return null;
    });
    if (!record) continue;
    try {
      const prepare = record.finalist_state === "preparation_pending";
      const authorize = record.finalist_state === "authorization_pending";
      if (authorize) {
        const authority = record.finalist_authority;
        const access = await resolveExecutionAccessContext({ locals: { firebaseUser: { uid: authority?.approved_by } } } as Response);
        if (!access.isOps || crossRuntimeDigest(authority) !== record.finalist_owner_authority_digest)
          throw new Error("finalist_owner_authority_unavailable");
        // An identical authorization may have reached Pipeline before a lost
        // response. Its idempotent endpoint reconciles that case; Pipeline
        // still refuses new authority or allocation after expiry.
      }
      const raw = await transport(prepare ? "" : `/${encodeURIComponent(record.run_id)}${authorize ? "/authorize" : ""}`,
        prepare ? record.finalist_request : authorize ? record.finalist_authority : undefined);
      const receipt = parseFinalistReceipt(raw, record);
      if (prepare && (receipt.state !== "awaiting_owner_authority" || receipt.provider_mutation_performed !== false
        || receipt.paid_execution_requested !== false)) throw new Error("finalist_preparation_boundary_invalid");
      if (!prepare && receipt.owner_authority_digest !== record.finalist_owner_authority_digest)
        throw new Error("finalist_owner_authority_mismatch");
      // Accept the publication before clearing delivery intent. A crash or
      // storage outage must leave the exact terminal result recoverable by GET.
      if (receipt.publication) {
        const publication = parseBetaPolicyScreeningPublication(receipt.publication);
        if (!publication || publication.purpose !== "finalist") throw new Error("finalist_publication_invalid");
        const { ingestBetaPolicyScreening } = await import("./betaPolicyScreeningIngest");
        await ingestBetaPolicyScreening(publication);
      }
      const terminal = receipt.state === "blocked" || receipt.state === "completed" && Boolean(receipt.publication);
      await store.runTransaction(async tx => {
        const current = (await tx.get(doc.ref)).data();
        if (current?.finalist_forward_lease_token !== token || current.finalist_state !== record.finalist_state) return;
        tx.set(doc.ref, { ...(prepare ? { finalist_preparation: receipt } : {}),
          finalist_state: receipt.state, state: receipt.state === "awaiting_owner_authority" ? "preparing" : receipt.state,
          finalist_forward_pending: !prepare && !terminal, finalist_next_at_ms: Date.now() + 60_000,
          finalist_forward_lease_until_ms: 0, finalist_forward_attempts: 0,
          updated_at_iso: new Date().toISOString() }, { merge: true });
      });
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "finalist_forward_unavailable";
      const terminal = /^(beta_finalist_|finalist_(receipt_|preparation_boundary|owner_authority_|publication_)|job_)/.test(message);
      await store.runTransaction(async tx => {
        const current = (await tx.get(doc.ref)).data();
        if (current?.finalist_forward_lease_token !== token
          || current.result_record_id && ["completed", "blocked"].includes(current.state)) return;
        const attempts = Number(current.finalist_forward_attempts || 0) + 1;
        tx.set(doc.ref, { finalist_forward_lease_until_ms: 0, finalist_forward_attempts: attempts,
          finalist_forward_pending: !terminal && attempts < 20, finalist_blocker: message,
          finalist_next_at_ms: Date.now() + Math.min(900_000, 60_000 * 2 ** Math.min(attempts - 1, 4)),
          ...(terminal || attempts >= 20 ? { finalist_state: "blocked", state: "blocked" } : {}),
          updated_at_iso: new Date().toISOString() }, { merge: true });
      });
    }
  }
  return { processed };
}
