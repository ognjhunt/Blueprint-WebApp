import type { SiteCategory, SiteWorldCard } from "@/data/siteWorlds";
import { buildContactRequestUrl } from "@/lib/contactRequestPrefill";

export type CatalogSuggestionKind =
  | "site"
  | "site_code"
  | "address"
  | "city"
  | "category"
  | "industry"
  | "workflow"
  | "robot_fit"
  | "object"
  | "alias"
  | "example";

export type CatalogResultType = "exact" | "nearby" | "category" | "request";

export type CatalogSearchSuggestion = {
  id: string;
  kind: CatalogSuggestionKind;
  resultType: CatalogResultType;
  label: string;
  value: string;
  description: string;
  matchedField: string;
  siteId?: string;
  category?: Exclude<SiteCategory, "All">;
  workflow?: string;
  siteLocation?: string;
  targetSiteType?: string;
};

export type CatalogRequestCandidate = {
  query: string;
  headline: string;
  body: string;
  siteName: string;
  siteLocation: string;
  targetSiteType: string;
  taskStatement: string;
  href: string;
};

export type CatalogSearchClassification = {
  query: string;
  exactMatches: SiteWorldCard[];
  nearbyMatches: SiteWorldCard[];
  categoryMatches: SiteWorldCard[];
  closestMatches: SiteWorldCard[];
  requestCandidate: CatalogRequestCandidate | null;
  noExactMatch: boolean;
  primaryResultType: CatalogResultType | "all";
};

export const CATALOG_EXAMPLE_QUERIES = [
  "Whole Foods",
  "grocery store",
  "retail aisle",
  "warehouse tote",
  "hospital supply",
  "lab",
  "Atlanta",
  "Chicago",
];

const KNOWN_OBJECT_TERMS = [
  "airlock",
  "bag",
  "barcode",
  "battery",
  "belt",
  "bench",
  "bin",
  "box",
  "cart",
  "case",
  "checkout",
  "corridor",
  "dock",
  "fixture",
  "item",
  "lane",
  "package",
  "pallet",
  "parcel",
  "rack",
  "room",
  "shelf",
  "station",
  "table",
  "tote",
  "tray",
];

const HUMAN_ALIAS_RULES: Array<{
  aliases: string[];
  category?: Exclude<SiteCategory, "All">;
  targetSiteType: string;
  workflow: string;
}> = [
  {
    aliases: ["whole foods", "kroger", "supermarket", "grocery store", "grocer", "grocery"],
    category: "Retail",
    targetSiteType: "grocery store",
    workflow: "retail shelf, backroom, and replenishment workflows",
  },
  {
    aliases: ["store", "retail aisle", "retail shelf", "checkout", "restock"],
    category: "Retail",
    targetSiteType: "retail aisle",
    workflow: "shelf inspection, restock, and pick-place workflows",
  },
  {
    aliases: ["warehouse", "warehouse tote", "distribution center", "depot", "pallet", "tote"],
    category: "Logistics",
    targetSiteType: "warehouse or fulfillment lane",
    workflow: "tote, pallet, parcel, and dock transfer workflows",
  },
  {
    aliases: ["fulfillment center", "micro fulfillment", "micro-fulfillment", "backroom"],
    category: "Logistics",
    targetSiteType: "fulfillment or retail backroom",
    workflow: "pick, pack, tote, and transfer workflows",
  },
  {
    aliases: ["hospital supply", "supply room", "hospital"],
    category: "Healthcare",
    targetSiteType: "hospital supply room",
    workflow: "cart restock, supply return, and corridor workflows",
  },
  {
    aliases: ["pharmacy"],
    category: "Healthcare",
    targetSiteType: "pharmacy",
    workflow: "refill, secure bin, barcode, and audit workflows",
  },
  {
    aliases: ["lab", "electronics repair", "rework lab", "bench cell"],
    category: "Manufacturing",
    targetSiteType: "lab or electronics rework bench",
    workflow: "bench, tray, test, and precision manipulation workflows",
  },
  {
    aliases: ["cold storage", "cold chain", "chilled"],
    category: "Cold Chain",
    targetSiteType: "cold storage or chilled pick room",
    workflow: "cold-room pick, airlock, and temperature-sensitive workflows",
  },
];

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: unknown) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function extractCatalogLocationParts(siteAddress: string) {
  const address = String(siteAddress || "").trim();
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const stateZip = parts[parts.length - 1] || "";
  const stateMatch = stateZip.match(/\b([A-Z]{2})\b/);
  return {
    city: parts.length >= 2 ? parts[parts.length - 2] : "",
    state: stateMatch?.[1] || "",
  };
}

export function getCatalogLocationLabel(site: SiteWorldCard) {
  const parts = extractCatalogLocationParts(site.siteAddress);
  return [parts.city, parts.state].filter(Boolean).join(", ") || site.siteAddress;
}

function inferSiteAliases(site: SiteWorldCard) {
  const haystack = normalizeText([
    site.category,
    site.industry,
    site.thumbnailKind,
    site.taskLane,
    site.summary,
    site.bestFor,
    site.sampleTask,
  ].join(" "));
  const aliases: string[] = [];

  for (const rule of HUMAN_ALIAS_RULES) {
    if (rule.category === site.category) {
      aliases.push(...rule.aliases);
      continue;
    }

    if (rule.aliases.some((alias) => haystack.includes(normalizeText(alias)))) {
      aliases.push(...rule.aliases);
    }
  }

  return unique(aliases);
}

function collectObjectTags(site: SiteWorldCard) {
  const explicit = [
    ...(site.artifactExplorer?.objects || []).flatMap((item) => [
      item.id,
      item.label,
      item.taskRole,
      item.groundingLevel,
    ]),
  ];
  const haystack = normalizeText([
    site.siteName,
    site.industry,
    site.taskLane,
    site.summary,
    site.bestFor,
    site.sampleTask,
    site.thumbnailKind,
    site.exportArtifacts.join(" "),
  ].join(" "));
  const inferred = KNOWN_OBJECT_TERMS.filter((term) => haystack.includes(term));
  return unique([...explicit, ...inferred].map(normalizeText).filter(Boolean));
}

function aliasRuleForQuery(query: string) {
  const normalizedQuery = normalizeText(query);
  return HUMAN_ALIAS_RULES.find((rule) =>
    rule.aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);
      return normalizedAlias && (
        normalizedQuery.includes(normalizedAlias) ||
        normalizedAlias.includes(normalizedQuery)
      );
    }),
  );
}

function fieldsForSite(site: SiteWorldCard) {
  const location = getCatalogLocationLabel(site);
  const objectTags = collectObjectTags(site);
  const aliases = inferSiteAliases(site);

  return [
    {
      kind: "site" as const,
      resultType: "exact" as const,
      matchedField: "siteName",
      label: site.siteName,
      value: site.siteName,
      description: `${site.category} / ${location}`,
      siteId: site.id,
      category: site.category,
      workflow: site.taskLane,
      siteLocation: site.siteAddress,
      targetSiteType: site.industry,
    },
    {
      kind: "site_code" as const,
      resultType: "exact" as const,
      matchedField: "siteCode",
      label: site.siteCode,
      value: site.siteCode,
      description: `${site.siteName} catalog code`,
      siteId: site.id,
      category: site.category,
      workflow: site.taskLane,
      siteLocation: site.siteAddress,
      targetSiteType: site.industry,
    },
    {
      kind: "address" as const,
      resultType: "exact" as const,
      matchedField: "address",
      label: site.siteAddress,
      value: site.siteAddress,
      description: `${site.siteName} address`,
      siteId: site.id,
      category: site.category,
      workflow: site.taskLane,
      siteLocation: site.siteAddress,
      targetSiteType: site.industry,
    },
    {
      kind: "city" as const,
      resultType: "nearby" as const,
      matchedField: "city",
      label: location,
      value: location,
      description: `Catalog listings near ${location}`,
      category: site.category,
      workflow: site.taskLane,
      siteLocation: location,
      targetSiteType: site.industry,
    },
    {
      kind: "category" as const,
      resultType: "category" as const,
      matchedField: "category",
      label: site.category,
      value: site.category,
      description: `${site.category} catalog profiles`,
      category: site.category,
      workflow: site.taskLane,
      targetSiteType: site.category,
    },
    {
      kind: "industry" as const,
      resultType: "category" as const,
      matchedField: "industry",
      label: site.industry,
      value: site.industry,
      description: `${site.category} / ${site.taskLane}`,
      category: site.category,
      workflow: site.taskLane,
      targetSiteType: site.industry,
    },
    {
      kind: "workflow" as const,
      resultType: "category" as const,
      matchedField: "taskLane",
      label: site.taskLane,
      value: site.taskLane,
      description: `${site.siteName} workflow lane`,
      siteId: site.id,
      category: site.category,
      workflow: site.taskLane,
      targetSiteType: site.industry,
    },
    {
      kind: "robot_fit" as const,
      resultType: "category" as const,
      matchedField: "bestFor",
      label: site.bestFor,
      value: site.bestFor,
      description: `${site.siteName} robot fit`,
      siteId: site.id,
      category: site.category,
      workflow: site.taskLane,
      targetSiteType: site.industry,
    },
    ...objectTags.map((tag) => ({
      kind: "object" as const,
      resultType: "category" as const,
      matchedField: "objectTags",
      label: tag,
      value: tag,
      description: `${site.siteName} object or cue`,
      siteId: site.id,
      category: site.category,
      workflow: site.taskLane,
      targetSiteType: site.industry,
    })),
    ...aliases.map((alias) => ({
      kind: "alias" as const,
      resultType: "category" as const,
      matchedField: "alias",
      label: alias,
      value: alias,
      description: `${alias} maps to ${site.category.toLowerCase()} catalog matches`,
      category: site.category,
      workflow: site.taskLane,
      targetSiteType: site.industry,
    })),
  ];
}

function suggestionScore(
  suggestion: Omit<CatalogSearchSuggestion, "id">,
  normalizedQuery: string,
  queryTokens: string[],
) {
  const value = normalizeText(`${suggestion.label} ${suggestion.value}`);
  if (!normalizedQuery) return 1;
  if (value === normalizedQuery) return 100;
  if (value.startsWith(normalizedQuery)) return 90;
  if (value.includes(normalizedQuery)) return 78;
  const valueTokens = tokenize(value);
  const overlap = queryTokens.filter((token) => valueTokens.some((item) => item.includes(token) || token.includes(item))).length;
  const overlapScore = overlap > 0 ? (overlap / Math.max(queryTokens.length, 1)) * 55 : 0;
  const kindBoost = suggestion.kind === "site" || suggestion.kind === "address" ? 10 : 0;
  return overlapScore + kindBoost;
}

export function buildCatalogSearchSuggestions(
  sites: SiteWorldCard[],
  query: string,
  limit = 8,
): CatalogSearchSuggestion[] {
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);

  if (!normalizedQuery) {
    return CATALOG_EXAMPLE_QUERIES.slice(0, limit).map((example) => {
      const rule = aliasRuleForQuery(example);
      return {
        id: `example:${normalizeText(example)}`,
        kind: "example",
        resultType: "request",
        label: example,
        value: example,
        description: rule
          ? `Try ${rule.targetSiteType} and request it if no exact scanned site appears`
          : "Try a city, address, workflow, or robot task",
        matchedField: "example",
        category: rule?.category,
        workflow: rule?.workflow,
        targetSiteType: rule?.targetSiteType,
      };
    });
  }

  const suggestions = sites
    .flatMap(fieldsForSite)
    .map((suggestion) => ({
      suggestion,
      score: suggestionScore(suggestion, normalizedQuery, queryTokens),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.suggestion.label.localeCompare(right.suggestion.label));

  const seen = new Set<string>();
  const deduped: CatalogSearchSuggestion[] = [];
  for (const item of suggestions) {
    const key = `${item.suggestion.kind}:${normalizeText(item.suggestion.label)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({
      id: key,
      ...item.suggestion,
    });
    if (deduped.length >= limit) break;
  }

  return deduped;
}

function siteMatchesExact(site: SiteWorldCard, normalizedQuery: string) {
  if (!normalizedQuery) return false;
  const normalizedName = normalizeText(site.siteName);
  const normalizedCode = normalizeText(site.siteCode);
  const normalizedAddress = normalizeText(site.siteAddress);
  const addressSpecificQuery =
    /\d/.test(normalizedQuery) ||
    /\b(st|street|ave|avenue|road|rd|blvd|boulevard|dr|drive|lane|ln|way|pkwy|parkway)\b/.test(normalizedQuery);

  return (
    normalizedName === normalizedQuery ||
    normalizedName.includes(normalizedQuery) ||
    normalizedCode === normalizedQuery ||
    normalizedCode.includes(normalizedQuery) ||
    normalizedAddress === normalizedQuery ||
    (addressSpecificQuery && normalizedAddress.includes(normalizedQuery))
  );
}

function siteMatchesLocation(site: SiteWorldCard, queryTokens: string[]) {
  if (!queryTokens.length) return false;
  const location = extractCatalogLocationParts(site.siteAddress);
  const locationTokens = tokenize([site.siteAddress, location.city, location.state].join(" "));
  return queryTokens.some((token) => locationTokens.includes(token));
}

function siteMatchesCategory(site: SiteWorldCard, query: string, queryTokens: string[]) {
  if (!queryTokens.length) return false;
  const aliasRule = aliasRuleForQuery(query);
  if (aliasRule?.category && site.category === aliasRule.category) return true;

  const objectTags = collectObjectTags(site);
  const haystack = normalizeText([
    site.category,
    site.industry,
    site.thumbnailKind,
    site.taskLane,
    site.summary,
    site.bestFor,
    site.sampleTask,
    site.sampleRobot,
    objectTags.join(" "),
    inferSiteAliases(site).join(" "),
  ].join(" "));

  return queryTokens.some((token) => haystack.includes(token));
}

function buildRequestHref(candidate: Omit<CatalogRequestCandidate, "href" | "headline" | "body">) {
  return buildContactRequestUrl({
    requestPath: "new-capture",
    buyerType: "robot_team",
    source: "site-worlds",
    proofPathPreference: "exact_site_required",
    requestedOutputs: "Site package, readiness report, and policy evaluation set scoping",
    query: candidate.query,
    siteName: candidate.siteName,
    siteLocation: candidate.siteLocation,
    targetSiteType: candidate.targetSiteType,
    workflow: candidate.taskStatement,
    taskStatement: candidate.taskStatement,
  });
}

export function buildCatalogRequestCandidate(
  query: string,
  suggestion?: CatalogSearchSuggestion | null,
): CatalogRequestCandidate | null {
  const trimmedQuery = String(query || "").trim();
  if (!trimmedQuery) return null;

  const aliasRule = aliasRuleForQuery(trimmedQuery);
  const targetSiteType =
    suggestion?.targetSiteType ||
    aliasRule?.targetSiteType ||
    suggestion?.category ||
    "";
  const workflow = suggestion?.workflow || aliasRule?.workflow || "";
  const siteName =
    suggestion?.kind === "site" || suggestion?.kind === "site_code"
      ? suggestion.label
      : trimmedQuery;
  const siteLocation =
    suggestion?.kind === "address" || suggestion?.kind === "city"
      ? suggestion.value
      : suggestion?.siteLocation || trimmedQuery;
  const taskStatement = [
    `Request an exact-site readiness evaluation for ${trimmedQuery}.`,
    workflow ? `Workflow: ${workflow}.` : "",
    targetSiteType ? `Site class: ${targetSiteType}.` : "",
  ].filter(Boolean).join(" ");
  const candidate = {
    query: trimmedQuery,
    siteName,
    siteLocation,
    targetSiteType,
    taskStatement,
  };

  return {
    ...candidate,
    headline: "No scanned package for this exact place yet",
    body:
      "Blueprint can still route the site, address, or workflow into capture review. This request does not imply the site has been scanned, cleared, purchased, or hosted.",
    href: buildRequestHref(candidate),
  };
}

export function classifyCatalogSearch(
  sites: SiteWorldCard[],
  query: string,
  selectedSuggestion?: CatalogSearchSuggestion | null,
): CatalogSearchClassification {
  const normalizedQuery = normalizeText(query);
  const queryTokens = tokenize(query);

  if (!normalizedQuery) {
    return {
      query: "",
      exactMatches: [],
      nearbyMatches: [],
      categoryMatches: [],
      closestMatches: [],
      requestCandidate: null,
      noExactMatch: false,
      primaryResultType: "all",
    };
  }

  const selectedExact = selectedSuggestion?.siteId && selectedSuggestion.resultType === "exact"
    ? sites.filter((site) => site.id === selectedSuggestion.siteId)
    : [];
  const exactMatches = unique([
    ...selectedExact,
    ...sites.filter((site) => siteMatchesExact(site, normalizedQuery)),
  ]);
  const nearbyMatches = exactMatches.length > 0
    ? []
    : sites.filter((site) => siteMatchesLocation(site, queryTokens));
  const categoryMatches = sites.filter((site) =>
    !exactMatches.includes(site) &&
    !nearbyMatches.includes(site) &&
    siteMatchesCategory(site, query, queryTokens),
  );
  const closestMatches = unique([
    ...nearbyMatches,
    ...categoryMatches,
  ]).slice(0, 6);
  const noExactMatch = exactMatches.length === 0;

  return {
    query: String(query || "").trim(),
    exactMatches,
    nearbyMatches,
    categoryMatches,
    closestMatches,
    requestCandidate: noExactMatch
      ? buildCatalogRequestCandidate(query, selectedSuggestion)
      : null,
    noExactMatch,
    primaryResultType:
      exactMatches.length > 0
        ? "exact"
        : nearbyMatches.length > 0
          ? "nearby"
          : categoryMatches.length > 0
            ? "category"
            : "request",
  };
}
