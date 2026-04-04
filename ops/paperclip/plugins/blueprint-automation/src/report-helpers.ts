import { createHash } from "node:crypto";
import type { PluginContext } from "@paperclipai/plugin-sdk";

export const BLUEPRINT_AUTOMATION_STATE_NAMESPACE = "blueprint-automation";

export function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  const singleValue = asString(value);
  return singleValue ? [singleValue] : [];
}

export function nowIso() {
  return new Date().toISOString();
}

export async function resolveOptionalSecret(
  ctx: PluginContext,
  ref?: string,
  fallbackName?: string,
): Promise<string | null> {
  if (ref) {
    const resolved = await ctx.secrets.resolve(ref);
    if (resolved) return resolved;
  }

  if (fallbackName) {
    const resolved = await ctx.secrets.resolve(fallbackName);
    if (resolved) return resolved;
  }

  return null;
}

export function configuredSourceStatus(
  source: string,
  configured: boolean,
  availableDetail: string,
  missingDetail: string,
) {
  return {
    source,
    status: configured ? "available" : "missing",
    detail: configured ? availableDetail : missingDetail,
  } as const;
}

export function stableDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizeIssueStatus(
  value: unknown,
  fallback: "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled" = "todo",
): "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled" {
  const next = asString(value);
  if (!next) return fallback;
  if (["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"].includes(next)) {
    return next as "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled";
  }
  return fallback;
}

export function normalizeIssuePriority(
  value: unknown,
  fallback: "critical" | "high" | "medium" | "low" = "medium",
): "critical" | "high" | "medium" | "low" {
  const next = asString(value);
  if (!next) return fallback;
  if (["critical", "high", "medium", "low"].includes(next)) {
    return next as "critical" | "high" | "medium" | "low";
  }
  return fallback;
}

export async function readState<T>(ctx: PluginContext, companyId: string, stateKey: string): Promise<T | null> {
  return await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: BLUEPRINT_AUTOMATION_STATE_NAMESPACE,
    stateKey,
  }) as T | null;
}

export async function writeState(ctx: PluginContext, companyId: string, stateKey: string, value: unknown) {
  await ctx.state.set(
    {
      scopeKind: "company",
      scopeId: companyId,
      namespace: BLUEPRINT_AUTOMATION_STATE_NAMESPACE,
      stateKey,
    },
    value,
  );
}
