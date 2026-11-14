/**
 * The outcome notice intent the screening ingest and the hold route still write beside a run's outcome
 * (`outcome_notification_intent`). Nothing sends it any more: Blueprint's own early trial is no longer told to
 * sites (2026-11-14), and a notice queued before then is cancelled at dispatch (`captureOutbox` `RETIRED_KINDS`).
 * The intent stays the same shape so the receiving routes keep storing exactly what they stored.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { isScreeningResultOutcome, screeningCandidateRows, screeningOutcome, screeningOutcomeCaveat, SCREENING_OUTCOME_CAVEATS,
  type BetaPolicyScreeningPublication, type ScreeningOutcome , SCREENING_HOLD_DETAILS, type ScreeningHoldDetail } from "./betaPolicyScreeningContract";

export const SCREENING_OUTCOME_NOTICE_SCHEMA = "screening_outcome_notification.v1";
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const count = z.number().int().min(0).max(1_000_000);
const intentSchema = z.object({
  schema_version: z.literal(SCREENING_OUTCOME_NOTICE_SCHEMA), request_id: identifier, run_id: identifier,
  outcome: z.enum(["estimate", "reference_only", "held_capability", "held_unprepared", "infeasible", "no_match",
    "held_setup", "held_budget", "held_scene_check"]),
  event_id: z.string().regex(/^[a-z_]+-[a-f0-9]{24}$/),
  counts: z.object({ ran: count, total: count, scored: count }).strict().optional(),
  /** What the estimate's sentence adds; absent on intents written before it existed and on every other outcome. */
  caveat: z.enum(SCREENING_OUTCOME_CAVEATS).optional(),
  /** A hold's detail with words of its own (`screeningHoldDetail`); only on a set-up hold. */
  hold_detail: z.enum(SCREENING_HOLD_DETAILS).optional(),
}).strict().refine(value => value.event_id.startsWith(`${value.outcome}-`) && (value.outcome === "estimate") === Boolean(value.counts)
  && (value.caveat === undefined || value.outcome === "estimate") && (value.hold_detail === undefined || value.outcome === "held_setup"));
export type ScreeningOutcomeNoticeIntent = z.infer<typeof intentSchema>;

/** The same outcome on the same scene is one email, whichever campaign reached it. */
export const screeningOutcomeNoticeEventId = (outcome: string, sceneIntentId: string) =>
  `${outcome}-${createHash("sha256").update(sceneIntentId).digest("hex").slice(0, 24)}`;

/** The notice a run with a result outcome owes its site, or null. Pure: ingest writes it beside the outcome. */
export function screeningOutcomeNoticeIntent(publication: BetaPolicyScreeningPublication, requestId: string): ScreeningOutcomeNoticeIntent | null {
  const outcome = screeningOutcome(publication);
  if (!isScreeningResultOutcome(outcome)) return null;
  const caveat = screeningOutcomeCaveat(publication);
  // Counts of candidates: the known-good control is a check, not one of them.
  const rows = screeningCandidateRows(publication.candidates);
  return { schema_version: SCREENING_OUTCOME_NOTICE_SCHEMA, request_id: requestId, run_id: publication.campaign_id, outcome,
    event_id: screeningOutcomeNoticeEventId(outcome, publication.source.scene_intent_id),
    ...(outcome === "estimate" ? { counts: { ran: rows.filter(row => row.status === "completed").length,
      total: rows.length, scored: rows.reduce((sum, row) => sum + row.episodes_scored, 0) } } : {}),
    ...(caveat ? { caveat } : {}) };
}

/** The notice a Pipeline hold owes its site (no campaign started), or null. Same key as a run's: one email per outcome and scene. */
export function heldOutcomeNoticeIntent(outcome: ScreeningOutcome | null, requestId: string, runId: string,
  sceneIntentId: string, holdDetail: ScreeningHoldDetail | null = null): ScreeningOutcomeNoticeIntent | null {
  if (!isScreeningResultOutcome(outcome) || outcome === "estimate") return null;
  return parseScreeningOutcomeNoticeIntent({ schema_version: SCREENING_OUTCOME_NOTICE_SCHEMA, request_id: requestId, run_id: runId,
    outcome, event_id: screeningOutcomeNoticeEventId(outcome, sceneIntentId),
    ...(holdDetail && outcome === "held_setup" ? { hold_detail: holdDetail } : {}) });
}

export function parseScreeningOutcomeNoticeIntent(value: unknown): ScreeningOutcomeNoticeIntent | null {
  const parsed = intentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
