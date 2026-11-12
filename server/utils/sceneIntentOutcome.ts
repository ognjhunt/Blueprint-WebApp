/**
 * C-04: every website job ends in exactly one terminal state, and the site is
 * told it once.
 *
 * The Pipeline decides one outcome per scene intent and serves it on the
 * intent status (`outcome`, present only when there is one), sealed by its own
 * `outcome_digest` and inside `status_digest`. This module is what the WebApp
 * reads from it, and is pure:
 *
 * - the record: `kind` is a closed set; the reason fields stay open, validated
 *   strings, so a reason the Pipeline adds later never fails the strict status
 *   parse (which would leave the job polled forever);
 * - which stored outcome speaks for the site (`adoptedSceneOutcome`);
 * - the one plain sentence per outcome that the job page and the email both
 *   say. A site never reads a raw code;
 * - the email intent the worker writes beside a terminal outcome.
 *
 * Doctrine (owner-approved): only privacy, rights and money are hard stops.
 * `held` (terminal) is a capability limit: we can't simulate this kind of job
 * yet. `withdrawn` (terminal) is rights or consent ending. `setup_repair` waits
 * while Blueprint can still fix it, and ends only when the execution window
 * expired or a non-extendable allowance ran out. `awaiting_spend_approval` and
 * `awaiting_site` are waits.
 */
import { z } from "zod";
import { simulationOutcomeEmailSentence } from "./betaPolicyScreeningContract";
import { crossRuntimeArtifactDigest } from "./crossRuntimeCanonical";

export const SCENE_INTENT_OUTCOME_SCHEMA = "task_evaluation_scene_intent_outcome.v1";
export const SCENE_INTENT_OUTCOME_KINDS = ["setup_repair", "awaiting_spend_approval", "awaiting_site", "withdrawn", "held"] as const;
export type SceneIntentOutcomeKind = typeof SCENE_INTENT_OUTCOME_KINDS[number];
/** The endings the site is told about once. */
export const TERMINAL_SCENE_OUTCOME_KINDS = ["held", "withdrawn", "setup_repair"] as const;
export type TerminalSceneOutcomeKind = typeof TERMINAL_SCENE_OUTCOME_KINDS[number];

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const reason = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/);
export const sceneIntentOutcomeSchema = z.object({
  schema_version: z.literal(SCENE_INTENT_OUTCOME_SCHEMA),
  intent_id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/),
  intent_digest: digest,
  // Open (review, 2026-11-12): a kind this release does not know never fails the intake's status read. Such an
  // outcome is not adopted (`adoptedSceneOutcome`): the job keeps the state its status otherwise shows, and staff hear.
  kind: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
  terminal: z.boolean(),
  reason_category: reason,
  reason_code: reason,
  decided_at_epoch: z.number().finite().nonnegative(),
  outcome_digest: digest,
}).strict();
export type SceneIntentOutcome = Omit<z.infer<typeof sceneIntentOutcomeSchema>, "kind"> & { kind: SceneIntentOutcomeKind };
export const isKnownSceneIntentOutcomeKind = (kind: unknown): kind is SceneIntentOutcomeKind =>
  (SCENE_INTENT_OUTCOME_KINDS as readonly unknown[]).includes(kind);

/** Sealed by the Pipeline over every other field, and decided for this exact intent. */
export function sceneIntentOutcomeBinds(outcome: SceneIntentOutcome, status: { intent_id: string; intent_digest: string }): boolean {
  try {
    return outcome.intent_id === status.intent_id && outcome.intent_digest === status.intent_digest
      && crossRuntimeArtifactDigest(outcome, "outcome_digest") === outcome.outcome_digest;
  } catch {
    return false;
  }
}

const isTerminalKind = (value: unknown): value is TerminalSceneOutcomeKind =>
  (TERMINAL_SCENE_OUTCOME_KINDS as readonly unknown[]).includes(value);
const WAIT_KINDS = new Set<string>(["setup_repair", "awaiting_spend_approval", "awaiting_site"]);
/** The pairings the contract defines: endings are terminal, waits are not. */
const definedPairing = (outcome: SceneIntentOutcome) => outcome.terminal ? isTerminalKind(outcome.kind) : WAIT_KINDS.has(outcome.kind);
/** The only cause of a WebApp revoke that is the site's rights ending (the capture's consent or rights). */
const RIGHTS_REVOCATION_CAUSES = new Set(["source_revoked"]);

/**
 * The stored outcome that speaks for the site, or null: an older Pipeline sent
 * none, or nothing has been decided. A completed status supersedes any outcome.
 * While a reserved attempt can still finish (the read-only closeout) or the
 * WebApp is revoking, the ending waits for that to settle. The WebApp's own
 * revoke for a reason that is not the site's rights (a changed task, a missing
 * brief, an operator stop) comes back as `withdrawn`/`authority_revoked`
 * because a revocation receipt carries no reason. That is not the site's
 * withdrawal, so it is not adopted and the intake keeps its earlier reading.
 */
export function adoptedSceneOutcome(record: Record<string, any> | null | undefined): SceneIntentOutcome | null {
  const status = record?.pipeline_status;
  const parsed = sceneIntentOutcomeSchema.safeParse(status?.outcome);
  if (!record || !parsed.success || !isKnownSceneIntentOutcomeKind(parsed.data.kind) || !definedPairing(parsed.data as SceneIntentOutcome)
    || status.status === "completed"
    || ["completed", "closeout_pending", "revocation_pending"].includes(record.state)) return null;
  const revokedByWebApp = record.revocation_requested === true || Boolean(record.revocation_receipt);
  if (parsed.data.kind === "withdrawn" && revokedByWebApp && !RIGHTS_REVOCATION_CAUSES.has(record.revocation_cause))
    return null;
  return parsed.data as SceneIntentOutcome;
}

/** The outcome as a job page reads it: what picks the sentence, and the digest its one email is keyed by. */
export type SceneOutcomeReading = { kind: SceneIntentOutcomeKind; terminal: boolean; reasonCode: string; digest: string };
export const sceneOutcomeReading = (outcome: SceneIntentOutcome): SceneOutcomeReading =>
  ({ kind: outcome.kind, terminal: outcome.terminal, reasonCode: outcome.reason_code, digest: outcome.outcome_digest });

const NOTHING_NEEDED = "Nothing is needed from you.";
/** The site has its answer whatever happens to the simulation; an ending of the simulation says so. */
export const ANSWER_STAYS = "Your answer stays on your job page.";
/**
 * One sentence and its closing per ending, said the same on the job page and
 * in the email. A hold or a stop is said about the simulation, never about the
 * job: the site's answer does not depend on it. Withdrawal is untouched.
 */
const ENDINGS: Readonly<Record<TerminalSceneOutcomeKind, { sentence: string; closing: string; subject: string }>> = {
  held: { sentence: simulationOutcomeEmailSentence("held_capability"),
    closing: `${ANSWER_STAYS} ${NOTHING_NEEDED}`, subject: "The simulation of your job is held for now" },
  withdrawn: { sentence: "Permission to use this video for your job was withdrawn or has expired.",
    closing: "You don't need to do anything; this job has stopped.", subject: "Your Blueprint job has stopped" },
  setup_repair: { sentence: "We could not finish building the simulation of your site, and we have stopped trying.",
    closing: `${ANSWER_STAYS} ${NOTHING_NEEDED}`, subject: "We stopped building the simulation of your site" },
};
export const isTerminalSceneOutcomeKind = isTerminalKind;
/** The job page's headline for an ending, and the first paragraph of its one email. */
export const sceneOutcomeMessage = (kind: TerminalSceneOutcomeKind) => `${ENDINGS[kind].sentence} ${ENDINGS[kind].closing}`;
export const sceneOutcomeSubject = (kind: TerminalSceneOutcomeKind) => ENDINGS[kind].subject;

/** What the site has to give, by reason; a reason without a plain sentence gets the general one. */
const SITE_NEEDS: Readonly<Record<string, string>> = {
  site_consent_required: "Your job is waiting for you to confirm permission to process your video.",
  task_brief_required: "Your job is waiting for a description of the job you filmed.",
};
const SITE_ANSWER = "Reply to any Blueprint email about this job, or write to hello@tryblueprint.io with your job link.";

/** A wait in one plain sentence. Only a wait on the site asks anything of it, and says how to answer. */
export function sceneWaitMessage(reading: Pick<SceneOutcomeReading, "kind" | "reasonCode">):
  { headline: string; operatorAction: string | null } | null {
  if (reading.kind === "setup_repair") return { operatorAction: null,
    headline: `We are fixing a setup problem on our side before your job's simulation can continue. ${NOTHING_NEEDED}` };
  if (reading.kind === "awaiting_spend_approval") return { operatorAction: null,
    headline: `Your job is waiting on an internal budget approval at Blueprint. ${NOTHING_NEEDED}` };
  if (reading.kind === "awaiting_site") return { operatorAction: SITE_ANSWER,
    headline: Object.hasOwn(SITE_NEEDS, reading.reasonCode) ? SITE_NEEDS[reading.reasonCode] : "Your job is waiting for something from you." };
  return null;
}

export const SCENE_OUTCOME_NOTICE_SCHEMA = "scene_outcome_notification.v1";
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
/** One email per terminal outcome: its key names the kind and the outcome's own digest. */
export const sceneOutcomeNoticeEventId = (kind: TerminalSceneOutcomeKind, outcomeDigest: string) =>
  `${kind}-${outcomeDigest.slice("sha256:".length)}`;
const noticeIntentSchema = z.object({
  schema_version: z.literal(SCENE_OUTCOME_NOTICE_SCHEMA), request_id: identifier, intake_id: identifier,
  kind: z.enum(TERMINAL_SCENE_OUTCOME_KINDS), outcome_digest: digest,
  event_id: z.string().regex(/^(held|withdrawn|setup_repair)-[a-f0-9]{64}$/),
}).strict().refine(value => value.event_id === sceneOutcomeNoticeEventId(value.kind, value.outcome_digest));
export type SceneOutcomeNoticeIntent = z.infer<typeof noticeIntentSchema>;

export function parseSceneOutcomeNoticeIntent(value: unknown): SceneOutcomeNoticeIntent | null {
  const parsed = noticeIntentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * The email a website intake owes its site, or null: only a terminal outcome
 * that speaks for the site. Pure: the worker writes it beside the status that
 * carried the outcome, and the outbox reconciler queues it.
 */
export function sceneOutcomeNoticeIntent(intakeId: string, record: Record<string, any> | null | undefined): SceneOutcomeNoticeIntent | null {
  const outcome = adoptedSceneOutcome(record);
  if (!outcome?.terminal || !isTerminalKind(outcome.kind)) return null;
  return parseSceneOutcomeNoticeIntent({ schema_version: SCENE_OUTCOME_NOTICE_SCHEMA, request_id: record?.website_request_id,
    intake_id: intakeId, kind: outcome.kind, outcome_digest: outcome.outcome_digest,
    event_id: sceneOutcomeNoticeEventId(outcome.kind, outcome.outcome_digest) });
}
