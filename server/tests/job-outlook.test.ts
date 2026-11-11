// @vitest-environment node
/**
 * The job's outlook (review, 2026-11-11): one decision over everything that can end a job. This walks every ending and
 * every evaluation state, and proves the job window bounds `building` and `testing`: once an ending is recorded, no
 * job still reads as on its way to a test.
 */
import { describe, expect, it } from "vitest";
import { jobOutlook, outlookHasAnswer, OUTLOOK_SENTENCES, type JobOutlookInput } from "../utils/jobOutlook";
import { projectSimulationProof, type SimulationProof } from "../../client/src/lib/simulationProof";
import { winnerEvaluation } from "../../client/tests/fixtures/siteAnswer";
import { screeningReasonLabel } from "../../client/src/lib/screeningPlainLanguage";
import { setupFlagSentence } from "../utils/screeningSetupFlagSentences";

const READY = { state: "ready" as const, unsized: false, reason: null };
const base = (patch: Partial<JobOutlookInput> = {}): JobOutlookInput => ({
  consentRevoked: false, closedByOwner: false, answer: READY, windowEnded: false, noGrantEnded: false, grantRefused: false,
  preparation: null, scene: null, proof: null, ...patch });
const proofOf = (changes: Record<string, unknown>): SimulationProof =>
  projectSimulationProof({ evaluation: [{ ...winnerEvaluation, ...changes }] as never, pick: null });

/** Every evaluation state the WebApp reads, as its proof. */
const EVALUATIONS: Record<string, SimulationProof | null> = {
  none: null,
  result: proofOf({}),
  queued: proofOf({ state: "queued", outcome: null, candidates: [] }),
  running: proofOf({ state: "running", outcome: null }),
  ...Object.fromEntries(["failed", "blocked", "cancelled", "closed", "forward_terminal_blocked", "control_plane_terminal_blocked"]
    .map(state => [`terminal ${state}`, proofOf({ state, outcome: null, candidates: [] })])),
  ...Object.fromEntries(["held_capability", "held_setup", "held_budget", "held_scene_check"]
    .map(outcome => [outcome, proofOf({ state: "completed", outcome, candidates: [] })])),
  setup_repair: proofOf({ state: "completed", outcome: "setup_repair", candidates: [] }),
};

/** Every recorded ending, as the input change it makes. */
const ENDINGS: Record<string, Partial<JobOutlookInput>> = {
  "window expired": { windowEnded: true },
  "no grant": { noGrantEnded: true },
  "grant refused": { grantRefused: true },
  "preparation failed for good": { preparation: { state: "failed_terminal", geometryOnlyEnd: false } },
  "preparation authority ended": { preparation: { state: "authority_ended", geometryOnlyEnd: false } },
  "scene held": { preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "held" } },
  "scene stopped": { preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "ended" } },
  "robot fit only": { preparation: { state: "awaiting_inputs", geometryOnlyEnd: true } },
  "unsized video": { answer: { state: "cannot_assess", unsized: true, reason: "The video did not show the job clearly enough for us to size it." } },
  "built, never tested": { preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "completed" } },
};

describe("the job's outlook", () => {
  it("is reading before the video is read, and building from the first status on", () => {
    expect(jobOutlook(base({ answer: null })).phase).toBe("reading");
    expect(jobOutlook(base({ answer: { state: "reading", unsized: false, reason: null } })).phase).toBe("reading");
    expect(jobOutlook(base())).toEqual({ phase: "building", reason: null, sentence: null });
    for (const state of ["preparing", "capacity_delayed", "awaiting_inputs", "unavailable"])
      expect(jobOutlook(base({ preparation: { state, geometryOnlyEnd: false } })).phase, state).toBe("building");
    expect(jobOutlook(base({ preparation: { state: "failed_retryable", geometryOnlyEnd: false } }))).toEqual({ phase: "building",
      reason: "step_failed", sentence: "A step failed and we're working on it. We'll email you the result." });
    for (const state of ["waiting", "testing"])
      expect(jobOutlook(base({ preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state } })).phase, state).toBe("building");
    // A built scene with a run queued with its plan is testing.
    expect(jobOutlook(base({ preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "completed" },
      proof: EVALUATIONS.queued })).phase).toBe("testing");
  });

  it("is testing once a run is running, and a result once one names an AI robot", () => {
    expect(EVALUATIONS.running!.state).toBe("running");
    expect(jobOutlook(base({ proof: EVALUATIONS.running })).phase).toBe("testing");
    expect(jobOutlook(base({ proof: EVALUATIONS.result }))).toEqual({ phase: "result", reason: null, sentence: null });
    // A result outranks every later ending except the site's own.
    for (const [ending, patch] of Object.entries(ENDINGS))
      expect(jobOutlook(base({ ...patch, proof: EVALUATIONS.result })).phase, ending).toBe("result");
  });

  it("reads a terminal run as an ending, never as preparing", () => {
    for (const state of ["failed", "blocked", "cancelled", "closed", "forward_terminal_blocked", "control_plane_terminal_blocked"]) {
      const proof = EVALUATIONS[`terminal ${state}`]!;
      expect(proof.state, state).toBe("could_not_run");
      expect(jobOutlook(base({ proof })), state).toEqual({ phase: "no_test", reason: "run_ended",
        sentence: "The simulation test stopped before it gave a result." });
    }
  });

  it("gives every ending a true reason sentence and never building or testing, for every evaluation state", () => {
    const seen: string[] = [];
    for (const [ending, patch] of Object.entries(ENDINGS)) {
      for (const [evaluation, proof] of Object.entries(EVALUATIONS)) {
        if (evaluation === "result" || evaluation === "running") continue;
        // "Built, never tested" means no run: a run queued with its plan is testing, and a run's own ending says so.
        if (ending === "built, never tested" && evaluation !== "none") continue;
        const outlook = jobOutlook(base({ ...patch, proof: proof ?? null }));
        const label = `${ending} / ${evaluation}`;
        expect(["no_test"], label).toContain(outlook.phase);
        expect(outlook.sentence, label).toBeTruthy();
        expect(outlookHasAnswer(outlook), label).toBe(true);
        seen.push(outlook.reason!);
      }
    }
    expect(jobOutlook(base(ENDINGS["window expired"])).sentence).toBe("The time for this job ran out before a simulation test could run.");
    expect(jobOutlook(base(ENDINGS["no grant"])).sentence).toBe("We have not built a simulation for this job.");
    expect(jobOutlook(base(ENDINGS["grant refused"])).sentence).toBe("We have not built a simulation for this job.");
    expect(jobOutlook(base(ENDINGS["preparation failed for good"])).sentence).toBe("We could not build a simulation of your site.");
    expect(jobOutlook(base(ENDINGS["scene held"])).sentence).toBe("Our simulation test can't do this kind of job yet.");
    expect(jobOutlook(base(ENDINGS["scene stopped"])).sentence).toBe("We could not finish building the simulation of your site.");
    expect(jobOutlook(base(ENDINGS["robot fit only"])).sentence).toBe(OUTLOOK_SENTENCES.robot_fit_only);
    expect(jobOutlook(base(ENDINGS["unsized video"])).sentence).toBe("Your video didn't show the job clearly enough for us to measure it.");
    expect(jobOutlook(base(ENDINGS["built, never tested"])).sentence).toBe("We built the simulation of your site, but no AI robot was tested in it.");
    expect(new Set(seen).size).toBeGreaterThan(5);
  });

  it("bounds building and testing by the job window: once it ends, no evaluation state reads as on its way", () => {
    const onTheWay = [
      {}, { preparation: { state: "preparing", geometryOnlyEnd: false } }, { preparation: { state: "failed_retryable", geometryOnlyEnd: false } },
      { preparation: { state: "awaiting_inputs", geometryOnlyEnd: false } },
      { preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "waiting" } },
    ] as Array<Partial<JobOutlookInput>>;
    for (const patch of onTheWay) for (const [evaluation, proof] of Object.entries(EVALUATIONS)) {
      if (evaluation === "result") continue;
      const outlook = jobOutlook(base({ ...patch, proof: proof ?? null, windowEnded: true }));
      expect(outlook.phase, `${JSON.stringify(patch)} / ${evaluation}`).toBe("no_test");
    }
  });

  it("gives every ending of the evaluation itself a reason, treats a hold that will not restart as an ending, and the self-retrying one as not", () => {
    // The screening's `setup_repair` re-plans its rows by itself: still testing, not an ending.
    expect(jobOutlook(base({ proof: EVALUATIONS.setup_repair })).phase).toBe("testing");
    for (const outcome of ["held_capability", "held_setup", "held_budget", "held_scene_check"]) {
      const outlook = jobOutlook(base({ proof: EVALUATIONS[outcome] }));
      expect(outlook.phase, outcome).toBe("no_test");
      expect(outlook.sentence, outcome).toBeTruthy();
    }
  });

  it("puts the site's own endings first: never building, never an answer", () => {
    for (const patch of [{ consentRevoked: true }, { closedByOwner: true }]) for (const proof of Object.values(EVALUATIONS)) {
      const outlook = jobOutlook(base({ ...patch, proof: proof ?? null }));
      expect(outlook.phase).toBe("ended_by_site");
      expect(outlookHasAnswer(outlook)).toBe(false);
    }
    expect(jobOutlook(base({ consentRevoked: true })).sentence).toBe("Permission to use your video was withdrawn, so this job has stopped.");
    expect(jobOutlook(base({ closedByOwner: true })).sentence).toBe("You closed this job's simulation run.");
  });

  it("is cannot_match for another kind of job with nothing on the way, and building when a simulation is", () => {
    const other = { state: "cannot_assess" as const, unsized: false, reason: "Your job looks like another kind." };
    expect(jobOutlook(base({ answer: other }))).toEqual({ phase: "cannot_match", reason: "other_kind", sentence: "Your job looks like another kind." });
    expect(jobOutlook(base({ answer: other, preparation: { state: "preparing", geometryOnlyEnd: false } })).phase).toBe("building");
    expect(jobOutlook(base({ answer: other, proof: EVALUATIONS.running })).phase).toBe("testing");
  });

  it("has an answer only in result, no_test and cannot_match", () => {
    for (const phase of ["reading", "building", "testing", "ended_by_site"] as const)
      expect(outlookHasAnswer({ phase, reason: null, sentence: null }), phase).toBe(false);
    for (const phase of ["result", "no_test", "cannot_match"] as const)
      expect(outlookHasAnswer({ phase, reason: null, sentence: null }), phase).toBe(true);
  });
});

describe("the review's small items", () => {
  it("says what a lost policy server means, and labels a try it did not count", () => {
    expect(setupFlagSentence("session_policy_server_lost")).toBe("This AI robot's software stopped during the test, so only some tries were counted.");
    expect(screeningReasonLabel("policy_server_unavailable").toLowerCase()).toBe("not counted: the ai robot's software was not running.");
  });
});
