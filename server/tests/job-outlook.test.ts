// @vitest-environment node
/**
 * The job's outlook, written from the rule (review, 2026-11-11), not from the decision's own table:
 * - every recorded ending gives its phase and reason;
 * - anything else (states never seen, nulls in every field, reads that failed) is `building` or `testing`, never an
 *   answer: no paper check, no button, no email.
 */
import { describe, expect, it } from "vitest";
import { jobOutlook, outlookHasAnswer, type JobOutlookInput } from "../utils/jobOutlook";
import { OUTLOOK_HOLDS } from "../../client/src/lib/jobOutlook";
import { projectSimulationProof, type SimulationProof } from "../../client/src/lib/simulationProof";
import { winnerEvaluation } from "../../client/tests/fixtures/siteAnswer";
import { screeningReasonLabel } from "../../client/src/lib/screeningPlainLanguage";
import { setupFlagSentence } from "../utils/screeningSetupFlagSentences";

const READY = { state: "ready" as const, unsized: false, reason: null };
const OTHER = { state: "cannot_assess" as const, unsized: false, reason: "Your job looks like another kind." };
const UNSIZED = { state: "cannot_assess" as const, unsized: true, reason: "The video did not show the job clearly enough for us to size it." };
const base = (patch: Partial<JobOutlookInput> = {}): JobOutlookInput => ({
  consentRevoked: false, closedByOwner: false, answer: READY, windowEnded: false, noGrantEnded: false,
  preparation: null, scene: null, proof: null, ...patch });
const proofOf = (changes: Record<string, unknown>): SimulationProof =>
  projectSimulationProof({ evaluation: [{ ...winnerEvaluation, ...changes }] as never, pick: null });
const WORKING = new Set(["building", "testing"]);

/** The recorded endings, the complete list, each with the phase and reason it must give. */
const ENDINGS: Array<[string, Partial<JobOutlookInput>, string, string]> = [
  ["recording permission withdrawn", { consentRevoked: true }, "ended_by_site", "permission_withdrawn"],
  ["run closed by the owner", { closedByOwner: true }, "ended_by_site", "closed_by_owner"],
  ["job window ended", { windowEnded: true }, "no_test", "window_expired"],
  ["no grant by the end of the wait", { noGrantEnded: true }, "no_test", "no_grant"],
  ["preparation failed_terminal", { preparation: { state: "failed_terminal", geometryOnlyEnd: false } }, "no_test", "preparation_failed"],
  ["preparation authority_ended, the window passed", { preparation: { state: "authority_ended", geometryOnlyEnd: false }, windowPassed: true }, "no_test", "authority_ended"],
  ["preparation authority_ended, no reason known", { preparation: { state: "authority_ended", geometryOnlyEnd: false } }, "no_test", "job_ended"],
  ["a run the window's end stopped", { windowPassed: true, proof: proofOf({ state: "blocked", outcome: null, screening: { candidates: [] } }) }, "no_test", "window_ended_during_test"],
  ["kept on file by the no-grant sweep", { answer: OTHER, keptOnFile: true }, "cannot_match", "kept_on_file"],
  ["scene outcome final: held", { preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "held" } }, "no_test", "scene_held"],
  ["scene outcome final: ended", { preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "ended" } }, "no_test", "scene_stopped"],
  ...["failed", "blocked", "cancelled", "closed", "forward_terminal_blocked", "control_plane_terminal_blocked"].map(state =>
    [`evaluation terminal: ${state}`, { proof: proofOf({ state, outcome: null, screening: { candidates: [] } }) }, "no_test", "run_ended"] as [string, Partial<JobOutlookInput>, string, string]),
  ...["held_capability", "held_setup", "held_budget", "held_scene_check"].map(outcome =>
    [`evaluation held: ${outcome}`, { proof: proofOf({ state: "completed", outcome, screening: { candidates: [] } }) }, "no_test", "run_held"] as [string, Partial<JobOutlookInput>, string, string]),
  ["evaluation finished, no AI robot scored", { proof: proofOf({ state: "completed", outcome: "estimate", screening: { candidates: [] } }) }, "no_test", "no_ai_robot_scored"],
  ["the reader's final cannot size", { answer: UNSIZED }, "no_test", "unsized"],
  ["robot-fit-only end recorded by the Pipeline", { preparation: { state: "awaiting_inputs", geometryOnlyEnd: true } }, "no_test", "robot_fit_only"],
  ["another kind of job, no grant by the end of the wait", { answer: OTHER, noGrantEnded: true }, "cannot_match", "other_kind"],
];

/** A deterministic spread of states that are not recorded endings: real ones, made-up names, and nulls everywhere. */
function* notEndings(): Generator<[string, JobOutlookInput]> {
  const preparations = [null, ...["preparing", "capacity_delayed", "awaiting_inputs", "failed_retryable", "unavailable", "handed_off",
    "never_seen_state", "", "FAILED_TERMINAL"].map(state => ({ state, geometryOnlyEnd: false }))];
  const scenes = [null, ...["waiting", "in_progress", "testing", "evaluated", "completed", "made_up_scene", ""].map(state => ({ state }))];
  const proofs: Array<SimulationProof | null> = [null,
    proofOf({ state: "queued", outcome: null, screening: { candidates: [] } }),
    proofOf({ state: "running", outcome: null }),
    proofOf({ state: "completed", outcome: "setup_repair", screening: { candidates: [] } }),
    proofOf({ state: "brand_new_state", outcome: null, screening: { candidates: [] } }),
    projectSimulationProof({ evaluation: [] as never, pick: null })];
  const answers: Array<JobOutlookInput["answer"]> = [READY, OTHER, { state: "ready", unsized: false, reason: null }];
  let n = 0;
  for (const preparation of preparations) for (const scene of scenes) for (const proof of proofs) {
    const answer = answers[n++ % answers.length];
    yield [`${preparation?.state ?? "null"} / ${scene?.state ?? "null"} / ${proof?.state ?? "null"} / ${answer?.state}`,
      base({ preparation, scene, proof, answer })];
  }
}

describe("the job's outlook, from the rule", () => {
  it("gives every recorded ending its phase and a true reason sentence", () => {
    for (const [label, patch, phase, reason] of ENDINGS) {
      const outlook = jobOutlook(base(patch));
      expect({ phase: outlook.phase, reason: outlook.reason }, label).toEqual({ phase, reason });
      expect(outlook.sentence, label).toBeTruthy();
      expect(outlookHasAnswer(outlook), label).toBe(phase !== "ended_by_site");
    }
    expect(jobOutlook(base({ windowEnded: true })).sentence).toBe("The time for this job ran out before a simulation test could run.");
    expect(jobOutlook(base({ noGrantEnded: true })).sentence).toBe("We have not built a simulation for this job.");
    expect(jobOutlook(base({ scene: { state: "held" } })).sentence).toBe("The simulation test of your job is on hold.");
    expect(jobOutlook(base({ answer: OTHER, noGrantEnded: true })).sentence).toBe(OTHER.reason);
    expect(jobOutlook(base({ preparation: { state: "authority_ended", geometryOnlyEnd: false }, windowPassed: true })).sentence)
      .toBe(jobOutlook(base({ windowEnded: true })).sentence);
    expect(jobOutlook(base({ answer: OTHER, keptOnFile: true })).sentence).toBe("We can't test this kind of job yet. We've kept your job on file.");
    // A published result outranks both.
    expect(jobOutlook(base({ keptOnFile: true, proof: proofOf({}) })).phase).toBe("result");
    expect(jobOutlook(base({ preparation: { state: "authority_ended", geometryOnlyEnd: false }, proof: proofOf({}) })).phase).toBe("result");
  });

  it("is a result only for a finished test that scored an AI robot", () => {
    expect(jobOutlook(base({ proof: proofOf({}) })).phase).toBe("result");
    expect(jobOutlook(base({ proof: proofOf({ state: "completed", outcome: "estimate", screening: { candidates: [] } }) })).phase).toBe("no_test");
  });

  it("is working, never an answer, for every state that is not a recorded ending, including unknown names and nulls", () => {
    let count = 0;
    for (const [label, input] of notEndings()) {
      count += 1;
      const outlook = jobOutlook(input);
      expect(WORKING.has(outlook.phase), label).toBe(true);
      expect(outlookHasAnswer(outlook), label).toBe(false);
    }
    expect(count).toBeGreaterThan(400);
  });

  it("keeps a built scene with no run yet building, until a recorded ending", () => {
    const built = { preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: "completed" } };
    expect(jobOutlook(base(built)).phase).toBe("building");
    expect(jobOutlook(base({ ...built, windowEnded: true })).phase).toBe("no_test");
  });

  it("keeps another kind of job working while a simulation may still be built, scene in progress included", () => {
    for (const scene of ["in_progress", "evaluated", "waiting", "made_up"]) {
      const outlook = jobOutlook(base({ answer: OTHER, preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state: scene } }));
      expect(WORKING.has(outlook.phase), scene).toBe(true);
    }
    expect(jobOutlook(base({ answer: OTHER })).phase).toBe("building");
  });

  // Rewritten (review, 2026-11-11): a failed read never hides a recorded fact. Every recorded fact is tried with every
  // in-progress state and with every read failing, and the fact always wins.
  it("lets every recorded fact win over every in-progress state and every failed read", () => {
    const inProgress: Array<[string, Partial<JobOutlookInput>]> = [["nothing", {}],
      ...["preparing", "capacity_delayed", "awaiting_inputs", "failed_retryable", "unavailable", "handed_off", "never_seen"]
        .map(state => [`preparation ${state}`, { preparation: { state, geometryOnlyEnd: false } }] as [string, Partial<JobOutlookInput>]),
      ...["waiting", "in_progress", "completed", "made_up"].map(state => [`scene ${state}`,
        { preparation: { state: "handed_off", geometryOnlyEnd: false }, scene: { state } }] as [string, Partial<JobOutlookInput>]),
      ["a run queued with nothing entered", { proof: proofOf({ state: "queued", outcome: null, screening: { candidates: [] } }) }],
      ["a test waiting on approval", { scene: { state: "testing", waiting: true } }]];
    const failures: Array<[string, Partial<JobOutlookInput>]> = [["no read failed", {}], ["a read failed", { uncertain: true }],
      ["the preparation could not be read", { uncertain: true, preparation: null }], ["the results could not be read", { uncertain: true, proof: null }]];
    let combos = 0;
    for (const [ending, patch, phase, reason] of ENDINGS) for (const [state, progress] of inProgress) for (const [failure, failed] of failures) {
      const input = base({ ...progress, ...failed, ...patch });
      // A failure that blanks the field the ending lives in removes that fact; every other combination keeps it.
      if (("preparation" in failed && "preparation" in patch) || ("proof" in failed && "proof" in patch)) continue;
      const outlook = jobOutlook(input);
      expect({ phase: outlook.phase, reason: outlook.reason }, `${ending} / ${state} / ${failure}`).toEqual({ phase, reason });
      combos += 1;
    }
    for (const [state, progress] of inProgress) for (const [failure, failed] of failures)
      expect(jobOutlook(base({ ...progress, ...failed, proof: proofOf({}) })).phase, `result / ${state} / ${failure}`).toBe("result");
    expect(combos).toBeGreaterThan(600);
  });

  it("keeps a live test testing while the window ends, then says the time ran out during it", () => {
    const running = proofOf({ state: "running", outcome: null });
    for (const live of [{ proof: running }, { scene: { state: "testing" } }] as Array<Partial<JobOutlookInput>>) {
      expect(jobOutlook(base({ ...live, windowEnded: true, windowPassed: true })).phase).toBe("testing");
      expect(outlookHasAnswer(jobOutlook(base({ ...live, windowEnded: true })))).toBe(false);
    }
    const stopped = jobOutlook(base({ windowEnded: true, windowPassed: true, proof: proofOf({ state: "blocked", outcome: null, screening: { candidates: [] } }) }));
    expect(stopped).toEqual({ phase: "no_test", reason: "window_ended_during_test", sentence: "The time for this job ran out during the simulation test." });
    expect(jobOutlook(base({ windowEnded: true, windowPassed: true, proof: proofOf({}) })).phase).toBe("result");
  });

  it("never says the time ran out for an ended authority it has no reason for, and a revoked source is the site's own", () => {
    const ended = { preparation: { state: "authority_ended", geometryOnlyEnd: false } };
    expect(jobOutlook(base(ended)).sentence).toBe("This job has ended.");
    expect(jobOutlook(base({ ...ended, consentRevoked: true }))).toMatchObject({ phase: "ended_by_site", reason: "permission_withdrawn" });
  });

  it("is reading while the video is read or its answer is missing", () => {
    expect(jobOutlook(base({ answer: null })).phase).toBe("reading");
    expect(jobOutlook(base({ answer: { state: "reading", unsized: false, reason: null }, windowEnded: true })).phase).toBe("reading");
  });

  it("calls a hold a hold: only after one may a test result still come", () => {
    expect([...OUTLOOK_HOLDS].sort()).toEqual(["run_held", "scene_held"]);
  });

  it("says a failed step while building", () => {
    expect(jobOutlook(base({ preparation: { state: "failed_retryable", geometryOnlyEnd: false } }))).toEqual({ phase: "building",
      reason: "step_failed", sentence: "A step failed and we're working on it. We'll email you the result." });
  });
});

describe("the review's small items", () => {
  it("says what a lost policy server means, and labels a try it did not count", () => {
    expect(setupFlagSentence("session_policy_server_lost")).toBe("This AI robot's software stopped during the test, so only some tries were counted.");
    expect(screeningReasonLabel("policy_server_unavailable").toLowerCase()).toBe("not counted: the ai robot's software was not running.");
  });
});
