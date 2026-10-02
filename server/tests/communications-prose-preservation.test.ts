// @vitest-environment node
import { describe, expect, it } from "vitest";
import { communicationsFixture } from "./fixtures/communications";
import { CommunicationsOutputValidationError, outputTextDigest, parseCommunicationsOutput } from "../agents/communications-output";

describe("communication reasoning is retained without an arbitrary prose quota", () => {
  it.each([1201, 7301, 20000])("preserves a %i-character explanation and inert metadata", length => {
    const { output } = communicationsFixture();
    output.reason = "Evidence and uncertainty remain explicit. ".repeat(length).slice(0, length - 1) + ".";
    const raw = JSON.stringify({ ...output, diagnostic: { source: "synthetic evidence", approved: true } });
    const digest = outputTextDigest(raw);
    const parsed = parseCommunicationsOutput(raw, digest);
    expect(parsed.output).toEqual(output);
    expect(parsed.output.requiresHumanReview).toBe(true);
    expect(parsed.normalizedMetadataPaths).toEqual(["/diagnostic"]);
    expect(outputTextDigest(raw)).toBe(digest);
    expect(JSON.parse(raw).diagnostic).toEqual({ source: "synthetic evidence", approved: true });
  });
  it("still exposes an actionable error for missing reasoning or removed human review", () => {
    const { output } = communicationsFixture();
    for (const changed of [{ ...output, reason: "" }, { ...output, requiresHumanReview: false }]) {
      try { parseCommunicationsOutput(JSON.stringify(changed)); throw new Error("unexpected acceptance"); }
      catch (error) {
        expect(error).toBeInstanceOf(CommunicationsOutputValidationError);
        expect((error as CommunicationsOutputValidationError).validationIssues).toEqual(expect.arrayContaining([
          expect.objectContaining({ path: changed.reason === "" ? "/reason" : "/requiresHumanReview" }),
        ]));
      }
    }
  });
});
