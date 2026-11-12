// @vitest-environment node
/**
 * The Pipeline's known-good control (owner approval 2026-11-10): one scripted reference arm run on a new
 * website campaign's scene, published as one more scripted row whose own `known_good_control_*` set-up flag
 * names it. It is a check, never a candidate: it stays out of candidate lists, counts and the estimate, and
 * its outcome is one sentence. A scripted row from before the change (no such flag) reads exactly as before.
 */
import { describe, expect, it } from "vitest";
import { parseBetaPolicyScreeningPublication, screeningCandidateRows, screeningEstimateRows, screeningKnownGoodControl,
  screeningOutcome, screeningOutcomeCaveat, screeningReferenceCheck, type BetaPolicyScreeningPublication } from "../utils/betaPolicyScreeningContract";
import { encodeTaskEvaluationRunPublication } from "../utils/taskEvaluationRunPublicationStorage";
import { projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { screeningOutcomeNoticeIntent } from "../utils/screeningOutcomeNotifications";
import { SETUP_FLAG_UNCLASSIFIED_SENTENCE, isKnownFlag, screeningSetupNotes, setupFlagSentence } from "../utils/screeningSetupFlagSentences";
import { projectCandidateSelection } from "../utils/betaCandidateSelection";
import { finishedScreening, outcomePublication, screeningFixture, screeningSha, sealScreening, selectionFixture } from "./fixtures/beta-policy-screening";
import scriptedFixture from "./fixtures/pipeline-beta-policy-screening-scripted-publication.v2.json";

const PASSED = "Before testing robots, a scripted reference arm that reads exact positions from the simulation completed the job, so the simulated scene can record a success.";
const FAILED = "A scripted reference arm that reads exact positions from the simulation did not complete the job in the simulated scene, so a low result here may reflect our simulation rather than the robots.";
const UNAVAILABLE = "We have no scripted reference for this kind of job yet, so nothing confirmed beforehand that the simulated scene can record a success.";
const INTERRUPTED = "Our scripted reference check did not finish, so it could not confirm that the simulated scene can record a success.";
// The check's own sentence states its real counts (review, 2026-11-12): successes of its scored tries, and how many
// could not be scored when any.
const ARM = "a scripted reference arm that reads exact positions from the simulation";
const counted = (done: string, verdict: "passed" | "partly" | "failed") => verdict === "passed"
  ? `Before testing robots, ${ARM} did the job in ${done}, so the simulated scene can record a success.`
  : `A${ARM.slice(1)} did the job in ${done}, so a low result here may ${verdict === "partly" ? "partly " : ""}reflect our simulation rather than the robots.`;
const NOT_SCORED = "None of our scripted reference check's tries could be scored, so it could not confirm that the simulated scene can record a success.";

/** The control row as the Pipeline publishes it: scripted, three nominal episodes, its outcome as its one flag. */
function controlRow(flag: string, done: { scored: number; succeeded: number; planned?: number } | null = { scored: 3, succeeded: 1 }) {
  const ran = done !== null && !flag.startsWith("known_good_control_unavailable") && flag !== "known_good_control_pending";
  return { candidate_id: "blueprint_scripted_ur5e", display_name: "Blueprint scripted reference check",
    configuration_digest: screeningSha("9"), status: flag === "known_good_control_pending" ? "running" : ran ? "completed" : "unavailable",
    blockers: ran || flag === "known_good_control_pending" ? [] : ["candidate_disabled"], episodes_planned: ran ? done!.planned ?? 3 : flag === "known_good_control_pending" ? 3 : 0,
    episodes_scored: ran ? done!.scored : 0, episodes_succeeded: ran ? done!.succeeded : 0,
    episodes_failed: ran ? done!.scored - done!.succeeded : 0, episodes_void: ran ? (done!.planned ?? 3) - done!.scored : 0,
    success_rate: ran && done!.scored ? done!.succeeded / done!.scored : null, session_result_digest: ran ? screeningSha("8") : null,
    execution_evidence_kind: "scripted_simulator_state_baseline", action_source: "scripted_simulator_state",
    scripted_rollout_count: ran ? done!.planned ?? 3 : 0, learned_policy_rollout_count: 0, scripted_controller_invoked: ran, candidate_policy_queried: false,
    setup_quality_flags: [flag] };
}

/** A v3 publication: `base`'s rows plus the control row (status recomputed by the caller where it matters). */
function withControl(base: BetaPolicyScreeningPublication, row: ReturnType<typeof controlRow>, status = base.status) {
  return sealScreening({ ...base, schema_version: "beta_policy_screening_publication.v3", status,
    scene_feasibility: { status: "unknown", flags: [] }, candidates: [...base.candidates, row] });
}

function projected(publication: BetaPolicyScreeningPublication) {
  const scope = { requestId: "job-1", briefDigest: screeningSha("1") };
  const run = { run_id: publication.campaign_id, run_kind: "beta_policy_screening", state: publication.status, result_record_id: "result-one",
    job_evidence_binding: { job_id: scope.requestId, brief_digest: scope.briefDigest },
    job_task_context_digest: publication.source.task_context_digest, job_source_fingerprint: screeningSha("2"),
    configuration_digest: publication.plan_digest, source_scene_intent_id: publication.source.scene_intent_id,
    source_scene_revision_digest: publication.source.scene_revision_digest, publication_digest: publication.publication_digest,
    publication_revision: publication.revision };
  const record = { record_id: "result-one", publication_storage: encodeTaskEvaluationRunPublication(publication) };
  return projectManagedJobEvidence(run.run_id, run, record, scope.requestId, scope.briefDigest,
    publication.source.task_context_digest, screeningSha("2"))!;
}

const finished = () => {
  const { publication } = screeningFixture();
  return finishedScreening({ ...publication, site_id: "site-job-1" } as BetaPolicyScreeningPublication);
};

describe("the known-good control row", () => {
  it("is a check, never a candidate: out of the estimate, the counts and the list, said in one sentence", () => {
    const base = finished();
    // A check that did the job 3 of 3 times (rewritten, 2026-11-12: the sentence follows the counts, and this fixture's
    // default of 1 of 3 now reads as partly).
    const value = parseBetaPolicyScreeningPublication(withControl(base, controlRow("known_good_control_passed", { scored: 3, succeeded: 3 })))!;
    expect(value).not.toBeNull();
    const control = value.candidates.at(-1)!;
    expect(screeningKnownGoodControl(control)).toBe(true);
    expect(screeningCandidateRows(value.candidates)).toEqual(value.candidates.slice(0, -1));
    // The estimate already left scripted rows out; the control is one of them.
    expect(screeningEstimateRows(value.candidates).map(row => row.candidate_id)).not.toContain(control.candidate_id);
    expect(screeningOutcome(value)).toBe(screeningOutcome(base));
    const row = projected(value), before = projected(base);
    expect(row.screening!.candidates.map(item => item.candidateId)).toEqual(before.screening!.candidates.map(item => item.candidateId));
    expect(row.summary).toBe(before.summary);
    expect(row.limitations).toEqual(before.limitations);
    expect(row.screening!.setupNotes).toEqual([counted("3 of 3 scored tries in the simulated scene", "passed")]);
    const notice = screeningOutcomeNoticeIntent(value, "job-1")!, plain = screeningOutcomeNoticeIntent(base, "job-1")!;
    expect(notice.counts).toEqual(plain.counts);
  });

  // Review, 2026-11-12: the next Pipeline publishes the control FIRST, with its counts in the flag. Nothing depends on
  // its position: it is found by its own marker. The released Pipeline's row-last publications read as before.
  it("reads the same when the control is the first row, with the next Pipeline's suffixed flag", () => {
    const base = finished();
    const first = (row: ReturnType<typeof controlRow>) => sealScreening({ ...base, schema_version: "beta_policy_screening_publication.v3",
      scene_feasibility: { status: "unknown", flags: [] }, candidates: [row, ...base.candidates] });
    const value = parseBetaPolicyScreeningPublication(first(controlRow("known_good_control_passed:3_of_3", { scored: 3, succeeded: 3 })))!;
    expect(value).not.toBeNull();
    expect(screeningKnownGoodControl(value.candidates[0])).toBe(true);
    expect(screeningCandidateRows(value.candidates)).toEqual(value.candidates.slice(1));
    expect(screeningOutcome(value)).toBe(screeningOutcome(base));
    const row = projected(value), before = projected(base);
    expect(row.screening!.candidates.map(item => item.candidateId)).toEqual(before.screening!.candidates.map(item => item.candidateId));
    expect(row.summary).toBe(before.summary);
    expect(row.screening!.setupNotes).toEqual([counted("3 of 3 scored tries in the simulated scene", "passed")]);
    expect(screeningOutcomeNoticeIntent(value, "job-1")!.counts).toEqual(screeningOutcomeNoticeIntent(base, "job-1")!.counts);
    const projection = projectCandidateSelection({ record: selectionFixture(value) }, value)!;
    expect(projection.candidates.map(item => item.candidateId)).toEqual(value.candidates.slice(1).map(item => item.candidate_id));
    const partly = parseBetaPolicyScreeningPublication(first(controlRow("known_good_control_partly:1_of_3", { scored: 3, succeeded: 1 })))!;
    expect(screeningReferenceCheck(partly.candidates)).toBe("partly");
    expect(screeningSetupNotes(partly)).toEqual([counted("1 of 3 scored tries in the simulated scene", "partly")]);
  });

  it("is never a row the Pipeline's choice of candidate lists", () => {
    const value = parseBetaPolicyScreeningPublication(withControl(finished(), controlRow("known_good_control_passed")))!;
    const projection = projectCandidateSelection({ record: selectionFixture(value) }, value)!;
    expect(projection.candidates.map(row => row.candidateId)).toEqual(value.candidates.slice(0, -1).map(row => row.candidate_id));
    expect(projection.chosen?.candidateId).not.toBe("blueprint_scripted_ur5e");
  });

  it.each([
    ["known_good_control_passed", PASSED], ["known_good_control_failed", FAILED],
    ["known_good_control_interrupted", INTERRUPTED], ["known_good_control_unavailable:task_kind", UNAVAILABLE],
    // Rewritten (review, 2026-11-12): a check with no reference for the simulator used has its own sentence.
    ["known_good_control_unavailable:backend", "We have no scripted reference that runs in the simulator this job used yet, so nothing confirmed beforehand that the simulated scene can record a success."],
    ["known_good_control_unavailable:embodiment", "We have no scripted reference for the robots chosen for this job yet, so nothing confirmed beforehand that the simulated scene can record a success."],
    ["known_good_control_unavailable:budget", "We did not run our scripted reference check, so that this job's budget could go to testing robots; nothing confirmed beforehand that the simulated scene can record a success."],
    // A pass or fail of the same check made earlier for the same scene reads as that outcome.
    ["known_good_control_passed:reused", PASSED], ["known_good_control_failed:reused", FAILED],
  ])("says %s in one plain sentence, never the code", (code, sentence) => {
    expect(setupFlagSentence(code)).toBe(sentence);
    expect(sentence).not.toContain("known_good_control");
  });

  it("says nothing while the check has not ended", () => {
    const value = parseBetaPolicyScreeningPublication(withControl(finished(), controlRow("known_good_control_pending"), "running"))!;
    expect(screeningSetupNotes(value)).toEqual([]);
  });

  it("keeps a running campaign running while only the control is still running", () => {
    const pending = controlRow("known_good_control_pending");
    // Every candidate finished, the control has not: the campaign is still running, and only that is accepted.
    expect(parseBetaPolicyScreeningPublication(withControl(finished(), pending, "running"))?.status).toBe("running");
    expect(parseBetaPolicyScreeningPublication(withControl(finished(), pending, "completed"))).toBeNull();
    // A run in progress has no outcome yet.
    expect(screeningOutcome(parseBetaPolicyScreeningPublication(withControl(finished(), pending, "running"))!)).toBeNull();
  });

  it("never turns a run with no scored candidate into a reference-only result", () => {
    const { publication } = screeningFixture();
    const setup = outcomePublication(publication, "held_setup");
    const value = parseBetaPolicyScreeningPublication(withControl(setup, controlRow("known_good_control_passed"), "completed"))!;
    expect(screeningOutcome(setup)).toBe("held_setup");
    // The candidates decide: the control's scored episodes are no estimate and no reference result.
    expect(screeningOutcome(value)).toBe("held_setup");
  });

  // Rewritten (review, 2026-11-12): the reference check now drives the set-up notice on a result with no success: it
  // shows when the check failed, did only partly, or could not run, and a passed check removes no other flag.
  const noSuccess = () => sealScreening({ ...finished(), candidates: finished().candidates.map(row => row.status === "completed"
    ? { ...row, episodes_succeeded: 0, episodes_failed: row.episodes_scored, success_rate: 0 } : row) });
  it.each([
    ["failed (0 of 3)", controlRow("known_good_control_failed", { scored: 3, succeeded: 0 }), "failed", "scene_setup"],
    ["partly (1 of 3)", controlRow("known_good_control_passed", { scored: 3, succeeded: 1 }), "partly", "scene_setup"],
    ["could not run", controlRow("known_good_control_unavailable"), "could_not_run", "scene_setup"],
    ["interrupted", controlRow("known_good_control_interrupted", null), "could_not_run", "scene_setup"],
    ["passed (2 of 3)", controlRow("known_good_control_passed", { scored: 3, succeeded: 2 }), "passed", null],
    ["passed (3 of 3)", controlRow("known_good_control_passed", { scored: 3, succeeded: 3 }), "passed", null],
  ] as const)("adds the set-up notice to a result with no success when the reference check %s", (_label, row, check, caveat) => {
    const value = parseBetaPolicyScreeningPublication(withControl(noSuccess(), row as never))!;
    expect(screeningOutcome(value)).toBe("estimate");
    expect(screeningReferenceCheck(value.candidates)).toBe(check);
    expect(screeningOutcomeCaveat(value)).toBe(caveat);
  });
  // Rewritten (review, 2026-11-12): the check's sentence and its verdict both follow its real counts, never its flag
  // (a released Pipeline flags 1 of 3 as passed): could not run with nothing scored, failed with no scored success,
  // passed with at least two scored and two thirds of them successes, otherwise partly.
  it.each([
    ["3/3", { scored: 3, succeeded: 3 }, "passed", counted("3 of 3 scored tries in the simulated scene", "passed")],
    ["2/3", { scored: 3, succeeded: 2 }, "passed", counted("2 of 3 scored tries in the simulated scene", "passed")],
    ["2/2 with a void", { scored: 2, succeeded: 2 }, "passed",
      counted("2 of 2 scored tries in the simulated scene (1 more try could not be scored)", "passed")],
    ["1/2 with a void", { scored: 2, succeeded: 1 }, "partly",
      counted("1 of 2 scored tries in the simulated scene (1 more try could not be scored)", "partly")],
    ["1/1 with two voids", { scored: 1, succeeded: 1 }, "partly",
      counted("1 of 1 scored try in the simulated scene (2 more tries could not be scored)", "partly")],
    ["0/3", { scored: 3, succeeded: 0 }, "failed", counted("none of 3 scored tries in the simulated scene", "failed")],
    ["0 scored", { scored: 0, succeeded: 0 }, "could_not_run", NOT_SCORED],
  ] as const)("says the reference check's real counts and verdict (%s, flagged passed)", (_label, done, check, sentence) => {
    const value = parseBetaPolicyScreeningPublication(withControl(noSuccess(), controlRow("known_good_control_passed", done) as never))!;
    expect(value).not.toBeNull();
    expect(screeningReferenceCheck(value.candidates)).toBe(check);
    expect(screeningSetupNotes(value)).toEqual([sentence]);
  });
  it.each([
    ["could not run", controlRow("known_good_control_unavailable"), UNAVAILABLE],
    ["interrupted", controlRow("known_good_control_interrupted", null), INTERRUPTED],
  ] as const)("keeps the flag's own sentence for a check that %s", (_label, row, sentence) => {
    const value = parseBetaPolicyScreeningPublication(withControl(noSuccess(), row as never))!;
    expect(screeningReferenceCheck(value.candidates)).toBe("could_not_run");
    expect(screeningSetupNotes(value)).toEqual([sentence]);
  });

  it("keeps a camera flag's notice when the reference check passed, and adds none to a result with a success", () => {
    const flagged = sealScreening({ ...noSuccess(), schema_version: "beta_policy_screening_publication.v3",
      scene_feasibility: { status: "unknown", flags: [] }, candidates: noSuccess().candidates.map((row, index) => index === 0
        ? { ...row, observation_quality_flags: ["task_object_partly_hidden:wrist"] } : row) });
    const passed = parseBetaPolicyScreeningPublication(withControl(flagged, controlRow("known_good_control_passed", { scored: 3, succeeded: 3 })))!;
    expect(screeningOutcomeCaveat(passed)).toBe("scene_setup");
    const succeeded = parseBetaPolicyScreeningPublication(withControl(finished(), controlRow("known_good_control_failed", { scored: 3, succeeded: 0 })))!;
    expect(screeningOutcomeCaveat(succeeded)).toBeNull();
  });
  it("never raises the notice for a fact about one robot and the object", () => {
    const facts = sealScreening({ ...noSuccess(), schema_version: "beta_policy_screening_publication.v3",
      scene_feasibility: { status: "unknown", flags: [] }, candidates: noSuccess().candidates.map((row, index) => index === 0
        ? { ...row, setup_quality_flags: ["task_object_needs_edge_grip", "task_object_wider_than_gripper"] } : row) });
    const value = parseBetaPolicyScreeningPublication(facts)!;
    expect(screeningOutcomeCaveat(value)).toBeNull();
    expect(screeningSetupNotes(value)).toEqual([]);
  });
});

describe("a scripted row from before the control", () => {
  it("is never taken for the control and renders exactly as before", () => {
    const publication = parseBetaPolicyScreeningPublication(scriptedFixture)!;
    expect(publication.candidates.some(screeningKnownGoodControl)).toBe(false);
    expect(screeningCandidateRows(publication.candidates)).toEqual(publication.candidates);
    const row = projected(publication);
    expect(row.screening!.candidates).toHaveLength(publication.candidates.length);
    expect(row.limitations.join(" ")).toContain("do not establish learned-policy or vendor-policy performance");
    expect(screeningOutcome(publication)).toBe("reference_only");
  });

  it("with any other set-up flag is still a candidate row", () => {
    const value = { ...controlRow("known_good_control_passed"), setup_quality_flags: ["g1_spawn_overlap"] };
    expect(screeningKnownGoodControl(value)).toBe(false);
    // A learned row can never be the control, whatever it carries.
    expect(screeningKnownGoodControl({ ...controlRow("known_good_control_passed"), execution_evidence_kind: "learned_policy" })).toBe(false);
    expect(setupFlagSentence("known_good_control_something_new")).toBe(SETUP_FLAG_UNCLASSIFIED_SENTENCE);
  });
});

// Review, 2026-11-12: the Pipeline's test stage puts the reference row first and adds counted flags; nothing reads
// rows by position, and the codes are known.
describe("the reference row, wherever it is, and its new flags", () => {
  it("gives the same page when the rows are shuffled", () => {
    const base = finished();
    const rows = [controlRow("known_good_control_passed:3_of_3", { scored: 3, succeeded: 3 }), ...base.candidates];
    const sealed = (candidates: readonly unknown[]) => parseBetaPolicyScreeningPublication(sealScreening({ ...base,
      schema_version: "beta_policy_screening_publication.v3", scene_feasibility: { status: "unknown", flags: [] }, candidates } as never))!;
    const first = projected(sealed(rows));
    for (const order of [[...rows].reverse(), [rows[2], rows[0], ...rows.slice(3), rows[1]].filter(Boolean)]) {
      const view = projected(sealed(order));
      expect(view.summary).toBe(first.summary);
      expect(view.screening!.setupNotes).toEqual(first.screening!.setupNotes);
      expect(view.screening!.candidates.map(row => row.candidateId).sort()).toEqual(first.screening!.candidates.map(row => row.candidateId).sort());
      expect(screeningOutcome(sealed(order))).toBe(screeningOutcome(sealed(rows)));
    }
  });
  it.each(["known_good_control_passed:2_of_3", "known_good_control_passed:3_of_3", "known_good_control_partly:1_of_3",
    "known_good_control_failed:0_of_3", "known_good_control_partly:reused"])("knows %s", code => {
    expect(isKnownFlag(code)).toBe(true);
  });
  it("classes a reused partly check as partly with no counts of its own, and says the flag's sentence", () => {
    const value = parseBetaPolicyScreeningPublication(withControl(finished(), controlRow("known_good_control_partly:reused", { scored: 0, succeeded: 0 })))!;
    expect(value).not.toBeNull();
    expect(screeningReferenceCheck(value.candidates)).toBe("partly");
    expect(screeningSetupNotes(value)).toEqual([setupFlagSentence("known_good_control_partly")]);
  });
});
