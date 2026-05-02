import { Client } from "@notionhq/client";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

export type NotionDatabaseKey = "work_queue" | "knowledge" | "skills" | "agents" | "agent_runs";

const HUB_PAGE_ID = "16d80154-161d-80db-869b-cfba4fe70be3";
const WORK_QUEUE_DB = "f83b6c53-a33a-4790-9ca4-786dddadad46";
const WORK_QUEUE_DS = "51d93d65-8a00-4dd4-a9a2-fd9a6e69120d";
const KNOWLEDGE_DB = "7c729783-c377-4342-bf00-5555b88a2ec6";
const KNOWLEDGE_DS = "b9e4ca9c-db43-4a16-9780-f15eb100c8b4";
const SKILLS_DB = "4e37bd7a-e448-4f81-aa3e-b8860826e98c";
const SKILLS_DS = "a9301f67-d565-4270-85e4-1fb8b82f96af";
const AGENTS_DB = "c6021156-6796-42c5-bef4-58d2eb12d6ab";
const AGENTS_DS = "66762c9c-b543-41d3-8f1f-95b80aed409a";
const AGENT_RUNS_DB = "bce59b92-4cf6-446d-9e07-e026c824563b";
const AGENT_RUNS_DS = "1ddce596-3c89-46e4-afeb-34e905017d87";
const NOTION_TEXT_CONTENT_LIMIT = 1800;
const BLUEPRINT_WEBAPP_REPO_ROOT = path.resolve(process.cwd());

const DATABASE_CONFIG: Record<
  NotionDatabaseKey,
  { databaseId: string; dataSourceId: string; titleProperty: string }
> = {
  work_queue: { databaseId: WORK_QUEUE_DB, dataSourceId: WORK_QUEUE_DS, titleProperty: "Title" },
  knowledge: { databaseId: KNOWLEDGE_DB, dataSourceId: KNOWLEDGE_DS, titleProperty: "Title" },
  skills: { databaseId: SKILLS_DB, dataSourceId: SKILLS_DS, titleProperty: "Title" },
  agents: { databaseId: AGENTS_DB, dataSourceId: AGENTS_DS, titleProperty: "Agent" },
  agent_runs: { databaseId: AGENT_RUNS_DB, dataSourceId: AGENT_RUNS_DS, titleProperty: "Run" },
};

const KNOWLEDGE_REVIEW_WINDOWS_DAYS: Record<string, number> = {
  Weekly: 8,
  Monthly: 35,
  Quarterly: 100,
};

type NotionClientAny = Client & any;
type NotionHandler = (params: Record<string, unknown>) => Promise<Record<string, unknown>>;

export interface NotionConfig {
  token: string;
}

export interface NotionWriteResult {
  pageId: string;
  pageUrl?: string;
}

export interface NotionUpsertResult extends NotionWriteResult {
  status: "created" | "updated";
  duplicatePageIds: string[];
}

export interface WorkQueueItem {
  title: string;
  priority: "P0" | "P1" | "P2" | "P3";
  system: "Cross-System" | "WebApp" | "Capture" | "Pipeline" | "Validation";
  businessLane?: "Executive" | "Ops" | "Growth" | "Buyer" | "Capturer" | "Experiment" | "Risk";
  lifecycleStage: string;
  workType: "Task" | "Research" | "Refresh" | "SOP" | "Improvement";
  substage?: string;
  outputLocation?: "Notion" | "Repo" | "External";
  executionSurface?: "Notion" | "Repo" | "Browser";
  dueDate?: string;
  needsFounder?: boolean;
  lastStatusChange?: string;
  escalateAfter?: string;
  ownerIds?: string[];
  requestedByIds?: string[];
  relatedDocPageIds?: string[];
  relatedDocPageUrls?: string[];
  relatedSkillPageIds?: string[];
  relatedSkillPageUrls?: string[];
  naturalKey?: string;
}

export interface WorkQueueQuery {
  system?: string;
  priority?: string;
  lifecycleStage?: string;
  businessLane?: string;
  needsFounder?: boolean;
}

export interface WorkQueueQueryItem {
  id: string;
  title: string;
  priority: string;
  system: string;
  businessLane: string;
  lifecycleStage: string;
  workType: string;
  url?: string;
  needsFounder: boolean;
  ownerIds: string[];
  dueDate?: string;
  lastStatusChange?: string;
  escalateAfter?: string;
  lastEditedTime?: string;
  naturalKey: string;
}

export interface WorkQueueScanConflict {
  key: string;
  canonicalItem: WorkQueueQueryItem;
  entries: WorkQueueQueryItem[];
  issueStatuses: string[];
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const value = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function normalizeScanIdentityPart(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function canonicalWorkQueueScanKey(item: Pick<WorkQueueQueryItem, "title" | "system" | "workType" | "naturalKey">) {
  const naturalKeyParts = (item.naturalKey ?? "")
    .split("::")
    .map((part) => normalizeScanIdentityPart(part))
    .filter(Boolean);
  if (naturalKeyParts.length > 0) {
    return naturalKeyParts.join("::");
  }

  return [
    normalizeScanIdentityPart(item.title),
    normalizeScanIdentityPart(item.system),
    normalizeScanIdentityPart(item.workType),
  ].join("::");
}

export function mapWorkQueueLifecycleStageToIssueStatus(
  lifecycleStage: string | undefined,
): "backlog" | "in_progress" | "blocked" | "done" {
  const normalized = normalizeScanIdentityPart(lifecycleStage);
  switch (normalized) {
    case "in progress":
      return "in_progress";
    case "blocked":
    case "waiting on external":
    case "waiting on founder":
      return "blocked";
    case "done":
      return "done";
    default:
      return "backlog";
  }
}

export function extractAnalyticsSnapshotDate(title: string | undefined) {
  const match = /^(analytics (daily|weekly) snapshot)\s*-\s*(\d{4}-\d{2}-\d{2})$/i.exec(asString(title) ?? "");
  if (!match || !match[2] || !match[3]) {
    return null;
  }
  return {
    cadence: match[2].toLowerCase() as "daily" | "weekly",
    date: match[3],
  };
}

export function isStaleAnalyticsSnapshotQueueItem(
  item: Pick<WorkQueueQueryItem, "title">,
  options?: { now?: Date; timeZone?: string },
) {
  const snapshot = extractAnalyticsSnapshotDate(item.title);
  if (!snapshot) {
    return false;
  }
  const now = options?.now ?? new Date();
  const timeZone = options?.timeZone ?? "America/New_York";
  const today = formatDateInTimeZone(now, timeZone);
  return snapshot.date < today;
}

export interface KnowledgeEntry {
  title: string;
  type: "Concept" | "Reference" | "How-To" | "Decision" | "Architecture" | "Contract";
  system: "Cross-System" | "WebApp" | "Capture" | "Pipeline" | "Validation";
  content: string;
  artifactType?:
    | "Morning Founder Brief"
    | "EoD Founder Brief"
    | "Daily Accountability Report"
    | "Friday Operating Recap"
    | "Weekly Gaps Report"
    | "Exception Summary"
    | "Experiment Outcome";
  agentSurfaces?: string[];
  sourceOfTruth?: "Notion" | "Repo";
  canonicalSource?: string;
  lastReviewed?: string;
  reviewCadence?: "Weekly" | "Monthly" | "Quarterly" | "Ad Hoc";
  lifecycleStage?: string;
  substage?: string;
  ownerIds?: string[];
  relatedWorkPageIds?: string[];
  relatedWorkPageUrls?: string[];
  relatedSkillPageIds?: string[];
  relatedSkillPageUrls?: string[];
  naturalKey?: string;
}

export interface SkillMetadata {
  title: string;
  skillType?: "System" | "Knowledge" | "Workflow";
  system?: "Cross-System" | "WebApp" | "Capture" | "Pipeline" | "Validation";
  canonicalSkillFile?: string;
  lifecycleStage?: string;
  ownerIds?: string[];
  agentSurfaces?: string[];
  relatedDocPageIds?: string[];
  relatedDocPageUrls?: string[];
  naturalKey?: string;
}

export interface AgentRegistryEntry {
  title: string;
  canonicalKey?: string;
  department?: "Executive" | "Engineering" | "Ops" | "Growth";
  role?: "Lead" | "Specialist" | "Reviewer" | "Implementer" | "CI Watch" | "Coordinator";
  primaryRuntime?:
    | "Paperclip/Hermes"
    | "Paperclip/Codex"
    | "Notion Custom Agent"
    | "External Coding Agent"
    | "Human-only";
  notionSurfaces?: string[];
  status?: "Active" | "Pilot" | "Paused" | "Disabled";
  ownerIds?: string[];
  humanGates?: string[];
  readableSurfaces?: string[];
  writableSurfaces?: string[];
  toolAccess?: string[];
  paperclipAgentKey?: string;
  notionAgentUrl?: string;
  defaultTriggers?: string[];
  lastActive?: string;
  lastRunStatus?: "Unknown" | "Ready" | "Running" | "Waiting on Human" | "Blocked" | "Failed" | "Done";
  linkedSkillPageIds?: string[];
  linkedSkillPageUrls?: string[];
  needsAccessReview?: boolean;
  lastPermissionReview?: string;
  instructionsSource?: string;
  reportsToPageIds?: string[];
  reportsToPageUrls?: string[];
  directReportPageIds?: string[];
  directReportPageUrls?: string[];
  latestRunPageIds?: string[];
  latestRunPageUrls?: string[];
}

export interface AgentRunEntry {
  title: string;
  runId?: string;
  agentPageIds?: string[];
  agentPageUrls?: string[];
  agentKey?: string;
  runtime?: "Paperclip/Hermes" | "Paperclip/Codex" | "Notion Custom Agent" | "External Coding Agent";
  status?: "Queued" | "Running" | "Waiting on Human" | "Blocked" | "Failed" | "Done" | "Canceled";
  triggerSource?: "Schedule" | "Webhook" | "Manual" | "Comment Mention" | "Database Update" | "Task Assignment";
  sourceWorkItemPageIds?: string[];
  sourceWorkItemPageUrls?: string[];
  outputDocPageIds?: string[];
  outputDocPageUrls?: string[];
  startedAt?: string;
  endedAt?: string;
  artifactUrl?: string;
  paperclipUrl?: string;
  errorSummary?: string;
  requiresHumanReview?: boolean;
  approverIds?: string[];
  costClass?: "Low" | "Medium" | "High";
  notes?: string;
}

export interface NotionPageSummary {
  id: string;
  url?: string;
  title: string;
  database: NotionDatabaseKey | "unknown";
  createdTime?: string;
  lastEditedTime?: string;
  archived: boolean;
  stale: boolean;
  properties?: Record<string, unknown>;
}

export interface SimpleTextBlock {
  type: "heading_1" | "heading_2" | "heading_3" | "paragraph" | "bulleted_list_item";
  text: string;
}

interface PageLike {
  id: string;
  archived?: boolean;
  created_time?: string;
  last_edited_time?: string;
}

export interface UpsertPlan<T extends PageLike> {
  action: "create" | "update";
  canonical: T | null;
  duplicates: T[];
}

export interface KnowledgeFreshnessCandidate {
  id: string;
  reviewCadence?: string | null;
  lastReviewed?: string | null;
  lastEditedTime?: string | null;
}

export function createNotionClient(config: NotionConfig): Client {
  return new Client({
    auth: config.token,
    timeoutMs: Number(process.env.BLUEPRINT_NOTION_TIMEOUT_MS || "180000"),
  });
}

function notionClient(client: Client): NotionClientAny {
  return client as NotionClientAny;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asRichTextPlainText(value: unknown): string | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const content = value
    .map((entry) => (
      typeof entry === "object" && entry !== null
        ? asString((entry as { plain_text?: unknown }).plain_text)
          ?? asString((entry as { text?: { content?: unknown } }).text?.content)
        : undefined
    ))
    .filter((entry): entry is string => Boolean(entry))
    .join("")
    .trim();

  return content.length > 0 ? content : undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  const single = asString(value);
  return single ? [single] : [];
}

export function resolveRepoKnowledgeLastReviewed(entry: KnowledgeEntry): string | undefined {
  if (entry.sourceOfTruth !== "Repo" || !entry.canonicalSource) {
    return undefined;
  }

  const candidatePath = path.isAbsolute(entry.canonicalSource)
    ? entry.canonicalSource
    : path.resolve(BLUEPRINT_WEBAPP_REPO_ROOT, entry.canonicalSource);

  if (!existsSync(candidatePath)) {
    return undefined;
  }

  try {
    return new Date(statSync(candidatePath).mtimeMs).toISOString();
  } catch {
    return undefined;
  }
}

function unique(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function toIsoDate(value: string | undefined): string | undefined {
  const trimmed = asString(value);
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function toIsoDateOrDateTime(value: string | undefined): string | undefined {
  const trimmed = asString(value);
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function extractNotionId(value: string | undefined): string | null {
  const trimmed = asString(value);
  if (!trimmed) return null;
  const cleaned = trimmed.replace(/[^a-fA-F0-9]/g, "");
  if (cleaned.length === 32) {
    return [
      cleaned.slice(0, 8),
      cleaned.slice(8, 12),
      cleaned.slice(12, 16),
      cleaned.slice(16, 20),
      cleaned.slice(20, 32),
    ].join("-").toLowerCase();
  }
  const matches = trimmed.match(/[a-fA-F0-9]{32}|[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/g);
  if (!matches || matches.length === 0) return null;
  return extractNotionId(matches[matches.length - 1]);
}

function splitNotionTextContent(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n");
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < normalized.length) {
    const remaining = normalized.length - cursor;
    if (remaining <= NOTION_TEXT_CONTENT_LIMIT) {
      chunks.push(normalized.slice(cursor));
      break;
    }

    const window = normalized.slice(cursor, cursor + NOTION_TEXT_CONTENT_LIMIT);
    const splitAt = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const safeSplitAt = splitAt > 0 ? splitAt : NOTION_TEXT_CONTENT_LIMIT;
    chunks.push(normalized.slice(cursor, cursor + safeSplitAt));
    cursor += safeSplitAt;

    while (normalized[cursor] === "\n" || normalized[cursor] === " ") {
      cursor += 1;
    }
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

function buildParagraphRichText(content: string) {
  return splitNotionTextContent(content).map((chunk) => ({
    type: "text" as const,
    text: { content: chunk },
  }));
}

function buildSimpleTextBlock(block: SimpleTextBlock) {
  const richText = buildParagraphRichText(block.text);
  return {
    object: "block" as const,
    type: block.type,
    [block.type]: {
      rich_text: richText,
    },
  };
}

function buildTitleProperty(title: string) {
  return { title: [{ text: { content: title } }] };
}

function buildRichTextProperty(value: string | undefined) {
  const content = asString(value);
  return content ? { rich_text: [{ text: { content } }] } : undefined;
}

function buildSelectProperty(value: string | undefined) {
  const content = asString(value);
  return content ? { select: { name: content } } : undefined;
}

function buildMultiSelectProperty(values: string[] | undefined) {
  const normalized = unique(values ?? []);
  return normalized.length > 0
    ? { multi_select: normalized.map((name) => ({ name })) }
    : undefined;
}

function buildPeopleProperty(ids: string[] | undefined) {
  const normalized = unique((ids ?? []).map((value) => extractNotionId(value) ?? undefined));
  return normalized.length > 0
    ? { people: normalized.map((id) => ({ id })) }
    : undefined;
}

function buildRelationProperty(ids?: string[], urls?: string[]) {
  const normalized = unique([
    ...(ids ?? []).map((value) => extractNotionId(value) ?? undefined),
    ...(urls ?? []).map((value) => extractNotionId(value) ?? undefined),
  ]);
  return normalized.length > 0
    ? { relation: normalized.map((id) => ({ id })) }
    : undefined;
}

function buildDateProperty(value: string | undefined) {
  const start = toIsoDateOrDateTime(value);
  return start ? { date: { start } } : undefined;
}

function buildCheckboxProperty(value: boolean | undefined) {
  return typeof value === "boolean" ? { checkbox: value } : undefined;
}

function maybeSet(target: Record<string, unknown>, key: string, value: unknown) {
  if (value !== undefined) target[key] = value;
}

function getTitleFromPage(page: any): string {
  const title = page?.properties?.Title?.title;
  if (Array.isArray(title) && title[0]?.plain_text) return title[0].plain_text;
  if (Array.isArray(title) && title[0]?.text?.content) return title[0].text.content;
  return "";
}

function detectDatabaseKey(page: any): NotionDatabaseKey | "unknown" {
  const databaseId = extractNotionId(page?.parent?.database_id);
  if (!databaseId) return "unknown";
  const match = Object.entries(DATABASE_CONFIG).find(([, config]) => config.databaseId === databaseId);
  return (match?.[0] as NotionDatabaseKey | undefined) ?? "unknown";
}

function summarizePage(page: any, staleIds = new Set<string>()): NotionPageSummary {
  return {
    id: page.id,
    url: asString(page.url),
    title: getTitleFromPage(page),
    database: detectDatabaseKey(page),
    createdTime: asString(page.created_time),
    lastEditedTime: asString(page.last_edited_time),
    archived: Boolean(page.archived ?? page.in_trash),
    stale: staleIds.has(page.id),
    properties: page.properties ?? {},
  };
}

export function planNotionUpsert<T extends PageLike>(matches: T[]): UpsertPlan<T> {
  if (matches.length === 0) {
    return { action: "create", canonical: null, duplicates: [] };
  }

  const sorted = [...matches].sort((left, right) => {
    const leftArchived = left.archived ? 1 : 0;
    const rightArchived = right.archived ? 1 : 0;
    if (leftArchived !== rightArchived) return leftArchived - rightArchived;
    const leftTime = new Date(left.last_edited_time ?? left.created_time ?? 0).getTime();
    const rightTime = new Date(right.last_edited_time ?? right.created_time ?? 0).getTime();
    return rightTime - leftTime;
  });

  return {
    action: "update",
    canonical: sorted[0] ?? null,
    duplicates: sorted.slice(1),
  };
}

export function detectStaleKnowledgeEntries(
  entries: KnowledgeFreshnessCandidate[],
  nowIso: string,
): string[] {
  const now = new Date(nowIso).getTime();
  return entries
    .filter((entry) => {
      const cadence = asString(entry.reviewCadence);
      if (!cadence || cadence === "Ad Hoc") return false;
      const threshold = KNOWLEDGE_REVIEW_WINDOWS_DAYS[cadence];
      if (!threshold) return false;
      const anchor = asString(entry.lastReviewed) ?? asString(entry.lastEditedTime);
      if (!anchor) return true;
      const anchorTime = new Date(anchor).getTime();
      if (Number.isNaN(anchorTime)) return true;
      const ageDays = (now - anchorTime) / (1000 * 60 * 60 * 24);
      return ageDays > threshold;
    })
    .map((entry) => entry.id);
}

function workQueueMatchKeys(item: Pick<WorkQueueItem, "title" | "system" | "workType" | "naturalKey">) {
  const keys = new Set<string>();
  keys.add(canonicalWorkQueueScanKey(item as Pick<WorkQueueQueryItem, "title" | "system" | "workType" | "naturalKey">));
  keys.add(canonicalWorkQueueScanKey({
    title: item.title,
    system: item.system,
    workType: item.workType,
    naturalKey: `${item.title}::${item.system}::${item.workType}`,
  }));
  return [...keys].filter(Boolean);
}

function workQueuePageMatchKeys(page: any) {
  return workQueueMatchKeys({
    title: getTitleFromPage(page),
    system: page?.properties?.System?.select?.name ?? "",
    workType: page?.properties?.["Work Type"]?.select?.name ?? "",
    naturalKey: asRichTextPlainText(page?.properties?.["Natural Key"]?.rich_text),
  });
}

function knowledgeNaturalKey(entry: KnowledgeEntry): string {
  return unique([entry.naturalKey, entry.title, entry.system, entry.type]).join("::");
}

function skillsNaturalKey(entry: SkillMetadata): string {
  return unique([entry.naturalKey, entry.title, entry.system, entry.skillType]).join("::");
}

function inferBusinessLane(input: Partial<WorkQueueItem> & Record<string, unknown>, includeDefaults: boolean): WorkQueueItem["businessLane"] {
  const explicit = asString(input.businessLane) as WorkQueueItem["businessLane"] | undefined;
  if (explicit) return explicit;

  const title = `${asString(input.title) ?? ""} ${asString(input.substage) ?? ""}`.toLowerCase();
  const system = asString(input.system);

  if (title.includes("experiment")) return "Experiment";
  if (title.includes("buyer") || title.includes("proof") || title.includes("quote") || title.includes("deal")) return "Buyer";
  if (title.includes("capturer") || title.includes("waitlist") || title.includes("capture")) return "Capturer";
  if (title.includes("rights") || title.includes("privacy") || title.includes("provenance") || title.includes("security")) return "Risk";
  if (title.includes("growth") || title.includes("market intel") || title.includes("demand intel") || title.includes("community")) return "Growth";
  if (system === "Cross-System") return includeDefaults ? "Executive" : undefined;
  if (system === "WebApp" || system === "Capture" || system === "Pipeline") return includeDefaults ? "Ops" : undefined;
  return includeDefaults ? "Ops" : undefined;
}

export function normalizeWorkQueueItem(input: Partial<WorkQueueItem> & Record<string, unknown>, includeDefaults: boolean): WorkQueueItem {
  return {
    title: (asString(input.title) ?? (includeDefaults ? "Untitled work item" : undefined)) as WorkQueueItem["title"],
    priority: (asString(input.priority) as WorkQueueItem["priority"] | undefined) ?? (includeDefaults ? "P2" : undefined as never),
    system: (asString(input.system) as WorkQueueItem["system"] | undefined) ?? (includeDefaults ? "Cross-System" : undefined as never),
    businessLane: inferBusinessLane(input, includeDefaults),
    lifecycleStage: asString(input.lifecycleStage) ?? asString(input.status) ?? (includeDefaults ? "Open" : ""),
    workType: (asString(input.workType) as WorkQueueItem["workType"] | undefined) ?? (includeDefaults ? "Task" : undefined as never),
    substage: asString(input.substage) ?? asString(input.description),
    outputLocation: asString(input.outputLocation) as WorkQueueItem["outputLocation"] | undefined,
    executionSurface: asString(input.executionSurface) as WorkQueueItem["executionSurface"] | undefined,
    dueDate: asString(input.dueDate),
    needsFounder: typeof input.needsFounder === "boolean" ? input.needsFounder : undefined,
    lastStatusChange: asString(input.lastStatusChange),
    escalateAfter: asString(input.escalateAfter),
    ownerIds: asStringArray(input.ownerIds),
    requestedByIds: asStringArray(input.requestedByIds),
    relatedDocPageIds: asStringArray(input.relatedDocPageIds),
    relatedDocPageUrls: asStringArray(input.relatedDocPageUrls),
    relatedSkillPageIds: asStringArray(input.relatedSkillPageIds),
    relatedSkillPageUrls: asStringArray(input.relatedSkillPageUrls),
    naturalKey: asString(input.naturalKey),
  };
}

export function normalizeKnowledgeEntry(input: Partial<KnowledgeEntry> & Record<string, unknown>, includeDefaults: boolean): KnowledgeEntry {
  return {
    title: (asString(input.title) ?? (includeDefaults ? "Untitled knowledge entry" : undefined)) as KnowledgeEntry["title"],
    type: (asString(input.type) ?? asString(input.category) ?? (includeDefaults ? "Reference" : undefined)) as KnowledgeEntry["type"],
    system: (asString(input.system) ?? asString(input.source) ?? (includeDefaults ? "Cross-System" : undefined)) as KnowledgeEntry["system"],
    content: asString(input.content) ?? "",
    artifactType: asString(input.artifactType) as KnowledgeEntry["artifactType"] | undefined,
    agentSurfaces: asStringArray(input.agentSurfaces),
    sourceOfTruth: (asString(input.sourceOfTruth) as KnowledgeEntry["sourceOfTruth"] | undefined) ?? (includeDefaults ? "Notion" : undefined),
    canonicalSource: asString(input.canonicalSource),
    lastReviewed: asString(input.lastReviewed),
    reviewCadence: (asString(input.reviewCadence) as KnowledgeEntry["reviewCadence"] | undefined) ?? (includeDefaults ? "Ad Hoc" : undefined),
    lifecycleStage: asString(input.lifecycleStage),
    substage: asString(input.substage),
    ownerIds: asStringArray(input.ownerIds),
    relatedWorkPageIds: asStringArray(input.relatedWorkPageIds),
    relatedWorkPageUrls: asStringArray(input.relatedWorkPageUrls),
    relatedSkillPageIds: asStringArray(input.relatedSkillPageIds),
    relatedSkillPageUrls: asStringArray(input.relatedSkillPageUrls),
    naturalKey: asString(input.naturalKey),
  };
}

function normalizeSkillMetadata(input: Partial<SkillMetadata> & Record<string, unknown>, includeDefaults: boolean): SkillMetadata {
  return {
    title: (asString(input.title) ?? (includeDefaults ? "Untitled skill" : undefined)) as SkillMetadata["title"],
    skillType: (asString(input.skillType) as SkillMetadata["skillType"] | undefined) ?? (includeDefaults ? "Workflow" : undefined),
    system: (asString(input.system) as SkillMetadata["system"] | undefined) ?? (includeDefaults ? "Cross-System" : undefined),
    canonicalSkillFile: asString(input.canonicalSkillFile),
    lifecycleStage: asString(input.lifecycleStage),
    ownerIds: asStringArray(input.ownerIds),
    agentSurfaces: asStringArray(input.agentSurfaces),
    relatedDocPageIds: asStringArray(input.relatedDocPageIds),
    relatedDocPageUrls: asStringArray(input.relatedDocPageUrls),
    naturalKey: asString(input.naturalKey),
  };
}

function buildWorkQueueProperties(item: WorkQueueItem, includeDefaults = true) {
  const normalized = includeDefaults ? normalizeWorkQueueItem(item as unknown as Record<string, unknown>, true) : item;
  const properties: Record<string, unknown> = {};
  maybeSet(properties, "Title", asString(normalized.title) ? buildTitleProperty(normalized.title) : undefined);
  maybeSet(properties, "Priority", buildSelectProperty(normalized.priority));
  maybeSet(properties, "System", buildSelectProperty(normalized.system));
  maybeSet(properties, "Business Lane", buildSelectProperty(normalized.businessLane));
  maybeSet(properties, "Lifecycle Stage", buildSelectProperty(normalized.lifecycleStage));
  maybeSet(properties, "Work Type", buildSelectProperty(normalized.workType));
  maybeSet(properties, "Substage", buildRichTextProperty(normalized.substage));
  maybeSet(properties, "Output Location", buildSelectProperty(normalized.outputLocation ?? (includeDefaults ? "Notion" : undefined)));
  maybeSet(properties, "Execution Surface", buildSelectProperty(normalized.executionSurface ?? (includeDefaults ? "Notion" : undefined)));
  maybeSet(properties, "Due Date", buildDateProperty(normalized.dueDate));
  maybeSet(properties, "Needs Founder", buildCheckboxProperty(normalized.needsFounder ?? (includeDefaults ? false : undefined)));
  maybeSet(properties, "Last Status Change", buildDateProperty(normalized.lastStatusChange));
  maybeSet(properties, "Escalate After", buildDateProperty(normalized.escalateAfter));
  maybeSet(properties, "Owner", buildPeopleProperty(normalized.ownerIds));
  maybeSet(properties, "Requested By", buildPeopleProperty(normalized.requestedByIds));
  maybeSet(properties, "Linked Docs", buildRelationProperty(normalized.relatedDocPageIds, normalized.relatedDocPageUrls));
  maybeSet(properties, "Linked Skill", buildRelationProperty(normalized.relatedSkillPageIds, normalized.relatedSkillPageUrls));
  return properties;
}

function buildKnowledgeProperties(entry: KnowledgeEntry, includeDefaults = true) {
  const normalized = includeDefaults ? normalizeKnowledgeEntry(entry as unknown as Record<string, unknown>, true) : entry;
  const resolvedLastReviewed =
    normalized.lastReviewed
    ?? resolveRepoKnowledgeLastReviewed(normalized)
    ?? (includeDefaults ? new Date().toISOString() : undefined);
  const properties: Record<string, unknown> = {};
  maybeSet(properties, "Title", asString(normalized.title) ? buildTitleProperty(normalized.title) : undefined);
  maybeSet(properties, "Type", buildSelectProperty(normalized.type));
  maybeSet(properties, "System", buildSelectProperty(normalized.system));
  maybeSet(properties, "Artifact Type", buildSelectProperty(normalized.artifactType));
  maybeSet(properties, "Agent Surface", buildMultiSelectProperty(normalized.agentSurfaces?.length ? normalized.agentSurfaces : includeDefaults ? ["Shared"] : undefined));
  maybeSet(properties, "Source of Truth", buildSelectProperty(normalized.sourceOfTruth));
  maybeSet(properties, "Canonical Source", buildRichTextProperty(normalized.canonicalSource));
  maybeSet(properties, "Last Reviewed", buildDateProperty(resolvedLastReviewed));
  maybeSet(properties, "Review Cadence", buildSelectProperty(normalized.reviewCadence));
  maybeSet(properties, "Lifecycle Stage", buildSelectProperty(normalized.lifecycleStage));
  maybeSet(properties, "Substage", buildRichTextProperty(normalized.substage));
  maybeSet(properties, "Owner", buildPeopleProperty(normalized.ownerIds));
  maybeSet(properties, "Related Work", buildRelationProperty(normalized.relatedWorkPageIds, normalized.relatedWorkPageUrls));
  maybeSet(properties, "Related Skill", buildRelationProperty(normalized.relatedSkillPageIds, normalized.relatedSkillPageUrls));
  return properties;
}

function buildSkillProperties(entry: SkillMetadata, includeDefaults = true) {
  const normalized = includeDefaults ? normalizeSkillMetadata(entry as unknown as Record<string, unknown>, true) : entry;
  const properties: Record<string, unknown> = {};
  maybeSet(properties, "Title", asString(normalized.title) ? buildTitleProperty(normalized.title) : undefined);
  maybeSet(properties, "Skill Type", buildSelectProperty(normalized.skillType));
  maybeSet(properties, "System", buildSelectProperty(normalized.system));
  maybeSet(properties, "Canonical Skill File", buildRichTextProperty(normalized.canonicalSkillFile));
  maybeSet(properties, "Lifecycle Stage", buildSelectProperty(normalized.lifecycleStage));
  maybeSet(properties, "Owner", buildPeopleProperty(normalized.ownerIds));
  maybeSet(properties, "Agent Surface", buildMultiSelectProperty(normalized.agentSurfaces));
  maybeSet(properties, "Related Docs", buildRelationProperty(normalized.relatedDocPageIds, normalized.relatedDocPageUrls));
  return properties;
}

function normalizeAgentRegistryEntry(input: Record<string, unknown>, includeDefaults: boolean): AgentRegistryEntry {
  return {
    title: (asString(input.title) ?? asString(input.Agent) ?? (includeDefaults ? "Untitled agent" : undefined)) as AgentRegistryEntry["title"],
    canonicalKey: asString(input.canonicalKey) ?? asString(input["Canonical Key"]),
    department: asString(input.department ?? input.Department) as AgentRegistryEntry["department"] | undefined,
    role: asString(input.role ?? input.Role) as AgentRegistryEntry["role"] | undefined,
    primaryRuntime: asString(input.primaryRuntime ?? input["Primary Runtime"]) as AgentRegistryEntry["primaryRuntime"] | undefined,
    notionSurfaces: asStringArray(input.notionSurfaces ?? input["Notion Surface"]),
    status: (asString(input.status ?? input.Status) as AgentRegistryEntry["status"] | undefined) ?? (includeDefaults ? "Active" : undefined),
    ownerIds: asStringArray(input.ownerIds ?? input.Owner),
    humanGates: asStringArray(input.humanGates ?? input["Human Gate"]),
    readableSurfaces: asStringArray(input.readableSurfaces ?? input["Readable Surfaces"]),
    writableSurfaces: asStringArray(input.writableSurfaces ?? input["Writable Surfaces"]),
    toolAccess: asStringArray(input.toolAccess ?? input["Tool Access"]),
    paperclipAgentKey: asString(input.paperclipAgentKey ?? input["Paperclip Agent Key"]),
    notionAgentUrl: asString(input.notionAgentUrl ?? input["Notion Agent URL"]),
    defaultTriggers: asStringArray(input.defaultTriggers ?? input["Default Trigger"]),
    lastActive: asString(input.lastActive ?? input["Last Active"]),
    lastRunStatus: (asString(input.lastRunStatus ?? input["Last Run Status"]) as AgentRegistryEntry["lastRunStatus"] | undefined)
      ?? (includeDefaults ? "Unknown" : undefined),
    linkedSkillPageIds: asStringArray(input.linkedSkillPageIds),
    linkedSkillPageUrls: asStringArray(input.linkedSkillPageUrls ?? input["Linked Skills"]),
    needsAccessReview: typeof input.needsAccessReview === "boolean"
      ? input.needsAccessReview
      : String(input["Needs Access Review"] ?? "").trim() === "__YES__"
        ? true
        : includeDefaults ? false : undefined,
    lastPermissionReview: asString(input.lastPermissionReview ?? input["Last Permission Review"]),
    instructionsSource: asString(input.instructionsSource ?? input["Instructions Source"]),
    reportsToPageIds: asStringArray(input.reportsToPageIds),
    reportsToPageUrls: asStringArray(input["Reports To"] ?? input.reportsToPageUrls),
    directReportPageIds: asStringArray(input.directReportPageIds),
    directReportPageUrls: asStringArray(input["Direct Reports"] ?? input.directReportPageUrls),
    latestRunPageIds: asStringArray(input.latestRunPageIds),
    latestRunPageUrls: asStringArray(input["Latest Run"] ?? input.latestRunPageUrls),
  };
}

function normalizeAgentRunEntry(input: Record<string, unknown>, includeDefaults: boolean): AgentRunEntry {
  return {
    title: (asString(input.title) ?? asString(input.Run) ?? (includeDefaults ? "Untitled run" : undefined)) as AgentRunEntry["title"],
    runId: asString(input.runId ?? input["Run ID"]),
    agentPageIds: asStringArray(input.agentPageIds),
    agentPageUrls: asStringArray(input.Agent ?? input.agentPageUrls),
    agentKey: asString(input.agentKey ?? input["Agent Key"]),
    runtime: asString(input.runtime ?? input.Runtime) as AgentRunEntry["runtime"] | undefined,
    status: (asString(input.status ?? input.Status) as AgentRunEntry["status"] | undefined) ?? (includeDefaults ? "Queued" : undefined),
    triggerSource: asString(input.triggerSource ?? input["Trigger Source"]) as AgentRunEntry["triggerSource"] | undefined,
    sourceWorkItemPageIds: asStringArray(input.sourceWorkItemPageIds),
    sourceWorkItemPageUrls: asStringArray(input["Source Work Item"] ?? input.sourceWorkItemPageUrls),
    outputDocPageIds: asStringArray(input.outputDocPageIds),
    outputDocPageUrls: asStringArray(input["Output Doc"] ?? input.outputDocPageUrls),
    startedAt: asString(input.startedAt ?? input["Started At"]),
    endedAt: asString(input.endedAt ?? input["Ended At"]),
    artifactUrl: asString(input.artifactUrl ?? input["Artifact URL"]),
    paperclipUrl: asString(input.paperclipUrl ?? input["Paperclip URL"]),
    errorSummary: asString(input.errorSummary ?? input["Error Summary"]),
    requiresHumanReview: typeof input.requiresHumanReview === "boolean"
      ? input.requiresHumanReview
      : String(input["Requires Human Review"] ?? "").trim() === "__YES__"
        ? true
        : includeDefaults ? false : undefined,
    approverIds: asStringArray(input.approverIds ?? input.Approver),
    costClass: asString(input.costClass ?? input["Cost Class"]) as AgentRunEntry["costClass"] | undefined,
    notes: asString(input.notes ?? input.Notes),
  };
}

function buildAgentRegistryProperties(entry: AgentRegistryEntry, includeDefaults = true) {
  const normalized = includeDefaults
    ? normalizeAgentRegistryEntry(entry as unknown as Record<string, unknown>, true)
    : entry;
  const properties: Record<string, unknown> = {};
  maybeSet(properties, "Agent", asString(normalized.title) ? buildTitleProperty(normalized.title) : undefined);
  maybeSet(properties, "Canonical Key", buildRichTextProperty(normalized.canonicalKey));
  maybeSet(properties, "Department", buildSelectProperty(normalized.department));
  maybeSet(properties, "Role", buildSelectProperty(normalized.role));
  maybeSet(properties, "Primary Runtime", buildSelectProperty(normalized.primaryRuntime));
  maybeSet(properties, "Notion Surface", buildMultiSelectProperty(normalized.notionSurfaces));
  maybeSet(properties, "Status", buildSelectProperty(normalized.status));
  maybeSet(properties, "Owner", buildPeopleProperty(normalized.ownerIds));
  maybeSet(properties, "Human Gate", buildMultiSelectProperty(normalized.humanGates));
  maybeSet(properties, "Readable Surfaces", buildMultiSelectProperty(normalized.readableSurfaces));
  maybeSet(properties, "Writable Surfaces", buildMultiSelectProperty(normalized.writableSurfaces));
  maybeSet(properties, "Tool Access", buildMultiSelectProperty(normalized.toolAccess));
  maybeSet(properties, "Paperclip Agent Key", buildRichTextProperty(normalized.paperclipAgentKey));
  maybeSet(properties, "Notion Agent URL", normalized.notionAgentUrl ? { url: normalized.notionAgentUrl } : undefined);
  maybeSet(properties, "Default Trigger", buildMultiSelectProperty(normalized.defaultTriggers));
  maybeSet(properties, "Last Active", buildDateProperty(normalized.lastActive));
  maybeSet(properties, "Last Run Status", buildSelectProperty(normalized.lastRunStatus));
  maybeSet(properties, "Linked Skills", buildRelationProperty(normalized.linkedSkillPageIds, normalized.linkedSkillPageUrls));
  maybeSet(properties, "Needs Access Review", buildCheckboxProperty(normalized.needsAccessReview));
  maybeSet(properties, "Last Permission Review", buildDateProperty(normalized.lastPermissionReview));
  maybeSet(properties, "Instructions Source", normalized.instructionsSource ? { url: normalized.instructionsSource } : undefined);
  maybeSet(properties, "Reports To", buildRelationProperty(normalized.reportsToPageIds, normalized.reportsToPageUrls));
  maybeSet(properties, "Direct Reports", buildRelationProperty(normalized.directReportPageIds, normalized.directReportPageUrls));
  maybeSet(properties, "Latest Run", buildRelationProperty(normalized.latestRunPageIds, normalized.latestRunPageUrls));
  return properties;
}

function buildAgentRunProperties(entry: AgentRunEntry, includeDefaults = true) {
  const normalized = includeDefaults
    ? normalizeAgentRunEntry(entry as unknown as Record<string, unknown>, true)
    : entry;
  const properties: Record<string, unknown> = {};
  maybeSet(properties, "Run", asString(normalized.title) ? buildTitleProperty(normalized.title) : undefined);
  maybeSet(properties, "Run ID", buildRichTextProperty(normalized.runId));
  maybeSet(properties, "Agent", buildRelationProperty(normalized.agentPageIds, normalized.agentPageUrls));
  maybeSet(properties, "Agent Key", buildRichTextProperty(normalized.agentKey));
  maybeSet(properties, "Runtime", buildSelectProperty(normalized.runtime));
  maybeSet(properties, "Status", buildSelectProperty(normalized.status));
  maybeSet(properties, "Trigger Source", buildSelectProperty(normalized.triggerSource));
  maybeSet(properties, "Source Work Item", buildRelationProperty(normalized.sourceWorkItemPageIds, normalized.sourceWorkItemPageUrls));
  maybeSet(properties, "Output Doc", buildRelationProperty(normalized.outputDocPageIds, normalized.outputDocPageUrls));
  maybeSet(properties, "Started At", buildDateProperty(normalized.startedAt));
  maybeSet(properties, "Ended At", buildDateProperty(normalized.endedAt));
  maybeSet(properties, "Artifact URL", normalized.artifactUrl ? { url: normalized.artifactUrl } : undefined);
  maybeSet(properties, "Paperclip URL", normalized.paperclipUrl ? { url: normalized.paperclipUrl } : undefined);
  maybeSet(properties, "Error Summary", buildRichTextProperty(normalized.errorSummary));
  maybeSet(properties, "Requires Human Review", buildCheckboxProperty(normalized.requiresHumanReview));
  maybeSet(properties, "Approver", buildPeopleProperty(normalized.approverIds));
  maybeSet(properties, "Cost Class", buildSelectProperty(normalized.costClass));
  maybeSet(properties, "Notes", buildRichTextProperty(normalized.notes));
  return properties;
}

async function queryDatabaseByTitle(client: Client, database: NotionDatabaseKey, title: string): Promise<any[]> {
  const notion = notionClient(client);
  const allResults: any[] = [];
  let startCursor: string | undefined = undefined;
  do {
    const response: any = await notion.dataSources.query({
      data_source_id: DATABASE_CONFIG[database].dataSourceId,
      filter: {
        property: DATABASE_CONFIG[database].titleProperty,
        title: { equals: title },
      },
      page_size: 25,
      start_cursor: startCursor,
    });
    const results = (response.results ?? []) as any[];
    allResults.push(...results);
    startCursor = response.has_more ? (response.next_cursor as string | undefined) : undefined;
  } while (startCursor);
  return allResults;
}

export async function queryDatabase(client: Client, database: NotionDatabaseKey, pageSize = 50): Promise<any[]> {
  const notion = notionClient(client);
  const results: any[] = [];
  let startCursor: string | undefined;

  do {
    const response = await notion.dataSources.query({
      data_source_id: DATABASE_CONFIG[database].dataSourceId,
      page_size: Math.min(100, pageSize),
      start_cursor: startCursor,
    });
    results.push(...((response.results ?? []) as any[]));
    startCursor = response.has_more ? (response.next_cursor as string | undefined) : undefined;
  } while (startCursor);

  return results;
}

function filterWorkQueueMatches(pages: any[], item: WorkQueueItem): any[] {
  const keys = new Set(workQueueMatchKeys(item));
  return pages.filter((page) => {
    const pageKeys = workQueuePageMatchKeys(page);
    return pageKeys.some((pageKey) => keys.has(pageKey));
  });
}

function filterKnowledgeMatches(pages: any[], entry: KnowledgeEntry): any[] {
  const key = knowledgeNaturalKey(entry);
  return pages.filter((page) => {
    const pageKey = unique([
      getTitleFromPage(page),
      page?.properties?.System?.select?.name,
      page?.properties?.Type?.select?.name,
    ]).join("::");
    return getTitleFromPage(page) === entry.title && pageKey === key;
  });
}

function filterSkillMatches(pages: any[], entry: SkillMetadata): any[] {
  const key = skillsNaturalKey(entry);
  return pages.filter((page) => {
    const pageKey = unique([
      getTitleFromPage(page),
      page?.properties?.System?.select?.name,
      page?.properties?.["Skill Type"]?.select?.name,
    ]).join("::");
    return getTitleFromPage(page) === entry.title && pageKey === key;
  });
}

function filterAgentRegistryMatches(pages: any[], entry: AgentRegistryEntry): any[] {
  return pages.filter((page) => {
    const pageTitle = getTitleFromPage(page);
    const pageCanonicalKey = asRichTextPlainText(page?.properties?.["Canonical Key"]?.rich_text);
    const pagePaperclipKey = asRichTextPlainText(page?.properties?.["Paperclip Agent Key"]?.rich_text);
    return (
      (entry.paperclipAgentKey && pagePaperclipKey === entry.paperclipAgentKey)
      || (entry.canonicalKey && pageCanonicalKey === entry.canonicalKey)
      || pageTitle === entry.title
    );
  });
}

function filterAgentRunMatches(pages: any[], entry: AgentRunEntry): any[] {
  return pages.filter((page) => {
    const pageTitle = getTitleFromPage(page);
    const pageRunId = asRichTextPlainText(page?.properties?.["Run ID"]?.rich_text);
    const pageAgentKey = asRichTextPlainText(page?.properties?.["Agent Key"]?.rich_text);
    return (
      (entry.runId && pageRunId === entry.runId)
      || (entry.runId && entry.agentKey && pageRunId === entry.runId && pageAgentKey === entry.agentKey)
      || (pageTitle === entry.title && (!entry.agentKey || pageAgentKey === entry.agentKey))
    );
  });
}

async function archiveDuplicatePages(client: Client, duplicates: any[]) {
  const notion = notionClient(client);
  for (const duplicate of duplicates) {
    await notion.pages.update({
      page_id: duplicate.id,
      archived: true,
    });
  }
}

export async function createWorkQueueItem(client: Client, item: WorkQueueItem): Promise<NotionWriteResult> {
  const notion = notionClient(client);
  const response = await notion.pages.create({
    parent: { database_id: WORK_QUEUE_DB },
    properties: buildWorkQueueProperties(item, true) as any,
  });
  return { pageId: response.id, pageUrl: asString(response.url) };
}

export async function upsertWorkQueueItem(
  client: Client,
  item: WorkQueueItem,
  options?: { archiveDuplicates?: boolean },
): Promise<NotionUpsertResult> {
  const notion = notionClient(client);
  const matches = filterWorkQueueMatches(await queryDatabaseByTitle(client, "work_queue", item.title), item);
  const plan = planNotionUpsert(matches);
  if (plan.action === "create" || !plan.canonical) {
    const created = await createWorkQueueItem(client, item);
    return { ...created, status: "created", duplicatePageIds: [] };
  }
  const response = await notion.pages.update({
    page_id: plan.canonical.id,
    properties: buildWorkQueueProperties(item, true) as any,
  });
  if (options?.archiveDuplicates && plan.duplicates.length > 0) {
    await archiveDuplicatePages(client, plan.duplicates);
  }
  return {
    pageId: response.id,
    pageUrl: asString(response.url),
    status: "updated",
    duplicatePageIds: plan.duplicates.map((page) => page.id),
  };
}

export async function findWorkQueueItemPage(
  client: Client,
  item: WorkQueueItem,
): Promise<NotionWriteResult | null> {
  const matches = filterWorkQueueMatches(await queryDatabaseByTitle(client, "work_queue", item.title), item);
  const plan = planNotionUpsert(matches);
  if (!plan.canonical) {
    return null;
  }
  return {
    pageId: plan.canonical.id,
    pageUrl: asString(plan.canonical.url),
  };
}

export async function queryWorkQueue(client: Client, filters: WorkQueueQuery): Promise<WorkQueueQueryItem[]> {
  const filterConditions: Record<string, unknown>[] = [];
  if (filters.system) filterConditions.push({ property: "System", select: { equals: filters.system } });
  if (filters.priority) filterConditions.push({ property: "Priority", select: { equals: filters.priority } });
  if (filters.lifecycleStage) {
    filterConditions.push({ property: "Lifecycle Stage", select: { equals: filters.lifecycleStage } });
  }
  if (filters.businessLane) {
    filterConditions.push({ property: "Business Lane", select: { equals: filters.businessLane } });
  }
  if (typeof filters.needsFounder === "boolean") {
    filterConditions.push({ property: "Needs Founder", checkbox: { equals: filters.needsFounder } });
  }

  const notion = notionClient(client);
  const response = await notion.dataSources.query({
    data_source_id: WORK_QUEUE_DS,
    filter:
      filterConditions.length > 1
        ? { and: filterConditions }
        : filterConditions.length === 1
          ? filterConditions[0]
          : undefined,
    page_size: 50,
  });

  return (response.results ?? []).map((page: any) => ({
    id: page.id,
    title: getTitleFromPage(page),
    priority: page?.properties?.Priority?.select?.name ?? "",
    system: page?.properties?.System?.select?.name ?? "",
    businessLane: page?.properties?.["Business Lane"]?.select?.name ?? "",
    lifecycleStage: page?.properties?.["Lifecycle Stage"]?.select?.name ?? "",
    workType: page?.properties?.["Work Type"]?.select?.name ?? "",
    url: asString(page.url),
    needsFounder: page?.properties?.["Needs Founder"]?.checkbox === true,
    ownerIds:
      Array.isArray(page?.properties?.Owner?.people)
        ? page.properties.Owner.people
            .map((entry: any) => asString(entry?.id))
            .filter((value: string | undefined): value is string => Boolean(value))
        : [],
    dueDate: asString(page?.properties?.["Due Date"]?.date?.start),
    lastStatusChange: asString(page?.properties?.["Last Status Change"]?.date?.start),
    escalateAfter: asString(page?.properties?.["Escalate After"]?.date?.start),
    lastEditedTime: asString(page?.last_edited_time),
    naturalKey:
      asRichTextPlainText(page?.properties?.["Natural Key"]?.rich_text)
      ?? unique([
        getTitleFromPage(page),
        page?.properties?.System?.select?.name,
        page?.properties?.["Work Type"]?.select?.name,
      ]).join("::"),
  }));
}

function timestampRank(value: string | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function compareCanonicalWorkQueueItems(left: WorkQueueQueryItem, right: WorkQueueQueryItem) {
  const lastStatusChangeDelta =
    timestampRank(right.lastStatusChange) - timestampRank(left.lastStatusChange);
  if (lastStatusChangeDelta !== 0) return lastStatusChangeDelta;

  const lastEditedDelta =
    timestampRank(right.lastEditedTime) - timestampRank(left.lastEditedTime);
  if (lastEditedDelta !== 0) return lastEditedDelta;

  const dueDateDelta = timestampRank(right.dueDate) - timestampRank(left.dueDate);
  if (dueDateDelta !== 0) return dueDateDelta;

  return left.id.localeCompare(right.id);
}

export function collapseWorkQueueItemsByNaturalKey(items: WorkQueueQueryItem[]): WorkQueueQueryItem[] {
  const canonicalByNaturalKey = new Map<string, WorkQueueQueryItem>();

  for (const item of items) {
    const key = canonicalWorkQueueScanKey(item);
    const existing = canonicalByNaturalKey.get(key);
    if (!existing || compareCanonicalWorkQueueItems(item, existing) < 0) {
      canonicalByNaturalKey.set(key, item);
    }
  }

  return [...canonicalByNaturalKey.values()].sort((left, right) =>
    left.title.localeCompare(right.title)
    || left.system.localeCompare(right.system)
    || left.workType.localeCompare(right.workType),
  );
}

export function analyzeWorkQueueItemsForScan(items: WorkQueueQueryItem[]) {
  const groups = new Map<string, WorkQueueQueryItem[]>();

  for (const item of items) {
    const key = canonicalWorkQueueScanKey(item);
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  const actionableItems: WorkQueueQueryItem[] = [];
  const conflicts: WorkQueueScanConflict[] = [];

  for (const [key, entries] of groups.entries()) {
    const ranked = [...entries].sort(compareCanonicalWorkQueueItems);
    const canonicalItem = ranked[0];
    if (!canonicalItem) {
      continue;
    }

    const issueStatuses = [...new Set(entries.map((entry) => mapWorkQueueLifecycleStageToIssueStatus(entry.lifecycleStage)))];
    if (entries.length > 1 && issueStatuses.length > 1) {
      conflicts.push({
        key,
        canonicalItem,
        entries: ranked,
        issueStatuses,
      });
      continue;
    }

    actionableItems.push(canonicalItem);
  }

  actionableItems.sort((left, right) =>
    left.title.localeCompare(right.title)
    || left.system.localeCompare(right.system)
    || left.workType.localeCompare(right.workType),
  );
  conflicts.sort((left, right) => left.canonicalItem.title.localeCompare(right.canonicalItem.title));

  return {
    actionableItems,
    conflicts,
  };
}

export async function createKnowledgeEntry(client: Client, entry: KnowledgeEntry): Promise<NotionWriteResult> {
  const notion = notionClient(client);
  const response = await notion.pages.create({
    parent: { database_id: KNOWLEDGE_DB },
    properties: buildKnowledgeProperties(entry, true) as any,
    children: entry.content
      ? [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: buildParagraphRichText(entry.content),
            },
          },
        ]
      : undefined,
  });
  return { pageId: response.id, pageUrl: asString(response.url) };
}

async function listBlockChildren(client: Client, blockId: string, limit = 50): Promise<any[]> {
  const notion = notionClient(client);
  const results: any[] = [];
  let cursor: string | undefined;

  while (results.length < limit) {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      page_size: Math.min(100, limit - results.length),
      start_cursor: cursor,
    });
    results.push(...(response.results ?? []));
    if (!response.has_more || !response.next_cursor) break;
    cursor = response.next_cursor;
  }

  return results;
}

function extractBlockPlainText(block: any): string {
  const richText = block?.[block?.type]?.rich_text;
  if (Array.isArray(richText)) {
    return richText.map((entry: any) => entry.plain_text ?? entry.text?.content ?? "").join("");
  }
  return block?.type === "divider" ? "---" : "";
}

async function replacePageContent(client: Client, pageId: string, content: string) {
  const notion = notionClient(client);
  const existingBlocks = await listBlockChildren(client, pageId, 100);
  for (const block of existingBlocks) {
    if (block.id) {
      await notion.blocks.delete({ block_id: block.id });
    }
  }
  if (!content.trim()) return;
  await notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: buildParagraphRichText(content),
        },
      },
    ],
  });
}

export async function replacePageBlocks(
  client: Client,
  pageId: string,
  blocks: SimpleTextBlock[],
) {
  const notion = notionClient(client);
  const sanitizedBlocks = blocks
    .map((block) => ({
      ...block,
      text: block.text.trim(),
    }))
    .filter((block) => block.text.length > 0);

  const existingBlocks = await listBlockChildren(client, pageId, 100);
  const existingSimpleBlocks = existingBlocks
    .map((block) => ({
      text: extractBlockPlainText(block).trim(),
      type: block.type as SimpleTextBlock["type"],
    }))
    .filter((block) => block.text.length > 0);

  if (
    existingSimpleBlocks.length === sanitizedBlocks.length
    && existingSimpleBlocks.every((block, index) =>
      block.type === sanitizedBlocks[index]?.type
      && block.text === sanitizedBlocks[index]?.text,
    )
  ) {
    return;
  }

  for (const block of existingBlocks) {
    if (block.id) {
      await notion.blocks.delete({ block_id: block.id });
    }
  }

  const notionBlocks = sanitizedBlocks.map((block) => buildSimpleTextBlock(block));

  if (notionBlocks.length === 0) {
    return;
  }

  await notion.blocks.children.append({
    block_id: pageId,
    children: notionBlocks,
  });
}

export async function upsertKnowledgeEntry(
  client: Client,
  entry: KnowledgeEntry,
  options?: { archiveDuplicates?: boolean },
): Promise<NotionUpsertResult> {
  const notion = notionClient(client);
  const matches = filterKnowledgeMatches(await queryDatabaseByTitle(client, "knowledge", entry.title), entry);
  const plan = planNotionUpsert(matches);
  if (plan.action === "create" || !plan.canonical) {
    const created = await createKnowledgeEntry(client, entry);
    return { ...created, status: "created", duplicatePageIds: [] };
  }
  const response = await notion.pages.update({
    page_id: plan.canonical.id,
    properties: buildKnowledgeProperties(entry, true) as any,
  });
  if (entry.content) {
    await replacePageContent(client, plan.canonical.id, entry.content);
  }
  if (options?.archiveDuplicates && plan.duplicates.length > 0) {
    await archiveDuplicatePages(client, plan.duplicates);
  }
  return {
    pageId: response.id,
    pageUrl: asString(response.url),
    status: "updated",
    duplicatePageIds: plan.duplicates.map((page) => page.id),
  };
}

async function upsertSkillMetadata(
  client: Client,
  entry: SkillMetadata,
  options?: { archiveDuplicates?: boolean },
): Promise<NotionUpsertResult> {
  const notion = notionClient(client);
  const matches = filterSkillMatches(await queryDatabaseByTitle(client, "skills", entry.title), entry);
  const plan = planNotionUpsert(matches);
  if (plan.action === "create" || !plan.canonical) {
    const response = await notion.pages.create({
      parent: { database_id: SKILLS_DB },
      properties: buildSkillProperties(entry, true) as any,
    });
    return { pageId: response.id, pageUrl: asString(response.url), status: "created", duplicatePageIds: [] };
  }
  const response = await notion.pages.update({
    page_id: plan.canonical.id,
    properties: buildSkillProperties(entry, true) as any,
  });
  if (options?.archiveDuplicates && plan.duplicates.length > 0) {
    await archiveDuplicatePages(client, plan.duplicates);
  }
  return {
    pageId: response.id,
    pageUrl: asString(response.url),
    status: "updated",
    duplicatePageIds: plan.duplicates.map((page) => page.id),
  };
}

export async function fetchPage(client: Client, pageId: string) {
  const notion = notionClient(client);
  const page = await notion.pages.retrieve({ page_id: pageId });
  const blocks = await listBlockChildren(client, pageId, 10);
  return {
    page: summarizePage(page),
    blocks: blocks.map((block) => ({
      id: block.id,
      type: block.type,
      text: extractBlockPlainText(block),
      hasChildren: Boolean(block.has_children),
    })),
  };
}

export async function updatePageMetadata(
  client: Client,
  pageId: string,
  database: NotionDatabaseKey,
  metadata: Record<string, unknown>,
): Promise<NotionWriteResult> {
  const notion = notionClient(client);
  const properties =
    database === "work_queue"
      ? buildWorkQueueProperties(normalizeWorkQueueItem(metadata, false), false)
      : database === "knowledge"
        ? buildKnowledgeProperties(normalizeKnowledgeEntry(metadata, false), false)
        : database === "skills"
          ? buildSkillProperties(normalizeSkillMetadata(metadata, false), false)
          : database === "agents"
            ? buildAgentRegistryProperties(normalizeAgentRegistryEntry(metadata, false), false)
            : buildAgentRunProperties(normalizeAgentRunEntry(metadata, false), false);
  const response = await notion.pages.update({
    page_id: pageId,
    properties: properties as any,
  });
  return { pageId: response.id, pageUrl: asString(response.url) };
}

function sanitizeBlockForAppend(block: any): Record<string, unknown> | null {
  const type = asString(block?.type);
  if (!type) return null;
  if (type === "divider") return { object: "block", type: "divider", divider: {} };
  if (!["paragraph", "heading_1", "heading_2", "heading_3", "quote", "callout", "bulleted_list_item", "numbered_list_item", "to_do", "code"].includes(type)) {
    return null;
  }
  const payload = block[type];
  if (!payload) return null;
  return {
    object: "block",
    type,
    [type]: payload,
  };
}

async function appendSanitizedBlocks(client: Client, sourcePageId: string, targetPageId: string) {
  const notion = notionClient(client);
  const blocks = (await listBlockChildren(client, sourcePageId, 50))
    .map((block) => sanitizeBlockForAppend(block))
    .filter((block): block is Record<string, unknown> => Boolean(block));
  if (blocks.length === 0) return;
  await notion.blocks.children.append({
    block_id: targetPageId,
    children: blocks,
  });
}

export async function createAgentRegistryEntry(client: Client, entry: AgentRegistryEntry): Promise<NotionWriteResult> {
  const notion = notionClient(client);
  const response = await notion.pages.create({
    parent: { database_id: AGENTS_DB },
    properties: buildAgentRegistryProperties(entry, true) as any,
  });
  return { pageId: response.id, pageUrl: asString(response.url) };
}

export async function createAgentRunEntry(client: Client, entry: AgentRunEntry): Promise<NotionWriteResult> {
  const notion = notionClient(client);
  const response = await notion.pages.create({
    parent: { database_id: AGENT_RUNS_DB },
    properties: buildAgentRunProperties(entry, true) as any,
  });
  return { pageId: response.id, pageUrl: asString(response.url) };
}

export async function upsertAgentRegistryEntry(
  client: Client,
  entry: AgentRegistryEntry,
  options?: { archiveDuplicates?: boolean },
): Promise<NotionUpsertResult> {
  const notion = notionClient(client);
  const matches = filterAgentRegistryMatches(await queryDatabaseByTitle(client, "agents", entry.title), entry);
  const plan = planNotionUpsert(matches);
  if (plan.action === "create" || !plan.canonical) {
    const created = await createAgentRegistryEntry(client, entry);
    return { ...created, status: "created", duplicatePageIds: [] };
  }
  const response = await notion.pages.update({
    page_id: plan.canonical.id,
    properties: buildAgentRegistryProperties(entry, true) as any,
  });
  if (options?.archiveDuplicates && plan.duplicates.length > 0) {
    await archiveDuplicatePages(client, plan.duplicates);
  }
  return {
    pageId: response.id,
    pageUrl: asString(response.url),
    status: "updated",
    duplicatePageIds: plan.duplicates.map((page) => page.id),
  };
}

export async function upsertAgentRunEntry(
  client: Client,
  entry: AgentRunEntry,
  options?: { archiveDuplicates?: boolean },
): Promise<NotionUpsertResult> {
  const notion = notionClient(client);
  const matches = filterAgentRunMatches(await queryDatabaseByTitle(client, "agent_runs", entry.title), entry);
  const plan = planNotionUpsert(matches);
  if (plan.action === "create" || !plan.canonical) {
    const created = await createAgentRunEntry(client, entry);
    return { ...created, status: "created", duplicatePageIds: [] };
  }
  const response = await notion.pages.update({
    page_id: plan.canonical.id,
    properties: buildAgentRunProperties(entry, true) as any,
  });
  if (options?.archiveDuplicates && plan.duplicates.length > 0) {
    await archiveDuplicatePages(client, plan.duplicates);
  }
  return {
    pageId: response.id,
    pageUrl: asString(response.url),
    status: "updated",
    duplicatePageIds: plan.duplicates.map((page) => page.id),
  };
}

export async function movePage(
  client: Client,
  input: {
    pageId: string;
    targetDatabase: NotionDatabaseKey;
    archiveOriginal?: boolean;
    preserveContent?: boolean;
    metadata?: Record<string, unknown>;
  },
) {
  const notion = notionClient(client);
  const sourcePage = await notion.pages.retrieve({ page_id: input.pageId });
  const title = asString(input.metadata?.title) ?? getTitleFromPage(sourcePage) ?? "Moved page";
  let created: NotionWriteResult;
  if (input.targetDatabase === "work_queue") {
    created = await createWorkQueueItem(client, normalizeWorkQueueItem({ title, ...(input.metadata ?? {}) }, true));
  } else if (input.targetDatabase === "knowledge") {
    created = await createKnowledgeEntry(client, normalizeKnowledgeEntry({ title, ...(input.metadata ?? {}) }, true));
  } else if (input.targetDatabase === "agents") {
    created = await createAgentRegistryEntry(client, normalizeAgentRegistryEntry({ title, ...(input.metadata ?? {}) }, true));
  } else if (input.targetDatabase === "agent_runs") {
    created = await createAgentRunEntry(client, normalizeAgentRunEntry({ title, ...(input.metadata ?? {}) }, true));
  } else {
    const upserted = await upsertSkillMetadata(client, normalizeSkillMetadata({ title, ...(input.metadata ?? {}) }, true));
    created = { pageId: upserted.pageId, pageUrl: upserted.pageUrl };
  }
  if (input.preserveContent !== false) {
    await appendSanitizedBlocks(client, input.pageId, created.pageId);
  }
  if (input.archiveOriginal !== false) {
    await notion.pages.update({
      page_id: input.pageId,
      archived: true,
    });
  }
  return {
    sourcePageId: input.pageId,
    targetPageId: created.pageId,
    targetPageUrl: created.pageUrl,
  };
}

export async function archivePage(client: Client, pageId: string): Promise<NotionWriteResult> {
  const notion = notionClient(client);
  const response = await notion.pages.update({
    page_id: pageId,
    archived: true,
  });
  return { pageId: response.id, pageUrl: asString(response.url) };
}

export async function commentPage(client: Client, pageId: string, comment: string) {
  const notion = notionClient(client);
  const response = await notion.comments.create({
    parent: { page_id: pageId },
    rich_text: buildParagraphRichText(comment),
  });
  return { success: true, commentId: response.id };
}

async function searchPages(
  client: Client,
  params: {
    database?: NotionDatabaseKey;
    query?: string;
    title?: string;
    limit?: number;
    staleOnly?: boolean;
  },
): Promise<NotionPageSummary[]> {
  const limit = Math.max(1, Math.min(Number(params.limit ?? 10), 50));
  let pages: any[] = [];

  if (params.database && params.title) {
    pages = await queryDatabaseByTitle(client, params.database, params.title);
  } else if (params.database && !params.query) {
    pages = await queryDatabase(client, params.database, limit);
  } else {
    const notion = notionClient(client);
    const response = await notion.search({
      query: params.query ?? params.title ?? "",
      page_size: limit,
      filter: { property: "object", value: "page" },
    });
    pages = (response.results ?? []).filter((page: any) => {
      if (!params.database) return true;
      return extractNotionId(page?.parent?.database_id) === DATABASE_CONFIG[params.database].databaseId;
    });
  }

  const staleIds = new Set<string>();
  if (params.staleOnly && (!params.database || params.database === "knowledge")) {
    const candidates: KnowledgeFreshnessCandidate[] = pages.map((page) => ({
      id: page.id,
      reviewCadence: page?.properties?.["Review Cadence"]?.select?.name ?? null,
      lastReviewed: page?.properties?.["Last Reviewed"]?.date?.start ?? null,
      lastEditedTime: page?.last_edited_time ?? null,
    }));
    for (const id of detectStaleKnowledgeEntries(candidates, new Date().toISOString())) {
      staleIds.add(id);
    }
    pages = pages.filter((page) => staleIds.has(page.id));
  }

  return pages.slice(0, limit).map((page) => summarizePage(page, staleIds));
}

async function reconcileRelations(
  client: Client,
  params: {
    pageId: string;
    database: NotionDatabaseKey;
    ownerIds?: string[];
    requestedByIds?: string[];
    relatedWorkPageIds?: string[];
    relatedWorkPageUrls?: string[];
    relatedDocPageIds?: string[];
    relatedDocPageUrls?: string[];
    relatedSkillPageIds?: string[];
    relatedSkillPageUrls?: string[];
    reviewCadence?: string;
    lastReviewed?: string;
    canonicalSource?: string;
    sourceOfTruth?: string;
    lifecycleStage?: string;
    outputLocation?: string;
    executionSurface?: string;
    substage?: string;
  },
) {
  const metadata = { ...params };
  delete (metadata as Record<string, unknown>).pageId;
  delete (metadata as Record<string, unknown>).database;
  const updated = await updatePageMetadata(client, params.pageId, params.database, metadata);
  const stale = params.database === "knowledge"
    ? detectStaleKnowledgeEntries(
        [
          {
            id: params.pageId,
            reviewCadence: params.reviewCadence ?? null,
            lastReviewed: params.lastReviewed ?? null,
            lastEditedTime: null,
          },
        ],
        new Date().toISOString(),
      ).includes(params.pageId)
    : false;
  return { ...updated, stale };
}

export function buildNotionToolHandlers(client: Client): Record<string, NotionHandler> {
  return {
    "notion-read-work-queue": async (params) => {
      const items = await queryWorkQueue(client, params as WorkQueueQuery);
      return { success: true, items, count: items.length };
    },
    "notion-write-work-queue": async (params) => {
      const normalized = normalizeWorkQueueItem(params, true);
      const result = await upsertWorkQueueItem(client, normalized, {
        archiveDuplicates: params.archiveDuplicates === true,
      });
      return { success: true, ...result };
    },
    "notion-write-knowledge": async (params) => {
      return { success: true, ...(await createKnowledgeEntry(client, normalizeKnowledgeEntry(params, true))) };
    },
    "notion-search-pages": async (params) => {
      const pages = await searchPages(client, params as {
        database?: NotionDatabaseKey;
        query?: string;
        title?: string;
        limit?: number;
        staleOnly?: boolean;
      });
      return { success: true, pages, count: pages.length };
    },
    "notion-fetch-page": async (params) => {
      const pageId = extractNotionId(asString(params.pageId));
      if (!pageId) throw new Error("A valid Notion page ID or URL is required.");
      return { success: true, ...(await fetchPage(client, pageId)) };
    },
    "notion-upsert-knowledge": async (params) => {
      return {
        success: true,
        ...(await upsertKnowledgeEntry(client, normalizeKnowledgeEntry(params, true), {
          archiveDuplicates: params.archiveDuplicates === true,
        })),
      };
    },
    "notion-upsert-work-queue": async (params) => {
      return {
        success: true,
        ...(await upsertWorkQueueItem(client, normalizeWorkQueueItem(params, true), {
          archiveDuplicates: params.archiveDuplicates === true,
        })),
      };
    },
    "notion-update-page-metadata": async (params) => {
      const pageId = extractNotionId(asString(params.pageId));
      if (!pageId) throw new Error("A valid Notion page ID or URL is required.");
      return {
        success: true,
        ...(await updatePageMetadata(client, pageId, params.database as NotionDatabaseKey, params)),
      };
    },
    "notion-move-page": async (params) => {
      const pageId = extractNotionId(asString(params.pageId));
      if (!pageId) throw new Error("A valid Notion page ID or URL is required.");
      return {
        success: true,
        ...(await movePage(client, {
          pageId,
          targetDatabase: params.targetDatabase as NotionDatabaseKey,
          archiveOriginal: params.archiveOriginal === true,
          preserveContent: params.preserveContent !== false,
          metadata: (params.metadata as Record<string, unknown> | undefined) ?? {},
        })),
      };
    },
    "notion-archive-page": async (params) => {
      const pageId = extractNotionId(asString(params.pageId));
      if (!pageId) throw new Error("A valid Notion page ID or URL is required.");
      return { success: true, ...(await archivePage(client, pageId)) };
    },
    "notion-comment-page": async (params) => {
      const pageId = extractNotionId(asString(params.pageId));
      if (!pageId) throw new Error("A valid Notion page ID or URL is required.");
      return await commentPage(client, pageId, asString(params.comment) ?? "");
    },
    "notion-reconcile-relations": async (params) => {
      const pageId = extractNotionId(asString(params.pageId));
      if (!pageId) throw new Error("A valid Notion page ID or URL is required.");
      return {
        success: true,
        ...(await reconcileRelations(client, {
          pageId,
          database: params.database as NotionDatabaseKey,
          ownerIds: asStringArray(params.ownerIds),
          requestedByIds: asStringArray(params.requestedByIds),
          relatedWorkPageIds: asStringArray(params.relatedWorkPageIds),
          relatedWorkPageUrls: asStringArray(params.relatedWorkPageUrls),
          relatedDocPageIds: asStringArray(params.relatedDocPageIds),
          relatedDocPageUrls: asStringArray(params.relatedDocPageUrls),
          relatedSkillPageIds: asStringArray(params.relatedSkillPageIds),
          relatedSkillPageUrls: asStringArray(params.relatedSkillPageUrls),
          reviewCadence: asString(params.reviewCadence),
          lastReviewed: asString(params.lastReviewed),
          canonicalSource: asString(params.canonicalSource),
          sourceOfTruth: asString(params.sourceOfTruth),
          lifecycleStage: asString(params.lifecycleStage),
          outputLocation: asString(params.outputLocation),
          executionSurface: asString(params.executionSurface),
          substage: asString(params.substage),
        })),
      };
    },
  };
}

export const NOTION_MANAGER_CONSTANTS = {
  hubPageId: HUB_PAGE_ID,
  workQueueDbId: WORK_QUEUE_DB,
  workQueueDsId: WORK_QUEUE_DS,
  knowledgeDbId: KNOWLEDGE_DB,
  knowledgeDsId: KNOWLEDGE_DS,
  skillsDbId: SKILLS_DB,
  skillsDsId: SKILLS_DS,
  agentsDbId: AGENTS_DB,
  agentsDsId: AGENTS_DS,
  agentRunsDbId: AGENT_RUNS_DB,
  agentRunsDsId: AGENT_RUNS_DS,
};
