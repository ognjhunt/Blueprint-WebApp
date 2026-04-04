import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

const CONTENT_OUTCOME_REVIEW_COLLECTION = "content_outcome_reviews";

export interface ContentOutcomeReviewRecord {
  id?: string;
  assetKey: string;
  issueId: string | null;
  assetType: string;
  channels: string[];
  summary: string;
  whatWorked: string[];
  whatDidNot: string[];
  nextRecommendation: string | null;
  evidenceSource: string;
  confidence: number;
  recordedAt: string;
  recordedBy: string | null;
  metrics?: Record<string, unknown>;
}

export interface ContentOutcomeReviewSummary {
  reviewCount: number;
  workingPatterns: string[];
  failingPatterns: string[];
  recommendedNextMoves: string[];
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((entry) => normalizeString(entry))
        .filter(Boolean)
    : [];
}

function pushCount(
  map: Map<string, { value: string; count: number }>,
  values: string[],
) {
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key) continue;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { value, count: 1 });
    }
  }
}

function topCounts(map: Map<string, { value: string; count: number }>, limit = 3) {
  return [...map.values()]
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.value.localeCompare(right.value);
    })
    .slice(0, limit)
    .map((entry) => entry.value);
}

export function normalizeContentOutcomeReviewInput(
  input: Record<string, unknown>,
  recordedAtIso: string,
  recordedBy: string | null,
): ContentOutcomeReviewRecord {
  const confidenceValue = Number(input.confidence);
  return {
    assetKey: normalizeString(input.assetKey) || `manual:${recordedAtIso}`,
    issueId: normalizeString(input.issueId) || null,
    assetType: normalizeString(input.assetType) || "campaign_bundle",
    channels: normalizeStringArray(input.channels),
    summary: normalizeString(input.summary) || "Outcome review captured.",
    whatWorked: normalizeStringArray(input.whatWorked),
    whatDidNot: normalizeStringArray(input.whatDidNot),
    nextRecommendation: normalizeString(input.nextRecommendation) || null,
    evidenceSource: normalizeString(input.evidenceSource) || "manual_review",
    confidence: Number.isFinite(confidenceValue)
      ? Math.max(0, Math.min(confidenceValue, 1))
      : 0.5,
    recordedAt: recordedAtIso,
    recordedBy,
    metrics:
      input.metrics && typeof input.metrics === "object" && !Array.isArray(input.metrics)
        ? input.metrics as Record<string, unknown>
        : undefined,
  };
}

export function summarizeContentOutcomeReviews(
  reviews: ContentOutcomeReviewRecord[],
): ContentOutcomeReviewSummary {
  const working = new Map<string, { value: string; count: number }>();
  const failing = new Map<string, { value: string; count: number }>();
  const nextMoves = new Map<string, { value: string; count: number }>();

  for (const review of reviews) {
    pushCount(working, review.whatWorked);
    pushCount(failing, review.whatDidNot);
    pushCount(nextMoves, review.nextRecommendation ? [review.nextRecommendation] : []);
  }

  return {
    reviewCount: reviews.length,
    workingPatterns: topCounts(working),
    failingPatterns: topCounts(failing),
    recommendedNextMoves: topCounts(nextMoves),
  };
}

export async function createContentOutcomeReview(params: {
  review: ContentOutcomeReviewRecord;
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const ref = await db.collection(CONTENT_OUTCOME_REVIEW_COLLECTION).add({
    ...params.review,
    created_at_iso: params.review.recordedAt,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    id: ref.id,
    ...params.review,
  } satisfies ContentOutcomeReviewRecord;
}

export async function listContentOutcomeReviews(params?: {
  assetKey?: string | null;
  limit?: number;
  sinceIso?: string | null;
}) {
  if (!db) {
    throw new Error("Database not available");
  }

  const limit = Math.max(1, Math.min(params?.limit ?? 25, 100));
  let query: FirebaseFirestore.Query = db
    .collection(CONTENT_OUTCOME_REVIEW_COLLECTION)
    .orderBy("created_at", "desc")
    .limit(limit);

  if (params?.assetKey) {
    query = query.where("assetKey", "==", params.assetKey);
  }
  if (params?.sinceIso) {
    query = query.where("created_at_iso", ">=", params.sinceIso);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Record<string, unknown>),
  })) as ContentOutcomeReviewRecord[];
}

export async function summarizeRecentContentOutcomeReviews(params?: {
  limit?: number;
  lookbackDays?: number;
}) {
  const lookbackDays = Math.max(1, Math.min(params?.lookbackDays ?? 30, 180));
  const since = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();
  const reviews = await listContentOutcomeReviews({
    limit: params?.limit ?? 50,
    sinceIso: since,
  });
  return summarizeContentOutcomeReviews(reviews);
}
