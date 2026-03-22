import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { extractPdf } from "../integrations/openclaw/client";
import { logger } from "../logger";
import { embedTexts } from "../retrieval/embeddings";
import { recordOpsActionLog } from "./ops-action-logs";
import type { OpsDocumentRecord } from "./types";

const OPS_DOCUMENT_COLLECTION = "opsDocuments";
const DEFAULT_DOCUMENT_CHUNK_SIZE = 1600;
const DEFAULT_DOCUMENT_CHUNK_OVERLAP = 200;
const MAX_DOCUMENT_CHUNKS = 24;

function nowTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function normalizeStringArray(value: unknown) {
  return Array.from(
    new Set(
      Array.isArray(value)
        ? value
            .filter((entry): entry is string => typeof entry === "string")
            .map((entry) => entry.trim())
            .filter(Boolean)
        : [],
    ),
  );
}

function chunkText(text: string) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length && chunks.length < MAX_DOCUMENT_CHUNKS) {
    const end = Math.min(normalized.length, start + DEFAULT_DOCUMENT_CHUNK_SIZE);
    chunks.push(normalized.slice(start, end).trim());
    if (end === normalized.length) {
      break;
    }
    start = Math.max(0, end - DEFAULT_DOCUMENT_CHUNK_OVERLAP);
  }
  return chunks.filter(Boolean);
}

function hashDocumentChunk(sourceFileUri: string, chunk: string, index: number) {
  return crypto
    .createHash("sha1")
    .update(`${sourceFileUri}::${index}::${chunk}`)
    .digest("hex")
    .slice(0, 32);
}

export async function listOpsDocuments(limit = 50) {
  if (!db) {
    return [];
  }

  const snapshot = await db
    .collection(OPS_DOCUMENT_COLLECTION)
    .orderBy("updated_at", "desc")
    .limit(Math.max(1, Math.min(limit, 100)))
    .get();

  return snapshot.docs.map((doc) => doc.data() as OpsDocumentRecord);
}

export async function getOpsDocument(documentId: string) {
  if (!db || !documentId) {
    return null;
  }

  const doc = await db.collection(OPS_DOCUMENT_COLLECTION).doc(documentId).get();
  if (!doc.exists) {
    return null;
  }

  return doc.data() as OpsDocumentRecord;
}

export async function getOpsDocumentsByIds(documentIds: string[]) {
  const ids = normalizeStringArray(documentIds);
  if (!db || ids.length === 0) {
    return [];
  }
  const firestore = db;

  const docs = await Promise.all(
    ids.map((documentId) =>
      firestore.collection(OPS_DOCUMENT_COLLECTION).doc(documentId).get(),
    ),
  );

  return docs
    .filter((doc) => doc.exists)
    .map((doc) => doc.data() as OpsDocumentRecord);
}

export async function createOpsDocument(params: {
  title: string;
  source_file_uri: string;
  mime_type?: string | null;
  blueprint_ids?: string[];
  startup_pack_ids?: string[];
  actor?: {
    uid?: string | null;
    email?: string | null;
  };
}) {
  const documentId = crypto.randomUUID();
  const record: OpsDocumentRecord = {
    id: documentId,
    title: params.title.trim(),
    source_file_uri: params.source_file_uri.trim(),
    mime_type: params.mime_type?.trim() || "application/pdf",
    blueprint_ids: normalizeStringArray(params.blueprint_ids),
    startup_pack_ids: normalizeStringArray(params.startup_pack_ids),
    extraction_status: "pending",
    indexing_status: "not_started",
    extracted_summary: null,
    extracted_text: null,
    structured_result: null,
    artifacts: null,
    logs: null,
    openclaw_session_id: null,
    openclaw_run_id: null,
    error: null,
    created_by: {
      uid: params.actor?.uid || null,
      email: params.actor?.email || null,
    },
    updated_by: {
      uid: params.actor?.uid || null,
      email: params.actor?.email || null,
    },
    created_at: nowTimestamp(),
    updated_at: nowTimestamp(),
  };

  if (db) {
    await db.collection(OPS_DOCUMENT_COLLECTION).doc(documentId).set(record);
  }

  return (await getOpsDocument(documentId)) || record;
}

export async function updateOpsDocument(
  documentId: string,
  params: {
    title?: string;
    source_file_uri?: string;
    mime_type?: string | null;
    blueprint_ids?: string[];
    startup_pack_ids?: string[];
    actor?: {
      uid?: string | null;
      email?: string | null;
    };
  },
) {
  if (!db) {
    return null;
  }

  const existing = await getOpsDocument(documentId);
  if (!existing) {
    return null;
  }

  await db.collection(OPS_DOCUMENT_COLLECTION).doc(documentId).set(
    {
      ...(params.title !== undefined ? { title: params.title.trim() } : {}),
      ...(params.source_file_uri !== undefined
        ? { source_file_uri: params.source_file_uri.trim() }
        : {}),
      ...(params.mime_type !== undefined ? { mime_type: params.mime_type || null } : {}),
      ...(params.blueprint_ids !== undefined
        ? { blueprint_ids: normalizeStringArray(params.blueprint_ids) }
        : {}),
      ...(params.startup_pack_ids !== undefined
        ? { startup_pack_ids: normalizeStringArray(params.startup_pack_ids) }
        : {}),
      updated_by: {
        uid: params.actor?.uid || null,
        email: params.actor?.email || null,
      },
      updated_at: nowTimestamp(),
    },
    { merge: true },
  );

  return getOpsDocument(documentId);
}

async function indexDocumentForBlueprints(document: OpsDocumentRecord) {
  if (!db) {
    return "failed" as const;
  }

  const text = String(document.extracted_text || "").trim();
  if (!text || document.blueprint_ids.length === 0) {
    return "not_started" as const;
  }

  const chunks = chunkText(text);
  if (chunks.length === 0) {
    return "not_started" as const;
  }

  let embeddings: number[][] = [];
  try {
    embeddings = await embedTexts(chunks);
  } catch (error) {
    logger.warn({ documentId: document.id, err: error }, "Failed to embed ops document");
  }

  for (const blueprintId of document.blueprint_ids) {
    const collectionRef = db
      .collection("blueprints")
      .doc(blueprintId)
      .collection("knowledge_chunks");

    for (const [index, chunk] of chunks.entries()) {
      const docRef = collectionRef.doc(hashDocumentChunk(document.source_file_uri, chunk, index));
      const embedding = Array.isArray(embeddings[index]) ? embeddings[index] : [];
      await docRef.set(
        {
          blueprintId,
          sourceUrl: document.source_file_uri,
          sourceTitle: document.title,
          sourceCategory: "ops_document",
          text: chunk,
          embedding,
          tokenCount: Math.round(chunk.split(/\s+/).length * 1.3),
          updatedAt: nowTimestamp(),
        },
        { merge: true },
      );
    }
  }

  return embeddings.some((entry) => Array.isArray(entry) && entry.length > 0)
    ? ("completed" as const)
    : ("partial" as const);
}

export async function extractOpsDocument(documentId: string) {
  const document = await getOpsDocument(documentId);
  if (!document) {
    throw new Error("Ops document not found");
  }

  if (!db) {
    throw new Error("Database not available");
  }

  await db.collection(OPS_DOCUMENT_COLLECTION).doc(documentId).set(
    {
      extraction_status: "running",
      error: null,
      updated_at: nowTimestamp(),
    },
    { merge: true },
  );

  await recordOpsActionLog({
    session_id: null,
    run_id: null,
    session_key: `ops-document:${documentId}`,
    action_key: "ops.document.extract",
    status: "started",
    summary: `Extracting ${document.title}`,
    provider: "openclaw",
    runtime: "openclaw",
    task_kind: "operator_thread",
    risk_level: "low",
    reversible: true,
    requires_approval: false,
    metadata: {
      document_id: documentId,
      source_file_uri: document.source_file_uri,
    },
  });

  try {
    const response = await extractPdf({
      request_id: crypto.randomUUID(),
      session_key: `ops-document:${documentId}`,
      mode: "sync",
      inputs: {
        document_id: documentId,
        pdf: document.source_file_uri,
      },
      startup_context: null,
      policy: {
        risk_level: "low",
        requires_approval: false,
        allowed_domains: [],
        allowed_tools: ["pdf"],
        allowed_skill_ids: ["blueprint-pdf-extractor"],
        forbidden_actions: [],
        artifact_retention_policy: {
          retain_logs: true,
          retain_artifacts: true,
          retention_days: 30,
        },
      },
      artifacts_config: {
        artifact_targets: ["pdf_extraction", "json_result", "text_summary"],
        include_logs: true,
        include_screenshots: false,
      },
      prompt:
        "Extract the document text, summarize it, and return structured JSON fields for downstream storage.",
      model: process.env.OPENCLAW_DEFAULT_MODEL || "openai/gpt-5.4",
      wait_timeout_ms: Number(process.env.OPENCLAW_WAIT_TIMEOUT_MS ?? 60_000),
    });

    const resultRecord =
      response.result && typeof response.result === "object"
        ? (response.result as Record<string, unknown>)
        : {};
    const extractedText =
      typeof resultRecord.text === "string"
        ? resultRecord.text
        : typeof resultRecord.extracted_text === "string"
          ? resultRecord.extracted_text
          : null;
    const extractedSummary =
      typeof resultRecord.summary === "string"
        ? resultRecord.summary
        : typeof resultRecord.text_summary === "string"
          ? resultRecord.text_summary
          : null;

    const indexingStatus =
      response.status === "completed" && extractedText
        ? await indexDocumentForBlueprints({
            ...document,
            extracted_text: extractedText,
          })
        : "failed";

    await db.collection(OPS_DOCUMENT_COLLECTION).doc(documentId).set(
      {
        extraction_status: response.status === "completed" ? "completed" : "failed",
        indexing_status: indexingStatus,
        extracted_summary: extractedSummary,
        extracted_text: extractedText,
        structured_result: resultRecord,
        artifacts: response.artifacts || null,
        logs: response.logs || null,
        openclaw_session_id: response.openclaw_session_id || null,
        openclaw_run_id: response.openclaw_run_id || null,
        error: response.error || null,
        updated_at: nowTimestamp(),
      },
      { merge: true },
    );

    await recordOpsActionLog({
      session_id: null,
      run_id: null,
      session_key: `ops-document:${documentId}`,
      action_key: "ops.document.extract",
      status: response.status === "completed" ? "completed" : "failed",
      summary:
        response.status === "completed"
          ? `Extracted ${document.title}`
          : response.error || `Extraction failed for ${document.title}`,
      provider: "openclaw",
      runtime: "openclaw",
      task_kind: "operator_thread",
      risk_level: "low",
      reversible: true,
      requires_approval: false,
      metadata: {
        document_id: documentId,
        indexing_status: indexingStatus,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document extraction failed";
    await db.collection(OPS_DOCUMENT_COLLECTION).doc(documentId).set(
      {
        extraction_status: "failed",
        indexing_status: "failed",
        error: message,
        updated_at: nowTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }

  return getOpsDocument(documentId);
}
