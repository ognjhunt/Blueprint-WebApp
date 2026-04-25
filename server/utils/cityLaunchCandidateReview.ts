import {
  listCityLaunchCandidateSignals,
  updateCityLaunchCandidateSignalReview,
  upsertCityLaunchProspect,
  type CityLaunchCandidateSignalRecord,
} from "./cityLaunchLedgers";
import { slugifyCityName } from "./cityLaunchProfiles";

type ReviewDecision = "keep_in_review" | "promote" | "reject";

export type CityLaunchCandidateReviewOutcome = {
  candidateId: string;
  candidateName: string;
  decision: ReviewDecision;
  reviewState: string;
  reasons: string[];
  promotedProspectId: string | null;
};

export type CityLaunchCandidateReviewBatchResult = {
  generatedAt: string;
  city: string | null;
  reviewedBy: string;
  dryRun: boolean;
  reviewedCount: number;
  promotedCount: number;
  keptInReviewCount: number;
  rejectedCount: number;
  outcomes: CityLaunchCandidateReviewOutcome[];
};

const PUBLIC_REVIEW_OWNER = "public-space-review-agent";
const PROMOTABLE_CONFIDENCE = new Set(["high", "medium", "medium-high", "verified"]);
const PROMOTABLE_VERIFICATION_STATUSES = new Set(["verified"]);
const PROMOTABLE_INDOOR_POSTURES = new Set(["indoor-only", "indoor-primary"]);
const PUBLIC_POSTURE_TOKENS = [
  "public-facing",
  "public facing",
  "public access",
  "public use",
  "public mall",
  "public market",
  "public food",
  "publicly accessible",
  "common access",
  "common-area",
  "common area",
  "visitor",
  "walk-in",
  "walkable",
  "open to public",
  "open-to-public",
  "posted hours",
  "during mall hours",
];
const PRIVATE_POSTURE_TOKENS = [
  "private access",
  "private facility",
  "restricted",
  "staff-only",
  "staff only",
  "back-of-house",
  "back of house",
  "appointment-only",
  "appointment only",
  "not public",
  "unknown",
];
const INDOOR_ZONE_TOKENS = [
  "indoor",
  "interior",
  "concourse",
  "corridor",
  "food hall",
  "market hall",
  "lobby",
  "atrium",
  "gallery",
  "museum",
  "common seating",
  "common area",
  "visitor center",
  "coworking floor",
];
const HOSTILE_CAMERA_POLICY_TOKENS = [
  "no photo",
  "no photography",
  "no video",
  "no filming",
  "video or audio recording devices",
  "commercial filming and photography are not permitted",
];
const REJECT_TYPE_TOKENS = new Set([
  "warehouse",
  "manufacturing",
  "factory",
  "distribution_center",
  "storage",
  "logistics",
  "industrial",
  "facility",
]);

function nowIso() {
  return new Date().toISOString();
}

function slugifyToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "candidate";
}

function normalizedConfidence(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/_/g, "-");
}

function hasPublicPosture(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return false;
  if (PRIVATE_POSTURE_TOKENS.some((token) => normalized.includes(token))) return false;
  return PUBLIC_POSTURE_TOKENS.some((token) => normalized.includes(token));
}

function hasPrivatePosture(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && PRIVATE_POSTURE_TOKENS.some((token) => normalized.includes(token));
}

function hasRejectedType(candidate: CityLaunchCandidateSignalRecord) {
  return candidate.types.some((type) => REJECT_TYPE_TOKENS.has(type.trim().toLowerCase()));
}

function evidenceArray(value: string[] | undefined) {
  return Array.isArray(value) ? value.map((entry) => entry.trim()).filter(Boolean) : [];
}

function normalizedToken(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/_/g, "-");
}

function hasIndoorAllowedZone(value: string[]) {
  const normalized = value.join(" ").toLowerCase();
  return INDOOR_ZONE_TOKENS.some((token) => normalized.includes(token));
}

function hasHostileCameraPolicy(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && HOSTILE_CAMERA_POLICY_TOKENS.some((token) => normalized.includes(token));
}

function evaluateCandidate(candidate: CityLaunchCandidateSignalRecord): Omit<CityLaunchCandidateReviewOutcome, "candidateId" | "candidateName" | "promotedProspectId"> {
  const reasons: string[] = [];
  const sourceUrls = evidenceArray(candidate.sourceUrls);
  const sourceQueries = evidenceArray(candidate.sourceQueries);
  const allowedCaptureZones = evidenceArray(candidate.allowedCaptureZones);
  const avoidZones = evidenceArray(candidate.avoidZones);
  const confidence = normalizedConfidence(candidate.confidence);
  const indoorPosture = normalizedToken(candidate.indoorPosture);
  const verificationStatus = normalizedToken(candidate.verificationStatus);

  if (!candidate.name.trim()) reasons.push("missing place name");
  if (!candidate.address?.trim()) reasons.push("missing address");
  if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) reasons.push("missing coordinates");

  if (verificationStatus === "rejected") {
    return {
      decision: "reject",
      reviewState: "rejected_by_source_verification",
      reasons: [candidate.rejectionReason || "source verification rejected this candidate"],
    };
  }

  if (hasRejectedType(candidate)) {
    return {
      decision: "reject",
      reviewState: "rejected_private_or_controlled_site_type",
      reasons: ["candidate type appears to be private, industrial, warehouse, or controlled-facility supply"],
    };
  }

  if (indoorPosture === "outdoor-primary") {
    return {
      decision: "reject",
      reviewState: "rejected_outdoor_primary",
      reasons: ["candidate is outdoor-primary and cannot become an approved indoor launch target"],
    };
  }

  if (hasPrivatePosture(candidate.publicAccessPosture)) {
    return {
      decision: "reject",
      reviewState: "rejected_public_access_not_supported",
      reasons: ["public access posture indicates private, restricted, unknown, or staff-only access"],
    };
  }

  if (hasHostileCameraPolicy(candidate.cameraPolicyEvidence)) {
    return {
      decision: "reject",
      reviewState: "rejected_camera_policy_hostile",
      reasons: ["camera policy evidence appears hostile to capture or filming"],
    };
  }

  if (!sourceUrls.length) reasons.push("missing source URLs");
  if (candidate.sourceContext === "agent_public_candidate_research" && !sourceQueries.length) {
    reasons.push("missing source query log");
  }
  if (!candidate.sourceEvidenceSummary?.trim()) reasons.push("missing source evidence summary");
  if (!hasPublicPosture(candidate.publicAccessPosture)) reasons.push("public access posture is not explicit enough");
  if (!allowedCaptureZones.length) reasons.push("missing allowed capture zones");
  if (!avoidZones.length) reasons.push("missing avoid zones");
  if (!indoorPosture) reasons.push("missing indoor posture");
  if (
    indoorPosture === "unknown"
    || indoorPosture === "outdoor-primary"
  ) {
    reasons.push("indoor posture cannot be promoted");
  }
  if (
    indoorPosture === "mixed-indoor-outdoor"
    && !hasIndoorAllowedZone(allowedCaptureZones)
  ) {
    reasons.push("mixed site lacks a clearly separable indoor allowed capture zone");
  }
  if (
    indoorPosture
    && !PROMOTABLE_INDOOR_POSTURES.has(indoorPosture)
    && indoorPosture !== "mixed-indoor-outdoor"
  ) {
    reasons.push("indoor posture is not promotable");
  }
  if (!PROMOTABLE_VERIFICATION_STATUSES.has(verificationStatus)) {
    reasons.push("verification status is not verified");
  }
  if (!PROMOTABLE_CONFIDENCE.has(confidence)) reasons.push("confidence is not promotable");
  if (!candidate.estimatedCaptureMinutes) reasons.push("missing capture minutes estimate");
  if (!candidate.suggestedPayoutCents) reasons.push("missing suggested payout estimate");
  if (!candidate.payoutBasis?.trim()) reasons.push("missing payout basis");

  if (reasons.length) {
    return {
      decision: "keep_in_review",
      reviewState: "needs_review_evidence",
      reasons,
    };
  }

  return {
    decision: "promote",
    reviewState: "promoted_to_prospect",
    reasons: [
      "verified indoor/common-access posture, source URLs, query log, allowed zones, avoid zones, coordinates, and payout/time estimates are present",
    ],
  };
}

async function promoteCandidate(candidate: CityLaunchCandidateSignalRecord, reviewedAtIso: string) {
  const citySlug = candidate.citySlug || slugifyCityName(candidate.city);
  const sourceUrls = evidenceArray(candidate.sourceUrls);
  const allowedCaptureZones = evidenceArray(candidate.allowedCaptureZones);
  const avoidZones = evidenceArray(candidate.avoidZones);
  const prospect = await upsertCityLaunchProspect({
    id: `public_candidate_${citySlug}_${slugifyToken(candidate.name)}`,
    city: candidate.city,
    launchId: null,
    sourceBucket: "public_commercial_review_candidate",
    channel: candidate.sourceContext,
    name: candidate.name,
    email: null,
    status: "approved",
    ownerAgent: PUBLIC_REVIEW_OWNER,
    notes: [
      "Auto-promoted from public review candidate evidence.",
      "Approved target posture is limited to verified indoor/common-access capture guidance.",
      "This does not mark derived world-model rights, payout, or commercialization clearance.",
      candidate.sourceEvidenceSummary ? `Evidence summary: ${candidate.sourceEvidenceSummary}` : null,
      candidate.seedNotes ? `Seed notes: ${candidate.seedNotes}` : null,
    ].filter(Boolean).join("\n"),
    firstContactedAt: null,
    lastContactedAt: null,
    siteAddress: candidate.address,
    locationSummary: candidate.publicAccessPosture || null,
    lat: candidate.lat,
    lng: candidate.lng,
    siteCategory: candidate.types.join(", ") || "public-facing commercial space",
    workflowFit: "public-facing common-access capture",
    priorityNote: [
      `Allowed capture zones: ${allowedCaptureZones.join("; ")}`,
      `Avoid zones: ${avoidZones.join("; ")}`,
      candidate.indoorPosture ? `Indoor posture: ${candidate.indoorPosture}` : null,
      candidate.verificationStatus ? `Verification status: ${candidate.verificationStatus}` : null,
      candidate.estimatedCaptureMinutes ? `Estimated capture minutes: ${candidate.estimatedCaptureMinutes}` : null,
      candidate.suggestedPayoutCents
        ? `Suggested payout: $${(candidate.suggestedPayoutCents / 100).toFixed(2)} reviewable estimate, not a guarantee`
        : null,
      candidate.payoutBasis ? `Payout basis: ${candidate.payoutBasis}` : null,
      candidate.confidence ? `Confidence: ${candidate.confidence}` : null,
    ].filter(Boolean).join("\n"),
    researchProvenance: {
      sourceType: "public_candidate_review",
      artifactPath: `cityLaunchCandidateSignals/${candidate.id}`,
      sourceKey: candidate.id,
      sourceUrls,
      parsedAtIso: reviewedAtIso,
      explicitFields: [
        "name",
        "address",
        "lat",
        "lng",
        "sourceUrls",
        "sourceEvidenceSummary",
        "sourceQueries",
        "sourceBuckets",
        "candidateType",
        "indoorPosture",
        "publicAccessPosture",
        "allowedCaptureZones",
        "avoidZones",
        "cameraPolicyEvidence",
        "confidence",
        "verificationStatus",
        "estimatedPublicAreaSqft",
        "estimatedCaptureMinutes",
        "estimatedCaptureComplexity",
        "demandScore",
        "suggestedPayoutCents",
        "payoutBasis",
        "lastVerifiedAt",
      ],
      inferredFields: [],
    },
  });
  return prospect.id;
}

export async function reviewCityLaunchCandidateBatch(input: {
  city?: string | null;
  candidateIds?: string[] | null;
  limit?: number | null;
  dryRun?: boolean;
  reviewedBy?: string | null;
} = {}): Promise<CityLaunchCandidateReviewBatchResult> {
  const reviewedBy = input.reviewedBy?.trim() || PUBLIC_REVIEW_OWNER;
  const candidates = await listCityLaunchCandidateSignals({
    city: input.city || undefined,
    statuses: ["queued", "in_review"],
  });
  const candidateIdSet = input.candidateIds?.length
    ? new Set(input.candidateIds.map((id) => id.trim()).filter(Boolean))
    : null;
  const reviewableCandidates = candidateIdSet
    ? candidates.filter((candidate) => candidateIdSet.has(candidate.id))
    : candidates;
  const limit = Math.max(1, Math.min(Math.trunc(input.limit || 100), 500));
  const selected = reviewableCandidates.slice(0, limit);
  const reviewedAtIso = nowIso();
  const outcomes: CityLaunchCandidateReviewOutcome[] = [];

  for (const candidate of selected) {
    const evaluation = evaluateCandidate(candidate);
    let promotedProspectId: string | null = null;
    if (!input.dryRun && evaluation.decision === "promote") {
      promotedProspectId = await promoteCandidate(candidate, reviewedAtIso);
    }

    if (!input.dryRun) {
      await updateCityLaunchCandidateSignalReview(candidate.id, {
        status:
          evaluation.decision === "promote"
            ? "promoted"
            : evaluation.decision === "reject"
              ? "rejected"
              : "in_review",
        reviewState: evaluation.reviewState,
        reviewedAtIso,
        reviewedBy,
        reviewDecision: evaluation.decision,
        reviewReasons: evaluation.reasons,
        promotedProspectId,
      });
    }

    outcomes.push({
      candidateId: candidate.id,
      candidateName: candidate.name,
      decision: evaluation.decision,
      reviewState: evaluation.reviewState,
      reasons: evaluation.reasons,
      promotedProspectId,
    });
  }

  return {
    generatedAt: reviewedAtIso,
    city: input.city || null,
    reviewedBy,
    dryRun: Boolean(input.dryRun),
    reviewedCount: outcomes.length,
    promotedCount: outcomes.filter((outcome) => outcome.decision === "promote").length,
    keptInReviewCount: outcomes.filter((outcome) => outcome.decision === "keep_in_review").length,
    rejectedCount: outcomes.filter((outcome) => outcome.decision === "reject").length,
    outcomes,
  };
}
