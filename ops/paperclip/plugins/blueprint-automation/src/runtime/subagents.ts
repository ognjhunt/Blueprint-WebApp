import { randomUUID } from "node:crypto";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import { readRuntimeSubagentIndex, writeRuntimeSubagentIndex } from "./state.js";
import type { RuntimeSubagent } from "./types.js";
import { nowIso } from "./types.js";

export async function createRuntimeSubagent(
  ctx: PluginContext,
  companyId: string,
  input: Omit<RuntimeSubagent, "id" | "createdAt" | "completedAt">,
) {
  const index = await readRuntimeSubagentIndex(ctx, companyId);
  const subagent: RuntimeSubagent = {
    id: randomUUID(),
    createdAt: nowIso(),
    completedAt: null,
    ...input,
  };
  index.byId[subagent.id] = subagent;
  index.childIdsByParentSession[subagent.parentSessionId] = [
    ...(index.childIdsByParentSession[subagent.parentSessionId] ?? []),
    subagent.id,
  ];
  await writeRuntimeSubagentIndex(ctx, companyId, index);
  return subagent;
}

export async function updateRuntimeSubagentStatus(
  ctx: PluginContext,
  companyId: string,
  subagentId: string,
  status: RuntimeSubagent["status"],
) {
  const index = await readRuntimeSubagentIndex(ctx, companyId);
  const existing = index.byId[subagentId];
  if (!existing) {
    return null;
  }
  const next: RuntimeSubagent = {
    ...existing,
    status,
    completedAt:
      status === "completed" || status === "blocked" || status === "failed" || status === "cancelled"
        ? nowIso()
        : existing.completedAt,
  };
  index.byId[subagentId] = next;
  await writeRuntimeSubagentIndex(ctx, companyId, index);
  return next;
}

export async function listRuntimeSubagentsForParent(
  ctx: PluginContext,
  companyId: string,
  parentSessionId: string,
) {
  const index = await readRuntimeSubagentIndex(ctx, companyId);
  return (index.childIdsByParentSession[parentSessionId] ?? [])
    .map((id) => index.byId[id])
    .filter((value): value is RuntimeSubagent => Boolean(value));
}
