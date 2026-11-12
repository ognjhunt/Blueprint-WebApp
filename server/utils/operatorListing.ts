import type { InboundRequest } from "../types/inbound-request";

/**
 * Whether the operator has pulled their site from public supply.
 *
 * One question, asked the same way everywhere: the public catalog
 * (`site-worlds.ts`) and `teamJobAccess` honor it, and pilot projection already did.
 * It is a listing control, deliberately narrower than a takedown — consent
 * and rights stay authoritative through their own gates whether or not this
 * flag is set. Blueprint's own preparation and screening of the job never
 * read it: hiding the card from partners does not stop Blueprint's run.
 */
export function operatorListingPaused(
  request: InboundRequest | Record<string, unknown> | null | undefined,
): boolean {
  const task = (request as { workspace_task?: { paused?: boolean; archived?: boolean } | undefined } | null | undefined)
    ?.workspace_task;
  // A closed task is off the library and out of paid runs too. "Close task"
  // used to set only `archived`, which nothing here read, so a site that
  // closed its task stayed listed and buyable.
  return task?.paused === true || task?.archived === true;
}

/**
 * Blueprint's own hold: the operator stopped showing the job to companies from the job console ("Stop showing this
 * job to companies", package C1). `teamJobAccess` reads it, so the library card, the response route and the site's
 * own sentence ("not visible right now") all follow it. Null when the job is not held.
 */
export function operatorListingHold(
  request: InboundRequest | Record<string, unknown> | null | undefined,
): { atIso: string; by: string | null; reason: string | null } | null {
  const hold = (request as { operator_listing_hold?: Record<string, unknown> } | null | undefined)?.operator_listing_hold;
  if (!hold || typeof hold !== "object" || hold.held !== true) return null;
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  return { atIso: String(hold.atIso ?? ""), by: text(hold.byEmail) ?? text(hold.by), reason: text(hold.reason) };
}
