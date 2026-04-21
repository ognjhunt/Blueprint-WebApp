// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  buildGeminiDeepResearchAgentConfig,
  GEMINI_DEEP_RESEARCH_LEGACY_AGENT,
  GEMINI_DEEP_RESEARCH_MAX_AGENT,
  GEMINI_DEEP_RESEARCH_STANDARD_AGENT,
  resolveGeminiDeepResearchAgent,
} from "../utils/geminiInteractions";

afterEach(() => {
  delete process.env.BLUEPRINT_DEEP_RESEARCH_AGENT;
  delete process.env.BLUEPRINT_CITY_LAUNCH_DEEP_RESEARCH_AGENT;
});

describe("gemini deep research helpers", () => {
  it("defaults to Deep Research Max and maps legacy ids safely", () => {
    expect(resolveGeminiDeepResearchAgent()).toBe(GEMINI_DEEP_RESEARCH_MAX_AGENT);
    expect(
      resolveGeminiDeepResearchAgent({
        explicitAgent: GEMINI_DEEP_RESEARCH_LEGACY_AGENT,
      }),
    ).toBe(GEMINI_DEEP_RESEARCH_MAX_AGENT);
    expect(
      resolveGeminiDeepResearchAgent({
        explicitAgent: "max",
      }),
    ).toBe(GEMINI_DEEP_RESEARCH_MAX_AGENT);
    expect(
      resolveGeminiDeepResearchAgent({
        explicitAgent: "standard",
      }),
    ).toBe(GEMINI_DEEP_RESEARCH_STANDARD_AGENT);
  });

  it("builds the expected default Deep Research agent config", () => {
    expect(buildGeminiDeepResearchAgentConfig()).toEqual({
      type: "deep-research",
      thinking_summaries: "auto",
      visualization: "auto",
      collaborative_planning: false,
    });
  });
});
