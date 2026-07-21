import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { executeAction } from "../agents/action-executor";
import { SUPPORT_POLICY } from "../agents/action-policies";
import { getConfiguredEnvValue } from "../config/env";
import { sendSlackMessage } from "./slack";

const COLLECTION = "sla_tracking";

type SlaStageKey = "scoping" | "upload_to_package" | "packaging" | "delivery" | "review_setup";
type SlaStatus = "on_track" | "at_risk" | "breached" | "completed";

interface SlaEscalation {
  type: "warning" | "breach";
  channel: "slack" | "email";
  sentAt: string;
  message: string;
}

interface SlaStage {
  key: SlaStageKey;
  slaHours: number;
  startedAt: string | null;
  deadline: string | null;
  completedAt: string | null;
  status: "pending" | "active" | "completed" | "at_risk" | "breached";
  escalations: SlaEscalation[];
}

interface SlaTracker {
  requestId: string;
  buyerEmail: string;
  currentStage: SlaStageKey | "completed";
  stages: SlaStage[];
  status: SlaStatus;
  createdAt: string;
  completedAt: string | null;
}

const CUSTOMER_FACING_SLA_STATUS_COPY: Record<SlaStatus, {
  label: string;
  message: string;
  operatorAction: string;
}> = {
  on_track: {
    label: "On track",
    message: "Your request is moving through Blueprint's package workflow.",
    operatorAction: "Keep the current owner and next milestone current.",
  },
  at_risk: {
    label: "Running close",
    message: "Your request is taking longer than planned. Blueprint ops is reviewing the blocker before the deadline.",
    operatorAction: "Review the active stage, add a buyer-visible note, and clear or escalate the blocker.",
  },
  breached: {
    label: "Delayed",
    message: "Your request missed its target window. Blueprint ops must send an updated ETA and blocker summary.",
    operatorAction: "Escalate to the incident owner, send an updated ETA, and record the recovery plan.",
  },
  completed: {
    label: "Completed",
    message: "Your request has completed the tracked package workflow.",
    operatorAction: "Confirm final delivery/access evidence is attached.",
  },
};

const SLA_STAGES: Array<{ key: SlaStageKey; slaHours: number }> = [
  { key: "scoping", slaHours: 24 },
  { key: "upload_to_package", slaHours: 48 },
  { key: "packaging", slaHours: 48 },
  { key: "delivery", slaHours: 72 },
  { key: "review_setup", slaHours: 24 },
];

function buildInitialStages() {
  const now = new Date();
  return SLA_STAGES.map((stage, index): SlaStage => ({
    key: stage.key,
    slaHours: stage.slaHours,
    startedAt: index === 0 ? now.toISOString() : null,
    deadline: index === 0 ? new Date(now.getTime() + stage.slaHours * 3_600_000).toISOString() : null,
    completedAt: null,
    status: index === 0 ? "active" : "pending",
    escalations: [],
  }));
}

export async function createSlaTracker(params: {
  requestId: string;
  buyerEmail: string;
}): Promise<void> {
  if (!db || !params.requestId) {
    return;
  }

  const ref = db.collection(COLLECTION).doc(params.requestId);
  const existing = await ref.get();
  if (existing.exists) {
    return;
  }

  const now = new Date().toISOString();
  const stages = buildInitialStages();
  const tracker: SlaTracker = {
    requestId: params.requestId,
    buyerEmail: params.buyerEmail,
    currentStage: "scoping",
    stages,
    status: "on_track",
    createdAt: now,
    completedAt: null,
  };

  await ref.set({
    requestId: params.requestId,
    buyerEmail: params.buyerEmail,
    currentStage: "scoping",
    stages,
    status: "on_track" as SlaStatus,
    customerFacingStatus: buildCustomerFacingSlaStatus(tracker),
    createdAt: now,
    completedAt: null,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function activeStageFor(tracker: SlaTracker): SlaStage | null {
  return tracker.stages.find((stage) =>
    ["active", "at_risk", "breached"].includes(stage.status),
  ) || null;
}

export function buildCustomerFacingSlaStatus(tracker: SlaTracker) {
  const copy = CUSTOMER_FACING_SLA_STATUS_COPY[tracker.status] || CUSTOMER_FACING_SLA_STATUS_COPY.on_track;
  const activeStage = activeStageFor(tracker);
  return {
    status: tracker.status,
    label: copy.label,
    message: copy.message,
    operator_action: copy.operatorAction,
    active_stage: activeStage?.key || tracker.currentStage,
    deadline: activeStage?.deadline || null,
  };
}

function serializeOperatorSlaTracker(id: string, tracker: SlaTracker) {
  const activeStage = activeStageFor(tracker);
  return {
    id,
    request_id: tracker.requestId,
    buyer_email: tracker.buyerEmail,
    status: tracker.status,
    current_stage: tracker.currentStage,
    active_stage: activeStage,
    stages: tracker.stages,
    customer_facing_status: buildCustomerFacingSlaStatus(tracker),
    created_at: tracker.createdAt,
    completed_at: tracker.completedAt,
  };
}

export async function listOperatorSlaTrackers(params: {
  status?: SlaStatus | "all";
  stage?: SlaStageKey | "all";
  limit?: number;
} = {}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const limit = Math.max(1, Math.min(params.limit || 50, 200));
  const status = params.status && params.status !== "all" ? params.status : null;
  const stage = params.stage && params.stage !== "all" ? params.stage : null;
  const query = status
    ? db.collection(COLLECTION).where("status", "==", status)
    : db.collection(COLLECTION).where("status", "in", ["on_track", "at_risk", "breached"]);
  const snapshot = await query.limit(limit).get();
  const trackers = snapshot.docs
    .map((doc) => serializeOperatorSlaTracker(doc.id, doc.data() as SlaTracker))
    .filter((tracker) => !stage || tracker.active_stage?.key === stage || tracker.current_stage === stage);

  return {
    trackers,
    filters: {
      status: status || "active",
      stage: stage || "all",
      limit,
    },
    customer_status_semantics: CUSTOMER_FACING_SLA_STATUS_COPY,
  };
}

export async function advanceSlaStage(requestId: string): Promise<void> {
  if (!db) {
    throw new Error("Database not available");
  }

  const ref = db.collection(COLLECTION).doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error(`SLA tracker not found: ${requestId}`);
  }

  const tracker = snapshot.data() as SlaTracker;
  const currentIndex = tracker.stages.findIndex((stage) =>
    ["active", "at_risk", "breached"].includes(stage.status),
  );

  if (currentIndex === -1) {
    return;
  }

  const now = new Date();
  tracker.stages[currentIndex].status = "completed";
  tracker.stages[currentIndex].completedAt = now.toISOString();

  const nextStage = tracker.stages[currentIndex + 1];
  if (nextStage) {
    nextStage.status = "active";
    nextStage.startedAt = now.toISOString();
    nextStage.deadline = new Date(now.getTime() + nextStage.slaHours * 3_600_000).toISOString();
  }

  await ref.set(
    {
      stages: tracker.stages,
      currentStage: nextStage ? nextStage.key : "completed",
      status: nextStage ? "on_track" : "completed",
      completedAt: nextStage ? null : now.toISOString(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function runSlaWatchdog(params?: {
  limit?: number;
}): Promise<{ processedCount: number; failedCount: number }> {
  if (!db) {
    throw new Error("Database not available");
  }

  const snapshot = await db
    .collection(COLLECTION)
    .where("status", "in", ["on_track", "at_risk"])
    .limit(params?.limit || 50)
    .get();

  let processedCount = 0;
  let failedCount = 0;
  const supportEmail = getConfiguredEnvValue("BLUEPRINT_SUPPORT_EMAIL") || "ops@tryblueprint.io";

  for (const doc of snapshot.docs) {
    const tracker = doc.data() as SlaTracker;
    const activeStage = tracker.stages.find((stage) =>
      ["active", "at_risk"].includes(stage.status),
    );
    if (!activeStage?.startedAt || !activeStage.deadline) {
      continue;
    }

    const startedAtMs = new Date(activeStage.startedAt).getTime();
    const deadlineMs = new Date(activeStage.deadline).getTime();
    if (!Number.isFinite(startedAtMs) || !Number.isFinite(deadlineMs)) {
      continue;
    }

    const elapsed = Date.now() - startedAtMs;
    const total = deadlineMs - startedAtMs;
    if (total <= 0) {
      continue;
    }

    const utilization = elapsed / total;

    try {
      if (utilization >= 1 && activeStage.status !== "breached") {
        const message = `SLA breach: ${tracker.requestId} exceeded the ${activeStage.key} deadline.`;
        activeStage.status = "breached";
        activeStage.escalations.push({
          type: "breach",
          channel: "email",
          sentAt: new Date().toISOString(),
          message,
        });

        await Promise.allSettled([
          executeAction({
            sourceCollection: COLLECTION,
            sourceDocId: tracker.requestId,
            actionType: "send_email",
            actionPayload: {
              type: "send_email",
              to: supportEmail,
              subject: `SLA breach: ${activeStage.key}`,
              body: `${message}\n\nBuyer: ${tracker.buyerEmail}\nStage SLA: ${activeStage.slaHours} hours.`,
            },
            safetyPolicy: SUPPORT_POLICY,
            draftOutput: {
              recommendation: "sla_breach",
              confidence: 0.99,
              category: "general_support",
              priority: "normal",
              requires_human_review: false,
            },
            idempotencyKey: `sla:breach:${tracker.requestId}:${activeStage.key}`,
          }),
          sendSlackMessage(message),
        ]);

        await doc.ref.set(
          {
            stages: tracker.stages,
            status: "breached" as SlaStatus,
            customerFacingStatus: buildCustomerFacingSlaStatus({
              ...tracker,
              status: "breached",
              stages: tracker.stages,
            }),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        processedCount += 1;
      } else if (utilization >= 0.8 && activeStage.status === "active") {
        const message = `SLA at risk: ${tracker.requestId} is ${Math.round(utilization * 100)}% through ${activeStage.key}.`;
        activeStage.status = "at_risk";
        activeStage.escalations.push({
          type: "warning",
          channel: "email",
          sentAt: new Date().toISOString(),
          message,
        });

        await Promise.allSettled([
          executeAction({
            sourceCollection: COLLECTION,
            sourceDocId: tracker.requestId,
            actionType: "send_email",
            actionPayload: {
              type: "send_email",
              to: supportEmail,
              subject: `SLA at risk: ${activeStage.key}`,
              body: `${message}\n\nBuyer: ${tracker.buyerEmail}\nDeadline: ${activeStage.deadline}.`,
            },
            safetyPolicy: SUPPORT_POLICY,
            draftOutput: {
              recommendation: "sla_warning",
              confidence: 0.96,
              category: "general_support",
              priority: "normal",
              requires_human_review: false,
            },
            idempotencyKey: `sla:warning:${tracker.requestId}:${activeStage.key}`,
          }),
          sendSlackMessage(message),
        ]);

        await doc.ref.set(
          {
            stages: tracker.stages,
            status: "at_risk" as SlaStatus,
            customerFacingStatus: buildCustomerFacingSlaStatus({
              ...tracker,
              status: "at_risk",
              stages: tracker.stages,
            }),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        processedCount += 1;
      }
    } catch {
      failedCount += 1;
    }
  }

  return { processedCount, failedCount };
}
