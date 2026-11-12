// @vitest-environment node
/**
 * The messages a site or a robot team actually receives say what the free beta is.
 *
 * The beta remains free. Blueprint runs the candidates in a simulation of the
 * site itself and shows a bounded estimate or "held", then works alongside a
 * deployment company on the real site (owner, 2026-10-28). It does not
 * promise a simulation for every submission, a supplier or a signed pilot.
 * No fees, balances, top-ups, checkout or announced future platform pricing.
 *
 * This is not a grep over source files. Each surface is BUILT here the way the
 * server builds it — the can't-simulate-yet email variants from the real gate
 * strings, the robot-team run emails through their real sender and every
 * lifecycle notice — and the banned patterns run over the output. A stale
 * string that never reaches a customer cannot fail it, and a new one that does
 * cannot hide behind a variable. (The agent contract, its ask answers and the
 * retired-commerce 410 body went with the agent API on 2026-11-12.)
 */
import { describe, expect, it, vi } from "vitest";

// The robot-team sender is exercised for real; only its recipient lookup and
// the durable outbox write are replaced, so the built message is captured.
const outbox = vi.hoisted(() => [] as Array<{ kind: string; subject: string; body: string }>);
vi.mock("../utils/captureOutbox", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/captureOutbox")>()),
  enqueueOutbox: vi.fn(async (input: { kind: string; subject: string; body: string }) => {
    outbox.push(input);
    return { enqueued: true };
  }),
}));
vi.mock("../utils/robotTeamAccounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/robotTeamAccounts")>()),
  teamAccountEmail: vi.fn(async () => "team@example.test"),
}));

const { publicBannedCopyPatterns } = await import("../../scripts/qa/brand-polish");
const { buildTaskNotYetSupportedEmail } = await import("../utils/qualificationEmails");
const { notifyTeamOfRunOutcome } = await import("../utils/robotTeamNotifications");
const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");

type Banned = { label: string; pattern: RegExp };

const fromBrandPolish = (label: string): Banned => {
  const entry = publicBannedCopyPatterns.find((item) => item.label === label);
  if (!entry) throw new Error(`brand-polish no longer defines "${label}"`);
  return { label, pattern: new RegExp(entry.pattern, entry.flags) };
};

/** Anything that prices, charges, holds or sells. Applies to every surface. */
const PRICING: readonly Banned[] = [
  fromBrandPolish("$2,500 fee"),
  fromBrandPolish("$99 entry"),
  { label: "balance", pattern: /\bbalance\b/i },
  { label: "top-up", pattern: /\btop-?ups?\b/i },
  { label: "checkout", pattern: /\bcheckout\b/i },
  { label: "buy runs", pattern: /\bbuy runs?\b/i },
];

/** Blueprint working with a deployment company is part of the job-first journey. */
const PAIRING: readonly Banned[] = [];

/** A site anywhere must not be told about one city's visits. */
const CITY: readonly Banned[] = [{ label: "Austin", pattern: /\bAustin\b/i }];

/** Prose a person reads: emails. */
const CUSTOMER_PROSE = [...PRICING, ...PAIRING];
const SITE_EMAIL = [...CUSTOMER_PROSE, ...CITY];

function hits(text: string, banned: readonly Banned[]): string[] {
  return banned.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

function expectClean(label: string, text: string, banned: readonly Banned[]) {
  expect(hits(text, banned), `${label}:\n${text}`).toEqual([]);
}

/* ------------------------------------------------------------ site emails */

// The four-conditions screening emails ended (owner decision 2026-11-11). The
// one screening-time email left is "we can't simulate this kind of job yet".
describe("site screening emails", () => {
  it("never introduces platform charges or assumes a city in the can't-simulate-yet email, for any reason", () => {
    for (const reason of ["deformable", "liquid", "assembly", "mobile", "closing", "push", "container",
      "articulated", "other", "multi_step", "unclear"] as const) {
      for (const jobUrl of ["https://tryblueprint.io/capture-upload/tok", null]) {
        const email = buildTaskNotYetSupportedEmail({ firstName: "Dana", siteName: "Riverside DC", reason, jobUrl });
        expectClean(`${reason} ${jobUrl ?? "no link"}`, `${email.subject}\n${email.body}`, SITE_EMAIL);
      }
    }
  });
});

/* -------------------------------------------------------- lifecycle notices */

describe("site lifecycle notices", () => {
  const milestones = [
    "task_received", "video_received", "scene_ready", "preparation_needs_attention", "preparation_ended", "listing_live",
    "screening_not_now", "pilot_request", "job_sent", "company_answered",
  ] as const;

  it("never introduces platform charges or assumes a city in any notice", () => {
    for (const milestone of milestones) {
      for (const detail of [undefined, "invited_beta_free", "12 of 50 simulated episodes succeeded"]) {
        const notice = buildTaskLifecycleNotification({
          requestId: "req-1",
          milestone,
          to: "owner@example.test",
          captureUrl: "https://tryblueprint.io/capture-upload/tok",
          eventId: milestone === "preparation_needs_attention" || milestone === "preparation_ended" ? `sha256:${"a".repeat(64)}` : undefined,
          detail,
          ...(milestone === "preparation_ended" ? { terminalReason: "budget_exhausted" } : {}),
          ...(milestone === "company_answered" ? { companyAnswerState: "needs_something" as const } : {}),
        });
        expectClean(`${milestone} (${detail ?? "no detail"})`, `${notice.subject}\n${notice.body}`, SITE_EMAIL);
      }
    }
  });
});

/* ---------------------------------------------------- robot-team run emails */

describe("robot-team run emails", () => {
  it("say nothing about balances, holds or charges for a result and for no result", async () => {
    outbox.length = 0;
    await notifyTeamOfRunOutcome({ teamId: "team-1", runId: "run-1", outcome: { kind: "result", episodesSucceeded: 41, episodesRun: 50 } });
    await notifyTeamOfRunOutcome({ teamId: "team-1", runId: "run-2", outcome: { kind: "no_result" } });

    expect(outbox.map((row) => row.kind)).toEqual(["team_run_result", "team_run_no_result"]);
    for (const row of outbox) {
      expectClean(row.kind, `${row.subject}\n${row.body}`, [...CUSTOMER_PROSE, { label: "hold", pattern: /\bhold\b/i }]);
      // No page lists a team's runs, so the email links to none.
      expect(row.body).not.toMatch(/tryblueprint\.io\/app|settings\?tab=/);
    }
  });
});
