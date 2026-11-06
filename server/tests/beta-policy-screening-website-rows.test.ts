// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseBetaPolicyScreeningPublication, screeningOutcome, screeningPublicationTransition } from "../utils/betaPolicyScreeningContract";
import { encodeTaskEvaluationRunPublication } from "../utils/taskEvaluationRunPublicationStorage";
import { projectManagedJobEvidence } from "../utils/jobManagedEvaluation";
import { projectCandidateSelection } from "../utils/betaCandidateSelection";
import { sealScreening, screeningSha, selectionFixture, websiteCampaignFixture } from "./fixtures/beta-policy-screening";
import allRows from "./fixtures/pipeline-beta-policy-screening-website-all-rows.v2.json";
import runnableRows from "./fixtures/pipeline-beta-policy-screening-website-runnable-rows.v2.json";

/**
 * P-DT-12 (owner decision 2026-11-05): a new website campaign plans only candidates that can run
 * on a website job. Campaigns planned before it keep listing every catalog row. Both are real
 * Pipeline publications of the same scene and money; the WebApp reads and shows both.
 */
const LEFT_OUT = 82;

function project(publication: ReturnType<typeof websiteCampaignFixture>["publication"], selection?: unknown) {
  const run = { run_id: publication.campaign_id, run_kind: "beta_policy_screening", state: publication.status,
    result_record_id: "result-one", job_evidence_binding: { job_id: "job-one", brief_digest: screeningSha("1") },
    job_task_context_digest: publication.source.task_context_digest, job_source_fingerprint: screeningSha("2"),
    configuration_digest: publication.plan_digest, source_scene_intent_id: publication.source.scene_intent_id,
    source_scene_revision_digest: publication.source.scene_revision_digest, publication_digest: publication.publication_digest,
    publication_revision: publication.revision, ...(selection ? { candidate_selection: { record: selection, registry_teams: [] } } : {}) };
  const record = { record_id: "result-one", publication_storage: encodeTaskEvaluationRunPublication(publication) };
  return projectManagedJobEvidence(run.run_id, run, record, "job-one", screeningSha("1"),
    publication.source.task_context_digest, screeningSha("2"))!;
}

describe("website campaigns with and without the rows no website job can run", () => {
  it("accepts both real Pipeline publications with their own digests", () => {
    const before = parseBetaPolicyScreeningPublication(allRows)!, after = parseBetaPolicyScreeningPublication(runnableRows)!;
    expect(before.candidates).toHaveLength(136);
    expect(after.candidates).toHaveLength(136 - LEFT_OUT);
    // The same catalog and money: leaving rows out removes none of either.
    expect(after.catalog_digest).toBe(before.catalog_digest);
    expect(after.budget).toEqual(before.budget);
    // Every row the new campaign lists is the older campaign's row in the same order. A scored
    // result's session digest binds its own campaign's plan, so only that field differs.
    const kept = new Set(after.candidates.map(row => row.candidate_id));
    const unbound = (row: (typeof after.candidates)[number]) => ({ ...row, session_result_digest: row.session_result_digest ? "bound" : null });
    expect(before.candidates.filter(row => kept.has(row.candidate_id)).map(unbound)).toEqual(after.candidates.map(unbound));
    const dropped = before.candidates.filter(row => !kept.has(row.candidate_id));
    expect(dropped).toHaveLength(LEFT_OUT);
    expect(dropped.every(row => row.status === "unavailable" && row.episodes_planned === 0 && row.blockers.length > 0)).toBe(true);
    expect(dropped.filter(row => row.candidate_id.startsWith("blueprint_scripted_"))).toHaveLength(24);
    // Each still waits on a registration nothing has supplied; none was quoted or ran.
    expect(dropped.every(row => row.blockers.includes("prepared_robot_policy_registration_missing")
      && row.episodes_scored === 0 && row.session_result_digest === null)).toBe(true);
  });

  it("states the same outcome and estimate for both; only the count of candidates listed differs", () => {
    const before = websiteCampaignFixture("all_rows").publication, after = websiteCampaignFixture("runnable_rows").publication;
    expect(screeningOutcome(before)).toBe("estimate");
    expect(screeningOutcome(after)).toBe("estimate");
    const old = project(before), current = project(after);
    expect(old.outcome).toBe("estimate");
    expect(current.outcome).toBe("estimate");
    expect(old.summary).toContain("In the simulation, 1 of 136 candidates ran, with 10 episodes scored");
    expect(current.summary).toContain("In the simulation, 1 of 54 candidates ran, with 10 episodes scored");
    expect(old.limitations).toContain("135 candidates did not run; each row lists why.");
    expect(current.limitations).toContain("53 candidates did not run; each row lists why.");
    expect(old.screening?.candidates).toHaveLength(136);
    expect(current.screening?.candidates).toHaveLength(54);
    const scored = (row: { scored: number }) => row.scored > 0;
    expect(current.screening!.candidates.filter(scored)).toEqual(old.screening!.candidates.filter(scored));
    expect(current.screening!.budget).toEqual(old.screening!.budget);
  });

  it("gives the same no-estimate outcome for both shapes when nothing scored", () => {
    // The held, setup and budget readings look at every open row; the rows left out never decide them.
    const unscored = (shape: "all_rows" | "runnable_rows") => {
      const { publication } = websiteCampaignFixture(shape);
      return sealScreening({ ...publication, status: "blocked", candidates: publication.candidates.map(row => row.status === "completed"
        ? { ...row, status: "blocked", blockers: ["beta_screening_native_result_missing"], episodes_scored: 0, episodes_succeeded: 0,
          episodes_failed: 0, episodes_void: 0, success_rate: null, session_result_digest: null } : row) });
    };
    const before = parseBetaPolicyScreeningPublication(unscored("all_rows"))!, after = parseBetaPolicyScreeningPublication(unscored("runnable_rows"))!;
    expect(screeningOutcome(before)).toBe("held_budget");
    expect(screeningOutcome(after)).toBe(screeningOutcome(before));
    const nothingSpent = (value: typeof before) => sealScreening({ ...value, budget: { ...value.budget,
      committed_upper_bound_usd: "0", spent_upper_bound_usd: "0" } });
    expect(screeningOutcome(nothingSpent(before))).toBe("held_setup");
    expect(screeningOutcome(nothingSpent(after))).toBe("held_setup");
  });

  it("keeps the rule's choice for either shape", () => {
    for (const shape of ["all_rows", "runnable_rows"] as const) {
      const { publication } = websiteCampaignFixture(shape);
      const selection = selectionFixture(publication);
      const projected = projectCandidateSelection({ record: selection, registry_teams: [] }, publication);
      expect(projected?.status).toBe("chosen");
      expect(projected?.chosen?.candidateId).toBe("cosmos3_edge_policy_droid");
      expect(projected?.candidates).toHaveLength(publication.candidates.length);
      expect(project(publication, selection).screening?.selection?.chosen?.candidateId).toBe("cosmos3_edge_policy_droid");
    }
  });

  it("still takes a later snapshot of a campaign planned with every row, and never lets one drop rows", () => {
    const { publication } = websiteCampaignFixture("all_rows");
    const later = sealScreening({ ...publication, revision: publication.revision + 1,
      generated_at: new Date(Date.parse(publication.generated_at) + 60_000).toISOString() });
    expect(screeningPublicationTransition(publication, later)).toBe("updated");
    // A campaign's rows are its identity: a later revision without the left-out rows is refused.
    const runnable = new Set(websiteCampaignFixture("runnable_rows").publication.candidates.map(row => row.candidate_id));
    const shrunk = sealScreening({ ...later, candidates: later.candidates.filter(row => runnable.has(row.candidate_id)) });
    expect(() => screeningPublicationTransition(publication, shrunk)).toThrow("screening_campaign_identity_conflict");
  });
});
