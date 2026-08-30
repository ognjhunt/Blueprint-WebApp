import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { ConfiguredScenePublicOfferingCard } from "../../client/src/data/siteWorlds";
import {
  configuredSceneOfferingSchema,
  type ConfiguredSceneOffering,
} from "./configuredSceneOfferingContract";
import { withTaskEvaluationLaunchStoreTimeout } from "./taskEvaluationLaunchStore";

const COLLECTION = "taskEvaluationLaunches";

function publicCard(
  offering: ConfiguredSceneOffering,
  sourceLaunchId: string,
): ConfiguredScenePublicOfferingCard | null {
  const display = offering.public_display;
  if (
    !display
    || display.status !== "authorized"
    || (
      offering.status !== "configured_controls_pending"
      && offering.status !== "evaluation_ready"
    )
  ) return null;
  const evaluationReady = offering.status === "evaluation_ready"
    && offering.evaluation_admission?.learned_policy_evaluation_admitted === true;
  const evaluationHref = evaluationReady
    ? `/app/packs/${encodeURIComponent(sourceLaunchId)}/evaluate`
    : null;
  return {
    id: display.public_slug,
    sourceLaunchId,
    dataSource: "pipeline",
    recordKind: "configured_scene_offering",
    status: offering.status,
    title: display.title,
    summary: display.summary,
    category: display.category,
    sceneIdentity: offering.scene_identity,
    task: {
      identity: offering.task.identity,
      kind: offering.task.kind,
      strategy: offering.task.strategy,
    },
    presentation: {
      thumbnailUrl: `/api/site-worlds/${encodeURIComponent(display.public_slug)}/thumbnail`,
      derivedAppearanceEvidence: true,
      captureOrPhysicalEvidence: false,
      appearanceReviewStatus:
        offering.presentation.appearance_review_status ?? "accepted",
      ...(offering.presentation.warning_label ? {
        warningLabel: offering.presentation.warning_label,
      } : {}),
    },
    evaluationAction: {
      enabled: evaluationReady,
      label: evaluationReady ? "Configure evaluation" : "Evaluation locked until controls pass",
      href: evaluationHref,
    },
    proofBoundary: {
      configurationIsPolicyEvaluation: false,
      configurationIsDeploymentOrSafetyApproval: false,
    },
  };
}

export function parsePublicConfiguredSceneOfferingRecord(
  record: Record<string, unknown>,
  sourceLaunchId: string,
) {
  if (record.configured_scene_offering_public_visibility !== "public") return null;
  const parsed = configuredSceneOfferingSchema.safeParse(record.configured_scene_offering);
  if (!parsed.success) return null;
  const offering = parsed.data;
  if (
    record.configured_scene_offering_state !== offering.status
    || record.configured_scene_offering_digest !== offering.offering_digest
    || record.configured_scene_offering_public_slug !== offering.public_display?.public_slug
  ) return null;
  return offering.public_display
    ? { offering, card: publicCard(offering, sourceLaunchId) }
    : null;
}

async function publicOfferingDocuments(limit: number) {
  if (!db) return [];
  try {
    const snapshot = await withTaskEvaluationLaunchStoreTimeout(
      db.collection(COLLECTION)
        .where("configured_scene_offering_public_visibility", "==", "public")
        .limit(limit)
        .get(),
    );
    return snapshot.docs;
  } catch {
    return [];
  }
}

export async function listPublicConfiguredSceneOfferings(limit = 100) {
  const docs = await publicOfferingDocuments(limit);
  return docs.flatMap((document) => {
    const resolved = parsePublicConfiguredSceneOfferingRecord(
      document.data() as Record<string, unknown>,
      document.id,
    );
    return resolved?.card ? [resolved.card] : [];
  });
}

export async function getPublicConfiguredSceneOffering(publicSlug: string) {
  const docs = await publicOfferingDocuments(100);
  for (const document of docs) {
    const resolved = parsePublicConfiguredSceneOfferingRecord(
      document.data() as Record<string, unknown>,
      document.id,
    );
    if (resolved?.card?.id === publicSlug) return resolved;
  }
  return null;
}
