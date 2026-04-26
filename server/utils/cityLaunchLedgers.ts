import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  buildCityLaunchWideningGuard,
  type CityLaunchBudgetPolicy,
  type CityLaunchBudgetTier,
  type CityLaunchWideningGuard,
} from "./cityLaunchPolicy";
import { CITY_LAUNCH_MACHINE_POLICY_VERSION } from "./cityLaunchDoctrine";
import { slugifyCityName } from "./cityLaunchProfiles";
import type {
  CityLaunchBudgetCategory,
  CityLaunchBuyerProofPath,
  CityLaunchBuyerTargetStatus,
  CityLaunchProspectStatus,
  CityLaunchTouchStatus,
  CityLaunchTouchType,
} from "./cityLaunchResearchContracts";
import { isCityLaunchBuyerProofPath } from "./cityLaunchResearchContracts";

export type {
  CityLaunchBudgetCategory,
  CityLaunchBuyerProofPath,
  CityLaunchBuyerTargetStatus,
  CityLaunchProspectStatus,
  CityLaunchTouchStatus,
  CityLaunchTouchType,
} from "./cityLaunchResearchContracts";

export type CityLaunchActivationStatus =
  | "planning"
  | "activation_ready"
  | "executing"
  | "proof_live"
  | "growth_live";

export type CityLaunchResearchProvenance = {
  sourceType: "deep_research_playbook" | "city_launch_contact_enrichment" | "public_candidate_review";
  artifactPath: string;
  sourceKey: string;
  sourceUrls: string[];
  parsedAtIso: string;
  explicitFields: string[];
  inferredFields: string[];
};

export type CityLaunchActivationRecord = {
  city: string;
  citySlug: string;
  budgetTier: CityLaunchBudgetTier;
  budgetPolicy: CityLaunchBudgetPolicy;
  founderApproved: boolean;
  status: CityLaunchActivationStatus;
  rootIssueId: string | null;
  taskIssueIds: Record<string, string>;
  machineReadablePolicyVersion: string;
  wideningGuard: CityLaunchWideningGuard;
  createdAtIso: string;
  updatedAtIso: string;
};

export type CityLaunchProspectRecord = {
  id: string;
  city: string;
  citySlug: string;
  launchId: string | null;
  sourceBucket: string;
  channel: string;
  name: string;
  email: string | null;
  status: CityLaunchProspectStatus;
  ownerAgent: string | null;
  notes: string | null;
  firstContactedAt: string | null;
  lastContactedAt: string | null;
  siteAddress: string | null;
  locationSummary: string | null;
  lat: number | null;
  lng: number | null;
  siteCategory: string | null;
  workflowFit: string | null;
  priorityNote: string | null;
  researchProvenance: CityLaunchResearchProvenance | null;
  coverageRunId?: string | null;
  coverageTileId?: string | null;
  coverageCategory?: string | null;
  claimState?: "available" | "claimed" | "captured" | "exhausted" | "paused" | null;
  lastShownAtIso?: string | null;
  lastClaimedAtIso?: string | null;
  lastCapturedAtIso?: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type CityLaunchBuyerTargetRecord = {
  id: string;
  city: string;
  citySlug: string;
  launchId: string | null;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  status: CityLaunchBuyerTargetStatus;
  workflowFit: string | null;
  proofPath: CityLaunchBuyerProofPath | null;
  ownerAgent: string | null;
  notes: string | null;
  sourceBucket: string | null;
  researchProvenance: CityLaunchResearchProvenance | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type CityLaunchTouchRecord = {
  id: string;
  city: string;
  citySlug: string;
  launchId: string | null;
  referenceType: "prospect" | "buyer_target" | "general";
  referenceId: string | null;
  touchType: CityLaunchTouchType;
  channel: string;
  status: CityLaunchTouchStatus;
  campaignId: string | null;
  issueId: string | null;
  notes: string | null;
  researchProvenance: CityLaunchResearchProvenance | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type CityLaunchBudgetEventRecord = {
  id: string;
  city: string;
  citySlug: string;
  launchId: string | null;
  category: CityLaunchBudgetCategory;
  amountUsd: number;
  note: string | null;
  approvedByRole: string | null;
  withinPolicy: boolean;
  eventType: "actual" | "recommended";
  researchProvenance: CityLaunchResearchProvenance | null;
  createdAtIso: string;
};

export type CityLaunchLedgerSummary = {
  trackedSupplyProspectsContacted: number;
  trackedBuyerTargetsResearched: number;
  trackedFirstTouchesSent: number;
  trackedCityOpeningChannelAccountsReady: number;
  trackedCityOpeningChannelAccountsCreated: number;
  trackedCityOpeningChannelAccountsBlocked: number;
  trackedCityOpeningSendActionsReady: number;
  trackedCityOpeningSendActionsSent: number;
  trackedCityOpeningSendActionsBlocked: number;
  trackedCityOpeningResponsesRecorded: number;
  trackedCityOpeningResponsesRouted: number;
  trackedReplyConversionsQueued: number;
  trackedReplyConversionsRouted: number;
  trackedReplyConversionsBlocked: number;
  onboardedCapturers: number;
  totalRecordedSpendUsd: number;
  withinPolicySpendUsd: number;
  outsidePolicySpendUsd: number;
  recommendedSpendUsd: number;
  wideningGuard: CityLaunchWideningGuard;
  dataSources: string[];
};

export type CityLaunchChannelAccountStatus =
  | "planned"
  | "ready_to_create"
  | "created"
  | "blocked";

export type CityLaunchSendApprovalState =
  | "not_required"
  | "pending_first_send_approval"
  | "approved"
  | "blocked";

export type CityLaunchSendActionStatus =
  | "draft"
  | "ready_to_send"
  | "sent"
  | "blocked";

export type CityLaunchResponseIngestState =
  | "awaiting_response"
  | "response_recorded"
  | "routed"
  | "closed";

export type CityLaunchChannelAccountRecord = {
  id: string;
  city: string;
  citySlug: string;
  launchId: string | null;
  lane:
    | "warehouse-facility-direct"
    | "buyer-linked-site"
    | "professional-capturer"
    | "public-commercial-community";
  channelClass: string;
  accountLabel: string;
  ownerAgent: string | null;
  status: CityLaunchChannelAccountStatus;
  approvalState: CityLaunchSendApprovalState;
  notes: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type CityLaunchSendActionRecord = {
  id: string;
  city: string;
  citySlug: string;
  launchId: string | null;
  lane:
    | "warehouse-facility-direct"
    | "buyer-linked-site"
    | "professional-capturer"
    | "public-commercial-community";
  actionType: "direct_outreach" | "community_post";
  channelAccountId: string | null;
  channelLabel: string;
  targetLabel: string;
  assetKey: string;
  ownerAgent: string | null;
  recipientEmail: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  status: CityLaunchSendActionStatus;
  approvalState: CityLaunchSendApprovalState;
  responseIngestState: CityLaunchResponseIngestState;
  issueId: string | null;
  notes: string | null;
  sentAtIso: string | null;
  firstResponseAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

export type CityLaunchReplyConversionStatus =
  | "queued"
  | "routed"
  | "blocked"
  | "closed";

export type CityLaunchReplyConversionRecord = {
  id: string;
  city: string;
  citySlug: string;
  launchId: string | null;
  sendActionId: string;
  lane:
    | "warehouse-facility-direct"
    | "buyer-linked-site"
    | "professional-capturer"
    | "public-commercial-community";
  responseType:
    | "buyer_reply"
    | "operator_reply"
    | "capturer_reply"
    | "community_reply"
    | "referral";
  responseSummary: string;
  routingTarget:
    | "site_operator_partnership"
    | "buyer_target"
    | "supply_qualification"
    | "blocked"
    | "no_fit";
  nextOwner: string | null;
  nextFollowUpDueAtIso: string | null;
  prospectId: string | null;
  buyerTargetId: string | null;
  status: CityLaunchReplyConversionStatus;
  notes: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

const COLLECTIONS = {
  activations: "cityLaunchActivations",
  prospects: "cityLaunchProspects",
  candidateSignals: "cityLaunchCandidateSignals",
  buyerTargets: "cityLaunchBuyerTargets",
  touches: "cityLaunchTouches",
  budgetEvents: "cityLaunchBudgetEvents",
  channelAccounts: "cityLaunchChannelAccounts",
  sendActions: "cityLaunchSendActions",
  replyConversions: "cityLaunchReplyConversions",
} as const;

const PROSPECT_STATUS_RANK: Record<CityLaunchProspectStatus, number> = {
  inactive: 0,
  identified: 1,
  contacted: 2,
  responded: 3,
  qualified: 4,
  approved: 5,
  onboarded: 6,
  capturing: 7,
};

const BUYER_TARGET_STATUS_RANK: Record<CityLaunchBuyerTargetStatus, number> = {
  identified: 1,
  researched: 2,
  queued: 3,
  contacted: 4,
  engaged: 5,
  hosted_review: 6,
  commercial_handoff: 7,
  closed_won: 8,
  closed_lost: 8,
};

const TOUCH_STATUS_RANK: Record<CityLaunchTouchStatus, number> = {
  failed: 0,
  draft: 1,
  queued: 2,
  sent: 3,
  delivered: 4,
  replied: 5,
};

const CHANNEL_ACCOUNT_STATUS_RANK: Record<CityLaunchChannelAccountStatus, number> = {
  blocked: 0,
  planned: 1,
  ready_to_create: 2,
  created: 3,
};

const SEND_ACTION_STATUS_RANK: Record<CityLaunchSendActionStatus, number> = {
  blocked: 0,
  draft: 1,
  ready_to_send: 2,
  sent: 3,
};

const RESPONSE_INGEST_STATUS_RANK: Record<CityLaunchResponseIngestState, number> = {
  awaiting_response: 1,
  response_recorded: 2,
  routed: 3,
  closed: 4,
};

const REPLY_CONVERSION_STATUS_RANK: Record<CityLaunchReplyConversionStatus, number> = {
  blocked: 0,
  queued: 1,
  routed: 2,
  closed: 3,
};

const candidateSignalMemoryStore = new Map<string, CityLaunchCandidateSignalRecord>();

function shouldUseInMemoryCandidateSignalStore() {
  return !db || process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);
}

function mergeApprovalState(
  existing: CityLaunchSendApprovalState | null | undefined,
  incoming: CityLaunchSendApprovalState | null | undefined,
) {
  if (!incoming) {
    return existing || "pending_first_send_approval";
  }
  if (incoming === "pending_first_send_approval") {
    return existing && existing !== "pending_first_send_approval" ? existing : incoming;
  }
  return incoming;
}

function nowIso() {
  return new Date().toISOString();
}

function serverTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function normalizedCity(city: string) {
  return {
    city: city.trim(),
    citySlug: slugifyCityName(city),
  };
}

function normalizeId(value: string | null | undefined, fallbackPrefix: string) {
  const trimmed = String(value || "").trim();
  return trimmed || `${fallbackPrefix}_${Date.now()}`;
}

function withCity<T extends { city: string }>(record: T) {
  const base = normalizedCity(record.city);
  return {
    ...record,
    ...base,
  };
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function slugifySignalToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildCityLaunchCandidateSignalDedupeKey(input: {
  city: string;
  name: string;
  providerPlaceId?: string | null;
  lat: number;
  lng: number;
}) {
  const citySlug = slugifyCityName(input.city);
  if (input.providerPlaceId) {
    return `${citySlug}:${slugifySignalToken(input.providerPlaceId)}`;
  }
  return `${citySlug}:${slugifySignalToken(input.name)}:${input.lat.toFixed(3)}:${input.lng.toFixed(3)}`;
}

function mergeString(existing: string | null | undefined, incoming: string | null | undefined) {
  const next = String(incoming || "").trim();
  if (next) {
    return next;
  }
  const prior = String(existing || "").trim();
  return prior || null;
}

function mergeBuyerProofPath(
  existing: CityLaunchBuyerProofPath | null | undefined,
  incoming: CityLaunchBuyerProofPath | null | undefined,
) {
  if (isCityLaunchBuyerProofPath(incoming)) {
    return incoming;
  }
  if (isCityLaunchBuyerProofPath(existing)) {
    return existing;
  }
  return null;
}

function mergeNotes(existing: string | null | undefined, incoming: string | null | undefined) {
  const prior = String(existing || "").trim();
  const next = String(incoming || "").trim();
  if (!prior) {
    return next || null;
  }
  if (!next || next === prior) {
    return prior;
  }
  return `${prior}\n\n${next}`;
}

function mergeIsoEarliest(existing: string | null | undefined, incoming: string | null | undefined) {
  if (!existing) {
    return incoming ?? null;
  }
  if (!incoming) {
    return existing;
  }
  return new Date(existing).getTime() <= new Date(incoming).getTime() ? existing : incoming;
}

function mergeIsoLatest(existing: string | null | undefined, incoming: string | null | undefined) {
  if (!existing) {
    return incoming ?? null;
  }
  if (!incoming) {
    return existing;
  }
  return new Date(existing).getTime() >= new Date(incoming).getTime() ? existing : incoming;
}

function mergeRankedStatus<T extends string>(
  existing: T | null | undefined,
  incoming: T,
  ranking: Record<T, number>,
) {
  if (!existing) {
    return incoming;
  }
  return (ranking[existing] ?? 0) >= (ranking[incoming] ?? 0) ? existing : incoming;
}

export async function writeCityLaunchActivation(input: {
  city: string;
  budgetTier: CityLaunchBudgetTier;
  budgetPolicy: CityLaunchBudgetPolicy;
  founderApproved: boolean;
  status: CityLaunchActivationStatus;
  rootIssueId: string | null;
  taskIssueIds: Record<string, string>;
  wideningGuard: CityLaunchWideningGuard;
}) {
  if (!db) {
    return null;
  }

  const base = normalizedCity(input.city);
  const timestamp = nowIso();
  const payload: CityLaunchActivationRecord = {
    ...base,
    budgetTier: input.budgetTier,
    budgetPolicy: input.budgetPolicy,
    founderApproved: input.founderApproved,
    status: input.status,
    rootIssueId: input.rootIssueId,
    taskIssueIds: input.taskIssueIds,
    machineReadablePolicyVersion: CITY_LAUNCH_MACHINE_POLICY_VERSION,
    wideningGuard: input.wideningGuard,
    createdAtIso: timestamp,
    updatedAtIso: timestamp,
  };

  await db.collection(COLLECTIONS.activations).doc(base.citySlug).set(
    {
      ...payload,
      updated_at: serverTimestamp(),
      created_at: serverTimestamp(),
    },
    { merge: true },
  );
  return payload;
}

export async function readCityLaunchActivation(city: string) {
  if (!db) {
    return null;
  }
  const { citySlug } = normalizedCity(city);
  const doc = await db.collection(COLLECTIONS.activations).doc(citySlug).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as CityLaunchActivationRecord;
}

export async function listCityLaunchActivations() {
  if (!db) {
    return [] as CityLaunchActivationRecord[];
  }
  const snapshot = await db.collection(COLLECTIONS.activations).limit(100).get();
  return snapshot.docs.map((doc) => doc.data() as CityLaunchActivationRecord);
}

export type CityLaunchCandidateSignalSourceContext =
  | "signup_scan"
  | "app_open_scan"
  | "manual_refresh"
  | "agent_public_candidate_research";

export type CityLaunchIndoorPosture =
  | "indoor_only"
  | "indoor_primary"
  | "mixed_indoor_outdoor"
  | "outdoor_primary"
  | "unknown";

export type CityLaunchLocationVerificationStatus =
  | "verified"
  | "partially_verified"
  | "weak"
  | "rejected";

export type CityLaunchCaptureComplexity =
  | "simple"
  | "standard"
  | "complex"
  | "high_complexity";

export type CityLaunchCandidateSignalRecord = {
  id: string;
  dedupeKey: string;
  creatorId: string;
  city: string;
  citySlug: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  provider: string;
  providerPlaceId: string | null;
  types: string[];
  sourceContext: CityLaunchCandidateSignalSourceContext;
  status: "queued" | "in_review" | "promoted" | "rejected";
  reviewState: string;
  sourceUrls?: string[];
  sourceEvidenceSummary?: string | null;
  sourceQueries?: string[];
  sourceBuckets?: string[];
  candidateType?: string | null;
  indoorPosture?: CityLaunchIndoorPosture | null;
  publicAccessPosture?: string | null;
  allowedCaptureZones?: string[];
  avoidZones?: string[];
  cameraPolicyEvidence?: string | null;
  confidence?: string | null;
  verificationStatus?: CityLaunchLocationVerificationStatus | null;
  rejectionReason?: string | null;
  estimatedPublicAreaSqft?: number | null;
  estimatedCaptureMinutes?: number | null;
  estimatedCaptureComplexity?: CityLaunchCaptureComplexity | null;
  demandScore?: number | null;
  suggestedPayoutCents?: number | null;
  payoutBasis?: string | null;
  lastVerifiedAt?: string | null;
  reviewedByAgent?: string | null;
  seedStatus?: string | null;
  seedNotes?: string | null;
  reviewedAtIso?: string | null;
  reviewedBy?: string | null;
  reviewDecision?: "keep_in_review" | "promote" | "reject" | null;
  reviewReasons?: string[];
  promotedProspectId?: string | null;
  coverageRunId?: string | null;
  coverageTileId?: string | null;
  coverageCategory?: string | null;
  sourceBucket?: string | null;
  sourceQuality?: string | null;
  discoveryQuery?: string | null;
  duplicateOfCandidateId?: string | null;
  excludedByCoveragePolicyReason?: string | null;
  seenCount: number;
  submittedAtIso: string;
  lastSeenAtIso: string;
};

function mergeCandidateSignal(
  existing: CityLaunchCandidateSignalRecord | null,
  incoming: Omit<CityLaunchCandidateSignalRecord, "id" | "seenCount" | "submittedAtIso" | "lastSeenAtIso">,
) {
  const timestamp = nowIso();
  const mergeArray = (next: string[] | undefined, prior: string[] | undefined) =>
    Array.isArray(next) && next.length ? next : prior || [];
  const mergeNumber = (next: number | null | undefined, prior: number | null | undefined) =>
    typeof next === "number" && Number.isFinite(next) ? next : prior ?? null;
  const mergeNullable = <T>(next: T | null | undefined, prior: T | null | undefined) =>
    next !== undefined ? next : prior ?? null;
  return {
    id: existing?.id || `candidate-${slugifySignalToken(incoming.dedupeKey.replace(/:/g, "-"))}`,
    dedupeKey: incoming.dedupeKey,
    creatorId: incoming.creatorId,
    city: incoming.city,
    citySlug: incoming.citySlug,
    name: incoming.name,
    address: incoming.address,
    lat: incoming.lat,
    lng: incoming.lng,
    provider: incoming.provider,
    providerPlaceId: incoming.providerPlaceId,
    types: incoming.types,
    sourceContext: incoming.sourceContext,
    status: existing?.status && existing.status !== "rejected" ? existing.status : incoming.status,
    reviewState: existing?.reviewState || incoming.reviewState,
    sourceUrls: mergeArray(incoming.sourceUrls, existing?.sourceUrls),
    sourceEvidenceSummary: mergeNullable(incoming.sourceEvidenceSummary, existing?.sourceEvidenceSummary),
    sourceQueries: mergeArray(incoming.sourceQueries, existing?.sourceQueries),
    sourceBuckets: mergeArray(incoming.sourceBuckets, existing?.sourceBuckets),
    candidateType: mergeNullable(incoming.candidateType, existing?.candidateType),
    indoorPosture: mergeNullable(incoming.indoorPosture, existing?.indoorPosture),
    publicAccessPosture: mergeNullable(incoming.publicAccessPosture, existing?.publicAccessPosture),
    allowedCaptureZones: mergeArray(incoming.allowedCaptureZones, existing?.allowedCaptureZones),
    avoidZones: mergeArray(incoming.avoidZones, existing?.avoidZones),
    cameraPolicyEvidence: mergeNullable(incoming.cameraPolicyEvidence, existing?.cameraPolicyEvidence),
    confidence: mergeNullable(incoming.confidence, existing?.confidence),
    verificationStatus: mergeNullable(incoming.verificationStatus, existing?.verificationStatus),
    rejectionReason: mergeNullable(incoming.rejectionReason, existing?.rejectionReason),
    estimatedPublicAreaSqft: mergeNumber(incoming.estimatedPublicAreaSqft, existing?.estimatedPublicAreaSqft),
    estimatedCaptureMinutes: mergeNumber(incoming.estimatedCaptureMinutes, existing?.estimatedCaptureMinutes),
    estimatedCaptureComplexity: mergeNullable(
      incoming.estimatedCaptureComplexity,
      existing?.estimatedCaptureComplexity,
    ),
    demandScore: mergeNumber(incoming.demandScore, existing?.demandScore),
    suggestedPayoutCents: mergeNumber(incoming.suggestedPayoutCents, existing?.suggestedPayoutCents),
    payoutBasis: mergeNullable(incoming.payoutBasis, existing?.payoutBasis),
    lastVerifiedAt: mergeNullable(incoming.lastVerifiedAt, existing?.lastVerifiedAt),
    reviewedByAgent: mergeNullable(incoming.reviewedByAgent, existing?.reviewedByAgent),
    seedStatus: mergeNullable(incoming.seedStatus, existing?.seedStatus),
    seedNotes: mergeNullable(incoming.seedNotes, existing?.seedNotes),
    reviewedAtIso: existing?.reviewedAtIso || null,
    reviewedBy: existing?.reviewedBy || null,
    reviewDecision: existing?.reviewDecision || null,
    reviewReasons: existing?.reviewReasons || [],
    promotedProspectId: existing?.promotedProspectId || null,
    coverageRunId: mergeNullable(incoming.coverageRunId, existing?.coverageRunId),
    coverageTileId: mergeNullable(incoming.coverageTileId, existing?.coverageTileId),
    coverageCategory: mergeNullable(incoming.coverageCategory, existing?.coverageCategory),
    sourceBucket: mergeNullable(incoming.sourceBucket, existing?.sourceBucket),
    sourceQuality: mergeNullable(incoming.sourceQuality, existing?.sourceQuality),
    discoveryQuery: mergeNullable(incoming.discoveryQuery, existing?.discoveryQuery),
    duplicateOfCandidateId: mergeNullable(incoming.duplicateOfCandidateId, existing?.duplicateOfCandidateId),
    excludedByCoveragePolicyReason: mergeNullable(
      incoming.excludedByCoveragePolicyReason,
      existing?.excludedByCoveragePolicyReason,
    ),
    seenCount: (existing?.seenCount || 0) + 1,
    submittedAtIso: existing?.submittedAtIso || timestamp,
    lastSeenAtIso: timestamp,
  } satisfies CityLaunchCandidateSignalRecord;
}

export async function upsertCityLaunchCandidateSignal(
  input: Omit<CityLaunchCandidateSignalRecord, "id" | "seenCount" | "submittedAtIso" | "lastSeenAtIso">,
) {
  const record = mergeCandidateSignal(
    shouldUseInMemoryCandidateSignalStore() ? candidateSignalMemoryStore.get(input.dedupeKey) || null : null,
    input,
  );

  if (shouldUseInMemoryCandidateSignalStore()) {
    candidateSignalMemoryStore.set(record.dedupeKey, record);
    return record;
  }
  if (!db) {
    throw new Error("Database not available");
  }

  const ref = db.collection(COLLECTIONS.candidateSignals).doc(record.id);
  const existingDoc = await ref.get();
  const existing = existingDoc.exists
    ? (existingDoc.data() as CityLaunchCandidateSignalRecord)
    : null;
  const merged = mergeCandidateSignal(existing, input);
  await ref.set(
    {
      ...merged,
      updated_at: serverTimestamp(),
      ...(!existing ? { created_at: serverTimestamp() } : {}),
    },
    { merge: true },
  );
  return merged;
}

export async function intakeCityLaunchCandidateSignals(
  inputs: Array<{
    creatorId: string;
    city: string;
    name: string;
    address?: string | null;
    lat: number;
    lng: number;
    provider: string;
    providerPlaceId?: string | null;
    types?: string[];
    sourceContext: CityLaunchCandidateSignalSourceContext;
    sourceUrls?: string[];
    sourceEvidenceSummary?: string | null;
    sourceQueries?: string[];
    sourceBuckets?: string[];
    candidateType?: string | null;
    indoorPosture?: CityLaunchIndoorPosture | null;
    publicAccessPosture?: string | null;
    allowedCaptureZones?: string[];
    avoidZones?: string[];
    cameraPolicyEvidence?: string | null;
    confidence?: string | null;
    verificationStatus?: CityLaunchLocationVerificationStatus | null;
    rejectionReason?: string | null;
    estimatedPublicAreaSqft?: number | null;
    estimatedCaptureMinutes?: number | null;
    estimatedCaptureComplexity?: CityLaunchCaptureComplexity | null;
    demandScore?: number | null;
    suggestedPayoutCents?: number | null;
    payoutBasis?: string | null;
    lastVerifiedAt?: string | null;
    reviewedByAgent?: string | null;
    seedStatus?: string | null;
    seedNotes?: string | null;
    coverageRunId?: string | null;
    coverageTileId?: string | null;
    coverageCategory?: string | null;
    sourceBucket?: string | null;
    sourceQuality?: string | null;
    discoveryQuery?: string | null;
    duplicateOfCandidateId?: string | null;
    excludedByCoveragePolicyReason?: string | null;
  }>,
) {
  return Promise.all(
    inputs.map((input) => {
      const city = input.city.trim();
      const dedupeKey = buildCityLaunchCandidateSignalDedupeKey({
        city,
        name: input.name,
        providerPlaceId: input.providerPlaceId,
        lat: input.lat,
        lng: input.lng,
      });
      return upsertCityLaunchCandidateSignal({
        dedupeKey,
        creatorId: input.creatorId,
        city,
        citySlug: slugifyCityName(city),
        name: input.name.trim(),
        address: input.address?.trim() || null,
        lat: input.lat,
        lng: input.lng,
        provider: input.provider.trim(),
        providerPlaceId: input.providerPlaceId?.trim() || null,
        types: input.types || [],
        sourceContext: input.sourceContext,
        status: "queued",
        reviewState: "awaiting_city_review",
        sourceUrls: input.sourceUrls || [],
        sourceEvidenceSummary: input.sourceEvidenceSummary || null,
        sourceQueries: input.sourceQueries || [],
        sourceBuckets: input.sourceBuckets || [],
        candidateType: input.candidateType || null,
        indoorPosture: input.indoorPosture || null,
        publicAccessPosture: input.publicAccessPosture || null,
        allowedCaptureZones: input.allowedCaptureZones || [],
        avoidZones: input.avoidZones || [],
        cameraPolicyEvidence: input.cameraPolicyEvidence || null,
        confidence: input.confidence || null,
        verificationStatus: input.verificationStatus || null,
        rejectionReason: input.rejectionReason || null,
        estimatedPublicAreaSqft: input.estimatedPublicAreaSqft ?? null,
        estimatedCaptureMinutes: input.estimatedCaptureMinutes ?? null,
        estimatedCaptureComplexity: input.estimatedCaptureComplexity || null,
        demandScore: input.demandScore ?? null,
        suggestedPayoutCents: input.suggestedPayoutCents ?? null,
        payoutBasis: input.payoutBasis || null,
        lastVerifiedAt: input.lastVerifiedAt || null,
        reviewedByAgent: input.reviewedByAgent || null,
        seedStatus: input.seedStatus || null,
        seedNotes: input.seedNotes || null,
        coverageRunId: input.coverageRunId || null,
        coverageTileId: input.coverageTileId || null,
        coverageCategory: input.coverageCategory || null,
        sourceBucket: input.sourceBucket || null,
        sourceQuality: input.sourceQuality || null,
        discoveryQuery: input.discoveryQuery || null,
        duplicateOfCandidateId: input.duplicateOfCandidateId || null,
        excludedByCoveragePolicyReason: input.excludedByCoveragePolicyReason || null,
      });
    }),
  );
}

export async function listCityLaunchCandidateSignals(options?: {
  city?: string;
  statuses?: Array<CityLaunchCandidateSignalRecord["status"]>;
  candidateIds?: string[];
  limit?: number;
}) {
  const filterStatuses = options?.statuses?.length ? new Set(options.statuses) : null;
  const filterCitySlug = options?.city ? normalizedCity(options.city).citySlug : null;
  const requestedCandidateIds = Array.from(
    new Set((options?.candidateIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ).slice(0, 100);
  const limit = Math.max(1, Math.min(Math.trunc(options?.limit ?? 250), 1000));
  const recordMatchesFilters = (record: CityLaunchCandidateSignalRecord) => {
    if (filterCitySlug && record.citySlug !== filterCitySlug) return false;
    if (filterStatuses && !filterStatuses.has(record.status)) return false;
    return true;
  };

  if (shouldUseInMemoryCandidateSignalStore()) {
    const records = requestedCandidateIds.length
      ? requestedCandidateIds
        .map((id) =>
          candidateSignalMemoryStore.get(id)
          ?? Array.from(candidateSignalMemoryStore.values()).find((record) => record.id === id)
          ?? null,
        )
        .filter((record): record is CityLaunchCandidateSignalRecord => Boolean(record))
      : Array.from(candidateSignalMemoryStore.values());
    return records.filter(recordMatchesFilters).slice(0, limit);
  }
  if (!db) {
    throw new Error("Database not available");
  }
  const database = db;

  if (requestedCandidateIds.length) {
    const docs = await Promise.all(
      requestedCandidateIds.map((id) => database.collection(COLLECTIONS.candidateSignals).doc(id).get()),
    );
    return docs
      .filter((doc) => doc.exists)
      .map((doc) => doc.data() as CityLaunchCandidateSignalRecord)
      .filter(recordMatchesFilters)
      .slice(0, limit);
  }

  let query: FirebaseFirestore.Query = database.collection(COLLECTIONS.candidateSignals);
  if (filterCitySlug) {
    query = query.where("citySlug", "==", filterCitySlug);
  } else if (filterStatuses && filterStatuses.size > 0 && filterStatuses.size <= 10) {
    query = query.where("status", "in", Array.from(filterStatuses));
  }
  const snapshot = await query.limit(limit).get();
  let records = snapshot.docs.map((doc) => doc.data() as CityLaunchCandidateSignalRecord);
  records = records.filter(recordMatchesFilters);
  return records.slice(0, limit);
}

export async function updateCityLaunchCandidateSignalReview(
  id: string,
  update: Pick<CityLaunchCandidateSignalRecord, "status" | "reviewState">
    & Partial<Pick<
      CityLaunchCandidateSignalRecord,
      "reviewedAtIso" | "reviewedBy" | "reviewDecision" | "reviewReasons" | "promotedProspectId"
    >>,
) {
  const timestamp = nowIso();
  const payload = {
    ...update,
    reviewedAtIso: update.reviewedAtIso || timestamp,
  };

  if (shouldUseInMemoryCandidateSignalStore()) {
    for (const [key, record] of candidateSignalMemoryStore.entries()) {
      if (record.id !== id) {
        continue;
      }
      const merged = { ...record, ...payload, lastSeenAtIso: timestamp };
      candidateSignalMemoryStore.set(key, merged);
      return merged;
    }
    throw new Error(`Candidate signal not found: ${id}`);
  }

  if (!db) {
    throw new Error("Database not available");
  }

  const ref = db.collection(COLLECTIONS.candidateSignals).doc(id);
  const existingDoc = await ref.get();
  if (!existingDoc.exists) {
    throw new Error(`Candidate signal not found: ${id}`);
  }
  const existing = existingDoc.data() as CityLaunchCandidateSignalRecord;
  const merged = { ...existing, ...payload, lastSeenAtIso: timestamp };
  await ref.set(
    {
      ...payload,
      lastSeenAtIso: timestamp,
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
  return merged;
}

export function __resetCityLaunchCandidateSignalMemoryForTests() {
  candidateSignalMemoryStore.clear();
}

export async function upsertCityLaunchProspect(
  input: Omit<CityLaunchProspectRecord, "id" | "citySlug" | "createdAtIso" | "updatedAtIso"> & {
    id?: string | null;
  },
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const record = withCity(input);
  const id = normalizeId(input.id, `prospect_${record.citySlug}`);
  const ref = db.collection(COLLECTIONS.prospects).doc(id);
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? (existingDoc.data() as Partial<CityLaunchProspectRecord>) : null;
  const createdAtIso = existing?.createdAtIso || nowIso();
  const updatedAtIso = nowIso();
  const payload: CityLaunchProspectRecord = {
    id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: mergeString(existing?.launchId, input.launchId ?? null),
    sourceBucket: input.sourceBucket,
    channel: input.channel,
    name: input.name,
    email: mergeString(existing?.email, input.email ?? null),
    status: mergeRankedStatus(existing?.status, input.status, PROSPECT_STATUS_RANK),
    ownerAgent: mergeString(existing?.ownerAgent, input.ownerAgent ?? null),
    notes: mergeNotes(existing?.notes, input.notes ?? null),
    firstContactedAt: mergeIsoEarliest(existing?.firstContactedAt, input.firstContactedAt ?? null),
    lastContactedAt: mergeIsoLatest(existing?.lastContactedAt, input.lastContactedAt ?? null),
    siteAddress: mergeString(existing?.siteAddress, input.siteAddress ?? null),
    locationSummary: mergeString(existing?.locationSummary, input.locationSummary ?? null),
    lat: asNumber(input.lat) ?? asNumber(existing?.lat) ?? null,
    lng: asNumber(input.lng) ?? asNumber(existing?.lng) ?? null,
    siteCategory: mergeString(existing?.siteCategory, input.siteCategory ?? null),
    workflowFit: mergeString(existing?.workflowFit, input.workflowFit ?? null),
    priorityNote: mergeNotes(existing?.priorityNote, input.priorityNote ?? null),
    researchProvenance: input.researchProvenance ?? existing?.researchProvenance ?? null,
    coverageRunId: mergeString(existing?.coverageRunId, input.coverageRunId ?? null),
    coverageTileId: mergeString(existing?.coverageTileId, input.coverageTileId ?? null),
    coverageCategory: mergeString(existing?.coverageCategory, input.coverageCategory ?? null),
    claimState: input.claimState ?? existing?.claimState ?? "available",
    lastShownAtIso: mergeIsoLatest(existing?.lastShownAtIso, input.lastShownAtIso ?? null),
    lastClaimedAtIso: mergeIsoLatest(existing?.lastClaimedAtIso, input.lastClaimedAtIso ?? null),
    lastCapturedAtIso: mergeIsoLatest(existing?.lastCapturedAtIso, input.lastCapturedAtIso ?? null),
    createdAtIso,
    updatedAtIso,
  };
  await ref.set(
    {
      ...payload,
      updated_at: serverTimestamp(),
      ...(!existing ? { created_at: serverTimestamp() } : {}),
    },
    { merge: true },
  );
  return payload;
}

export async function updateCityLaunchProspectLifecycle(
  id: string,
  update: {
    status?: CityLaunchProspectStatus;
    notes?: string | null;
    priorityNote?: string | null;
  },
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const ref = db.collection(COLLECTIONS.prospects).doc(id);
  const existingDoc = await ref.get();
  if (!existingDoc.exists) {
    throw new Error(`City launch prospect not found: ${id}`);
  }
  const existing = existingDoc.data() as CityLaunchProspectRecord;
  const updatedAtIso = nowIso();
  const payload: Partial<CityLaunchProspectRecord> = {
    status: update.status || existing.status,
    notes: mergeNotes(existing.notes, update.notes ?? null),
    priorityNote: mergeNotes(existing.priorityNote, update.priorityNote ?? null),
    updatedAtIso,
  };
  await ref.set(
    {
      ...payload,
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );
  return {
    ...existing,
    ...payload,
  } as CityLaunchProspectRecord;
}

export async function upsertCityLaunchBuyerTarget(
  input: Omit<CityLaunchBuyerTargetRecord, "id" | "citySlug" | "createdAtIso" | "updatedAtIso" | "contactEmail"> & {
    id?: string | null;
    contactEmail?: string | null;
  },
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const record = withCity(input);
  const id = normalizeId(input.id, `buyer_target_${record.citySlug}`);
  const ref = db.collection(COLLECTIONS.buyerTargets).doc(id);
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? (existingDoc.data() as Partial<CityLaunchBuyerTargetRecord>) : null;
  const createdAtIso = existing?.createdAtIso || nowIso();
  const updatedAtIso = nowIso();
  const payload: CityLaunchBuyerTargetRecord = {
    id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: mergeString(existing?.launchId, input.launchId ?? null),
    companyName: input.companyName,
    contactName: mergeString(existing?.contactName, input.contactName ?? null),
    contactEmail: mergeString(existing?.contactEmail, input.contactEmail ?? null),
    status: mergeRankedStatus(existing?.status, input.status, BUYER_TARGET_STATUS_RANK),
    workflowFit: mergeString(existing?.workflowFit, input.workflowFit ?? null),
    proofPath: mergeBuyerProofPath(existing?.proofPath, input.proofPath ?? null),
    ownerAgent: mergeString(existing?.ownerAgent, input.ownerAgent ?? null),
    notes: mergeNotes(existing?.notes, input.notes ?? null),
    sourceBucket: mergeString(existing?.sourceBucket, input.sourceBucket ?? null),
    researchProvenance: input.researchProvenance ?? existing?.researchProvenance ?? null,
    createdAtIso,
    updatedAtIso,
  };
  await ref.set(
    {
      ...payload,
      updated_at: serverTimestamp(),
      ...(!existing ? { created_at: serverTimestamp() } : {}),
    },
    { merge: true },
  );
  return payload;
}

export async function recordCityLaunchTouch(
  input: Omit<CityLaunchTouchRecord, "citySlug" | "createdAtIso" | "updatedAtIso" | "id"> & {
    id?: string | null;
  },
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const record = withCity(input);
  const ref = input.id
    ? db.collection(COLLECTIONS.touches).doc(normalizeId(input.id, `touch_${record.citySlug}`))
    : db.collection(COLLECTIONS.touches).doc();
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? (existingDoc.data() as Partial<CityLaunchTouchRecord>) : null;
  const createdAtIso = existing?.createdAtIso || nowIso();
  const updatedAtIso = nowIso();
  const payload: CityLaunchTouchRecord = {
    id: ref.id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: mergeString(existing?.launchId, input.launchId ?? null),
    referenceType: input.referenceType,
    referenceId: mergeString(existing?.referenceId, input.referenceId ?? null),
    touchType: input.touchType,
    channel: input.channel,
    status: mergeRankedStatus(existing?.status, input.status, TOUCH_STATUS_RANK),
    campaignId: mergeString(existing?.campaignId, input.campaignId ?? null),
    issueId: mergeString(existing?.issueId, input.issueId ?? null),
    notes: mergeNotes(existing?.notes, input.notes ?? null),
    researchProvenance: input.researchProvenance ?? existing?.researchProvenance ?? null,
    createdAtIso,
    updatedAtIso,
  };
  await ref.set(
    {
      ...payload,
      updated_at: serverTimestamp(),
      ...(!existing ? { created_at: serverTimestamp() } : {}),
    },
    { merge: true },
  );
  return payload;
}

export async function recordCityLaunchBudgetEvent(
  input: Omit<CityLaunchBudgetEventRecord, "citySlug" | "createdAtIso" | "id"> & {
    id?: string | null;
  },
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const record = withCity(input);
  const ref = input.id
    ? db.collection(COLLECTIONS.budgetEvents).doc(normalizeId(input.id, `budget_${record.citySlug}`))
    : db.collection(COLLECTIONS.budgetEvents).doc();
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? (existingDoc.data() as Partial<CityLaunchBudgetEventRecord>) : null;
  const payload: CityLaunchBudgetEventRecord = {
    id: ref.id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: mergeString(existing?.launchId, input.launchId ?? null),
    category: input.category,
    amountUsd: input.amountUsd,
    note: mergeNotes(existing?.note, input.note ?? null),
    approvedByRole: mergeString(existing?.approvedByRole, input.approvedByRole ?? null),
    withinPolicy: input.withinPolicy,
    eventType: input.eventType || existing?.eventType || "actual",
    researchProvenance: input.researchProvenance ?? existing?.researchProvenance ?? null,
    createdAtIso: existing?.createdAtIso || nowIso(),
  };
  await ref.set(
    {
      ...payload,
      ...(!existing ? { created_at: serverTimestamp() } : {}),
    },
    { merge: true },
  );
  return payload;
}

export async function upsertCityLaunchChannelAccount(
  input: Omit<CityLaunchChannelAccountRecord, "id" | "citySlug" | "createdAtIso" | "updatedAtIso"> & {
    id?: string | null;
  },
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const record = withCity(input);
  const id = normalizeId(input.id, `channel_account_${record.citySlug}`);
  const ref = db.collection(COLLECTIONS.channelAccounts).doc(id);
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? (existingDoc.data() as Partial<CityLaunchChannelAccountRecord>) : null;
  const createdAtIso = existing?.createdAtIso || nowIso();
  const updatedAtIso = nowIso();
  const payload: CityLaunchChannelAccountRecord = {
    id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: mergeString(existing?.launchId, input.launchId ?? null),
    lane: input.lane,
    channelClass: input.channelClass,
    accountLabel: input.accountLabel,
    ownerAgent: mergeString(existing?.ownerAgent, input.ownerAgent ?? null),
    status: mergeRankedStatus(existing?.status, input.status, CHANNEL_ACCOUNT_STATUS_RANK),
    approvalState: mergeApprovalState(existing?.approvalState, input.approvalState),
    notes: mergeNotes(existing?.notes, input.notes ?? null),
    createdAtIso,
    updatedAtIso,
  };
  await ref.set(
    {
      ...payload,
      updated_at: serverTimestamp(),
      ...(!existing ? { created_at: serverTimestamp() } : {}),
    },
    { merge: true },
  );
  return payload;
}

export async function upsertCityLaunchSendAction(
  input: Omit<CityLaunchSendActionRecord, "id" | "citySlug" | "createdAtIso" | "updatedAtIso"> & {
    id?: string | null;
  },
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const record = withCity(input);
  const id = normalizeId(input.id, `send_action_${record.citySlug}`);
  const ref = db.collection(COLLECTIONS.sendActions).doc(id);
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? (existingDoc.data() as Partial<CityLaunchSendActionRecord>) : null;
  const createdAtIso = existing?.createdAtIso || nowIso();
  const updatedAtIso = nowIso();
  const payload: CityLaunchSendActionRecord = {
    id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: mergeString(existing?.launchId, input.launchId ?? null),
    lane: input.lane,
    actionType: input.actionType,
    channelAccountId: mergeString(existing?.channelAccountId, input.channelAccountId ?? null),
    channelLabel: input.channelLabel,
    targetLabel: input.targetLabel,
    assetKey: input.assetKey,
    ownerAgent: mergeString(existing?.ownerAgent, input.ownerAgent ?? null),
    recipientEmail: mergeString(existing?.recipientEmail, input.recipientEmail ?? null),
    emailSubject: mergeString(existing?.emailSubject, input.emailSubject ?? null),
    emailBody: mergeString(existing?.emailBody, input.emailBody ?? null),
    status: mergeRankedStatus(existing?.status, input.status, SEND_ACTION_STATUS_RANK),
    approvalState: mergeApprovalState(existing?.approvalState, input.approvalState),
    responseIngestState: mergeRankedStatus(
      existing?.responseIngestState,
      input.responseIngestState,
      RESPONSE_INGEST_STATUS_RANK,
    ),
    issueId: mergeString(existing?.issueId, input.issueId ?? null),
    notes: mergeNotes(existing?.notes, input.notes ?? null),
    sentAtIso: mergeIsoLatest(existing?.sentAtIso, input.sentAtIso ?? null),
    firstResponseAtIso: mergeIsoLatest(existing?.firstResponseAtIso, input.firstResponseAtIso ?? null),
    createdAtIso,
    updatedAtIso,
  };
  await ref.set(
    {
      ...payload,
      updated_at: serverTimestamp(),
      ...(!existing ? { created_at: serverTimestamp() } : {}),
    },
    { merge: true },
  );
  return payload;
}

export async function upsertCityLaunchReplyConversion(
  input: Omit<CityLaunchReplyConversionRecord, "id" | "citySlug" | "createdAtIso" | "updatedAtIso"> & {
    id?: string | null;
  },
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const record = withCity(input);
  const id = normalizeId(input.id, `reply_conversion_${record.citySlug}`);
  const ref = db.collection(COLLECTIONS.replyConversions).doc(id);
  const existingDoc = await ref.get();
  const existing = existingDoc.exists ? (existingDoc.data() as Partial<CityLaunchReplyConversionRecord>) : null;
  const createdAtIso = existing?.createdAtIso || nowIso();
  const updatedAtIso = nowIso();
  const payload: CityLaunchReplyConversionRecord = {
    id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: mergeString(existing?.launchId, input.launchId ?? null),
    sendActionId: input.sendActionId,
    lane: input.lane,
    responseType: input.responseType,
    responseSummary: input.responseSummary,
    routingTarget: input.routingTarget,
    nextOwner: mergeString(existing?.nextOwner, input.nextOwner ?? null),
    nextFollowUpDueAtIso: mergeIsoLatest(existing?.nextFollowUpDueAtIso, input.nextFollowUpDueAtIso ?? null),
    prospectId: mergeString(existing?.prospectId, input.prospectId ?? null),
    buyerTargetId: mergeString(existing?.buyerTargetId, input.buyerTargetId ?? null),
    status: mergeRankedStatus(existing?.status, input.status, REPLY_CONVERSION_STATUS_RANK),
    notes: mergeNotes(existing?.notes, input.notes ?? null),
    createdAtIso,
    updatedAtIso,
  };
  await ref.set(
    {
      ...payload,
      updated_at: serverTimestamp(),
      ...(!existing ? { created_at: serverTimestamp() } : {}),
    },
    { merge: true },
  );
  return payload;
}

async function listByCity<T>(collectionName: string, citySlug: string) {
  if (!db) {
    return [] as T[];
  }
  const snapshot = await db
    .collection(collectionName)
    .where("citySlug", "==", citySlug)
    .limit(1000)
    .get();
  return snapshot.docs.map((doc) => doc.data() as T);
}

export async function listCityLaunchProspects(
  city: string,
  options?: { statuses?: CityLaunchProspectStatus[] },
) {
  const { citySlug } = normalizedCity(city);
  const prospects = await listByCity<CityLaunchProspectRecord>(COLLECTIONS.prospects, citySlug);
  if (!options?.statuses?.length) {
    return prospects;
  }
  const allowed = new Set(options.statuses);
  return prospects.filter((record) => allowed.has(record.status));
}

export async function listCityLaunchBuyerTargets(
  city: string,
  options?: { statuses?: CityLaunchBuyerTargetStatus[] },
) {
  const { citySlug } = normalizedCity(city);
  const buyerTargets = await listByCity<CityLaunchBuyerTargetRecord>(COLLECTIONS.buyerTargets, citySlug);
  if (!options?.statuses?.length) {
    return buyerTargets;
  }
  const allowed = new Set(options.statuses);
  return buyerTargets.filter((record) => allowed.has(record.status));
}

export async function listCityLaunchTouches(city: string) {
  const { citySlug } = normalizedCity(city);
  return listByCity<CityLaunchTouchRecord>(COLLECTIONS.touches, citySlug);
}

export async function listCityLaunchBudgetEvents(city: string) {
  const { citySlug } = normalizedCity(city);
  return listByCity<CityLaunchBudgetEventRecord>(COLLECTIONS.budgetEvents, citySlug);
}

export async function listCityLaunchChannelAccounts(city: string) {
  const { citySlug } = normalizedCity(city);
  return listByCity<CityLaunchChannelAccountRecord>(COLLECTIONS.channelAccounts, citySlug);
}

export async function listCityLaunchSendActions(city: string) {
  const { citySlug } = normalizedCity(city);
  return listByCity<CityLaunchSendActionRecord>(COLLECTIONS.sendActions, citySlug);
}

export async function listCityLaunchReplyConversions(city: string) {
  const { citySlug } = normalizedCity(city);
  return listByCity<CityLaunchReplyConversionRecord>(COLLECTIONS.replyConversions, citySlug);
}

export async function readCityLaunchChannelAccount(id: string) {
  if (!db) return null;
  const doc = await db.collection(COLLECTIONS.channelAccounts).doc(id).get();
  return doc.exists ? (doc.data() as CityLaunchChannelAccountRecord) : null;
}

export async function readCityLaunchSendAction(id: string) {
  if (!db) return null;
  const doc = await db.collection(COLLECTIONS.sendActions).doc(id).get();
  return doc.exists ? (doc.data() as CityLaunchSendActionRecord) : null;
}

export async function summarizeCityLaunchLedgers(city: string) {
  const { citySlug } = normalizedCity(city);

  const [prospects, buyerTargets, touches, budgetEvents, channelAccounts, sendActions, replyConversions] = await Promise.all([
    listByCity<CityLaunchProspectRecord>(COLLECTIONS.prospects, citySlug),
    listByCity<CityLaunchBuyerTargetRecord>(COLLECTIONS.buyerTargets, citySlug),
    listByCity<CityLaunchTouchRecord>(COLLECTIONS.touches, citySlug),
    listByCity<CityLaunchBudgetEventRecord>(COLLECTIONS.budgetEvents, citySlug),
    listByCity<CityLaunchChannelAccountRecord>(COLLECTIONS.channelAccounts, citySlug),
    listByCity<CityLaunchSendActionRecord>(COLLECTIONS.sendActions, citySlug),
    listByCity<CityLaunchReplyConversionRecord>(COLLECTIONS.replyConversions, citySlug),
  ]);

  const trackedSupplyProspectsContacted = prospects.filter((entry) =>
    ["contacted", "responded", "qualified", "approved", "onboarded", "capturing"].includes(
      entry.status,
    ),
  ).length;
  const onboardedCapturers = prospects.filter((entry) =>
    ["onboarded", "capturing"].includes(entry.status),
  ).length;
  const trackedBuyerTargetsResearched = buyerTargets.filter((entry) =>
    [
      "researched",
      "queued",
      "contacted",
      "engaged",
      "hosted_review",
      "commercial_handoff",
      "closed_won",
      "closed_lost",
    ].includes(entry.status),
  ).length;
  const trackedFirstTouchesSent = touches.filter(
    (entry) =>
      entry.touchType === "first_touch"
      && ["sent", "delivered", "replied"].includes(entry.status),
  ).length;
  const trackedCityOpeningChannelAccountsReady = channelAccounts.filter((entry) =>
    ["ready_to_create", "created"].includes(entry.status),
  ).length;
  const trackedCityOpeningChannelAccountsCreated = channelAccounts.filter((entry) =>
    entry.status === "created",
  ).length;
  const trackedCityOpeningChannelAccountsBlocked = channelAccounts.filter((entry) =>
    entry.status === "blocked",
  ).length;
  const trackedCityOpeningSendActionsReady = sendActions.filter((entry) =>
    ["ready_to_send", "sent"].includes(entry.status),
  ).length;
  const trackedCityOpeningSendActionsSent = sendActions.filter((entry) =>
    entry.status === "sent",
  ).length;
  const trackedCityOpeningSendActionsBlocked = sendActions.filter((entry) =>
    entry.status === "blocked",
  ).length;
  const trackedCityOpeningResponsesRecorded = Math.max(
    sendActions.filter((entry) =>
      ["response_recorded", "routed", "closed"].includes(entry.responseIngestState),
    ).length,
    replyConversions.length,
  );
  const trackedCityOpeningResponsesRouted = Math.max(
    sendActions.filter((entry) =>
      ["routed", "closed"].includes(entry.responseIngestState),
    ).length,
    replyConversions.filter((entry) => ["routed", "closed"].includes(entry.status)).length,
  );
  const trackedReplyConversionsQueued = replyConversions.filter((entry) => entry.status === "queued").length;
  const trackedReplyConversionsRouted = replyConversions.filter((entry) =>
    ["routed", "closed"].includes(entry.status),
  ).length;
  const trackedReplyConversionsBlocked = replyConversions.filter((entry) => entry.status === "blocked").length;

  const actualBudgetEvents = budgetEvents.filter((entry) => entry.eventType !== "recommended");
  const recommendedBudgetEvents = budgetEvents.filter((entry) => entry.eventType === "recommended");
  const totalRecordedSpendUsd = actualBudgetEvents.reduce((sum, entry) => sum + entry.amountUsd, 0);
  const withinPolicySpendUsd = actualBudgetEvents
    .filter((entry) => entry.withinPolicy)
    .reduce((sum, entry) => sum + entry.amountUsd, 0);
  const outsidePolicySpendUsd = actualBudgetEvents
    .filter((entry) => !entry.withinPolicy)
    .reduce((sum, entry) => sum + entry.amountUsd, 0);
  const recommendedSpendUsd = recommendedBudgetEvents.reduce((sum, entry) => sum + entry.amountUsd, 0);

  const wideningGuard = buildCityLaunchWideningGuard({
    proofReadyListings: 0,
    hostedReviewsStarted: 0,
    approvedCapturers: prospects.filter((entry) =>
      ["approved", "onboarded", "capturing"].includes(entry.status),
    ).length,
    onboardedCapturers,
  });

  return {
    trackedSupplyProspectsContacted,
    trackedBuyerTargetsResearched,
    trackedFirstTouchesSent,
    trackedCityOpeningChannelAccountsReady,
    trackedCityOpeningChannelAccountsCreated,
    trackedCityOpeningChannelAccountsBlocked,
    trackedCityOpeningSendActionsReady,
    trackedCityOpeningSendActionsSent,
    trackedCityOpeningSendActionsBlocked,
    trackedCityOpeningResponsesRecorded,
    trackedCityOpeningResponsesRouted,
    trackedReplyConversionsQueued,
    trackedReplyConversionsRouted,
    trackedReplyConversionsBlocked,
    onboardedCapturers,
    totalRecordedSpendUsd,
    withinPolicySpendUsd,
    outsidePolicySpendUsd,
    recommendedSpendUsd,
    wideningGuard,
    dataSources: [
      COLLECTIONS.prospects,
      COLLECTIONS.buyerTargets,
      COLLECTIONS.touches,
      COLLECTIONS.budgetEvents,
      COLLECTIONS.channelAccounts,
      COLLECTIONS.sendActions,
      COLLECTIONS.replyConversions,
    ],
  } satisfies CityLaunchLedgerSummary;
}
