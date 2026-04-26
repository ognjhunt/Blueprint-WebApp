import fs from "node:fs";
import path from "node:path";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { getConfiguredEnvValue } from "../config/env";
import { reviewCityLaunchCandidateBatch } from "./cityLaunchCandidateReview";
import {
  intakeCityLaunchCandidateSignals,
  listCityLaunchCandidateSignals,
  listCityLaunchProspects,
  type CityLaunchCandidateSignalRecord,
  type CityLaunchCaptureComplexity,
  type CityLaunchIndoorPosture,
  type CityLaunchLocationVerificationStatus,
  type CityLaunchProspectRecord,
} from "./cityLaunchLedgers";
import { slugifyCityName } from "./cityLaunchProfiles";

export type CityLaunchCoverageInventoryTargets = {
  approvedActiveMin: number;
  inReviewMin: number;
  researchedBacklogMin: number;
  maxNewCandidatesPerRun: number;
};

export type CityLaunchCoverageTile = {
  id: string;
  label: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  approvedActiveMin: number;
  inReviewMin: number;
};

export type CityLaunchCoverageCategoryQuota = {
  category: string;
  approvedActiveMin: number;
  inReviewMin: number;
};

export type CityLaunchCoverageSourceBucketQuota = {
  sourceBucket: string;
  minShare?: number;
  maxShare?: number;
};

export type CityLaunchCoveragePolicy = {
  city: string;
  citySlug: string;
  version: string;
  inventoryTargets: CityLaunchCoverageInventoryTargets;
  geographicTiles: CityLaunchCoverageTile[];
  categoryQuotas: CityLaunchCoverageCategoryQuota[];
  sourceBucketQuotas: CityLaunchCoverageSourceBucketQuota[];
  blockedPatterns: string[];
  createdAtIso?: string;
  updatedAtIso?: string;
  ownerAgent?: string;
};

export type CityLaunchCoverageCell = {
  city: string;
  citySlug: string;
  tileId: string;
  category: string;
  approvedActiveCount: number;
  inReviewCount: number;
  rejectedCount: number;
  inactiveCount: number;
  researchedBacklogCount: number;
  approvedActiveMin: number;
  inReviewMin: number;
  lastExpandedAtIso: string | null;
  nextExpansionPriority: number;
};

export type CityLaunchCoverageGapCell = CityLaunchCoverageCell & {
  tileLabel: string;
  approvedGap: number;
  inReviewGap: number;
  sourceBucketWarnings: string[];
};

export type CityLaunchCoverageQueryPlanItem = {
  cellId: string;
  city: string;
  citySlug: string;
  tileId: string;
  tileLabel: string;
  category: string;
  sourceBucket: string;
  query: string;
  priority: number;
  expectedCandidates: number;
};

export type CityLaunchCoverageSnapshot = {
  generatedAtIso: string;
  city: string;
  citySlug: string;
  countsByStatus: Record<string, number>;
  countsByCategory: Record<string, number>;
  countsByTile: Record<string, number>;
  countsBySourceBucket: Record<string, number>;
  totals: {
    approvedActiveCount: number;
    inReviewCount: number;
    researchedBacklogCount: number;
    rejectedCount: number;
    inactiveCount: number;
    claimedCount: number;
    capturedCount: number;
    exhaustedCount: number;
  };
  cells: CityLaunchCoverageCell[];
};

export type CityLaunchCoveragePlan = {
  generatedAtIso: string;
  city: string;
  citySlug: string;
  policy: CityLaunchCoveragePolicy;
  coverageBefore: CityLaunchCoverageSnapshot;
  gapCells: CityLaunchCoverageGapCell[];
  queryPlan: CityLaunchCoverageQueryPlanItem[];
  duplicateRiskWarnings: string[];
  recommendedNextAction: string;
};

export type CityLaunchCoverageRunRecord = {
  id: string;
  city: string;
  citySlug: string;
  status: "planned" | "running" | "completed" | "blocked" | "failed";
  trigger: "scheduled" | "manual" | "low_inventory" | "post_capture_replenishment";
  coverageBefore: CityLaunchCoverageSnapshot;
  coverageAfter: CityLaunchCoverageSnapshot | null;
  gapCells: CityLaunchCoverageGapCell[];
  queryPlan: CityLaunchCoverageQueryPlanItem[];
  seededCandidateIds: string[];
  promotedProspectIds: string[];
  keptInReviewCandidateIds: string[];
  rejectedCandidateIds: string[];
  dedupedCandidateIds: string[];
  createdAtIso: string;
  completedAtIso: string | null;
  failureReason: string | null;
  searchEvidence: CityLaunchCoverageSearchEvidence[];
};

type CityLaunchCoverageSearchEvidence = {
  query: string;
  sourceBucket: string;
  citations: string[];
  fetchedUrls: string[];
  blockedReason: string | null;
};

type StructuredCoverageCandidate = {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  providerPlaceId: string | null;
  sourceUrls: string[];
  sourceEvidenceSummary: string;
  indoorPosture: CityLaunchIndoorPosture;
  publicAccessPosture: string;
  allowedCaptureZones: string[];
  avoidZones: string[];
  cameraPolicyEvidence: string | null;
  confidence: string;
  verificationStatus: CityLaunchLocationVerificationStatus;
  estimatedCaptureMinutes: number | null;
  estimatedCaptureComplexity: CityLaunchCaptureComplexity | null;
  suggestedPayoutCents: number | null;
  payoutBasis: string | null;
};

const POLICY_COLLECTION = "cityLaunchCoveragePolicies";
const RUN_COLLECTION = "cityLaunchCoverageRuns";
const CELL_COLLECTION = "cityLaunchCoverageCells";

const memoryPolicies = new Map<string, CityLaunchCoveragePolicy>();
const memoryRuns = new Map<string, CityLaunchCoverageRunRecord>();
const memoryCells = new Map<string, CityLaunchCoverageCell>();

function nowIso() {
  return new Date().toISOString();
}

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function normalizedCategory(value: string | null | undefined) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "unknown";
}

function countInto(record: Record<string, number>, key: string, amount = 1) {
  record[key] = (record[key] || 0) + amount;
}

function policyPath(citySlug: string) {
  return path.join(
    process.cwd(),
    "ops",
    "paperclip",
    "playbooks",
    `city-launch-${citySlug}-coverage-policy.json`,
  );
}

function defaultTileForCity(city: string): CityLaunchCoverageTile[] {
  const slug = slugifyCityName(city);
  if (slug === "durham-nc") {
    return [
      { id: "downtown-core", label: "Downtown Durham", center: { lat: 35.9956, lng: -78.9018 }, radiusMeters: 1600, approvedActiveMin: 15, inReviewMin: 25 },
      { id: "ninth-street-duke", label: "Ninth Street / Duke", center: { lat: 36.0081, lng: -78.9216 }, radiusMeters: 1800, approvedActiveMin: 8, inReviewMin: 16 },
      { id: "rtp-southpoint", label: "RTP / Southpoint", center: { lat: 35.9034, lng: -78.9426 }, radiusMeters: 4200, approvedActiveMin: 12, inReviewMin: 24 },
    ];
  }
  if (slug === "austin-tx") {
    return [
      { id: "downtown-convention", label: "Downtown / Convention District", center: { lat: 30.2649, lng: -97.7403 }, radiusMeters: 2200, approvedActiveMin: 18, inReviewMin: 32 },
      { id: "domain-arboretum", label: "Domain / Arboretum", center: { lat: 30.4012, lng: -97.7253 }, radiusMeters: 3600, approvedActiveMin: 14, inReviewMin: 26 },
      { id: "south-congress", label: "South Congress", center: { lat: 30.2496, lng: -97.7498 }, radiusMeters: 2200, approvedActiveMin: 10, inReviewMin: 18 },
    ];
  }
  if (slug === "sacramento-ca") {
    return [
      { id: "downtown-civic", label: "Downtown / Civic Core", center: { lat: 38.5816, lng: -121.4944 }, radiusMeters: 2200, approvedActiveMin: 16, inReviewMin: 30 },
      { id: "midtown", label: "Midtown", center: { lat: 38.5738, lng: -121.4701 }, radiusMeters: 1800, approvedActiveMin: 10, inReviewMin: 20 },
      { id: "arden-commercial", label: "Arden Commercial Corridor", center: { lat: 38.6008, lng: -121.4260 }, radiusMeters: 2800, approvedActiveMin: 10, inReviewMin: 20 },
    ];
  }
  if (slug === "chicago-il") {
    return [
      { id: "loop-river-north", label: "Loop / River North", center: { lat: 41.8837, lng: -87.6325 }, radiusMeters: 1800, approvedActiveMin: 20, inReviewMin: 36 },
      { id: "west-loop", label: "West Loop", center: { lat: 41.8836, lng: -87.6486 }, radiusMeters: 1600, approvedActiveMin: 12, inReviewMin: 24 },
      { id: "lincoln-park-lakeview", label: "Lincoln Park / Lakeview", center: { lat: 41.9255, lng: -87.6488 }, radiusMeters: 2600, approvedActiveMin: 14, inReviewMin: 26 },
      { id: "hyde-park", label: "Hyde Park", center: { lat: 41.7943, lng: -87.5907 }, radiusMeters: 2200, approvedActiveMin: 10, inReviewMin: 20 },
    ];
  }
  return [
    { id: "city-core", label: `${city.split(",")[0]?.trim() || city} core`, center: { lat: 0, lng: 0 }, radiusMeters: 3000, approvedActiveMin: 20, inReviewMin: 40 },
  ];
}

function defaultCategoriesForCity(city: string): CityLaunchCoverageCategoryQuota[] {
  const slug = slugifyCityName(city);
  const base: Array<[string, number, number]> = [
    ["food_hall", 4, 8],
    ["indoor_market", 4, 8],
    ["mall_concourse", 4, 8],
    ["public_lobby", 8, 16],
    ["museum_gallery_common_area", 6, 12],
    ["hotel_lobby_common_area", 8, 16],
    ["coworking_public_area", 4, 8],
    ["large_retail_customer_area", 12, 24],
  ];
  const weighted: Array<[string, number, number]> = slug === "chicago-il"
    ? [["convention_prefunction", 6, 12], ...base, ["transit_concourse_common_area", 4, 8]]
    : slug === "austin-tx"
      ? [["convention_prefunction", 8, 14], ["coworking_public_area", 8, 16], ...base]
      : slug === "sacramento-ca"
        ? [["visitor_center_common_area", 6, 12], ["civic_public_lobby", 6, 12], ...base]
        : slug === "durham-nc"
          ? [["university_adjacent_public_area", 4, 8], ["visitor_center_common_area", 4, 8], ...base]
          : base;
  return weighted.map(([category, approvedActiveMin, inReviewMin]) => ({
    category,
    approvedActiveMin,
    inReviewMin,
  }));
}

export function buildDefaultCityLaunchCoveragePolicy(city: string): CityLaunchCoveragePolicy {
  const citySlug = slugifyCityName(city);
  const timestamp = nowIso();
  return {
    city: city.trim(),
    citySlug,
    version: "2026-04-26",
    inventoryTargets: {
      approvedActiveMin: citySlug === "chicago-il" ? 90 : 50,
      inReviewMin: citySlug === "chicago-il" ? 160 : 100,
      researchedBacklogMin: citySlug === "chicago-il" ? 400 : 250,
      maxNewCandidatesPerRun: 40,
    },
    geographicTiles: defaultTileForCity(city),
    categoryQuotas: defaultCategoriesForCity(city),
    sourceBucketQuotas: [
      { sourceBucket: "official_venue_site", minShare: 0.45 },
      { sourceBucket: "official_tourism_or_chamber", minShare: 0.2 },
      { sourceBucket: "maps_or_directory", maxShare: 0.25 },
      { sourceBucket: "news_or_blog_context", maxShare: 0.1 },
    ],
    blockedPatterns: [
      "outdoor-primary",
      "staff-only",
      "private facility",
      "camera hostile",
      "campus-wide without zone-specific indoor target",
    ],
    createdAtIso: timestamp,
    updatedAtIso: timestamp,
    ownerAgent: "capturer-growth-agent",
  };
}

function normalizePolicy(input: Partial<CityLaunchCoveragePolicy>, cityFallback: string): CityLaunchCoveragePolicy {
  const city = String(input.city || cityFallback).trim();
  const citySlug = String(input.citySlug || slugifyCityName(city)).trim();
  const fallback = buildDefaultCityLaunchCoveragePolicy(city);
  return {
    ...fallback,
    ...input,
    city,
    citySlug,
    inventoryTargets: {
      ...fallback.inventoryTargets,
      ...(input.inventoryTargets || {}),
    },
    geographicTiles: Array.isArray(input.geographicTiles) && input.geographicTiles.length
      ? input.geographicTiles
      : fallback.geographicTiles,
    categoryQuotas: Array.isArray(input.categoryQuotas) && input.categoryQuotas.length
      ? input.categoryQuotas
      : fallback.categoryQuotas,
    sourceBucketQuotas: Array.isArray(input.sourceBucketQuotas) && input.sourceBucketQuotas.length
      ? input.sourceBucketQuotas
      : fallback.sourceBucketQuotas,
    blockedPatterns: Array.isArray(input.blockedPatterns) ? input.blockedPatterns : fallback.blockedPatterns,
  };
}

export async function readCityLaunchCoveragePolicy(city: string) {
  const citySlug = slugifyCityName(city);
  if (memoryPolicies.has(citySlug)) {
    return memoryPolicies.get(citySlug)!;
  }

  if (db) {
    const doc = await db.collection(POLICY_COLLECTION).doc(citySlug).get();
    if (doc.exists) {
      const policy = normalizePolicy(doc.data() as Partial<CityLaunchCoveragePolicy>, city);
      memoryPolicies.set(citySlug, policy);
      return policy;
    }
  }

  const repoPath = policyPath(citySlug);
  if (fs.existsSync(repoPath)) {
    const policy = normalizePolicy(JSON.parse(fs.readFileSync(repoPath, "utf8")), city);
    memoryPolicies.set(citySlug, policy);
    return policy;
  }

  const policy = buildDefaultCityLaunchCoveragePolicy(city);
  memoryPolicies.set(citySlug, policy);
  return policy;
}

export async function materializeCityLaunchCoveragePolicy(policy: CityLaunchCoveragePolicy) {
  const timestamp = nowIso();
  const payload = {
    ...policy,
    createdAtIso: policy.createdAtIso || timestamp,
    updatedAtIso: timestamp,
    ownerAgent: policy.ownerAgent || "capturer-growth-agent",
  };
  memoryPolicies.set(policy.citySlug, payload);
  if (db) {
    await db.collection(POLICY_COLLECTION).doc(policy.citySlug).set(
      {
        ...payload,
        updated_at: serverTimestamp(),
        ...(!policy.createdAtIso ? { created_at: serverTimestamp() } : {}),
      },
      { merge: true },
    );
  }
  return payload;
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  if (!Number.isFinite(a.lat) || !Number.isFinite(a.lng) || !Number.isFinite(b.lat) || !Number.isFinite(b.lng)) {
    return Number.POSITIVE_INFINITY;
  }
  if ((a.lat === 0 && a.lng === 0) || (b.lat === 0 && b.lng === 0)) {
    return Number.POSITIVE_INFINITY;
  }
  const radius = 6371000;
  const toRad = (value: number) => value * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function resolveTileId(policy: CityLaunchCoveragePolicy, record: { coverageTileId?: string | null; lat?: number | null; lng?: number | null }) {
  if (record.coverageTileId) return record.coverageTileId;
  let best: { id: string; distance: number } | null = null;
  for (const tile of policy.geographicTiles) {
    const distance = distanceMeters(tile.center, { lat: Number(record.lat), lng: Number(record.lng) });
    if (distance <= tile.radiusMeters && (!best || distance < best.distance)) {
      best = { id: tile.id, distance };
    }
  }
  return best?.id || "unmapped";
}

function resolveProspectCategory(record: CityLaunchProspectRecord) {
  return normalizedCategory(record.coverageCategory || record.siteCategory || record.workflowFit || "unknown");
}

function resolveCandidateCategory(record: CityLaunchCandidateSignalRecord) {
  return normalizedCategory(record.coverageCategory || record.candidateType || record.types?.[0] || "unknown");
}

function isApprovedActiveProspect(record: CityLaunchProspectRecord) {
  return record.status === "approved" && !["claimed", "captured", "exhausted", "paused"].includes(record.claimState || "available");
}

function cellId(input: { citySlug: string; tileId: string; category: string }) {
  return `${input.citySlug}:${input.tileId}:${input.category}`;
}

async function safeInventory(city: string) {
  const warnings: string[] = [];
  const [prospectsResult, candidatesResult] = await Promise.allSettled([
    listCityLaunchProspects(city),
    listCityLaunchCandidateSignals({ city }),
  ]);
  const prospects = prospectsResult.status === "fulfilled" ? prospectsResult.value : [];
  const candidates = candidatesResult.status === "fulfilled" ? candidatesResult.value : [];
  if (prospectsResult.status === "rejected") {
    warnings.push(`prospect inventory unavailable: ${prospectsResult.reason instanceof Error ? prospectsResult.reason.message : String(prospectsResult.reason)}`);
  }
  if (candidatesResult.status === "rejected") {
    warnings.push(`candidate signal inventory unavailable: ${candidatesResult.reason instanceof Error ? candidatesResult.reason.message : String(candidatesResult.reason)}`);
  }
  return { prospects, candidates, warnings };
}

export async function buildCityLaunchCoverageSnapshot(
  city: string,
  policy?: CityLaunchCoveragePolicy,
): Promise<CityLaunchCoverageSnapshot> {
  const resolvedPolicy = policy || await readCityLaunchCoveragePolicy(city);
  const { prospects, candidates } = await safeInventory(city);
  const countsByStatus: Record<string, number> = {};
  const countsByCategory: Record<string, number> = {};
  const countsByTile: Record<string, number> = {};
  const countsBySourceBucket: Record<string, number> = {};
  const cellCounts = new Map<string, CityLaunchCoverageCell>();
  const totals = {
    approvedActiveCount: 0,
    inReviewCount: 0,
    researchedBacklogCount: 0,
    rejectedCount: 0,
    inactiveCount: 0,
    claimedCount: 0,
    capturedCount: 0,
    exhaustedCount: 0,
  };

  const ensureCell = (tileId: string, category: string) => {
    const id = cellId({ citySlug: resolvedPolicy.citySlug, tileId, category });
    if (!cellCounts.has(id)) {
      cellCounts.set(id, {
        city: resolvedPolicy.city,
        citySlug: resolvedPolicy.citySlug,
        tileId,
        category,
        approvedActiveCount: 0,
        inReviewCount: 0,
        rejectedCount: 0,
        inactiveCount: 0,
        researchedBacklogCount: 0,
        approvedActiveMin: 0,
        inReviewMin: 0,
        lastExpandedAtIso: null,
        nextExpansionPriority: 0,
      });
    }
    return cellCounts.get(id)!;
  };

  for (const prospect of prospects) {
    const category = resolveProspectCategory(prospect);
    const tileId = resolveTileId(resolvedPolicy, prospect);
    const sourceBucket = prospect.sourceBucket || "unknown";
    countInto(countsByStatus, `prospect:${prospect.status}`);
    countInto(countsByCategory, category);
    countInto(countsByTile, tileId);
    countInto(countsBySourceBucket, sourceBucket);
    const cell = ensureCell(tileId, category);
    if (isApprovedActiveProspect(prospect)) {
      totals.approvedActiveCount += 1;
      cell.approvedActiveCount += 1;
    }
    if (prospect.status === "inactive") {
      totals.inactiveCount += 1;
      cell.inactiveCount += 1;
    }
    if (prospect.claimState === "claimed") totals.claimedCount += 1;
    if (prospect.claimState === "captured") totals.capturedCount += 1;
    if (prospect.claimState === "exhausted") totals.exhaustedCount += 1;
  }

  for (const candidate of candidates) {
    const category = resolveCandidateCategory(candidate);
    const tileId = resolveTileId(resolvedPolicy, candidate);
    const sourceBucket = candidate.sourceBucket || candidate.sourceBuckets?.[0] || "unknown";
    countInto(countsByStatus, `candidate:${candidate.status}`);
    countInto(countsByCategory, category);
    countInto(countsByTile, tileId);
    countInto(countsBySourceBucket, sourceBucket);
    const cell = ensureCell(tileId, category);
    if (candidate.status === "queued" || candidate.status === "in_review") {
      totals.inReviewCount += 1;
      cell.inReviewCount += 1;
      if (candidate.seedStatus === "researched") {
        totals.researchedBacklogCount += 1;
        cell.researchedBacklogCount += 1;
      }
    }
    if (candidate.status === "rejected") {
      totals.rejectedCount += 1;
      cell.rejectedCount += 1;
    }
  }

  for (const tile of resolvedPolicy.geographicTiles) {
    for (const quota of resolvedPolicy.categoryQuotas) {
      const cell = ensureCell(tile.id, quota.category);
      const tileApprovedShare = tile.approvedActiveMin / Math.max(1, resolvedPolicy.inventoryTargets.approvedActiveMin);
      const tileReviewShare = tile.inReviewMin / Math.max(1, resolvedPolicy.inventoryTargets.inReviewMin);
      cell.approvedActiveMin = Math.max(1, Math.ceil(quota.approvedActiveMin * tileApprovedShare));
      cell.inReviewMin = Math.max(1, Math.ceil(quota.inReviewMin * tileReviewShare));
      cell.nextExpansionPriority = Math.max(
        0,
        cell.approvedActiveMin - cell.approvedActiveCount,
      ) * 3 + Math.max(0, cell.inReviewMin - cell.inReviewCount);
    }
  }

  return {
    generatedAtIso: nowIso(),
    city: resolvedPolicy.city,
    citySlug: resolvedPolicy.citySlug,
    countsByStatus,
    countsByCategory,
    countsByTile,
    countsBySourceBucket,
    totals,
    cells: [...cellCounts.values()].sort((left, right) => right.nextExpansionPriority - left.nextExpansionPriority),
  };
}

function sourceBucketWarnings(snapshot: CityLaunchCoverageSnapshot, policy: CityLaunchCoveragePolicy) {
  const total = Object.values(snapshot.countsBySourceBucket).reduce((sum, count) => sum + count, 0);
  if (!total) {
    return ["no source-bucket inventory yet"];
  }
  return policy.sourceBucketQuotas.flatMap((quota) => {
    const share = (snapshot.countsBySourceBucket[quota.sourceBucket] || 0) / total;
    if (typeof quota.minShare === "number" && share < quota.minShare) {
      return [`${quota.sourceBucket} share ${share.toFixed(2)} is below min ${quota.minShare}`];
    }
    if (typeof quota.maxShare === "number" && share > quota.maxShare) {
      return [`${quota.sourceBucket} share ${share.toFixed(2)} is above max ${quota.maxShare}`];
    }
    return [];
  });
}

function buildGapCells(snapshot: CityLaunchCoverageSnapshot, policy: CityLaunchCoveragePolicy) {
  const tileLabels = new Map(policy.geographicTiles.map((tile) => [tile.id, tile.label]));
  const sourceWarnings = sourceBucketWarnings(snapshot, policy);
  return snapshot.cells
    .map((cell) => ({
      ...cell,
      tileLabel: tileLabels.get(cell.tileId) || cell.tileId,
      approvedGap: Math.max(0, cell.approvedActiveMin - cell.approvedActiveCount),
      inReviewGap: Math.max(0, cell.inReviewMin - cell.inReviewCount),
      sourceBucketWarnings: sourceWarnings,
    }))
    .filter((cell) => cell.approvedGap > 0 || cell.inReviewGap > 0)
    .sort((left, right) => right.nextExpansionPriority - left.nextExpansionPriority);
}

function chooseSourceBucket(policy: CityLaunchCoveragePolicy, index: number) {
  const preferred = policy.sourceBucketQuotas.find((quota) => typeof quota.minShare === "number");
  return policy.sourceBucketQuotas[index % policy.sourceBucketQuotas.length]?.sourceBucket
    || preferred?.sourceBucket
    || "official_venue_site";
}

function queryForCell(cell: CityLaunchCoverageGapCell, sourceBucket: string) {
  const categoryText = cell.category.replace(/_/g, " ");
  const tileText = cell.tileLabel;
  if (sourceBucket === "official_tourism_or_chamber") {
    return `"${cell.city}" "${tileText}" "${categoryText}" "open to the public" indoor tourism chamber`;
  }
  if (sourceBucket === "maps_or_directory") {
    return `"${cell.city}" "${tileText}" "${categoryText}" indoor public common area directory`;
  }
  if (sourceBucket === "news_or_blog_context") {
    return `"${cell.city}" "${tileText}" "${categoryText}" indoor public area local guide`;
  }
  return `"${cell.city}" "${tileText}" "${categoryText}" official "public" indoor`;
}

export async function planCityLaunchCoverageExpansion(input: {
  city: string;
  maxQueries?: number | null;
  maxCandidates?: number | null;
}): Promise<CityLaunchCoveragePlan> {
  const policy = await readCityLaunchCoveragePolicy(input.city);
  const coverageBefore = await buildCityLaunchCoverageSnapshot(input.city, policy);
  const gapCells = buildGapCells(coverageBefore, policy);
  const maxQueries = Math.max(1, Math.min(Math.trunc(input.maxQueries || 20), 100));
  const maxCandidates = Math.max(1, Math.min(
    Math.trunc(input.maxCandidates || policy.inventoryTargets.maxNewCandidatesPerRun),
    200,
  ));
  const queryPlan = gapCells.slice(0, maxQueries).map((cell, index) => {
    const sourceBucket = chooseSourceBucket(policy, index);
    return {
      cellId: cellId({ citySlug: cell.citySlug, tileId: cell.tileId, category: cell.category }),
      city: cell.city,
      citySlug: cell.citySlug,
      tileId: cell.tileId,
      tileLabel: cell.tileLabel,
      category: cell.category,
      sourceBucket,
      query: queryForCell(cell, sourceBucket),
      priority: cell.nextExpansionPriority,
      expectedCandidates: Math.min(maxCandidates, Math.max(cell.inReviewGap, cell.approvedGap)),
    };
  });

  const duplicateRiskWarnings = Object.entries(coverageBefore.countsBySourceBucket)
    .filter(([bucket, count]) => bucket === "maps_or_directory" && count > Math.max(5, coverageBefore.totals.inReviewCount / 4))
    .map(([bucket, count]) => `${bucket} already has ${count} records; prefer official source buckets this run`);

  const recommendedNextAction = queryPlan.length
    ? `Run coverage expansion against ${queryPlan.length} under-covered cells; seed only coordinate-backed candidates.`
    : "Coverage targets are currently above policy thresholds; keep daily audit cadence.";

  return {
    generatedAtIso: nowIso(),
    city: policy.city,
    citySlug: policy.citySlug,
    policy,
    coverageBefore,
    gapCells,
    queryPlan,
    duplicateRiskWarnings,
    recommendedNextAction,
  };
}

function searchProviderConfig() {
  return {
    provider: (getConfiguredEnvValue("SEARCH_API_PROVIDER") || "").toLowerCase(),
    apiKey: getConfiguredEnvValue("PARALLEL_API_KEY", "SEARCH_API_KEY"),
    parallelMcpUrl: getConfiguredEnvValue("PARALLEL_MCP_URL") || "https://search.parallel.ai/mcp",
    sessionId: getConfiguredEnvValue("PARALLEL_SESSION_ID") || "blueprint-city-launch-coverage",
    modelName: getConfiguredEnvValue("PARALLEL_MODEL_NAME") || "paperclip-agent",
  };
}

function parseMcpPayload(result: unknown): unknown {
  if (!result || typeof result !== "object") return result;
  const record = result as Record<string, unknown>;
  if (record.structuredContent) return record.structuredContent;
  const content = Array.isArray(record.content) ? record.content : [];
  const firstText = content
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const contentRecord = entry as Record<string, unknown>;
      return contentRecord.type === "text" && typeof contentRecord.text === "string" ? contentRecord.text : "";
    })
    .find(Boolean);
  if (!firstText) return result;
  try {
    return JSON.parse(firstText);
  } catch {
    return { text: firstText };
  }
}

async function callParallelTool(name: "web_search" | "web_fetch", args: Record<string, unknown>) {
  const config = searchProviderConfig();
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  const response = await fetch(config.parallelMcpUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      method: "tools/call",
      params: {
        name,
        arguments: {
          ...args,
          session_id: config.sessionId,
          model_name: config.modelName,
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`Parallel Search MCP error ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
  const data = (await response.json()) as { error?: { message?: string }; result?: unknown };
  if (data.error) {
    throw new Error(`Parallel Search MCP error: ${data.error.message || "unknown error"}`);
  }
  return parseMcpPayload(data.result);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function runSearch(query: string) {
  const config = searchProviderConfig();
  if (config.provider === "parallel_mcp" || config.provider === "parallel") {
    const payload = await callParallelTool("web_search", {
      objective: query,
      search_queries: [query.slice(0, 180)],
    });
    const results = Array.isArray((payload as Record<string, unknown>)?.results)
      ? (payload as Record<string, unknown>).results as Array<Record<string, unknown>>
      : [];
    return { payload, citations: results.map((item) => String(item.url || "")).filter(Boolean).slice(0, 8) };
  }
  if (config.provider === "brave" && config.apiKey) {
    const params = new URLSearchParams({
      q: query,
      freshness: "py",
      count: "8",
      extra_snippets: "true",
      country: "US",
      search_lang: "en",
    });
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: { "X-Subscription-Token": config.apiKey, Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`Brave Search error ${response.status}: ${(await response.text()).slice(0, 500)}`);
    const payload = await response.json() as { web?: { results?: Array<Record<string, unknown>> } };
    const results = payload.web?.results || [];
    return {
      payload: {
        results: results.map((item) => ({
          title: stripHtml(String(item.title || "")),
          url: item.url,
          excerpts: [item.description, ...(Array.isArray(item.extra_snippets) ? item.extra_snippets : [])]
            .map((entry) => stripHtml(String(entry || "")))
            .filter(Boolean),
        })),
      },
      citations: results.map((item) => String(item.url || "")).filter(Boolean).slice(0, 8),
    };
  }
  throw new Error("Governed web search is not configured; set SEARCH_API_PROVIDER=parallel_mcp or SEARCH_API_PROVIDER=brave with SEARCH_API_KEY.");
}

async function runFetch(urls: string[], query: string) {
  const config = searchProviderConfig();
  if ((config.provider !== "parallel_mcp" && config.provider !== "parallel") || urls.length === 0) {
    return { payload: null, citations: [], fetchedUrls: [] };
  }
  const payload = await callParallelTool("web_fetch", {
    urls: urls.slice(0, 5),
    objective: `Verify public indoor/common-access capture candidate evidence for: ${query}`,
    search_queries: [query],
    full_content: false,
  });
  const results = Array.isArray((payload as Record<string, unknown>)?.results)
    ? (payload as Record<string, unknown>).results as Array<Record<string, unknown>>
    : [];
  return {
    payload,
    citations: results.map((item) => String(item.url || "")).filter(Boolean),
    fetchedUrls: results.map((item) => String(item.url || "")).filter(Boolean),
  };
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeStructuredCandidates(payloads: unknown[]): StructuredCoverageCandidate[] {
  const rawRecords = payloads.flatMap((payload) => {
    if (!payload || typeof payload !== "object") return [];
    const record = payload as Record<string, unknown>;
    const candidateArrays = [record.candidates, record.places, record.results].filter(Array.isArray) as unknown[][];
    return candidateArrays.flat().filter((entry) => entry && typeof entry === "object") as Record<string, unknown>[];
  });

  return rawRecords.flatMap((record) => {
    const name = asString(record.name) || asString(record.place_name) || asString(record.title);
    const lat = asNumber(record.lat ?? record.latitude);
    const lng = asNumber(record.lng ?? record.longitude);
    if (!name || lat === null || lng === null) return [];
    const sourceUrls = [
      asString(record.url),
      asString(record.source_url),
      ...(Array.isArray(record.source_urls) ? record.source_urls.map(asString) : []),
    ].filter((value): value is string => Boolean(value));
    return [{
      name,
      address: asString(record.address),
      lat,
      lng,
      providerPlaceId: asString(record.provider_place_id) || asString(record.id),
      sourceUrls,
      sourceEvidenceSummary:
        asString(record.source_evidence_summary)
        || asString(record.summary)
        || "Governed search returned a coordinate-backed place record for public-space review.",
      indoorPosture: (asString(record.indoor_posture) as CityLaunchIndoorPosture) || "unknown",
      publicAccessPosture: asString(record.public_access_posture) || "Requires public-space review before promotion.",
      allowedCaptureZones: Array.isArray(record.allowed_capture_zones)
        ? record.allowed_capture_zones.map(asString).filter((value): value is string => Boolean(value))
        : [],
      avoidZones: Array.isArray(record.avoid_zones)
        ? record.avoid_zones.map(asString).filter((value): value is string => Boolean(value))
        : ["staff-only areas", "private rooms", "back-of-house areas"],
      cameraPolicyEvidence: asString(record.camera_policy_evidence),
      confidence: asString(record.confidence) || "medium",
      verificationStatus: (asString(record.verification_status) as CityLaunchLocationVerificationStatus) || "weak",
      estimatedCaptureMinutes: asNumber(record.estimated_capture_minutes),
      estimatedCaptureComplexity: (asString(record.estimated_capture_complexity) as CityLaunchCaptureComplexity) || null,
      suggestedPayoutCents: asNumber(record.suggested_payout_cents),
      payoutBasis: asString(record.payout_basis),
    }];
  });
}

async function writeRun(record: CityLaunchCoverageRunRecord) {
  memoryRuns.set(record.id, record);
  if (db) {
    await db.collection(RUN_COLLECTION).doc(record.id).set(
      {
        ...record,
        updated_at: serverTimestamp(),
        ...(!record.completedAtIso ? { created_at: serverTimestamp() } : {}),
      },
      { merge: true },
    );
  }
}

async function writeCells(cells: CityLaunchCoverageCell[]) {
  for (const cell of cells) {
    const id = cellId({ citySlug: cell.citySlug, tileId: cell.tileId, category: cell.category });
    memoryCells.set(id, cell);
    if (db) {
      await db.collection(CELL_COLLECTION).doc(id).set(
        {
          ...cell,
          updated_at: serverTimestamp(),
        },
        { merge: true },
      );
    }
  }
}

export async function readLatestCityLaunchCoverageRun(city: string) {
  const citySlug = slugifyCityName(city);
  const memoryMatches = [...memoryRuns.values()]
    .filter((run) => run.citySlug === citySlug)
    .sort((left, right) => String(right.createdAtIso).localeCompare(String(left.createdAtIso)));
  if (memoryMatches[0]) return memoryMatches[0];
  if (!db) return null;
  try {
    const snapshot = await db.collection(RUN_COLLECTION)
      .where("citySlug", "==", citySlug)
      .orderBy("createdAtIso", "desc")
      .limit(1)
      .get();
    return snapshot.docs[0]?.data() as CityLaunchCoverageRunRecord | undefined || null;
  } catch {
    return null;
  }
}

export async function summarizeCityLaunchCoverage(city: string) {
  const policy = await readCityLaunchCoveragePolicy(city);
  const coverage = await buildCityLaunchCoverageSnapshot(city, policy);
  const gapCells = buildGapCells(coverage, policy);
  return {
    city: policy.city,
    citySlug: policy.citySlug,
    policy,
    coverage,
    gapCells,
    lastRun: await readLatestCityLaunchCoverageRun(city),
    recommendedNextAction: gapCells.length
      ? `Expand ${gapCells[0].category.replace(/_/g, " ")} in ${gapCells[0].tileLabel}.`
      : "Coverage is currently above configured thresholds.",
  };
}

export async function runCityLaunchCoverageExpansion(input: {
  city: string;
  apply?: boolean;
  trigger?: CityLaunchCoverageRunRecord["trigger"];
  maxQueries?: number | null;
  maxCandidates?: number | null;
}) {
  const plan = await planCityLaunchCoverageExpansion(input);
  if (input.apply) {
    await materializeCityLaunchCoveragePolicy(plan.policy);
  }
  const runId = `coverage-${plan.citySlug}-${Date.now().toString(36)}`;
  const createdAtIso = nowIso();
  const run: CityLaunchCoverageRunRecord = {
    id: runId,
    city: plan.city,
    citySlug: plan.citySlug,
    status: input.apply ? "running" : "planned",
    trigger: input.trigger || "manual",
    coverageBefore: plan.coverageBefore,
    coverageAfter: null,
    gapCells: plan.gapCells,
    queryPlan: plan.queryPlan,
    seededCandidateIds: [],
    promotedProspectIds: [],
    keptInReviewCandidateIds: [],
    rejectedCandidateIds: [],
    dedupedCandidateIds: [],
    createdAtIso,
    completedAtIso: null,
    failureReason: null,
    searchEvidence: [],
  };

  if (!input.apply) {
    return { plan, run };
  }

  try {
    await writeRun(run);
    const maxCandidates = Math.max(1, Math.min(
      Math.trunc(input.maxCandidates || plan.policy.inventoryTargets.maxNewCandidatesPerRun),
      200,
    ));
    const structuredCandidates: Array<StructuredCoverageCandidate & { planItem: CityLaunchCoverageQueryPlanItem }> = [];
    for (const item of plan.queryPlan) {
      if (structuredCandidates.length >= maxCandidates) break;
      try {
        const search = await runSearch(item.query);
        const fetched = await runFetch(search.citations, item.query);
        const candidates = normalizeStructuredCandidates([search.payload, fetched.payload])
          .map((candidate) => ({ ...candidate, planItem: item }));
        structuredCandidates.push(...candidates);
        run.searchEvidence.push({
          query: item.query,
          sourceBucket: item.sourceBucket,
          citations: search.citations,
          fetchedUrls: fetched.fetchedUrls,
          blockedReason: candidates.length
            ? null
            : "search/fetch returned no coordinate-backed candidate records; not seeding fake locations",
        });
      } catch (error) {
        run.searchEvidence.push({
          query: item.query,
          sourceBucket: item.sourceBucket,
          citations: [],
          fetchedUrls: [],
          blockedReason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const toSeed = structuredCandidates.slice(0, maxCandidates).map((candidate) => ({
      creatorId: "agent:capturer-growth-agent",
      city: plan.city,
      name: candidate.name,
      address: candidate.address,
      lat: candidate.lat,
      lng: candidate.lng,
      provider: "governed_web_search",
      providerPlaceId: candidate.providerPlaceId || `${candidate.planItem.cellId}:${candidate.name}`,
      types: [candidate.planItem.category],
      sourceContext: "agent_public_candidate_research" as const,
      sourceUrls: candidate.sourceUrls,
      sourceEvidenceSummary: candidate.sourceEvidenceSummary,
      sourceQueries: [candidate.planItem.query],
      sourceBuckets: [candidate.planItem.sourceBucket],
      candidateType: candidate.planItem.category,
      indoorPosture: candidate.indoorPosture,
      publicAccessPosture: candidate.publicAccessPosture,
      allowedCaptureZones: candidate.allowedCaptureZones,
      avoidZones: candidate.avoidZones,
      cameraPolicyEvidence: candidate.cameraPolicyEvidence,
      confidence: candidate.confidence,
      verificationStatus: candidate.verificationStatus,
      estimatedCaptureMinutes: candidate.estimatedCaptureMinutes,
      estimatedCaptureComplexity: candidate.estimatedCaptureComplexity,
      suggestedPayoutCents: candidate.suggestedPayoutCents,
      payoutBasis: candidate.payoutBasis,
      lastVerifiedAt: nowIso(),
      reviewedByAgent: "capturer-growth-agent",
      seedStatus: "researched",
      seedNotes: "Seeded by city-launch coverage expansion. Search evidence is not rights clearance, operator approval, payout guarantee, or capture provenance.",
      coverageRunId: runId,
      coverageTileId: candidate.planItem.tileId,
      coverageCategory: candidate.planItem.category,
      sourceBucket: candidate.planItem.sourceBucket,
      sourceQuality: candidate.verificationStatus,
      discoveryQuery: candidate.planItem.query,
    }));

    const seeded = toSeed.length ? await intakeCityLaunchCandidateSignals(toSeed) : [];
    run.seededCandidateIds = seeded.map((candidate) => candidate.id);
    run.dedupedCandidateIds = seeded
      .filter((candidate) => candidate.seenCount > 1)
      .map((candidate) => candidate.id);

    if (seeded.length) {
      const review = await reviewCityLaunchCandidateBatch({
        city: plan.city,
        candidateIds: seeded.map((candidate) => candidate.id),
        limit: seeded.length,
        dryRun: false,
        reviewedBy: "public-space-review-agent",
      });
      run.promotedProspectIds = review.outcomes
        .map((outcome) => outcome.promotedProspectId)
        .filter((id): id is string => Boolean(id));
      run.keptInReviewCandidateIds = review.outcomes
        .filter((outcome) => outcome.decision === "keep_in_review")
        .map((outcome) => outcome.candidateId);
      run.rejectedCandidateIds = review.outcomes
        .filter((outcome) => outcome.decision === "reject")
        .map((outcome) => outcome.candidateId);
    }

    const coverageAfter = await buildCityLaunchCoverageSnapshot(plan.city, plan.policy);
    await writeCells(coverageAfter.cells);
    run.coverageAfter = coverageAfter;
    run.completedAtIso = nowIso();
    run.status = seeded.length ? "completed" : "blocked";
    run.failureReason = seeded.length
      ? null
      : "No coordinate-backed candidate records were returned by governed search/fetch; expansion did not seed fake targets.";
    await writeRun(run);
    return { plan, run };
  } catch (error) {
    run.status = "failed";
    run.completedAtIso = nowIso();
    run.failureReason = error instanceof Error ? error.message : String(error);
    await writeRun(run);
    return { plan, run };
  }
}

export function __resetCityLaunchCoverageMemoryForTests() {
  memoryPolicies.clear();
  memoryRuns.clear();
  memoryCells.clear();
}
