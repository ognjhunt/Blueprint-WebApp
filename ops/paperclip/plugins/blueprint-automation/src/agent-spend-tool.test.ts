// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildAgentSpendToolContent,
  parseAgentSpendToolParams,
} from "./agent-spend-tool.js";

describe("agent spend Paperclip tool helpers", () => {
  it("parses tool params into a governed spend request", () => {
    const input = parseAgentSpendToolParams(
      {
        city: "Austin, TX",
        amountUsd: "25",
        category: "tools",
        vendorName: "Stripe",
        purpose: "Create test payment rail",
        issueId: "BLU-300",
        evidenceRefs: "ops/run.json,docs/policy.md",
        provider: "manual",
      },
      "agent-1",
    );

    expect(input).toMatchObject({
      city: "Austin, TX",
      amountUsd: 25,
      category: "tools",
      vendorName: "Stripe",
      requestedByAgent: "agent-1",
      provider: "manual",
    });
    expect(input.evidenceRefs).toEqual(["ops/run.json", "docs/policy.md"]);
  });

  it("rejects unsupported categories before hitting the ledger", () => {
    expect(() =>
      parseAgentSpendToolParams(
        {
          city: "Austin, TX",
          amountUsd: 25,
          category: "unknown",
          vendorName: "Stripe",
          purpose: "Create test payment rail",
        },
        "agent-1",
      ),
    ).toThrow("Unsupported spend category");
  });

  it("summarizes founder-gated tool results without credentials", () => {
    const record = {
      id: "spend-1",
      amountUsd: 25,
      vendorName: "Stripe",
      provider: "manual",
      status: "requires_founder_approval",
    };

    expect(buildAgentSpendToolContent(record)).toContain("requires founder approval");
    expect(buildAgentSpendToolContent(record)).not.toContain("credential");
  });
});
