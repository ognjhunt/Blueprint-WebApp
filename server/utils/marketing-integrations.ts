import type { WebSearchResult } from "./web-search.js";

type FetchLike = typeof fetch;

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))
      ? Number(value)
      : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeUrl(baseUrl: string, path: string) {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function fetchJson(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  const response = await fetchImpl(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${url}: ${text.slice(0, 400)}`);
  }
  if (!text.trim()) {
    return {};
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(
      `Invalid JSON from ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export type ResearchEvidenceLabel = "evidence" | "inference" | "open_question";
export type ResearchConfidence = "high" | "medium" | "low";

export interface CustomerResearchEvidenceItem {
  source: string;
  type: string;
  label: ResearchEvidenceLabel;
  summary: string;
  quote?: string;
  url?: string;
  personaRole?: string;
  jtbdJob?: string;
  jtbdPain?: string;
  jtbdDesiredOutcome?: string;
  objection?: string;
  confidence?: ResearchConfidence;
}

export interface CustomerResearchJTBDItem {
  job: string;
  pain: string;
  desiredOutcome: string;
  evidenceCount: number;
}

export interface CustomerResearchPersona {
  role: string;
  goals: string[];
  pains: string[];
  objections: string[];
  evidenceCount: number;
}

export interface CustomerResearchSynthesis {
  evidence: CustomerResearchEvidenceItem[];
  jtbd: CustomerResearchJTBDItem[];
  personas: CustomerResearchPersona[];
  objections: string[];
  openQuestions: string[];
  confidence: ResearchConfidence;
  sourceCoverage: string[];
}

function normalizeResearchLabel(value: unknown): ResearchEvidenceLabel {
  const normalized = asString(value)?.toLowerCase();
  if (normalized === "evidence" || normalized === "inference" || normalized === "open_question") {
    return normalized;
  }
  return "evidence";
}

function normalizeConfidence(value: unknown): ResearchConfidence | undefined {
  const normalized = asString(value)?.toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return undefined;
}

export function normalizeCustomerResearchEvidence(
  value: unknown,
): CustomerResearchEvidenceItem[] {
  const entries = asArray(value)
    .map((entry): CustomerResearchEvidenceItem | null => {
      const record = asRecord(entry);
      if (!record) return null;
      const source = asString(record.source);
      const summary = asString(record.summary);
      if (!source || !summary) return null;
      return {
        source,
        type: asString(record.type) ?? "research_note",
        label: normalizeResearchLabel(record.label),
        summary,
        quote: asString(record.quote),
        url: asString(record.url),
        personaRole: asString(record.personaRole),
        jtbdJob: asString(record.jtbdJob),
        jtbdPain: asString(record.jtbdPain),
        jtbdDesiredOutcome: asString(record.jtbdDesiredOutcome),
        objection: asString(record.objection),
        confidence: normalizeConfidence(record.confidence),
      } satisfies CustomerResearchEvidenceItem;
    });
  return entries.filter((entry): entry is CustomerResearchEvidenceItem => entry !== null);
}

function inferResearchConfidence(
  evidence: CustomerResearchEvidenceItem[],
  sourceCoverage: string[],
): ResearchConfidence {
  if (evidence.length >= 6 && sourceCoverage.length >= 3) return "high";
  if (evidence.length >= 3 && sourceCoverage.length >= 2) return "medium";
  return "low";
}

export function synthesizeCustomerResearch(
  evidenceInput: unknown,
): CustomerResearchSynthesis {
  const evidence = normalizeCustomerResearchEvidence(evidenceInput);
  const sourceCoverage = [...new Set(evidence.map((entry) => entry.source))];

  const jtbdMap = new Map<string, CustomerResearchJTBDItem>();
  for (const item of evidence) {
    const job = item.jtbdJob ?? "Unspecified job";
    const pain = item.jtbdPain ?? item.summary;
    const desiredOutcome = item.jtbdDesiredOutcome ?? "Reduce uncertainty and move faster";
    const key = `${job}::${pain}::${desiredOutcome}`;
    const existing = jtbdMap.get(key);
    if (existing) {
      existing.evidenceCount += 1;
    } else {
      jtbdMap.set(key, {
        job,
        pain,
        desiredOutcome,
        evidenceCount: 1,
      });
    }
  }

  const personaMap = new Map<string, CustomerResearchPersona>();
  for (const item of evidence) {
    const role = item.personaRole ?? "Unspecified buyer";
    const existing = personaMap.get(role) ?? {
      role,
      goals: [],
      pains: [],
      objections: [],
      evidenceCount: 0,
    };
    const goal = item.jtbdDesiredOutcome ?? item.jtbdJob;
    if (goal && !existing.goals.includes(goal)) existing.goals.push(goal);
    if (item.jtbdPain && !existing.pains.includes(item.jtbdPain)) existing.pains.push(item.jtbdPain);
    if (item.objection && !existing.objections.includes(item.objection)) existing.objections.push(item.objection);
    existing.evidenceCount += 1;
    personaMap.set(role, existing);
  }

  const objections = [
    ...new Set(
      evidence
        .map((entry) => entry.objection)
        .filter((entry): entry is string => Boolean(entry)),
    ),
  ];
  const openQuestions = evidence
    .filter((entry) => entry.label === "open_question")
    .map((entry) => entry.summary);

  return {
    evidence,
    jtbd: [...jtbdMap.values()].sort((left, right) => right.evidenceCount - left.evidenceCount),
    personas: [...personaMap.values()].sort((left, right) => right.evidenceCount - left.evidenceCount),
    objections,
    openQuestions,
    confidence: inferResearchConfidence(evidence, sourceCoverage),
    sourceCoverage,
  };
}

const CUSTOMER_RESEARCH_SOURCE_SUFFIXES: Record<string, string> = {
  reddit: "site:reddit.com",
  g2: "site:g2.com",
  indie_hackers: "site:indiehackers.com",
  hacker_news: "site:news.ycombinator.com OR site:hn.algolia.com",
  linkedin: "site:linkedin.com",
  youtube: "site:youtube.com",
  reviews: "reviews OR testimonials OR complaints",
  forums: "forum OR community",
};

export function buildCustomerResearchQueries(
  query: string,
  requestedSources: string[] | undefined,
): string[] {
  const sources = requestedSources && requestedSources.length > 0
    ? requestedSources
    : ["reddit", "g2", "indie_hackers", "hacker_news", "linkedin", "youtube"];
  return sources.map((source) => {
    const suffix = CUSTOMER_RESEARCH_SOURCE_SUFFIXES[source] ?? source;
    return `${query} ${suffix}`.trim();
  });
}

export async function runCustomerResearchSearch(
  query: string,
  requestedSources: string[] | undefined,
  searchFn: (query: string) => Promise<WebSearchResult>,
) {
  const queries = buildCustomerResearchQueries(query, requestedSources);
  const results = await Promise.all(queries.map(async (sourceQuery) => {
    const result = await searchFn(sourceQuery);
    return {
      query: sourceQuery,
      answer: result.answer,
      citations: result.citations,
    };
  }));
  return {
    query,
    results,
    citations: [...new Set(results.flatMap((result) => result.citations))],
  };
}

export interface FirehoseConfig {
  apiToken: string;
  baseUrl: string;
  defaultTopics?: string[];
  maxSignalsPerRead?: number;
}

export interface FirehoseSignal {
  id: string;
  source: string;
  topic: string;
  title: string;
  summary: string;
  url?: string;
  publishedAt?: string;
  score?: number;
  tags: string[];
}

export interface FirehoseBrief {
  headline: string;
  totalSignals: number;
  topics: string[];
  sources: string[];
  highlights: string[];
}

export interface FirehoseReadParams {
  query?: string;
  topics?: string[];
  limit?: number;
  since?: string;
}

function normalizeFirehoseSignal(value: unknown): FirehoseSignal | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = asString(record.id) ?? asString(record.externalId);
  const title = asString(record.title);
  const summary = asString(record.summary) ?? asString(record.snippet);
  if (!id || !title || !summary) return null;
  return {
    id,
    source: asString(record.source) ?? "unknown",
    topic: asString(record.topic) ?? "general",
    title,
    summary,
    url: asString(record.url),
    publishedAt: asString(record.publishedAt),
    score: asNumber(record.score),
    tags: asArray(record.tags)
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  };
}

export function dedupeFirehoseSignals(signals: FirehoseSignal[]) {
  const deduped = new Map<string, FirehoseSignal>();
  for (const signal of signals) {
    const existing = deduped.get(signal.id);
    if (!existing) {
      deduped.set(signal.id, signal);
      continue;
    }
    const existingTimestamp = existing.publishedAt ? Date.parse(existing.publishedAt) : 0;
    const nextTimestamp = signal.publishedAt ? Date.parse(signal.publishedAt) : 0;
    if (nextTimestamp >= existingTimestamp) {
      deduped.set(signal.id, signal);
    }
  }
  return [...deduped.values()].sort((left, right) => {
    const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0;
    const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0;
    return rightTime - leftTime;
  });
}

function firehoseHeaders(config: FirehoseConfig) {
  return {
    Authorization: `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function fetchFirehoseSignals(
  config: FirehoseConfig,
  params: FirehoseReadParams,
  fetchImpl: FetchLike = fetch,
) {
  const payload = await fetchJson(fetchImpl, normalizeUrl(config.baseUrl, "/signals/search"), {
    method: "POST",
    headers: firehoseHeaders(config),
    body: JSON.stringify({
      query: params.query,
      topics: params.topics && params.topics.length > 0 ? params.topics : config.defaultTopics ?? [],
      limit: Math.min(params.limit ?? config.maxSignalsPerRead ?? 20, config.maxSignalsPerRead ?? 20),
      since: params.since,
    }),
  });
  const signals = dedupeFirehoseSignals(
    asArray(asRecord(payload)?.items ?? asRecord(payload)?.signals ?? payload)
      .map(normalizeFirehoseSignal)
      .filter((entry): entry is FirehoseSignal => Boolean(entry)),
  );
  return { signals, count: signals.length };
}

export function buildFirehoseBrief(
  signals: FirehoseSignal[],
  query?: string,
): FirehoseBrief {
  const topics = [...new Set(signals.map((signal) => signal.topic))];
  const sources = [...new Set(signals.map((signal) => signal.source))];
  const highlights = signals
    .slice(0, 5)
    .map((signal) => `${signal.title} [${signal.topic}] — ${signal.summary}`);
  return {
    headline: query
      ? `Firehose returned ${signals.length} normalized signals for "${query}".`
      : `Firehose returned ${signals.length} normalized signals.`,
    totalSignals: signals.length,
    topics,
    sources,
    highlights,
  };
}

export interface IntrowConfig {
  apiToken: string;
  baseUrl: string;
  defaultWorkspace?: string;
}

export interface IntrowPartner {
  id: string;
  name: string;
  status: string;
  workspace?: string;
  accountId?: string;
}

export interface IntrowAccount {
  id: string;
  name: string;
  status?: string;
  workspace?: string;
}

export function assertIntrowDraftOnly(params: Record<string, unknown>) {
  const status = asString(params.status)?.toLowerCase();
  if (status && !["draft", "proposed", "researching"].includes(status)) {
    throw new Error("Introw live partner state changes are disabled. Create or update draft partner records only.");
  }
  if (params.activate === true || params.publish === true) {
    throw new Error("Introw live partner activation is disabled. Create or update draft partner records only.");
  }
}

function introwHeaders(config: IntrowConfig) {
  return {
    Authorization: `Bearer ${config.apiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function normalizeIntrowPartner(value: unknown): IntrowPartner | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = asString(record.id);
  const name = asString(record.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    status: asString(record.status) ?? "draft",
    workspace: asString(record.workspace),
    accountId: asString(record.accountId),
  };
}

function normalizeIntrowAccount(value: unknown): IntrowAccount | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = asString(record.id);
  const name = asString(record.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    status: asString(record.status),
    workspace: asString(record.workspace),
  };
}

export async function searchIntrowPartners(
  config: IntrowConfig,
  params: Record<string, unknown>,
  fetchImpl: FetchLike = fetch,
) {
  const payload = await fetchJson(fetchImpl, normalizeUrl(config.baseUrl, "/partners/search"), {
    method: "POST",
    headers: introwHeaders(config),
    body: JSON.stringify({
      ...params,
      workspace: asString(params.workspace) ?? config.defaultWorkspace,
    }),
  });
  const partners = asArray(asRecord(payload)?.items ?? payload)
    .map(normalizeIntrowPartner)
    .filter((entry): entry is IntrowPartner => Boolean(entry));
  return { partners, count: partners.length };
}

export async function readIntrowAccount(
  config: IntrowConfig,
  accountId: string,
  fetchImpl: FetchLike = fetch,
) {
  const payload = await fetchJson(
    fetchImpl,
    normalizeUrl(config.baseUrl, `/accounts/${encodeURIComponent(accountId)}`),
    {
      method: "GET",
      headers: introwHeaders(config),
    },
  );
  const account = normalizeIntrowAccount(asRecord(payload)?.item ?? payload);
  if (!account) {
    throw new Error("Introw account response did not include a valid account.");
  }
  return account;
}

export async function createIntrowPartnerDraft(
  config: IntrowConfig,
  params: Record<string, unknown>,
  fetchImpl: FetchLike = fetch,
) {
  assertIntrowDraftOnly(params);
  const payload = await fetchJson(fetchImpl, normalizeUrl(config.baseUrl, "/partners/drafts"), {
    method: "POST",
    headers: introwHeaders(config),
    body: JSON.stringify({
      ...params,
      workspace: asString(params.workspace) ?? config.defaultWorkspace,
      status: asString(params.status) ?? "draft",
    }),
  });
  const partner = normalizeIntrowPartner(asRecord(payload)?.item ?? payload);
  if (!partner) {
    throw new Error("Introw draft create response did not include a valid partner record.");
  }
  return partner;
}

export async function updateIntrowPartnerDraft(
  config: IntrowConfig,
  partnerId: string,
  params: Record<string, unknown>,
  fetchImpl: FetchLike = fetch,
) {
  assertIntrowDraftOnly(params);
  const payload = await fetchJson(
    fetchImpl,
    normalizeUrl(config.baseUrl, `/partners/drafts/${encodeURIComponent(partnerId)}`),
    {
      method: "PATCH",
      headers: introwHeaders(config),
      body: JSON.stringify({
        ...params,
        workspace: asString(params.workspace) ?? config.defaultWorkspace,
        status: asString(params.status) ?? "draft",
      }),
    },
  );
  const partner = normalizeIntrowPartner(asRecord(payload)?.item ?? payload);
  if (!partner) {
    throw new Error("Introw draft update response did not include a valid partner record.");
  }
  return partner;
}
