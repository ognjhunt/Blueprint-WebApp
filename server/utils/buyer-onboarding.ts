import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { executeAction } from "../agents/action-executor";
import { SUPPORT_POLICY } from "../agents/action-policies";

const COLLECTION = "onboarding_sequences";

function serverTimestampValue() {
  return admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date();
}

type OnboardingStepKey = "welcome" | "checkin_day3" | "activation_day7";

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
      key: "welcome",
      scheduledAt: new Date(now).toISOString(),
      sentAt: null,
      status: "pending",
      emailSubject: `Your ${params.skuName} order is in motion`,
      emailBody: [
        `Thanks for purchasing ${params.skuName} on the ${params.licenseTier} tier.`,
        "",
        "Blueprint is now moving the exact-site package through provisioning. The next steps keep the site truth, capture provenance, and hosted-review path tied to the same facility instead of scattering the work across separate systems.",
        "",
        "If your team needs a walkthrough of the exact-site package or wants to flag a blocker early, reply here and Blueprint will route it to the right operator.",
      ].join("\n"),
    },
    {
      key: "checkin_day3",
      scheduledAt: new Date(now + 3 * 86_400_000).toISOString(),
      sentAt: null,
      status: "pending",
      emailSubject: `Quick check on your ${params.skuName}`,
      emailBody: [
        `Three days in, most teams have opened ${params.skuName} and started checking the site provenance, workflow lane, and any hosted-review questions that need follow-up.`,
        "",
        "If your team has not accessed the package yet, or if the exact-site scope needs adjustment before the next step, reply with the blocker and Blueprint will route it for review.",
      ].join("\n"),
    },
    {
      key: "activation_day7",
      scheduledAt: new Date(now + 7 * 86_400_000).toISOString(),
      sentAt: null,
      status: "pending",
      emailSubject: `Week-one activation ideas for ${params.skuName}`,
      emailBody: [
        `A week after purchase, the useful next move is usually one of three things: review the hosted environment, export the site package into the buyer stack, or identify the next exact-site question the team needs answered.`,
        "",
        "If a hosted walkthrough or another exact-site review would help, reply with the deployment question and Blueprint will tee up the right follow-up path.",
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
