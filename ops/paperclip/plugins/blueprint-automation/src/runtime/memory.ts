import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import { fileURLToPath } from "node:url";
import {
  memoryStateKey,
  readRuntimeMemoryIndex,
  readRuntimeState,
  toMemoryRecordKey,
  toPathKey,
  writeRuntimeMemoryIndex,
  writeRuntimeState,
} from "./state.js";
import type { MemoryAuthority, MemoryDurability, MemoryRecord, MemoryScope } from "./types.js";
import { nowIso } from "./types.js";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PLATFORM_CONTEXT_PATH = path.resolve(MODULE_DIR, "../../../../../../PLATFORM_CONTEXT.md");
const WORLD_MODEL_CONTEXT_PATH = path.resolve(MODULE_DIR, "../../../../../../WORLD_MODEL_STRATEGY_CONTEXT.md");
const AUTONOMOUS_ORG_PATH = path.resolve(MODULE_DIR, "../../../../../../AUTONOMOUS_ORG.md");
const TOOLING_POLICY_PATH = path.resolve(MODULE_DIR, "../../../../../../docs/ai-tooling-adoption-implementation-2026-04-07.md");
const SKILLS_POLICY_PATH = path.resolve(MODULE_DIR, "../../../../../../docs/ai-skills-governance-2026-04-07.md");

export async function readMemoryRecord(
  ctx: PluginContext,
  companyId: string,
  storeKey: string,
  path: string,
): Promise<MemoryRecord | null> {
  const index = await readRuntimeMemoryIndex(ctx, companyId);
  const recordKey = toMemoryRecordKey(storeKey, path);
  const latestVersion = index.latestVersionByRecordKey[recordKey];
  if (!latestVersion) {
    return null;
  }
  return await readRuntimeState<MemoryRecord>(
    ctx,
    companyId,
    memoryStateKey(storeKey, toPathKey(path), latestVersion),
  );
}

export async function writeMemoryRecord(
  ctx: PluginContext,
  companyId: string,
  input: {
    storeKey: string;
    path: string;
    scope: MemoryScope;
    title: string;
    content: string;
    labels?: string[];
    sourceSessionId?: string | null;
    sourceIssueId?: string | null;
    authority: MemoryAuthority;
    durability?: MemoryDurability;
    approvalEvidence?: string | null;
    redacted?: boolean;
  },
) {
  if (input.scope === "doctrine_shared" && input.authority !== "repo") {
    throw new Error("Only repo-derived writes may target doctrine_shared memory.");
  }
  if (
    input.scope === "project_shared"
    && (input.durability ?? "candidate_durable") === "approved_durable"
    && !(input.approvalEvidence && input.approvalEvidence.trim().length > 0)
  ) {
    throw new Error("approved_durable writes to project_shared memory require approvalEvidence.");
  }

  const index = await readRuntimeMemoryIndex(ctx, companyId);
  const recordKey = toMemoryRecordKey(input.storeKey, input.path);
  const nextVersion = (index.latestVersionByRecordKey[recordKey] ?? 0) + 1;
  const record: MemoryRecord = {
    id: randomUUID(),
    storeKey: input.storeKey,
    path: input.path,
    scope: input.scope,
    title: input.title,
    content: input.content,
    labels: input.labels ?? [],
    sourceSessionId: input.sourceSessionId ?? null,
    sourceIssueId: input.sourceIssueId ?? null,
    authority: input.authority,
    durability: input.durability ?? (input.scope === "session_scratch" ? "ephemeral" : "candidate_durable"),
    version: nextVersion,
    redacted: input.redacted ?? false,
    approvalEvidence: input.approvalEvidence ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await writeRuntimeState(
    ctx,
    companyId,
    memoryStateKey(input.storeKey, toPathKey(input.path), nextVersion),
    record,
  );
  index.latestVersionByRecordKey[recordKey] = nextVersion;
  const versionsKey = `${input.storeKey}:${input.path}`;
  index.versionsByStorePath[versionsKey] = [...(index.versionsByStorePath[versionsKey] ?? []), nextVersion];
  await writeRuntimeMemoryIndex(ctx, companyId, index);
  return record;
}

export async function listMemoryStoreRecords(
  ctx: PluginContext,
  companyId: string,
  storeKey: string,
): Promise<MemoryRecord[]> {
  const index = await readRuntimeMemoryIndex(ctx, companyId);
  const rows = await Promise.all(
    Object.entries(index.latestVersionByRecordKey)
      .filter(([recordKey]) => recordKey.startsWith(`${storeKey}:`))
      .map(async ([recordKey, version]) => {
        const [, encodedPath] = recordKey.split(":", 2);
        const decodedPath = decodeURIComponent(encodedPath);
        return await readRuntimeState<MemoryRecord>(
          ctx,
          companyId,
          memoryStateKey(storeKey, toPathKey(decodedPath), version),
        );
      }),
  );
  return rows.filter((row): row is MemoryRecord => Boolean(row)).sort((left, right) => left.path.localeCompare(right.path));
}

export async function syncDoctrineMemoryStore(ctx: PluginContext, companyId: string) {
  const doctrineSources = [
    {
      path: "/platform-context.md",
      title: "Platform Context",
      content: readFileSync(PLATFORM_CONTEXT_PATH, "utf8"),
      labels: ["doctrine", "platform"],
    },
    {
      path: "/world-model-strategy-context.md",
      title: "World Model Strategy Context",
      content: readFileSync(WORLD_MODEL_CONTEXT_PATH, "utf8"),
      labels: ["doctrine", "world-model"],
    },
    {
      path: "/autonomous-org.md",
      title: "Autonomous Organization Guide",
      content: readFileSync(AUTONOMOUS_ORG_PATH, "utf8"),
      labels: ["doctrine", "autonomous-org"],
    },
    {
      path: "/ai-tooling-adoption.md",
      title: "AI Tooling Adoption Implementation",
      content: readFileSync(TOOLING_POLICY_PATH, "utf8"),
      labels: ["policy", "tooling"],
    },
    {
      path: "/ai-skills-governance.md",
      title: "AI Skills Governance",
      content: readFileSync(SKILLS_POLICY_PATH, "utf8"),
      labels: ["policy", "skills"],
    },
  ];

  for (const source of doctrineSources) {
    const existing = await readMemoryRecord(ctx, companyId, "doctrine_shared", source.path);
    if (existing?.content === source.content) {
      continue;
    }
    await writeMemoryRecord(ctx, companyId, {
      storeKey: "doctrine_shared",
      path: source.path,
      scope: "doctrine_shared",
      title: source.title,
      content: source.content,
      labels: source.labels,
      authority: "repo",
      durability: "approved_durable",
      approvalEvidence: "repo-doctrine-sync",
    });
  }
}
