// @vitest-environment node
/**
 * The messages a site or a robot team actually receives say what the free beta is.
 *
 * The beta remains free. The 2026-10-21 owner-authorized job-first journey
 * assesses suitable options, uses evidence/testing when needed and helps the
 * customer compare delivery proposals before selecting a partner. It does not
 * promise a simulation for every submission, a supplier or a signed pilot.
 * No fees, balances, top-ups, checkout or announced future platform pricing.
 *
 * This is not a grep over source files. Each surface is BUILT here the way the
 * server builds it — every qualification email variant from the real gate
 * strings, the robot-team run emails through their real sender, every
 * lifecycle notice, the grounded ask answers, the retired-commerce 410 body,
 * the generated OpenAPI file and the live manifest — and the banned patterns
 * run over the output. A stale string that never reaches a customer cannot
 * fail it, and a new one that does cannot hide behind a variable.
 *
 * Exemptions are explicit, narrow and stated where they apply:
 * - The OpenAPI contract and manifest are held to the pricing patterns only.
 *   "match"/"matched" there is the search API's retrieval vocabulary
 *   (`matchSemantics`, `matchedAliases`), and API identifiers keep their
 *   names; "Austin" documents the legacy meaning of a registration enum.
 * - An operation marked `deprecated` must be a pure 410, and is then not
 *   scanned: it is the retired purchase path, named only to retire it.
 * - Component schemas reachable only from retired or historical-read
 *   operations describe historical records and are not scanned. Any schema a
 *   current operation can reach is.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// No embedding provider or network: retrieval stays deterministic.
vi.mock("../retrieval/embeddings", () => ({ embedTexts: vi.fn(async () => []) }));

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
const { gateFields } = await import("../../client/src/data/siteTaskQualification");
const { triageGateAnswers } = await import("../../client/src/lib/gateTriage");
const {
  buildLetsTalkEmail,
  buildNotYetEmail,
  buildQualificationEmail,
  buildQualifiedEmail,
} = await import("../utils/qualificationEmails");
const { notifyTeamOfRunOutcome } = await import("../utils/robotTeamNotifications");
const { buildTaskLifecycleNotification } = await import("../utils/taskLifecycleNotifications");
const { answerAgentQuestion, listAgentKnowledgeEntries } = await import("../retrieval/agentAsk");
const { RETIRED_STANDALONE_COMMERCE_RESPONSE } = await import("../routes/agent-access");
const { buildRobotAgentAccessManifest } = await import("../utils/robot-agent-contract");

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

/** Matching and physical-provider proposals are part of the job-first journey. */
const PAIRING: readonly Banned[] = [];

/** A site anywhere must not be told about one city's visits. */
const CITY: readonly Banned[] = [{ label: "Austin", pattern: /\bAustin\b/i }];

/** Prose a person reads: emails, ask answers, the 410 body. */
const CUSTOMER_PROSE = [...PRICING, ...PAIRING];
const SITE_EMAIL = [...CUSTOMER_PROSE, ...CITY];

function hits(text: string, banned: readonly Banned[]): string[] {
  return banned.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

function expectClean(label: string, text: string, banned: readonly Banned[]) {
  expect(hits(text, banned), `${label}:\n${text}`).toEqual([]);
}

/* ------------------------------------------------------------ site emails */

/** The stored triage shape, built exactly as intake builds it. */
function summary(answers: Record<string, string>, captureMode: "self_capture" | "site_visit") {
  const verdict = triageGateAnswers(answers, gateFields, captureMode);
  return {
    disposition: verdict.disposition,
    blocking_field_ids: verdict.blockers.map((blocker) => blocker.fieldId),
    blockers: verdict.blockers.map((blocker) => `${blocker.answer} — ${blocker.detail}`),
    open_questions: verdict.openQuestions.map((q) => `${q.question} ${q.answer} — ${q.detail}`),
    open_question_field_ids: verdict.openQuestions.map((q) => q.fieldId),
    unanswered_field_ids: [...verdict.unanswered],
    incomplete: verdict.incomplete,
    evaluated_at: "2026-10-14T00:00:00.000Z",
  };
}

const clearAnswers = Object.fromEntries(
  gateFields.map((field) => [field.id, field.options.find((option) => option.verdict === "clear")!.value]),
);

/** One submission per non-clear option, so every blocker and open-question string is rendered. */
function everyScreenedSubmission() {
  const out: Array<{ label: string; triage: ReturnType<typeof summary> }> = [];
  for (const mode of ["self_capture", "site_visit"] as const) {
    out.push({ label: `${mode} clear`, triage: summary(clearAnswers, mode) });
    for (const field of gateFields) {
      for (const option of field.options.filter((item) => item.verdict !== "clear")) {
        out.push({
          label: `${mode} ${field.id}=${option.value}`,
          triage: summary({ ...clearAnswers, [field.id]: option.value }, mode),
        });
      }
    }
    out.push({ label: `${mode} blank`, triage: summary({}, mode) });
  }
  return out;
}

const NEXT_STEPS = [
  { kind: "self_capture", uploadUrl: "https://tryblueprint.io/capture-upload/tok" },
  { kind: "capturer_visit", taskUrl: "https://tryblueprint.io/capture-upload/tok" },
  { kind: "capturer_visit" },
  { kind: "held" },
  undefined,
] as const;

describe("site screening emails", () => {
  it("covers every disposition from the real gate strings", () => {
    const dispositions = new Set(everyScreenedSubmission().map(({ triage }) => triage.disposition));
    expect([...dispositions].sort()).toEqual(["needs_conversation", "not_now", "qualified"]);
  });

  it("never introduces platform charges or assumes a city, in any variant", () => {
    for (const { label, triage } of everyScreenedSubmission()) {
      for (const stage of ["brief_confirmed", "screened"] as const) {
        for (const nextStep of NEXT_STEPS) {
          for (const accountNeeded of [true, false]) {
            const email = buildQualificationEmail({
              firstName: "Dana", siteName: "Riverside DC", triage, stage, nextStep, accountNeeded,
            });
            expect(email, label).not.toBeNull();
            expectClean(`${label} ${stage} ${nextStep?.kind ?? "none"}`, `${email!.subject}\n${email!.body}`, SITE_EMAIL);
          }
        }
      }
      // The direct builders, as the brief-confirm route used to call them.
      if (triage.disposition === "not_now") {
        const email = buildNotYetEmail({ firstName: "Dana", triage });
        expectClean(label, `${email.subject}\n${email.body}`, SITE_EMAIL);
      }
      if (triage.disposition === "needs_conversation") {
        const email = buildLetsTalkEmail({ firstName: "Dana", triage });
        expectClean(label, `${email.subject}\n${email.body}`, SITE_EMAIL);
      }
    }
  });

  it("states the video-backed simulation, Blueprint's own candidate runs, customer selection and the free-beta boundary", () => {
    for (const nextStep of NEXT_STEPS) {
      const { body } = buildQualifiedEmail({ firstName: "Dana", nextStep });
      expect(body).toMatch(/review the job brief, required output and site constraints/);
      expect(body).toMatch(/reconstruct the work area in simulation and run candidate robots, policies and policy APIs against your job ourselves/);
      expect(body).toMatch(/a recommendation comes only from the finalists' full scoring/);
      expect(body).toMatch(/review their proposals covering scope, total cost, timing and support/);
      expect(body).toMatch(/You choose the delivery partner/);
      expect(body).toMatch(/If no candidate is suitable, we explain what is missing/);
      expect(body).not.toMatch(/book the pilot in one step|We prepare a simplified simulation/);
      expect(body).toMatch(/free during the beta/);
      expect(body).toMatch(/not proof of how a robot will perform/);
    }
  });
});

/* -------------------------------------------------------- lifecycle notices */

describe("site lifecycle notices", () => {
  const milestones = [
    "task_received", "video_received", "scene_ready", "preparation_needs_attention", "preparation_ended", "listing_live",
    "screening_cleared", "screening_not_now", "screening_started", "results_ready", "run_no_result",
    "pilot_request", "pilot_recommended", "pilot_booked", "pilot_scheduled",
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
      // The link must reach a page that lists the team's evaluations.
      expect(row.body).toContain("https://tryblueprint.io/app");
      expect(row.body).not.toContain("settings?tab=");
    }
  });
});

/* ------------------------------------------------------- public agent copy */

describe("public agent answers and the retired-commerce body", () => {
  it("keeps every grounded answer free of platform charges and assumed city coverage", () => {
    for (const entry of listAgentKnowledgeEntries()) {
      const prose = [entry.title, entry.answer, ...entry.actions.map((action) => action.description)].join("\n");
      expectClean(entry.id, prose, [...CUSTOMER_PROSE, ...CITY]);
    }
  });

  it("answers pricing and how-to-start questions with the free beta", async () => {
    for (const question of [
      "How much does it cost?",
      "What are your fees?",
      "How do I pay with Stripe?",
      "I have a wallet and a budget - how do I buy access?",
      "How does a robot team start an evaluation?",
      "How do I get started?",
      "What does Blueprint do?",
    ]) {
      const response = await answerAgentQuestion({ question });
      expect(response.bestAnswer, question).not.toBeNull();
      for (const answer of response.answers) expectClean(`${question} -> ${answer.id}`, answer.answer, CUSTOMER_PROSE);
      expectClean(`${question} fallback`, `${response.fallback.message}\n${response.truthBoundary}`, CUSTOMER_PROSE);
    }
    expect((await answerAgentQuestion({ question: "How much does it cost?" })).bestAnswer?.answer).toMatch(/^Free during the beta\./);
  });

  it("returns a 410 body that does not quote or scope paid work", () => {
    expectClean("retired commerce 410", JSON.stringify(RETIRED_STANDALONE_COMMERCE_RESPONSE), CUSTOMER_PROSE);
  });
});

/* -------------------------------------------------- generated contract files */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function stringsIn(value: Json, at: string, out: Array<[string, string]>) {
  if (typeof value === "string") out.push([at, value]);
  else if (Array.isArray(value)) value.forEach((item, index) => stringsIn(item, `${at}[${index}]`, out));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) stringsIn(item, `${at}.${key}`, out);
  }
  return out;
}

function refsIn(value: Json, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((item) => refsIn(item, out));
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "$ref" && typeof item === "string") out.add(item.replace("#/components/schemas/", ""));
      else refsIn(item, out);
    }
  }
  return out;
}

describe("the published robot-team contract", () => {
  const openapi = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "client/public/agent-access.openapi.json"), "utf8"),
  ) as { info: Json; tags: Json; paths: Record<string, Record<string, Record<string, Json>>>; components: { schemas: Record<string, Json> } };

  it("advertises retired purchase operations only as deprecated 410s", () => {
    for (const [route, operations] of Object.entries(openapi.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        if (operation.deprecated !== true) continue;
        expect(Object.keys(operation.responses as Record<string, Json>), `${method} ${route}`).toEqual(["410"]);
      }
    }
    expect(openapi.paths["/api/agent-team/plan"]).toBeUndefined();
    expect(openapi.paths["/api/agent-team/runs"]).toBeUndefined();
    expect(openapi.paths["/api/agent-team/funding"]).toBeUndefined();
  });

  it("describes every current operation and its schemas without pricing", () => {
    const scanned: Array<[string, string]> = [];
    stringsIn(openapi.info, "info", scanned);
    stringsIn(openapi.tags, "tags", scanned);

    // Schemas a current operation can reach are part of what it promises.
    const live = new Set<string>();
    const queue: string[] = [];
    for (const [route, operations] of Object.entries(openapi.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        if (operation.deprecated === true) continue;
        stringsIn(operation as Json, `${method.toUpperCase()} ${route}`, scanned);
        const historicalRead = Array.isArray(operation.tags) && operation.tags.includes("Legacy commerce");
        if (!historicalRead) queue.push(...refsIn(operation as Json));
      }
    }
    while (queue.length) {
      const name = queue.pop()!;
      if (live.has(name) || !openapi.components.schemas[name]) continue;
      live.add(name);
      queue.push(...refsIn(openapi.components.schemas[name]));
    }
    for (const name of live) stringsIn(openapi.components.schemas[name], `schemas.${name}`, scanned);

    expect(live.has("AgentAccessManifest")).toBe(true);
    for (const [at, text] of scanned) expectClean(at, text, PRICING);
  });

  it("serves a manifest with no pricing, funding or paid-run examples", () => {
    const manifest = buildRobotAgentAccessManifest() as unknown as Json;
    for (const [at, text] of stringsIn(manifest, "manifest", [])) {
      expectClean(at, text, [
        ...PRICING,
        { label: "funding", pattern: /\bfund(?:ing)?\b/i },
        { label: "budget flag", pattern: /--budget\b/ },
        { label: "brand example", pattern: /Whole Foods/i },
      ]);
    }
  });
});
