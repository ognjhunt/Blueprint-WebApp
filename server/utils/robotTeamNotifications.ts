/**
 * The robot team hears when a run it paid for reports.
 *
 * The site already gets an email for each result on its task. The team that
 * bought the run got nothing: its result was only visible to whoever still
 * had the plan page open with the agent key in that tab. Each run now sends
 * the team one email when it reports a result, or when it ends without one,
 * through the same durable, deduplicated outbox the site emails use.
 */
import { enqueueOutbox } from "./captureOutbox";
import { EMAIL_SIGN_OFF } from "./emailLayout";
import { teamAccountEmail } from "./robotTeamAccounts";
import { COMPANY } from "../../client/src/data/company";

const RUNS_URL = `${COMPANY.website}/settings?tab=agent`;

export async function notifyTeamOfRunOutcome(params: {
  teamId: string;
  runId: string;
  outcome:
    | { kind: "result"; episodesSucceeded: number; episodesRun: number }
    | { kind: "no_result" };
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
        `Your evaluation run finished: ${result.episodesSucceeded} of ${result.episodesRun} simulated episodes succeeded. This is a simulation result against one site's task, not a physical test.`,
        `See this run, every other run, and your balance:\n${RUNS_URL}`,
        EMAIL_SIGN_OFF,
      ].join("\n\n")
    : [
        "Hi,",
        "Your evaluation run ended before any episode was observed, so there is no result to show. You are not charged for episodes that did not run; the rest of the hold returns to your balance.",
        `See your runs and your balance:\n${RUNS_URL}`,
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
