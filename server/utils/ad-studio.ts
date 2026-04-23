import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createPausedMetaDraft, type CreatePausedMetaDraftInput } from "./meta-marketing";
import {
  createPaperclipIssueComment,
  upsertPaperclipIssue,
  wakePaperclipAgent,
} from "./paperclip";
import { startRunwayImageToVideoTask } from "./runway";

export type AdStudioLane = "capturer" | "buyer";

export type AdStudioRunStatus =
  | "draft_requested"
  | "brief_ready"
  | "image_prompt_ready"
  | "video_pending"
  | "review_pending"
  | "failed_claims_review"
  | "draft_safe"
  | "meta_draft_created"
  | "blocked_missing_brief_contract"
  | "blocked_asset_incomplete";

export interface CreateAdStudioRunInput {
  lane: AdStudioLane;
  audience: string;
  cta: string;
  budgetCapUsd: number;
  city?: string | null;
  allowedClaims: string[];
  blockedClaims: string[];
  aspectRatio: string;
}

export interface AdStudioClaimsLedger {
  allowedClaims: string[];
  blockedClaims: string[];
  evidenceLinks: string[];
  reviewDecision: "pending" | "approved" | "rejected";
  reviewNotes: string[];
}

export interface AdStudioMetaDraft {
  campaignId: string | null;
  adSetId: string | null;
  adId: string | null;
  status: "not_created" | "paused_created";
}

export interface AdStudioRunRecord {
  id: string;
  lane: AdStudioLane;
  audience: string;
  cta: string;
  budgetCapUsd: number;
  city: string | null;
  aspectRatio: string;
  status: AdStudioRunStatus;
  claimsLedger: AdStudioClaimsLedger;
  brief: AdStudioBrief | null;
  promptPack: AdStudioPromptPack | null;
  assets: AdStudioAssetRecord[];
  imageExecutionHandoff: AdStudioExecutionHandoff | null;
  videoTask: AdStudioVideoTaskRecord | null;
  review: AdStudioReviewRecord;
  metaDraft: AdStudioMetaDraft;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface AdStudioBrief {
  lane: AdStudioLane;
  visualDirection: string;
  copyHooks: string[];
  claimsLedger: AdStudioClaimsLedger;
}

export interface ReviewAdStudioCreativeInput {
  headline: string;
  primaryText: string;
  claimsLedger: Pick<AdStudioClaimsLedger, "allowedClaims" | "blockedClaims" | "evidenceLinks">;
}

export interface ReviewAdStudioCreativeResult {
  status: "draft_safe" | "failed_claims_review";
  reasons: string[];
}

export interface QueueAdStudioVideoInput {
  runId: string;
  promptText: string;
  firstFrameUrl: string;
  ratio: string;
}

export interface AdStudioPromptPack {
  imagePromptVariants: string[];
  videoPrompt: string;
  headlineOptions: string[];
  primaryTextOptions: string[];
}

export interface AdStudioAssetRecord {
  type: "image" | "video";
  role: string;
  uri: string;
  provider: string;
  prompt?: string | null;
  createdAtIso: string;
}

export interface AdStudioExecutionHandoff {
  issueId: string | null;
  status: string;
  assignee: string;
  error: string | null;
}

export interface AdStudioVideoTaskRecord {
  taskId: string | null;
  status: string;
  firstFrameUrl: string | null;
  ratio: string | null;
  promptText: string | null;
}

export interface AdStudioReviewRecord {
  status: "pending" | "draft_safe" | "failed_claims_review";
  reasons: string[];
  headline: string | null;
  primaryText: string | null;
}

export interface AttachAdStudioAssetInput {
  type: "image" | "video";
  role: string;
  uri: string;
  provider: string;
  prompt?: string | null;
}

export interface CreateAdStudioImageExecutionHandoffInput {
  runId: string;
}

export interface CreatePersistedAdStudioMetaDraftInput extends Omit<CreatePausedMetaDraftInput, "accountId"> {
  accountId?: string | null;
}

function serverTimestampValue() {
  return admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date();
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  const values = Array.isArray(value) ? value : [];
  return values
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry, index, items) => entry.length > 0 && items.indexOf(entry) === index);
}

function assertCreateContract(input: CreateAdStudioRunInput) {
  const audience = normalizeString(input.audience);
  const cta = normalizeString(input.cta);
  const aspectRatio = normalizeString(input.aspectRatio);
  const allowedClaims = normalizeStringArray(input.allowedClaims);
  const blockedClaims = normalizeStringArray(input.blockedClaims);
  const budgetCapUsd = Number(input.budgetCapUsd);

  if (
    !audience
    || !cta
    || !aspectRatio
    || !Number.isFinite(budgetCapUsd)
    || budgetCapUsd <= 0
    || allowedClaims.length === 0
    || blockedClaims.length === 0
  ) {
    throw new Error(
      "Ad Studio run requires audience, CTA, budget cap, aspect ratio, and claim boundaries.",
    );
  }

  return {
    audience,
    cta,
    aspectRatio,
    budgetCapUsd,
    city: normalizeString(input.city) || null,
    allowedClaims,
    blockedClaims,
  };
}

function assertDb() {
  if (!db) {
    throw new Error("Database not available");
  }

  return db;
}

function defaultReviewRecord(): AdStudioReviewRecord {
  return {
    status: "pending",
    reasons: [],
    headline: null,
    primaryText: null,
  };
}

function buildPromptPack(input: {
  lane: AdStudioLane;
  audience: string;
  cta: string;
  city: string | null;
  aspectRatio: string;
  allowedClaims: string[];
  blockedClaims: string[];
}) {
  if (input.lane === "capturer") {
    return {
      imagePromptVariants: [
        `Create a ${input.aspectRatio} concept ad with a fictional capturer in a public-facing indoor space like a cafe, gym, lobby, gallery, or retail aisle. Show iPhone-style or wearable POV overlays and a sense of lightweight local work. No real payout proof, no real site labels, no real app screenshots.`,
        `Create a ${input.aspectRatio} public-indoor capture scene with a fictional creator moving through a bright accessible space. Keep it editorial, premium, and believable. Add room for on-screen copy about public indoor capture work without implying real earnings or real customers.`,
      ],
      videoPrompt:
        "Animate the approved first frame into a short public-indoor capture concept ad with subtle POV motion, creator workflow momentum, and space for CTA overlays. Keep it clearly illustrative and avoid proof-like claims.",
      headlineOptions: [
        "Capture public indoor spaces near you",
        "POV: your phone becomes a Blueprint capture run",
        "Turn public indoor spaces into repeatable local work",
      ],
      primaryTextOptions: [
        "Illustrative concept ad for Blueprint's public-indoor capture network. Apply to capture accessible indoor spaces in your city.",
        `Concept ad: fictional public-indoor capture workflow${input.city ? ` in ${input.city}` : ""}. Real proof claims stay evidence-gated.`,
      ],
    } satisfies AdStudioPromptPack;
  }

  return {
    imagePromptVariants: [
      `Create a ${input.aspectRatio} concept ad for Blueprint Exact-Site Hosted Review. Show a fictional operator reviewing one public-facing indoor site with grounded interface overlays, walkthrough cues, and deployment-review framing. Avoid fake customer logos, fake screenshots, and fake outcomes.`,
      `Create a ${input.aspectRatio} review-centric concept ad with a public indoor location, a fictional operator, and a clear hosted-review CTA. The scene may be synthetic, but it must not imply real customer proof, real site capture, or real robot deployment success.`,
    ],
    videoPrompt:
      "Animate the approved first frame into a hosted-review concept ad with restrained motion, clear review workflow cues, and a professional operator-facing CTA. Keep it illustrative, not evidentiary.",
    headlineOptions: [
      "Review the exact site before your robot shows up",
      "Hosted review for one deployment question",
      "See the site problem before another field visit",
    ],
    primaryTextOptions: [
      "Illustrative concept ad for Blueprint's Exact-Site Hosted Review. Fictional public-indoor scene, evidence-gated proof claims, and a real hosted-review CTA.",
      `${input.city ? `Concept ad for ${input.city}. ` : ""}Synthetic scene, real workflow framing. No fabricated buyer proof or site claims.`,
    ],
  } satisfies AdStudioPromptPack;
}

function mapStoredRun(
  id: string,
  data: Record<string, unknown>,
): AdStudioRunRecord {
  return {
    id,
    lane: (normalizeString(data.lane) || "capturer") as AdStudioLane,
    audience: normalizeString(data.audience),
    cta: normalizeString(data.cta),
    budgetCapUsd: Number(data.budget_cap_usd) || 0,
    city: normalizeString(data.city) || null,
    aspectRatio: normalizeString(data.aspect_ratio),
    status: (normalizeString(data.status) || "draft_requested") as AdStudioRunStatus,
    claimsLedger: (data.claims_ledger as AdStudioClaimsLedger | undefined) || {
      allowedClaims: [],
      blockedClaims: [],
      evidenceLinks: [],
      reviewDecision: "pending",
      reviewNotes: [],
    },
    brief: (data.brief as AdStudioBrief | undefined) || null,
    promptPack: (data.prompt_pack as AdStudioPromptPack | undefined) || null,
    assets: Array.isArray(data.assets) ? (data.assets as AdStudioAssetRecord[]) : [],
    imageExecutionHandoff:
      (data.image_execution_handoff as AdStudioExecutionHandoff | undefined) || null,
    videoTask: (data.video_task as AdStudioVideoTaskRecord | undefined) || null,
    review: (data.review as AdStudioReviewRecord | undefined) || defaultReviewRecord(),
    metaDraft: (data.meta_draft as AdStudioMetaDraft | undefined) || {
      campaignId: null,
      adSetId: null,
      adId: null,
      status: "not_created",
    },
    createdAtIso: normalizeString(data.created_at_iso),
    updatedAtIso: normalizeString(data.updated_at_iso),
  };
}

async function mergeAdStudioRun(
  runId: string,
  patch: Record<string, unknown>,
) {
  const database = assertDb();
  const updatedAtIso = new Date().toISOString();
  await database.collection("ad_studio_runs").doc(runId).set(
    {
      ...patch,
      updated_at_iso: updatedAtIso,
      updated_at: serverTimestampValue(),
    },
    { merge: true },
  );
  return await readAdStudioRun(runId);
}

export async function createAdStudioRun(input: CreateAdStudioRunInput) {
  const database = assertDb();
  const normalized = assertCreateContract(input);
  const createdAtIso = new Date().toISOString();

  const claimsLedger: AdStudioClaimsLedger = {
    allowedClaims: normalized.allowedClaims,
    blockedClaims: normalized.blockedClaims,
    evidenceLinks: [],
    reviewDecision: "pending",
    reviewNotes: [],
  };

  const metaDraft: AdStudioMetaDraft = {
    campaignId: null,
    adSetId: null,
    adId: null,
    status: "not_created",
  };

  const payload = {
    lane: input.lane,
    audience: normalized.audience,
    cta: normalized.cta,
    budget_cap_usd: normalized.budgetCapUsd,
    city: normalized.city,
    aspect_ratio: normalized.aspectRatio,
    status: "draft_requested" as AdStudioRunStatus,
    claims_ledger: claimsLedger,
    brief: null,
    prompt_pack: null,
    assets: [],
    image_execution_handoff: null,
    video_task: null,
    review: defaultReviewRecord(),
    meta_draft: metaDraft,
    created_at_iso: createdAtIso,
    updated_at_iso: createdAtIso,
    created_at: serverTimestampValue(),
    updated_at: serverTimestampValue(),
  };

  const ref = await database.collection("ad_studio_runs").add(payload);

  const run: AdStudioRunRecord = {
    id: ref.id,
    lane: input.lane,
    audience: normalized.audience,
    cta: normalized.cta,
    budgetCapUsd: normalized.budgetCapUsd,
    city: normalized.city,
    aspectRatio: normalized.aspectRatio,
    status: "draft_requested",
    claimsLedger,
    brief: null,
    promptPack: null,
    assets: [],
    imageExecutionHandoff: null,
    videoTask: null,
    review: defaultReviewRecord(),
    metaDraft,
    createdAtIso,
    updatedAtIso: createdAtIso,
  };

  return {
    id: ref.id,
    run,
  };
}

export async function readAdStudioRun(runId: string) {
  const database = assertDb();
  const normalizedRunId = normalizeString(runId);
  if (!normalizedRunId) {
    throw new Error("Ad Studio run id is required.");
  }

  const doc = await database.collection("ad_studio_runs").doc(normalizedRunId).get();
  if (!doc.exists) {
    return null;
  }

  return mapStoredRun(normalizedRunId, (doc.data() as Record<string, unknown>) || {});
}

export async function listAdStudioRuns(limit = 20) {
  const database = assertDb();
  const snapshot = await database
    .collection("ad_studio_runs")
    .orderBy("updated_at_iso", "desc")
    .limit(Math.max(1, Math.min(limit, 50)))
    .get();

  return snapshot.docs.map((doc) =>
    mapStoredRun(doc.id, (doc.data() as Record<string, unknown>) || {}));
}

export async function buildAdStudioBrief(input: CreateAdStudioRunInput) {
  const normalized = assertCreateContract(input);

  const visualDirection =
    input.lane === "capturer"
      ? "Use synthetic public-facing indoor scenes, creator workflow framing, and iPhone-style or wearable POV overlays."
      : "Use synthetic exact-site hosted-review dramatizations, operator review surfaces, and deployment-risk framing.";

  const copyHooks =
    input.lane === "capturer"
      ? [
        "Get paid to capture public indoor spaces near you.",
        "Capture once, build repeatable local work.",
        "POV: your phone turns a public space into a Blueprint-ready capture run.",
      ]
      : [
        "Review the exact site before your robot shows up.",
        "Cut deployment uncertainty with a hosted exact-site review.",
        "See the site question before another travel-heavy review cycle.",
      ];

  const brief: AdStudioBrief = {
    lane: input.lane,
    visualDirection,
    copyHooks,
    claimsLedger: {
      allowedClaims: normalized.allowedClaims,
      blockedClaims: normalized.blockedClaims,
      evidenceLinks: [],
      reviewDecision: "pending",
      reviewNotes: [],
    },
  };

  return { brief };
}

export async function buildAndPersistAdStudioBrief(runId: string) {
  const run = await readAdStudioRun(runId);
  if (!run) {
    throw new Error("Ad Studio run not found.");
  }

  const { brief } = await buildAdStudioBrief({
    lane: run.lane,
    audience: run.audience,
    cta: run.cta,
    budgetCapUsd: run.budgetCapUsd,
    city: run.city,
    allowedClaims: run.claimsLedger.allowedClaims,
    blockedClaims: run.claimsLedger.blockedClaims,
    aspectRatio: run.aspectRatio,
  });
  const promptPack = buildPromptPack({
    lane: run.lane,
    audience: run.audience,
    cta: run.cta,
    city: run.city,
    aspectRatio: run.aspectRatio,
    allowedClaims: run.claimsLedger.allowedClaims,
    blockedClaims: run.claimsLedger.blockedClaims,
  });

  const updated = await mergeAdStudioRun(runId, {
    brief,
    prompt_pack: promptPack,
    status: "brief_ready",
  });

  if (!updated) {
    throw new Error("Failed to persist Ad Studio brief.");
  }

  return {
    run: updated,
    brief,
    promptPack,
  };
}

export async function attachAdStudioAsset(
  runId: string,
  input: AttachAdStudioAssetInput,
) {
  const run = await readAdStudioRun(runId);
  if (!run) {
    throw new Error("Ad Studio run not found.");
  }

  const asset: AdStudioAssetRecord = {
    type: input.type,
    role: normalizeString(input.role),
    uri: normalizeString(input.uri),
    provider: normalizeString(input.provider),
    prompt: normalizeString(input.prompt) || null,
    createdAtIso: new Date().toISOString(),
  };

  if (!asset.role || !asset.uri || !asset.provider) {
    throw new Error("Ad Studio asset requires role, URI, and provider.");
  }

  const updated = await mergeAdStudioRun(runId, {
    assets: [...run.assets, asset],
    status:
      input.type === "image" && run.status === "brief_ready"
        ? "image_prompt_ready"
        : run.status,
  });

  if (!updated) {
    throw new Error("Failed to attach Ad Studio asset.");
  }

  return {
    run: updated,
    asset,
  };
}

export async function createAdStudioImageExecutionHandoff(
  input: CreateAdStudioImageExecutionHandoffInput,
) {
  const run = await readAdStudioRun(input.runId);
  if (!run) {
    throw new Error("Ad Studio run not found.");
  }
  if (!run.promptPack) {
    throw new Error("Build the Ad Studio brief before routing image execution.");
  }

  const description = [
    `Execute Ad Studio image generation for ${run.lane} lane.`,
    "",
    `Run id: ${run.id}`,
    `Audience: ${run.audience}`,
    `CTA: ${run.cta}`,
    run.city ? `City: ${run.city}` : "",
    "",
    "Allowed claims:",
    ...run.claimsLedger.allowedClaims.map((entry) => `- ${entry}`),
    "",
    "Blocked claims:",
    ...run.claimsLedger.blockedClaims.map((entry) => `- ${entry}`),
    "",
    "Image prompt variants:",
    ...run.promptPack.imagePromptVariants.map((entry, index) => `${index + 1}. ${entry}`),
    "",
    "Requested outcome:",
    "- Generate 2-4 gpt-image-2 variants in Codex.",
    "- Keep the scene synthetic and public-indoor if applicable.",
    "- Do not fabricate proof as real.",
    "- Attach resulting image URIs back to the Ad Studio run.",
  ]
    .filter(Boolean)
    .join("\n");

  const handoff = await upsertPaperclipIssue({
    projectName: "blueprint-webapp",
    assigneeKey: "webapp-codex",
    title: `Ad Studio image execution: ${run.lane} — ${run.audience}`,
    description,
    priority: "high",
    status: "todo",
    originKind: "ad_studio_run",
    originId: run.id,
  });

  const executionHandoff: AdStudioExecutionHandoff = {
    issueId: handoff.issue.id,
    status: handoff.issue.status,
    assignee: "webapp-codex",
    error: null,
  };

  await createPaperclipIssueComment(
    handoff.issue.id,
    `Ad Studio routed image execution for run ${run.id}. Use Codex-native gpt-image-2 and return image URIs to the run record.`,
  ).catch(() => undefined);

  if (handoff.assigneeAgentId) {
    await wakePaperclipAgent({
      agentId: handoff.assigneeAgentId,
      companyId: handoff.companyId,
      reason: "ad_studio_image_execution_handoff",
      payload: {
        runId: run.id,
        lane: run.lane,
      },
    }).catch(() => undefined);
  }

  const updated = await mergeAdStudioRun(run.id, {
    image_execution_handoff: executionHandoff,
    status: "image_prompt_ready",
  });

  if (!updated) {
    throw new Error("Failed to persist Ad Studio image execution handoff.");
  }

  return {
    run: updated,
    handoff: executionHandoff,
  };
}

export function reviewAdStudioCreative(
  input: ReviewAdStudioCreativeInput,
): ReviewAdStudioCreativeResult {
  const text = `${normalizeString(input.headline)} ${normalizeString(input.primaryText)}`.toLowerCase();
  const fabricatedProofPatterns = [
    /\bearn(?:ed|ing)?\s*\$\d+/i,
    /\bgot paid\b/i,
    /\breal [a-z0-9 -]+ (gym|store|mall|hotel|library|museum|airport|site|facility)\b/i,
    /\balready got paid\b/i,
    /\bthree capturers\b/i,
    /\bthis week\b/i,
  ];

  const fabricatedProof = fabricatedProofPatterns.some((pattern) => pattern.test(text));

  if (fabricatedProof) {
    return {
      status: "failed_claims_review",
      reasons: ["Creative presents fabricated proof as real."],
    };
  }

  return {
    status: "draft_safe",
    reasons: [],
  };
}

export async function queueAdStudioVideo(
  input: QueueAdStudioVideoInput,
  startVideo: typeof startRunwayImageToVideoTask = startRunwayImageToVideoTask,
) {
  const promptText = normalizeString(input.promptText);
  const firstFrameUrl = normalizeString(input.firstFrameUrl);
  const ratio = normalizeString(input.ratio);

  if (!promptText || !firstFrameUrl || !ratio) {
    throw new Error("Ad Studio video queue requires prompt text, first frame, and ratio.");
  }

  const task = await startVideo({
    promptText,
    promptImage: firstFrameUrl,
    ratio,
  });

  return {
    runId: normalizeString(input.runId),
    videoTaskId: task.id,
    status: task.status,
  };
}

export async function queuePersistedAdStudioVideo(
  runId: string,
  input?: Partial<QueueAdStudioVideoInput>,
  startVideo: typeof startRunwayImageToVideoTask = startRunwayImageToVideoTask,
) {
  const run = await readAdStudioRun(runId);
  if (!run) {
    throw new Error("Ad Studio run not found.");
  }

  const firstFrameUrl =
    normalizeString(input?.firstFrameUrl)
    || run.assets.find((asset) => asset.type === "image" && asset.role === "first_frame")?.uri
    || run.assets.find((asset) => asset.type === "image")?.uri
    || "";
  const promptText =
    normalizeString(input?.promptText)
    || run.promptPack?.videoPrompt
    || "";
  const ratio = normalizeString(input?.ratio) || run.aspectRatio;

  const task = await queueAdStudioVideo({
    runId: run.id,
    promptText,
    firstFrameUrl,
    ratio,
  }, startVideo);

  const updated = await mergeAdStudioRun(run.id, {
    video_task: {
      taskId: task.videoTaskId,
      status: task.status,
      firstFrameUrl,
      ratio,
      promptText,
    } satisfies AdStudioVideoTaskRecord,
    status: "video_pending",
  });

  if (!updated) {
    throw new Error("Failed to persist Ad Studio video task.");
  }

  return {
    run: updated,
    videoTask: updated.videoTask,
  };
}

export async function reviewPersistedAdStudioCreative(
  runId: string,
  input: ReviewAdStudioCreativeInput,
) {
  const run = await readAdStudioRun(runId);
  if (!run) {
    throw new Error("Ad Studio run not found.");
  }

  const review = reviewAdStudioCreative(input);
  const updatedClaimsLedger: AdStudioClaimsLedger = {
    ...run.claimsLedger,
    reviewDecision: review.status === "draft_safe" ? "approved" : "rejected",
    reviewNotes: review.reasons,
  };

  const updated = await mergeAdStudioRun(runId, {
    review: {
      status: review.status,
      reasons: review.reasons,
      headline: normalizeString(input.headline) || null,
      primaryText: normalizeString(input.primaryText) || null,
    } satisfies AdStudioReviewRecord,
    claims_ledger: updatedClaimsLedger,
    status: review.status,
  });

  if (!updated) {
    throw new Error("Failed to persist Ad Studio review.");
  }

  return {
    run: updated,
    review,
  };
}

export async function createPersistedAdStudioMetaDraft(
  runId: string,
  input: CreatePersistedAdStudioMetaDraftInput,
  fetchImpl: typeof fetch = fetch,
) {
  const run = await readAdStudioRun(runId);
  if (!run) {
    throw new Error("Ad Studio run not found.");
  }
  if (run.review.status !== "draft_safe") {
    throw new Error("Ad Studio run must be draft-safe before Meta draft creation.");
  }

  const draft = await createPausedMetaDraft(
    {
      accountId: normalizeString(input.accountId) || "",
      campaignName: normalizeString(input.campaignName) || `${run.lane} · ${run.audience}`,
      objective: normalizeString(input.objective) || "OUTCOME_TRAFFIC",
      dailyBudgetMinorUnits: Number(input.dailyBudgetMinorUnits || Math.round(run.budgetCapUsd * 100)),
      primaryText:
        normalizeString(input.primaryText)
        || run.review.primaryText
        || run.promptPack?.primaryTextOptions[0]
        || "",
      headline:
        normalizeString(input.headline)
        || run.review.headline
        || run.promptPack?.headlineOptions[0]
        || "",
      videoId: normalizeString(input.videoId),
      destinationUrl: normalizeString(input.destinationUrl),
      pageId: normalizeString(input.pageId) || null,
      adSetName: normalizeString(input.adSetName) || null,
      adName: normalizeString(input.adName) || null,
    },
    fetchImpl,
  );

  const metaDraft: AdStudioMetaDraft = {
    campaignId: draft.campaignId,
    adSetId: draft.adSetId,
    adId: draft.adId,
    status: "paused_created",
  };

  const updated = await mergeAdStudioRun(runId, {
    meta_draft: metaDraft,
    status: "meta_draft_created",
  });

  if (!updated) {
    throw new Error("Failed to persist Meta draft ids.");
  }

  return {
    run: updated,
    metaDraft,
  };
}
