// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import type { DeliveryProposalInput, JobMarketplaceWorkflow } from "../../client/src/types/jobMarketplace";
import { screeningFixture } from "./fixtures/beta-policy-screening";
import { buildTaskTargetChoiceAnswer, taskTargetSelection } from '../utils/websiteTaskTargetChoice';

const captures = vi.hoisted(() => ({ received: true as boolean | null }));
vi.mock("../utils/siteWalkthrough", () => ({
  siteWalkthroughIdentity: (requestId: string) => ({ requestId, sceneId: `site-${requestId}`, captureId: `walkthrough-${requestId}` }),
  savedWalkthrough: async () => captures.received === null ? null : { received: captures.received },
}));
vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null,
    authAdmin: { verifyIdToken: async (token: string) => {
      if (token === "ops-token") return { uid: "ops-user", email: "ops@example.test", role: "ops" };
      if (token === "ordinary-token") return { uid: "ordinary-user", email: "buyer@example.test" };
      throw new Error("invalid token");
    } }, default: {} };
});
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("express-rate-limit", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));

const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { projectJobMarketplace } = await import("../utils/jobMarketplaceWorkflow");
const router = (await import("../routes/job-workflow")).default;
const { csrfProtection } = await import("../middleware/csrf");
const token = (requestId = "job-1", scope: "owner" | "film" = "owner") => createCaptureUploadToken({ requestId,
  captureId: `walkthrough-${requestId}`, sceneId: `site-${requestId}`, scope });
const csrf = { cookie: "csrf_token=workflow-test", "x-csrf-token": "workflow-test" };
const proposal: DeliveryProposalInput = {
  providerName: "Example Delivery Co", scope: "Move sealed cases between the agreed tote and tray.",
  equipment: "Fixed arm and parallel gripper", software: "Pinned policy and local controller",
  deliveryCommitment: "Install the cell and demonstrate the agreed acceptance test.",
  installationCostUsd: 10000, monthlyCostUsd: 500, currency: "USD", exclusions: "Building electrical work excluded.",
  sitePreparation: "Clear the workcell and provide power.", humanAssistance: "Operator replenishes the tote.",
  timing: "Dates agreed after site review.", support: "Business-hours support, next-day on-site response.",
  evidence: [{ level: "unverified", summary: "Customer-specific trial is still required." }],
  acceptanceCriteria: "Complete 100 placements within the agreed cycle time and damage limit.", recommendationReason: null,
};
let server: Server, base = "";
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/api/job-workflow", csrfProtection, router);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/job-workflow`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
beforeEach(() => {
  captures.received = true;
  state.docs.clear();
  for (const id of ["job-1", "job-2"]) {
    state.docs.set(`inboundRequests/${id}`, { request: { buyerType: "site_operator", siteTaskSpec: { jobFrequency: "Every shift", purchaseReadiness: "planning" } },
      contact: { email: "PRIVATE_EMAIL", phone: "PRIVATE_PHONE" }, account_owner_uid: "PRIVATE_UID" });
    state.docs.set(`siteTaskBriefs/${id}`, { requestId: id, summary: "Move sealed cases into trays", confirmedAtIso: "2026-10-20T10:00:00.000Z", confirmedBy: "Site owner" });
  }
});
async function api(path: string, method = "GET", body?: unknown, auth?: string, extra: Record<string, string> = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...csrf, "content-type": "application/json", ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, headers: response.headers, body: await response.json() as JobMarketplaceWorkflow & { code?: string; error?: string } };
}
const admin = (path = "", method = "GET", body?: unknown, extra?: Record<string, string>) => api(`/admin/job-1${path}`, method, body, "ops-token", extra);
const owner = (path = "", method = "GET", body?: unknown) => api(`/owner/${token()}${path}`, method, body);
async function publish() { const created = await admin("/proposals", "POST", proposal); expect(created.status).toBe(201); return created.body.proposals[0]; }
function rejectSelection(jobId: string, contextDigest = `sha256:${'c'.repeat(64)}`, otherCandidate = false) {
  const selector = {request_id: jobId, scene_id: `site-${jobId}`, capture_id: `walkthrough-${jobId}`,
    task_context_digest: contextDigest, completion_marker_generation: '1', producer_delivery_key: `sha256:${'a'.repeat(64)}`,
    source_payload_sha256: 'b'.repeat(64)};
  const question = {kind: 'task_target_choice' as const, question_digest: `sha256:${'1'.repeat(64)}`,
    target_id: 'box', semantic_label: 'Box', candidate_set_digest: `sha256:${'2'.repeat(64)}`,
    guessed_candidate_id: 'c0123456789abcdef', candidates: [{candidate_id: 'c0123456789abcdef', label: 'Box at left', reference_time_ms: 1000},
      {candidate_id: 'cfedcba9876543210', label: 'Box at right', reference_time_ms: 1000}]};
  state.docs.set(`captureUploadSessions/walkthrough-${jobId}`, {website_preparation: {selector},
    website_task_target_choice: buildTaskTargetChoiceAnswer(selector, question, otherCandidate
      ? {kind: 'other_candidate', candidate_id: 'cfedcba9876543210'} : {kind: 'none_of_these'}, '2026-10-29T00:00:00Z'),
    originalAllowance: {id: 'same', maximum: 15}});
}
const selectBody = (row: { id: string; revision: string }) => ({ proposalId: row.id, expectedRevision: row.revision, authorized: true });
const reportBody = (row: { id: string; revision: string }) => ({ ...selectBody(row), summary: "The site trial completed.", metCriteria: true,
  measuredUnitsPerHour: 60, interventionsPerHour: 1, notes: "Owner-reported operating observation." });

describe("job workflow authority and durable decisions", () => {
  it("shows diagnostic screening on a proposed task without inventing a delivery proposal", async () => {
    const { publication, job, brief, intake } = screeningFixture(true);
    state.docs.set("inboundRequests/job-one", job);
    state.docs.set("siteTaskBriefs/job-one", brief);
    state.docs.set("taskEvaluationSceneIntakes/intake-one", intake);
    const { ingestBetaPolicyScreening } = await import("../utils/betaPolicyScreeningIngest");
    await ingestBetaPolicyScreening(publication);
    const view = await api(`/owner/${token("job-one")}`);
    expect(view.status).toBe(200);
    expect(view.body.briefAgreed).toBe(false);
    expect(view.body.managedEvidence?.[0]).toMatchObject({ current: true, state: "queued", resultDigest: null });
    expect(view.body.managedEvidence?.[0].screening?.candidates).toHaveLength(36);
    expect(view.body.proposals).toEqual([]);
    rejectSelection('job-one', job.website_scene_sponsorship.task_context_digest);
    const rejected = await api(`/owner/${token('job-one')}`);
    expect(rejected.status).toBe(200);
    expect(rejected.body.managedEvidence?.[0]).toMatchObject({current: false, state: 'queued'});
  });

  it('keeps rejected-object proposals in history and rejects selecting their old scope', async () => {
    const row = await publish();
    rejectSelection('job-1');
    const view = await owner();
    expect(view.status).toBe(200);
    expect(view.body.proposals[0]).toMatchObject({id: row.id, status: 'review_required'});
    expect(view.body.actionOwner).toBe('blueprint');
    expect(view.body.nextAction).toMatch(/saved video/);
    expect((await owner('/select', 'POST', selectBody(row))).status).toBe(409);
    expect(state.docs.get('inboundRequests/job-1')?.job_marketplace.proposals[0]).toMatchObject({id: row.id, status: 'available'});
    expect(state.docs.get('captureUploadSessions/walkthrough-job-1')?.originalAllowance).toEqual({id: 'same', maximum: 15});
  });

  it('binds unreferenced proposals to B and releases only its current corrected intake', async () => {
    const old = await publish();
    rejectSelection('job-1', undefined, true);
    const before = await owner();
    expect(before.body.proposals[0]).toMatchObject({id: old.id, status: 'review_required'});
    expect((await owner('/select', 'POST', selectBody(old))).status).toBe(409);
    // A reviewed B proposal can be prepared while reconstruction continues;
    // it cannot be selected against A's intake or the absence of B's intake.
    const revised = await admin(`/proposals/${old.id}`, 'PUT', {...proposal, expectedRevision: old.revision});
    expect(revised.status).toBe(200);
    const b = revised.body.proposals[0];
    expect(b.briefRevision).not.toBe(old.briefRevision);
    expect((await owner('/select', 'POST', selectBody(b))).status).toBe(409);
    const session = state.docs.get('captureUploadSessions/walkthrough-job-1')!;
    const correction = taskTargetSelection(session).correctionsDigest;
    const currentIntake = {website_request_id: 'job-1', source_session_id: 'walkthrough-job-1', state: 'completed',
      request: {task: {task_id: `website-${session.website_preparation.selector.task_context_digest.slice(7, 27)}`,
        subject: {website_preparation_revision: {capture_id: 'walkthrough-job-1', corrections_digest: correction}}}}};
    state.docs.set('taskEvaluationSceneIntakes/old-a', {...currentIntake, request: {task: {task_id: currentIntake.request.task.task_id}}});
    expect((await owner('/select', 'POST', selectBody(b))).status).toBe(409);
    state.docs.set('taskEvaluationSceneIntakes/b', currentIntake);
    expect((await owner()).body.proposals[0]).toMatchObject({id: b.id, status: 'available'});
    expect((await owner('/select', 'POST', selectBody(old))).status).toBe(409);
    expect((await owner('/select', 'POST', selectBody(b))).status).toBe(200);
    expect(state.docs.get('captureUploadSessions/walkthrough-job-1')?.originalAllowance).toEqual({id: 'same', maximum: 15});
  });

  it('does not record an A agreement from an earlier selection while B is pending', async () => {
    const old = await publish();
    expect((await owner('/select', 'POST', selectBody(old))).status).toBe(200);
    rejectSelection('job-1', undefined, true);
    const response = await admin('/agreement', 'POST', {proposalId: old.id, expectedRevision: old.revision,
      agreedAtIso: '2026-10-20T10:00:00Z', plannedStartIso: null, siteAgreementReference: 'recorded-site-agreement',
      providerAgreementReference: 'recorded-provider-agreement', outcomeRecordingAuthorized: false});
    expect(response.status).toBe(409);
    expect(state.docs.get('inboundRequests/job-1')?.job_marketplace.agreement).toBeNull();
    expect(state.docs.get('inboundRequests/job-1')?.job_marketplace.selection).toMatchObject({proposalId: old.id});
  });

  it("lets a guest review and choose an exact scoped proposal without confirming the draft", async () => {
    const record = state.docs.get("inboundRequests/job-1")!;
    state.docs.set("inboundRequests/job-1", { ...record, account_owner_uid: null });
    const brief = { ...state.docs.get("siteTaskBriefs/job-1"), confirmedAtIso: null, confirmedBy: null };
    state.docs.set("siteTaskBriefs/job-1", brief);
    const waiting = await owner();
    expect(waiting.status).toBe(200);
    expect(waiting.body).toMatchObject({ briefAgreed: false, actionOwner: "blueprint" });
    const published = await admin("/proposals", "POST", proposal);
    expect(published.status).toBe(201);
    expect(published.body).toMatchObject({ briefAgreed: false, stage: "proposals_ready", actionOwner: "site" });
    const row = published.body.proposals[0];
    expect(row.scope).toBe(proposal.scope);
    expect(row.evidence).toEqual(proposal.evidence);
    const selected = await owner("/select", "POST", selectBody(row));
    expect(selected.status).toBe(200);
    expect(selected.body.selection).toMatchObject({ proposalId: row.id, proposalRevision: row.revision });
    expect(selected.body.briefAgreed).toBe(false);
    expect(selected.body.agreement).toBeNull();
    expect(selected.body.outcome).toBeNull();
    expect(state.docs.get("siteTaskBriefs/job-1")).toEqual(brief);
    state.docs.set("siteTaskBriefs/job-1", { ...brief, summary: "Move cases into a different workcell" });
    expect((await owner()).body.proposals[0].status).toBe("review_required");
    expect((await owner("/select", "POST", selectBody(row))).body.code).toBe("brief_changed");
  });
  it("rejects anonymous/nonstaff admin access, forged and film-only links, and missing CSRF", async () => {
    expect((await api("/admin/job-1")).status).toBe(401);
    expect((await api("/admin/job-1", "GET", undefined, "ordinary-token")).status).toBe(403);
    expect((await api("/owner/forged")).status).toBe(403);
    expect((await api(`/owner/${token("job-1", "film")}`)).status).toBe(403);
    const response = await fetch(`${base}/owner/${token()}/requirements`, { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" });
    expect(response.status).toBe(403);
    expect(state.docs.get("inboundRequests/job-1")?.job_marketplace).toBeUndefined();
  });

  it("retains optional stated requirements without leaking private record fields", async () => {
    const initial = await owner();
    expect(initial.body.requirements.jobFrequency).toBe("Every shift");
    expect(initial.body.requirements.purchaseReadiness).toBe("planning");
    expect(initial.body.stage).toBe("brief_agreed");
    expect(initial.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(initial.body)).not.toMatch(/PRIVATE_|updatedBy|contact/);
    const saved = await owner("/requirements", "PATCH", { ongoingBudget: "Not sure yet", purchaseReadiness: "exploring" });
    expect(saved.status).toBe(200);
    expect(saved.body.requirements.ongoingBudget).toBe("Not sure yet");
    expect(saved.body.proposals).toEqual([]);
    expect((await owner("/requirements", "PATCH", { purchaseReadiness: "funded_automatically" })).status).toBe(400);
    expect((await owner("/requirements", "PATCH", { installationBudget: "x".repeat(501) })).status).toBe(400);
    expect(state.docs.get("inboundRequests/job-1")?.pilot_booking).toBeUndefined();
  });

  it("requires the customer to select an exact reviewed quote and records agreements separately", async () => {
    const row = await publish();
    expect((await owner("/select", "POST", { ...selectBody(row), expectedRevision: "0".repeat(64) })).status).toBe(409);
    expect((await api(`/owner/${token("job-2")}/select`, "POST", selectBody(row))).status).toBe(409);
    expect((await admin("/agreement", "POST", { proposalId: row.id, expectedRevision: row.revision, agreedAtIso: "2026-10-20T12:00:00.000Z",
      plannedStartIso: null, siteAgreementReference: "Site signed quote", providerAgreementReference: "Provider signed quote" })).body.code).toBe("selection_required");
    const selected = await owner("/select", "POST", selectBody(row));
    expect(selected.status).toBe(200);
    expect(selected.body.selection?.proposalId).toBe(row.id);
    expect(selected.body.agreement).toBeNull();
    expect(selected.body.stage).toBe("proposals_ready");
    expect((await owner("/outcome", "POST", reportBody(row))).body.code).toBe("pilot_agreement_required");
    expect((await admin(`/proposals/${row.id}`, "PUT", { ...proposal, expectedRevision: row.revision })).body.code).toBe("proposal_selected");
    expect((await admin(`/proposals/${row.id}/withdraw`, "POST", { expectedRevision: row.revision })).body.code).toBe("proposal_selected");
    const agreed = await admin("/agreement", "POST", { proposalId: row.id, expectedRevision: row.revision, agreedAtIso: "2026-10-20T12:00:00.000Z",
      plannedStartIso: "2026-11-01T12:00:00.000Z", siteAgreementReference: "Site signed quote reference", providerAgreementReference: "Provider signed quote reference",
      outcomeRecordingAuthorized: true, outcomeRecordingPermissionReference: "Both parties' signed outcome-recording permission" });
    expect(agreed.status).toBe(200); expect(agreed.body.stage).toBe("pilot_agreed");
    // Historical commitments stay visible even if their video cannot be read.
    captures.received = null;
    state.docs.set("siteTaskBriefs/job-1", { ...state.docs.get("siteTaskBriefs/job-1"),
      confirmedAtIso: "2026-10-21T10:00:00.000Z", confirmedBy: "Another authorized site owner", draftedAtIso: "2026-10-21T09:00:00.000Z" });
    const reconfirmed = await owner();
    expect(reconfirmed.body.stage).toBe("pilot_agreed");
    expect(reconfirmed.body.proposals[0].status).toBe("available");
    expect(reconfirmed.body.agreement).toEqual(agreed.body.agreement);
    expect((await owner("/requirements", "PATCH", { ongoingBudget: "Changed after agreement" })).body.code).toBe("pilot_already_agreed");
    const reported = await owner("/outcome", "POST", reportBody(row));
    expect(reported.status).toBe(200); expect(reported.body.outcome?.source).toBe("customer_reported");
    expect(reported.body.stage).toBe("results_recorded");
    const record: any = state.docs.get("inboundRequests/job-1");
    expect(record.pilot_booking).toBeUndefined(); expect(record.physical_outcome_join).toBeUndefined();
    expect(record.job_marketplace.outcome.summary).toBe("The site trial completed.");
    expect([...state.docs.keys()].filter(key => key.includes("jobWorkflowEvents/"))).toHaveLength(4);
  });

  it("requires separate recorded permission to report outcomes, including for legacy agreements", async () => {
    const row = await publish(); await owner("/select", "POST", selectBody(row));
    const agreement = { proposalId: row.id, expectedRevision: row.revision, agreedAtIso: "2026-10-20T12:00:00.000Z",
      plannedStartIso: null, siteAgreementReference: "Site signed scope", providerAgreementReference: "Provider signed scope" };
    expect((await admin("/agreement", "POST", { ...agreement, outcomeRecordingAuthorized: true })).status).toBe(400);
    const agreed = await admin("/agreement", "POST", agreement);
    expect(agreed.status).toBe(200); expect(agreed.body.agreement?.outcomeRecordingAuthorized).toBe(false);
    expect((await owner("/outcome", "POST", reportBody(row))).body.code).toBe("outcome_permission_required");
    expect((await owner()).body.outcome).toBeNull();
  });

  it("invalidates proposals when requirements or the confirmed brief change", async () => {
    const row = await publish();
    state.docs.set("siteTaskBriefs/job-1", { ...state.docs.get("siteTaskBriefs/job-1"),
      confirmedAtIso: "2026-10-21T10:00:00.000Z", confirmedBy: "Another authorized site owner" });
    expect((await owner()).body.proposals[0].status).toBe("available");
    await owner("/select", "POST", selectBody(row));
    const changed = await owner("/requirements", "PATCH", { requiredOutput: "Now requires twice the original output" });
    expect(changed.body.proposals[0].status).toBe("review_required");
    expect(changed.body.reviewRequired).toBe(true); expect(changed.body.stage).toBe("brief_agreed");
    expect((await owner("/select", "POST", selectBody(row))).body.code).toBe("brief_changed");
    const revised = await admin(`/proposals/${row.id}`, "PUT", { ...proposal, deliveryCommitment: "Revised performance commitment", expectedRevision: row.revision });
    expect(revised.status).toBe(200); expect(revised.body.selection).toBeNull();
    expect(revised.body.proposals[0].revision).not.toBe(row.revision);
    expect(revised.body.proposals[0].status).toBe("available");
    state.docs.set("siteTaskBriefs/job-1", { summary: "A changed unconfirmed job", confirmedAtIso: null });
    const waiting = await owner(); expect(waiting.body.stage).toBe("job_submitted");
    expect(waiting.body.proposals[0]).toMatchObject({ id: row.id, status: "review_required" });
    expect(waiting.body.selection).toBeNull();
  });

  it("idempotently publishes quotes and rejects concurrent stale edits", async () => {
    const key = "quote-request-1";
    const first = await admin("/proposals", "POST", proposal, { "Idempotency-Key": key });
    const repeated = await admin("/proposals", "POST", proposal, { "Idempotency-Key": key });
    expect(repeated.body.proposals).toHaveLength(1);
    expect(repeated.body.revision).toBe(first.body.revision);
    expect((await admin("/proposals", "POST", { ...proposal, installationCostUsd: 12000 }, { "Idempotency-Key": key })).body.code).toBe("idempotency_conflict");
    const row = first.body.proposals[0];
    const revisions = await Promise.all([11000, 12000].map(installationCostUsd => admin(`/proposals/${row.id}`, "PUT", { ...proposal, installationCostUsd, expectedRevision: row.revision })));
    expect(revisions.map(result => result.status).sort()).toEqual([200, 409]);
    const event = [...state.docs.entries()].find(([path]) => path.includes("jobWorkflowEvents/"))![1];
    expect(event).not.toHaveProperty("before.proposals"); expect(event).toHaveProperty("changedProposals");
  });

  it("blocks revoked jobs and conflicting legacy pilot selections", async () => {
    const row = await publish();
    const record: any = state.docs.get("inboundRequests/job-1");
    state.docs.set("inboundRequests/job-1", { ...record, pilot_booking: { recommendationId: "legacy-rec" } });
    expect((await owner("/select", "POST", selectBody(row))).body.code).toBe("pilot_selection_conflict");
    state.docs.set("inboundRequests/job-1", { ...record, consent_revoked: true });
    expect((await owner()).body.code).toBe("capture_processing_not_authorized");
    expect((await admin()).status).toBe(409);
    expect((await owner("/requirements", "PATCH", { ongoingBudget: "1000" })).status).toBe(409);
  });

  it("does not advance from unconfirmed or malformed stored downstream facts", () => {
    const record = { request: { buyerType: "site_operator" }, job_marketplace: { schemaVersion: "job_marketplace.v1",
      proposals: [], selection: { proposalId: "made-up", proposalRevision: "0".repeat(64), selectedAtIso: "2026-10-20T12:00:00.000Z" },
      agreement: { proposalId: "made-up" }, outcome: { metCriteria: true } } };
    const projected = projectJobMarketplace(record, null);
    expect(projected.stage).toBe("job_submitted"); expect(projected.selection).toBeNull();
    expect(projected.agreement).toBeNull(); expect(projected.outcome).toBeNull();
  });

  it("requires a retained video before advancing a written brief to assessment or a deployment proposal", async () => {
    captures.received = false;
    const record = state.docs.get("inboundRequests/job-1")!;
    state.docs.set("inboundRequests/job-1", { ...record, request: { ...record.request, hasExistingFootage: true } });
    const draft = await owner();
    expect(draft.body.stage).toBe("job_submitted");
    expect(draft.body.briefAgreed).toBe(false);
    expect(draft.body.nextAction).toMatch(/Record or upload a video/);
    expect((await admin("/review", "POST", { disposition: "options_identified", summary: "Written scope", nextAction: "Compare options" })).body.code).toBe("video_required");
    expect((await admin("/proposals", "POST", proposal)).body.code).toBe("video_required");
    expect(state.docs.get("inboundRequests/job-1")?.job_marketplace).toBeUndefined();
    captures.received = true;
    const row = await publish();
    captures.received = false;
    expect((await owner("/select", "POST", selectBody(row))).body.code).toBe("video_required");
    expect((await owner()).body.proposals).toEqual([]);
    captures.received = null;
    expect((await admin("/review", "POST", { disposition: "more_information", summary: "Video status unknown", nextAction: "Retry" })).status).toBe(503);
    expect((await owner()).body.nextAction).toMatch(/could not read your recording status/);
  });
});
