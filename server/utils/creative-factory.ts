import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  buildCreativeCampaignKit,
} from "./creative-pipeline";
import { getActiveExperimentRollouts } from "./experiment-ops";
import { summarizeRecentContentOutcomeReviews } from "./content-ops";
import {
  createPaperclipIssueComment,
  upsertPaperclipIssue,
  wakePaperclipAgent,
} from "./paperclip";

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

async function latestContentReviewSignals() {
  const summary = await summarizeRecentContentOutcomeReviews({
    lookbackDays: 45,
    limit: 40,
  }).catch(() => null);

  if (!summary || summary.reviewCount === 0) {
    return [];
  }

  return [
    ...summary.workingPatterns.slice(0, 2).map((entry) => `Recent content that worked: ${entry}`),
    ...summary.failingPatterns.slice(0, 1).map((entry) => `Recent content that missed: ${entry}`),
    ...summary.recommendedNextMoves.slice(0, 1).map((entry) => `Next move to test: ${entry}`),
  ];
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
  const contentReviewSignals = await latestContentReviewSignals();
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
  const mergedSignalHighlights = [...contentReviewSignals, ...signalHighlights].slice(0, 4);

  const brief = buildAutonomousCreativeBrief({
    rolloutVariant,
    researchTopic,
    signalHighlights: mergedSignalHighlights,
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
  const handoffDescription = [
    "Execute one image-heavy creative pass for Blueprint's current Exact-Site Hosted Review wedge.",
    "",
    `Run id: ${runId}`,
    `SKU: ${brief.skuName}`,
    brief.assetGoal ? `Asset goal: ${brief.assetGoal}` : "",
    brief.audience ? `Audience: ${brief.audience}` : "",
    brief.siteType ? `Site type: ${brief.siteType}` : "",
    brief.workflow ? `Workflow: ${brief.workflow}` : "",
    rolloutVariant ? `Winning rollout variant: ${rolloutVariant}` : "",
    researchTopic ? `Research topic: ${researchTopic}` : "",
    "",
    "Allowed claims:",
    ...kit.provenanceGuardrails.map((line) => `- ${line}`),
    "",
    "Proof points:",
    ...brief.proofPoints.map((line) => `- ${line}`),
    "",
    "Buyer objections:",
    ...(buyerObjections.length > 0
      ? buyerObjections.map((line) => `- ${line}`)
      : ["- No high-signal objection cluster found in the current lookback window."]),
    "",
    "Image prompt variants:",
    ...kit.prompts.nanoBananaVariants.map((line, index) => `${index + 1}. ${line}`),
    "",
    "Video prompt for later downstream use if the image pass succeeds:",
    kit.prompts.runwayPrompt,
    "",
    "Requested next step:",
    "- Use Codex-native image generation for the visual execution.",
    "- Keep the output truthful to real Blueprint proof, capture provenance, package, and hosted-review surfaces.",
    "- Place any project-bound finals in the workspace; otherwise leave a reviewable preview path in the issue.",
  ]
    .filter(Boolean)
    .join("\n");

  let executionHandoff:
    | {
        issue_id: string | null;
        created: boolean;
        assignee: string;
        status: string;
        error: string | null;
      }
    | null = null;

  try {
    const handoff = await upsertPaperclipIssue({
      projectName: "blueprint-webapp",
      assigneeKey: "webapp-codex",
      title: `Creative image execution: ${brief.skuName}${researchTopic ? ` — ${researchTopic}` : ""}`,
      description: handoffDescription,
      priority: "high",
      status: "todo",
      originKind: "creative_factory_run",
      originId: runId,
    });

    executionHandoff = {
      issue_id: handoff.issue.id,
      created: handoff.created,
      assignee: "webapp-codex",
      status: handoff.issue.status,
      error: null,
    };

    const commentLines = [
      "Creative factory generated a prompt pack and routed image-heavy execution to `webapp-codex`.",
      `Run id: ${runId}`,
      `Asset goal: ${brief.assetGoal}`,
      "Paid image APIs are disabled by repo policy for this worker. Use Codex-native image generation in the downstream execution lane.",
    ];
    await createPaperclipIssueComment(
      handoff.issue.id,
      commentLines.join("\n"),
    ).catch(() => undefined);

    if (handoff.assigneeAgentId) {
      await wakePaperclipAgent({
        agentId: handoff.assigneeAgentId,
        companyId: handoff.companyId,
        reason: "creative_image_execution_handoff",
        payload: {
          issueId: handoff.issue.id,
          creativeFactoryRunId: runId,
        },
      }).catch(() => undefined);
    }
  } catch (error) {
    executionHandoff = {
      issue_id: null,
      created: false,
      assignee: "webapp-codex",
      status: "failed_to_route",
      error: error instanceof Error ? error.message : "Unknown Paperclip handoff failure",
    };
  }

  await runRef.set(
    {
      sku_name: brief.skuName,
      research_topic: researchTopic,
      rollout_variant: rolloutVariant,
      status: executionHandoff?.issue_id ? "execution_handoff_queued" : "prompt_pack_generated",
      kit,
      buyer_objections: buyerObjections,
      content_review_signals: contentReviewSignals,
      image_batch: [],
      runway_task: null,
      remotion_reel: null,
      execution_handoff: executionHandoff,
      created_at_iso: new Date().toISOString(),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    status: executionHandoff?.issue_id ? "execution_handoff_queued" : "prompt_pack_generated",
    runId,
    generatedImages: 0,
    runwayTaskId: null,
    remotionReelPath: null,
    remotionReelUri: null,
    executionHandoffIssueId: executionHandoff?.issue_id || null,
  };
}
