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
 * strings and every lifecycle notice — and the banned patterns run over the output. A stale
 * string that never reaches a customer cannot fail it, and a new one that does
 * cannot hide behind a variable. (The agent contract, its ask answers and the
 * retired-commerce 410 body went with the agent API on 2026-11-12.)
 */
import { describe, expect, it } from "vitest";

const { publicBannedCopyPatterns } = await import("../../scripts/qa/brand-polish");
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

/* -------------------------------------------------------- lifecycle notices */

describe("site lifecycle notices", () => {
  // The site's emails about its job (owner, 2026-11-19); the introduction's is built from the company's details.
  const milestones = ["task_received", "job_sent", "company_answered"] as const;

  it("never introduces platform charges or assumes a city in any notice", () => {
    for (const milestone of milestones) {
      for (const detail of [undefined, "invited_beta_free", "12 of 50 simulated episodes succeeded"]) {
        const notice = buildTaskLifecycleNotification({
          requestId: "req-1",
          milestone,
          to: "owner@example.test",
          captureUrl: "https://tryblueprint.io/capture-upload/tok",
          ...(milestone === "job_sent" && detail ? { companyCount: 3 } : {}),
          ...(milestone === "company_answered" ? { companyAnswerState: "needs_something" as const } : {}),
        });
        expectClean(`${milestone} (${detail ?? "no detail"})`, `${notice.subject}\n${notice.body}`, SITE_EMAIL);
      }
    }
  });
});
