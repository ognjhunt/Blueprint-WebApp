// @vitest-environment node
import { describe, expect, it } from "vitest";

import { taskDefinitions } from "../agents/tasks";
import type { AgentTaskKind } from "../agents/types";

const sampleInputs: Record<AgentTaskKind, unknown> = {
  waitlist_triage: {
    submission: {
      id: "waitlist-1",
      email: "capturer@example.com",
      market: "Durham, NC",
      device: "iPhone",
    },
    market_context: {
      sameMarketCount: 1,
      sameMarketDeviceCount: 1,
      sameMarketPendingCount: 0,
      sameRoleCount: 1,
      recentExamples: [],
    },
  },
  inbound_qualification: {
    requestId: "req-1",
    priority: "normal",
    buyerType: "robot_team",
    requestedLanes: ["hosted_review"],
    budgetBucket: "pilot",
    company: "Example Robotics",
    siteName: "Example Site",
    siteLocation: "Durham, NC",
    taskStatement: "Evaluate an exact-site hosted review.",
  },
  post_signup_scheduling: {
    blueprintId: "bp-1",
    companyName: "Example Robotics",
    address: "1 Main St",
  },
  support_triage: {
    id: "support-1",
    email: "buyer@example.com",
    message: "I need help with hosted review access.",
  },
  payout_exception_triage: {
    id: "payout-1",
    status: "failed",
    failure_reason: "stripe_error",
  },
  preview_diagnosis: {
    requestId: "preview-1",
    failure_reason: "provider_timeout",
  },
  operator_thread: {
    message: "Summarize the current agent runtime.",
    context: { issue: "BLU-1" },
  },
  external_harness_thread: {
    message: "Run the bounded check.",
    harness: "codex",
    context: { issue: "BLU-2" },
  },
};

describe("agent task prompts", () => {
  it("keeps stable policy and return schema before dynamic JSON payloads", () => {
    for (const [kind, definition] of Object.entries(taskDefinitions) as Array<
      [AgentTaskKind, (typeof taskDefinitions)[AgentTaskKind]]
    >) {
      const prompt = definition.build_prompt(sampleInputs[kind] as never);
      const payloadIndex = prompt.lastIndexOf("Dynamic payload:");
      const returnShapeIndex = prompt.lastIndexOf("Return JSON");

      expect(payloadIndex, `${kind} should label the final dynamic payload`).toBeGreaterThan(0);
      expect(returnShapeIndex, `${kind} should define return shape before payload`).toBeGreaterThan(0);
      expect(returnShapeIndex, `${kind} should place return shape before payload`).toBeLessThan(payloadIndex);
      expect(JSON.parse(prompt.slice(payloadIndex + "Dynamic payload:".length).trim())).toEqual(sampleInputs[kind]);
    }
  });

  it("serializes dynamic payload object keys deterministically for prompt-cache reuse", async () => {
    const { buildCacheFriendlyPrompt } = await import("../agents/tasks/prompt-cache");

    const first = buildCacheFriendlyPrompt({
      instructions: "Stable instructions.",
      returnShape: {
        z: "",
        a: "",
      },
      payload: {
        z: 1,
        nested: {
          b: 2,
          a: 1,
        },
        a: 0,
      },
    });
    const second = buildCacheFriendlyPrompt({
      instructions: "Stable instructions.",
      returnShape: {
        a: "",
        z: "",
      },
      payload: {
        a: 0,
        nested: {
          a: 1,
          b: 2,
        },
        z: 1,
      },
    });

    expect(first).toBe(second);
    expect(first).toContain('"a": 0');
    expect(first.indexOf('"a": 0')).toBeLessThan(first.indexOf('"nested"'));
    expect(first.indexOf('"a": 1')).toBeLessThan(first.indexOf('"b": 2'));
  });
});
