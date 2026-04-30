import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { slugifyCityName } from "./cityLaunchProfiles";
import {
  listCityLaunchBudgetEvents,
  readCityLaunchActivation,
  recordCityLaunchBudgetEvent,
  type CityLaunchBudgetEventRecord,
} from "./cityLaunchLedgers";
import type { CityLaunchBudgetPolicy, CityLaunchBudgetTier } from "./cityLaunchPolicy";
import type { CityLaunchBudgetCategory } from "./cityLaunchResearchContracts";
import {
  evaluateAgentSpendPolicy,
  isAgentSpendStatus,
  normalizeAgentSpendProvider,
  normalizeAgentSpendStatus,
  type AgentSpendPolicyDecision,
  type AgentSpendProvider,
  type AgentSpendStatus,
} from "./agentSpendPolicy";
import {
  requestAgentSpendProvider,
  type AgentSpendProviderRequestResult,
} from "./agentSpendProviders";

export const AGENT_SPEND_REQUEST_COLLECTION = "agentSpendRequests";

export type AgentSpendStatusHistoryEntry = {
  status: AgentSpendStatus;
  atIso: string;
  actor: string;
  note: string | null;
};

export type AgentSpendRequestInput = {
  id?: string | null;
  city: string;
  launchId?: string | null;
  issueId?: string | null;
  runId?: string | null;
  requestedByAgent?: string | null;
  requestedByRole?: string | null;
  amountUsd: number;
  currency?: string | null;
  category: CityLaunchBudgetCategory;
  vendorName: string;
  vendorUrl?: string | null;
  purpose: string;
  expectedOutcome?: string | null;
  evidenceRefs?: string[] | null;
  provider?: AgentSpendProvider | string | null;
  budgetPolicy?: CityLaunchBudgetPolicy | null;
  budgetTier?: CityLaunchBudgetTier | null;
  maxTotalApprovedUsd?: number | null;
  operatorAutoApproveUsd?: number | null;
  founderApprovedBudgetEnvelope?: boolean | null;
  allowedVendorNames?: string[] | null;
  expiresAtIso?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AgentSpendRequestRecord = {
  schemaVersion: "2026-04-30.agentic-spend-request.v1";
  id: string;
  city: string;
  citySlug: string;
  launchId: string | null;
  issueId: string | null;
  runId: string | null;
  requestedByAgent: string | null;
  requestedByRole: string | null;
  amountUsd: number;
  currency: "USD";
  category: CityLaunchBudgetCategory;
  vendorName: string;
  vendorUrl: string | null;
  purpose: string;
  expectedOutcome: string | null;
  evidenceRefs: string[];
  provider: AgentSpendProvider;
  providerRequestId: string | null;
  providerMode: AgentSpendProviderRequestResult["providerMode"] | null;
  providerNotes: string[];
  providerEventId: string | null;
  status: AgentSpendStatus;
  statusHistory: AgentSpendStatusHistoryEntry[];
  rawCredentialDelivered: false;
  policyDecision: AgentSpendPolicyDecision;
  budgetPolicySnapshot: CityLaunchBudgetPolicy;
  budgetEventId: string | null;
  paidAmountUsd: number | null;
  expiresAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
  reconciledAtIso: string | null;
  metadata: Record<string, unknown> | null;
};

export type AgentSpendReconciliationInput = {
  spendRequestId: string;
  provider?: AgentSpendProvider | string | null;
  providerEventId?: string | null;
  status: AgentSpendStatus | string;
  paidAmountUsd?: number | null;
  note?: string | null;
  occurredAtIso?: string | null;
  rawCredentialDelivered?: boolean | null;
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

function asStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStringArray(value: unknown) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];
  return rawValues
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry, index, entries) => entry.length > 0 && entries.indexOf(entry) === index);
}

function defaultExpiresAtIso(createdAtIso: string) {
  const createdAt = new Date(createdAtIso);
  if (Number.isNaN(createdAt.getTime())) {
    return null;
  }
  return new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

function envAllowedVendorNames() {
  return normalizeStringArray(process.env.AGENT_SPEND_VENDOR_ALLOWLIST || "");
}

function actualBudgetSpendUsd(events: CityLaunchBudgetEventRecord[]) {
  return events
    .filter((event) => event.eventType !== "recommended")
    .reduce((sum, event) => sum + Math.max(0, event.amountUsd || 0), 0);
}

function pendingSpendCommitmentUsd(records: AgentSpendRequestRecord[]) {
  const pendingStatuses = new Set<AgentSpendStatus>([
    "policy_approved",
    "provider_requested",
    "credential_issued",
  ]);
  return records
    .filter((record) => pendingStatuses.has(record.status))
    .reduce((sum, record) => sum + Math.max(0, record.amountUsd || 0), 0);
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

export async function listAgentSpendRequests(city: string) {
  const { citySlug } = normalizedCity(city);
  return listByCity<AgentSpendRequestRecord>(AGENT_SPEND_REQUEST_COLLECTION, citySlug);
}

export async function readAgentSpendRequest(spendRequestId: string) {
  if (!db) {
    return null;
  }
  const doc = await db.collection(AGENT_SPEND_REQUEST_COLLECTION).doc(spendRequestId).get();
  return doc.exists ? (doc.data() as AgentSpendRequestRecord) : null;
}

export async function requestAgentSpend(input: AgentSpendRequestInput) {
  if (!db) {
    throw new Error("Database not available");
  }

  const createdAtIso = nowIso();
  const base = normalizedCity(input.city);
  const ref = input.id
    ? db.collection(AGENT_SPEND_REQUEST_COLLECTION).doc(normalizeId(input.id, `spend_${base.citySlug}`))
    : db.collection(AGENT_SPEND_REQUEST_COLLECTION).doc();
  const provider = normalizeAgentSpendProvider(input.provider);
  const activation = await readCityLaunchActivation(input.city);
  const budgetEvents = await listCityLaunchBudgetEvents(input.city);
  const existingRequests = await listAgentSpendRequests(input.city);
  const budgetPolicy = input.budgetPolicy || activation?.budgetPolicy || null;
  const existingCommittedSpendUsd =
    actualBudgetSpendUsd(budgetEvents) + pendingSpendCommitmentUsd(existingRequests);
  const founderApprovedBudgetEnvelope =
    input.founderApprovedBudgetEnvelope ??
    activation?.founderApproved ??
    (budgetPolicy ? budgetPolicy.maxTotalApprovedUsd === 0 : true);
  const allowedVendorNames = input.allowedVendorNames?.length
    ? input.allowedVendorNames
    : envAllowedVendorNames();
  const policyDecision = evaluateAgentSpendPolicy({
    city: input.city,
    amountUsd: input.amountUsd,
    currency: input.currency || "USD",
    category: input.category,
    vendorName: input.vendorName,
    purpose: input.purpose,
    issueId: input.issueId,
    runId: input.runId,
    evidenceRefs: input.evidenceRefs,
    provider,
    budgetPolicy,
    budgetTier: input.budgetTier,
    maxTotalApprovedUsd: input.maxTotalApprovedUsd,
    operatorAutoApproveUsd: input.operatorAutoApproveUsd,
    existingCommittedSpendUsd,
    allowedVendorNames,
    founderApprovedBudgetEnvelope,
  });

  let finalStatus: AgentSpendStatus = policyDecision.status;
  let providerResult: AgentSpendProviderRequestResult | null = null;
  if (policyDecision.status === "policy_approved") {
    providerResult = requestAgentSpendProvider({
      spendRequestId: ref.id,
      provider,
      amountUsd: input.amountUsd,
      currency: "USD",
      vendorName: input.vendorName,
      purpose: input.purpose,
      requestedAtIso: createdAtIso,
    });
    finalStatus = providerResult.status;
  }

  const statusHistory: AgentSpendStatusHistoryEntry[] = [
    {
      status: "requested",
      atIso: createdAtIso,
      actor: input.requestedByAgent || input.requestedByRole || "unknown-agent",
      note: "agent spend request recorded",
    },
    {
      status: finalStatus,
      atIso: createdAtIso,
      actor: providerResult ? `provider:${providerResult.provider}` : "agentSpendPolicy",
      note:
        providerResult?.notes.join("; ") ||
        [...policyDecision.blockers, ...policyDecision.reasons].join("; ") ||
        null,
    },
  ];

  const payload: AgentSpendRequestRecord = {
    schemaVersion: "2026-04-30.agentic-spend-request.v1",
    id: ref.id,
    city: base.city,
    citySlug: base.citySlug,
    launchId: asStringOrNull(input.launchId),
    issueId: asStringOrNull(input.issueId),
    runId: asStringOrNull(input.runId),
    requestedByAgent: asStringOrNull(input.requestedByAgent),
    requestedByRole: asStringOrNull(input.requestedByRole),
    amountUsd: input.amountUsd,
    currency: "USD",
    category: input.category,
    vendorName: input.vendorName.trim(),
    vendorUrl: asStringOrNull(input.vendorUrl),
    purpose: input.purpose.trim(),
    expectedOutcome: asStringOrNull(input.expectedOutcome),
    evidenceRefs: normalizeStringArray(input.evidenceRefs),
    provider,
    providerRequestId: providerResult?.providerRequestId || null,
    providerMode: providerResult?.providerMode || null,
    providerNotes: providerResult?.notes || [],
    providerEventId: null,
    status: finalStatus,
    statusHistory,
    rawCredentialDelivered: false,
    policyDecision,
    budgetPolicySnapshot: policyDecision.budgetPolicy,
    budgetEventId: null,
    paidAmountUsd: null,
    expiresAtIso: asStringOrNull(input.expiresAtIso) || defaultExpiresAtIso(createdAtIso),
    createdAtIso,
    updatedAtIso: createdAtIso,
    reconciledAtIso: null,
    metadata: input.metadata || null,
  };

  await ref.set(
    {
      ...payload,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );

  return payload;
}

export async function reconcileAgentSpendProviderEvent(
  input: AgentSpendReconciliationInput,
) {
  if (!db) {
    throw new Error("Database not available");
  }
  const status = normalizeAgentSpendStatus(input.status);
  if (!status || status === "requested") {
    throw new Error("A valid provider reconciliation status is required");
  }
  if (input.rawCredentialDelivered) {
    throw new Error("Raw payment credentials must not be delivered to agent spend ledgers");
  }

  const ref = db.collection(AGENT_SPEND_REQUEST_COLLECTION).doc(input.spendRequestId);
  const doc = await ref.get();
  if (!doc.exists) {
    throw new Error(`Spend request ${input.spendRequestId} was not found`);
  }
  const existing = doc.data() as AgentSpendRequestRecord;
  const occurredAtIso = asStringOrNull(input.occurredAtIso) || nowIso();
  const provider = normalizeAgentSpendProvider(input.provider || existing.provider);
  const providerEventId = asStringOrNull(input.providerEventId) || existing.providerEventId;
  const paidAmountUsd = input.paidAmountUsd ?? existing.paidAmountUsd ?? existing.amountUsd;
  let budgetEventId = existing.budgetEventId;

  if ((status === "paid" || status === "reconciled") && !budgetEventId) {
    if (!Number.isFinite(paidAmountUsd) || paidAmountUsd <= 0) {
      throw new Error("paidAmountUsd must be positive for paid or reconciled provider events");
    }
    const budgetEvent = await recordCityLaunchBudgetEvent({
      id: `agent_spend_${existing.id}_${providerEventId || status}`,
      city: existing.city,
      launchId: existing.launchId,
      category: existing.category,
      amountUsd: paidAmountUsd,
      note:
        asStringOrNull(input.note) ||
        `Agent spend ${existing.id} ${status} via ${provider}; provider event ${providerEventId || "not supplied"}.`,
      approvedByRole: existing.requestedByRole || "agent-spend-policy",
      withinPolicy: existing.policyDecision.withinPolicy,
      eventType: "actual",
      researchProvenance: null,
    });
    budgetEventId = budgetEvent.id;
  }

  const statusHistory = [
    ...(Array.isArray(existing.statusHistory) ? existing.statusHistory : []),
    {
      status,
      atIso: occurredAtIso,
      actor: `provider:${provider}`,
      note: asStringOrNull(input.note),
    },
  ].filter((entry) => isAgentSpendStatus(entry.status));

  const updated: AgentSpendRequestRecord = {
    ...existing,
    provider,
    providerEventId,
    status,
    statusHistory,
    rawCredentialDelivered: false,
    paidAmountUsd: status === "paid" || status === "reconciled" ? paidAmountUsd : existing.paidAmountUsd,
    budgetEventId,
    updatedAtIso: occurredAtIso,
    reconciledAtIso: status === "reconciled" ? occurredAtIso : existing.reconciledAtIso,
  };

  await ref.set(
    {
      ...updated,
      updated_at: serverTimestamp(),
    },
    { merge: true },
  );

  return updated;
}
