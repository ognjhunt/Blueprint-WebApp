import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PolicyScreeningCandidates } from "../src/components/shared/PolicyScreeningCandidates";
import { screeningReasonLabel, screeningReasonLabels } from "../src/lib/screeningPlainLanguage";

afterEach(cleanup);

it("shows the typed scripted scope independently of a candidate's display name", () => {
  render(<PolicyScreeningCandidates screening={{ candidates: [{ candidateId: "candidate", name: "Candidate A",
    state: "completed", planned: 3, scored: 3, succeeded: 2, failed: 1, void: 0, blockers: [],
    executionEvidence: { execution_evidence_kind: "scripted_simulator_state_baseline", action_source: "scripted_simulator_state",
      scripted_rollout_count: 3, learned_policy_rollout_count: 0, scripted_controller_invoked: true, candidate_policy_queried: false } }] }} />);
  expect(screen.getByText(/Scripted baseline: a hand-coded reference run/)).toHaveTextContent("It does not show how those policies perform");
  expect(screen.getByText("2 succeeded · 1 failed · 0 unscorable")).toBeInTheDocument();
});

const row = (candidateId: string, state: string, succeeded = 0, blockers: string[] = []) => ({ candidateId, name: `Candidate ${candidateId}`,
  state, planned: 3, scored: state === "completed" ? 3 : 0, succeeded, failed: state === "completed" ? 3 - succeeded : 0, void: 0, blockers });

it("states each scored candidate's bounded estimate in plain words, and the chosen one's too", () => {
  // The server's 95% Wilson ranges (successRateConfidence) for 7 of 10 and 2 of 3.
  const scored = { candidateId: "a", name: "Candidate a", state: "completed", planned: 11, scored: 10, succeeded: 7, failed: 3, void: 1,
    blockers: [], successRange: { lowerPercent: 40, upperPercent: 89, confidencePercent: 95 } };
  render(<PolicyScreeningCandidates screening={{ candidates: [scored, { ...row("b", "completed", 2),
    successRange: { lowerPercent: 21, upperPercent: 94, confidencePercent: 95 } }, row("c", "deferred", 0, ["website_job_ceiling_insufficient"])],
    selection: { status: "chosen", selectionDigest: "sha256:selection", tiedWith: [],
      chosen: { candidateId: "a", name: "Candidate a", successRate: 0.7, scored: 10, succeeded: 7, configurationId: null, policyRouteId: null,
        deploymentCompanies: [], relationship: null, evidenceUrl: null, relatedTeams: [], partnerBlockers: [], registryTeams: [] },
      candidates: [{ candidateId: "a", resultRank: 1, choiceBlocker: null }, { candidateId: "b", resultRank: 2, choiceBlocker: null },
        { candidateId: "c", resultRank: null, choiceBlocker: "not_evaluated" }] } }} />);
  expect(screen.getByText("Succeeded in 7 of 10 scored tries; likely between 40% and 89%.")).toBeInTheDocument();
  expect(screen.getByText("3 failed · 1 unscorable")).toBeInTheDocument();
  expect(screen.getByText("Succeeded in 2 of 3 scored tries; likely between 21% and 94%.")).toBeInTheDocument();
  expect(screen.getByText("Chosen in simulation: Candidate a. 7 of 10 scored episodes succeeded "
    + "(estimated success rate 70%; likely between 40% and 89%).")).toBeInTheDocument();
  expect(screen.getByText("“Likely between” is a 95% confidence range from the scored tries, for this simulated scene only. "
    + "It assumes each try is independent; fewer tries give a wider range.")).toBeInTheDocument();
  // Held back by the job's dollar ceiling: the site reads that it did not run, never a money figure or code.
  expect(screen.getByText("Not run: this job reached a limit on our side. Nothing is needed from you.")).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/ceiling|budget|\$|[a-z]_[a-z]/i);
});

it("shows a development-only row's result beside the others but never ranks or chooses it", () => {
  const humanoid = { ...row("g1", "completed", 1), name: "HumanoidArena DP G1 / Dex3 / SONIC manipulation" };
  const screening = { candidates: [row("a", "completed", 0), humanoid],
    selection: { status: "no_successful_candidate" as const, selectionDigest: "sha256:selection", tiedWith: [], chosen: null,
      candidates: [{ candidateId: "a", resultRank: 1, choiceBlocker: null },
        { candidateId: "g1", resultRank: null, choiceBlocker: "development_only_reference" }] } };
  const { rerender } = render(<PolicyScreeningCandidates screening={screening} />);
  const g1 = screen.getByRole("row", { name: /HumanoidArena DP G1/ });
  expect(within(g1).getByText(/^Development check: run for internal development only\./))
    .toHaveTextContent("It is not ranked against the other candidates or chosen, and it does not qualify this robot or policy.");
  expect(within(g1).getByText("1 succeeded · 2 failed · 0 unscorable")).toBeInTheDocument();
  expect(g1.lastElementChild).toHaveTextContent("Not chosen: a development check, not ranked against the other candidates");
  expect(screen.getByRole("row", { name: /Candidate a/ }).lastElementChild).toHaveTextContent("Ranked 1");
  expect(screen.queryByText(/Chosen in simulation/)).toBeNull();
  expect(document.body.textContent).not.toMatch(/[a-z]_[a-z]/);
  rerender(<PolicyScreeningCandidates screening={screening} showCodes />);
  expect(screen.getByRole("row", { name: /HumanoidArena DP G1/ }).lastElementChild)
    .toHaveTextContent("Not chosen: development_only_reference");
});

it("states no range for a candidate with nothing scored", () => {
  render(<PolicyScreeningCandidates screening={{ candidates: [row("a", "deferred")] }} />);
  expect(screen.getByText("0 succeeded · 0 failed · 0 unscorable")).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/likely between|confidence range/i);
});

it("shows the rule's choice as a simulation estimate with its recorded companies and every candidate's outcome", () => {
  render(<PolicyScreeningCandidates screening={{ candidates: [row("a", "completed", 2), row("b", "completed", 1),
    row("c", "infeasible", 0, ["candidate_infeasible_measured_geometry"])],
    selection: { status: "chosen", selectionDigest: "sha256:selection", tiedWith: [],
      chosen: { candidateId: "a", name: "Candidate a", successRate: 2 / 3, scored: 3, succeeded: 2, configurationId: "fanuc_m710ic_45m",
        policyRouteId: "planning_endpoint", deploymentCompanies: ["Jacobi Robotics", "Delta Technology"], relationship: "company_deployment",
        evidenceUrl: "https://jacobirobotics.com/platform", relatedTeams: ["Jacobi Robotics"], partnerBlockers: [],
        registryTeams: [{ id: "jacobi", name: "Jacobi Robotics" }] },
      candidates: [{ candidateId: "a", resultRank: 1, choiceBlocker: null }, { candidateId: "b", resultRank: 2, choiceBlocker: null },
        { candidateId: "c", resultRank: null, choiceBlocker: "not_evaluated" }] } }} />);
  expect(screen.getByText(/^Chosen in simulation: Candidate a\. 2 of 3 scored episodes succeeded \(estimated success rate 67%\)\.$/)).toBeInTheDocument();
  expect(screen.getByText(/Deployment companies recorded for this configuration: Jacobi Robotics, Delta Technology/))
    .toHaveTextContent("(a company deployment) · source. A recorded association, not a commitment to this site.");
  expect(screen.getByRole("link", { name: "source" })).toHaveAttribute("href", "https://jacobirobotics.com/platform");
  expect(screen.getByText("In Blueprint's robot team registry by name: Jacobi Robotics.")).toBeInTheDocument();
  expect(screen.getByText(/A simulation result is a bounded estimate; it does not certify physical performance or safety\./)).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/development only/);
  // The candidate that did not run is folded behind one toggle, still saying why.
  expect(screen.getAllByRole("row").slice(1).map(value => value.lastElementChild?.textContent)).toEqual(["Chosen", "Ranked 2"]);
  fireEvent.click(screen.getByRole("button", { name: "Show the 1 candidate that did not run, and why" }));
  expect(screen.getAllByRole("row").slice(1).map(value => value.lastElementChild?.textContent))
    .toEqual(["Chosen", "Ranked 2", "Not chosen: it did not run in this evaluation"]);
  expect(screen.getByText(/^Out of reach · 0\/3 scored/)).toBeInTheDocument();
  expect(screen.getByText("Measured out of reach from the robot position planned in your scene.")).toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/infeasible|measured geometry|not evaluated|_/);
});

it("maps every recorded code to a plain reason for the site, and shows raw codes only in operations views", () => {
  const codes = ["task_kind_not_supported_by_candidate", "candidate_disabled", "commercial_use_not_admitted",
    "prepared_robot_policy_registration_missing", "runtime_candidate_binding_missing", "policy_identity_not_pinned",
    "beta_screening_static_preflight_blocked:no_offer", "site_screening_budget_insufficient", "beta_screening_site_budget_exhausted",
    "website_job_ceiling_insufficient",
    "beta_screening_waiting_for_capacity", "beta_screening_replanned_for_new_implementation", "team_embodiment_station_out_of_reach",
    "an_unknown_code_from_a_newer_pipeline"];
  const screening = { candidates: [row("a", "blocked", 0, codes), row("b", "deferred"), row("c", "waitlisted"),
    row("d", "reconciliation_required"), row("e", "a_newer_state")],
    selection: { status: "chosen" as const, selectionDigest: "sha256:selection", tiedWith: [],
      chosen: { candidateId: "a", name: "Candidate a", successRate: 1, scored: 3, succeeded: 3, configurationId: null, policyRouteId: null,
        deploymentCompanies: ["Example Co"], relationship: "planning_candidate" as const, evidenceUrl: null, relatedTeams: [], registryTeams: [],
        partnerBlockers: ["catalog_row_unavailable", "an_unknown_partner_code"] },
      candidates: [{ candidateId: "a", resultRank: 1, choiceBlocker: null }, { candidateId: "b", resultRank: null, choiceBlocker: "no_scored_episodes" },
        { candidateId: "c", resultRank: null, choiceBlocker: "scripted_baseline_reference_only" },
        { candidateId: "d", resultRank: null, choiceBlocker: "a_newer_choice_code" }, { candidateId: "e", resultRank: null, choiceBlocker: null }] } };
  const { rerender } = render(<PolicyScreeningCandidates screening={screening} />);
  const text = document.body.textContent!;
  expect(text).toContain("Example Co (a planning candidate).");
  for (const code of [...codes, "catalog_row_unavailable", "an_unknown_partner_code", "no_scored_episodes",
    "scripted_baseline_reference_only", "a_newer_choice_code", "reconciliation_required", "a_newer_state"]) {
    expect(text).not.toContain(code);
    expect(text).not.toContain(code.replace(/_/g, " "));
  }
  expect(text).not.toMatch(/[a-z]_[a-z]/);
  expect(text).not.toMatch(/budget|\$/i);
  expect(screen.getByText("Not built for this kind of task.")).toBeInTheDocument();
  expect(screen.getByText("Not set up in our simulator yet.")).toBeInTheDocument();
  expect(screen.getByText("Not chosen: a scripted reference baseline, not a learned policy")).toBeInTheDocument();
  rerender(<PolicyScreeningCandidates screening={screening} showCodes />);
  expect(document.body.textContent).toContain("task_kind_not_supported_by_candidate");
  expect(document.body.textContent).toContain("catalog_row_unavailable");
  expect(document.body.textContent).toContain("Not chosen: no_scored_episodes");
});

it("says when nothing succeeded and names no partner without a recorded one", () => {
  const { rerender } = render(<PolicyScreeningCandidates screening={{ candidates: [row("a", "completed", 0)],
    selection: { status: "no_successful_candidate", selectionDigest: "sha256:selection", tiedWith: [], chosen: null,
      candidates: [{ candidateId: "a", resultRank: 1, choiceBlocker: null }] } }} />);
  expect(screen.getByText("No successful candidate: no evaluated candidate succeeded in simulation.")).toBeInTheDocument();
  expect(screen.queryByText(/Deployment companies/)).toBeNull();
  rerender(<PolicyScreeningCandidates screening={{ candidates: [row("a", "completed", 1)],
    selection: { status: "chosen", selectionDigest: "sha256:selection", tiedWith: [], candidates: [{ candidateId: "a", resultRank: 1, choiceBlocker: null }],
      chosen: { candidateId: "a", name: "Candidate a", successRate: 1 / 3, scored: 3, succeeded: 1, configurationId: null, policyRouteId: null,
        deploymentCompanies: [], relationship: null, evidenceUrl: null, relatedTeams: [], registryTeams: [],
        partnerBlockers: ["no_recorded_deployment_partner_for_configuration"] } } }} />);
  expect(screen.getByText("No recorded deployment partner for this configuration.")).toBeInTheDocument();
  expect(screen.queryByText(/robot team registry/)).toBeNull();
});

it("says plainly when a candidate waits to confirm its job can still run, never that the simulator is full", () => {
  const control = "Waiting to confirm this job can still run.";
  expect(screeningReasonLabel("beta_screening_waiting_for_control")).toBe(control);
  // The Pipeline adds the capacity code only so a return to preparing is accepted.
  expect(screeningReasonLabels(["beta_screening_waiting_for_capacity", "beta_screening_waiting_for_control"])).toEqual([control]);
  expect(screeningReasonLabels(["beta_screening_waiting_for_capacity"])).toEqual(["Waiting for room in our simulator."]);
  expect(screeningReasonLabels(["beta_screening_waiting_for_capacity", "beta_screening_unspent_invocation_recovery"]))
    .toContain("Waiting for room in our simulator.");
  expect(screeningReasonLabel("beta_screening_transport_retry_cap_exhausted"))
    .toBe("Not run: we could not confirm this job can still run. This is ours to fix.");
});

it("says a run that gave no usable result ran in our simulator, is ours to fix and runs again after the fix", () => {
  const noUsableResult = "Ran in our simulator, but the run returned no usable result. This is ours to fix, and it will run again after the fix.";
  for (const code of ["beta_screening_native_result_missing_or_invalid",
    "beta_screening_native_result_invalid", "g1_beta_native_result_missing_or_invalid", "policy_canary_session_setup_failed",
    "policy_canary_session_setup_failed:runtime_open", "policy_canary_session_setup_failed:observation_gate",
    "policy_canary_session_setup_failed:policy_load", "a_newer_native_result_code"]) {
    expect(screeningReasonLabel(code)).toBe(noUsableResult);
  }
  expect(screeningReasonLabel("beta_screening_held_after_launch_failure"))
    .toBe("Not run yet: it is waiting for a fix to another run in this evaluation first. This is ours to fix.");
  expect(screeningReasonLabel("beta_screening_control_unavailable_timeout"))
    .toBe("Stopped: we could not confirm in time that this job could still run. This is ours to fix.");
  expect(screeningReasonLabel("beta_screening_authority_expired"))
    .toBe("Stopped: the time allowed for this job's simulation ran out before it finished.");
  // The untyped fallback for a closed run with no result is not planned again by itself: no retry promise.
  expect(screeningReasonLabel("beta_screening_native_result_missing"))
    .toBe("Ran in our simulator, but the run returned no usable result. This is ours to fix.");
  // A candidate that ran is never described as one that was not set up.
  expect(screeningReasonLabels(["beta_screening_native_result_missing_or_invalid", "beta_screening_native_result_missing"]))
    .toEqual([noUsableResult, "Ran in our simulator, but the run returned no usable result. This is ours to fix."]);
});

it("lists the candidates that took part and folds the ones that did not run behind one toggle", () => {
  render(<PolicyScreeningCandidates screening={{ candidates: [row("a", "completed", 1), row("b", "pending"), row("c", "running"),
    row("d", "deferred", 0, ["site_screening_budget_insufficient"]), row("e", "infeasible", 0, ["candidate_infeasible_measured_geometry"]),
    row("f", "blocked", 0, ["task_kind_not_supported_by_candidate"]), row("g", "unavailable")] }} />);
  const table = screen.getByRole("table", { name: "Candidates evaluated for your job" });
  const names = () => within(table).getAllByRole("row").slice(1).map(value => value.firstElementChild?.textContent);
  expect(names()).toEqual(["Candidate a", "Candidate b", "Candidate c"]);
  const toggle = screen.getByRole("button", { name: "Show the 4 candidates that did not run, and why" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect(toggle).toHaveTextContent("Hide the 4 candidates that did not run, and why");
  expect(names()).toEqual(["Candidate a", "Candidate b", "Candidate c", "Candidate d", "Candidate e", "Candidate f", "Candidate g"]);
  // Each folded row still says why, in plain words.
  expect(within(table).getByText("Candidate e")).toBeVisible();
  expect(within(table).getByText("Measured out of reach from the robot position planned in your scene.")).toBeInTheDocument();
  fireEvent.click(toggle);
  expect(names()).toHaveLength(3);
});

it("lists every candidate, with no toggle, when none took part: the reasons are the whole result", () => {
  render(<PolicyScreeningCandidates screening={{ candidates: [row("a", "infeasible", 0, ["candidate_infeasible_measured_geometry"]),
    row("b", "blocked", 0, ["task_kind_not_supported_by_candidate"])] }} />);
  expect(screen.getAllByRole("row").slice(1).map(value => value.firstElementChild?.textContent)).toEqual(["Candidate a", "Candidate b"]);
  expect(screen.queryByRole("button", { name: /did not run/ })).toBeNull();
});

it("keeps a candidate whose tries all ended unscorable among those that took part", () => {
  render(<PolicyScreeningCandidates screening={{ candidates: [{ ...row("a", "completed"), scored: 0, failed: 0, void: 10 },
    row("b", "deferred")] }} />);
  expect(screen.getAllByRole("row").slice(1).map(value => value.firstElementChild?.textContent)).toEqual(["Candidate a"]);
  expect(screen.getByText("0 succeeded · 0 failed · 10 unscorable")).toBeVisible();
});
