import {
  normalizeDemandCity,
  type DemandCityKey,
} from "./cityDemandMessaging";

type NullableString = string | null | undefined;

export type BuyerChannelSource =
  | "texas_robotics"
  | "founder_intro"
  | "university"
  | "industrial_partner"
  | "bara_matchmaking"
  | "proof_led_event"
  | "partner_referral"
  | "qualified_opportunities"
  | "site_worlds"
  | "organic_search"
  | "linkedin"
  | "twitter_x"
  | "other_referral"
  | "other_event"
  | "other";

export type BuyerChannelSourceCaptureMode =
  | "explicit_query"
  | "self_reported"
  | "utm_fallback"
  | "stored_context"
  | "unknown";

export interface DemandAttribution {
  demandCity: DemandCityKey | null;
  buyerChannelSource: BuyerChannelSource | null;
  buyerChannelSourceCaptureMode: BuyerChannelSourceCaptureMode;
  buyerChannelSourceRaw: string | null;
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    term: string | null;
    content: string | null;
  };
}

type DemandAttributionContext = {
  sourcePageUrl?: NullableString;
  demandCity?: DemandCityKey | null;
  buyerChannelSource?: BuyerChannelSource | null;
  buyerChannelSourceCaptureMode?: BuyerChannelSourceCaptureMode | null;
  buyerChannelSourceRaw?: NullableString;
  utm?: {
    source?: NullableString;
    medium?: NullableString;
    campaign?: NullableString;
    term?: NullableString;
    content?: NullableString;
  } | null;
};

const SOURCE_ALIASES: Record<string, BuyerChannelSource> = {
  texas_robotics: "texas_robotics",
  founder_intro: "founder_intro",
  founder_referral: "founder_intro",
  university: "university",
  industrial_partner: "industrial_partner",
  logistics_partner: "industrial_partner",
  bara: "bara_matchmaking",
  bara_matchmaking: "bara_matchmaking",
  buyer_matchmaking: "bara_matchmaking",
  proof_led_event: "proof_led_event",
  proof_event: "proof_led_event",
  partner_referral: "partner_referral",
  qualified_opportunities: "qualified_opportunities",
  site_worlds: "site_worlds",
  google: "organic_search",
  search: "organic_search",
  organic_search: "organic_search",
  linkedin: "linkedin",
  twitter_x: "twitter_x",
  twitter: "twitter_x",
  x: "twitter_x",
  referral: "other_referral",
  other_referral: "other_referral",
  event: "other_event",
  other_event: "other_event",
  other: "other",
};

function normalizeToken(value: NullableString) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeNullable(value: NullableString) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractUtmFromSearchParams(searchParams: URLSearchParams) {
  return {
    source: normalizeNullable(searchParams.get("utm_source")),
    medium: normalizeNullable(searchParams.get("utm_medium")),
    campaign: normalizeNullable(searchParams.get("utm_campaign")),
    term: normalizeNullable(searchParams.get("utm_term")),
    content: normalizeNullable(searchParams.get("utm_content")),
  };
}

function emptyDemandAttribution(): DemandAttribution {
  return {
    demandCity: null,
    buyerChannelSource: null,
    buyerChannelSourceCaptureMode: "unknown",
    buyerChannelSourceRaw: null,
    utm: {
      source: null,
      medium: null,
      campaign: null,
      term: null,
      content: null,
    },
  };
}

export function normalizeBuyerChannelSource(
  value: NullableString,
): BuyerChannelSource | null {
  const normalized = normalizeToken(value);
  return normalized ? SOURCE_ALIASES[normalized] || null : null;
}

export function getDemandAttributionFromSearchParams(
  searchParams: URLSearchParams,
): DemandAttribution {
  const explicitSource =
    normalizeNullable(searchParams.get("source"))
    || normalizeNullable(searchParams.get("channel"))
    || normalizeNullable(searchParams.get("ref"))
    || normalizeNullable(searchParams.get("referral"));
  const utm = extractUtmFromSearchParams(searchParams);

  const explicitChannelSource = normalizeBuyerChannelSource(explicitSource);
  const utmFallbackRaw = utm.source || utm.campaign || utm.content || null;
  const utmChannelSource = normalizeBuyerChannelSource(utmFallbackRaw);

  return {
    demandCity: normalizeDemandCity(searchParams.get("city")),
    buyerChannelSource: explicitChannelSource || utmChannelSource,
    buyerChannelSourceCaptureMode: explicitChannelSource
      ? "explicit_query"
      : utmChannelSource
        ? "utm_fallback"
        : "unknown",
    buyerChannelSourceRaw: explicitSource || utmFallbackRaw,
    utm,
  };
}

export function overlaySelfReportedBuyerChannelSource(
  attribution: DemandAttribution,
  selfReportedSource: NullableString,
): DemandAttribution {
  const normalizedSource = normalizeBuyerChannelSource(selfReportedSource);
  if (!normalizedSource) {
    return attribution;
  }

  return {
    ...attribution,
    buyerChannelSource: normalizedSource,
    buyerChannelSourceCaptureMode: "self_reported",
    buyerChannelSourceRaw: normalizeNullable(selfReportedSource),
  };
}

export function getDemandAttributionFromContext(
  context: DemandAttributionContext | null | undefined,
): DemandAttribution {
  if (!context) {
    return emptyDemandAttribution();
  }

  const storedUtm = {
    source: normalizeNullable(context.utm?.source),
    medium: normalizeNullable(context.utm?.medium),
    campaign: normalizeNullable(context.utm?.campaign),
    term: normalizeNullable(context.utm?.term),
    content: normalizeNullable(context.utm?.content),
  };

  let parsedAttribution = emptyDemandAttribution();
  if (context.sourcePageUrl) {
    try {
      const url = new URL(context.sourcePageUrl, "https://tryblueprint.io");
      parsedAttribution = getDemandAttributionFromSearchParams(url.searchParams);
    } catch {
      parsedAttribution = emptyDemandAttribution();
    }
  }

  const storedChannelSource =
    context.buyerChannelSource
    || normalizeBuyerChannelSource(context.buyerChannelSourceRaw);

  return {
    demandCity: context.demandCity || parsedAttribution.demandCity,
    buyerChannelSource: storedChannelSource || parsedAttribution.buyerChannelSource,
    buyerChannelSourceCaptureMode: storedChannelSource
      ? context.buyerChannelSourceCaptureMode || "stored_context"
      : parsedAttribution.buyerChannelSourceCaptureMode,
    buyerChannelSourceRaw:
      normalizeNullable(context.buyerChannelSourceRaw)
      || parsedAttribution.buyerChannelSourceRaw,
    utm: {
      source: storedUtm.source || parsedAttribution.utm.source,
      medium: storedUtm.medium || parsedAttribution.utm.medium,
      campaign: storedUtm.campaign || parsedAttribution.utm.campaign,
      term: storedUtm.term || parsedAttribution.utm.term,
      content: storedUtm.content || parsedAttribution.utm.content,
    },
  };
}

export function hasDemandAttribution(
  attribution: DemandAttribution | null | undefined,
) {
  return Boolean(
    attribution?.demandCity
      || attribution?.buyerChannelSource
      || attribution?.utm.source
      || attribution?.utm.medium
      || attribution?.utm.campaign
      || attribution?.utm.content,
  );
}
