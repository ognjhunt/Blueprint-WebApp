import type { SiteWorldCard } from "../../client/src/data/siteWorlds";
import { embedTexts } from "./embeddings";
import { listPublicSiteWorlds } from "../utils/site-worlds";

export type SiteWorldSearchSort =
  | "relevance"
  | "name"
  | "city"
  | "category"
  | "readiness"
  | "availability";

export type SiteWorldSearchFilters = {
  category?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  siteType?: string | null;
  taskLane?: string | null;
  objectTags?: string[];
  robot?: string | null;
  availability?: string | null;
  readiness?: string | null;
  sort?: SiteWorldSearchSort;
};

export type SiteWorldSearchResult = {
  siteWorld: SiteWorldCard;
  score: number;
  reasons: string[];
  matchedAliases: string[];
  matchedFields: string[];
};

export type SiteWorldSearchMatchSemantics = {
  exactMatch: boolean;
  noExactScannedPackage: boolean;
  message: string;
  truthBoundary: string;
};

export type SiteWorldSearchRequestCandidate = {
  buyerType: "robot_team";
  source: "site-worlds";
  requestPath: "new-capture";
  requestUrl: string;
  query: string;
  siteName: string;
  siteLocation: string;
  targetSiteType: string;
  workflow: string;
  taskStatement: string;
  requestedOutputs: string;
  proofPathPreference: "exact_site_required";
  inboundRequestDraft: {
    buyerType: "robot_team";
    commercialRequestPath: "capture_access";
    requestedLanes: ["deeper_evaluation"];
    siteName: string;
    siteLocation: string;
    targetSiteType?: string;
    taskStatement: string;
    proofPathPreference: "exact_site_required";
    workflowContext?: string;
    details?: string;
    context: {
      sourcePageUrl: string;
      buyerChannelSourceRaw: "site-worlds";
      utm: Record<string, never>;
    };
  };
};

export type SiteWorldSearchResponse = {
  query: string;
  results: SiteWorldSearchResult[];
  parsed: {
    q: string;
    tokens: string[];
    aliases: ParsedSiteWorldAlias[];
    filters: SiteWorldSearchFilters;
  };
  appliedFilters: SiteWorldSearchFilters;
  matchSemantics: SiteWorldSearchMatchSemantics;
  requestCandidate: SiteWorldSearchRequestCandidate | null;
  warnings: string[];
  meta: {
    backend: "firestore-live" | "static-fallback";
    embeddingModel: string;
    usedEmbeddings: boolean;
    totalCandidates: number;
    returned: number;
  };
};

type SiteWorldField = {
  field: string;
  value: string;
};

type SiteWorldSearchCandidate = {
  siteWorld: SiteWorldCard;
  fields: SiteWorldField[];
  searchDoc: string;
  tokens: string[];
  city: string | null;
  state: string | null;
  objectTags: string[];
  availability: string;
  readiness: string;
  embedding: number[] | null;
};

type SiteWorldAliasRule = {
  aliases: string[];
  label: string;
  categories?: string[];
  industries?: string[];
  siteTypes?: string[];
  objectTags?: string[];
  terms?: string[];
  truthNote?: string;
};

export type ParsedSiteWorldAlias = {
  alias: string;
  mapsTo: string;
  categories: string[];
  industries: string[];
  siteTypes: string[];
  objectTags: string[];
  terms: string[];
  truthNote?: string;
};

const DEFAULT_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "around",
  "at",
  "be",
  "by",
  "catalog",
  "close",
  "for",
  "from",
  "get",
  "i",
  "in",
  "me",
  "near",
  "need",
  "of",
  "on",
  "or",
  "please",
  "show",
  "site",
  "sites",
  "the",
  "to",
  "with",
  "world",
  "worlds",
]);

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

const GENERIC_SITE_NAME_TOKENS = new Set([
  "aisle",
  "annex",
  "backroom",
  "center",
  "distribution",
  "facility",
  "fulfillment",
  "grocery",
  "hospital",
  "lab",
  "lane",
  "logistics",
  "retail",
  "room",
  "store",
  "supermarket",
  "warehouse",
]);

const SITE_WORLD_ALIAS_RULES: SiteWorldAliasRule[] = [
  {
    aliases: ["whole foods"],
    label: "whole foods -> grocery retail",
    categories: ["Retail"],
    industries: ["grocery", "retail", "food distribution", "retail backroom"],
    siteTypes: ["grocery", "supermarket", "retail aisle", "retail shelf"],
    objectTags: ["shelf", "tote", "case"],
    terms: ["grocery", "retail", "shelf", "replenishment", "backroom"],
    truthNote: "closest grocery/retail match; no exact Whole Foods availability is implied",
  },
  {
    aliases: ["kroger"],
    label: "kroger -> grocery retail",
    categories: ["Retail"],
    industries: ["grocery", "retail", "food distribution", "retail backroom"],
    siteTypes: ["grocery", "supermarket", "retail aisle", "retail shelf"],
    objectTags: ["shelf", "tote", "case"],
    terms: ["grocery", "retail", "shelf", "replenishment", "backroom"],
    truthNote: "closest grocery/retail match; no exact Kroger availability is implied",
  },
  {
    aliases: ["store", "supermarket", "grocery store", "grocer"],
    label: "store -> grocery retail",
    categories: ["Retail"],
    industries: ["grocery", "retail", "food distribution", "retail backroom", "micro-fulfillment"],
    siteTypes: ["grocery", "supermarket", "retail aisle", "retail shelf", "store"],
    objectTags: ["shelf", "checkout", "tote", "case"],
    terms: ["grocery", "retail", "shelf", "replenishment", "aisle", "fulfillment"],
  },
  {
    aliases: ["retail aisle", "retail shelf", "checkout", "restock"],
    label: "retail aisle/restock -> retail",
    categories: ["Retail"],
    industries: ["retail", "retail backroom", "micro-fulfillment"],
    siteTypes: ["retail aisle", "retail shelf", "store"],
    objectTags: ["shelf", "checkout", "tote", "case"],
    terms: ["aisle", "shelf", "restock", "replenishment", "pick"],
  },
  {
    aliases: ["warehouse", "distribution center", "depot", "pallet"],
    label: "warehouse -> logistics",
    categories: ["Logistics"],
    industries: ["parcel logistics", "airport handling", "warehouse", "distribution"],
    siteTypes: ["warehouse", "distribution center", "depot"],
    objectTags: ["pallet", "tote", "parcel", "rack", "dock"],
    terms: ["logistics", "parcel", "induct", "transfer", "lane", "dock", "pallet"],
  },
  {
    aliases: ["fulfillment center", "micro fulfillment", "micro-fulfillment", "backroom", "tote"],
    label: "fulfillment/backroom/tote -> logistics retail",
    categories: ["Logistics", "Retail"],
    industries: ["micro-fulfillment", "parcel logistics", "retail backroom"],
    siteTypes: ["fulfillment center", "warehouse", "retail backroom"],
    objectTags: ["tote", "bin", "parcel", "shelf"],
    terms: ["fulfillment", "tote", "pack", "pick", "transfer", "backroom"],
  },
  {
    aliases: ["pharmacy"],
    label: "pharmacy -> healthcare",
    categories: ["Healthcare"],
    industries: ["pharmacy"],
    siteTypes: ["pharmacy"],
    objectTags: ["barcode", "bin", "shelf"],
    terms: ["refill", "verify", "secure bin", "audit"],
  },
  {
    aliases: ["hospital supply"],
    label: "hospital supply -> healthcare",
    categories: ["Healthcare"],
    industries: ["hospital supply"],
    siteTypes: ["hospital supply", "supply room"],
    objectTags: ["cart", "room", "corridor"],
    terms: ["restock", "cart", "supply", "return"],
  },
  {
    aliases: ["cold storage", "cold chain", "chilled"],
    label: "cold storage -> cold chain",
    categories: ["Cold Chain"],
    industries: ["food distribution", "cold storage"],
    siteTypes: ["cold storage", "chilled pick room"],
    objectTags: ["airlock", "bin"],
    terms: ["temperature", "cold", "chilled", "airlock"],
  },
  {
    aliases: ["returns", "return processing"],
    label: "returns -> service operations",
    categories: ["Service"],
    industries: ["e-commerce returns"],
    siteTypes: ["returns processing"],
    objectTags: ["item", "tote", "table"],
    terms: ["triage", "routing", "return"],
  },
  {
    aliases: ["baggage"],
    label: "baggage -> logistics",
    categories: ["Logistics"],
    industries: ["airport handling"],
    siteTypes: ["baggage feed", "airport handling"],
    objectTags: ["bag", "belt", "barcode"],
    terms: ["scan", "route", "lane clear"],
  },
  {
    aliases: ["assembly"],
    label: "assembly -> manufacturing",
    categories: ["Manufacturing"],
    industries: ["light manufacturing", "battery assembly"],
    siteTypes: ["assembly", "line side", "staging cell"],
    objectTags: ["cart", "fixture", "battery"],
    terms: ["part feed", "station transfer", "fixture"],
  },
  {
    aliases: ["lab", "electronics repair"],
    label: "lab/electronics repair -> manufacturing",
    categories: ["Manufacturing"],
    industries: ["electronics repair"],
    siteTypes: ["rework lab", "bench cell"],
    objectTags: ["bench", "tray"],
    terms: ["rework", "bench", "test", "tray"],
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
    .filter((token) => token && !STOPWORDS.has(token));
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function normalizeList(items: Array<unknown>) {
  return unique(
    items
      .flatMap((item) => String(item || "").split(","))
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function phraseMatches(text: string, phrase: string) {
  const normalizedText = ` ${normalizeText(text)} `;
  const normalizedPhrase = normalizeText(phrase);
  return Boolean(normalizedPhrase) && normalizedText.includes(` ${normalizedPhrase} `);
}

function dot(left: number[], right: number[]) {
  const count = Math.min(left.length, right.length);
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    total += left[index] * right[index];
  }
  return total;
}

function norm(vector: number[]) {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(left: number[] | null, right: number[] | null) {
  if (!left?.length || !right?.length || left.length !== right.length) return null;
  const denominator = norm(left) * norm(right);
  if (!denominator) return null;
  return dot(left, right) / denominator;
}

function jaccardSimilarity(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }
  const union = leftSet.size + rightSet.size - intersection;
  return union ? intersection / union : 0;
}

function field(field: string, value: unknown): SiteWorldField | null {
  const normalized = Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean).join(" ")
    : String(value || "").trim();
  return normalized ? { field, value: normalized } : null;
}

function extractAddressParts(siteAddress: string) {
  const address = String(siteAddress || "").trim();
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const stateZip = parts[parts.length - 1] || "";
  const stateMatch = stateZip.match(/\b([A-Z]{2})\b/);
  return {
    city: parts.length >= 2 ? parts[parts.length - 2] : null,
    state: stateMatch?.[1] || null,
  };
}

function availabilityForSite(site: SiteWorldCard) {
  if (site.id === "siteworld-f5fd54898cfb") return "public_demo_sample";
  if (site.id === "sw-chi-01") return "request_reviewed_exemplar";
  if (site.dataSource === "pipeline") return "pipeline_backed_request_scoped";
  return "planned_catalog_profile";
}

function readinessForSite(site: SiteWorldCard) {
  const readiness = site.deploymentReadiness;
  const values = [
    readiness?.qualification_state,
    readiness?.opportunity_state,
    readiness?.export_readiness_status,
    readiness?.runtime_health_status,
    readiness?.runtime_registration_status,
    readiness?.native_world_model_status,
    site.presentationDemoReadiness?.status,
    site.runtimeManifest?.launchable ? "launchable" : "request_gated",
  ];
  return values.map((value) => String(value || "").trim()).filter(Boolean).join(" ");
}

function collectObjectTags(site: SiteWorldCard, fields: SiteWorldField[]) {
  const explicit = [
    ...(site.artifactExplorer?.objects || []).flatMap((item) => [
      item.id,
      item.label,
      item.taskRole,
      item.groundingLevel,
    ]),
  ];
  const tokens = new Set(tokenize(fields.map((item) => item.value).join(" ")));
  const inferred = KNOWN_OBJECT_TERMS.filter((term) => tokens.has(term));
  return unique([...normalizeList(explicit), ...inferred]).map((item) => normalizeText(item)).filter(Boolean);
}

function inferSiteAliases(site: SiteWorldCard) {
  const haystack = normalizeText([
    site.category,
    site.industry,
    site.thumbnailKind,
    site.taskLane,
    site.summary,
    site.bestFor,
  ].join(" "));
  const aliases: string[] = [];
  if (site.category === "Retail" || /\bgrocery\b|\bretail\b|\bfulfillment\b/.test(haystack)) {
    aliases.push("store", "grocery store", "supermarket", "retail aisle", "retail shelf", "restock");
  }
  if (site.category === "Logistics" || /\blogistics\b|\bparcel\b|\bwarehouse\b|\bbaggage\b/.test(haystack)) {
    aliases.push("warehouse", "distribution center", "depot", "fulfillment center", "tote", "pallet");
  }
  if (site.category === "Healthcare" || /\bpharmacy\b|\bhospital\b/.test(haystack)) {
    aliases.push("pharmacy", "hospital supply");
  }
  if (site.category === "Cold Chain" || /\bcold\b|\bchilled\b/.test(haystack)) {
    aliases.push("cold storage", "cold chain");
  }
  if (/\breturns?\b/.test(haystack)) aliases.push("returns", "return processing");
  if (/\bassembly\b|\bmanufacturing\b|\bfixture\b/.test(haystack)) aliases.push("assembly");
  if (/\blab\b|\belectronics\b|\bbench\b/.test(haystack)) aliases.push("lab", "electronics repair");
  return unique(aliases);
}

export function buildSiteWorldSearchDoc(site: SiteWorldCard) {
  const addressParts = extractAddressParts(site.siteAddress);
  const availability = availabilityForSite(site);
  const readiness = readinessForSite(site);
  const fields = [
    field("id", site.id),
    field("siteName", site.siteName),
    field("siteCode", site.siteCode),
    field("category", site.category),
    field("industry", site.industry),
    field("siteType", site.thumbnailKind),
    field("address", site.siteAddress),
    field("city", addressParts.city),
    field("state", addressParts.state),
    field("taskLane", site.taskLane),
    field("summary", site.summary),
    field("bestFor", site.bestFor),
    field("sampleTask", site.sampleTask),
    field("sampleRobot", site.sampleRobot),
    field("runtime", site.runtime),
    field("startStates", site.startStates),
    field("scenarioVariants", site.scenarioVariants),
    field("exportArtifacts", site.exportArtifacts),
    field("exportModes", site.exportModes),
    field("packages", site.packages.flatMap((pack) => [
      pack.name,
      pack.summary,
      pack.priceLabel,
      pack.actionLabel,
      ...pack.deliverables,
    ])),
    field("taskCatalog", site.taskCatalog.flatMap((task) => [task.id, task.taskId, task.taskText, task.taskCategory])),
    field("scenarioCatalog", site.scenarioCatalog.flatMap((scenario) => [scenario.id, scenario.name, scenario.source])),
    field("startStateCatalog", site.startStateCatalog.flatMap((start) => [start.id, start.name, start.source])),
    field("robotProfiles", site.robotProfiles.flatMap((robot) => [
      robot.id,
      robot.displayName,
      robot.embodimentType,
      robot.actionSpace?.name,
      robot.actionSpaceSummary,
      robot.gripperSemantics,
      robot.baseSemantics,
      ...(robot.allowedPolicyAdapters || []),
    ])),
    field("artifactExplorer", [
      site.artifactExplorer?.headline,
      site.artifactExplorer?.summary,
      site.artifactExplorer?.derivationMode,
      site.artifactExplorer?.sceneKind,
      ...(site.artifactExplorer?.objects || []).flatMap((object) => [object.id, object.label, object.taskRole, object.groundingLevel]),
      ...(site.artifactExplorer?.sources || []).flatMap((source) => [source.id, source.label, source.detail]),
    ]),
    field("proofLabels", [
      site.dataSource,
      availability,
      readiness,
      site.worldLabsPreview?.status,
      site.presentationDemoReadiness?.status,
    ]),
    field("aliases", inferSiteAliases(site)),
  ].filter(Boolean) as SiteWorldField[];

  const objectTags = collectObjectTags(site, fields);
  const fieldsWithObjects = [
    ...fields,
    field("objectTags", objectTags),
  ].filter(Boolean) as SiteWorldField[];

  return {
    fields: fieldsWithObjects,
    searchDoc: fieldsWithObjects.map((item) => `${item.field}: ${item.value}`).join("\n"),
    city: addressParts.city,
    state: addressParts.state,
    objectTags,
    availability,
    readiness,
  };
}

export function parseSiteWorldSearchQuery(q: string) {
  const query = String(q || "").trim();
  const aliases: ParsedSiteWorldAlias[] = [];

  for (const rule of SITE_WORLD_ALIAS_RULES) {
    const matchedAlias = rule.aliases.find((alias) => phraseMatches(query, alias));
    if (!matchedAlias) continue;
    aliases.push({
      alias: matchedAlias,
      mapsTo: rule.label,
      categories: rule.categories || [],
      industries: rule.industries || [],
      siteTypes: rule.siteTypes || [],
      objectTags: rule.objectTags || [],
      terms: rule.terms || [],
      truthNote: rule.truthNote,
    });
  }

  return {
    q: query,
    tokens: tokenize(query),
    aliases,
  };
}

function normalizedFilter(value?: string | null) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function candidateMatchesText(value: string, expected?: string | null) {
  const filter = normalizedFilter(expected);
  if (!filter) return true;
  return normalizeText(value).includes(filter);
}

function passesFilters(candidate: SiteWorldSearchCandidate, filters: SiteWorldSearchFilters) {
  const site = candidate.siteWorld;
  if (filters.category && normalizeText(site.category) !== normalizeText(filters.category)) return false;
  if (filters.industry && !candidateMatchesText(site.industry, filters.industry)) return false;
  if (filters.city && normalizeText(candidate.city) !== normalizeText(filters.city)) return false;
  if (filters.state && normalizeText(candidate.state) !== normalizeText(filters.state)) return false;
  if (filters.siteType && !candidateMatchesText(candidate.searchDoc, filters.siteType)) return false;
  if (filters.taskLane && !candidateMatchesText(site.taskLane, filters.taskLane)) return false;
  if (filters.robot && !candidateMatchesText(candidate.fields.filter((item) => item.field === "robotProfiles" || item.field === "sampleRobot").map((item) => item.value).join(" "), filters.robot)) return false;
  if (filters.availability && !candidateMatchesText(candidate.availability, filters.availability)) return false;
  if (filters.readiness && !candidateMatchesText(candidate.readiness, filters.readiness)) return false;

  const requiredObjects = normalizeList(filters.objectTags || []).map(normalizeText);
  if (requiredObjects.length > 0) {
    const objectSet = new Set(candidate.objectTags);
    if (!requiredObjects.every((tag) => objectSet.has(tag) || normalizeText(candidate.searchDoc).includes(tag))) {
      return false;
    }
  }

  return true;
}

function fieldMatches(candidate: SiteWorldSearchCandidate, queryTokens: string[]) {
  if (!queryTokens.length) return [];
  const matches: string[] = [];
  for (const item of candidate.fields) {
    const text = normalizeText(item.value);
    if (queryTokens.some((token) => text.includes(token))) {
      matches.push(item.field);
    }
  }
  return unique(matches);
}

function scoreAliasMatches(candidate: SiteWorldSearchCandidate, aliases: ParsedSiteWorldAlias[]) {
  let score = 0;
  const matchedAliases: string[] = [];
  const matchedFields: string[] = [];
  const reasons: string[] = [];
  const site = candidate.siteWorld;
  const searchDoc = normalizeText(candidate.searchDoc);
  const objectSet = new Set(candidate.objectTags);

  for (const alias of aliases) {
    let matched = false;
    const details: string[] = [];

    if (alias.categories.some((category) => normalizeText(category) === normalizeText(site.category))) {
      matched = true;
      score += 0.34;
      matchedFields.push("category");
      details.push(site.category);
    }

    const industryHit = alias.industries.find((industry) => searchDoc.includes(normalizeText(industry)));
    if (industryHit) {
      matched = true;
      score += 0.18;
      matchedFields.push("industry");
      details.push(industryHit);
    }

    const siteTypeHit = alias.siteTypes.find((siteType) => searchDoc.includes(normalizeText(siteType)));
    if (siteTypeHit) {
      matched = true;
      score += 0.1;
      matchedFields.push("siteType");
      details.push(siteTypeHit);
    }

    const objectHit = alias.objectTags.find((tag) => objectSet.has(normalizeText(tag)) || searchDoc.includes(normalizeText(tag)));
    if (objectHit) {
      matched = true;
      score += 0.08;
      matchedFields.push("objectTags");
      details.push(objectHit);
    }

    const termHit = alias.terms.find((term) => searchDoc.includes(normalizeText(term)));
    if (termHit) {
      matched = true;
      score += 0.06;
      details.push(termHit);
    }

    if (matched) {
      matchedAliases.push(`${alias.alias} -> ${alias.mapsTo.replace(/^[^-]+->\s*/, "")}`);
      const note = alias.truthNote ? `; ${alias.truthNote}` : "";
      reasons.push(`Alias ${alias.alias} maps to ${details.slice(0, 3).join(", ") || alias.mapsTo}${note}`);
    }
  }

  return {
    score,
    matchedAliases: unique(matchedAliases),
    matchedFields: unique(matchedFields),
    reasons,
  };
}

function scoreStructuredSignals(candidate: SiteWorldSearchCandidate, parsed: ReturnType<typeof parseSiteWorldSearchQuery>, filters: SiteWorldSearchFilters) {
  let score = 0;
  const reasons: string[] = [];
  const matchedFields: string[] = [];
  const site = candidate.siteWorld;
  const normalizedQuery = normalizeText(parsed.q);

  if (normalizedQuery) {
    const exactTargets = [
      ["id", site.id],
      ["siteCode", site.siteCode],
      ["siteName", site.siteName],
    ] as const;
    for (const [name, value] of exactTargets) {
      const normalizedValue = normalizeText(value);
      if (normalizedValue && normalizedValue === normalizedQuery) {
        score += 1.0;
        reasons.push(`Exact ${name} match`);
        matchedFields.push(name);
      } else if (normalizedValue && normalizedValue.includes(normalizedQuery)) {
        score += 0.45;
        reasons.push(`${name} contains query`);
        matchedFields.push(name);
      }
    }
  }

  const locationTokens = tokenize([candidate.city, candidate.state, site.siteAddress].join(" "));
  const locationOverlap = parsed.tokens.filter((token) => locationTokens.includes(token));
  if (locationOverlap.length > 0) {
    score += Math.min(0.28, 0.12 * locationOverlap.length);
    reasons.push(`Location match: ${locationOverlap.slice(0, 3).join(", ")}`);
    matchedFields.push("address");
  }

  if (filters.city && normalizeText(candidate.city) === normalizeText(filters.city)) {
    score += 0.24;
    reasons.push(`City filter: ${candidate.city}`);
    matchedFields.push("city");
  }
  if (filters.state && normalizeText(candidate.state) === normalizeText(filters.state)) {
    score += 0.16;
    reasons.push(`State filter: ${candidate.state}`);
    matchedFields.push("state");
  }

  const robotText = candidate.fields
    .filter((item) => item.field === "robotProfiles" || item.field === "sampleRobot")
    .map((item) => item.value)
    .join(" ");
  const robotOverlap = parsed.tokens.filter((token) => normalizeText(robotText).includes(token));
  if (robotOverlap.length > 0) {
    score += Math.min(0.12, robotOverlap.length * 0.04);
    matchedFields.push("robotProfiles");
  }

  const taskText = candidate.fields
    .filter((item) => ["taskLane", "sampleTask", "taskCatalog", "startStateCatalog", "scenarioCatalog"].includes(item.field))
    .map((item) => item.value)
    .join(" ");
  const taskOverlap = parsed.tokens.filter((token) => normalizeText(taskText).includes(token));
  if (taskOverlap.length > 0) {
    score += Math.min(0.18, taskOverlap.length * 0.05);
    reasons.push(`Task/workflow match: ${unique(taskOverlap).slice(0, 3).join(", ")}`);
    matchedFields.push("taskLane", "taskCatalog");
  }

  const objectOverlap = parsed.tokens.filter((token) => candidate.objectTags.includes(token));
  if (objectOverlap.length > 0) {
    score += Math.min(0.16, objectOverlap.length * 0.08);
    reasons.push(`Object match: ${unique(objectOverlap).join(", ")}`);
    matchedFields.push("objectTags");
  }

  if (site.runtimeManifest?.launchable) {
    score += 0.025;
    reasons.push("Runtime marked launchable");
    matchedFields.push("readiness");
  }
  if (site.dataSource === "pipeline") {
    score += 0.025;
    reasons.push("Pipeline-backed public record");
    matchedFields.push("availability");
  }
  if (site.id === "sw-chi-01") {
    score += 0.015;
    reasons.push("Request-reviewed exemplar listing");
    matchedFields.push("availability");
  }

  return {
    score,
    reasons,
    matchedFields: unique(matchedFields),
  };
}

function queryHasAddressSpecificity(normalizedQuery: string) {
  return (
    /\d/.test(normalizedQuery) ||
    /\b(st|street|ave|avenue|road|rd|blvd|boulevard|dr|drive|lane|ln|way|pkwy|parkway|plaza|square|sq)\b/.test(normalizedQuery)
  );
}

function candidateHasExactScannedPackageMatch(candidate: SiteWorldSearchCandidate, query: string) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return false;

  const site = candidate.siteWorld;
  const exactTargets = [site.id, site.siteCode].map(normalizeText).filter(Boolean);
  if (exactTargets.some((value) => value === normalizedQuery || value.includes(normalizedQuery))) {
    return true;
  }

  const normalizedAddress = normalizeText(site.siteAddress);
  if (
    normalizedAddress &&
    (normalizedAddress === normalizedQuery ||
      (queryHasAddressSpecificity(normalizedQuery) && normalizedAddress.includes(normalizedQuery)))
  ) {
    return true;
  }

  const normalizedName = normalizeText(site.siteName);
  if (!normalizedName) return false;
  if (normalizedName === normalizedQuery) return true;

  const queryTokens = tokenize(query);
  const hasDistinctiveNameToken = queryTokens.some(
    (token) => !GENERIC_SITE_NAME_TOKENS.has(token) && normalizedName.includes(token),
  );
  return normalizedName.includes(normalizedQuery) && (queryTokens.length > 1 || hasDistinctiveNameToken);
}

function buildSearchMatchSemantics(
  query: string,
  candidates: SiteWorldSearchCandidate[],
): SiteWorldSearchMatchSemantics {
  const hasQuery = Boolean(String(query || "").trim());
  const exactMatch = hasQuery
    ? candidates.some((candidate) => candidateHasExactScannedPackageMatch(candidate, query))
    : false;
  const noExactScannedPackage = hasQuery && !exactMatch;

  return {
    exactMatch,
    noExactScannedPackage,
    message: noExactScannedPackage
      ? "No scanned package for this exact place yet."
      : exactMatch
        ? "At least one public catalog record matches the site name, code, or address query."
        : "Search the public catalog by site, address, category, workflow, robot, or object tags.",
    truthBoundary:
      "Search and request candidates are catalog/intake signals only; they do not grant entitlement, payment, provider execution, hosted-session access, private artifact access, fulfillment, or rights clearance.",
  };
}

function firstNonEmpty(...values: Array<unknown>) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function buildRequestUrl(input: {
  query: string;
  siteName: string;
  siteLocation: string;
  targetSiteType: string;
  workflow: string;
  taskStatement: string;
  requestedOutputs: string;
}) {
  const params = new URLSearchParams({
    persona: "robot-team",
    buyerType: "robot_team",
    interest: "capture-access",
    path: "new-capture",
    source: "site-worlds",
    proofPathPreference: "exact_site_required",
  });

  if (input.query) params.set("query", input.query);
  if (input.siteName) params.set("siteName", input.siteName);
  if (input.siteLocation) {
    params.set("location", input.siteLocation);
    params.set("siteLocation", input.siteLocation);
  }
  if (input.targetSiteType) params.set("targetSiteType", input.targetSiteType);
  if (input.workflow) params.set("workflow", input.workflow);
  if (input.taskStatement) params.set("taskStatement", input.taskStatement);
  if (input.requestedOutputs) params.set("requestedOutputs", input.requestedOutputs);

  return `/contact?${params.toString()}`;
}

function buildSearchRequestCandidate(params: {
  query: string;
  parsed: ReturnType<typeof parseSiteWorldSearchQuery>;
  filters: SiteWorldSearchFilters;
  results: SiteWorldSearchResult[];
}): SiteWorldSearchRequestCandidate | null {
  const query = String(params.query || "").trim();
  if (!query) return null;

  const alias = params.parsed.aliases[0];
  const topResult = params.results[0]?.siteWorld;
  const targetSiteType = firstNonEmpty(
    params.filters.siteType,
    alias?.siteTypes[0],
    params.filters.category,
    alias?.categories[0],
    topResult?.industry,
    topResult?.category,
  );
  const workflow = firstNonEmpty(
    params.filters.taskLane,
    alias?.terms.slice(0, 4).join(", "),
    topResult?.taskLane,
  );
  const siteLocation = firstNonEmpty(
    [params.filters.city, params.filters.state].filter(Boolean).join(", "),
    query,
  );
  const requestedOutputs = "Site-specific world model package and hosted review scoping";
  const taskStatement = [
    `Request an exact-site world model for ${query}.`,
    workflow ? `Workflow: ${workflow}.` : "",
    targetSiteType ? `Site class: ${targetSiteType}.` : "",
  ].filter(Boolean).join(" ");
  const base = {
    query,
    siteName: query,
    siteLocation,
    targetSiteType,
    workflow,
    taskStatement,
    requestedOutputs,
  };
  const requestUrl = buildRequestUrl(base);

  return {
    buyerType: "robot_team",
    source: "site-worlds",
    requestPath: "new-capture",
    requestUrl,
    ...base,
    proofPathPreference: "exact_site_required",
    inboundRequestDraft: {
      buyerType: "robot_team",
      commercialRequestPath: "capture_access",
      requestedLanes: ["deeper_evaluation"],
      siteName: query,
      siteLocation,
      ...(targetSiteType ? { targetSiteType } : {}),
      taskStatement,
      proofPathPreference: "exact_site_required",
      ...(workflow ? { workflowContext: workflow } : {}),
      details:
        "Search found no exact scanned package for this requested place. This is an intake request only, not access, fulfillment, payment, provider execution, or rights clearance.",
      context: {
        sourcePageUrl: requestUrl,
        buyerChannelSourceRaw: "site-worlds",
        utm: {},
      },
    },
  };
}

function sortResults(results: SiteWorldSearchResult[], sort: SiteWorldSearchSort) {
  const copy = results.slice();
  const availabilityRank = (value: string) => {
    if (value === "pipeline_backed_request_scoped") return 4;
    if (value === "request_reviewed_exemplar") return 3;
    if (value === "public_demo_sample") return 2;
    return 1;
  };
  const readinessRank = (site: SiteWorldCard) => {
    if (site.runtimeManifest?.launchable) return 3;
    if (site.deploymentReadiness?.native_world_model_primary) return 2;
    return 1;
  };

  copy.sort((left, right) => {
    if (sort === "name") {
      return left.siteWorld.siteName.localeCompare(right.siteWorld.siteName) || left.siteWorld.id.localeCompare(right.siteWorld.id);
    }
    if (sort === "city") {
      const leftCity = extractAddressParts(left.siteWorld.siteAddress).city || "";
      const rightCity = extractAddressParts(right.siteWorld.siteAddress).city || "";
      return leftCity.localeCompare(rightCity) || right.score - left.score || left.siteWorld.id.localeCompare(right.siteWorld.id);
    }
    if (sort === "category") {
      return left.siteWorld.category.localeCompare(right.siteWorld.category) || right.score - left.score || left.siteWorld.id.localeCompare(right.siteWorld.id);
    }
    if (sort === "readiness") {
      return readinessRank(right.siteWorld) - readinessRank(left.siteWorld) || right.score - left.score || left.siteWorld.id.localeCompare(right.siteWorld.id);
    }
    if (sort === "availability") {
      return availabilityRank(availabilityForSite(right.siteWorld)) - availabilityRank(availabilityForSite(left.siteWorld)) || right.score - left.score || left.siteWorld.id.localeCompare(right.siteWorld.id);
    }
    return right.score - left.score || left.siteWorld.siteName.localeCompare(right.siteWorld.siteName) || left.siteWorld.id.localeCompare(right.siteWorld.id);
  });

  return copy;
}

function appliedFilters(filters: SiteWorldSearchFilters): SiteWorldSearchFilters {
  return {
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.industry ? { industry: filters.industry } : {}),
    ...(filters.city ? { city: filters.city } : {}),
    ...(filters.state ? { state: filters.state } : {}),
    ...(filters.siteType ? { siteType: filters.siteType } : {}),
    ...(filters.taskLane ? { taskLane: filters.taskLane } : {}),
    ...(filters.objectTags?.length ? { objectTags: filters.objectTags } : {}),
    ...(filters.robot ? { robot: filters.robot } : {}),
    ...(filters.availability ? { availability: filters.availability } : {}),
    ...(filters.readiness ? { readiness: filters.readiness } : {}),
    ...(filters.sort && filters.sort !== "relevance" ? { sort: filters.sort } : {}),
  };
}

function normalizeSort(sort: unknown): SiteWorldSearchSort {
  const normalized = normalizeText(sort);
  if (["name", "city", "category", "readiness", "availability"].includes(normalized)) {
    return normalized as SiteWorldSearchSort;
  }
  return "relevance";
}

export function normalizeSiteWorldSearchFilters(filters: SiteWorldSearchFilters = {}): SiteWorldSearchFilters {
  return {
    category: String(filters.category || "").trim() || null,
    industry: String(filters.industry || "").trim() || null,
    city: String(filters.city || "").trim() || null,
    state: String(filters.state || "").trim().toUpperCase() || null,
    siteType: String(filters.siteType || "").trim() || null,
    taskLane: String(filters.taskLane || "").trim() || null,
    objectTags: normalizeList(filters.objectTags || []),
    robot: String(filters.robot || "").trim() || null,
    availability: String(filters.availability || "").trim() || null,
    readiness: String(filters.readiness || "").trim() || null,
    sort: normalizeSort(filters.sort),
  };
}

export async function searchPublicSiteWorlds(params: {
  query?: string;
  limit?: number;
  filters?: SiteWorldSearchFilters;
}): Promise<SiteWorldSearchResponse> {
  const query = String(params.query || "").trim();
  const limit = clamp(Math.floor(Number(params.limit || 10)), 1, 100);
  const filters = normalizeSiteWorldSearchFilters(params.filters || {});
  const parsed = parseSiteWorldSearchQuery(query);
  const warnings: string[] = [];
  const sites = await listPublicSiteWorlds(100);
  const candidates: SiteWorldSearchCandidate[] = sites.map((siteWorld) => {
    const doc = buildSiteWorldSearchDoc(siteWorld);
    return {
      siteWorld,
      fields: doc.fields,
      searchDoc: doc.searchDoc,
      tokens: tokenize(doc.searchDoc),
      city: doc.city,
      state: doc.state,
      objectTags: doc.objectTags,
      availability: doc.availability,
      readiness: doc.readiness,
      embedding: null,
    };
  });

  let queryEmbedding: number[] | null = null;
  let usedEmbeddings = false;
  if (query) {
    try {
      const embeddings = await embedTexts([query, ...candidates.map((candidate) => candidate.searchDoc)]);
      queryEmbedding = embeddings[0]?.length ? embeddings[0] : null;
      if (queryEmbedding && embeddings.length === candidates.length + 1) {
        candidates.forEach((candidate, index) => {
          candidate.embedding = embeddings[index + 1]?.length ? embeddings[index + 1] : null;
        });
        usedEmbeddings = candidates.some((candidate) => Boolean(candidate.embedding?.length));
      }
    } catch {
      queryEmbedding = null;
      usedEmbeddings = false;
    }
  }

  if (query && !usedEmbeddings) {
    warnings.push("embeddings_unavailable: OPENAI_API_KEY not configured or embedding generation failed; using deterministic lexical and alias ranking");
  }

  const scored = candidates
    .filter((candidate) => passesFilters(candidate, filters))
    .map((candidate) => {
      const aliasScore = scoreAliasMatches(candidate, parsed.aliases);
      const structuredScore = scoreStructuredSignals(candidate, parsed, filters);
      const lexicalScore = query ? jaccardSimilarity(parsed.tokens, candidate.tokens) : 0.01;
      const semanticSimilarity = queryEmbedding ? cosineSimilarity(queryEmbedding, candidate.embedding) : null;
      const semanticScore = typeof semanticSimilarity === "number" ? (semanticSimilarity + 1) / 2 : 0;
      const matchedFields = unique([
        ...fieldMatches(candidate, parsed.tokens),
        ...aliasScore.matchedFields,
        ...structuredScore.matchedFields,
      ]);
      const reasons = unique([
        ...aliasScore.reasons,
        ...structuredScore.reasons,
        ...(lexicalScore > 0 ? [`Lexical overlap ${(lexicalScore * 100).toFixed(0)}%`] : []),
        ...(semanticScore > 0 ? [`Embedding similarity ${(semanticScore * 100).toFixed(0)}%`] : []),
      ]).slice(0, 8);
      const rawScore =
        aliasScore.score +
        structuredScore.score +
        lexicalScore * 0.5 +
        (usedEmbeddings ? semanticScore * 0.35 : 0);

      return {
        siteWorld: candidate.siteWorld,
        score: Number(clamp(rawScore, 0, 2).toFixed(4)),
        reasons,
        matchedAliases: aliasScore.matchedAliases,
        matchedFields,
      };
    })
    .filter((result) => {
      if (!query && Object.keys(appliedFilters(filters)).length === 0) return true;
      return result.score > 0 || result.matchedFields.length > 0 || result.matchedAliases.length > 0;
    });

  const sort = filters.sort || "relevance";
  const results = sortResults(scored, sort).slice(0, limit);
  const matchSemantics = buildSearchMatchSemantics(query, candidates);
  const requestCandidate = matchSemantics.noExactScannedPackage
    ? buildSearchRequestCandidate({ query, parsed, filters, results })
    : null;

  return {
    query,
    results,
    parsed: {
      q: query,
      tokens: parsed.tokens,
      aliases: parsed.aliases,
      filters,
    },
    appliedFilters: appliedFilters(filters),
    matchSemantics,
    requestCandidate,
    warnings,
    meta: {
      backend: sites.some((site) => site.dataSource === "pipeline") ? "firestore-live" : "static-fallback",
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
      usedEmbeddings,
      totalCandidates: candidates.length,
      returned: results.length,
    },
  };
}
