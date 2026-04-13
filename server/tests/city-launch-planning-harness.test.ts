// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildCritiquePrompt,
  buildSynthesisPrompt,
  slugifyCityName,
} from "../utils/cityLaunchPlanningHarness";

describe("city launch planning harness", () => {
  it("slugifies city names for artifact paths", () => {
    expect(slugifyCityName("Austin, TX")).toBe("austin-tx");
    expect(slugifyCityName("San Francisco, CA")).toBe("san-francisco-ca");
  });

  it("builds a critique prompt that audits Blueprint-specific risks", () => {
    const prompt = buildCritiquePrompt("Initial research body");
    expect(prompt).toContain("Blueprint's launch-strategy critique agent");
    expect(prompt).toContain("rights, provenance, privacy, or hosted proof");
    expect(prompt).toContain("Unsupported or weak analogies");
  });

  it("builds a synthesis prompt that requires an operator-ready playbook", () => {
    const prompt = buildSynthesisPrompt({
      city: "Austin, TX",
      research: "Research body",
      critiqueOutputs: ["Critique 1", "Critique 2"],
    });
    expect(prompt).toContain("single operator-ready city launch playbook");
    expect(prompt).toContain("Human vs agent ownership model");
    expect(prompt).toContain("What not to say publicly yet");
    expect(prompt).toContain("Structured launch data appendix");
    expect(prompt).toContain("```city-launch-records");
  });
});
