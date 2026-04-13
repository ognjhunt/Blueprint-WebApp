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
  sourceType: "deep_research_playbook";
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
  onboardedCapturers: number;
  totalRecordedSpendUsd: number;
  withinPolicySpendUsd: number;
  outsidePolicySpendUsd: number;
  recommendedSpendUsd: number;
  wideningGuard: CityLaunchWideningGuard;
  dataSources: string[];
};

const COLLECTIONS = {
  activations: "cityLaunchActivations",
  prospects: "cityLaunchProspects",
  buyerTargets: "cityLaunchBuyerTargets",
  touches: "cityLaunchTouches",
  budgetEvents: "cityLaunchBudgetEvents",
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

export async function upsertCityLaunchBuyerTarget(
  input: Omit<CityLaunchBuyerTargetRecord, "id" | "citySlug" | "createdAtIso" | "updatedAtIso"> & {
    id?: string | null;
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

export async function summarizeCityLaunchLedgers(city: string) {
  const { citySlug } = normalizedCity(city);

  const [prospects, buyerTargets, touches, budgetEvents] = await Promise.all([
    listByCity<CityLaunchProspectRecord>(COLLECTIONS.prospects, citySlug),
    listByCity<CityLaunchBuyerTargetRecord>(COLLECTIONS.buyerTargets, citySlug),
    listByCity<CityLaunchTouchRecord>(COLLECTIONS.touches, citySlug),
    listByCity<CityLaunchBudgetEventRecord>(COLLECTIONS.budgetEvents, citySlug),
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
    ],
  } satisfies CityLaunchLedgerSummary;
}
