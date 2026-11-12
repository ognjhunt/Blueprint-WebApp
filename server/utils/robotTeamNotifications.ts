/**
 * The robot team hears when its evaluation run reports.
 *
 * The site already gets an email for each result on its job. The team that
 * ran the evaluation got nothing: its result was only visible to whoever still
 * had the plan page open with the agent key in that tab. Each run now sends
 * the team one email when it reports a result, or when it ends without one,
 * through the same durable, deduplicated outbox the site emails use.
 *
 * No page lists a team's runs any more (robot teams running their own
 * software is "later" in the frame of 2026-11-12), so the email carries the
 * result itself and a reply reaches Blueprint. The copy never speaks of a
 * balance or a hold: the free beta has neither.
 */
import { enqueueOutbox } from "./captureOutbox";
import { EMAIL_SIGN_OFF } from "./emailLayout";
import { teamAccountEmail } from "./robotTeamAccounts";
import { COMPANY } from "../../client/src/data/company";
import { noResultObservationText, type NoResultObservation } from "./runNoResultObservation";

export async function notifyTeamOfRunOutcome(params: {
  teamId: string;
  runId: string;
  outcome:
    | { kind: "result"; episodesSucceeded: number; episodesRun: number }
    | { kind: "no_result"; progress?: NoResultObservation };
}): Promise<{ enqueued: boolean; reason?: string }> {
  const to = await teamAccountEmail(params.teamId);
  if (!to) return { enqueued: false, reason: "contact_missing" };
  const runId = params.runId.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  const result = params.outcome.kind === "result" ? params.outcome : null;
  const subject = result
    ? "Your Blueprint evaluation run has a result"
    : "Your Blueprint evaluation run ended without a result";
  const body = result
    ? [
        "Hi,",
        `Your evaluation run finished: ${result.episodesSucceeded} of ${result.episodesRun} simulated episodes succeeded. This is a simulation result on one site's job. It is an estimate, not a physical test, and not proof of performance or safety on site.`,
        "Reply to this email if you want the details of the run.",
        EMAIL_SIGN_OFF,
      ].join("\n\n")
    : [
        "Hi,",
        `Your evaluation run ended without a complete scored result. ${noResultObservationText(params.outcome.kind === "no_result" ? params.outcome.progress : undefined)} Nothing is charged for it. Reply to this email if you need help understanding what happened.`,
        EMAIL_SIGN_OFF,
      ].join("\n\n");
  return enqueueOutbox({
    idempotencyKey: `team:${params.teamId}:${result ? "result" : "no_result"}:${runId}`,
    requestId: `team:${params.teamId}`,
    kind: result ? "team_run_result" : "team_run_no_result",
    to,
    subject,
    body,
    replyTo: COMPANY.emails.hello,
  });
}
