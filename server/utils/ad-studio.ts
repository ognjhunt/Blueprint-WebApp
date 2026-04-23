import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

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
    metaDraft,
    createdAtIso,
    updatedAtIso: createdAtIso,
  };

  return {
    id: ref.id,
    run,
  };
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
