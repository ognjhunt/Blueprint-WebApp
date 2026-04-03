import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  buildCreativeCampaignKit,
  type ProductReelImage,
} from "./creative-pipeline";
import { generateGoogleCreativeImages } from "./google-creative";
import { startRunwayImageToVideoTask, type RunwayTaskRecord } from "./runway";
import { getActiveExperimentRollouts } from "./experiment-ops";
import { renderProductReel } from "./remotion-render";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function startOfUtcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

async function latestResearchRun() {
  if (!db) return null;
  const snapshot = await db
    .collection("autonomous_growth_runs")
    .orderBy("created_at", "desc")
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as Record<string, unknown>;
}

const OBJECTION_SIGNAL_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: "pricing and commercial clarity",
    pattern: /\b(price|pricing|cost|quote|budget|commercial|contract|discount)\b/i,
  },
  {
    label: "rights, privacy, and security review",
    pattern: /\b(privacy|legal|rights|security|compliance|consent|gdpr|hipaa)\b/i,
  },
  {
    label: "proof that the review is tied to a real site",
    pattern: /\b(proof|provenance|real site|real facility|grounded|capture-backed)\b/i,
  },
  {
    label: "what outputs and hosted-review artifacts the buyer gets",
    pattern: /\b(output|deliverable|artifact|manifest|hosted review|package|export)\b/i,
  },
  {
    label: "how to book the hosted review without another site visit",
    pattern: /\b(book|booking|schedule|demo|meeting|call|travel|site visit)\b/i,
  },
];

function objectionLabelsFromCategory(category: string) {
  switch (category) {
    case "commercial_handoff":
      return ["pricing and commercial clarity"];
    case "policy_handoff":
      return ["rights, privacy, and security review"];
    case "booking":
      return ["how to book the hosted review without another site visit"];
    case "product_explainer":
      return ["what outputs and hosted-review artifacts the buyer gets"];
    default:
      return [];
  }
}

function extractObjectionLabelsFromText(text: string) {
  return OBJECTION_SIGNAL_PATTERNS
    .filter(({ pattern }) => pattern.test(text))
    .map(({ label }) => label);
}

async function latestBuyerObjections() {
  if (!db) return [];

  const counts = new Map<string, number>();
  const threshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let snapshot:
    | {
        docs: Array<{ data: () => Record<string, unknown> }>;
      }
    | null = null;

  try {
    snapshot = await db
      .collection("contactRequests")
      .where("createdAt", ">=", threshold)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
  } catch {
    snapshot = await db.collection("contactRequests").limit(100).get();
  }

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const directCategory = normalizeString(data.objection_category);
    const voiceCategory =
      data.voice_concierge && typeof data.voice_concierge === "object"
        ? normalizeString((data.voice_concierge as Record<string, unknown>).category)
        : "";
    const labels = new Set<string>([
      ...objectionLabelsFromCategory(directCategory),
      ...objectionLabelsFromCategory(voiceCategory),
    ]);

    const textBlob = [
      normalizeString(data.message),
      normalizeString(data.summary),
      normalizeString(data.notes),
      normalizeString(data.pageContext),
      data.voice_concierge && typeof data.voice_concierge === "object"
        ? normalizeString(
            (data.voice_concierge as Record<string, unknown>).last_user_message,
          )
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    for (const label of extractObjectionLabelsFromText(textBlob)) {
      labels.add(label);
    }

    for (const label of labels) {
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 3)
    .map(([label]) => label);
}

function buildAutonomousCreativeBrief(params: {
  rolloutVariant?: string | null;
  researchTopic?: string | null;
  signalHighlights: string[];
  buyerObjections: string[];
}) {
  const siteType = normalizeString(process.env.BLUEPRINT_CREATIVE_FACTORY_SITE_TYPE) || "warehouse";
  const workflow =
    normalizeString(process.env.BLUEPRINT_CREATIVE_FACTORY_WORKFLOW)
    || "pre-deployment site review";
  const audience =
    normalizeString(process.env.BLUEPRINT_CREATIVE_FACTORY_AUDIENCE)
    || "robotics deployment leads";
  const skuName =
    normalizeString(process.env.BLUEPRINT_CREATIVE_FACTORY_SKU)
    || "Exact-Site Hosted Review";
  const callToAction =
    normalizeString(process.env.BLUEPRINT_CREATIVE_FACTORY_CTA)
    || "Book a 30-minute exact-site hosted-review scoping call.";

  const proofPoints = [
    "One real facility, not a synthetic stand-in.",
    "Hosted review and package access tied to the same capture provenance.",
    ...(params.rolloutVariant ? [`Current winning proof angle: ${params.rolloutVariant.replace(/_/g, " ")}.`] : []),
    ...params.signalHighlights.slice(0, 3),
  ];

  return {
    skuName,
    audience: params.researchTopic
      ? `${audience} researching ${params.researchTopic}`
      : audience,
    siteType,
    workflow,
    callToAction,
    assetGoal: "landing_page" as const,
    proofPoints,
    differentiators: [
      "Rights and provenance stay explicit.",
      "Human gates remain on pricing, legal, privacy, and contracts.",
      "The hosted review is grounded on the exact site question, not a broad platform pitch.",
    ],
    buyerObjections: params.buyerObjections,
  };
}

export async function runCreativeAssetFactoryLoop() {
  if (!db) {
    throw new Error("Database not available");
  }

  const today = startOfUtcDay();
  const rollouts = await getActiveExperimentRollouts();
  const researchRun = await latestResearchRun();
  const buyerObjections = await latestBuyerObjections();
  const runwayVideoModel =
    normalizeString(process.env.BLUEPRINT_RUNWAY_VIDEO_MODEL) || "gen4_turbo";
  const rolloutVariant = rollouts.exact_site_hosted_review_hero_v1 || null;
  const researchTopic = normalizeString(researchRun?.topic) || null;
  const signalHighlights = Array.isArray(researchRun?.signals)
    ? researchRun!.signals
        .slice(0, 3)
        .map((signal) =>
          signal && typeof signal === "object"
            ? `${normalizeString((signal as Record<string, unknown>).title)}: ${normalizeString((signal as Record<string, unknown>).summary)}`
            : "",
        )
        .filter(Boolean)
    : [];

  const brief = buildAutonomousCreativeBrief({
    rolloutVariant,
    researchTopic,
    signalHighlights,
    buyerObjections,
  });
  const runId = `${today}__${slugify(`${brief.skuName}-${researchTopic || "default"}`)}`;
  const runRef = db.collection("creative_factory_runs").doc(runId);
  const existing = await runRef.get();
  if (existing.exists) {
    return {
      status: "skipped_existing",
      runId,
    };
  }

  const kit = buildCreativeCampaignKit(brief);
  let imageBatch: Array<{ prompt: string; images: ProductReelImage[] }> = [];
  let runwayTask: RunwayTaskRecord | null = null;
  let remotionReel:
    | {
        status: "rendered" | "failed";
        output_path: string | null;
        storage_uri: string | null;
        duration_seconds: number | null;
        frames: number | null;
        error: string | null;
      }
    | null = null;

  for (const prompt of kit.prompts.nanoBananaVariants.slice(0, 3)) {
    try {
      const generated = await generateGoogleCreativeImages({
        prompt,
        aspectRatio: "16:9",
        imageSize: "1K",
        thinkingLevel: "HIGH",
        sampleCount: 1,
      });
      imageBatch.push({
        prompt,
        images: generated.images.map((image) => ({
          mimeType: image.mimeType,
          dataUrl: image.dataUrl,
        })),
      });
    } catch {
      // Keep the prompt pack even when provider execution is unavailable.
    }
  }

  const firstImage = imageBatch[0]?.images[0]?.dataUrl || null;
  if (firstImage) {
    try {
      const task = await startRunwayImageToVideoTask({
        promptText: kit.prompts.runwayPrompt,
        promptImage: firstImage,
        model: runwayVideoModel,
        ratio: "1280:720",
        duration: 5,
      });
      runwayTask = task;
    } catch {
      runwayTask = null;
    }
  }

  const remotionImages = imageBatch.flatMap((entry) => entry.images).slice(0, 4);
  if (remotionImages.length > 0) {
    try {
      const reel = await renderProductReel({
        storyboard: kit.remotionStoryboard,
        images: remotionImages,
        runwayVideoUrl:
          Array.isArray(runwayTask?.output) && runwayTask?.output[0]
            ? typeof runwayTask.output[0] === "string"
              ? runwayTask.output[0]
              : normalizeString(runwayTask.output[0]?.url)
            : null,
        fps: 30,
        width: 1280,
        height: 720,
        storageObjectPath: `creative-factory/${runId}/product-reel.mp4`,
      });
      remotionReel = {
        status: "rendered",
        output_path: reel.outputPath,
        storage_uri: reel.storageUri || null,
        duration_seconds: reel.durationSeconds,
        frames: reel.frames,
        error: null,
      };
    } catch (error) {
      remotionReel = {
        status: "failed",
        output_path: null,
        storage_uri: null,
        duration_seconds: null,
        frames: null,
        error: error instanceof Error ? error.message : "Unknown Remotion render failure",
      };
    }
  }

  await runRef.set(
    {
      sku_name: brief.skuName,
      research_topic: researchTopic,
      rollout_variant: rolloutVariant,
      status: firstImage ? "assets_generated" : "prompt_pack_generated",
      kit,
      buyer_objections: buyerObjections,
      image_batch: imageBatch,
      runway_task: runwayTask,
      remotion_reel: remotionReel,
      created_at_iso: new Date().toISOString(),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    status: firstImage ? "assets_generated" : "prompt_pack_generated",
    runId,
    generatedImages: imageBatch.length,
    runwayTaskId:
      runwayTask && typeof runwayTask.id === "string" ? runwayTask.id : null,
    remotionReelPath: remotionReel?.output_path || null,
    remotionReelUri: remotionReel?.storage_uri || null,
  };
}
