// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore }));
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: async (value: string) => value }));
vi.mock("../utils/robotTeamAccounts", () => ({ teamAccountUid: async () => "owner" }));
vi.mock("../utils/teamEvaluationSelection", () => ({ TEAM_EVALUATION_PROVIDER_CAP_USD: 20 }));
const prepare = vi.hoisted(() => vi.fn());
vi.mock("../utils/selfServeAgentExecution", () => ({ prepareFreeAgentExecution: prepare }));
const admission = vi.hoisted(() => vi.fn());
vi.mock("../utils/agentExecutionAdmission", async () => {
  const { createHash } = await import("node:crypto");
  const canonicalJson = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
    return JSON.stringify(value);
  };
  return { discoverAgentExecutionAdmission: admission, canonicalJson,
    agentExecutionAdmissionDigest: (value: unknown) => `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}` };
});
import { admitFreeWorkspaceEvaluation } from "../utils/freeEvaluationHandoff";
import { canDispatchFreeBetaRun } from "../utils/freeBeta";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { listedTaskCard } from "./helpers/listedTaskCard";

const command = () => ({ teamId: "team", checkpointId: "checkpoint", executionRequestId: "prepared",
  episodes: 1, sponsorCapUsd: 10, maxAttempts: 1, evidenceScope: "development_only",
  expiresAtIso: new Date(Date.now() + 600_000).toISOString() });
/** A site job approved robot teams may request an evaluation on (`teamJobAccess`). */
const openJob = () => ({
  request: { buyerType: "site_operator", capture_mode: "self_capture", consent_attestation: {
    granted: true, statement_version: RECORDING_CONSENT_VERSION,
    recorded_at_iso: "2026-10-01T00:00:00Z",
  } },
  siteTaskGates: { sceneStability: "stable", taskShape: "single", objectVariety: "under_10",
    deploymentTimeline: "this_quarter", accessWindow: "scheduled" },
  site_task_triage: { disposition: "qualified" }, site_task_brief_confirmed_at: "2026-10-01T00:00:00Z",
  public_task_listing: listedTaskCard(),
  pipeline: { artifacts: { worldlabs_world_manifest_uri: "gs://fixture/world.json" } },
  evaluation_readiness: { runtime_launchable: true, benchmark_coverage_status: "ready" },
});
beforeEach(() => {
  state.docs.clear(); admission.mockReset(); prepare.mockReset();
  state.docs.set("inboundRequests/scene", openJob());
  state.docs.set("robotTeams/team", { accountUid: "owner" });
  state.docs.set("inboundRequests/application", { account_owner_uid: "owner",
    workspace_evaluation: { opportunityId: "scene", setupId: "setup" } });
  state.docs.set("users/owner/robotSetups/setup", { payload: JSON.stringify({ reference: "https://policy.test/action", version: "v1" }) });
  state.docs.set("robotCheckpoints/checkpoint", { teamId: "team", reference: "https://policy.test/action" });
  state.docs.set("robotEvalJobRequests/prepared", { buyer_user_id: "owner" });
  admission.mockResolvedValue({ admitted: true, digestSha256: "sha256:" + "a".repeat(64),
    envelope: { binding: { capture_id: "capture", task_family: "pick_place" },
      canonical_execution_request: { execution_authorization: { max_cost_usd: 10, episodes: 1 } } } });
});
describe("operator-approved workspace handoff", () => {
  it.each([
    {},
    { request: { consent_attestation: { granted: false, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z" } } },
    { request: { consent_attestation: { granted: true, statement_version: "old", recorded_at_iso: "2026-10-01T00:00:00Z" } } },
    { request: { consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2099-01-01T00:00:00Z" } } },
    { request: { consent_attestation: { granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z", withdrawn_at_iso: "2026-10-02T00:00:00Z" } } },
  ])("refuses prepared requests without a current recording grant: %j", async scene => {
    state.docs.set("inboundRequests/scene", scene);
    await expect(admitFreeWorkspaceEvaluation("application", command(), "operator")).rejects.toThrow("scene_authority_unavailable");
    expect(admission).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect([...state.docs.keys()].some(key => key.startsWith("evaluationRuns/"))).toBe(false);
  });
  it.each([
    ["kept private", { public_task_listing: { enabled: false } }],
    ["paused by the site", { workspace_task: { paused: true } }],
    ["rights held by the Pipeline review", { evaluation_readiness: { runtime_launchable: true, benchmark_coverage_status: "ready", rights_review_status: "needs_review" } }],
    ["development only", { evidence_tier: "development_only" }],
    ["no longer runnable", { evaluation_readiness: { runtime_launchable: false } }],
  ])("refuses a job no longer open to robot teams (%s), by the rule the team requested under", async (_label, patch) => {
    state.docs.set("inboundRequests/scene", { ...openJob(), ...patch });
    await expect(admitFreeWorkspaceEvaluation("application", command(), "operator")).rejects.toThrow("free_evaluation_job_not_open");
    expect(admission).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect([...state.docs.keys()].some(key => key.startsWith("evaluationRuns/"))).toBe(false);
  });
  it.each(["root", "request", "capture_rights"])("honours the current %s revocation on an idempotent approval", async layer => {
    const input = command();
    await admitFreeWorkspaceEvaluation("application", input, "operator");
    const scene = state.docs.get("inboundRequests/scene")!;
    const rights = layer === "root" ? scene : (scene[layer] ??= {});
    rights.future_processing_allowed = false;
    admission.mockClear();
    await expect(admitFreeWorkspaceEvaluation("application", input, "operator")).rejects.toThrow("scene_authority_unavailable");
    expect(admission).not.toHaveBeenCalled();
    expect([...state.docs.keys()].filter(key => key.startsWith("evaluationRuns/"))).toHaveLength(1);
  });
  it("refuses a revocation arriving during an idempotent approval", async () => {
    const input = command();
    await admitFreeWorkspaceEvaluation("application", input, "operator");
    const accepted = await admission.mock.results[0].value;
    admission.mockImplementationOnce(async () => {
      state.docs.get("inboundRequests/scene")!.request.consent_attestation.granted = false;
      return accepted;
    });
    await expect(admitFreeWorkspaceEvaluation("application", input, "operator")).rejects.toThrow("source_changed");
    expect([...state.docs.keys()].filter(key => key.startsWith("evaluationRuns/"))).toHaveLength(1);
  });
  it("atomically links one free run, preserving a separate signed sponsor cap", async () => {
    const input = command();
    const first = await admitFreeWorkspaceEvaluation("application", input, "operator");
    expect(first.created).toBe(true);
    const run = state.docs.get(`evaluationRuns/${first.runId}`)!;
    expect(canDispatchFreeBetaRun(run)).toBe(true);
    expect(run.quotedUsd).toBe(0);
    expect(run.executionAdmission.envelope.funding.cap_usd).toBe(10);
    expect(run.executionAdmission.envelope.evidence_scope).toBe("development_only");
    expect(state.docs.get("inboundRequests/application")?.free_evaluation_handoff.runId).toBe(first.runId);
    expect(await admitFreeWorkspaceEvaluation("application", input, "operator")).toEqual({ ...first, created: false });
    expect([...state.docs.keys()].filter(key => key.startsWith("evaluationRuns/"))).toHaveLength(1);
    expect([...state.docs.keys()].some(key => /ledger|entitlement/i.test(key))).toBe(false);
    await expect(admitFreeWorkspaceEvaluation("application", { ...input, sponsorCapUsd: 11 }, "operator")).rejects.toThrow("conflict");
  });
  it.each([0, -1, 21, Infinity])("refuses an invalid sponsor cap %s", async sponsorCapUsd => {
    await expect(admitFreeWorkspaceEvaluation("application", { ...command(), sponsorCapUsd }, "operator")).rejects.toThrow();
    expect(admission).not.toHaveBeenCalled();
  });
  it("requires a current approval and exactly one attempt", async () => {
    for (const invalid of [{ expiresAtIso: "2020-01-01T00:00:00Z" }, { maxAttempts: 2 }, { evidenceScope: "partner_proof" }]) {
      await expect(admitFreeWorkspaceEvaluation("application", { ...command(), ...invalid }, "operator")).rejects.toThrow();
    }
    expect(admission).not.toHaveBeenCalled();
  });
  it("refuses cross-team policy, owner, and changed-source admission", async () => {
    state.docs.set("robotCheckpoints/checkpoint", { teamId: "another", reference: "https://policy.test/action" });
    await expect(admitFreeWorkspaceEvaluation("application", command(), "operator")).rejects.toThrow("policy_mismatch");
    state.docs.set("robotCheckpoints/checkpoint", { teamId: "team", reference: "https://policy.test/action" });
    state.docs.set("robotEvalJobRequests/prepared", { buyer_user_id: "another" });
    await expect(admitFreeWorkspaceEvaluation("application", command(), "operator")).rejects.toThrow("owner_mismatch");
    state.docs.set("robotEvalJobRequests/prepared", { buyer_user_id: "owner" });
    admission.mockImplementation(async () => {
      state.docs.set("robotCheckpoints/checkpoint", { teamId: "team", reference: "https://changed.test/action" });
      return { admitted: true, digestSha256: "d", envelope: { binding: {} } };
    });
    await expect(admitFreeWorkspaceEvaluation("application", command(), "operator")).rejects.toThrow("source_changed");
    expect([...state.docs.keys()].some(key => key.startsWith("evaluationRuns/"))).toBe(false);
  });
  it("refuses a team evaluation of a policy it cannot call, and any prepared request that is not one", async () => {
    state.docs.set("inboundRequests/scene", { ...openJob(),
      agent_execution_offer: { policy_execution_profiles: ["team_evaluation_scored_v1"], episode_count: 200 } });
    state.docs.set("robotCheckpoints/checkpoint", { teamId: "team", reference: "https://policy.test/action", runtime: "policy_endpoint" });
    await expect(admitFreeWorkspaceEvaluation("application", command(), "operator"))
      .rejects.toThrow("team_evaluation_policy_credential_required");
    expect(admission).not.toHaveBeenCalled();
    // An authenticated HTTPS policy, but an operator-supplied request prepared on the unscored path.
    state.docs.set("robotCheckpoints/checkpoint", { teamId: "team", reference: "https://policy.test/action",
      runtime: "policy_endpoint", policyCredential: { ref: "credential-1", kind: "bearer", expiresAtIso: "2100-01-01T00:00:00Z" } });
    await expect(admitFreeWorkspaceEvaluation("application", command(), "operator"))
      .rejects.toThrow("free_evaluation_team_evaluation_required");
    expect([...state.docs.keys()].some(key => key.startsWith("evaluationRuns/"))).toBe(false);
  });
  it("preserves the existing admission refusal without manufacturing missing facts", async () => {
    admission.mockResolvedValue({ admitted: false, blockers: ["agent_execution_testbed_digest_mismatch"] });
    await expect(admitFreeWorkspaceEvaluation("application", command(), "operator")).rejects.toThrow("testbed_digest_mismatch");
  });
});

it("prepares the existing canonical request when the operator does not supply one", async () => {
  prepare.mockResolvedValue({ prepared: true, requestId: "prepared", created: true });
  const input = command();
  const { executionRequestId, ...approval } = input;
  prepare.mockImplementation(async () => ({ prepared: true, requestId: executionRequestId, created: true }));
  const result = await admitFreeWorkspaceEvaluation("application", approval, "operator");
  expect(result.created).toBe(true);
  expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ submissionKey: "free:application", quotedUsd: 10 }),
    { approvedBy: "operator", expiresAtIso: input.expiresAtIso });
});

it.each(["scene", "team"])("refuses a concurrent %s authority change after admission", async changed => {
  admission.mockImplementationOnce(async () => {
    if (changed === "scene") state.docs.get("inboundRequests/scene")!.consent_revoked = true;
    else state.docs.get("robotTeams/team")!.accountUid = "another-owner";
    return { admitted: true, digestSha256: "d", envelope: { binding: { capture_id: "capture", task_family: "pick_place" } } };
  });
  await expect(admitFreeWorkspaceEvaluation("application", command(), "operator")).rejects.toThrow("source_changed");
  expect([...state.docs.keys()].some(key => key.startsWith("evaluationRuns/"))).toBe(false);
});
