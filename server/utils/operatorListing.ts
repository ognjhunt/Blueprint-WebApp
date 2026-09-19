import type { InboundRequest } from "../types/inbound-request";

/**
 * Whether the operator has pulled their site from public supply.
 *
 * One question, asked the same way everywhere: the public catalog
 * (`site-worlds.ts`) and runnable supply for new paid runs
 * (`teamEvalCandidates.ts`) both honor it, and pilot projection already did.
 * It is a listing control, deliberately narrower than a takedown — consent
 * and rights stay authoritative through their own gates whether or not this
 * flag is set.
 */
export function operatorListingPaused(
  request: InboundRequest | Record<string, unknown> | null | undefined,
): boolean {
  const task = (request as { workspace_task?: { paused?: boolean } | undefined } | null | undefined)
    ?.workspace_task;
  return task?.paused === true;
}
