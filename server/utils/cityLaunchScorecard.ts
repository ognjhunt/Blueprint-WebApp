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
import { resolveCityLaunchPlanningState } from "./cityLaunchPlanningState";
import { loadAndParseCityLaunchResearchArtifact } from "./cityLaunchResearchParser";
import type { CityLaunchMetricDependencyStatus } from "./cityLaunchDoctrine";

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
  cityOpening: TrackedMetric[];
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
    cityThesis: string | null;
    primarySiteLane: string | null;
    primaryWorkflowLane: string | null;
    primaryBuyerProofPath: string | null;
    lawfulAccessModes: string[];
    validationBlockers: Array<{
      key: string;
      summary: string;
      severity: string;
      validationRequired: boolean;
      ownerLane: string | null;
    }>;
    metricsDependencies: Array<{
      key: string;
      kind: string;
      status: CityLaunchMetricDependencyStatus;
      actualCount: number;
      ownerLane: string | null;
      notes: string | null;
    }>;
    sourceActivationPayloadPath: string | null;
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
    } else if (input.targetMax !== null && input.actual > input.targetMax) {
      status = input.targetMax === 0 ? "blocked" : "at_risk";
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
  const cityLabel = normalizeToken(citySlug.replace(/-/g, " "));
  const shortLabel = cityLabel.replace(/\s+[a-z]{2}$/, "");
  return normalized.includes(cityLabel)
    || normalized.includes(shortLabel)
    || (citySlug.includes("san-francisco")
      && (normalized.includes("bay area") || normalized.includes("sf")));
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

function hasAnyProofPathSignal(proofPath: Record<string, unknown> | undefined) {
  return Boolean(
    extractProofPathTimestamp(proofPath, "qualified_inbound_at")
    || extractProofPathTimestamp(proofPath, "exact_site_requested_at")
    || extractProofPathTimestamp(proofPath, "proof_pack_delivered_at")
    || extractProofPathTimestamp(proofPath, "hosted_review_ready_at")
    || extractProofPathTimestamp(proofPath, "hosted_review_started_at")
    || extractProofPathTimestamp(proofPath, "hosted_review_follow_up_at")
    || extractProofPathTimestamp(proofPath, "human_commercial_handoff_at"),
  );
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

async function loadCompletedResearch(city: string) {
  const planningState = await resolveCityLaunchPlanningState({ city });
  if (!planningState.completedArtifactPath) {
    return null;
  }
  try {
    return await loadAndParseCityLaunchResearchArtifact({
      city,
      artifactPath: planningState.completedArtifactPath,
    });
  } catch {
    return null;
  }
}

async function loadGrowthEvents() {
  if (!db) {
    return [] as Array<Record<string, unknown>>;
  }

  const snapshot = await db
    .collection("growth_events")
    .orderBy("created_at", "desc")
    .limit(4000)
    .get();

  return snapshot.docs.map((doc) => doc.data() as Record<string, unknown>);
}

function eventMatchesCity(profileCitySlug: string, event: Record<string, unknown>) {
  const properties =
    event.properties && typeof event.properties === "object"
      ? (event.properties as Record<string, unknown>)
      : {};
  const attribution =
    event.attribution && typeof event.attribution === "object"
      ? (event.attribution as Record<string, unknown>)
      : {};
  const cityValue =
    typeof properties.city === "string"
      ? properties.city
      : typeof attribution.demandCity === "string"
        ? attribution.demandCity
        : null;
  return textMatchesCity(profileCitySlug, cityValue);
}

function countEvent(
  events: Array<Record<string, unknown>>,
  citySlug: string,
  eventName: string,
) {
  return events.filter((event) => {
    const name = typeof event.event === "string" ? event.event : "";
    return name === eventName && eventMatchesCity(citySlug, event);
  }).length;
}

function buildMetricDependencyStatus(input: {
  dependency: {
    status: CityLaunchMetricDependencyStatus;
  };
  actualCount: number;
}) {
  if (input.actualCount > 0) {
    return "verified" satisfies CityLaunchMetricDependencyStatus;
  }
  return input.dependency.status;
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

  const [waitlistSnapshot, usersSnapshot, inboundRequests, ledgerSummary, activation, research, growthEvents] = await Promise.all([
    db.collection("waitlistSubmissions").limit(1500).get(),
    db.collection("users").limit(2000).get(),
    decryptInboundRequests(),
    summarizeCityLaunchLedgers(profile.city),
    readCityLaunchActivation(profile.city),
    loadCompletedResearch(profile.city),
    loadGrowthEvents(),
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
  const activationPayload = research?.activationPayload || null;

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

  const hostedReviewsReady = cityRobotTeamRequests.filter((request) => {
    const proofPath = request.ops?.proof_path as Record<string, unknown> | undefined;
    return Boolean(extractProofPathTimestamp(proofPath, "hosted_review_ready_at"));
  }).length;

  const proofPathsAssigned = cityRobotTeamRequests.filter((request) => {
    const proofPath = request.ops?.proof_path as Record<string, unknown> | undefined;
    return hasAnyProofPathSignal(proofPath);
  }).length;

  const commercialHandoffs = cityRobotTeamRequests.filter((request) => {
    const proofPath = request.ops?.proof_path as Record<string, unknown> | undefined;
    return Boolean(extractProofPathTimestamp(proofPath, "human_commercial_handoff_at"));
  }).length;

  const eventCounts = {
    robot_team_inbound_captured: countEvent(growthEvents, citySlug, "robot_team_inbound_captured"),
    exact_site_request_created: countEvent(growthEvents, citySlug, "exact_site_request_created"),
    proof_path_assigned: countEvent(growthEvents, citySlug, "proof_path_assigned"),
    proof_pack_delivered: countEvent(growthEvents, citySlug, "proof_pack_delivered"),
    hosted_review_ready: countEvent(growthEvents, citySlug, "hosted_review_ready"),
    hosted_review_started: countEvent(growthEvents, citySlug, "hosted_review_started"),
    hosted_review_follow_up_sent: countEvent(growthEvents, citySlug, "hosted_review_follow_up_sent"),
    human_commercial_handoff_started: countEvent(growthEvents, citySlug, "human_commercial_handoff_started"),
    proof_motion_stalled: countEvent(growthEvents, citySlug, "proof_motion_stalled"),
    deeper_review_requested: countEvent(growthEvents, citySlug, "deeper_review_requested"),
  };

  const derivedMetricActualCounts: Record<string, number> = {
    robot_team_inbound_captured: Math.max(eventCounts.robot_team_inbound_captured, cityRobotTeamRequests.length),
    proof_path_assigned: Math.max(eventCounts.proof_path_assigned, proofPathsAssigned),
    proof_pack_delivered: Math.max(eventCounts.proof_pack_delivered, proofPacksDelivered),
    hosted_review_ready: Math.max(eventCounts.hosted_review_ready, hostedReviewsReady),
    hosted_review_started: Math.max(eventCounts.hosted_review_started, hostedReviewsStarted),
    hosted_review_follow_up_sent: Math.max(eventCounts.hosted_review_follow_up_sent, hostedFollowUps),
    human_commercial_handoff_started: Math.max(eventCounts.human_commercial_handoff_started, commercialHandoffs),
    proof_motion_stalled: eventCounts.proof_motion_stalled,
  };

  const metricDependencies = (activationPayload?.metricsDependencies || []).map((dependency) => {
    const actualCount =
      dependency.kind === "event"
        ? (derivedMetricActualCounts[dependency.key] ?? countEvent(growthEvents, citySlug, dependency.key))
        : dependency.key === "first_lawful_access_path"
          ? citySiteRequests.some((request) =>
              Boolean(request.request?.siteName || request.request?.siteLocation),
            )
            ? 1
            : 0
          : dependency.key === "first_approved_capturer"
            ? approvedCapturers > 0
              ? 1
              : 0
            : dependency.key === "first_completed_capture"
              ? firstCapturesCompleted > 0
                ? 1
                : 0
              : dependency.key === "first_qa_passed_capture"
                ? qaPassedCaptures > 0
                  ? 1
                  : 0
                : dependency.key === "first_rights_cleared_proof_asset"
                  ? proofReadyListings > 0
                    ? 1
                    : 0
                  : dependency.key === "first_proof_pack_delivery"
                    ? proofPacksDelivered > 0
                      ? 1
                      : 0
                    : dependency.key === "first_hosted_review"
                      ? hostedReviewsStarted > 0
                        ? 1
                        : 0
                      : dependency.key === "first_human_commercial_handoff"
                        ? commercialHandoffs > 0
                          ? 1
                          : 0
                        : 0;

    return {
      key: dependency.key,
      kind: dependency.kind,
      status: buildMetricDependencyStatus({ dependency, actualCount }),
      actualCount,
      ownerLane: dependency.ownerLane,
      notes: dependency.notes,
    };
  });

  const unresolvedMetricReasons = metricDependencies
    .filter((dependency) => dependency.status !== "verified")
    .map((dependency) => `${dependency.key} is ${dependency.status}.`);

  const wideningGuard = buildCityLaunchWideningGuard({
    proofReadyListings,
    hostedReviewsStarted,
    approvedCapturers,
    onboardedCapturers: ledgerSummary.onboardedCapturers,
    metricsReady: unresolvedMetricReasons.length === 0,
    metricBlockers: unresolvedMetricReasons,
  });

  const warnings = [
    `${profile.shortLabel} proof-ready listing count is derived from city-matching inbound requests with proof-pack or hosted-review readiness, because published marketplace inventory does not yet carry an explicit city field.`,
    ...(activationPayload
      ? activationPayload.validationBlockers
          .filter((blocker) => blocker.validationRequired)
          .map((blocker) => `Validation required: ${blocker.summary}`)
      : ["No activation payload is available yet for this city."]),
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
        targetMin: 1,
        targetMax: null,
        note: "Deduped across waitlist submissions and capturer user records by email.",
      }),
      buildMetric({
        key: "approved_capturers",
        label: `Approved ${profile.shortLabel} capturers`,
        actual: approvedCapturers,
        targetMin: 1,
        targetMax: null,
      }),
      buildMetric({
        key: "first_captures_completed",
        label: `${profile.shortLabel} first captures completed`,
        actual: firstCapturesCompleted,
        targetMin: 1,
        targetMax: null,
      }),
      buildMetric({
        key: "qa_passed_captures",
        label: `${profile.shortLabel} QA-passed captures`,
        actual: qaPassedCaptures,
        targetMin: 1,
        targetMax: null,
      }),
      buildMetric({
        key: "proof_ready_listings",
        label: `${profile.shortLabel} proof-ready listings or proof packs`,
        actual: proofReadyListings,
        targetMin: 1,
        targetMax: null,
      }),
    ],
    cityOpening: [
      buildMetric({
        key: "city_opening_channel_accounts_ready",
        label: `${profile.shortLabel} city-opening channels ready or created`,
        actual: ledgerSummary.trackedCityOpeningChannelAccountsReady,
        targetMin: 1,
        targetMax: null,
        note: "Tracked from the city-opening channel/account registry.",
      }),
      buildMetric({
        key: "city_opening_channel_accounts_created",
        label: `${profile.shortLabel} city-opening channels created`,
        actual: ledgerSummary.trackedCityOpeningChannelAccountsCreated,
        targetMin: 0,
        targetMax: null,
        note: "Created means a real channel/account is marked live in the channel registry.",
      }),
      buildMetric({
        key: "city_opening_actions_ready",
        label: `${profile.shortLabel} city-opening sends ready`,
        actual: ledgerSummary.trackedCityOpeningSendActionsReady,
        targetMin: 1,
        targetMax: null,
        note: "Tracked from the city-opening send ledger.",
      }),
      buildMetric({
        key: "city_opening_actions_sent",
        label: `${profile.shortLabel} city-opening sends marked sent`,
        actual: ledgerSummary.trackedCityOpeningSendActionsSent,
        targetMin: 0,
        targetMax: null,
      }),
      buildMetric({
        key: "city_opening_actions_blocked",
        label: `${profile.shortLabel} city-opening sends blocked`,
        actual: ledgerSummary.trackedCityOpeningSendActionsBlocked,
        targetMin: 0,
        targetMax: 0,
        note: "Zero is best. Higher counts indicate execution blockers in live distribution.",
      }),
      buildMetric({
        key: "city_opening_responses_recorded",
        label: `${profile.shortLabel} city-opening responses recorded`,
        actual: ledgerSummary.trackedCityOpeningResponsesRecorded,
        targetMin: 0,
        targetMax: null,
      }),
      buildMetric({
        key: "city_opening_responses_routed",
        label: `${profile.shortLabel} city-opening responses routed`,
        actual: ledgerSummary.trackedCityOpeningResponsesRouted,
        targetMin: 0,
        targetMax: null,
      }),
      buildMetric({
        key: "reply_conversions_queued",
        label: `${profile.shortLabel} reply conversions queued`,
        actual: ledgerSummary.trackedReplyConversionsQueued,
        targetMin: 0,
        targetMax: null,
      }),
      buildMetric({
        key: "reply_conversions_routed",
        label: `${profile.shortLabel} reply conversions routed`,
        actual: ledgerSummary.trackedReplyConversionsRouted,
        targetMin: 0,
        targetMax: null,
      }),
      buildMetric({
        key: "reply_conversions_blocked",
        label: `${profile.shortLabel} reply conversions blocked`,
        actual: ledgerSummary.trackedReplyConversionsBlocked,
        targetMin: 0,
        targetMax: 0,
        note: "Zero is best. Higher counts indicate reply-conversion friction after city-opening responses arrive.",
      }),
    ],
    demand: [
      buildMetric({
        key: "robot_team_inbound_captured",
        label: `${profile.shortLabel} robot-team inbound captured`,
        actual: derivedMetricActualCounts.robot_team_inbound_captured,
        targetMin: 1,
        targetMax: null,
        note: "Verified from growth_events and city-matching inbound request records.",
      }),
      buildMetric({
        key: "proof_path_assigned",
        label: `${profile.shortLabel} proof paths assigned`,
        actual: derivedMetricActualCounts.proof_path_assigned,
        targetMin: 1,
        targetMax: null,
        note: "Combines growth_events with city-matching proof-path milestone state.",
      }),
      buildMetric({
        key: "proof_packs_delivered",
        label: `${profile.shortLabel} proof packs delivered`,
        actual: derivedMetricActualCounts.proof_pack_delivered,
        targetMin: 1,
        targetMax: null,
        note: "Combines proof-path milestone state with growth_events.",
      }),
      buildMetric({
        key: "hosted_reviews_started",
        label: `${profile.shortLabel} hosted proof reviews started`,
        actual: Math.max(hostedReviewsStarted, eventCounts.hosted_review_started),
        targetMin: 1,
        targetMax: null,
      }),
      buildMetric({
        key: "hosted_follow_ups_sent",
        label: `${profile.shortLabel} hosted-review follow-ups sent`,
        actual: Math.max(hostedFollowUps, eventCounts.hosted_review_follow_up_sent),
        targetMin: 1,
        targetMax: null,
      }),
      buildMetric({
        key: "human_commercial_handoffs",
        label: `${profile.shortLabel} standard-commercial handoffs`,
        actual: Math.max(commercialHandoffs, eventCounts.human_commercial_handoff_started),
        targetMin: 1,
        targetMax: null,
      }),
      buildMetric({
        key: "proof_motion_stalls",
        label: `${profile.shortLabel} proof-motion stalls logged`,
        actual: eventCounts.proof_motion_stalled,
        targetMin: 0,
        targetMax: 0,
        note: "Zero is best. Higher counts indicate blocked proof motion.",
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
      cityThesis: activationPayload?.cityThesis || null,
      primarySiteLane: activationPayload?.primarySiteLane || null,
      primaryWorkflowLane: activationPayload?.primaryWorkflowLane || null,
      primaryBuyerProofPath: activationPayload?.primaryBuyerProofPath || null,
      lawfulAccessModes: activationPayload?.lawfulAccessModes || [],
      validationBlockers:
        activationPayload?.validationBlockers.map((blocker) => ({
          key: blocker.key,
          summary: blocker.summary,
          severity: blocker.severity,
          validationRequired: blocker.validationRequired,
          ownerLane: blocker.ownerLane,
        })) || [],
      metricsDependencies: metricDependencies,
      sourceActivationPayloadPath: research?.artifactPath || null,
    },
    warnings,
    dataSources: [
      "growth_events",
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
