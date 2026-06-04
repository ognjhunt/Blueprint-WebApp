import { describe, expect, it } from "vitest";
import {
  representativeRobotEvalSites,
  robotEvalDecisionOptions,
  robotEvalMoatWorkflowSteps,
} from "@/data/robotEvalMoat";

describe("robotEvalMoat data", () => {
  it("covers the representative real-site robot eval environments", () => {
    expect(representativeRobotEvalSites.map((site) => site.environment)).toEqual([
      "warehouse",
      "factory",
      "hospital",
      "retail",
      "cold_chain",
      "service",
    ]);
  });

  it("keeps the buyer workflow ordered around artifact evidence", () => {
    expect(robotEvalMoatWorkflowSteps.map((step) => step.id)).toEqual([
      "choose_site",
      "choose_task",
      "choose_scenario_family",
      "submit_policy_or_trace",
      "inspect_eval_report",
      "decide_next_step",
    ]);
    expect(robotEvalDecisionOptions.map((option) => option.id)).toEqual([
      "pilot",
      "tune",
      "hold",
    ]);
  });

  it("labels generated reports and rights artifacts as advisory or blocked", () => {
    for (const site of representativeRobotEvalSites) {
      expect(site.tasks.length).toBeGreaterThan(0);
      expect(site.scenarioFamilies.length).toBeGreaterThan(0);
      expect(site.artifacts.map((artifact) => artifact.fileName)).toEqual(
        expect.arrayContaining([
          "rights_packet.json",
          "rights_ledger.json",
          "task_ontology_v1.json",
          "scenario_family_library.json",
          "scoring_methodology.json",
          "policy_eval_report.json",
          "prediction_vs_actual_summary.json",
        ]),
      );
      expect(site.artifacts.find((artifact) => artifact.id === "rights_packet")?.status).toBe(
        "blocked_until_rights_review",
      );
      expect(site.evalReport.some((metric) => metric.status === "blocked")).toBe(true);
    }
  });
});
