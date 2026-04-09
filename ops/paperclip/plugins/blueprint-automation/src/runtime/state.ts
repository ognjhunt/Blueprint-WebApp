import type { PluginContext } from "@paperclipai/plugin-sdk";
import {
  emptyRuntimeMemoryIndex,
  emptyRuntimeSessionIndex,
  emptyRuntimeSubagentIndex,
  type RuntimeMemoryIndex,
  type RuntimeSessionIndex,
  type RuntimeSubagentIndex,
} from "./types.js";

export const RUNTIME_NAMESPACE = "blueprint-automation-runtime";
export const RUNTIME_STATE_KEYS = {
  sessionIndex: "runtime-session-index",
  subagentIndex: "runtime-subagent-index",
  memoryIndex: "runtime-memory-index",
  vaultGrants: "runtime-vault-grants",
} as const;

export async function readRuntimeState<T>(
  ctx: PluginContext,
  companyId: string,
  stateKey: string,
): Promise<T | null> {
  return await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: RUNTIME_NAMESPACE,
    stateKey,
  }) as T | null;
}

export async function writeRuntimeState(
  ctx: PluginContext,
  companyId: string,
  stateKey: string,
  value: unknown,
) {
  await ctx.state.set(
    {
      scopeKind: "company",
      scopeId: companyId,
      namespace: RUNTIME_NAMESPACE,
      stateKey,
    },
    value,
  );
}

export function sessionStateKey(sessionId: string) {
  return `runtime-session:${sessionId}`;
}

export function sessionTraceStateKey(sessionId: string) {
  return `runtime-trace:${sessionId}`;
}

export function checkpointStateKey(checkpointId: string) {
  return `runtime-checkpoint:${checkpointId}`;
}

export function memoryStateKey(storeKey: string, pathKey: string, version: number) {
  return `runtime-memory:${storeKey}:${pathKey}:v${version}`;
}

export async function readRuntimeSessionIndex(ctx: PluginContext, companyId: string): Promise<RuntimeSessionIndex> {
  return await readRuntimeState<RuntimeSessionIndex>(ctx, companyId, RUNTIME_STATE_KEYS.sessionIndex) ?? emptyRuntimeSessionIndex();
}

export async function writeRuntimeSessionIndex(ctx: PluginContext, companyId: string, index: RuntimeSessionIndex) {
  await writeRuntimeState(ctx, companyId, RUNTIME_STATE_KEYS.sessionIndex, index);
}

export async function readRuntimeSubagentIndex(ctx: PluginContext, companyId: string): Promise<RuntimeSubagentIndex> {
  return await readRuntimeState<RuntimeSubagentIndex>(ctx, companyId, RUNTIME_STATE_KEYS.subagentIndex) ?? emptyRuntimeSubagentIndex();
}

export async function writeRuntimeSubagentIndex(ctx: PluginContext, companyId: string, index: RuntimeSubagentIndex) {
  await writeRuntimeState(ctx, companyId, RUNTIME_STATE_KEYS.subagentIndex, index);
}

export async function readRuntimeMemoryIndex(ctx: PluginContext, companyId: string): Promise<RuntimeMemoryIndex> {
  return await readRuntimeState<RuntimeMemoryIndex>(ctx, companyId, RUNTIME_STATE_KEYS.memoryIndex) ?? emptyRuntimeMemoryIndex();
}

export async function writeRuntimeMemoryIndex(ctx: PluginContext, companyId: string, index: RuntimeMemoryIndex) {
  await writeRuntimeState(ctx, companyId, RUNTIME_STATE_KEYS.memoryIndex, index);
}

export function toPathKey(path: string) {
  return encodeURIComponent(path.trim().toLowerCase());
}

export function toMemoryRecordKey(storeKey: string, path: string) {
  return `${storeKey}:${toPathKey(path)}`;
}
