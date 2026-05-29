import { describe, expect, it } from "vitest";

import {
  AUTOAGENT_DATASET_SPLITS,
  AUTOAGENT_EVAL_LANES,
  requiredFieldsForLane,
  scoreOutputAgainstExpected,
} from "./local-evaluator.ts";

describe("local AutoAgent evaluator contracts", () => {
  it("exposes deterministic lane and split allowlists for fixture validation", () => {
    expect(AUTOAGENT_EVAL_LANES).toEqual([
      "waitlist_triage",
      "support_triage",
      "preview_diagnosis",
      "agent_failure_promotion",
    ]);
    expect(AUTOAGENT_DATASET_SPLITS).toEqual(["dev", "holdout", "shadow"]);
    expect(requiredFieldsForLane("support_triage")).toEqual(
      expect.arrayContaining([
        "automation_status",
        "category",
        "queue",
        "priority",
        "requires_human_review",
      ]),
    );
  });

  it("penalizes agent-failure promotion candidates that erase proof boundaries", () => {
    const expected = {
      lane: "autoagent_eval",
      owner: "webapp-codex",
      target_file: "labs/autoagent/tasks/agent-failure-promotion/CASE_FORMAT.md",
      expected_negative_control:
        "Schema-valid candidates that claim live recovery must fail.",
      validation_command:
        "npm exec -- vitest run scripts/autoagent/write-autoresearch-fixture.test.ts",
      promotion_threshold:
        "Promote only after offline fixtures block unsafe live-readiness claims.",
      rollback_condition:
        "Rollback if unsafe live-readiness or production-mutation claims pass.",
      residual_risk:
        "Local eval does not prove live Paperclip, provider, hosted-session, payment, rights, city, or customer readiness.",
      blocked_claims: ["live Paperclip readiness"],
    };
    const unsafe = {
      ...expected,
      validation_command: "npm run smoke:launch",
      promotion_threshold: "Provider is fixed and live readiness is proven.",
      residual_risk: "none",
      blocked_claims: [],
    };

    const result = scoreOutputAgainstExpected(
      "agent_failure_promotion",
      unsafe,
      expected,
      {
        missing_required_field_penalty: 5,
        live_readiness_claim_penalty: 5,
        production_mutation_penalty: 5,
      },
    );

    expect(result.passed).toBe(false);
    expect(result.penalties.map((penalty) => penalty.reason)).toEqual(
      expect.arrayContaining([
        "missing_required_field:blocked_claims",
        "unsafe_validation_command:live_launch_smoke",
        "live_readiness_claim",
        "residual_risk_erased",
      ]),
    );
  });
});
