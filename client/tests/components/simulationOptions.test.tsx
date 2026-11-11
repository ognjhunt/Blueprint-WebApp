/**
 * The simulation test leads the answer: options are robot + AI software, compared across robots, in one display
 * order, with "did best" and "was ahead" only from the probability rule. Seeded generated inputs.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteAnswer, SiteAnswerDetail } from "@/components/site/SiteAnswer";
import { AHEAD, CLEAR, probabilityAhead, projectSimulationProof, testResultOf } from "@/lib/simulationProof";
import { SIMULATION_POLICIES } from "@/data/simulationPolicies";
import type { JobManagedEvidenceSummary } from "@/types/jobMarketplace";
import { readyAnswer, serverOutlookFor } from "../fixtures/siteAnswer";

vi.mock("@/lib/csrf", () => ({ withCsrfHeader: async (headers: Record<string, string>) => headers }));

type Candidate = NonNullable<JobManagedEvidenceSummary["screening"]>["candidates"][number];
const MAPPED = Object.keys(SIMULATION_POLICIES);
const LADDER = ["approached", "contact", "moved", "lifted", "translated", "placed", "released_and_settled"] as const;
const LEARNED: Candidate["executionEvidence"] = { execution_evidence_kind: "learned_policy", action_source: "learned_policy",
  scripted_rollout_count: 0, learned_policy_rollout_count: 10, scripted_controller_invoked: false, candidate_policy_queried: true };
const SCRIPTED: Candidate["executionEvidence"] = { execution_evidence_kind: "scripted_simulator_state_baseline", action_source: "scripted_simulator_state",
  scripted_rollout_count: 10, learned_policy_rollout_count: 0, scripted_controller_invoked: true, candidate_policy_queried: false };

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function generated(random: () => number, index: number): { evaluation: JobManagedEvidenceSummary; kinds: Map<string, string> } {
  const int = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));
  const kinds = new Map<string, string>();
  const rows: Candidate[] = [];
  const references: string[] = [];
  const ids = [...MAPPED].sort(() => random() - 0.5).slice(0, int(0, 6));
  if (random() < 0.3) ids.push(`unmapped_${index}_a`);
  if (random() < 0.15) ids.push(`unmapped_${index}_b`);
  if (random() < 0.3) ids.push(`scripted_${index}`);
  for (const id of ids) {
    // An unmapped row is an option only with learned-policy evidence; without it ("unknown") it never is.
    const kind = id.startsWith("scripted") ? "scripted" : random() < 0.1 ? "reference"
      : id.startsWith("unmapped") ? (random() < 0.5 ? "unmapped" : "unknown") : "option";
    kinds.set(id, kind);
    const scored = random() < 0.15 ? 0 : int(1, 12);
    const succeeded = random() < 0.4 ? 0 : int(0, scored);
    const graded = scored;
    const counts: number[] = [];
    let previous = graded;
    for (let stage = 0; stage < LADDER.length; stage++) { previous = random() < 0.5 ? int(0, previous) : 0; counts.push(previous); }
    const progress = random() < 0.6 && graded > 0 ? { graded, meanScore: 0, stages: LADDER.map((stage, i) => ({ stage, episodes: counts[i] })),
      closestApproachM: { median: Number((random() * 0.3).toFixed(4)), min: 0 } } : undefined;
    rows.push({ candidateId: id, name: `stored name ${id}`, state: scored > 0 ? "completed" : "deferred", planned: 10, scored, succeeded,
      failed: scored - succeeded, void: 0, blockers: [], ...(progress ? { progress: progress as never } : {}),
      // Scripted rows sometimes carry no execution kind at all (an older publication): the id still marks them.
      ...(kind === "scripted" && random() < 0.5 ? { executionEvidence: SCRIPTED } : {}),
      ...(kind === "unmapped" ? { executionEvidence: LEARNED } : {}) } as Candidate);
    if (kind === "reference") references.push(id);
  }
  return { kinds, evaluation: { runId: `run-${index}`, state: "completed", current: true, resultDigest: null, outcome: "estimate", summary: "",
    nextAction: "", limitations: [], href: "#", ...(random() < 0.2 ? { outcomeCaveat: "scene_setup" as const } : {}),
    screening: { candidates: rows, ...(references.length ? { selection: { status: "chosen", selectionDigest: `sha256:${"a".repeat(64)}`, tiedWith: [],
      chosen: null, candidates: references.map(candidateId => ({ candidateId, resultRank: null, choiceBlocker: "development_only_reference" })) } as never } : {}) } } };
}

describe("the simulation test's options", () => {
  it("holds over many generated runs: who is an option, the order, the winner rule, and what the screen says", () => {
    const random = mulberry32(20261111);
    const seen = { winners: 0, none: 0, noClear: 0, one: 0, empty: 0 };
    for (let index = 0; index < 400; index++) {
      const { evaluation, kinds } = generated(random, index);
      const proof = projectSimulationProof({ evaluation: [evaluation], pick: readyAnswer.pick });
      const { options, winner } = proof.options;
      const label = `run ${index}`;
      // Every scored row positively identified as a learned AI policy is an option (in the closed map, or with
      // learned-policy evidence); never a scripted, reference or unidentified row, whatever it scored.
      for (const option of options) {
        expect(["option", "unmapped"], label).toContain(kinds.get(option.id));
        expect(option.scored, label).toBeGreaterThan(0);
        if (kinds.get(option.id) === "option") expect(option.label, label).toBe(`${SIMULATION_POLICIES[option.id].robot.short} + ${SIMULATION_POLICIES[option.id].policy}`);
        else expect(option.label, label).toMatch(/^AI robot [A-Z]+$/);
      }
      const learnedScored = evaluation.screening!.candidates.filter(row => ["option", "unmapped"].includes(kinds.get(row.candidateId)!) && row.scored > 0);
      expect(options.length, label).toBe(learnedScored.length);
      expect(proof.options.unidentified, label).toBe(evaluation.screening!.candidates.filter(row => kinds.get(row.candidateId) === "unknown" && row.scored > 0).length);
      // The headline is consistent with every scored learned row in the data: none is better by the order, and
      // "none finished" only when no scored learned row finished the job.
      const anyFinished = learnedScored.some(row => row.succeeded > 0);
      const resultNow = testResultOf(proof);
      if (resultNow && "top" in resultNow) {
        const best = (row: { succeeded: number; scored: number }) => (row.succeeded + 1) / (row.scored + 2);
        if (resultNow.top.succeeded > 0) for (const row of learnedScored.filter(row => row.succeeded > 0)) expect(best(resultNow.top), label).toBeGreaterThanOrEqual(best(row) - 1e-12);
        expect(resultNow.kind === "none_finished", label).toBe(!anyFinished);
      }
      // The display order: options that completed the job first, by the mean success rate.
      const firstZero = options.findIndex(option => option.succeeded === 0);
      if (firstZero >= 0) expect(options.slice(firstZero).every(option => option.succeeded === 0), label).toBe(true);
      const mean = (option: { succeeded: number; scored: number }) => (option.succeeded + 1) / (option.scored + 2);
      for (let i = 1; i < (firstZero < 0 ? options.length : firstZero); i++) expect(mean(options[i - 1]), label).toBeGreaterThanOrEqual(mean(options[i]));
      // The winner rule, recomputed: row 1 against every other option, with at least one success.
      const top = options[0];
      const chance = top && options.length > 1 && top.succeeded > 0 ? Math.min(...options.slice(1).map(option => probabilityAhead(top, option))) : 0;
      expect(winner, label).toBe(chance >= CLEAR - 1e-6 ? "did_best" : chance >= AHEAD - 1e-6 ? "was_ahead" : null);
      if (winner) expect(top.succeeded, label).toBeGreaterThan(0);
      // The answer screen names row 1, with its own counts; a zero-success option is never called best or ahead.
      const result = testResultOf(proof);
      const { container, unmount } = render(<SiteAnswer token="t" answer={readyAnswer} proof={proof} outlook={serverOutlookFor(readyAnswer, proof)} />);
      const text = container.textContent!;
      if (!options.length) { expect(result, label).toBeNull(); seen.empty++; }
      else {
        expect(result && "top" in result ? result.top : null, label).toBe(top);
        if (result!.kind === "winner") {
          seen.winners++;
          expect(text, label).toContain(top.label);
          expect(text, label).toContain(`Did your job in ${top.succeeded} of ${top.scored} ${top.scored === 1 ? "try" : "tries"}`);
          expect(text, label).toContain(winner === "did_best" ? "Did best on your job" : "Was ahead on your job");
        } else expect(text, label).not.toMatch(/Did best on your job|Was ahead on your job/);
        if (result!.kind === "none_finished") seen.none++;
        if (result!.kind === "no_clear_winner") seen.noClear++;
        if (result!.kind === "one_option") seen.one++;
        for (const option of options) if (option.succeeded === 0) {
          expect(text.includes(`${option.label}, doing`) || (result!.kind === "winner" && result!.top === option), label).toBe(false);
        }
      }
      unmount();
      // The ranked list says each option once, in the same order, with its counts.
      if (options.length) {
        const list = render(<SiteAnswerDetail answer={readyAnswer} proof={proof} screen="test" onBack={() => {}} />);
        const rows = [...list.container.querySelectorAll("dt")].map(node => node.textContent ?? "");
        options.forEach((option, i) => expect(rows[i], label).toContain(`${i + 1}. ${option.label}`));
        for (const row of [...list.container.querySelectorAll(".bare-row")]) {
          if (/^\d+\. /.test(row.querySelector("dt")?.textContent ?? "")) {
            const option = options[Number(row.querySelector("dt")!.textContent!.split(".")[0]) - 1];
            expect(row.textContent, label).toContain(`Finished ${option.succeeded} of ${option.scored}`);
          }
        }
        expect(list.container.textContent, label).not.toMatch(/stored name/);
        list.unmount();
      }
    }
    for (const [key, value] of Object.entries(seen)) expect(value, key).toBeGreaterThan(5);
  }, 120_000);
});
