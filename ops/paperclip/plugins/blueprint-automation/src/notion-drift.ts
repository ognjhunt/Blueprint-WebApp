import { TOOL_NAMES } from "./constants.js";

export type NotionDriftSignal = {
  sourceId: string;
  title: string;
  description: string;
  priority: "medium" | "high";
  pageId: string;
  pageUrl?: string;
  database?: string;
  driftKind: "stale" | "duplicate";
  metadata?: Record<string, unknown>;
};

export type NotionDriftResolution = {
  sourceId: string;
  comment: string;
};

export type NotionDriftAssessment = {
  open: NotionDriftSignal[];
  resolve: NotionDriftResolution[];
};

type NotionToolName =
  | typeof TOOL_NAMES.notionWriteKnowledge
  | typeof TOOL_NAMES.notionWriteWorkQueue
  | typeof TOOL_NAMES.notionUpsertKnowledge
  | typeof TOOL_NAMES.notionUpsertWorkQueue
  | typeof TOOL_NAMES.notionUpdatePageMetadata
  | typeof TOOL_NAMES.notionReconcileRelations;

type NotionToolParams = Record<string, unknown>;
type NotionToolResult = Record<string, unknown>;

function asString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function pageIdFromResult(result: NotionToolResult, params: NotionToolParams) {
  return asString(result.pageId) ?? asString(params.pageId);
}

function pageTitleFromParams(params: NotionToolParams) {
  return asString(params.title) ?? "Blueprint-managed Notion page";
}

function databaseFromParams(params: NotionToolParams) {
  return asString(params.database);
}

function duplicateSourceId(database: string | undefined, pageId: string) {
  return `duplicate:${database ?? "unknown"}:${pageId}`;
}

function staleSourceId(database: string | undefined, pageId: string) {
  return `stale:${database ?? "unknown"}:${pageId}`;
}

export function assessNotionDrift(
  toolName: NotionToolName,
  params: NotionToolParams,
  result: NotionToolResult,
): NotionDriftAssessment {
  const open: NotionDriftSignal[] = [];
  const resolve: NotionDriftResolution[] = [];

  const pageId = pageIdFromResult(result, params);
  const pageUrl = asString(result.pageUrl);
  const pageTitle = pageTitleFromParams(params);
  const database = databaseFromParams(params);
  const duplicatePageIds = Array.isArray(result.duplicatePageIds)
    ? result.duplicatePageIds.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];

  if (!pageId) return { open, resolve };

  if (toolName === TOOL_NAMES.notionUpsertKnowledge || toolName === TOOL_NAMES.notionUpsertWorkQueue) {
    if (duplicatePageIds.length > 0 && params.archiveDuplicates !== true) {
      open.push({
        sourceId: duplicateSourceId(database, pageId),
        title: `Notion drift: duplicate pages for ${pageTitle}`,
        description: [
          `${pageTitle} still has duplicate Blueprint-managed Notion pages after an upsert.`,
          "",
          `- Database: ${database ?? "unknown"}`,
          `- Canonical page: ${pageUrl ?? pageId}`,
          `- Duplicate page ids: ${duplicatePageIds.join(", ")}`,
          "- This drift was detected during an event-driven Notion write, not a blind sweep.",
        ].join("\n"),
        priority: "high",
        pageId,
        pageUrl,
        database,
        driftKind: "duplicate",
        metadata: {
          duplicatePageIds,
          toolName,
        },
      });
    } else {
      resolve.push({
        sourceId: duplicateSourceId(database, pageId),
        comment: `${pageTitle} no longer shows unresolved duplicate-page drift after ${toolName}.`,
      });
    }
  }

  if (toolName === TOOL_NAMES.notionUpdatePageMetadata || toolName === TOOL_NAMES.notionReconcileRelations) {
    if (result.stale === true) {
      open.push({
        sourceId: staleSourceId(database, pageId),
        title: `Notion drift: stale review metadata for ${pageTitle}`,
        description: [
          `${pageTitle} still looks stale after metadata reconciliation.`,
          "",
          `- Database: ${database ?? "unknown"}`,
          `- Page: ${pageUrl ?? pageId}`,
          "- The page needs notion-manager review or a real content refresh rather than another blind sweep.",
        ].join("\n"),
        priority: "medium",
        pageId,
        pageUrl,
        database,
        driftKind: "stale",
        metadata: {
          toolName,
        },
      });
    } else {
      resolve.push({
        sourceId: staleSourceId(database, pageId),
        comment: `${pageTitle} no longer shows stale metadata drift after ${toolName}.`,
      });
    }
  }

  return { open, resolve };
}
