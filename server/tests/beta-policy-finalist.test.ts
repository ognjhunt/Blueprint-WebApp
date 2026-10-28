// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore }));
const access = vi.hoisted(() => vi.fn());
vi.mock("../utils/access-control", () => ({ resolveExecutionAccessContext: access }));
import { screeningFixture, screeningSha, sealScreening } from "./fixtures/beta-policy-screening";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { ingestBetaPolicyScreening } from "../utils/betaPolicyScreeningIngest";
import { admitBetaPolicyFinalist, finalistIdForRequest, parseFinalistReceipt, processBetaPolicyFinalistQueue } from "../utils/betaPolicyFinalist";
import { loadManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { scientificBriefDigest } from "../utils/jobEvidenceContract";

function completeScreening() {
  const fx = screeningFixture();
  const publication = sealScreening({ ...fx.publication, status: "completed", candidates: [
    { ...fx.publication.candidates[0], status: "completed", episodes_scored: 3,
      episodes_succeeded: 2, episodes_failed: 1, success_rate: 2 / 3, session_result_digest: screeningSha("7") },
  ] });
  return { ...fx, publication };
}
function rows() { return [...state.docs.values()].filter(row => row.run_kind === "beta_policy_finalist"); }
function receipt(row: any, status = "awaiting_owner_authority") {
  return { schema_version: "beta_policy_finalist_receipt.v1", finalist_id: row.run_id,
    plan_digest: screeningSha("2"), state: status, source: row.finalist_source,
    job_id: row.finalist_request.job_id, brief_digest: row.finalist_request.brief_digest,
    source_fingerprint: row.finalist_request.source_fingerprint, candidate_id: row.finalist_request.candidate_id,
    maximum_planned_cost_usd: "10.00", episodes: 200, recommendation_eligible: false, provider_mutation_performed: false, paid_execution_requested: false,
    ...(row.finalist_owner_authority_digest ? { owner_authority_digest: row.finalist_owner_authority_digest } : {}) };
}
async function prepared() {
  await ingestBetaPolicyScreening(completeScreening().publication);
  const transport = vi.fn(async () => receipt(rows()[0]));
  await processBetaPolicyFinalistQueue(10, transport);
  return rows()[0] as any;
}
function command(row: any) {
  return { finalistId: row.run_id, planDigest: row.finalist_preparation.plan_digest,
    episodes: 200, sponsorCapUsd: 12, expiresAtIso: new Date(Date.now() + 600_000).toISOString(),
    maxAttempts: 1, evidenceScope: "development_only" };
}
beforeEach(() => {
  state.docs.clear(); access.mockResolvedValue({ isOps: true });
  const { job, brief, intake } = completeScreening();
  state.docs.set("inboundRequests/job-one", job);
  state.docs.set("siteTaskBriefs/job-one", brief);
  state.docs.set("taskEvaluationSceneIntakes/intake-one", intake);
});

it("retains no-spend continuation in the screening transaction and reuses it through budget-only updates", async () => {
  const { publication } = completeScreening();
  await ingestBetaPolicyScreening(publication);
  expect(rows()).toHaveLength(1);
  const row = rows()[0] as any;
  expect(row.run_id).toBe(finalistIdForRequest(row.finalist_request));
  expect(row.finalist_state).toBe("preparation_pending");
  expect(row.finalist_authority).toBeUndefined();
  const transport = vi.fn(async (path, body) => {
    expect(path).toBe(""); expect(body).toEqual(row.finalist_request);
    return receipt(row);
  });
  expect(await processBetaPolicyFinalistQueue(10, transport)).toEqual({ processed: 1 });
  expect(rows()[0].finalist_state).toBe("awaiting_owner_authority");
  expect(rows()[0].finalist_forward_pending).toBe(false);
  await ingestBetaPolicyScreening(publication);
  await ingestBetaPolicyScreening(sealScreening({ ...publication, revision: 2,
    budget: { ...publication.budget, committed_upper_bound_usd: "1", reserved_usd: "1" } }));
  expect(rows()).toHaveLength(1);
  expect(rows()[0].finalist_request).toEqual(row.finalist_request);
  expect(await processBetaPolicyFinalistQueue(10, transport)).toEqual({ processed: 0 });
  expect(transport).toHaveBeenCalledTimes(1);
});

it("closes the actual preparation, named owner approval, durable authorization and same-job full-result loop", async () => {
  const row = await prepared();
  const approved = command(row);
  expect(await admitBetaPolicyFinalist("job-one", approved, "founder-uid")).toMatchObject({ created: true, runId: row.run_id });
  const retained = rows()[0] as any;
  expect(retained.finalist_authority.approved_by).toBe("founder-uid");
  expect(retained.finalist_owner_authority_digest).toBe(crossRuntimeDigest(retained.finalist_authority));
  const transport = vi.fn(async (path, body) => {
    expect(path).toBe(`/${row.run_id}/authorize`);
    expect(body).toEqual(retained.finalist_authority);
    return receipt(retained, "authorized");
  });
  await processBetaPolicyFinalistQueue(10, transport);
  expect(rows()[0].finalist_state).toBe("authorized");
  const final = sealScreening({ ...completeScreening().publication, campaign_id: row.run_id,
    purpose: "finalist", plan_digest: screeningSha("3"), scenario_plan_digest: screeningSha("4"),
    finalist_binding: { finalist_id: row.run_id, screening_campaign_id: row.finalist_request.campaign_id,
      screening_publication_digest: row.finalist_request.publication_digest,
      job_id: row.finalist_request.job_id, brief_digest: row.finalist_request.brief_digest,
      source_fingerprint: row.finalist_request.source_fingerprint,
      owner_authority_digest: retained.finalist_owner_authority_digest },
    candidates: [{ ...completeScreening().publication.candidates[0], episodes_planned: 200, episodes_scored: 200,
      episodes_succeeded: 180, episodes_failed: 20, success_rate: 0.9, session_result_digest: screeningSha("5") }],
    budget: { currency: "USD", limit_usd: "12.00", committed_upper_bound_usd: "11", spent_upper_bound_usd: "11", reserved_usd: "0" },
  });
  (rows()[0] as any).finalist_next_at_ms = 0;
  await processBetaPolicyFinalistQueue(10, async (path, body) => {
    expect(path).toBe(`/${row.run_id}`); expect(body).toBeUndefined();
    return { ...receipt(retained, "completed"), publication: final };
  });
  const current = rows()[0] as any;
  expect(current.state).toBe("completed"); expect(current.finalist_forward_pending).toBe(false);
  expect(current.finalist_authority).toEqual(retained.finalist_authority);
  expect(current.job_evidence_binding.job_id).toBe("job-one");
  const brief = state.docs.get("siteTaskBriefs/job-one")!;
  const projected = (await loadManagedJobEvidence("job-one", scientificBriefDigest(brief))).find(item => item.runId === row.run_id)!;
  expect(projected.current).toBe(true); expect(projected.summary).toMatch(/Full finalist scoring: 200 of 200/);
  expect(projected.limitations.join(" ")).toMatch(/remains diagnostic/);
  expect(projected.resultDigest).toBe(final.publication_digest);
});

it.each(["job", "plan", "cap", "expired", "episodes", "attempts"])("refuses invalid owner admission (%s) without forwarding", async fault => {
  const row = await prepared(), input = command(row) as any;
  if (fault === "plan") input.planDigest = screeningSha("9");
  if (fault === "cap") input.sponsorCapUsd = 21;
  if (fault === "expired") input.expiresAtIso = "2000-01-01T00:00:00Z";
  if (fault === "episodes") input.episodes = 10;
  if (fault === "attempts") input.maxAttempts = 2;
  await expect(admitBetaPolicyFinalist(fault === "job" ? "another-job" : "job-one", input, "owner")).rejects.toThrow();
  expect(rows()[0].finalist_authority).toBeUndefined();
});

it("does not dispatch with revoked processing rights, changed selected recording or removed execution claims", async () => {
  const row = await prepared();
  await admitBetaPolicyFinalist("job-one", command(row), "owner");
  access.mockResolvedValue({ isOps: false });
  const network = vi.fn();
  await processBetaPolicyFinalistQueue(10, network);
  expect(network).not.toHaveBeenCalled(); expect(rows()[0].finalist_state).toBe("blocked");
  state.docs.clear();
  const fx = completeScreening();
  state.docs.set("inboundRequests/job-one", fx.job); state.docs.set("siteTaskBriefs/job-one", fx.brief);
  state.docs.set("taskEvaluationSceneIntakes/intake-one", fx.intake);
  await ingestBetaPolicyScreening(fx.publication);
  state.docs.get("inboundRequests/job-one")!.active_capture_id = "supplement-new";
  await processBetaPolicyFinalistQueue(10, network);
  expect(network).not.toHaveBeenCalled(); expect(rows()[0].state).toBe("blocked");
});

it("refuses changed receipt identities and unapproved full publications", async () => {
  const row = await prepared();
  expect(() => parseFinalistReceipt({ ...receipt(row), source_fingerprint: screeningSha("9") }, row)).toThrow("binding_invalid");
  const unsigned = sealScreening({ ...completeScreening().publication, campaign_id: row.run_id,
    purpose: "finalist", finalist_binding: { finalist_id: row.run_id, screening_campaign_id: row.finalist_request.campaign_id,
      screening_publication_digest: row.finalist_request.publication_digest, job_id: "job-one",
      brief_digest: row.finalist_request.brief_digest, source_fingerprint: row.finalist_request.source_fingerprint,
      owner_authority_digest: screeningSha("9") },
    candidates: [{ ...completeScreening().publication.candidates[0], episodes_planned: 200, episodes_scored: 200,
      episodes_succeeded: 180, episodes_failed: 20, success_rate: 0.9 }] });
  await expect(ingestBetaPolicyScreening(unsigned)).rejects.toThrow("screening_finalist_authority_mismatch");
  expect(rows()[0].result_record_id).toBeUndefined();
});

it("keeps the terminal delivery pending through a result-store outage and recovers the exact publication", async () => {
  const row = await prepared();
  await admitBetaPolicyFinalist("job-one", command(row), "owner");
  const retained = rows()[0] as any;
  await processBetaPolicyFinalistQueue(10, async () => receipt(retained, "authorized"));
  const final = sealScreening({ ...completeScreening().publication, campaign_id: row.run_id, purpose: "finalist",
    plan_digest: screeningSha("3"), scenario_plan_digest: screeningSha("4"),
    finalist_binding: { finalist_id: row.run_id, screening_campaign_id: row.finalist_request.campaign_id,
      screening_publication_digest: row.finalist_request.publication_digest, job_id: "job-one",
      brief_digest: row.finalist_request.brief_digest, source_fingerprint: row.finalist_request.source_fingerprint,
      owner_authority_digest: retained.finalist_owner_authority_digest },
    candidates: [{ ...completeScreening().publication.candidates[0], episodes_planned: 200, episodes_scored: 200,
      episodes_succeeded: 180, episodes_failed: 20, success_rate: 0.9 }],
    budget: { currency: "USD", limit_usd: "12.00", committed_upper_bound_usd: "11", spent_upper_bound_usd: "11", reserved_usd: "0" },
  });
  const producer = async () => ({ ...receipt(retained, "completed"), publication: final });
  (rows()[0] as any).finalist_next_at_ms = 0;
  const module = await import("../utils/betaPolicyScreeningIngest");
  const unavailable = vi.spyOn(module, "ingestBetaPolicyScreening").mockRejectedValueOnce(new Error("temporary result store outage"));
  await processBetaPolicyFinalistQueue(10, producer);
  expect(rows()[0].finalist_forward_pending).toBe(true);
  expect(rows()[0].result_record_id).toBeUndefined();
  unavailable.mockRestore();
  (rows()[0] as any).finalist_next_at_ms = 0;
  await processBetaPolicyFinalistQueue(10, producer);
  expect(rows()[0].finalist_forward_pending).toBe(false);
  expect(rows()[0].publication_digest).toBe(final.publication_digest);
});
