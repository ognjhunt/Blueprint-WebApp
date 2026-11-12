// @vitest-environment node
// Owner decision 2026-11-11: a limit reached is ours to look at, never the site's job being too expensive.
// Every site-facing sentence for the money outcomes (page and email) is walked here.
import { describe, expect, it } from "vitest";
import { SCREENING_OUTCOMES, screeningOutcomeSentence, screeningOutcomeSentenceWithWindow,
  simulationOutcomeEmailSentence } from "../utils/betaPolicyScreeningContract";
import { COULD_NOT_RUN, PLAIN_COULD_NOT_RUN, PLAIN_WAITING, WAITING } from "../../client/src/lib/simulationProof";
import { screeningReasonLabel } from "../../client/src/lib/screeningPlainLanguage";
import { preparationEndedSentence } from "../utils/taskStatusProjection";

const FORBIDDEN = /budget|allowance|free beta/i;
const MONEY_OUTCOMES = ["held_budget", "awaiting_spend_approval"] as const;

describe("money sentences the site sees", () => {
  it("never mention a budget, an allowance or the free beta's limits, on the page or in the email", () => {
    const sentences: Array<[string, string]> = [];
    for (const outcome of SCREENING_OUTCOMES) {
      sentences.push([`page ${outcome}`, screeningOutcomeSentence(outcome)],
        [`page with window ${outcome}`, screeningOutcomeSentenceWithWindow(outcome, 1_795_000_000)],
        [`email ${outcome}`, simulationOutcomeEmailSentence(outcome)]);
    }
    for (const table of [WAITING, COULD_NOT_RUN, PLAIN_COULD_NOT_RUN, PLAIN_WAITING])
      for (const outcome of MONEY_OUTCOMES) if (table[outcome]) sentences.push([`client ${outcome}`, table[outcome]!]);
    for (const code of ["website_job_ceiling_insufficient", "site_screening_budget_insufficient", "beta_screening_site_budget_exhausted"])
      sentences.push([`row ${code}`, screeningReasonLabel(code)]);
    sentences.push(["preparation ended budget_exhausted", preparationEndedSentence("budget_exhausted")]);
    expect(sentences.filter(([, sentence]) => FORBIDDEN.test(sentence))).toEqual([]);
    // Every money outcome has a sentence in each place it is shown.
    for (const outcome of MONEY_OUTCOMES) expect(screeningOutcomeSentence(outcome)).not.toBe("");
    expect(preparationEndedSentence("budget_exhausted")).toBe("Preparation stopped at a limit on our side.");
  });
});
