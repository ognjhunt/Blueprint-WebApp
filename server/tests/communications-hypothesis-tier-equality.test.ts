// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));
// The TypeScript copy of the tier rule, wrapped so a test can make it disagree with the tier Pipeline
// published. Unchanged unless a test says otherwise.
vi.mock("../agents/lead-verification", async importOriginal => {
  const actual = await importOriginal<typeof import("../agents/lead-verification")>();
  return { ...actual, evaluateOutreachTier: vi.fn(actual.evaluateOutreachTier) };
});
import { evaluateOutreachTier } from "../agents/lead-verification";
import { admitPublishedHypothesis, HYPOTHESIS_DRAFTS_FLAG } from "../agents/communications-intake";
import { hypothesisSetup as setup, prospects } from "./fixtures/hypothesis";

// Invented operators, *.example hosts and synthetic evidence only. No network, model or mailbox.
const { evaluateOutreachTier: copy } = await vi.importActual<typeof import("../agents/lead-verification")>("../agents/lead-verification");
afterEach(() => { vi.unstubAllEnvs(); vi.mocked(evaluateOutreachTier).mockImplementation(copy); });

describe("hypothesis admission needs the recomputed tier to equal the published one, in both directions (synthetic)", () => {
  it.each<[string, (result: any) => void]>([
    // Pipeline published outreach_ready; the TypeScript copy computes a different tier.
    ["the copy computes tier none", result => { result.tier = "none"; result.eligible_for_outreach_ready = false;
      result.outreach_ready = { ...result.outreach_ready, open_checks: [], open_questions: [], blockers: ["synthetic_disagreement"] }; }],
    ["the copy computes tier verified", result => { result.tier = "verified"; result.eligible_for_outreach_ready = false; }],
    // The copy computes outreach_ready, but not the result Pipeline published.
    ["the copy computes outreach_ready without its eligibility", result => { result.eligible_for_outreach_ready = false; }],
    ["the copy computes outreach_ready from fewer proving sources", result => {
      result.outreach_ready.proving_sources = result.outreach_ready.proving_sources.slice(1); }],
    ["the copy computes outreach_ready with other open checks", result => {
      result.outreach_ready.open_checks = result.outreach_ready.open_checks.filter((check: string) => check !== "manual_workflow"); }],
    ["the copy computes outreach_ready with another question", result => {
      result.outreach_ready.open_questions = ["What has kept the remaining sorting returned parcels work at Synthetic sorting site from being automated so far?"]; }],
  ])("refuses when %s, with or without a contact, and only that refusal stops it", async (_name, disagree) => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup();
    const resolution = await f.resolution();
    vi.mocked(evaluateOutreachTier).mockImplementation((...args) => {
      const value = copy(...args);
      disagree(value.results.find((result: any) => result.candidate_key === f.hypothesis.candidate_key));
      return value;
    });
    for (const claim of [undefined, resolution]) {
      expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps, claim)).toMatchObject({ state: "needs_research",
        reasons: ["outreach_ready_tier_mismatch"], draftJobCreated: false, sendsAuthorized: false });
    }
    for (const name of ["briefs", "jobs", "contactProofs"]) expect(f.records(name)).toHaveLength(0);
    expect(prospects(f)).toHaveLength(0);
    // With the copy agreeing again, the same claim admits it.
    vi.mocked(evaluateOutreachTier).mockImplementation(copy);
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps, resolution)).toMatchObject({ state: "admitted" });
  });

  it("never admits a candidate Pipeline did not publish as outreach-ready, whatever the copy computes", async () => {
    vi.stubEnv(HYPOTHESIS_DRAFTS_FLAG, "true");
    const f = setup({ outreachReady: "shadow" });
    vi.mocked(evaluateOutreachTier).mockClear();
    expect(await admitPublishedHypothesis(f.snapshot, f.hypothesis.candidate_key, f.deps)).toMatchObject({ state: "needs_research",
      reasons: ["research_hypothesis_not_published"], draftJobCreated: false });
    expect(evaluateOutreachTier).not.toHaveBeenCalled();
    for (const name of ["briefs", "jobs"]) expect(f.records(name)).toHaveLength(0);
  });
});
