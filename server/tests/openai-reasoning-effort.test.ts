/**
 * Which model thinks how hard.
 *
 * `reasoning.effort` is a request parameter, not part of the model id, so the
 * model and the effort are two separate decisions. These pin both, because the
 * adapter used to hardcode "medium" and a lane could not be tuned without
 * editing it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = [
  "OPENAI_REASONING_EFFORT",
  "OPENAI_INBOUND_QUALIFICATION_REASONING_EFFORT",
  "OPENAI_DEFAULT_MODEL",
  "OPENAI_INBOUND_QUALIFICATION_MODEL",
];

beforeEach(() => {
  vi.resetModules();
  for (const key of ENV_KEYS) delete process.env[key];
});
afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("reasoning effort", () => {
  it("thinks hardest on the lane that decides whether a site moves forward", async () => {
    const { getOpenAiReasoningEffort } = await import("../agents/provider-config");
    expect(getOpenAiReasoningEffort("inbound_qualification")).toBe("max");
  });

  it("leaves every other lane where the adapter already had it", async () => {
    const { getOpenAiReasoningEffort } = await import("../agents/provider-config");
    expect(getOpenAiReasoningEffort("support_triage")).toBe("medium");
    expect(getOpenAiReasoningEffort("waitlist_triage")).toBe("medium");
    expect(getOpenAiReasoningEffort(undefined)).toBe("medium");
  });

  it("takes a global override", async () => {
    process.env.OPENAI_REASONING_EFFORT = "high";
    vi.resetModules();
    const { getOpenAiReasoningEffort } = await import("../agents/provider-config");
    expect(getOpenAiReasoningEffort("support_triage")).toBe("high");
  });

  it("lets a per-lane override beat the global one", async () => {
    process.env.OPENAI_REASONING_EFFORT = "low";
    process.env.OPENAI_INBOUND_QUALIFICATION_REASONING_EFFORT = "xhigh";
    vi.resetModules();
    const { getOpenAiReasoningEffort } = await import("../agents/provider-config");
    expect(getOpenAiReasoningEffort("inbound_qualification")).toBe("xhigh");
    expect(getOpenAiReasoningEffort("support_triage")).toBe("low");
  });

  it("ignores a value the API would reject rather than sending it", async () => {
    process.env.OPENAI_REASONING_EFFORT = "ludicrous";
    vi.resetModules();
    const { getOpenAiReasoningEffort } = await import("../agents/provider-config");
    expect(getOpenAiReasoningEffort("support_triage")).toBe("medium");
  });
});

describe("model selection", () => {
  it("defaults OpenAI lanes to the 5.6 Luna variant", async () => {
    const { getTaskModelByProvider } = await import("../agents/provider-config");
    expect(getTaskModelByProvider("inbound_qualification").openai_responses).toBe(
      "gpt-5.6-luna",
    );
  });

  it("still honours a per-lane model override", async () => {
    process.env.OPENAI_INBOUND_QUALIFICATION_MODEL = "gpt-5.6-sol";
    vi.resetModules();
    const { getTaskModelByProvider } = await import("../agents/provider-config");
    expect(getTaskModelByProvider("inbound_qualification").openai_responses).toBe(
      "gpt-5.6-sol",
    );
  });
});
