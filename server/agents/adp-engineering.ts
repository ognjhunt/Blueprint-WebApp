/** Durable, bounded handoff to the existing Paperclip implementation/review lane. */
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { configuredAdpManagedRuns, type AdpManagedRuns } from "./adp-managed-runs";
import { requestAdpTask } from "./adapters/openai-agents-api";
import { crossRuntimeDigest } from "../utils/crossRuntimeCanonical";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const path = z.string().regex(/^[A-Za-z0-9_./-]+$/)
  .refine((value) => !value.startsWith("/") && value.split("/").length >= 2
    && !value.split("/").some((part) => !part || part === "." || part === ".." || part === ".git" || part.startsWith(".env")));
export const engineeringPolicySchema = z.object({
  schema_version: z.literal("blueprint_agent_engineering_policy.v1"), enabled: z.boolean(), policy_id: id,
  repository: z.literal("ognjhunt/BlueprintCapturePipeline"),
  run_id_prefixes: z.array(z.string().regex(/^[A-Za-z0-9._:-]{6,192}$/)).min(1).max(20),
  allowed_paths: z.array(path).min(1).max(30),
  required_test_paths: z.array(path.refine((value) => value.startsWith("tests/") && value.endsWith(".py"))).min(1).max(20),
  maximum_handoffs: z.number().int().min(1).max(20), maximum_changed_files: z.number().int().min(1).max(30),
  maximum_patch_bytes: z.number().int().min(1).max(200000),
  worker_budget_reference: z.string().min(1).max(300), maximum_worker_timeout_seconds: z.number().int().min(60).max(3600),
  accepted_by: z.string().min(1).max(192), expires_at: z.number().int().positive(),
}).strict();
export const engineeringHandoffSchema = z.object({
  schema_version: z.literal("blueprint_agent_engineering_handoff.v1"), program: z.literal("arm-decision-proof-v1"),
  handoff_id: z.string().regex(/^repair-[a-f0-9]{64}$/), handoff_digest: digest, policy_digest: digest,
  task_id: id, task_digest: digest, run_id: id, source_commit: z.string().regex(/^[a-f0-9]{40}$/),
  diagnosis_result_digest: digest, child_id: z.string().regex(/^sam31-[A-Za-z0-9_-]{1,160}$/), job_sha256: digest,
  replay_report_digest: digest, replay_status: z.literal("refused"), blocker_code: z.string().regex(/^[a-z][a-z0-9_]{0,159}$/),
  policy: engineeringPolicySchema, paid_resubmission_authorized: z.literal(false),
  scientific_acceptance_granted: z.literal(false), independent_review_required: z.literal(true),
}).strict();
export type EngineeringHandoff = z.infer<typeof engineeringHandoffSchema>;
function verifiedPacket(value: unknown) {
  const packet = engineeringHandoffSchema.parse(value);
  const { handoff_digest, handoff_id, ...basis } = packet;
  if (crossRuntimeDigest(packet.policy) !== packet.policy_digest
      || handoff_id !== `repair-${crossRuntimeDigest({ task_digest: packet.task_digest,
        replay_report_digest: packet.replay_report_digest, diagnosis_result_digest: packet.diagnosis_result_digest }).slice(7)}`
      || crossRuntimeDigest({ ...basis, handoff_id }) !== handoff_digest) throw new Error("adp_engineering_scope_invalid");
  return packet;
}
const COLLECTION = "agentEngineeringHandoffs";
const ISSUE_BINDINGS = "agentExecutionPaperclipIssueBindings";
const TASK_BINDINGS = "agentEngineeringTaskBindings";
const terminal = (state: unknown) => ["handed_off", "revoked", "scope_refused", "revoked_after_creation"].includes(String(state));

type Config = { companyId: string; projectId: string; agentId: string; reviewerId: string; policyDigest: string };
type Paperclip = { request: (method: string, path: string, body?: unknown) => Promise<any> };

export function engineeringIssue(packet: EngineeringHandoff, config: Config, timeoutSec: number) {
  const p = packet.policy;
  return {
    projectId: config.projectId, assigneeAgentId: config.agentId, status: "todo", priority: "medium",
    billingCode: `blueprint-adp:${packet.handoff_id}`,
    title: `ADP retained-stage repair: ${packet.blocker_code}`,
    description: [
      `ADP engineering handoff ${packet.handoff_id}`, `Packet digest: ${packet.handoff_digest}`,
      `Task: ${packet.task_id}; run: ${packet.run_id}`, `Repository: ${p.repository}; immutable base: ${packet.source_commit}`,
      `Saved child: ${packet.child_id}; job bytes: ${packet.job_sha256}`,
      `Replay report: ${packet.replay_report_digest}; result: ${packet.replay_status}; refusing code: ${packet.blocker_code}`,
      `Diagnosis receipt: ${packet.diagnosis_result_digest}`,
      "", "Reproduce on the control plane using the saved inputs:",
      `python -m blueprint_pipeline.task_evaluation_stage_replay --child ${packet.child_id} --isolate`,
      "", "Work in the isolated worktree. Retain failures and version each changed candidate.",
      "If input evidence or authority is missing, report that dependency. Do not weaken a predicate to make a replay pass.",
      `Allowed changed files: ${p.allowed_paths.join(", ")}`,
      `Patch limit: ${p.maximum_changed_files} files, ${p.maximum_patch_bytes} bytes.`,
      `Required tests: python -m pytest ${p.required_test_paths.join(" ")}`,
      "Also run changed-file Ruff and the repository's impacted tests and mandatory sentinels.",
      `Before requesting acceptance, run: python -m blueprint_pipeline.agent_execution.engineering verify-candidate --handoff-id ${packet.handoff_id} --candidate-commit <immutable-commit>`,
      "Prepare an immutable commit and draft PR. The separate reviewer and canonical release process retain acceptance and deployment authority.",
      "No paid resubmission, threshold change, raw dataset upload, or scientific acceptance is authorized by this handoff.",
      `Use only the existing worker budget: ${p.worker_budget_reference}. Worker timeout: ${timeoutSec}s.`,
      "Return commit, PR, changed paths, validation receipts, and any unresolved input. Issue completion alone is not release acceptance.",
    ].join("\n"),
    executionWorkspacePreference: "isolated_workspace",
    executionWorkspaceSettings: { mode: "isolated_workspace", workspaceStrategy: {
      type: "git_worktree", baseRef: packet.source_commit, branchTemplate: `codex/adp-repair-${packet.handoff_id.slice(-20)}`,
    } },
    assigneeAdapterOverrides: { adapterConfig: { timeoutSec } },
    executionPolicy: { mode: "normal", commentRequired: true, stages: [
      { type: "review", approvalsNeeded: 1, participants: [{ type: "agent", agentId: config.reviewerId }] },
    ] },
  };
}

export class AdpEngineeringHandoffs {
  constructor(readonly runs: AdpManagedRuns, readonly config: Config, readonly paperclip: Paperclip,
    readonly inspect = requestAdpTask, readonly now = Date.now) {}

  async admit(value: unknown) {
    const packet = verifiedPacket(value);
    const { handoff_digest, handoff_id } = packet;
    if (packet.policy_digest !== this.config.policyDigest || !packet.policy.enabled || packet.policy.expires_at <= this.now() / 1000
        || !packet.policy.run_id_prefixes.some((prefix) => packet.run_id.startsWith(prefix))) throw new Error("adp_engineering_scope_invalid");
    const { admission, run } = await this.runs.status(packet.task_id);
    if (admission.task_digest !== packet.task_digest || admission.source_commit !== packet.source_commit
        || admission.run_id !== packet.run_id || run?.status !== "completed"
        || run.artifacts?.agent_execution?.result?.result_digest !== packet.diagnosis_result_digest) {
      throw new Error("adp_engineering_diagnosis_not_verified");
    }
    const ref = this.runs.store.collection(COLLECTION).doc(packet.handoff_id);
    const taskRef = this.runs.store.collection(TASK_BINDINGS).doc(packet.task_id);
    await this.runs.store.runTransaction(async (transaction) => {
      const previous = await transaction.get(ref), taskBinding = await transaction.get(taskRef);
      if (taskBinding.exists && taskBinding.data()!.handoff_id !== packet.handoff_id) throw new Error("adp_engineering_task_already_owned");
      if (previous.exists) {
        if (previous.data()!.packet.handoff_digest !== packet.handoff_digest) throw new Error("adp_engineering_identity_conflict");
        return;
      }
      transaction.set(ref, { packet, config: this.config, state: "queued", next_poll_at_ms: this.now(),
        lease_owner: null, lease_until_ms: 0, create_started: false, issue_id: null, engineering_complete: false });
      transaction.set(taskRef, { handoff_id, task_digest: packet.task_digest });
    });
    return { schema_version: "blueprint_agent_engineering_admission_receipt.v1", handoff_id, handoff_digest, stored: true };
  }

  async step(id: string) {
    const ref = this.runs.store.collection(COLLECTION).doc(id), owner = randomUUID();
    const saved = await this.runs.store.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref); if (!snapshot.exists) return null;
      const row = snapshot.data()!;
      if (terminal(row.state) || row.lease_until_ms > this.now() || row.next_poll_at_ms > this.now()) return null;
      tx.update(ref, { lease_owner: owner, lease_until_ms: this.now() + 60000 }); return row;
    });
    if (!saved) return;
    const config: Config = saved.config;
    const finish = async (value: Record<string, unknown>) => this.runs.store.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (current.data()?.lease_owner === owner) tx.update(ref, { ...value, lease_owner: null, lease_until_ms: 0,
        next_poll_at_ms: terminal(value.state) ? Number.MAX_SAFE_INTEGER : this.now() + 5000, engineering_complete: false });
    });
    let packet: EngineeringHandoff;
    try { packet = verifiedPacket(saved.packet); }
    catch { await finish({ state: "scope_refused" }); return; }
    try {
      if (crossRuntimeDigest(config) !== crossRuntimeDigest(this.config)) { await finish({ state: "scope_refused" }); return; }
      const admission = await this.runs.admission(packet.task_id);
      const current = await this.inspect(admission, "inspect");
      const admitted = current.engineering_policy?.enabled === true && current.engineering_policy.policy_digest === packet.policy_digest
        && !current.cancel_requested && current.result?.result_digest === packet.diagnosis_result_digest
        && packet.policy.expires_at > this.now() / 1000;
      if (!admitted && !saved.create_started) { await finish({ state: "revoked" }); return; }
      const search = new URLSearchParams({ projectId: config.projectId, q: packet.handoff_id });
      const issues = await this.paperclip.request("GET", `/api/companies/${config.companyId}/issues?${search}`);
      if (!Array.isArray(issues)) throw new Error("paperclip_issue_lookup_invalid");
      const matches = issues.filter((issue: any) => issue.billingCode === `blueprint-adp:${packet.handoff_id}`);
      if (matches.length > 1) throw new Error("adp_engineering_ambiguous_issue");
      let issue = matches[0];
      if (!issue && saved.create_started) { await finish({ state: "creation_uncertain" }); return; }
      if (!issue) {
        if (!admitted) { await finish({ state: "revoked" }); return; }
        const agent = await this.paperclip.request("GET", `/api/agents/${config.agentId}`);
        const reviewer = await this.paperclip.request("GET", `/api/agents/${config.reviewerId}`);
        const project = await this.paperclip.request("GET", `/api/projects/${config.projectId}`);
        const timeout = agent.adapterConfig?.timeoutSec;
        const workspace = project.workspaces?.find((row: any) => [
          `https://github.com/${packet.policy.repository}`, `https://github.com/${packet.policy.repository}.git`,
          `git@github.com:${packet.policy.repository}.git`,
        ].includes(row.repoUrl));
        if (agent.id !== config.agentId || reviewer.id !== config.reviewerId || config.agentId === config.reviewerId
            || [agent, reviewer, project].some((row) => row.companyId !== config.companyId)
            || project.id !== config.projectId || !workspace?.id || ["disabled", "paused", "terminated"].includes(agent.status)
            || ["disabled", "paused", "terminated"].includes(reviewer.status)
            || !Number.isFinite(agent.budgetMonthlyCents) || agent.budgetMonthlyCents <= 0
            || !Number.isFinite(agent.spentMonthlyCents) || agent.spentMonthlyCents >= agent.budgetMonthlyCents
            || !Number.isInteger(timeout) || timeout <= 0 || timeout > packet.policy.maximum_worker_timeout_seconds) {
          await finish({ state: "scope_refused" }); return;
        }
        const remaining = Math.floor(packet.policy.expires_at - this.now() / 1000);
        if (remaining < 60) { await finish({ state: "revoked" }); return; }
        const body = { ...engineeringIssue(packet, config, Math.min(timeout, remaining)), projectWorkspaceId: workspace.id };
        const fresh = await this.inspect(admission, "inspect");
        if (fresh.engineering_policy?.enabled !== true || fresh.engineering_policy.policy_digest !== packet.policy_digest
            || fresh.cancel_requested || fresh.result?.result_digest !== packet.diagnosis_result_digest) {
          await finish({ state: "revoked" }); return;
        }
        // Intent before the only POST. After loss, reconcile by the supported
        // billingCode and exact packet marker; never issue another creation.
        await this.runs.store.runTransaction(async (tx) => {
          const row = (await tx.get(ref)).data();
          if (row?.lease_owner !== owner || row.create_started) throw new Error("adp_engineering_lease_lost");
          tx.update(ref, { create_started: true, issue_request: body, state: "creation_uncertain" });
        });
        issue = await this.paperclip.request("POST", `/api/companies/${config.companyId}/issues`, body);
      }
      if (issue.companyId !== config.companyId || issue.projectId !== config.projectId || issue.assigneeAgentId !== config.agentId
          || issue.billingCode !== `blueprint-adp:${packet.handoff_id}`
          || !issue.description?.includes(`Packet digest: ${packet.handoff_digest}`)
          || issue.executionWorkspacePreference !== "isolated_workspace"
          || issue.executionWorkspaceSettings?.workspaceStrategy?.baseRef !== packet.source_commit
          || issue.executionWorkspaceSettings?.workspaceStrategy?.type !== "git_worktree"
          || issue.executionWorkspaceSettings?.workspaceStrategy?.provisionCommand
          || issue.executionWorkspaceSettings?.workspaceStrategy?.teardownCommand
          || !issue.executionPolicy?.stages?.some((stage: any) => stage.type === "review" && stage.approvalsNeeded === 1
            && stage.participants?.length === 1 && stage.participants[0].agentId === config.reviewerId)) throw new Error("adp_engineering_issue_readback_invalid");
      await this.runs.store.runTransaction(async (tx) => {
        const row = (await tx.get(ref)).data(); if (row?.lease_owner !== owner) throw new Error("adp_engineering_lease_lost");
        const binding = this.runs.store.collection(ISSUE_BINDINGS).doc(issue.id);
        const old = await tx.get(binding);
        const value = { task_id: packet.task_id, task_digest: packet.task_digest, handoff_id: packet.handoff_id,
          company_id: config.companyId, agent_id: config.agentId, issue_id: issue.id };
        if (old.exists && crossRuntimeDigest(old.data()) !== crossRuntimeDigest(value)) throw new Error("adp_engineering_issue_binding_conflict");
        tx.set(binding, value);
        tx.update(ref, { state: admitted ? "handed_off" : "revoked_after_creation", issue_id: issue.id,
          issue_status: issue.status, lease_owner: null, lease_until_ms: 0, engineering_complete: false,
          next_poll_at_ms: Number.MAX_SAFE_INTEGER,
          release_acceptance: "independent_review_and_verified_deployment_required" });
      });
    } catch {
      await finish({ state: "reconciliation_pending" });
    }
  }

  async tick() {
    const rows = await this.runs.store.collection(COLLECTION).where("next_poll_at_ms", "<=", this.now()).orderBy("next_poll_at_ms").limit(10).get();
    for (const row of rows.docs) await this.step(row.id);
  }
}

export function configuredEngineeringHandoffs() {
  if (process.env.BLUEPRINT_ADP_ENGINEERING_ENABLED !== "1") throw new Error("adp_engineering_not_configured");
  const read = (key: string) => { const value = process.env[key]?.trim(); if (!value) throw new Error("adp_engineering_not_configured"); return value; };
  const config = { companyId: read("BLUEPRINT_PAPERCLIP_ADP_COMPANY_ID"), projectId: read("BLUEPRINT_ADP_ENGINEERING_PROJECT_ID"),
    agentId: read("BLUEPRINT_PAPERCLIP_ADP_AGENT_ID"), reviewerId: read("BLUEPRINT_ADP_ENGINEERING_REVIEWER_ID"), policyDigest: read("BLUEPRINT_ADP_ENGINEERING_POLICY_DIGEST") };
  for (const key of ["companyId", "projectId", "agentId", "reviewerId"] as const) z.string().uuid().parse(config[key]);
  digest.parse(config.policyDigest);
  return new AdpEngineeringHandoffs(configuredAdpManagedRuns(), config, configuredPaperclipClient());
}

export function configuredPaperclipClient(): Paperclip {
  const raw = process.env.PAPERCLIP_API_URL?.trim(), token = process.env.PAPERCLIP_API_KEY?.trim();
  if (!raw || !token) throw new Error("adp_engineering_not_configured");
  const origin = new URL(raw);
  if (origin.username || origin.password || origin.search || origin.hash || origin.pathname !== "/"
      || !(origin.protocol === "https:" || origin.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))) throw new Error("adp_engineering_origin_invalid");
  return { request: async (method, path, body) => {
    const response = await fetch(new URL(path, origin), { method, redirect: "error", signal: AbortSignal.timeout(8000),
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!response.ok) throw new Error("adp_engineering_paperclip_unavailable");
    const text = await response.text(); if (text.length > 1_000_000) throw new Error("adp_engineering_response_too_large");
    return JSON.parse(text);
  } };
}
