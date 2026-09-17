/**
 * A checkpoint is what a robot team should hand us, instead of a form.
 *
 * ## The requirement that was wrong
 *
 * The robot-team intake asks nine questions — payload, cycle time, duty cycle,
 * demonstrated success rate, object handling, lighting tolerance — and then we
 * run 550 episodes measuring those exact things. We were asking a team to
 * predict its own benchmark results, stamping the prediction `self_reported`,
 * and letting it decide who gets matched.
 *
 * A team's estimate of its own success rate is the worst data in the system,
 * and it was the gate to entering the registry at all.
 *
 * The site side already fixed the same mistake: stop asking sites to describe a
 * room, have them film it. A checkpoint is the robot-team equivalent of that
 * forty-five seconds of video — the actual artifact, from which every number we
 * were asking for is derivable by running it.
 *
 * ## What still has to be asked
 *
 * Two things, because no episode measures them:
 *
 * - **Where they can deploy.** A fact about a business, not a robot.
 * - **Whether the hardware exists.** Also a fact about the business, and it is
 *   the difference between a team we can evaluate and a roadmap.
 *
 * Everything else waits for a run.
 *
 * ## What this unlocks, which is the real point
 *
 * Once a checkpoint exists, nothing has to wait for a matching site to appear.
 * We already hold a library of reconstructed scenes. A team that registers a
 * checkpoint at noon can have real results against real deployment
 * environments by the evening, and that standing benchmark — a policy measured
 * across actual sites — is the thing robot teams cannot get anywhere else.
 *
 * The old flow made them wait for it. This hands it to them on day one.
 */

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { mergeCapability } from "./robotTeamRegistry";
import {
  ROBOT_TEAMS_COLLECTION,
  type RobotCapabilityField,
  type RobotTeamRecord,
} from "../types/robot-team-registry";

const CHECKPOINT_COLLECTION = "robotCheckpoints";

export type CheckpointRuntime = "policy_endpoint" | "container_image" | "model_artifact";

export type CheckpointStatus =
  /** Registered, not yet proven runnable. */
  | "registered"
  /** We executed it at least once. Capability can now be measured. */
  | "runnable"
  /** We tried and could not run it. The reason is on the record. */
  | "unrunnable"
  /** The team retired it. */
  | "retired";

export interface RobotCheckpoint {
  checkpointId: string;
  teamId: string;
  /** The team's own name for this policy version. */
  label: string;
  runtime: CheckpointRuntime;
  /** Endpoint URL, image reference, or artifact URI, by runtime. */
  reference: string;
  status: CheckpointStatus;
  /** Why it could not be run, when that is the status. */
  unrunnableReason: string | null;
  createdAtIso: string;
  updatedAtIso: string;
}

function nowIso() {
  return new Date().toISOString();
}

export type CheckpointRefusal =
  | "reference_missing"
  | "runtime_unsupported"
  | "store_unavailable";

export type RegisterCheckpointResult =
  | { registered: true; checkpoint: RobotCheckpoint }
  | { registered: false; refusal: CheckpointRefusal; detail: string };

/**
 * Register a checkpoint against a team.
 *
 * Deliberately does not ask for a single capability number. Whatever the team
 * believes about its payload or cycle time, the run will say, and the run is
 * what the registry will carry.
 */
export async function registerCheckpoint(params: {
  teamId: string;
  label: string;
  runtime: string;
  reference: string;
}): Promise<RegisterCheckpointResult> {
  if (!db) {
    return {
      registered: false,
      refusal: "store_unavailable",
      detail: "The checkpoint store is unavailable.",
    };
  }

  const runtime = params.runtime as CheckpointRuntime;
  if (!["policy_endpoint", "container_image", "model_artifact"].includes(runtime)) {
    return {
      registered: false,
      refusal: "runtime_unsupported",
      detail: `Runtime "${params.runtime}" is not one we can execute.`,
    };
  }

  const reference = params.reference.trim();
  if (!reference) {
    return {
      registered: false,
      refusal: "reference_missing",
      detail: "A checkpoint needs something we can actually run: an endpoint, an image, or an artifact.",
    };
  }

  const checkpointId = `ckpt_${params.teamId}_${Date.now().toString(36)}`;
  const checkpoint: RobotCheckpoint = {
    checkpointId,
    teamId: params.teamId,
    label: params.label.trim() || checkpointId,
    runtime,
    reference,
    status: "registered",
    unrunnableReason: null,
    createdAtIso: nowIso(),
    updatedAtIso: nowIso(),
  };

  await db.collection(CHECKPOINT_COLLECTION).doc(checkpointId).set(checkpoint);
  return { registered: true, checkpoint };
}

export async function listCheckpoints(teamId: string): Promise<RobotCheckpoint[]> {
  if (!db) return [];
  const snapshot = await db
    .collection(CHECKPOINT_COLLECTION)
    .where("teamId", "==", teamId)
    .get();
  return snapshot.docs.map((doc) => doc.data() as RobotCheckpoint);
}

export async function getCheckpoint(checkpointId: string): Promise<RobotCheckpoint | null> {
  if (!db) return null;
  const snapshot = await db.collection(CHECKPOINT_COLLECTION).doc(checkpointId).get();
  return snapshot.exists ? (snapshot.data() as RobotCheckpoint) : null;
}

export async function markCheckpointStatus(params: {
  checkpointId: string;
  status: CheckpointStatus;
  unrunnableReason?: string | null;
}): Promise<void> {
  if (!db) return;
  await db.collection(CHECKPOINT_COLLECTION).doc(params.checkpointId).set(
    {
      status: params.status,
      unrunnableReason: params.unrunnableReason ?? null,
      updatedAtIso: nowIso(),
    },
    { merge: true },
  );
}

/**
 * Write what a run actually measured onto the team's capability record.
 *
 * This is the function that makes the whole inversion real. `GRADE_RANK` already
 * puts `measured` above `self_reported`, and `mergeCapability` already refuses
 * to let a worse-graded figure overwrite a better one — but until now nothing
 * in the codebase ever wrote `measured`, so every capability in the registry was
 * somebody's estimate of their own robot.
 *
 * Once a run writes here, the team's own answer for that field is superseded
 * automatically and permanently. No migration, no deletion: the self-reported
 * number simply stops winning, which is exactly what should happen the moment
 * someone measures it.
 */
export async function recordMeasuredCapability(params: {
  teamId: string;
  checkpointId: string;
  runId: string;
  /** Only fields the run genuinely established. Absent means not measured. */
  measured: Partial<Record<RobotCapabilityField, string | number | null>>;
}): Promise<RobotTeamRecord | null> {
  if (!db) return null;

  const ref = db.collection(ROBOT_TEAMS_COLLECTION).doc(params.teamId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const existing = snapshot.data() as RobotTeamRecord;

  const { capability, fieldProvenance, changed } = mergeCapability(existing, params.measured, {
    grade: "measured",
    source: `evaluationRun:${params.runId}#${params.checkpointId}`,
  });

  if (!changed.length) return existing;

  const record: RobotTeamRecord = {
    ...existing,
    capability,
    fieldProvenance,
    updatedAt: nowIso(),
  };

  await ref.set({ ...record }, { merge: true });
  return record;
}
