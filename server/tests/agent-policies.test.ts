// @vitest-environment node
import { describe, expect, it } from "vitest";

import { requiresApproval } from "../agents/policies";
import type { AgentTask } from "../agents/types";

describe("agent approval policies", () => {
  it("requires approval for sensitive actions without preapproval", () => {
    const task: AgentTask = {
      kind: "operator_thread",
      input: { message: "Release the payout." },
    };

    const result = requiresApproval(task, {
      require_human_approval: false,
      sensitive_actions: ["payout"],
      allow_preapproval: false,
    });

    expect(result.required).toBe(true);
    expect(result.reason).toMatch(/payout/i);
  });

  it("allows explicitly approved runs to proceed", () => {
    const task: AgentTask = {
      kind: "operator_thread",
      input: { message: "Release the payout." },
      metadata: {
        approved: true,
      },
    };

    const result = requiresApproval(task, {
      require_human_approval: true,
      sensitive_actions: ["payout", "financial"],
      allow_preapproval: false,
    });

    expect(result.required).toBe(false);
    expect(result.reason).toBeNull();
  });
});
