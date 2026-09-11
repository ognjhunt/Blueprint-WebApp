// @vitest-environment node
import { expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null }));
import { AdpEngineeringHandoffs, engineeringHandoffSchema } from "../agents/adp-engineering";
import type { AdpManagedRuns } from "../agents/adp-managed-runs";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";
import { createFakeFirestore, createFakeFirestoreState } from "./helpers/fake-firestore";

const ids = { companyId: "00000000-0000-4000-8000-000000000001", projectId: "00000000-0000-4000-8000-000000000002",
  agentId: "00000000-0000-4000-8000-000000000003", reviewerId: "00000000-0000-4000-8000-000000000004" };
const hash = (letter: string) => `sha256:${letter.repeat(64)}`;
function packet() {
  const policy = { schema_version: "blueprint_agent_engineering_policy.v1", enabled: true, policy_id: "policy-1",
    repository: "ognjhunt/BlueprintCapturePipeline", run_id_prefixes: ["scene-"],
    allowed_paths: ["src/blueprint_pipeline/task_evaluation_sam31_preparation_stages.py"],
    required_test_paths: ["tests/test_task_evaluation_stage_replay.py"], maximum_handoffs: 1,
    maximum_changed_files: 1, maximum_patch_bytes: 8000, worker_budget_reference: "existing-worker-budget",
    maximum_worker_timeout_seconds: 600, accepted_by: "fixture-operator", expires_at: Math.floor(Date.now() / 1000) + 1200 };
  const value = { schema_version: "blueprint_agent_engineering_handoff.v1", program: "arm-decision-proof-v1",
    task_id: "task-1", task_digest: hash("a"), run_id: "scene-fixture", source_commit: "a".repeat(40),
    diagnosis_result_digest: hash("b"), child_id: "sam31-fixture", job_sha256: hash("c"),
    replay_report_digest: hash("d"), replay_status: "refused", blocker_code: "sam31_phase_file_reference_invalid",
    policy, policy_digest: crossRuntimeDigest(policy), paid_resubmission_authorized: false,
    scientific_acceptance_granted: false, independent_review_required: true };
  const handoff_id = `repair-${crossRuntimeDigest({ task_digest: value.task_digest,
    replay_report_digest: value.replay_report_digest, diagnosis_result_digest: value.diagnosis_result_digest }).slice(7)}`;
  return engineeringHandoffSchema.parse({ ...value, handoff_id, handoff_digest: crossRuntimeDigest({ ...value, handoff_id }) });
}

function setup() {
  const value = packet(), state = createFakeFirestoreState(), store = createFakeFirestore(state);
  let clock = Date.now(), admitted = true, loseReply = false;
  const issues: any[] = [];
  const admission = { task_id: value.task_id, task_digest: value.task_digest, run_id: value.run_id, source_commit: value.source_commit };
  const runs = { store, admission: async () => admission, status: async () => ({ admission, run: { status: "completed",
    artifacts: { agent_execution: { result: { result_digest: value.diagnosis_result_digest } } } } }) } as unknown as AdpManagedRuns;
  const config = { ...ids, policyDigest: value.policy_digest };
  const paperclip = { request: vi.fn(async (method: string, path: string, body?: any): Promise<any> => {
    if (method === "POST") {
      const created = { id: "00000000-0000-4000-8000-000000000005", companyId: ids.companyId, ...body };
      issues.push(created);
      if (loseReply) { loseReply = false; throw new Error("lost response after commit"); }
      return created;
    }
    if (path.startsWith("/api/companies/")) return issues;
    if (path === `/api/projects/${ids.projectId}`) return { id: ids.projectId, companyId: ids.companyId,
      workspaces: [{ id: "00000000-0000-4000-8000-000000000006", repoUrl: "https://github.com/ognjhunt/BlueprintCapturePipeline.git" }] };
    const id = path.split("/").at(-1);
    return { id, companyId: ids.companyId, status: "idle", budgetMonthlyCents: 1000, spentMonthlyCents: 20, adapterConfig: { timeoutSec: 300 } };
  }) };
  const inspect = vi.fn(async () => ({ engineering_policy: { enabled: admitted, policy_digest: value.policy_digest },
    cancel_requested: false, result: { result_digest: value.diagnosis_result_digest } })) as any;
  const service = new AdpEngineeringHandoffs(runs, config, paperclip, inspect, () => clock);
  return { service, value, state, paperclip, issues, advance: () => { clock += 6000; },
    revoke: () => { admitted = false; }, loseReply: () => { loseReply = true; } };
}

it("hands a verified diagnosis to an isolated worktree with a separate reviewer", async () => {
  const f = setup(); await f.service.admit(f.value); await f.service.admit(f.value); await f.service.tick();
  expect(f.issues).toHaveLength(1);
  expect(f.issues[0].executionWorkspacePreference).toBe("isolated_workspace");
  expect(f.issues[0].executionWorkspaceSettings.workspaceStrategy.baseRef).toBe(f.value.source_commit);
  expect(f.issues[0].executionPolicy.stages[0].participants[0].agentId).toBe(ids.reviewerId);
  expect(f.issues[0].description).toContain(f.value.child_id);
  expect(f.issues[0]).not.toHaveProperty("metadata"); // Not supported by the real Paperclip issue API.
  const row = f.state.docs.get(`agentEngineeringHandoffs/${f.value.handoff_id}`)!;
  expect(row.state).toBe("handed_off"); expect(row.engineering_complete).toBe(false);
  expect(f.state.docs.get(`agentExecutionPaperclipIssueBindings/${f.issues[0].id}`)).toMatchObject({ task_id: f.value.task_id });
  f.advance(); await f.service.tick(); expect(f.issues).toHaveLength(1);
});

it("recovers a lost creation reply from the existing issue without another POST", async () => {
  const f = setup(); await f.service.admit(f.value); f.loseReply(); await f.service.tick();
  expect(f.issues).toHaveLength(1);
  f.advance(); await f.service.tick();
  expect(f.paperclip.request.mock.calls.filter(([method]) => method === "POST")).toHaveLength(1);
  expect(f.state.docs.get(`agentEngineeringHandoffs/${f.value.handoff_id}`)?.state).toBe("handed_off");
});

it("keeps uncertain creation pending when no authoritative issue is visible", async () => {
  const f = setup(); await f.service.admit(f.value); f.loseReply(); await f.service.tick(); f.issues.splice(0);
  f.advance(); await f.service.tick(); f.advance(); await f.service.tick();
  expect(f.paperclip.request.mock.calls.filter(([method]) => method === "POST")).toHaveLength(1);
  expect(f.state.docs.get(`agentEngineeringHandoffs/${f.value.handoff_id}`)?.state).toBe("creation_uncertain");
});

it("revokes before dispatch and refuses changed packet scope", async () => {
  const f = setup(); await f.service.admit(f.value); f.revoke(); await f.service.tick();
  expect(f.paperclip.request).not.toHaveBeenCalled();
  expect(f.state.docs.get(`agentEngineeringHandoffs/${f.value.handoff_id}`)?.state).toBe("revoked");
  const changed = structuredClone(f.value); changed.policy.allowed_paths = ["src/blueprint_pipeline/paid_resource_allocator.py"];
  await expect(f.service.admit(changed)).rejects.toThrow("scope_invalid");
});

it("revalidates a retained packet before any external dispatch", async () => {
  const f = setup(); await f.service.admit(f.value);
  const key = `agentEngineeringHandoffs/${f.value.handoff_id}`;
  const saved = f.state.docs.get(key)! as any;
  saved.packet.policy.allowed_paths = ["src/blueprint_pipeline/paid_resource_allocator.py"];
  await f.service.tick();
  expect(f.paperclip.request).not.toHaveBeenCalled();
  expect(f.state.docs.get(key)?.state).toBe("scope_refused");
});
