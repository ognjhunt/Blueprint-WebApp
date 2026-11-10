// @vitest-environment node
/**
 * The Pipeline's known-good control (owner approval 2026-11-10): one scripted reference arm run on a new
 * website campaign's scene, published as one more scripted row whose own `known_good_control_*` set-up flag
 * names it. It is a check, never a candidate: it stays out of candidate lists, counts and the estimate, and
 * its outcome is one sentence. A scripted row from before the change (no such flag) reads exactly as before.
 */
import { describe, expect, it } from "vitest";
import { parseBetaPolicyScreeningPublication, screeningCandidateRows, screeningEstimateRows, screeningKnownGoodControl,
  screeningOutcome, screeningOutcomeCaveat, type BetaPolicyScreeningPublication } from "../utils/betaPolicyScreeningContract";
import { encodeTaskEvaluationRunPublication } from "../utils/taskEvaluationRunPublicationStorage";
import { projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { screeningOutcomeNoticeIntent } from "../utils/screeningOutcomeNotifications";
import { SETUP_FLAG_UNCLASSIFIED_SENTENCE, screeningSetupNotes, setupFlagSentence } from "../utils/screeningSetupFlagSentences";
import { projectCandidateSelection } from "../utils/betaCandidateSelection";
import { finishedScreening, outcomePublication, screeningFixture, screeningSha, sealScreening, selectionFixture } from "./fixtures/beta-policy-screening";
import scriptedFixture from "./fixtures/pipeline-beta-policy-screening-scripted-publication.v2.json";

const PASSED = "Before testing robots, a scripted reference arm that reads exact positions from the simulation completed the job, so the simulated scene can record a success.";
const FAILED = "A scripted reference arm that reads exact positions from the simulation did not complete the job in the simulated scene, so a low result here may reflect our simulation rather than the robots.";
const UNAVAILABLE = "We have no scripted reference for this kind of job yet, so nothing confirmed beforehand that the simulated scene can record a success.";
const INTERRUPTED = "Our scripted reference check did not finish, so it could not confirm that the simulated scene can record a success.";

/** The control row as the Pipeline publishes it: scripted, three nominal episodes, its outcome as its one flag. */
function controlRow(flag: string, done: { scored: number; succeeded: number } | null = { scored: 3, succeeded: 1 }) {
  const ran = done !== null && !flag.startsWith("known_good_control_unavailable") && flag !== "known_good_control_pending";
  return { candidate_id: "blueprint_scripted_ur5e", display_name: "Blueprint scripted reference check",
    configuration_digest: screeningSha("9"), status: flag === "known_good_control_pending" ? "running" : ran ? "completed" : "unavailable",
    blockers: ran || flag === "known_good_control_pending" ? [] : ["candidate_disabled"], episodes_planned: ran || flag === "known_good_control_pending" ? 3 : 0,
    episodes_scored: ran ? done!.scored : 0, episodes_succeeded: ran ? done!.succeeded : 0,
    episodes_failed: ran ? done!.scored - done!.succeeded : 0, episodes_void: ran ? 3 - done!.scored : 0,
    success_rate: ran && done!.scored ? done!.succeeded / done!.scored : null, session_result_digest: ran ? screeningSha("8") : null,
    execution_evidence_kind: "scripted_simulator_state_baseline", action_source: "scripted_simulator_state",
    scripted_rollout_count: ran ? 3 : 0, learned_policy_rollout_count: 0, scripted_controller_invoked: ran, candidate_policy_queried: false,
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
    const value = parseBetaPolicyScreeningPublication(withControl(base, controlRow("known_good_control_passed")))!;
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
    expect(row.screening!.setupNotes).toEqual([PASSED]);
    const notice = screeningOutcomeNoticeIntent(value, "job-1")!, plain = screeningOutcomeNoticeIntent(base, "job-1")!;
    expect(notice.counts).toEqual(plain.counts);
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
    ["known_good_control_unavailable:backend", UNAVAILABLE],
    ["known_good_control_unavailable:embodiment", "We have no scripted reference for the robots tested on this job yet, so nothing confirmed beforehand that the simulated scene can record a success."],
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

  it("does not add the scene caveat for a control's own flag", () => {
    const base = sealScreening({ ...finished(), candidates: finished().candidates.map(row => row.status === "completed"
      ? { ...row, episodes_succeeded: 0, episodes_failed: row.episodes_scored, success_rate: 0 } : row) });
    const value = parseBetaPolicyScreeningPublication(withControl(base, controlRow("known_good_control_failed", { scored: 3, succeeded: 0 })))!;
    expect(screeningOutcome(value)).toBe("estimate");
    expect(screeningOutcomeCaveat(value)).toBe(screeningOutcomeCaveat(base));
    expect(screeningSetupNotes(value)).toEqual([FAILED]);
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
