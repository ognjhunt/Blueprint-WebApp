import { randomUUID } from "node:crypto";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import { readRuntimeState, sessionTraceStateKey, writeRuntimeState } from "./state.js";
import type { RuntimeTraceActor, RuntimeTraceEvent, RuntimeTraceEventType } from "./types.js";
import { nowIso } from "./types.js";

export async function readRuntimeTrace(
  ctx: PluginContext,
  companyId: string,
  sessionId: string,
): Promise<RuntimeTraceEvent[]> {
  return await readRuntimeState<RuntimeTraceEvent[]>(ctx, companyId, sessionTraceStateKey(sessionId)) ?? [];
}

export async function appendRuntimeTraceEvent(
  ctx: PluginContext,
  companyId: string,
  sessionId: string,
  input: {
    type: RuntimeTraceEventType;
    actor: RuntimeTraceActor;
    summary: string;
    detail?: Record<string, unknown> | null;
    at?: string;
  },
) {
  const trace = await readRuntimeTrace(ctx, companyId, sessionId);
  const event: RuntimeTraceEvent = {
    id: randomUUID(),
    sessionId,
    sequence: trace.length + 1,
    at: input.at ?? nowIso(),
    type: input.type,
    actor: input.actor,
    summary: input.summary,
    detail: input.detail ?? null,
  };
  trace.push(event);
  await writeRuntimeState(ctx, companyId, sessionTraceStateKey(sessionId), trace);
  return event;
}
