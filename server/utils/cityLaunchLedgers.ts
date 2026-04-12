import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  buildCityLaunchWideningGuard,
  type CityLaunchBudgetPolicy,
  type CityLaunchBudgetTier,
  type CityLaunchWideningGuard,
} from "./cityLaunchPolicy";
import { slugifyCityName } from "./cityLaunchProfiles";

export type CityLaunchActivationStatus =
  | "planning"
  | "activation_ready"
  | "executing"
  | "proof_live"
  | "growth_live";

export type CityLaunchProspectStatus =
  | "identified"
  | "contacted"
  | "responded"
  | "qualified"
  | "approved"
  | "onboarded"
  | "capturing"
  | "inactive";

export type CityLaunchBuyerTargetStatus =
  | "identified"
  | "researched"
  | "queued"
  | "contacted"
  | "engaged"
  | "hosted_review"
  | "commercial_handoff"
  | "closed_won"
  | "closed_lost";

export type CityLaunchTouchStatus =
  | "draft"
  | "queued"
  | "sent"
  | "delivered"
  | "replied"
  | "failed";

export type CityLaunchTouchType =
  | "first_touch"
  | "follow_up"
  | "approval_request"
  | "intro"
  | "operator_send";

export type CityLaunchBudgetCategory =
  | "creative"
  | "outbound"
  | "community"
  | "field_ops"
  | "travel"
  | "tools"
  | "other";

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
  proofPath: string | null;
  ownerAgent: string | null;
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
  const payload: CityLaunchActivationRecord = {
    ...base,
    budgetTier: input.budgetTier,
    budgetPolicy: input.budgetPolicy,
    founderApproved: input.founderApproved,
    status: input.status,
    rootIssueId: input.rootIssueId,
    taskIssueIds: input.taskIssueIds,
    machineReadablePolicyVersion: "2026-04-12.1",
    wideningGuard: input.wideningGuard,
    createdAtIso: nowIso(),
    updatedAtIso: nowIso(),
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

export async function upsertCityLaunchProspect(input: Omit<CityLaunchProspectRecord, "id" | "citySlug" | "createdAtIso" | "updatedAtIso"> & {
  id?: string | null;
}) {
  if (!db) {
    throw new Error("Database not available");
  }
  const record = withCity(input);
  const id = normalizeId(input.id, `prospect_${record.citySlug}`);
  const createdAtIso = nowIso();
  const payload: CityLaunchProspectRecord = {
    id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: input.launchId ?? null,
    sourceBucket: input.sourceBucket,
    channel: input.channel,
    name: input.name,
    email: input.email ?? null,
    status: input.status,
    ownerAgent: input.ownerAgent ?? null,
    notes: input.notes ?? null,
    firstContactedAt: input.firstContactedAt ?? null,
    lastContactedAt: input.lastContactedAt ?? null,
    createdAtIso,
    updatedAtIso: createdAtIso,
  };
  await db.collection(COLLECTIONS.prospects).doc(id).set(
    {
      ...payload,
      updated_at: serverTimestamp(),
      created_at: serverTimestamp(),
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
  const createdAtIso = nowIso();
  const payload: CityLaunchBuyerTargetRecord = {
    id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: input.launchId ?? null,
    companyName: input.companyName,
    contactName: input.contactName ?? null,
    status: input.status,
    workflowFit: input.workflowFit ?? null,
    proofPath: input.proofPath ?? null,
    ownerAgent: input.ownerAgent ?? null,
    createdAtIso,
    updatedAtIso: createdAtIso,
  };
  await db.collection(COLLECTIONS.buyerTargets).doc(id).set(
    {
      ...payload,
      updated_at: serverTimestamp(),
      created_at: serverTimestamp(),
    },
    { merge: true },
  );
  return payload;
}

export async function recordCityLaunchTouch(
  input: Omit<CityLaunchTouchRecord, "citySlug" | "createdAtIso" | "updatedAtIso" | "id">,
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const record = withCity(input);
  const createdAtIso = nowIso();
  const ref = db.collection(COLLECTIONS.touches).doc();
  const payload: CityLaunchTouchRecord = {
    id: ref.id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: input.launchId ?? null,
    referenceType: input.referenceType,
    referenceId: input.referenceId ?? null,
    touchType: input.touchType,
    channel: input.channel,
    status: input.status,
    campaignId: input.campaignId ?? null,
    issueId: input.issueId ?? null,
    createdAtIso,
    updatedAtIso: createdAtIso,
  };
  await ref.set({
    ...payload,
    updated_at: serverTimestamp(),
    created_at: serverTimestamp(),
  });
  return payload;
}

export async function recordCityLaunchBudgetEvent(
  input: Omit<CityLaunchBudgetEventRecord, "citySlug" | "createdAtIso" | "id">,
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const record = withCity(input);
  const createdAtIso = nowIso();
  const ref = db.collection(COLLECTIONS.budgetEvents).doc();
  const payload: CityLaunchBudgetEventRecord = {
    id: ref.id,
    city: record.city,
    citySlug: record.citySlug,
    launchId: input.launchId ?? null,
    category: input.category,
    amountUsd: input.amountUsd,
    note: input.note ?? null,
    approvedByRole: input.approvedByRole ?? null,
    withinPolicy: input.withinPolicy,
    createdAtIso,
  };
  await ref.set({
    ...payload,
    created_at: serverTimestamp(),
  });
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
  const totalRecordedSpendUsd = budgetEvents.reduce((sum, entry) => sum + entry.amountUsd, 0);
  const withinPolicySpendUsd = budgetEvents
    .filter((entry) => entry.withinPolicy)
    .reduce((sum, entry) => sum + entry.amountUsd, 0);
  const outsidePolicySpendUsd = budgetEvents
    .filter((entry) => !entry.withinPolicy)
    .reduce((sum, entry) => sum + entry.amountUsd, 0);

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
    wideningGuard,
    dataSources: [
      COLLECTIONS.prospects,
      COLLECTIONS.buyerTargets,
      COLLECTIONS.touches,
      COLLECTIONS.budgetEvents,
    ],
  } satisfies CityLaunchLedgerSummary;
}
