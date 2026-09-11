/**
 * The proposal barrier.
 *
 * The extraction task is the one place a model touches the registry, and it
 * only ever proposes. These tests pin the two things that make that safe: a
 * value outside the field's enum is discarded rather than stored, and the loop
 * targets teams whose hard constraints are actually unknown.
 */
import { describe, expect, it } from "vitest";

import {
  buildAllowedValues,
  needsRefresh,
  validateProposals,
} from "../utils/robotCapabilityRefresh";
import { assertPublicHttpsUrl, toReadableText } from "../utils/publicFetchGuard";
import type { RobotTeamRecord } from "../types/robot-team-registry";
import type { RobotCapabilityExtractionOutput } from "../agents/tasks/robot-capability-extraction";

function team(overrides: Partial<RobotTeamRecord> = {}): RobotTeamRecord {
  return {
    id: "team-a",
    name: "Example Robotics",
    status: "prospect",
    website: "https://example.com",
    capability: {},
    fieldProvenance: {},
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function output(
  proposals: RobotCapabilityExtractionOutput["proposals"],
): RobotCapabilityExtractionOutput {
  return { teamName: "Example Robotics", proposals, notFound: [], summary: "" };
}

const allowed = buildAllowedValues();

describe("allowed values come from the intake definitions", () => {
  it("covers the fields the matcher compares", () => {
    expect(allowed.payloadCapacity).toContain("ten_to_twentyfive");
    expect(allowed.humanProximity).toContain("shared");
    expect(allowed.deploymentGeography?.length).toBeGreaterThan(0);
  });
});

describe("proposal validation", () => {
  it("accepts a legal value and carries the quote with the source", () => {
    const proposals = validateProposals(
      output([
        {
          field: "payloadCapacity",
          value: "ten_to_twentyfive",
          grade: "published",
          source: "https://example.com/specs",
          quote: "Maximum payload: 18 kg",
          rationale: "Spec table states 18 kg.",
          confidence: 0.9,
        },
      ]),
      allowed,
      team(),
      "run-1",
    );

    expect(proposals).toHaveLength(1);
    // A reviewer can check the claim without opening the page.
    expect(proposals[0].source).toContain("Maximum payload: 18 kg");
    expect(proposals[0].currentValue).toBeNull();
    expect(proposals[0].proposedValue).toBe("ten_to_twentyfive");
  });

  it("discards a value the field's enum does not contain", () => {
    const proposals = validateProposals(
      output([
        {
          field: "payloadCapacity",
          // Plausible, and unreadable by any comparison in the matcher.
          value: "18kg",
          grade: "published",
          source: "https://example.com/specs",
          quote: "18 kg",
          rationale: "",
          confidence: 0.95,
        },
      ]),
      allowed,
      team(),
      "run-1",
    );
    expect(proposals).toHaveLength(0);
  });

  it("does not propose what the registry already holds", () => {
    const proposals = validateProposals(
      output([
        {
          field: "payloadCapacity",
          value: "ten_to_twentyfive",
          grade: "published",
          source: "https://example.com/specs",
          quote: "18 kg",
          rationale: "",
          confidence: 0.9,
        },
      ]),
      allowed,
      team({ capability: { payloadCapacity: "ten_to_twentyfive" } }),
      "run-1",
    );
    // A queue full of no-ops trains a reviewer to click through it.
    expect(proposals).toHaveLength(0);
  });

  it("keeps the model's grade rather than promoting it", () => {
    const proposals = validateProposals(
      output([
        {
          field: "humanProximity",
          value: "shared",
          grade: "inferred",
          source: "https://example.com/blog",
          quote: "works alongside our team",
          rationale: "Marketing copy, not a rating.",
          confidence: 0.4,
        },
      ]),
      allowed,
      team(),
      "run-1",
    );
    expect(proposals[0].grade).toBe("inferred");
  });
});

describe("refresh targeting", () => {
  it("targets a team whose hard constraints are unknown", () => {
    expect(needsRefresh(team())).toBe(true);
  });

  it("targets a team whose hard constraints are only inferred", () => {
    const inferred = team({
      capability: {
        payloadCapacity: "two_to_ten",
        humanProximity: "nearby",
        budgetBand: "fifty_to_250k",
        deploymentGeography: "austin_metro",
      },
      fieldProvenance: {
        payloadCapacity: {
          grade: "inferred",
          source: "https://example.com",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
        humanProximity: {
          grade: "self_reported",
          source: "inboundRequest:r",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
        budgetBand: {
          grade: "self_reported",
          source: "inboundRequest:r",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
        deploymentGeography: {
          grade: "self_reported",
          source: "inboundRequest:r",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
      },
    });
    expect(needsRefresh(inferred)).toBe(true);
  });

  it("leaves a team alone once its hard constraints are properly sourced", () => {
    const known = team({
      capability: {
        payloadCapacity: "two_to_ten",
        humanProximity: "nearby",
        budgetBand: "fifty_to_250k",
        deploymentGeography: "austin_metro",
      },
      fieldProvenance: Object.fromEntries(
        ["payloadCapacity", "humanProximity", "budgetBand", "deploymentGeography"].map(
          (field) => [
            field,
            {
              grade: "self_reported" as const,
              source: "inboundRequest:r",
              observedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        ),
      ),
    });
    expect(needsRefresh(known)).toBe(false);
  });
});

describe("fetch guard", () => {
  it("refuses anything that is not a public https URL", () => {
    expect(() => assertPublicHttpsUrl("https://example.com/specs")).not.toThrow();
    expect(() => assertPublicHttpsUrl("http://example.com")).toThrow(/https/i);
    expect(() => assertPublicHttpsUrl("https://169.254.169.254/latest")).toThrow(
      /public host/i,
    );
    expect(() => assertPublicHttpsUrl("https://user:pw@example.com")).toThrow(
      /credentials/i,
    );
    expect(() => assertPublicHttpsUrl("https://localhost:8080")).toThrow(/public host/i);
  });

  it("strips markup down to the words", () => {
    const text = toReadableText(
      "<html><style>.a{}</style><body><h1>Specs</h1><p>Payload: 18&nbsp;kg</p><script>x()</script></body></html>",
    );
    expect(text).toBe("Specs Payload: 18 kg");
  });
});
