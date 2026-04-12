import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { normalizeDemandCity } from "../../client/src/lib/cityDemandMessaging";
import { decryptInboundRequestForAdmin } from "./field-encryption";
import type { InboundRequest, InboundRequestStored } from "../types/inbound-request";
import { buildCityLaunchWideningGuard } from "./cityLaunchPolicy";
import { resolveCityLaunchProfile, slugifyCityName } from "./cityLaunchProfiles";
import {
  readCityLaunchActivation,
  summarizeCityLaunchLedgers,
} from "./cityLaunchLedgers";

type TrackedMetric = {
  key: string;
  label: string;
  actual: number | null;
  targetMin: number;
  targetMax: number | null;
  tracked: boolean;
  status: "not_tracked" | "blocked" | "at_risk" | "on_track";
  note: string | null;
};

export type CityLaunchScorecard = {
  city: {
    key: string;
    label: string;
  };
  generatedAt: string;
  supply: TrackedMetric[];
  demand: TrackedMetric[];
  budget: {
    tier: string | null;
    totalRecordedSpendUsd: number;
    withinPolicySpendUsd: number;
    outsidePolicySpendUsd: number;
  };
  activation: {
    founderApproved: boolean;
    status: string | null;
    wideningAllowed: boolean;
    wideningReasons: string[];
    rootIssueId: string | null;
  };
  warnings: string[];
  dataSources: string[];
};

type DecryptedInbound = InboundRequest & {
  requestId: string;
};

function normalizeToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMetric(input: {
  key: string;
  label: string;
  actual: number | null;
  targetMin: number;
  targetMax: number | null;
  tracked?: boolean;
  note?: string | null;
}) {
  const tracked = input.tracked !== false;
  let status: TrackedMetric["status"] = "not_tracked";
  if (tracked) {
    if (input.actual === null) {
      status = "blocked";
    } else if (input.actual >= input.targetMin) {
      status = "on_track";
    } else if (input.actual > 0) {
      status = "at_risk";
    } else {
      status = "blocked";
    }
  }

  return {
    key: input.key,
    label: input.label,
    actual: tracked ? input.actual : null,
    targetMin: input.targetMin,
    targetMax: input.targetMax,
    tracked,
    status,
    note: input.note ?? null,
  } satisfies TrackedMetric;
}

function textMatchesCity(citySlug: string, value: string | null | undefined) {
  const normalized = normalizeToken(value);
  return citySlug.includes("san-francisco")
    ? normalized.includes("san francisco") || normalized.includes("bay area") || normalized.includes("sf")
    : normalized.includes("austin");
}

function extractProofPathTimestamp(
  proofPath: Record<string, unknown> | undefined,
  key: string,
) {
  const value = proofPath?.[key];
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  return null;
}

async function decryptInboundRequests() {
  if (!db) {
    return [] as DecryptedInbound[];
  }

  const snapshot = await db.collection("inboundRequests").limit(1500).get();
  const records = await Promise.all(
    snapshot.docs.map(async (doc) => {
      try {
        const decrypted = (await decryptInboundRequestForAdmin(
          doc.data() as InboundRequestStored,
        )) as InboundRequest;
        return {
          ...decrypted,
          requestId: doc.id,
        } as DecryptedInbound;
      } catch {
        return null;
      }
    }),
  );

  return records.filter((record): record is DecryptedInbound => Boolean(record));
}

function requestMatchesCity(citySlug: string, request: DecryptedInbound) {
  const demandCity = normalizeDemandCity(request.context?.demandCity || null);
  if (
    (citySlug === "austin-tx" && demandCity === "austin")
    || (citySlug === "san-francisco-ca" && demandCity === "san-francisco")
  ) {
    return true;
  }

  return textMatchesCity(citySlug, request.request?.siteLocation || null);
}

export async function collectCityLaunchScorecard(city: string): Promise<CityLaunchScorecard> {
  if (!db) {
    throw new Error("Database not available");
  }
  const profile = resolveCityLaunchProfile(city);
  const citySlug = slugifyCityName(profile.city);

  const [waitlistSnapshot, usersSnapshot, inboundRequests, ledgerSummary, activation] = await Promise.all([
    db.collection("waitlistSubmissions").limit(1500).get(),
    db.collection("users").limit(2000).get(),
    decryptInboundRequests(),
    summarizeCityLaunchLedgers(profile.city),
    readCityLaunchActivation(profile.city),
  ]);

  const supplySignalEmails = new Set<string>();
  for (const doc of waitlistSnapshot.docs) {
    const data = (doc.data() || {}) as Record<string, unknown>;
    const email = typeof data.email_normalized === "string"
      ? data.email_normalized
      : typeof data.email === "string"
        ? data.email.trim().toLowerCase()
        : "";
    const role = typeof data.role_normalized === "string" ? data.role_normalized : "";
    const market = typeof data.market === "string" ? data.market : "";
    if (role === "capturer" && textMatchesCity(citySlug, market) && email) {
      supplySignalEmails.add(email);
    }
  }

  let approvedCapturers = 0;
  let firstCapturesCompleted = 0;
  let qaPassedCaptures = 0;

  for (const doc of usersSnapshot.docs) {
    const data = (doc.data() || {}) as Record<string, unknown>;
    const roles = Array.isArray(data.roles)
      ? data.roles.filter((value): value is string => typeof value === "string")
      : [];
    const isCapturer =
      data.role === "capturer" || roles.includes("capturer");
    if (!isCapturer || !textMatchesCity(citySlug, typeof data.capturerMarket === "string" ? data.capturerMarket : null)) {
      continue;
    }

    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    if (email) {
      supplySignalEmails.add(email);
    }

    if (data.capturerApplicationStatus === "active") {
      approvedCapturers += 1;
    }

    const stats = data.stats && typeof data.stats === "object"
      ? (data.stats as Record<string, unknown>)
      : {};
    const totalCaptures = typeof stats.totalCaptures === "number" ? stats.totalCaptures : 0;
    const approvedCaptures = typeof stats.approvedCaptures === "number" ? stats.approvedCaptures : 0;

    if (totalCaptures > 0) {
      firstCapturesCompleted += 1;
    }
    if (approvedCaptures > 0) {
      qaPassedCaptures += 1;
    }
  }

  const cityRobotTeamRequests = inboundRequests.filter(
    (request) => request.request?.buyerType === "robot_team" && requestMatchesCity(citySlug, request),
  );
  const citySiteRequests = inboundRequests.filter((request) => requestMatchesCity(citySlug, request));

  const qualifiedConversations = cityRobotTeamRequests.filter((request) =>
    ["qualified_ready", "qualified_risky"].includes(request.qualification_state || ""),
  ).length;

  const proofReadyListings = citySiteRequests.filter((request) => {
    const proofPath =
      request.ops?.proof_path && typeof request.ops.proof_path === "object"
        ? (request.ops.proof_path as Record<string, unknown>)
        : undefined;
    return Boolean(
      extractProofPathTimestamp(proofPath, "proof_pack_delivered_at")
      || extractProofPathTimestamp(proofPath, "hosted_review_ready_at"),
    );
  }).length;

  const proofPacksDelivered = cityRobotTeamRequests.filter((request) => {
    const proofPath = request.ops?.proof_path as Record<string, unknown> | undefined;
    return Boolean(extractProofPathTimestamp(proofPath, "proof_pack_delivered_at"));
  }).length;

  const hostedReviewsStarted = cityRobotTeamRequests.filter((request) => {
    const proofPath = request.ops?.proof_path as Record<string, unknown> | undefined;
    return Boolean(extractProofPathTimestamp(proofPath, "hosted_review_started_at"));
  }).length;

  const hostedFollowUps = cityRobotTeamRequests.filter((request) => {
    const proofPath = request.ops?.proof_path as Record<string, unknown> | undefined;
    return Boolean(extractProofPathTimestamp(proofPath, "hosted_review_follow_up_at"));
  }).length;

  const commercialHandoffs = cityRobotTeamRequests.filter((request) => {
    const proofPath = request.ops?.proof_path as Record<string, unknown> | undefined;
    return Boolean(extractProofPathTimestamp(proofPath, "human_commercial_handoff_at"));
  }).length;

  const wideningGuard = buildCityLaunchWideningGuard({
    proofReadyListings,
    hostedReviewsStarted,
    approvedCapturers,
    onboardedCapturers: ledgerSummary.onboardedCapturers,
  });

  const warnings = [
    `${profile.shortLabel} proof-ready listing count is derived from city-matching inbound requests with proof-pack or hosted-review readiness, because published marketplace inventory does not yet carry an explicit city field.`,
    ...wideningGuard.reasons,
  ];

  return {
    city: {
      key: citySlug,
      label: profile.city,
    },
    generatedAt: new Date().toISOString(),
    supply: [
      buildMetric({
        key: "supply_prospects_contacted",
        label: `Curated ${profile.shortLabel} supply prospects contacted`,
        actual: ledgerSummary.trackedSupplyProspectsContacted,
        targetMin: 25,
        targetMax: 50,
        note: "Tracked from the canonical city launch prospect ledger.",
      }),
      buildMetric({
        key: "raw_supply_signups",
        label: `${profile.shortLabel} source-tagged signups or applications`,
        actual: supplySignalEmails.size,
        targetMin: 100,
        targetMax: null,
        note: "Deduped across waitlist submissions and capturer user records by email.",
      }),
      buildMetric({
        key: "approved_capturers",
        label: `Approved ${profile.shortLabel} capturers`,
        actual: approvedCapturers,
        targetMin: 10,
        targetMax: 20,
      }),
      buildMetric({
        key: "first_captures_completed",
        label: `${profile.shortLabel} first captures completed`,
        actual: firstCapturesCompleted,
        targetMin: 5,
        targetMax: 10,
      }),
      buildMetric({
        key: "qa_passed_captures",
        label: `${profile.shortLabel} QA-passed captures`,
        actual: qaPassedCaptures,
        targetMin: 3,
        targetMax: 5,
      }),
      buildMetric({
        key: "proof_ready_listings",
        label: `${profile.shortLabel} proof-ready listings or proof packs`,
        actual: proofReadyListings,
        targetMin: 1,
        targetMax: 2,
      }),
    ],
    demand: [
      buildMetric({
        key: "named_targets_researched",
        label: `Named ${profile.shortLabel} robot-company targets researched`,
        actual: ledgerSummary.trackedBuyerTargetsResearched,
        targetMin: 20,
        targetMax: 40,
        note: "Tracked from the canonical city launch buyer-target ledger.",
      }),
      buildMetric({
        key: "tailored_first_touches",
        label: `Tailored ${profile.shortLabel} first touches sent`,
        actual: ledgerSummary.trackedFirstTouchesSent,
        targetMin: 10,
        targetMax: 20,
        note: "Tracked from the canonical city launch touch ledger.",
      }),
      buildMetric({
        key: "live_buyer_conversations",
        label: `${profile.shortLabel} live buyer conversations`,
        actual: qualifiedConversations,
        targetMin: 5,
        targetMax: 8,
        note: `Computed from ${profile.shortLabel} robot-team requests in qualified states.`,
      }),
      buildMetric({
        key: "proof_packs_delivered",
        label: `${profile.shortLabel} proof packs delivered`,
        actual: proofPacksDelivered,
        targetMin: 1,
        targetMax: 2,
      }),
      buildMetric({
        key: "hosted_reviews_started",
        label: `${profile.shortLabel} hosted proof reviews started`,
        actual: hostedReviewsStarted,
        targetMin: 2,
        targetMax: 3,
      }),
      buildMetric({
        key: "hosted_follow_ups_sent",
        label: `${profile.shortLabel} hosted-review follow-ups sent`,
        actual: hostedFollowUps,
        targetMin: 2,
        targetMax: 3,
      }),
      buildMetric({
        key: "human_commercial_handoffs",
        label: `${profile.shortLabel} standard-commercial handoffs`,
        actual: commercialHandoffs,
        targetMin: 1,
        targetMax: 3,
      }),
    ],
    budget: {
      tier: activation?.budgetTier || null,
      totalRecordedSpendUsd: ledgerSummary.totalRecordedSpendUsd,
      withinPolicySpendUsd: ledgerSummary.withinPolicySpendUsd,
      outsidePolicySpendUsd: ledgerSummary.outsidePolicySpendUsd,
    },
    activation: {
      founderApproved: activation?.founderApproved === true,
      status: activation?.status || null,
      wideningAllowed: wideningGuard.wideningAllowed,
      wideningReasons: wideningGuard.reasons,
      rootIssueId: activation?.rootIssueId || null,
    },
    warnings,
    dataSources: [
      "waitlistSubmissions",
      "users",
      "inboundRequests",
      "inboundRequests.ops.proof_path",
      ...ledgerSummary.dataSources,
    ],
  };
}

export async function collectAustinLaunchScorecard(): Promise<CityLaunchScorecard> {
  return collectCityLaunchScorecard("Austin, TX");
}
