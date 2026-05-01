import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { executeAction } from "../agents/action-executor";
import { SUPPORT_POLICY } from "../agents/action-policies";

const COLLECTION = "onboarding_sequences";

function serverTimestampValue() {
  return admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date();
}

type OnboardingStepKey =
  | "access_day1"
  | "first_run_day3"
  | "blockers_day10"
  | "feedback_day21";

interface OnboardingStep {
  key: OnboardingStepKey;
  scheduledAt: string;
  sentAt: string | null;
  status: "pending" | "sent" | "skipped";
  emailSubject: string;
  emailBody: string;
}

interface OnboardingSequence {
  orderId: string;
  buyerEmail: string;
  skuName: string;
  licenseTier: string;
  status: "active" | "completed" | "paused";
  steps: OnboardingStep[];
  createdAt: string;
  completedAt: string | null;
}

export interface CreateOnboardingParams {
  orderId: string;
  buyerEmail: string;
  skuName: string;
  licenseTier: string;
}

function buildOnboardingSteps(params: CreateOnboardingParams): OnboardingStep[] {
  const now = Date.now();

  return [
    {
      key: "access_day1",
      scheduledAt: new Date(now).toISOString(),
      sentAt: null,
      status: "pending",
      emailSubject: `Confirming access for ${params.skuName}`,
      emailBody: [
        `Thanks for starting ${params.skuName} on the ${params.licenseTier} tier.`,
        "",
        "Day 1 is about access, not a broad status update: confirm that your team can open the site-world, see the capture provenance, and reach the hosted-review or session workspace tied to the same exact site.",
        "",
        "If access is blocked, reply with the page, account email, and exact site. Blueprint will route it as a buyer-success issue instead of treating it as a new sales request.",
      ].join("\n"),
    },
    {
      key: "first_run_day3",
      scheduledAt: new Date(now + 3 * 86_400_000).toISOString(),
      sentAt: null,
      status: "pending",
      emailSubject: `First-session check for ${params.skuName}`,
      emailBody: [
        `Three days in, the useful signal is whether your team has loaded ${params.skuName}, inspected the site-world, and run or reviewed at least one hosted session path.`,
        "",
        "If the runtime, camera view, export path, or provenance trail is unclear, reply with the blocker and the robot/workflow you were testing. Blueprint will route the issue to the right owner.",
      ].join("\n"),
    },
    {
      key: "blockers_day10",
      scheduledAt: new Date(now + 10 * 86_400_000).toISOString(),
      sentAt: null,
      status: "pending",
      emailSubject: `Blocker check for ${params.skuName}`,
      emailBody: [
        `Ten days after delivery, the key question is whether ${params.skuName} is helping your team make the exact-site decision it was meant to support.`,
        "",
        "Reply with any blocker, missing artifact, data-quality concern, rights/privacy question, or export issue. Blueprint will keep the response tied to the current site package and hosted-review evidence.",
      ].join("\n"),
    },
    {
      key: "feedback_day21",
      scheduledAt: new Date(now + 21 * 86_400_000).toISOString(),
      sentAt: null,
      status: "pending",
      emailSubject: `Day-21 feedback for ${params.skuName}`,
      emailBody: [
        `At day 21, Blueprint needs the practical readout from your team: what worked, what did not, and what would make ${params.skuName} more useful in your stack.`,
        "",
        "A good reply can be short: one useful artifact, one missing output, one friction point, and the next exact-site or workflow question your team wants answered.",
        "",
        "If the next move is another site, additional modality, broader coverage, or a deeper managed review, say that plainly and Blueprint will hand it back to the right commercial owner.",
      ].join("\n"),
    },
  ];
}

export async function createOnboardingSequence(params: CreateOnboardingParams): Promise<void> {
  if (!db || !params.orderId || !params.buyerEmail) {
    return;
  }

  const ref = db.collection(COLLECTION).doc(params.orderId);
  const existing = await ref.get();
  if (existing.exists) {
    return;
  }

  const sequence: OnboardingSequence = {
    orderId: params.orderId,
    buyerEmail: params.buyerEmail,
    skuName: params.skuName,
    licenseTier: params.licenseTier,
    status: "active",
    steps: buildOnboardingSteps(params),
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  await ref.set({
    ...sequence,
    created_at: serverTimestampValue(),
  });
}

export async function runOnboardingWorker(params?: {
  limit?: number;
}): Promise<{ processedCount: number; failedCount: number }> {
  if (!db) {
    throw new Error("Database not available");
  }

  const snapshot = await db.collection(COLLECTION).where("status", "==", "active").limit(params?.limit || 25).get();
  let processedCount = 0;
  let failedCount = 0;
  const nowIso = new Date().toISOString();

  for (const doc of snapshot.docs) {
    const data = doc.data() as OnboardingSequence;
    let mutated = false;

    for (const step of data.steps) {
      if (step.status !== "pending" || step.scheduledAt > nowIso) {
        continue;
      }

      try {
        const result = await executeAction({
          sourceCollection: COLLECTION,
          sourceDocId: data.orderId,
          actionType: "send_email",
          actionPayload: {
            type: "send_email",
            to: data.buyerEmail,
            subject: step.emailSubject,
            body: step.emailBody,
          },
          safetyPolicy: SUPPORT_POLICY,
          draftOutput: {
            recommendation: "onboarding_follow_up",
            confidence: 0.95,
            category: "general_support",
            priority: "normal",
            requires_human_review: false,
          },
          idempotencyKey: `onboarding:${data.orderId}:${step.key}`,
        });

        if (["sent", "auto_approved", "operator_approved", "executing"].includes(result.state)) {
          step.status = "sent";
          step.sentAt = new Date().toISOString();
          mutated = true;
          processedCount += 1;
        }
      } catch {
        failedCount += 1;
      }
    }

    if (!mutated) {
      continue;
    }

    const completed = data.steps.every((step) => step.status !== "pending");
    await doc.ref.set(
      {
        steps: data.steps,
        status: completed ? "completed" : "active",
        completedAt: completed ? new Date().toISOString() : null,
        updated_at: serverTimestampValue(),
      },
      { merge: true },
    );
  }

  return { processedCount, failedCount };
}
