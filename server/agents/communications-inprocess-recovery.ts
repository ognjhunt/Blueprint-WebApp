import { z } from "zod";
import { communicationsDigest } from "./communications-contract";
import { communicationsContinuationSessionBinding, type CommunicationsCheckpoint } from "./communications-api";
import { COMMUNICATIONS_ROOT, COMMUNICATIONS_SAVED_RECOVERY_REQUESTER, type CommunicationsJobRecord } from "./communications-store";
import { claimCommunicationsWorkerLap } from "./communications-release-lease";
import { assertCommunicationsRecoveryHeadroom, sampleCommunicationsRecoveryMemory, type CommunicationsRecoveryMemorySample } from "./communications-recovery-memory";
import type { CommunicationsDependencies } from "./communications-worker";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const communicationsInprocessRecoverySchema = z.object({
  briefDigest: hash, expectedCheckpointDigest: hash, expectedJobDigest: hash, rawOutputSha256: hash,
  sessionId: z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/), expectedSourceCommit: z.string().regex(/^[a-f0-9]{40}$/),
}).strict();
export type CommunicationsInprocessRecoveryInput = z.infer<typeof communicationsInprocessRecoverySchema> & { prospectId: string; jobId: string };
type Input = CommunicationsInprocessRecoveryInput;
type Options = { signal?: AbortSignal; sample?: (stage: string) => CommunicationsRecoveryMemorySample;
  loadRecovery?: () => Promise<typeof import("./communications-worker")>;
  authority?: { path: string; assertRecord: (record: unknown) => void; assertCurrent: () => Promise<void> } };
let active = false;
// A drained invocation retains its exact handle until completion is acknowledged.
// An expiry or unrelated lap can never substitute for that receipt.
let pendingSettlement: Awaited<ReturnType<typeof claimCommunicationsWorkerLap>> = null;
const stableCheckpointDigest = (checkpoint: CommunicationsCheckpoint) => communicationsDigest({
  ...communicationsContinuationSessionBinding(checkpoint), turnId: checkpoint.turnId, framingVersion: checkpoint.framingVersion,
  draftProfile: checkpoint.draftProfile, draftWritingGuidance: checkpoint.draftWritingGuidance ?? null,
});

/** Explicit authenticated owner action. Reuses the worker consumer in this
 * process; no second Node runtime, repository scan, inference, copy or send. */
export async function recoverCommunicationsDraftInProcess(input: Input, actorUid: string, deps: CommunicationsDependencies, options: Options = {}) {
  communicationsInprocessRecoverySchema.parse(Object.fromEntries(Object.entries(input).filter(([key]) => key !== "prospectId" && key !== "jobId")));
  if (!actorUid.trim() || !/^[a-f0-9]{64}$/.test(input.jobId) || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(input.prospectId)) throw new Error("communications_saved_recovery_identity_invalid");
  if (input.expectedSourceCommit !== process.env.RENDER_GIT_COMMIT) throw new Error("communications_saved_recovery_source_changed");
  const flags = ["BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED", "BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED", "BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED"];
  const assertActive = () => {
    if (options.signal?.aborted) throw new Error("communications_saved_recovery_request_cancelled");
    if (flags.some(key => process.env[key] !== "false") || process.env.RENDER_GIT_COMMIT !== input.expectedSourceCommit) throw new Error("communications_saved_recovery_runtime_changed");
  };
  assertActive();
  if (active) throw new Error("communications_saved_recovery_process_busy");
  active = true;
  const samples: CommunicationsRecoveryMemorySample[] = [];
  const sample = (stage: string) => {
    assertActive();
    const value = (options.sample ?? sampleCommunicationsRecoveryMemory)(stage);
    assertCommunicationsRecoveryHeadroom(value);
    if (samples.length < 32) samples.push(value);
  };
  let lap: Awaited<ReturnType<typeof claimCommunicationsWorkerLap>> = null;
  try {
    if (pendingSettlement) {
      await pendingSettlement.release();
      pendingSettlement = null;
    }
    await options.authority?.assertCurrent();
    sample("existing_process_before_recovery");
    lap = await claimCommunicationsWorkerLap(deps.store.db, deps.now);
    if (!lap?.canContinue()) throw new Error("communications_saved_recovery_release_or_lap_held");
    const check = () => { assertActive(); if (!lap!.canContinue()) throw new Error("communications_saved_recovery_lap_expired"); };
    const ref = deps.store.db.doc(`${COMMUNICATIONS_ROOT}/jobs/${input.jobId}`);
    const original = (await ref.get()).data() as CommunicationsJobRecord | undefined;
    if (!original || original.jobId !== input.jobId || original.prospectId !== input.prospectId || original.briefDigest !== input.briefDigest
      || original.checkpoint.sessionId !== input.sessionId) throw new Error("communications_saved_recovery_binding_changed");
    const ownerAction = { actorUid, sourceCommit: input.expectedSourceCommit, originalJobDigest: input.expectedJobDigest,
      requestDigest: communicationsDigest(input), stableCheckpointDigest: stableCheckpointDigest(original.checkpoint) };
    const pin = original.savedOutputRecovery;
    const owned = pin?.rawOutputSha256 === input.rawOutputSha256 && pin.checkpointDigest === communicationsDigest(original.checkpoint) && !!pin.ownerAction
      && communicationsDigest(pin.ownerAction) === communicationsDigest(ownerAction);
    if (!owned && communicationsDigest(original.checkpoint) !== input.expectedCheckpointDigest) throw new Error("communications_saved_recovery_binding_changed");
    if (owned && original.state === "pending_approval" && original.outputSource?.rawOutputSha256 === input.rawOutputSha256) {
      sample("duplicate_existing_result");
      return { state: "no_op", ledgerId: `communications_${input.jobId}`, sent: false, gmailDraftCreated: false, memory: samples };
    }
    if (!Number.isSafeInteger(original.lease?.until) || original.lease!.until < 0 || original.lease!.until > deps.now()) throw new Error("communications_saved_recovery_binding_changed");
    if ((!owned && communicationsDigest(original) !== input.expectedJobDigest)
      || !["blocked", "queued", "running", "retry"].includes(original.state) || original.attempts >= 3
      || (original.state !== "blocked" && !owned)) throw new Error("communications_saved_recovery_record_changed");
    const scopedDb = Object.create(deps.store.db) as typeof deps.store.db;
    let requirePin = owned;
    scopedDb.runTransaction = ((callback: (tx: FirebaseFirestore.Transaction) => Promise<unknown>, ...args: any[]) =>
      deps.store.db.runTransaction(async tx => {
        check(); sample("before_transaction");
        if (options.authority) {
          await options.authority.assertCurrent();
          options.authority.assertRecord((await tx.get(deps.store.db.doc(options.authority.path))).data());
        }
        const current = (await tx.get(ref)).data() as CommunicationsJobRecord | undefined;
        const currentPin = current?.savedOutputRecovery;
        if (!current || current.jobId !== input.jobId || current.prospectId !== input.prospectId
          || current.briefId !== original.briefId || current.briefDigest !== input.briefDigest
          || current.intent !== original.intent || current.checkpoint.sessionId !== input.sessionId
          || stableCheckpointDigest(current.checkpoint) !== ownerAction.stableCheckpointDigest
          || (requirePin ? !currentPin || currentPin.rawOutputSha256 !== input.rawOutputSha256
            || currentPin.checkpointDigest !== communicationsDigest(current.checkpoint)
            || communicationsDigest(currentPin.ownerAction) !== communicationsDigest(ownerAction)
            : communicationsDigest(current) !== communicationsDigest(original))) {
          throw new Error("communications_saved_recovery_binding_changed");
        }
        // Queue writes only after every awaited read has completed. The SDK
        // reruns this callback on conflicts, including its ownership checks.
        const guardedTx = new Proxy(tx, { get(target, property) {
          const value = Reflect.get(target, property, target);
          if (typeof value !== "function") return value;
          return (...methodArgs: any[]) => {
            if (["create", "set", "update", "delete"].includes(String(property))) {
              check(); sample("before_transaction_write");
            }
            return value.apply(target, methodArgs);
          };
        } });
        const result = await callback(guardedTx);
        check(); sample("before_transaction_commit");
        return result;
      }, ...args)) as typeof scopedDb.runTransaction;
    const scopedStore = Object.create(deps.store) as typeof deps.store;
    Object.defineProperty(scopedStore, "db", { value: scopedDb });
    check();
    if (original.state === "blocked") await scopedStore.retryBlocked({ jobId: input.jobId, prospectId: input.prospectId, briefDigest: input.briefDigest,
      requestedBy: COMMUNICATIONS_SAVED_RECOVERY_REQUESTER, expectedJobDigest: communicationsDigest(original),
      savedOutputRecovery: { version: "completed-saved-output-v1", rawOutputSha256: input.rawOutputSha256, checkpointDigest: communicationsDigest(original.checkpoint), ownerAction } });
    requirePin = true;
    for (const method of ["claim", "commitDraft"] as const) {
      const originalMethod = deps.store[method].bind(scopedStore) as (...args: any[]) => Promise<any>;
      (scopedStore as any)[method] = async (...args: any[]) => { check(); sample(`before_${method}`); return originalMethod(...args); };
    }
    const forbidden = async (): Promise<never> => { throw new Error("communications_saved_recovery_inference_or_send_forbidden"); };
    const recovery = await (options.loadRecovery ?? (() => import("./communications-worker")))();
    sample("recovery_consumer_loaded");
    const result = await recovery.recoverSavedCommunicationsDraft(input.jobId, input.rawOutputSha256, {
      ...deps, store: scopedStore, sendAutomatic: undefined,
      api: { run: forbidden, cancel: forbidden, reconcileSaved: async (...args) => {
        check(); sample("before_saved_session_get");
        const saved = await deps.api.reconcileSaved(...args);
        check(); sample("after_saved_session_get");
        return saved;
      } },
    });
    sample("existing_process_after_recovery");
    return { ...result, sent: false, gmailDraftCreated: false, memory: samples };
  } finally {
    try {
      if (lap) {
        pendingSettlement = lap;
        await lap.release();
        pendingSettlement = null;
      }
    } finally { active = false; }
  }
}
