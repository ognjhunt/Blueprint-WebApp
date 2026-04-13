import { promises as fs } from "node:fs";
import path from "node:path";
import { slugifyCityName } from "./cityLaunchProfiles";
import type {
  CityLaunchBudgetCategory,
  CityLaunchBuyerTargetStatus,
  CityLaunchProspectStatus,
  CityLaunchResearchProvenance,
  CityLaunchTouchStatus,
  CityLaunchTouchType,
} from "./cityLaunchLedgers";

export const CITY_LAUNCH_RESEARCH_SCHEMA_VERSION = "2026-04-12.city-launch-research.v1";

type StructuredCaptureCandidate = {
  name: string;
  sourceBucket: string;
  channel: string;
  status: CityLaunchProspectStatus;
  siteAddress: string | null;
  locationSummary: string | null;
  lat: number | null;
  lng: number | null;
  siteCategory: string | null;
  workflowFit: string | null;
  priorityNote: string | null;
  sourceUrls: string[];
  explicitFields: string[];
  inferredFields: string[];
};

type StructuredBuyerTarget = {
  companyName: string;
  contactName: string | null;
  status: CityLaunchBuyerTargetStatus;
  workflowFit: string | null;
  proofPath: string | null;
  notes: string | null;
  sourceBucket: string | null;
  sourceUrls: string[];
  explicitFields: string[];
  inferredFields: string[];
};

type StructuredFirstTouch = {
  referenceType: "prospect" | "buyer_target" | "general";
  referenceName: string | null;
  channel: string;
  touchType: CityLaunchTouchType;
  status: CityLaunchTouchStatus;
  campaignId: string | null;
  issueId: string | null;
  notes: string | null;
  sourceUrls: string[];
  explicitFields: string[];
  inferredFields: string[];
};

type StructuredBudgetRecommendation = {
  category: CityLaunchBudgetCategory;
  amountUsd: number;
  note: string | null;
  sourceUrls: string[];
  explicitFields: string[];
  inferredFields: string[];
};

export type ParsedCityLaunchCaptureCandidate = StructuredCaptureCandidate & {
  stableKey: string;
  provenance: CityLaunchResearchProvenance;
};

export type ParsedCityLaunchBuyerTarget = StructuredBuyerTarget & {
  stableKey: string;
  provenance: CityLaunchResearchProvenance;
};

export type ParsedCityLaunchFirstTouch = StructuredFirstTouch & {
  stableKey: string;
  provenance: CityLaunchResearchProvenance;
};

export type ParsedCityLaunchBudgetRecommendation = StructuredBudgetRecommendation & {
  stableKey: string;
  provenance: CityLaunchResearchProvenance;
};

export type CityLaunchResearchParseResult = {
  city: string;
  citySlug: string;
  artifactPath: string;
  schemaVersion: string;
  generatedAtIso: string | null;
  captureCandidates: ParsedCityLaunchCaptureCandidate[];
  buyerTargets: ParsedCityLaunchBuyerTarget[];
  firstTouches: ParsedCityLaunchFirstTouch[];
  budgetRecommendations: ParsedCityLaunchBudgetRecommendation[];
  warnings: string[];
};

type StructuredArtifactShape = {
  schema_version?: unknown;
  generated_at?: unknown;
  capture_location_candidates?: unknown;
  buyer_target_candidates?: unknown;
  first_touch_candidates?: unknown;
  budget_recommendations?: unknown;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown) {
  const normalized = asString(value);
  return normalized || null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown) {
  return asArray(value)
    .map((entry) => asString(entry))
    .filter(Boolean);
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  const normalized = asString(value) as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

function normalizeStableToken(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildStableKey(prefix: string, parts: Array<string | null | undefined>) {
  const normalized = parts
    .map((part) => normalizeStableToken(part))
    .filter(Boolean)
    .join("-");
  return `${prefix}_${normalized || "unknown"}`;
}

function buildProvenance(input: {
  artifactPath: string;
  sourceKey: string;
  sourceUrls: string[];
  explicitFields: string[];
  inferredFields: string[];
}) {
  return {
    sourceType: "deep_research_playbook",
    artifactPath: path.resolve(input.artifactPath),
    sourceKey: input.sourceKey,
    sourceUrls: input.sourceUrls,
    parsedAtIso: new Date().toISOString(),
    explicitFields: input.explicitFields,
    inferredFields: input.inferredFields,
  } satisfies CityLaunchResearchProvenance;
}

function extractStructuredJson(markdown: string) {
  const codeFencePattern = /```(?:city-launch-records|json)\s*([\s\S]*?)```/gi;
  const matches = [...markdown.matchAll(codeFencePattern)];

  for (const match of matches.reverse()) {
    const candidate = match[1]?.trim();
    if (!candidate) {
      continue;
    }
    try {
      const parsed = JSON.parse(candidate) as StructuredArtifactShape;
      const schemaVersion = asString(parsed.schema_version);
      if (schemaVersion === CITY_LAUNCH_RESEARCH_SCHEMA_VERSION) {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function parseCaptureCandidates(
  citySlug: string,
  artifactPath: string,
  raw: unknown,
) {
  return asArray(raw)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const name = asString(record.name || record.site_name || record.company_name);
      const sourceBucket = asString(record.source_bucket);
      const channel = asString(record.channel);
      if (!name || !sourceBucket || !channel) {
        return null;
      }
      const explicitFields = asStringArray(record.explicit_fields);
      const inferredFields = asStringArray(record.inferred_fields);
      const stableKey = buildStableKey(`prospect_${citySlug}`, [
        sourceBucket,
        name,
        asOptionalString(record.site_address) || asOptionalString(record.location_summary) || asOptionalString(record.workflow_fit),
      ]);

      return {
        stableKey,
        name,
        sourceBucket,
        channel,
        status: pickEnum(record.status, [
          "identified",
          "contacted",
          "responded",
          "qualified",
          "approved",
          "onboarded",
          "capturing",
          "inactive",
        ] as const, "identified"),
        siteAddress: asOptionalString(record.site_address),
        locationSummary: asOptionalString(record.location_summary),
        lat: asNumber(record.lat),
        lng: asNumber(record.lng),
        siteCategory: asOptionalString(record.site_category),
        workflowFit: asOptionalString(record.workflow_fit),
        priorityNote: asOptionalString(record.priority_note || record.why_now),
        sourceUrls: asStringArray(record.source_urls),
        explicitFields,
        inferredFields,
        provenance: buildProvenance({
          artifactPath,
          sourceKey: `capture_location_candidates[${index}]`,
          sourceUrls: asStringArray(record.source_urls),
          explicitFields,
          inferredFields,
        }),
      } satisfies ParsedCityLaunchCaptureCandidate;
    })
    .filter((entry): entry is ParsedCityLaunchCaptureCandidate => Boolean(entry));
}

function parseBuyerTargets(
  citySlug: string,
  artifactPath: string,
  raw: unknown,
) {
  return asArray(raw)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const companyName = asString(record.company_name);
      if (!companyName) {
        return null;
      }
      const explicitFields = asStringArray(record.explicit_fields);
      const inferredFields = asStringArray(record.inferred_fields);
      const stableKey = buildStableKey(`buyer_target_${citySlug}`, [
        companyName,
        asOptionalString(record.workflow_fit),
      ]);

      return {
        stableKey,
        companyName,
        contactName: asOptionalString(record.contact_name),
        status: pickEnum(record.status, [
          "identified",
          "researched",
          "queued",
          "contacted",
          "engaged",
          "hosted_review",
          "commercial_handoff",
          "closed_won",
          "closed_lost",
        ] as const, "researched"),
        workflowFit: asOptionalString(record.workflow_fit),
        proofPath: asOptionalString(record.proof_path),
        notes: asOptionalString(record.notes || record.why_now),
        sourceBucket: asOptionalString(record.source_bucket),
        sourceUrls: asStringArray(record.source_urls),
        explicitFields,
        inferredFields,
        provenance: buildProvenance({
          artifactPath,
          sourceKey: `buyer_target_candidates[${index}]`,
          sourceUrls: asStringArray(record.source_urls),
          explicitFields,
          inferredFields,
        }),
      } satisfies ParsedCityLaunchBuyerTarget;
    })
    .filter((entry): entry is ParsedCityLaunchBuyerTarget => Boolean(entry));
}

function parseFirstTouches(
  citySlug: string,
  artifactPath: string,
  raw: unknown,
) {
  return asArray(raw)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const channel = asString(record.channel);
      if (!channel) {
        return null;
      }
      const referenceType = pickEnum(record.reference_type, ["prospect", "buyer_target", "general"] as const, "general");
      const referenceName = asOptionalString(record.reference_name);
      const explicitFields = asStringArray(record.explicit_fields);
      const inferredFields = asStringArray(record.inferred_fields);
      const stableKey = buildStableKey(`touch_${citySlug}`, [
        referenceType,
        referenceName,
        channel,
        asOptionalString(record.touch_type),
      ]);

      return {
        stableKey,
        referenceType,
        referenceName,
        channel,
        touchType: pickEnum(record.touch_type, [
          "first_touch",
          "follow_up",
          "approval_request",
          "intro",
          "operator_send",
        ] as const, "first_touch"),
        status: pickEnum(record.status, [
          "draft",
          "queued",
          "sent",
          "delivered",
          "replied",
          "failed",
        ] as const, "queued"),
        campaignId: asOptionalString(record.campaign_id),
        issueId: asOptionalString(record.issue_id),
        notes: asOptionalString(record.notes),
        sourceUrls: asStringArray(record.source_urls),
        explicitFields,
        inferredFields,
        provenance: buildProvenance({
          artifactPath,
          sourceKey: `first_touch_candidates[${index}]`,
          sourceUrls: asStringArray(record.source_urls),
          explicitFields,
          inferredFields,
        }),
      } satisfies ParsedCityLaunchFirstTouch;
    })
    .filter((entry): entry is ParsedCityLaunchFirstTouch => Boolean(entry));
}

function parseBudgetRecommendations(
  citySlug: string,
  artifactPath: string,
  raw: unknown,
) {
  return asArray(raw)
    .map((entry, index) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }
      const amountUsd = asNumber(record.amount_usd);
      const category = pickEnum(record.category, [
        "creative",
        "outbound",
        "community",
        "field_ops",
        "travel",
        "tools",
        "other",
      ] as const, "other");
      if (amountUsd === null) {
        return null;
      }
      const explicitFields = asStringArray(record.explicit_fields);
      const inferredFields = asStringArray(record.inferred_fields);
      const stableKey = buildStableKey(`budget_${citySlug}`, [
        category,
        String(amountUsd),
        asOptionalString(record.note),
      ]);

      return {
        stableKey,
        category,
        amountUsd,
        note: asOptionalString(record.note),
        sourceUrls: asStringArray(record.source_urls),
        explicitFields,
        inferredFields,
        provenance: buildProvenance({
          artifactPath,
          sourceKey: `budget_recommendations[${index}]`,
          sourceUrls: asStringArray(record.source_urls),
          explicitFields,
          inferredFields,
        }),
      } satisfies ParsedCityLaunchBudgetRecommendation;
    })
    .filter((entry): entry is ParsedCityLaunchBudgetRecommendation => Boolean(entry));
}

export function parseCityLaunchResearchArtifact(input: {
  city: string;
  artifactPath: string;
  markdown: string;
}) {
  const city = input.city.trim();
  const citySlug = slugifyCityName(city);
  const structured = extractStructuredJson(input.markdown);
  const warnings: string[] = [];

  if (!structured) {
    warnings.push(
      "No structured city-launch research appendix was found. Refresh the deep-research playbook with the current harness prompt before materializing.",
    );
    return {
      city,
      citySlug,
      artifactPath: path.resolve(input.artifactPath),
      schemaVersion: CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
      generatedAtIso: null,
      captureCandidates: [],
      buyerTargets: [],
      firstTouches: [],
      budgetRecommendations: [],
      warnings,
    } satisfies CityLaunchResearchParseResult;
  }

  return {
    city,
    citySlug,
    artifactPath: path.resolve(input.artifactPath),
    schemaVersion: asString(structured.schema_version) || CITY_LAUNCH_RESEARCH_SCHEMA_VERSION,
    generatedAtIso: asOptionalString(structured.generated_at),
    captureCandidates: parseCaptureCandidates(citySlug, input.artifactPath, structured.capture_location_candidates),
    buyerTargets: parseBuyerTargets(citySlug, input.artifactPath, structured.buyer_target_candidates),
    firstTouches: parseFirstTouches(citySlug, input.artifactPath, structured.first_touch_candidates),
    budgetRecommendations: parseBudgetRecommendations(citySlug, input.artifactPath, structured.budget_recommendations),
    warnings,
  } satisfies CityLaunchResearchParseResult;
}

export async function loadAndParseCityLaunchResearchArtifact(input: {
  city: string;
  artifactPath: string;
}) {
  const markdown = await fs.readFile(input.artifactPath, "utf8");
  return parseCityLaunchResearchArtifact({
    city: input.city,
    artifactPath: input.artifactPath,
    markdown,
  });
}
