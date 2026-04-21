import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getConfiguredEnvValue } from "../config/env";
import {
  createNotionClient,
  fetchPage,
  queryDatabase,
  type NotionPageSummary,
} from "../../ops/paperclip/plugins/blueprint-automation/src/notion";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const NOTION_GROUNDING_ROOT_RELATIVE =
  "ops/paperclip/research-grounding/notion";

const DEFAULT_KNOWLEDGE_TITLE_PATTERNS = [
  /^Deep Research Brief - /i,
  /^City Launch Deep Research Playbook - /i,
];
const DEFAULT_WORK_QUEUE_TITLE_PATTERNS = [
  /^Review deep research brief - /i,
  /^Review city launch deep research playbook - /i,
];

type RawNotionPage = {
  id: string;
  url?: string;
  archived?: boolean;
  in_trash?: boolean;
  last_edited_time?: string;
  properties?: Record<string, unknown>;
};

type GroundingDatabase = "knowledge" | "work_queue";

export interface SelectedNotionGroundingPage {
  database: GroundingDatabase;
  id: string;
  title: string;
  url?: string;
  lastEditedTime?: string;
}

export interface RefreshNotionGroundingOptions {
  city?: string | null;
  limitPerDatabase?: number;
}

export interface RefreshNotionGroundingResult {
  city: string | null;
  rootRelativePath: string;
  rootAbsolutePath: string;
  manifestPath: string;
  indexPath: string;
  selectedPages: SelectedNotionGroundingPage[];
  writtenPaths: string[];
}

function normalizeWhitespace(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^a-z0-9]+/gi, " ")
    .trim()
    .toLowerCase();
}

function getCityNeedle(city?: string | null) {
  const firstSegment = city?.split(",")[0]?.trim();
  if (!firstSegment) {
    return null;
  }
  const normalized = normalizeWhitespace(firstSegment);
  return normalized || null;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asRichTextPlainText(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const text = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return undefined;
      }
      const typedEntry = entry as {
        plain_text?: unknown;
        text?: {
          content?: unknown;
        };
      };
      return asString(typedEntry.plain_text) ?? asString(typedEntry.text?.content);
    })
    .filter((entry): entry is string => Boolean(entry))
    .join("")
    .trim();

  return text || undefined;
}

function getTitleFromRawNotionPage(page: RawNotionPage) {
  return asRichTextPlainText((page.properties?.Title as { title?: unknown } | undefined)?.title)
    ?? "";
}

function matchesTitlePatterns(title: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(title));
}

function matchesCity(title: string, city?: string | null) {
  const cityNeedle = getCityNeedle(city);
  if (!cityNeedle) {
    return true;
  }
  return normalizeWhitespace(title).includes(cityNeedle);
}

function sortPagesByLastEditedTime(left: RawNotionPage, right: RawNotionPage) {
  const leftTime = new Date(left.last_edited_time ?? 0).getTime();
  const rightTime = new Date(right.last_edited_time ?? 0).getTime();
  return rightTime - leftTime;
}

function selectDatabasePages(input: {
  database: GroundingDatabase;
  pages: RawNotionPage[];
  titlePatterns: RegExp[];
  city?: string | null;
  limitPerDatabase: number;
}) {
  return [...input.pages]
    .filter((page) => !page.archived && !page.in_trash)
    .filter((page) => {
      const title = getTitleFromRawNotionPage(page);
      return (
        title.length > 0
        && matchesTitlePatterns(title, input.titlePatterns)
        && matchesCity(title, input.city)
      );
    })
    .sort(sortPagesByLastEditedTime)
    .slice(0, input.limitPerDatabase)
    .map((page) => ({
      database: input.database,
      id: page.id,
      title: getTitleFromRawNotionPage(page),
      url: asString(page.url),
      lastEditedTime: asString(page.last_edited_time),
    }));
}

export function selectNotionGroundingPages(input: {
  city?: string | null;
  knowledgePages: RawNotionPage[];
  workQueuePages: RawNotionPage[];
  limitPerDatabase?: number;
}) {
  const limitPerDatabase = Math.max(1, input.limitPerDatabase ?? 20);

  return [
    ...selectDatabasePages({
      database: "knowledge",
      pages: input.knowledgePages,
      titlePatterns: DEFAULT_KNOWLEDGE_TITLE_PATTERNS,
      city: input.city,
      limitPerDatabase,
    }),
    ...selectDatabasePages({
      database: "work_queue",
      pages: input.workQueuePages,
      titlePatterns: DEFAULT_WORK_QUEUE_TITLE_PATTERNS,
      city: input.city,
      limitPerDatabase,
    }),
  ];
}

function slugifyTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildNotionGroundingRelativePath(input: {
  database: GroundingDatabase;
  id: string;
  title: string;
}) {
  return path.posix.join(
    NOTION_GROUNDING_ROOT_RELATIVE,
    input.database,
    `${slugifyTitle(input.title)}--${input.id}.md`,
  );
}

function getSelectPropertyName(
  properties: NotionPageSummary["properties"] | undefined,
  key: string,
) {
  return asString(
    (properties?.[key] as { select?: { name?: unknown } } | undefined)?.select?.name,
  );
}

function getCheckboxProperty(
  properties: NotionPageSummary["properties"] | undefined,
  key: string,
) {
  const value = (properties?.[key] as { checkbox?: unknown } | undefined)?.checkbox;
  return typeof value === "boolean" ? value : undefined;
}

function getDateProperty(
  properties: NotionPageSummary["properties"] | undefined,
  key: string,
) {
  return asString(
    (properties?.[key] as { date?: { start?: unknown } } | undefined)?.date?.start,
  );
}

function getRichTextProperty(
  properties: NotionPageSummary["properties"] | undefined,
  key: string,
) {
  return asRichTextPlainText(
    (properties?.[key] as { rich_text?: unknown } | undefined)?.rich_text,
  );
}

function renderDatabaseMetadata(
  database: GroundingDatabase,
  page: NotionPageSummary,
) {
  if (database === "knowledge") {
    return [
      getSelectPropertyName(page.properties, "System")
        ? `- system: ${getSelectPropertyName(page.properties, "System")}`
        : null,
      getSelectPropertyName(page.properties, "Type")
        ? `- type: ${getSelectPropertyName(page.properties, "Type")}`
        : null,
      getSelectPropertyName(page.properties, "Source of Truth")
        ? `- source_of_truth: ${getSelectPropertyName(page.properties, "Source of Truth")}`
        : null,
      getRichTextProperty(page.properties, "Canonical Source")
        ? `- canonical_source: ${getRichTextProperty(page.properties, "Canonical Source")}`
        : null,
      getSelectPropertyName(page.properties, "Review Cadence")
        ? `- review_cadence: ${getSelectPropertyName(page.properties, "Review Cadence")}`
        : null,
      getDateProperty(page.properties, "Last Reviewed")
        ? `- last_reviewed: ${getDateProperty(page.properties, "Last Reviewed")}`
        : null,
    ].filter((entry): entry is string => Boolean(entry));
  }

  return [
    getSelectPropertyName(page.properties, "Priority")
      ? `- priority: ${getSelectPropertyName(page.properties, "Priority")}`
      : null,
    getSelectPropertyName(page.properties, "System")
      ? `- system: ${getSelectPropertyName(page.properties, "System")}`
      : null,
    getSelectPropertyName(page.properties, "Business Lane")
      ? `- business_lane: ${getSelectPropertyName(page.properties, "Business Lane")}`
      : null,
    getSelectPropertyName(page.properties, "Lifecycle Stage")
      ? `- lifecycle_stage: ${getSelectPropertyName(page.properties, "Lifecycle Stage")}`
      : null,
    getSelectPropertyName(page.properties, "Work Type")
      ? `- work_type: ${getSelectPropertyName(page.properties, "Work Type")}`
      : null,
    typeof getCheckboxProperty(page.properties, "Needs Founder") === "boolean"
      ? `- needs_founder: ${getCheckboxProperty(page.properties, "Needs Founder")}`
      : null,
    getDateProperty(page.properties, "Due Date")
      ? `- due_date: ${getDateProperty(page.properties, "Due Date")}`
      : null,
  ].filter((entry): entry is string => Boolean(entry));
}

function renderBlockLine(block: { type: string; text?: string }) {
  const text = block.text?.trim();
  if (!text) {
    return null;
  }

  switch (block.type) {
    case "heading_1":
      return `# ${text}`;
    case "heading_2":
      return `## ${text}`;
    case "heading_3":
      return `### ${text}`;
    case "bulleted_list_item":
      return `- ${text}`;
    case "numbered_list_item":
      return `1. ${text}`;
    case "to_do":
      return `- [ ] ${text}`;
    case "quote":
    case "callout":
      return `> ${text}`;
    case "code":
      return ["```text", text, "```"].join("\n");
    default:
      return text;
  }
}

export function renderNotionGroundingMarkdown(input: {
  database: GroundingDatabase;
  page: NotionPageSummary;
  blocks: Array<{
    id: string;
    type: string;
    text?: string;
    hasChildren: boolean;
  }>;
}) {
  const metadataLines = renderDatabaseMetadata(input.database, input.page);
  const contentLines = input.blocks
    .map((block) => renderBlockLine(block))
    .filter((entry): entry is string => Boolean(entry));

  return [
    `# ${input.page.title}`,
    ``,
    `- notion_page_id: ${input.page.id}`,
    input.page.url ? `- notion_url: ${input.page.url}` : null,
    `- database: ${input.database}`,
    input.page.lastEditedTime
      ? `- last_edited_time: ${input.page.lastEditedTime}`
      : null,
    ...metadataLines,
    ``,
    `## Content`,
    ``,
    ...(contentLines.length > 0 ? contentLines : ["_No supported plain-text blocks found._"]),
    ``,
  ]
    .filter((entry): entry is string => entry !== null)
    .join("\n");
}

async function writeRepoFile(relativePath: string, content: string) {
  const absolutePath = path.join(REPO_ROOT, relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, content, "utf8");
  return absolutePath;
}

function renderIndexMarkdown(input: {
  city: string | null;
  selectedPages: SelectedNotionGroundingPage[];
}) {
  return [
    "# Notion Grounding Index",
    "",
    input.city ? `- city_filter: ${input.city}` : "- city_filter: none",
    `- page_count: ${input.selectedPages.length}`,
    "",
    "## Pages",
    "",
    ...(
      input.selectedPages.length > 0
        ? input.selectedPages.map((page) =>
            `- [${page.title}](${page.url ?? "#"}) (${page.database})`,
          )
        : ["- No pages matched the current curated selector."]
    ),
    "",
  ].join("\n");
}

export async function refreshNotionGrounding(
  options: RefreshNotionGroundingOptions = {},
) {
  const notionToken = getConfiguredEnvValue("NOTION_API_TOKEN", "NOTION_API_KEY");
  if (!notionToken) {
    throw new Error(
      "Notion grounding refresh requires NOTION_API_TOKEN or NOTION_API_KEY.",
    );
  }

  const client = createNotionClient({ token: notionToken });
  const [knowledgePages, workQueuePages] = await Promise.all([
    queryDatabase(client, "knowledge", 100),
    queryDatabase(client, "work_queue", 100),
  ]);

  const selectedPages = selectNotionGroundingPages({
    city: options.city,
    knowledgePages: knowledgePages as RawNotionPage[],
    workQueuePages: workQueuePages as RawNotionPage[],
    limitPerDatabase: options.limitPerDatabase,
  });

  const rootAbsolutePath = path.join(REPO_ROOT, NOTION_GROUNDING_ROOT_RELATIVE);
  await fs.rm(rootAbsolutePath, { recursive: true, force: true });
  await fs.mkdir(rootAbsolutePath, { recursive: true });

  const writtenPaths: string[] = [];
  for (const selectedPage of selectedPages) {
    const fetched = await fetchPage(client, selectedPage.id);
    const relativePath = buildNotionGroundingRelativePath(selectedPage);
    await writeRepoFile(
      relativePath,
      renderNotionGroundingMarkdown({
        database: selectedPage.database,
        page: fetched.page,
        blocks: fetched.blocks,
      }),
    );
    writtenPaths.push(relativePath);
  }

  const manifestPath = path.posix.join(
    NOTION_GROUNDING_ROOT_RELATIVE,
    "manifest.json",
  );
  const indexPath = path.posix.join(
    NOTION_GROUNDING_ROOT_RELATIVE,
    "index.md",
  );

  await writeRepoFile(
    manifestPath,
    JSON.stringify(
      {
        city: options.city?.trim() || null,
        rootRelativePath: NOTION_GROUNDING_ROOT_RELATIVE,
        selectedPages,
        writtenPaths,
      },
      null,
      2,
    ),
  );
  await writeRepoFile(
    indexPath,
    renderIndexMarkdown({
      city: options.city?.trim() || null,
      selectedPages,
    }),
  );
  writtenPaths.push(manifestPath, indexPath);

  return {
    city: options.city?.trim() || null,
    rootRelativePath: NOTION_GROUNDING_ROOT_RELATIVE,
    rootAbsolutePath,
    manifestPath,
    indexPath,
    selectedPages,
    writtenPaths,
  } satisfies RefreshNotionGroundingResult;
}
