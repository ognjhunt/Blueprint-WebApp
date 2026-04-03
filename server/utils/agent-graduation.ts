import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

const COLLECTION = "agent_graduation_status";
const ACTION_LEDGER_COLLECTION = "action_ledger";
const EVALUATION_WINDOW_DAYS = 30;

const LANE_DEFINITIONS = [
  { workerKey: "waitlist", actionLane: "waitlist" },
  { workerKey: "inbound_qualification", actionLane: "inbound" },
  { workerKey: "support_triage", actionLane: "support" },
  { workerKey: "payout_exception", actionLane: "payout" },
  { workerKey: "capturer_reminders", actionLane: "capturer_comms" },
  { workerKey: "buyer_lifecycle", actionLane: "buyer_lifecycle" },
  { workerKey: "growth_campaign", actionLane: "growth_campaign" },
] as const;

type Recommendation = "hold" | "promote" | "demote";
type GraduationPhase = 1 | 2 | 3 | 4;

export interface GraduationMetrics {
  accuracy: number;
  volume: number;
  approvedCount: number;
  rejectedCount: number;
  failedCount: number;
  pendingCount: number;
  daysInPhase: number;
}

export interface GraduationRecord {
  lane: string;
  actionLane: string;
  currentPhase: GraduationPhase;
  metrics: GraduationMetrics;
  evaluationWindowDays: number;
  lastEvaluatedAt: string;
  recommendation: Recommendation;
  recommendationReason: string;
  phaseStartedAt: string;
  lastPromotionAt: string | null;
  lastPromotionBy: string | null;
  updated_at?: unknown;
}

const PROMOTION_THRESHOLDS: Record<1 | 2 | 3, { accuracy: number; volume: number; days: number }> = {
  1: { accuracy: 0.9, volume: 20, days: 14 },
  2: { accuracy: 0.95, volume: 50, days: 30 },
  3: { accuracy: 0.98, volume: 100, days: 60 },
};

function getLaneDefinition(lane: string) {
  return (
    LANE_DEFINITIONS.find((definition) => definition.workerKey === lane) ||
    { workerKey: lane, actionLane: lane }
  );
}

function toIsoDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function daysBetween(startIso: string | null, endIso: string) {
  if (!startIso) {
    return 0;
  }
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
}

function buildMetrics(actions: Array<Record<string, unknown>>, phaseStartedAt: string): GraduationMetrics {
  let approvedCount = 0;
  let rejectedCount = 0;
  let failedCount = 0;
  let pendingCount = 0;

  for (const action of actions) {
    const status = String(action.status || "").trim().toLowerCase();
    if (["sent", "auto_approved", "operator_approved"].includes(status)) {
      approvedCount += 1;
    } else if (["rejected", "operator_rejected"].includes(status)) {
      rejectedCount += 1;
    } else if (status === "failed") {
      failedCount += 1;
    } else if (["pending_approval", "draft_ready", "executing"].includes(status)) {
      pendingCount += 1;
    }
  }

  const volume = approvedCount + rejectedCount + failedCount;
  const denominator = Math.max(volume, 1);

  return {
    accuracy: volume > 0 ? approvedCount / denominator : 0,
    volume,
    approvedCount,
    rejectedCount,
    failedCount,
    pendingCount,
    daysInPhase: daysBetween(phaseStartedAt, new Date().toISOString()),
  };
}

export async function evaluateGraduationStatus(lane: string): Promise<GraduationRecord> {
  if (!db) {
    throw new Error("Database not available");
  }

  const laneDefinition = getLaneDefinition(lane);
  const docRef = db.collection(COLLECTION).doc(laneDefinition.workerKey);
  const existingSnapshot = await docRef.get();
  const existing = existingSnapshot.exists
    ? (existingSnapshot.data() as Partial<GraduationRecord>)
    : null;

  const currentPhase = (existing?.currentPhase || 1) as GraduationPhase;
  const phaseStartedAt = existing?.phaseStartedAt || existing?.lastPromotionAt || new Date().toISOString();
  const windowStart = Date.now() - EVALUATION_WINDOW_DAYS * 86_400_000;

  const actionSnapshot = await db
    .collection(ACTION_LEDGER_COLLECTION)
    .where("lane", "==", laneDefinition.actionLane)
    .get();

  const recentActions = actionSnapshot.docs
    .map((doc) => doc.data() as Record<string, unknown>)
    .filter((action) => {
      const createdAt =
        toIsoDate(action.created_at) ||
        (typeof action.created_at_iso === "string" ? action.created_at_iso : null);
      if (!createdAt) {
        return false;
      }
      const createdMs = new Date(createdAt).getTime();
      return Number.isFinite(createdMs) && createdMs >= windowStart;
    });

  const metrics = buildMetrics(recentActions, phaseStartedAt);
  let recommendation: Recommendation = "hold";
  let recommendationReason = "Lane has not yet met promotion thresholds.";

  if (currentPhase < 4) {
    const threshold = PROMOTION_THRESHOLDS[currentPhase as 1 | 2 | 3];
    if (
      metrics.accuracy >= threshold.accuracy &&
      metrics.volume >= threshold.volume &&
      metrics.daysInPhase >= threshold.days
    ) {
      recommendation = "promote";
      recommendationReason = `Accuracy ${(metrics.accuracy * 100).toFixed(1)}% and ${metrics.volume} completed actions meet the phase ${currentPhase} promotion threshold.`;
    } else {
      recommendationReason = `Needs ${(threshold.accuracy * 100).toFixed(0)}% accuracy, ${threshold.volume} completed actions, and ${threshold.days} days in phase.`;
    }
  } else {
    recommendationReason = "Lane is already at the maximum graduation phase.";
  }

  if (
    currentPhase > 1 &&
    metrics.volume >= 10 &&
    (metrics.accuracy < 0.8 || metrics.failedCount >= Math.ceil(metrics.volume * 0.2))
  ) {
    recommendation = "demote";
    recommendationReason = `Completed-action accuracy dropped to ${(metrics.accuracy * 100).toFixed(1)}% over ${metrics.volume} actions.`;
  }

  const record: GraduationRecord = {
    lane: laneDefinition.workerKey,
    actionLane: laneDefinition.actionLane,
    currentPhase,
    metrics,
    evaluationWindowDays: EVALUATION_WINDOW_DAYS,
    lastEvaluatedAt: new Date().toISOString(),
    recommendation,
    recommendationReason,
    phaseStartedAt,
    lastPromotionAt: existing?.lastPromotionAt || null,
    lastPromotionBy: existing?.lastPromotionBy || null,
  };

  await docRef.set(
    {
      ...record,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return record;
}

export async function runGraduationEvaluation(params?: {
  limit?: number;
}): Promise<{ processedCount: number; failedCount: number }> {
  const lanes = LANE_DEFINITIONS.slice(0, params?.limit || LANE_DEFINITIONS.length);
  let processedCount = 0;
  let failedCount = 0;

  for (const lane of lanes) {
    try {
      await evaluateGraduationStatus(lane.workerKey);
      processedCount += 1;
    } catch {
      failedCount += 1;
    }
  }

  return { processedCount, failedCount };
}

export async function promoteAgentLane(
  lane: string,
  promotedBy: string,
): Promise<GraduationRecord & { error?: string }> {
  if (!db) {
    throw new Error("Database not available");
  }

  const laneDefinition = getLaneDefinition(lane);
  const ref = db.collection(COLLECTION).doc(laneDefinition.workerKey);
  const snapshot = await ref.get();
  const existing = snapshot.exists ? (snapshot.data() as Partial<GraduationRecord>) : null;
  const currentPhase = (existing?.currentPhase || 1) as GraduationPhase;

  if (currentPhase >= 4) {
    return {
      lane: laneDefinition.workerKey,
      actionLane: laneDefinition.actionLane,
      currentPhase: 4,
      metrics: existing?.metrics || {
        accuracy: 0,
        volume: 0,
        approvedCount: 0,
        rejectedCount: 0,
        failedCount: 0,
        pendingCount: 0,
        daysInPhase: 0,
      },
      evaluationWindowDays: EVALUATION_WINDOW_DAYS,
      lastEvaluatedAt: new Date().toISOString(),
      recommendation: "hold",
      recommendationReason: "Lane is already at maximum phase.",
      phaseStartedAt: existing?.phaseStartedAt || new Date().toISOString(),
      lastPromotionAt: existing?.lastPromotionAt || null,
      lastPromotionBy: existing?.lastPromotionBy || null,
      error: "Lane is already at maximum phase.",
    };
  }

  const nowIso = new Date().toISOString();
  const nextPhase = (currentPhase + 1) as GraduationPhase;
  const record: GraduationRecord = {
    lane: laneDefinition.workerKey,
    actionLane: laneDefinition.actionLane,
    currentPhase: nextPhase,
    metrics: existing?.metrics || {
      accuracy: 0,
      volume: 0,
      approvedCount: 0,
      rejectedCount: 0,
      failedCount: 0,
      pendingCount: 0,
      daysInPhase: 0,
    },
    evaluationWindowDays: EVALUATION_WINDOW_DAYS,
    lastEvaluatedAt: nowIso,
    recommendation: "hold",
    recommendationReason: `Promoted to phase ${nextPhase} by ${promotedBy}.`,
    phaseStartedAt: nowIso,
    lastPromotionAt: nowIso,
    lastPromotionBy: promotedBy,
  };

  await ref.set(
    {
      ...record,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return record;
}

export async function demoteAgentLane(
  lane: string,
  demotedBy: string,
  reason: string,
): Promise<GraduationRecord> {
  if (!db) {
    throw new Error("Database not available");
  }

  const laneDefinition = getLaneDefinition(lane);
  const ref = db.collection(COLLECTION).doc(laneDefinition.workerKey);
  const snapshot = await ref.get();
  const existing = snapshot.exists ? (snapshot.data() as Partial<GraduationRecord>) : null;
  const currentPhase = (existing?.currentPhase || 1) as GraduationPhase;
  const nextPhase = Math.max(1, currentPhase - 1) as GraduationPhase;
  const nowIso = new Date().toISOString();

  const record: GraduationRecord = {
    lane: laneDefinition.workerKey,
    actionLane: laneDefinition.actionLane,
    currentPhase: nextPhase,
    metrics: existing?.metrics || {
      accuracy: 0,
      volume: 0,
      approvedCount: 0,
      rejectedCount: 0,
      failedCount: 0,
      pendingCount: 0,
      daysInPhase: 0,
    },
    evaluationWindowDays: EVALUATION_WINDOW_DAYS,
    lastEvaluatedAt: nowIso,
    recommendation: "hold",
    recommendationReason: `Demoted to phase ${nextPhase} by ${demotedBy}: ${reason}`,
    phaseStartedAt: nowIso,
    lastPromotionAt: existing?.lastPromotionAt || null,
    lastPromotionBy: existing?.lastPromotionBy || demotedBy,
  };

  await ref.set(
    {
      ...record,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return record;
}
