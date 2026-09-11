/** Durable product records for tasks whose provider owner lives in Pipeline. */
import { createHash, randomUUID } from "node:crypto";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { adpTaskAdmissionSchema, type AdpTaskAdmission, type AdpTaskStatus } from "./adp-contract";
import { AdpPipelineRequestError, adpStatusToAgentResult, requestAdpTask } from "./adapters/openai-agents-api";

export const ADP_ADMISSIONS = "agentExecutionAdmissions";
export const ADP_PENDING = "agentExecutionPending";
const RUNS = "agentRuns";
const POLL_MS = 5000;
const LEASE_MS = 60_000;
const terminal = (state: string) => ["completed", "failed", "cancelled"].includes(state);
const runIdFor = (admission: AdpTaskAdmission) => `adp_${createHash("sha256")
  .update(`${admission.task_id}\0${admission.task_digest}`).digest("hex")}`;

export class AdpManagedRuns {
  constructor(
    readonly store: FirebaseFirestore.Firestore,
    readonly forward = requestAdpTask,
    readonly now: () => number = Date.now,
  ) {}

  async admission(taskId: string) {
    const snapshot = await this.store.collection(ADP_ADMISSIONS).doc(taskId).get();
    if (!snapshot.exists) throw new Error("adp_agent_admission_missing");
    return adpTaskAdmissionSchema.parse(snapshot.data());
  }

  async admit(value: unknown) {
    const admission = adpTaskAdmissionSchema.parse(value);
    const ref = this.store.collection(ADP_ADMISSIONS).doc(admission.task_id);
    await this.store.runTransaction(async (transaction) => {
      const previous = await transaction.get(ref);
      if (previous.exists) {
        const saved = adpTaskAdmissionSchema.parse(previous.data());
        // Revocation may narrow an existing admission. It cannot replace its
        // source, expiry, authority identity or restart a revoked task.
        if (JSON.stringify({ ...saved, enabled: admission.enabled }) !== JSON.stringify(admission)
            || (!saved.enabled && admission.enabled)) throw new Error("adp_agent_admission_conflict");
      }
      transaction.set(ref, admission);
    });
    if (admission.enabled && admission.autostart && admission.expires_at > this.now() / 1000) {
      await this.start(admission.task_id, "blueprint-pipeline-controller");
    }
    return { schema_version: "blueprint_webapp_agent_admission_receipt.v1", admission, proof_effect: "none" };
  }

  async start(taskId: string, actorId: string) {
    const admission = await this.admission(taskId);
    if (!admission.enabled || admission.expires_at <= this.now() / 1000) {
      throw new Error("adp_agent_admission_expired_or_disabled");
    }
    const runId = runIdFor(admission);
    const runRef = this.store.collection(RUNS).doc(runId);
    const pendingRef = this.store.collection(ADP_PENDING).doc(runId);
    await this.store.runTransaction(async (transaction) => {
      const previous = await transaction.get(runRef);
      if (previous.exists) {
        const saved = previous.data()!;
        if (saved.pipeline_task_digest !== admission.task_digest) throw new Error("adp_agent_run_identity_changed");
        return;
      }
      const timestamp = new Date(this.now()).toISOString();
      transaction.set(runRef, {
        id: runId, task_kind: "adp_run_operator", provider: admission.runtime, runtime: admission.runtime,
        model: admission.model, status: "queued", dispatch_mode: "collect", session_id: null,
        session_key: `adp:${admission.run_id}`, pipeline_task_id: taskId,
        pipeline_task_digest: admission.task_digest,
        input: { kind: "adp_run_operator", input: { pipeline_task_id: taskId },
          provider: admission.runtime, runtime: admission.runtime, model: admission.model },
        created_at: timestamp, updated_at: timestamp, requires_human_review: false,
        cancel_requested: false, cleanup_requested: false,
        metadata: { actor_id: actorId, source_commit: admission.source_commit, blueprint_run_id: admission.run_id,
          proof_effect: "none", remote_owner: "blueprint-pipeline", agent_profile_id: "built-in-adp-run-operator" },
      });
      transaction.set(pendingRef, { run_id: runId, task_id: taskId, task_digest: admission.task_digest,
        next_poll_at_ms: this.now(), lease_owner: null, lease_until_ms: 0 });
    });
    return this.status(taskId);
  }

  async status(taskId: string) {
    const admission = await this.admission(taskId);
    const run = await this.store.collection(RUNS).doc(runIdFor(admission)).get();
    return { admission, run: run.exists ? run.data() : null, proof_effect: "none" };
  }

  async list(limit = 100) {
    const snapshot = await this.store.collection(ADP_ADMISSIONS).limit(limit).get();
    return Promise.all(snapshot.docs.map((doc) => this.status(doc.id)));
  }

  async requestAction(taskId: string, action: "cancel" | "cleanup", actorId: string) {
    const admission = await this.admission(taskId);
    const runId = runIdFor(admission);
    const ref = this.store.collection(RUNS).doc(runId);
    await this.store.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("adp_agent_run_missing");
      const run = snapshot.data()!;
      if (run.pipeline_task_digest !== admission.task_digest) throw new Error("adp_agent_run_identity_changed");
      if (action === "cleanup" && !terminal(run.status)) throw new Error("adp_agent_cleanup_requires_terminal_task");
      if (action === "cancel" && terminal(run.status)) return;
      transaction.update(ref, { [`${action}_requested`]: true, action_actor_id: actorId,
        updated_at: new Date(this.now()).toISOString() });
      transaction.set(this.store.collection(ADP_PENDING).doc(runId), {
        run_id: runId, task_id: taskId, task_digest: admission.task_digest, next_poll_at_ms: this.now(),
      }, { merge: true });
    });
    return this.status(taskId);
  }

  async step(runId: string) {
    const pendingRef = this.store.collection(ADP_PENDING).doc(runId);
    const runRef = this.store.collection(RUNS).doc(runId);
    const owner = randomUUID();
    const claimed = await this.store.runTransaction(async (transaction) => {
      const [pending, run] = await Promise.all([transaction.get(pendingRef), transaction.get(runRef)]);
      if (!pending.exists || !run.exists) return null;
      const work = pending.data()!;
      if (work.lease_until_ms > this.now() || work.next_poll_at_ms > this.now()) return null;
      transaction.update(pendingRef, { lease_owner: owner, lease_until_ms: this.now() + LEASE_MS });
      return { work, run: run.data()! };
    });
    if (!claimed) return { performed: false };
    const mutate = async (admission: AdpTaskAdmission, requested: "enqueue" | "cancel" | "cleanup") => {
      const action = await this.store.runTransaction(async (transaction) => {
        const [pending, current] = await Promise.all([transaction.get(pendingRef), transaction.get(runRef)]);
        if (!pending.exists || pending.data()!.lease_owner !== owner || !current.exists) throw new Error("adp_agent_lease_lost");
        const record = current.data()!;
        if (record.pipeline_task_digest !== admission.task_digest) throw new Error("adp_agent_run_identity_changed");
        const selected = requested === "enqueue" && record.cancel_requested ? "cancel" : requested;
        if (selected === "enqueue" && terminal(record.status)) throw new Error("adp_agent_terminal_enqueue_refused");
        // This committed intent is the action's linearization point. A
        // cancellation committed before it always chooses cancellation.
        transaction.set(this.store.collection("agentExecutionActions").doc(randomUUID()), {
          run_id: runId, task_id: admission.task_id, task_digest: admission.task_digest,
          action: selected, cancel_requested_at_selection: Boolean(record.cancel_requested),
          selected_at: new Date(this.now()).toISOString(), lease_owner: owner,
        });
        return selected;
      });
      return this.forward(admission, action);
    };
    try {
      const admission = await this.admission(claimed.work.task_id);
      if (admission.task_digest !== claimed.work.task_digest
          || claimed.run.pipeline_task_digest !== admission.task_digest) throw new Error("adp_agent_run_identity_changed");
      let state: AdpTaskStatus;
      try {
        state = await this.forward(admission, "inspect");
      } catch (error) {
        if (!(error instanceof AdpPipelineRequestError) || error.code !== "agent_task_missing") throw error;
        // A lost enqueue response can safely select the same immutable task
        // again. The Pipeline journal is the only provider-creation owner.
        state = await mutate(admission, "enqueue");
      }
      const latest = (await runRef.get()).data()!;
      if (latest.cancel_requested && !terminal(state.state) && !state.cancel_requested) state = await mutate(admission, "cancel");
      if (latest.cleanup_requested && terminal(state.state) && state.cleanup_state !== "deleted") {
        state = await mutate(admission, "cleanup");
      }
      const result = adpStatusToAgentResult(admission, state);
      await this.store.runTransaction(async (transaction) => {
        const [pending, current] = await Promise.all([transaction.get(pendingRef), transaction.get(runRef)]);
        if (!pending.exists || pending.data()!.lease_owner !== owner || !current.exists) return;
        const existing = current.data()!;
        if (existing.pipeline_task_digest !== admission.task_digest) throw new Error("adp_agent_run_identity_changed");
        const previousState = existing.artifacts?.agent_execution as AdpTaskStatus | undefined;
        if (previousState && previousState.updated_at > state.updated_at) throw new Error("adp_agent_stale_remote_state");
        if (terminal(existing.status) && existing.status !== result.status) throw new Error("adp_agent_terminal_state_regression");
        if (previousState?.result && previousState.result.result_digest !== state.result?.result_digest) {
          throw new Error("adp_agent_terminal_result_changed");
        }
        const timestamp = new Date(this.now()).toISOString();
        if (terminal(existing.status)) {
          if (!previousState) throw new Error("adp_agent_terminal_receipt_missing");
          transaction.update(runRef, { updated_at: timestamp, last_remote_observed_at: timestamp,
            reconciliation_error: null,
            artifacts: { ...existing.artifacts, agent_execution: { ...previousState,
              cleanup_state: state.cleanup_state, updated_at: state.updated_at } } });
        } else {
          transaction.update(runRef, {
            status: result.status, output: result.output ?? null, artifacts: result.artifacts,
            error: result.error ?? null, requires_human_review: result.requires_human_review,
            updated_at: timestamp, last_remote_observed_at: timestamp, reconciliation_error: null,
            ...(terminal(result.status) ? { completed_at: timestamp } : {}),
          });
        }
        const needsCleanup = existing.cleanup_requested && state.cleanup_state !== "deleted";
        if (terminal(result.status) && !needsCleanup) transaction.delete(pendingRef);
        else transaction.update(pendingRef, { next_poll_at_ms: this.now() + POLL_MS,
          lease_owner: null, lease_until_ms: 0, last_error: null });
      });
      return { performed: true, run_id: runId, state: result.status };
    } catch (error) {
      // A transport outage cannot become an invented failed/cancelled provider
      // outcome. Preserve the task, pending cancellation and existing result.
      const code = error instanceof AdpPipelineRequestError ? error.code : "adp_agent_reconciliation_refused";
      await this.store.runTransaction(async (transaction) => {
        const pending = await transaction.get(pendingRef);
        if (!pending.exists || pending.data()!.lease_owner !== owner) return;
        transaction.update(pendingRef, { next_poll_at_ms: this.now() + POLL_MS,
          lease_owner: null, lease_until_ms: 0, last_error: code });
        transaction.update(runRef, { reconciliation_error: code, updated_at: new Date(this.now()).toISOString() });
      });
      return { performed: true, run_id: runId, state: "reconciliation_pending", error: code };
    }
  }

  async tick(limit = 10) {
    const pending = await this.store.collection(ADP_PENDING).where("next_poll_at_ms", "<=", this.now())
      .orderBy("next_poll_at_ms", "asc").limit(limit).get();
    const results: Array<Awaited<ReturnType<AdpManagedRuns["step"]>>> = [];
    for (const row of pending.docs) results.push(await this.step(row.id));
    return results;
  }
}

export function configuredAdpManagedRuns() {
  if (!db) throw new Error("adp_agent_store_unavailable");
  return new AdpManagedRuns(db);
}

export function startAdpManagedRunWorker() {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    if (stopped) return;
    try { if (db) await configuredAdpManagedRuns().tick(); } catch { /* Durable queue retries next tick. */ }
    if (!stopped) timer = setTimeout(() => void tick(), POLL_MS);
  };
  void tick();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
