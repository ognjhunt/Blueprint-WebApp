import fs from "node:fs";
import path from "node:path";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { reviewCityLaunchCandidateBatch } from "../../server/utils/cityLaunchCandidateReview";
import {
  intakeCityLaunchCandidateSignals,
  listCityLaunchProspects,
  updateCityLaunchProspectLifecycle,
  type CityLaunchCandidateSignalSourceContext,
  type CityLaunchCaptureComplexity,
  type CityLaunchIndoorPosture,
  type CityLaunchLocationVerificationStatus,
} from "../../server/utils/cityLaunchLedgers";

const VALID_INDOOR_POSTURES = new Set<CityLaunchIndoorPosture>([
  "indoor_only",
  "indoor_primary",
  "mixed_indoor_outdoor",
  "outdoor_primary",
  "unknown",
]);

const VALID_VERIFICATION_STATUSES = new Set<CityLaunchLocationVerificationStatus>([
  "verified",
  "partially_verified",
  "weak",
  "rejected",
]);

const VALID_COMPLEXITIES = new Set<CityLaunchCaptureComplexity>([
  "simple",
  "standard",
  "complex",
  "high_complexity",
]);

type CandidateInput = {
  candidate_id?: string;
  place_name?: string;
  name?: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  provider?: string;
  provider_place_id?: string | null;
  types?: string[];
  source_urls?: string[];
  source_evidence_summary?: string | null;
  source_queries?: string[];
  source_buckets?: string[];
  candidate_type?: string | null;
  indoor_posture?: CityLaunchIndoorPosture | string | null;
  public_access_posture?: string | null;
  allowed_capture_zones?: string[];
  avoid_zones?: string[];
  camera_policy_evidence?: string | null;
  confidence?: string;
  verification_status?: CityLaunchLocationVerificationStatus | string | null;
  reviewState?: string;
  status?: string;
  rejection_reason?: string | null;
  estimated_public_area_sqft?: number | string | null;
  estimated_capture_minutes?: number | string | null;
  estimated_capture_complexity?: CityLaunchCaptureComplexity | string | null;
  demand_score?: number | string | null;
  suggested_payout_cents?: number | string | null;
  suggested_payout_range_cents?: [number, number] | null;
  payout_basis?: string | null;
  last_verified_at?: string | null;
  reviewed_by_agent?: string | null;
  notes?: string;
  coverage_run_id?: string | null;
  coverage_tile_id?: string | null;
  coverage_category?: string | null;
  source_bucket?: string | null;
  source_quality?: string | null;
  discovery_query?: string | null;
  duplicate_of_candidate_id?: string | null;
  excluded_by_coverage_policy_reason?: string | null;
};

type RejectedCandidateInput = {
  candidate_id?: string;
  place_name?: string;
  name?: string;
  source_urls?: string[];
  source_queries?: string[];
  indoor_posture?: string | null;
  verification_status?: string | null;
  rejection_reason?: string | null;
  reason_code?: string | null;
};

type CandidateLedgerInput = {
  schema_version?: string;
  city: string;
  city_slug?: string;
  source_context?: CityLaunchCandidateSignalSourceContext;
  creator_id?: string;
  generated_at?: string;
  accepted_candidates?: CandidateInput[];
  candidates?: CandidateInput[];
  rejected_candidates?: RejectedCandidateInput[];
  source_queries?: string[];
  fetched_source_urls?: string[];
};

type NormalizedCandidate = Required<Pick<CandidateInput, "candidate_id">> & {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  provider: string;
  provider_place_id: string | null;
  types: string[];
  source_urls: string[];
  source_evidence_summary: string;
  source_queries: string[];
  source_buckets: string[];
  candidate_type: string;
  indoor_posture: CityLaunchIndoorPosture;
  public_access_posture: string;
  allowed_capture_zones: string[];
  avoid_zones: string[];
  camera_policy_evidence: string | null;
  confidence: string;
  verification_status: CityLaunchLocationVerificationStatus;
  reviewState: string;
  status: string;
  rejection_reason: string | null;
  estimated_public_area_sqft: number | null;
  estimated_capture_minutes: number;
  estimated_capture_complexity: CityLaunchCaptureComplexity;
  demand_score: number | null;
  suggested_payout_cents: number;
  suggested_payout_range_cents: [number, number] | null;
  payout_basis: string;
  last_verified_at: string;
  reviewed_by_agent: string;
  notes: string | null;
  coverage_run_id: string | null;
  coverage_tile_id: string | null;
  coverage_category: string | null;
  source_bucket: string | null;
  source_quality: string | null;
  discovery_query: string | null;
  duplicate_of_candidate_id: string | null;
  excluded_by_coverage_policy_reason: string | null;
};

function parseArgs(argv: string[]) {
  const args = new Map<string, string | true>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
    } else {
      args.set(key, next);
      index += 1;
    }
  }
  return args;
}

function requireString(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function finiteNumber(value: unknown, name: string) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`${name} must be a finite number`);
  }
  return numberValue;
}

function optionalFiniteNumber(value: unknown, name: string) {
  if (value === null || value === undefined || value === "") return null;
  return finiteNumber(value, name);
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : [];
}

function normalizeIndoorPosture(value: unknown, name: string) {
  const normalized = String(value || "").trim() as CityLaunchIndoorPosture;
  if (!VALID_INDOOR_POSTURES.has(normalized)) {
    throw new Error(`${name} must be one of ${Array.from(VALID_INDOOR_POSTURES).join(", ")}`);
  }
  return normalized;
}

function normalizeVerificationStatus(value: unknown, name: string) {
  const normalized = String(value || "").trim() as CityLaunchLocationVerificationStatus;
  if (!VALID_VERIFICATION_STATUSES.has(normalized)) {
    throw new Error(`${name} must be one of ${Array.from(VALID_VERIFICATION_STATUSES).join(", ")}`);
  }
  return normalized;
}

function normalizeComplexity(value: unknown, name: string) {
  const normalized = String(value || "").trim() as CityLaunchCaptureComplexity;
  if (!VALID_COMPLEXITIES.has(normalized)) {
    throw new Error(`${name} must be one of ${Array.from(VALID_COMPLEXITIES).join(", ")}`);
  }
  return normalized;
}

function assertIndoorCandidate(candidate: NormalizedCandidate, index: number) {
  const prefix = `accepted_candidates[${index}]`;
  if (candidate.verification_status === "rejected") {
    throw new Error(`${prefix} cannot be accepted with verification_status=rejected`);
  }
  if (candidate.indoor_posture === "outdoor_primary" || candidate.indoor_posture === "unknown") {
    throw new Error(`${prefix} cannot be materialized with indoor_posture=${candidate.indoor_posture}`);
  }
  if (candidate.indoor_posture === "mixed_indoor_outdoor") {
    const joinedZones = candidate.allowed_capture_zones.join(" ").toLowerCase();
    if (!/(indoor|interior|lobby|atrium|concourse|corridor|gallery|food hall|market hall|common)/.test(joinedZones)) {
      throw new Error(`${prefix} mixed site must name a separable indoor allowed_capture_zone`);
    }
  }
  if (!candidate.source_urls.length) throw new Error(`${prefix}.source_urls must contain at least one URL`);
  if (!candidate.source_queries.length) throw new Error(`${prefix}.source_queries must contain at least one query`);
  if (!candidate.source_evidence_summary) throw new Error(`${prefix}.source_evidence_summary is required`);
  if (!candidate.public_access_posture) throw new Error(`${prefix}.public_access_posture is required`);
  if (!candidate.allowed_capture_zones.length) throw new Error(`${prefix}.allowed_capture_zones is required`);
  if (!candidate.avoid_zones.length) throw new Error(`${prefix}.avoid_zones is required`);
  if (!candidate.estimated_capture_minutes) throw new Error(`${prefix}.estimated_capture_minutes is required`);
  if (!candidate.suggested_payout_cents) throw new Error(`${prefix}.suggested_payout_cents is required`);
  if (!candidate.payout_basis) throw new Error(`${prefix}.payout_basis is required`);
}

function normalizeCandidate(candidate: CandidateInput, index: number): NormalizedCandidate {
  const name = requireString(candidate.place_name || candidate.name, `accepted_candidates[${index}].place_name`);
  const indoorPosture = normalizeIndoorPosture(candidate.indoor_posture, `accepted_candidates[${index}].indoor_posture`);
  const verificationStatus = normalizeVerificationStatus(
    candidate.verification_status,
    `accepted_candidates[${index}].verification_status`,
  );
  const normalized: NormalizedCandidate = {
    candidate_id: requireString(candidate.candidate_id, `accepted_candidates[${index}].candidate_id`),
    name,
    address: optionalString(candidate.address),
    lat: finiteNumber(candidate.latitude ?? candidate.lat, `accepted_candidates[${index}].latitude`),
    lng: finiteNumber(candidate.longitude ?? candidate.lng, `accepted_candidates[${index}].longitude`),
    provider: optionalString(candidate.provider) || "agent_web_research",
    provider_place_id: optionalString(candidate.provider_place_id),
    types: normalizeStringArray(candidate.types),
    source_urls: normalizeStringArray(candidate.source_urls),
    source_evidence_summary: requireString(
      candidate.source_evidence_summary,
      `accepted_candidates[${index}].source_evidence_summary`,
    ),
    source_queries: normalizeStringArray(candidate.source_queries),
    source_buckets: normalizeStringArray(candidate.source_buckets),
    candidate_type: requireString(candidate.candidate_type, `accepted_candidates[${index}].candidate_type`),
    indoor_posture: indoorPosture,
    public_access_posture: requireString(
      candidate.public_access_posture,
      `accepted_candidates[${index}].public_access_posture`,
    ),
    allowed_capture_zones: normalizeStringArray(candidate.allowed_capture_zones),
    avoid_zones: normalizeStringArray(candidate.avoid_zones),
    camera_policy_evidence: optionalString(candidate.camera_policy_evidence),
    confidence: optionalString(candidate.confidence) || "medium",
    verification_status: verificationStatus,
    reviewState: optionalString(candidate.reviewState) || "awaiting_city_review",
    status: optionalString(candidate.status) || "researched",
    rejection_reason: optionalString(candidate.rejection_reason),
    estimated_public_area_sqft: optionalFiniteNumber(
      candidate.estimated_public_area_sqft,
      `accepted_candidates[${index}].estimated_public_area_sqft`,
    ),
    estimated_capture_minutes: finiteNumber(
      candidate.estimated_capture_minutes,
      `accepted_candidates[${index}].estimated_capture_minutes`,
    ),
    estimated_capture_complexity: normalizeComplexity(
      candidate.estimated_capture_complexity,
      `accepted_candidates[${index}].estimated_capture_complexity`,
    ),
    demand_score: optionalFiniteNumber(candidate.demand_score, `accepted_candidates[${index}].demand_score`),
    suggested_payout_cents: finiteNumber(
      candidate.suggested_payout_cents,
      `accepted_candidates[${index}].suggested_payout_cents`,
    ),
    suggested_payout_range_cents: Array.isArray(candidate.suggested_payout_range_cents)
      ? [
          finiteNumber(candidate.suggested_payout_range_cents[0], `accepted_candidates[${index}].suggested_payout_range_cents[0]`),
          finiteNumber(candidate.suggested_payout_range_cents[1], `accepted_candidates[${index}].suggested_payout_range_cents[1]`),
        ]
      : null,
    payout_basis: requireString(candidate.payout_basis, `accepted_candidates[${index}].payout_basis`),
    last_verified_at: requireString(candidate.last_verified_at, `accepted_candidates[${index}].last_verified_at`),
    reviewed_by_agent: optionalString(candidate.reviewed_by_agent) || "capturer-growth-agent",
    notes: optionalString(candidate.notes),
    coverage_run_id: optionalString(candidate.coverage_run_id),
    coverage_tile_id: optionalString(candidate.coverage_tile_id),
    coverage_category: optionalString(candidate.coverage_category),
    source_bucket: optionalString(candidate.source_bucket),
    source_quality: optionalString(candidate.source_quality),
    discovery_query: optionalString(candidate.discovery_query),
    duplicate_of_candidate_id: optionalString(candidate.duplicate_of_candidate_id),
    excluded_by_coverage_policy_reason: optionalString(candidate.excluded_by_coverage_policy_reason),
  };
  assertIndoorCandidate(normalized, index);
  return normalized;
}

function loadLedger(inputPath: string) {
  const resolved = path.resolve(inputPath);
  const parsed = JSON.parse(fs.readFileSync(resolved, "utf8")) as CandidateLedgerInput;
  const city = requireString(parsed.city, "city");
  const rawCandidates = parsed.accepted_candidates || parsed.candidates || [];
  if (!Array.isArray(rawCandidates) || !rawCandidates.length) {
    throw new Error("accepted_candidates must contain at least one entry");
  }
  const candidates = rawCandidates.map(normalizeCandidate);
  const rejectedCandidates = Array.isArray(parsed.rejected_candidates)
    ? parsed.rejected_candidates
    : [];
  rejectedCandidates.forEach((candidate, index) => {
    requireString(candidate.candidate_id || candidate.place_name || candidate.name, `rejected_candidates[${index}].candidate_id`);
    requireString(candidate.rejection_reason || candidate.reason_code, `rejected_candidates[${index}].rejection_reason`);
  });
  return {
    ...parsed,
    city,
    source_context: parsed.source_context || "agent_public_candidate_research",
    creator_id: parsed.creator_id || "agent:indoor-location-supply-agent",
    candidates,
    rejectedCandidates,
  };
}

function countBy<T extends string | number | null>(values: T[]) {
  return values.reduce<Record<string, number>>((accumulator, value) => {
    const key = String(value || "unknown");
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

function normalizedPlaceKey(value: string | null | undefined) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function basePlaceName(value: string) {
  return value.split(/\s+-\s+/)[0]?.trim() || value.trim();
}

async function reconcileSupersededPublicProspects(input: {
  city: string;
  acceptedCandidates: NormalizedCandidate[];
  rejectedCandidates: RejectedCandidateInput[];
  promotedProspectIds: string[];
}) {
  const rejectedKeys = new Set(
    input.rejectedCandidates
      .map((candidate) => normalizedPlaceKey(candidate.place_name || candidate.name || candidate.candidate_id))
      .filter(Boolean),
  );
  const promotedIds = new Set(input.promotedProspectIds);
  const zoneScopedBaseKeys = new Set(
    input.acceptedCandidates
      .map((candidate) => candidate.name)
      .filter((name) => /\s+-\s+/.test(name))
      .map((name) => normalizedPlaceKey(basePlaceName(name)))
      .filter(Boolean),
  );
  if (!rejectedKeys.size && !zoneScopedBaseKeys.size) {
    return [];
  }

  const prospects = await listCityLaunchProspects(input.city);
  const demotableStatuses = new Set(["identified", "contacted", "responded", "qualified", "approved"]);
  const demotions = [];
  for (const prospect of prospects) {
    if (prospect.sourceBucket !== "public_commercial_review_candidate") continue;
    if (promotedIds.has(prospect.id)) continue;
    if (!demotableStatuses.has(prospect.status)) continue;
    const nameKey = normalizedPlaceKey(prospect.name);
    const matchedRejected = rejectedKeys.has(nameKey);
    const supersededByZoneScopedCandidate = zoneScopedBaseKeys.has(nameKey);
    if (!matchedRejected && !supersededByZoneScopedCandidate) continue;
    const reason = matchedRejected
      ? "matched rejected candidate in latest indoor-location supply artifact"
      : "superseded by a zone-specific indoor candidate in latest indoor-location supply artifact";
    const updated = await updateCityLaunchProspectLifecycle(prospect.id, {
      status: "inactive",
      notes: `Demoted by indoor-location supply reconciliation: ${reason}. This does not erase prior research; it prevents stale broad/outdoor records from remaining approved launch targets.`,
      priorityNote: `Inactive after indoor-location supply reconciliation: ${reason}.`,
    });
    demotions.push({
      id: updated.id,
      name: updated.name,
      previousStatus: prospect.status,
      status: updated.status,
      reason,
    });
  }
  return demotions;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = args.get("input");
  if (typeof inputPath !== "string") {
    throw new Error(
      "Usage: tsx scripts/city-launch/seed-public-review-candidates.ts --input <ledger.json> [--apply] [--skip-review]",
    );
  }

  const apply = args.has("apply");
  const autoReview = apply && !args.has("skip-review") && !args.has("no-review");
  const ledger = loadLedger(inputPath);
  const sourceContext = ledger.source_context as CityLaunchCandidateSignalSourceContext;
  const creatorId = ledger.creator_id;

  const candidates = ledger.candidates.map((candidate) => ({
    creatorId,
    city: ledger.city,
    name: candidate.name,
    address: candidate.address,
    lat: candidate.lat,
    lng: candidate.lng,
    provider: candidate.provider,
    providerPlaceId: candidate.provider_place_id || candidate.candidate_id,
    types: candidate.types,
    sourceContext,
    sourceUrls: candidate.source_urls,
    sourceEvidenceSummary: candidate.source_evidence_summary,
    sourceQueries: candidate.source_queries,
    sourceBuckets: candidate.source_buckets,
    candidateType: candidate.candidate_type,
    indoorPosture: candidate.indoor_posture,
    publicAccessPosture: candidate.public_access_posture,
    allowedCaptureZones: candidate.allowed_capture_zones,
    avoidZones: candidate.avoid_zones,
    cameraPolicyEvidence: candidate.camera_policy_evidence,
    confidence: candidate.confidence,
    verificationStatus: candidate.verification_status,
    rejectionReason: candidate.rejection_reason,
    estimatedPublicAreaSqft: candidate.estimated_public_area_sqft,
    estimatedCaptureMinutes: candidate.estimated_capture_minutes,
    estimatedCaptureComplexity: candidate.estimated_capture_complexity,
    demandScore: candidate.demand_score,
    suggestedPayoutCents: candidate.suggested_payout_cents,
    payoutBasis: candidate.payout_basis,
    lastVerifiedAt: candidate.last_verified_at,
    reviewedByAgent: candidate.reviewed_by_agent,
    seedStatus: candidate.status,
    seedNotes: candidate.notes,
    coverageRunId: candidate.coverage_run_id,
    coverageTileId: candidate.coverage_tile_id,
    coverageCategory: candidate.coverage_category,
    sourceBucket: candidate.source_bucket || candidate.source_buckets[0] || null,
    sourceQuality: candidate.source_quality,
    discoveryQuery: candidate.discovery_query || candidate.source_queries[0] || null,
    duplicateOfCandidateId: candidate.duplicate_of_candidate_id,
    excludedByCoveragePolicyReason: candidate.excluded_by_coverage_policy_reason,
  }));

  const summary = {
    mode: apply ? "apply" : "dry_run",
    city: ledger.city,
    sourceContext,
    creatorId,
    acceptedCandidateCount: candidates.length,
    rejectedCandidateCount: ledger.rejectedCandidates.length,
    countsByIndoorPosture: countBy(ledger.candidates.map((candidate) => candidate.indoor_posture)),
    countsByVerificationStatus: countBy(ledger.candidates.map((candidate) => candidate.verification_status)),
    promotableVerifiedCount: ledger.candidates.filter((candidate) => candidate.verification_status === "verified").length,
    reviewOnlyCount: ledger.candidates.filter((candidate) => candidate.verification_status !== "verified").length,
    appFacingHydrationPreview: {
      materializableSignals: candidates.length,
      blockedOutdoorOrUnknown: 0,
      rejectedSavedOnly: ledger.rejectedCandidates.length,
    },
    candidates: candidates.map((candidate) => ({
      name: candidate.name,
      address: candidate.address,
      lat: candidate.lat,
      lng: candidate.lng,
      indoorPosture: candidate.indoorPosture,
      verificationStatus: candidate.verificationStatus,
      suggestedPayoutCents: candidate.suggestedPayoutCents,
    })),
  };

  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (!db) {
    throw new Error("Firebase Admin is not configured");
  }

  const records = await intakeCityLaunchCandidateSignals(candidates);
  const review = autoReview
    ? await reviewCityLaunchCandidateBatch({
        city: ledger.city,
        candidateIds: records.map((record) => record.id),
        limit: records.length,
        dryRun: false,
        reviewedBy: "public-space-review-agent",
      })
    : null;
  const prospectReconciliation = autoReview
    ? await reconcileSupersededPublicProspects({
        city: ledger.city,
        acceptedCandidates: ledger.candidates,
        rejectedCandidates: ledger.rejectedCandidates,
        promotedProspectIds: review?.outcomes
          .map((outcome) => outcome.promotedProspectId)
          .filter((id): id is string => Boolean(id)) || [],
      })
    : [];
  console.log(JSON.stringify({
    ...summary,
    mode: "applied",
    autoReview: {
      enabled: autoReview,
      result: review,
    },
    prospectReconciliation,
    records: records.map((record) => ({
      id: record.id,
      name: record.name,
      status: record.status,
      reviewState: record.reviewState,
      seenCount: record.seenCount,
      indoorPosture: record.indoorPosture,
      verificationStatus: record.verificationStatus,
    })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
