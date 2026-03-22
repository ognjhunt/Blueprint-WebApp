import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type {
  ExternalKnowledgeSource,
  StartupPackOwnerScope,
  StartupPackRecord,
  StartupPackVisibility,
} from "./types";

const STARTUP_PACK_COLLECTION = "opsStartupPacks";

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

function normalizeExternalSources(value: unknown): ExternalKnowledgeSource[] {
  const sources = Array.isArray(value) ? value : [];
  const dedupe = new Map<string, ExternalKnowledgeSource>();

  for (const source of sources) {
    if (!source || typeof source !== "object") {
      continue;
    }

    const candidate = source as ExternalKnowledgeSource;
    const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
    const url = typeof candidate.url === "string" ? candidate.url.trim() : "";
    const description =
      typeof candidate.description === "string" ? candidate.description.trim() : "";
    const sourceType =
      typeof candidate.source_type === "string" ? candidate.source_type.trim() : "";

    if (!title || !url) {
      continue;
    }

    dedupe.set(`${title}::${url}`, {
      title,
      url,
      description: description || undefined,
      source_type: sourceType || undefined,
    });
  }

  return [...dedupe.values()];
}

export async function listStartupPacks(limit = 50) {
  if (!db) {
    return [];
  }

  const snapshot = await db
    .collection(STARTUP_PACK_COLLECTION)
    .orderBy("updated_at", "desc")
    .limit(Math.max(1, Math.min(limit, 100)))
    .get();

  return snapshot.docs.map((doc) => doc.data() as StartupPackRecord);
}

export async function getStartupPack(startupPackId: string) {
  if (!db || !startupPackId) {
    return null;
  }

  const doc = await db.collection(STARTUP_PACK_COLLECTION).doc(startupPackId).get();
  if (!doc.exists) {
    return null;
  }

  return doc.data() as StartupPackRecord;
}

export async function getStartupPacksByIds(startupPackIds: string[]) {
  const ids = normalizeStringArray(startupPackIds);
  if (!db || ids.length === 0) {
    return [];
  }
  const firestore = db;

  const docs = await Promise.all(
    ids.map((startupPackId) =>
      firestore.collection(STARTUP_PACK_COLLECTION).doc(startupPackId).get(),
    ),
  );

  return docs
    .filter((doc) => doc.exists)
    .map((doc) => doc.data() as StartupPackRecord);
}

export async function createStartupPack(params: {
  name: string;
  description?: string;
  repo_doc_paths?: string[];
  blueprint_ids?: string[];
  document_ids?: string[];
  external_sources?: ExternalKnowledgeSource[];
  operator_notes?: string;
  tool_policies?: Record<string, unknown>;
  owner_scope?: StartupPackOwnerScope;
  owner_id?: string | null;
  visibility?: StartupPackVisibility;
  actor?: {
    uid?: string | null;
    email?: string | null;
  };
}) {
  const startupPackId = crypto.randomUUID();
  const record: StartupPackRecord = {
    id: startupPackId,
    name: params.name.trim(),
    description: params.description?.trim() || "",
    repo_doc_paths: normalizeStringArray(params.repo_doc_paths),
    blueprint_ids: normalizeStringArray(params.blueprint_ids),
    document_ids: normalizeStringArray(params.document_ids),
    external_sources: normalizeExternalSources(params.external_sources),
    operator_notes: params.operator_notes?.trim() || "",
    tool_policies:
      params.tool_policies && typeof params.tool_policies === "object"
        ? params.tool_policies
        : {},
    owner_scope: params.owner_scope || "workspace_admin",
    owner_id: params.owner_id || null,
    visibility: params.visibility || "workspace",
    version: 1,
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
    await db.collection(STARTUP_PACK_COLLECTION).doc(startupPackId).set(record);
    const saved = await getStartupPack(startupPackId);
    if (saved) {
      return saved;
    }
  }

  return record;
}

export async function updateStartupPack(
  startupPackId: string,
  params: {
    name?: string;
    description?: string;
    repo_doc_paths?: string[];
    blueprint_ids?: string[];
    document_ids?: string[];
    external_sources?: ExternalKnowledgeSource[];
    operator_notes?: string;
    tool_policies?: Record<string, unknown>;
    owner_scope?: StartupPackOwnerScope;
    owner_id?: string | null;
    visibility?: StartupPackVisibility;
    actor?: {
      uid?: string | null;
      email?: string | null;
    };
  },
) {
  if (!db) {
    return null;
  }

  const existing = await getStartupPack(startupPackId);
  if (!existing) {
    return null;
  }

  await db.collection(STARTUP_PACK_COLLECTION).doc(startupPackId).set(
    {
      ...(params.name !== undefined ? { name: params.name.trim() } : {}),
      ...(params.description !== undefined
        ? { description: params.description.trim() }
        : {}),
      ...(params.repo_doc_paths !== undefined
        ? { repo_doc_paths: normalizeStringArray(params.repo_doc_paths) }
        : {}),
      ...(params.blueprint_ids !== undefined
        ? { blueprint_ids: normalizeStringArray(params.blueprint_ids) }
        : {}),
      ...(params.document_ids !== undefined
        ? { document_ids: normalizeStringArray(params.document_ids) }
        : {}),
      ...(params.external_sources !== undefined
        ? { external_sources: normalizeExternalSources(params.external_sources) }
        : {}),
      ...(params.operator_notes !== undefined
        ? { operator_notes: params.operator_notes.trim() }
        : {}),
      ...(params.tool_policies !== undefined
        ? {
            tool_policies:
              params.tool_policies && typeof params.tool_policies === "object"
                ? params.tool_policies
                : {},
          }
        : {}),
      ...(params.owner_scope !== undefined ? { owner_scope: params.owner_scope } : {}),
      ...(params.owner_id !== undefined ? { owner_id: params.owner_id } : {}),
      ...(params.visibility !== undefined ? { visibility: params.visibility } : {}),
      updated_by: {
        uid: params.actor?.uid || null,
        email: params.actor?.email || null,
      },
      updated_at: nowTimestamp(),
      version: (existing.version || 1) + 1,
    },
    { merge: true },
  );

  return getStartupPack(startupPackId);
}
