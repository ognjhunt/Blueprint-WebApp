import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { embedTexts } from "../retrieval/embeddings";
import { searchVenue } from "../retrieval/venueIndexer";
import type { KnowledgeSource } from "../types/knowledge";
import { getOpsDocumentsByIds, listOpsDocuments } from "./ops-documents";
import { getStartupPacksByIds, listStartupPacks } from "./startup-packs";
import type {
  CreativeContextReference,
  ExternalKnowledgeSource,
  KnowledgePageReference,
  StartupContextMetadata,
  StartupPackRecord,
} from "./types";

function normalizeMetadata(metadata?: Record<string, unknown>): StartupContextMetadata {
  const startupContext =
    metadata?.startupContext && typeof metadata.startupContext === "object"
      ? (metadata.startupContext as Record<string, unknown>)
      : metadata || {};

  return {
    startupPackIds: Array.isArray(startupContext.startupPackIds)
      ? startupContext.startupPackIds
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
    repoDocPaths: Array.isArray(startupContext.repoDocPaths)
      ? startupContext.repoDocPaths
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
    knowledgePagePaths: Array.isArray(startupContext.knowledgePagePaths)
      ? startupContext.knowledgePagePaths
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
    blueprintIds: Array.isArray(startupContext.blueprintIds)
      ? startupContext.blueprintIds
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
    documentIds: Array.isArray(startupContext.documentIds)
      ? startupContext.documentIds
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim())
          .filter(Boolean)
      : [],
    externalSources: Array.isArray(startupContext.externalSources)
      ? startupContext.externalSources
          .filter((value): value is ExternalKnowledgeSource =>
            Boolean(
              value &&
                typeof value === "object" &&
                typeof (value as ExternalKnowledgeSource).title === "string" &&
                typeof (value as ExternalKnowledgeSource).url === "string",
            ),
          )
          .map((value) => ({
            title: value.title.trim(),
            url: value.url.trim(),
            description: value.description?.trim() || undefined,
            source_type: value.source_type?.trim() || undefined,
          }))
          .filter((value) => value.title && value.url)
      : [],
    creativeContexts: Array.isArray(startupContext.creativeContexts)
      ? startupContext.creativeContexts
          .filter((value): value is CreativeContextReference =>
            Boolean(
              value &&
                typeof value === "object" &&
                typeof (value as CreativeContextReference).id === "string" &&
                typeof (value as CreativeContextReference).storage_uri === "string",
            ),
          )
          .map((value) => ({
            id: value.id.trim(),
            storage_uri: value.storage_uri.trim(),
            sku_name: value.sku_name?.trim() || undefined,
            created_at: value.created_at?.trim() || null,
            rollout_variant: value.rollout_variant?.trim() || null,
            research_topic: value.research_topic?.trim() || null,
          }))
          .filter((value) => value.id && value.storage_uri)
      : [],
    operatorNotes:
      typeof startupContext.operatorNotes === "string"
        ? startupContext.operatorNotes.trim()
        : "",
  };
}

function dedupeStringValues(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function dedupeExternalSources(sources: ExternalKnowledgeSource[]) {
  const dedupe = new Map<string, ExternalKnowledgeSource>();

  for (const source of sources) {
    const title = source.title?.trim() || "";
    const url = source.url?.trim() || "";
    if (!title || !url) {
      continue;
    }

    dedupe.set(`${title}::${url}`, {
      title,
      url,
      description: source.description?.trim() || undefined,
      source_type: source.source_type?.trim() || undefined,
    });
  }

  return [...dedupe.values()];
}

function dedupeCreativeContexts(contexts: CreativeContextReference[]) {
  const dedupe = new Map<string, CreativeContextReference>();

  for (const context of contexts) {
    const id = context.id?.trim() || "";
    const storageUri = context.storage_uri?.trim() || "";
    if (!id || !storageUri) {
      continue;
    }

    dedupe.set(id, {
      id,
      storage_uri: storageUri,
      sku_name: context.sku_name?.trim() || undefined,
      created_at: context.created_at?.trim() || null,
      rollout_variant: context.rollout_variant?.trim() || null,
      research_topic: context.research_topic?.trim() || null,
    });
  }

  return [...dedupe.values()];
}

function mergeOperatorNotes(
  packs: StartupPackRecord[],
  sessionOperatorNotes: string,
) {
  const sections = packs
    .map((pack) => {
      const notes = pack.operator_notes?.trim() || "";
      if (!notes) {
        return "";
      }

      return `Startup pack: ${pack.name}\n${notes}`;
    })
    .filter(Boolean);

  if (sessionOperatorNotes.trim()) {
    sections.push(`Session notes\n${sessionOperatorNotes.trim()}`);
  }

  return sections.join("\n\n").trim();
}

async function walkMarkdownFiles(rootDir: string, relativePrefix = ""): Promise<string[]> {
  const absoluteDir = relativePrefix ? path.join(rootDir, relativePrefix) : rootDir;
  let entries: Awaited<ReturnType<typeof fs.readdir>> = [];
  try {
    entries = await fs.readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const results: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }
    const relativePath = path.join(relativePrefix, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkMarkdownFiles(rootDir, relativePath)));
      continue;
    }
    if (/\.(md|mdx|txt)$/i.test(entry.name)) {
      results.push(relativePath.replace(/\\/g, "/"));
    }
  }
  return results.sort((a, b) => a.localeCompare(b));
}

async function readRepoDocExcerpt(
  relativeDocPath: string,
  options?: {
    compact?: boolean;
  },
) {
  const workspaceRoot = process.cwd();
  const absolutePath = path.join(workspaceRoot, relativeDocPath);
  try {
    const content = await fs.readFile(absolutePath, "utf8");
    const maxLength = options?.compact ? 900 : 4000;
    const excerpt = content.slice(0, maxLength).trim();
    return {
      path: relativeDocPath,
      checksum: `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`,
      content_length: content.length,
      excerpt_length: excerpt.length,
      excerpt_truncated: content.length > maxLength,
      excerpt,
    };
  } catch {
    return {
      path: relativeDocPath,
      checksum: null,
      content_length: 0,
      excerpt_length: 0,
      excerpt_truncated: false,
      excerpt: "Unable to read this repo document in the current environment.",
    };
  }
}

function parseFrontmatterScalar(frontmatterRaw: string, key: string) {
  const match = frontmatterRaw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!match) {
    return undefined;
  }
  return match[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
}

async function readKnowledgePage(
  relativePagePath: string,
  options?: {
    compact?: boolean;
  },
) {
  const workspaceRoot = process.cwd();
  const absolutePath = path.join(workspaceRoot, relativePagePath);
  try {
    const content = await fs.readFile(absolutePath, "utf8");
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    const frontmatterRaw = frontmatterMatch?.[1] || "";
    const body = (frontmatterMatch?.[2] || content).trim();
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const title = titleMatch?.[1]?.trim() || path.basename(relativePagePath, ".md");
    const excerptBody = body.replace(/^#\s+.+\n?/, "").trim();
    const maxLength = options?.compact ? 900 : 2200;
    const excerpt = excerptBody.slice(0, maxLength).trim();

    return {
      path: relativePagePath,
      checksum: `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`,
      title,
      page_kind: parseFrontmatterScalar(frontmatterRaw, "page_kind"),
      owner: parseFrontmatterScalar(frontmatterRaw, "owner"),
      authority: parseFrontmatterScalar(frontmatterRaw, "authority"),
      review_status: parseFrontmatterScalar(frontmatterRaw, "review_status"),
      last_verified_at: parseFrontmatterScalar(frontmatterRaw, "last_verified_at") || null,
      content_length: content.length,
      excerpt_length: excerpt.length,
      excerpt_truncated: excerptBody.length > maxLength,
      excerpt,
    };
  } catch {
    return {
      path: relativePagePath,
      checksum: null,
      title: relativePagePath,
      page_kind: undefined,
      owner: undefined,
      authority: undefined,
      review_status: undefined,
      last_verified_at: null,
      content_length: 0,
      excerpt_length: 0,
      excerpt_truncated: false,
      excerpt: "Unable to read this KB page in the current environment.",
    };
  }
}

async function listKnowledgePages() {
  const compiledRoot = path.join(process.cwd(), "knowledge", "compiled");
  const reportsRoot = path.join(process.cwd(), "knowledge", "reports");

  const [compiledPages, reportPages] = await Promise.all([
    walkMarkdownFiles(compiledRoot).catch(() => []),
    walkMarkdownFiles(reportsRoot).catch(() => []),
  ]);

  const kbPagePaths = [
    ...compiledPages.map((entry) => `knowledge/compiled/${entry}`),
    ...reportPages.map((entry) => `knowledge/reports/${entry}`),
  ].filter((entry) => !entry.endsWith("/README.md"));

  const pages = await Promise.all(kbPagePaths.map((pagePath) => readKnowledgePage(pagePath, { compact: true })));

  return pages.map<KnowledgePageReference>((page) => ({
    path: page.path,
    title: page.title,
    page_kind: page.page_kind,
    owner: page.owner,
    authority: page.authority,
    review_status: page.review_status,
    last_verified_at: page.last_verified_at,
  }));
}

function normalizeKnowledgeSources(value: unknown): KnowledgeSource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is KnowledgeSource =>
      Boolean(
        entry &&
          typeof entry === "object" &&
          typeof (entry as KnowledgeSource).title === "string" &&
          typeof (entry as KnowledgeSource).url === "string",
      ),
    )
    .map((entry) => ({
      title: entry.title.trim(),
      url: entry.url.trim(),
      category: entry.category?.trim() || undefined,
      description: entry.description?.trim() || undefined,
    }))
    .filter((entry) => entry.title && entry.url);
}

async function loadBlueprintContext(blueprintId: string, queryText: string) {
  if (!db || !blueprintId) {
    return null;
  }

  const snapshot = await db.collection("blueprints").doc(blueprintId).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() as Record<string, unknown>;
  const sources = normalizeKnowledgeSources(
    data.knowledgeSourceUrls || data.aiKnowledgeSources,
  );

  let searchMatches: Array<Record<string, unknown>> = [];
  if (queryText.trim()) {
    const embeddings = await embedTexts([queryText]);
    if (embeddings[0] && embeddings[0].length > 0) {
      const venueResults = await searchVenue(blueprintId, embeddings[0], 4);
      searchMatches = venueResults.map((result) => ({
        title: result.sourceTitle,
        url: result.sourceUrl,
        snippet: result.text.slice(0, 500),
        distance: result.distance ?? null,
      }));
    }
  }

  return {
    blueprintId,
    blueprintName:
      String(data.businessName || data.name || data.title || blueprintId).trim(),
    knowledgeSources: sources,
    searchMatches,
  };
}

export async function getStartupContextOptions() {
  const docsDir = path.join(process.cwd(), "docs");
  const docs = await walkMarkdownFiles(docsDir).then((entries) =>
    entries.map((entry) => `docs/${entry}`),
  );
  const knowledgePages = await listKnowledgePages().catch(() => []);

  let blueprints: Array<{ id: string; name: string }> = [];
  if (db) {
    try {
      const snapshot = await db.collection("blueprints").limit(20).get();
      blueprints = snapshot.docs.map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          name: String(data.businessName || data.name || doc.id).trim(),
        };
      });
    } catch {
      blueprints = [];
    }
  }

  const startupPacks = await listStartupPacks(25).catch(() => []);
  const opsDocuments = await listOpsDocuments(25).catch(() => []);
  let recentCreativeRuns: Array<{
    id: string;
    skuName: string;
    createdAt: string | null;
    rolloutVariant?: string | null;
    researchTopic?: string | null;
    storageUri: string;
  }> = [];
  if (db) {
    try {
      const snapshot = await db
        .collection("creative_factory_runs")
        .orderBy("created_at", "desc")
        .limit(10)
        .get();
      recentCreativeRuns = snapshot.docs
        .map((doc) => {
          const data = doc.data() as Record<string, unknown>;
          const remotionReel =
            data.remotion_reel && typeof data.remotion_reel === "object"
              ? (data.remotion_reel as Record<string, unknown>)
              : {};
          const storageUri =
            typeof remotionReel.storage_uri === "string"
              ? remotionReel.storage_uri.trim()
              : "";
          if (!storageUri) {
            return null;
          }
          return {
            id: doc.id,
            skuName:
              typeof data.sku_name === "string" ? data.sku_name : "Unknown SKU",
            createdAt:
              typeof data.created_at_iso === "string" ? data.created_at_iso : null,
            rolloutVariant:
              typeof data.rollout_variant === "string" ? data.rollout_variant : null,
            researchTopic:
              typeof data.research_topic === "string" ? data.research_topic : null,
            storageUri,
          };
        })
        .filter((value): value is NonNullable<typeof value> => Boolean(value));
    } catch {
      recentCreativeRuns = [];
    }
  }

  return {
    repoDocs: docs,
    blueprints,
    opsDocuments: opsDocuments.map((document) => ({
      id: document.id,
      title: document.title,
      sourceFileUri: document.source_file_uri,
      mimeType: document.mime_type || null,
      blueprintIds: document.blueprint_ids || [],
      startupPackIds: document.startup_pack_ids || [],
      extractionStatus: document.extraction_status,
      indexingStatus: document.indexing_status,
      createdAt:
        typeof (document.created_at as { toDate?: () => Date })?.toDate === "function"
          ? (document.created_at as { toDate: () => Date }).toDate().toISOString()
          : typeof document.created_at === "string"
            ? document.created_at
            : null,
      updatedAt:
        typeof (document.updated_at as { toDate?: () => Date })?.toDate === "function"
          ? (document.updated_at as { toDate: () => Date }).toDate().toISOString()
          : typeof document.updated_at === "string"
            ? document.updated_at
            : null,
    })),
    startupPacks: startupPacks.map((pack) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description || "",
      repoDocPaths: pack.repo_doc_paths || [],
      knowledgePagePaths: pack.knowledge_page_paths || [],
      blueprintIds: pack.blueprint_ids || [],
      documentIds: pack.document_ids || [],
      externalSources: pack.external_sources || [],
      creativeContexts: pack.creative_contexts || [],
      operatorNotes: pack.operator_notes || "",
      toolPolicies: pack.tool_policies || {},
      ownerScope: pack.owner_scope || "workspace_admin",
      ownerId: pack.owner_id || null,
      visibility: pack.visibility || "workspace",
      version: pack.version || 1,
      createdBy: pack.created_by || null,
      updatedBy: pack.updated_by || null,
      createdAt:
        typeof (pack.created_at as { toDate?: () => Date })?.toDate === "function"
          ? (pack.created_at as { toDate: () => Date }).toDate().toISOString()
          : typeof pack.created_at === "string"
            ? pack.created_at
            : null,
      updatedAt:
        typeof (pack.updated_at as { toDate?: () => Date })?.toDate === "function"
          ? (pack.updated_at as { toDate: () => Date }).toDate().toISOString()
          : typeof pack.updated_at === "string"
            ? pack.updated_at
            : null,
    })),
    recentCreativeRuns,
    knowledgePages: knowledgePages.map((page) => ({
      path: page.path,
      title: page.title,
      pageKind: page.page_kind,
      owner: page.owner,
      authority: page.authority,
      reviewStatus: page.review_status,
      lastVerifiedAt: page.last_verified_at || null,
    })),
    externalSourceTypes: [
      "notion_reference",
      "google_drive_reference",
      "manual_url_reference",
    ],
  };
}

export async function resolveStartupContext(
  metadata?: Record<string, unknown>,
  queryText = "",
  options?: {
    compact?: boolean;
  },
) {
  const normalized = normalizeMetadata(metadata);
  const startupPacks = await getStartupPacksByIds(normalized.startupPackIds || []);
  const mergedRepoDocPaths = dedupeStringValues([
    ...startupPacks.flatMap((pack) => pack.repo_doc_paths || []),
    ...(normalized.repoDocPaths || []),
  ]);
  const mergedKnowledgePagePaths = dedupeStringValues([
    ...startupPacks.flatMap((pack) => pack.knowledge_page_paths || []),
    ...(normalized.knowledgePagePaths || []),
  ]);
  const mergedBlueprintIds = dedupeStringValues([
    ...startupPacks.flatMap((pack) => pack.blueprint_ids || []),
    ...(normalized.blueprintIds || []),
  ]);
  const mergedDocumentIds = dedupeStringValues([
    ...startupPacks.flatMap((pack) => pack.document_ids || []),
    ...(normalized.documentIds || []),
  ]);
  const mergedExternalSources = dedupeExternalSources([
    ...startupPacks.flatMap((pack) => pack.external_sources || []),
    ...(normalized.externalSources || []),
  ]);
  const mergedCreativeContexts = dedupeCreativeContexts([
    ...startupPacks.flatMap((pack) => pack.creative_contexts || []),
    ...(normalized.creativeContexts || []),
  ]);
  const mergedOperatorNotes = mergeOperatorNotes(
    startupPacks,
    normalized.operatorNotes || "",
  );
  const compact = options?.compact === true;
  const repoDocs = await Promise.all(
    mergedRepoDocPaths
      .slice(0, compact ? 4 : 8)
      .map((docPath) => readRepoDocExcerpt(docPath, { compact })),
  );
  const knowledgePages = await Promise.all(
    mergedKnowledgePagePaths
      .slice(0, compact ? 4 : 8)
      .map((pagePath) => readKnowledgePage(pagePath, { compact })),
  );
  const attachedDocuments = await getOpsDocumentsByIds(
    mergedDocumentIds.slice(0, compact ? 4 : 10),
  );
  const blueprintContexts = (
    await Promise.all(
      mergedBlueprintIds
        .slice(0, compact ? 3 : 6)
        .map((blueprintId) => loadBlueprintContext(blueprintId, queryText)),
    )
  ).filter(Boolean);

  return {
    mode: compact ? "interactive_operator_attached_compact" : "interactive_operator_attached",
    operator_notes: mergedOperatorNotes,
    repo_docs: repoDocs,
    knowledge_pages: knowledgePages,
    blueprint_contexts: blueprintContexts,
    attached_documents: attachedDocuments.map((document) => ({
      id: document.id,
      title: document.title,
      source_file_uri: document.source_file_uri,
      extracted_summary: document.extracted_summary || "",
      extraction_status: document.extraction_status,
    })),
    external_sources: mergedExternalSources.slice(0, compact ? 6 : mergedExternalSources.length),
    creative_contexts: mergedCreativeContexts.slice(
      0,
      compact ? 4 : mergedCreativeContexts.length,
    ),
    attached_startup_packs: startupPacks.map((pack) => ({
      id: pack.id,
      name: pack.name,
      description: pack.description || "",
      version: pack.version || 1,
    })),
  };
}
