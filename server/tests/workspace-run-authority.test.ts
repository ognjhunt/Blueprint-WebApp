// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestore as store, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { listedTaskCard } from "./helpers/listedTaskCard";
import { RECORDING_CONSENT_VERSION } from "../utils/recordingConsent";
import { buildPolicyRunLicense } from "../utils/policyRunLicense";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: store,
  default: { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } } }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const notice = vi.hoisted(() => vi.fn());
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: notice, notifyIfNoTeamPassed: vi.fn() }));
const { markRunStarted, heartbeatRun } = await import("../utils/agentEvalRuns");
const claim = { runId: "run", pipelineRunId: "worker", executionAdmissionDigest: `sha256:${"a".repeat(64)}` };
const source = () => state.docs.get("inboundRequests/application") as Record<string, any>;
const run = () => state.docs.get("evaluationRuns/run") as Record<string, any>;
const job = () => state.docs.get("inboundRequests/scene") as Record<string, any>;

beforeEach(() => {
  state.docs.clear(); notice.mockReset(); notice.mockResolvedValue({ enqueued: true });
  const license = buildPolicyRunLicense({ ownerUid: "owner", requestId: "application", opportunityId: "scene",
    setupId: "setup", setup: { reference: "https://policy.example.test", version: "v1" } });
  state.docs.set("inboundRequests/application", { account_owner_uid: "owner", workspace_evaluation: {
    opportunityId: "scene", setupId: "setup", policyRunLicense: structuredClone(license) } });
  state.docs.set("inboundRequests/scene", {
    request: { buyerType: "site_operator", capture_mode: "self_capture", consent_attestation: {
      granted: true, statement_version: RECORDING_CONSENT_VERSION, recorded_at_iso: "2026-10-01T00:00:00Z" } },
    siteTaskGates: { sceneStability: "stable", taskShape: "single", objectVariety: "under_10",
      deploymentTimeline: "this_quarter", accessWindow: "scheduled" },
    site_task_triage: { disposition: "qualified" }, site_task_brief_confirmed_at: "2026-10-01T00:00:00Z",
    public_task_listing: listedTaskCard(), pipeline: { artifacts: { worldlabs_world_manifest_uri: "gs://fixture/world.json" } },
    evaluation_readiness: { runtime_launchable: true, benchmark_coverage_status: "ready" },
  });
  state.docs.set("evaluationRuns/run", { runId: "run", teamId: "team", sceneId: "scene", checkpointId: "checkpoint",
    evaluationPurpose: "pilot", quotedUsd: 0, quotedEpisodes: 200, state: "requested", episodesRun: null,
    moneyResolved: false, dispatchPending: true, requestedAtIso: new Date().toISOString(), settlementDueAtMs: Date.now() + 600_000,
    executionAdmission: { digestSha256: claim.executionAdmissionDigest, envelope: { policy_run_license: license,
      funding: { payer: "blueprint", customer_price_usd: 0, max_attempts: 1, cap_usd: 10,
        approved_by: "operator", approval_digest: `sha256:${"b".repeat(64)}`, workspace_request_id: "application",
        expires_at_iso: new Date(Date.now() + 600_000).toISOString() } } } });
});

describe("current workspace authority at claim and heartbeat", () => {
  it("claims once and acknowledges the same executor while the exact grant remains current", async () => {
    expect(await markRunStarted(claim)).toBe(true);
    const dispatch = structuredClone(run().dispatch);
    expect(await markRunStarted(claim)).toBe(true);
    expect(run().dispatch).toEqual(dispatch);
    expect(await markRunStarted({ ...claim, pipelineRunId: "another-worker" })).toBe(false);
    expect(await heartbeatRun(claim)).toBe(true);
    expect(run().dispatch.executionDeadlineAtMs).toBe(dispatch.executionDeadlineAtMs);
  });

  it("retains permission for the frozen setup when the saved setup is edited later", async () => {
    state.docs.set("users/owner/robotSetups/setup", { payload: JSON.stringify({ reference: "https://other.example.test", version: "v2" }) });
    expect(await markRunStarted(claim)).toBe(true);
    expect(await heartbeatRun(claim)).toBe(true);
  });

  it("reads withdrawal authority inside the claim transaction", async () => {
    const transact = store.runTransaction.bind(store);
    const spy = vi.spyOn(store, "runTransaction").mockImplementationOnce(callback => transact(tx => callback({ ...tx,
      get: async ref => {
        if (ref.path === "inboundRequests/application") source().workspace_evaluation.policyRunLicense.revokedAtIso = new Date().toISOString();
        return tx.get(ref);
      },
    })));
    try {
      expect(await markRunStarted(claim)).toBe(false);
      expect(run().dispatch).toBeUndefined();
    } finally { spy.mockRestore(); }
  });

  it.each(["revoked", "missing_current", "missing_frozen", "owner_changed", "job_changed", "setup_changed", "digest_changed", "request_changed", "grant_time_changed"])(
    "refuses %s authority before first claim", async change => {
      if (change === "revoked") source().workspace_evaluation.policyRunLicense.revokedAtIso = new Date().toISOString();
      if (change === "missing_current") delete source().workspace_evaluation.policyRunLicense;
      if (change === "missing_frozen") delete run().executionAdmission.envelope.policy_run_license;
      if (change === "owner_changed") source().account_owner_uid = "another-owner";
      if (change === "job_changed") source().workspace_evaluation.opportunityId = "another-scene";
      if (change === "setup_changed") source().workspace_evaluation.setupId = "another-setup";
      if (change === "digest_changed") source().workspace_evaluation.policyRunLicense.setupDigest = `sha256:${"c".repeat(64)}`;
      if (change === "request_changed") source().workspace_evaluation.policyRunLicense.requestId = "another-request";
      if (change === "grant_time_changed") source().workspace_evaluation.policyRunLicense.grantedAtIso = "not-a-date";
      const before = structuredClone(run());
      expect(await markRunStarted(claim)).toBe(false);
      expect(run()).toEqual(before);
      expect(notice).not.toHaveBeenCalled();
    },
  );

  it.each(["withdrawn", "hidden", "paused", "missing"])("refuses a %s site job before claim", async change => {
    if (change === "withdrawn") job().consent_revoked = true;
    if (change === "hidden") job().public_task_listing.enabled = false;
    if (change === "paused") job().workspace_task = { paused: true };
    if (change === "missing") state.docs.delete("inboundRequests/scene");
    expect(await markRunStarted(claim)).toBe(false);
    expect(run().dispatch).toBeUndefined();
    expect(notice).not.toHaveBeenCalled();
  });

  it.each(["grant", "site"])("refuses replay and heartbeat after %s authority is withdrawn", async withdrawn => {
    expect(await markRunStarted(claim)).toBe(true);
    const dispatch = structuredClone(run().dispatch);
    if (withdrawn === "grant") source().workspace_evaluation.policyRunLicense.revokedAtIso = new Date().toISOString();
    else job().consent_revoked = true;
    notice.mockClear();
    expect(await markRunStarted(claim)).toBe(false);
    expect(await heartbeatRun(claim)).toBe(false);
    expect(run().dispatch).toEqual(dispatch);
    expect(notice).not.toHaveBeenCalled();
  });
});
