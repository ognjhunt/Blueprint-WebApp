// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  PAPERCLIP_GOAL_CLOSEOUT_REQUIRED_FIELDS,
  validatePaperclipGoalCloseoutPacket,
} from "../agents/goal-closeout-contract";

function buildValidCloseout(overrides: Partial<Record<string, string>> = {}) {
  const values: Record<string, string> = {
    "Goal objective:": "Build a local deterministic validator.",
    "Issue/run id:": "local-goal-closeout-validator",
    "Budget/timeout context:": "not supplied; local Codex goal packet",
    "Stage reached:": "verification",
    "State claimed:": "done",
    "Owner:": "webapp-codex",
    "Blocker/decision id:": "none",
    "Proof paths:": "server/agents/goal-closeout-contract.ts",
    "Command outputs:": "npm exec -- vitest run server/tests/goal-closeout-validator.test.ts",
    "Next action:": "none",
    "Retry/resume condition:": "rerun validator tests after contract edits",
    "Residual risk:": "local validator does not prove live Paperclip issue closure",
    ...overrides,
  };

  return PAPERCLIP_GOAL_CLOSEOUT_REQUIRED_FIELDS.map((field) => `${field} ${values[field]}`).join("\n");
}

describe("Paperclip goal closeout packet validator", () => {
  it("accepts a closeout packet with all required labels and an allowed state", () => {
    const result = validatePaperclipGoalCloseoutPacket(buildValidCloseout());

    expect(result).toMatchObject({
      valid: true,
      stateClaimed: "done",
      missingRequiredFields: [],
      errors: [],
    });
  });

  it("rejects closeout packets missing required labels", () => {
    const packet = buildValidCloseout()
      .replace(/^Owner:.*\n/m, "")
      .replace(/^Proof paths:.*\n/m, "");

    const result = validatePaperclipGoalCloseoutPacket(packet);

    expect(result.valid).toBe(false);
    expect(result.missingRequiredFields).toEqual(["Owner:", "Proof paths:"]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing_required_field",
          field: "Owner:",
        }),
        expect.objectContaining({
          code: "missing_required_field",
          field: "Proof paths:",
        }),
      ]),
    );
  });

  it("rejects a closeout packet with an unsupported state claim", () => {
    const result = validatePaperclipGoalCloseoutPacket(
      buildValidCloseout({
        "State claimed:": "completed",
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.stateClaimed).toBeUndefined();
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "invalid_state_claim",
        field: "State claimed:",
        value: "completed",
      }),
    );
  });

  it("rejects ambiguous closeout packets with multiple state claims", () => {
    const result = validatePaperclipGoalCloseoutPacket(
      `${buildValidCloseout()}\nState claimed: blocked`,
    );

    expect(result.valid).toBe(false);
    expect(result.stateClaimed).toBeUndefined();
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        code: "ambiguous_state_claim",
        field: "State claimed:",
      }),
    );
  });
});
