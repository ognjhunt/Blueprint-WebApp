// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildExplicitOpenAIRequest,
  createPromptCachePolicy,
  conservativeOpenAIInputTokenCeiling,
  decidePromptCachePolicy,
  normalizeOpenAIUsage,
  worstCaseOpenAIReservationUsd,
} from "../utils/openaiPromptCache";

describe("OpenAI prompt cache policy", () => {
  it("enables reuse above break-even and disables one-off writes", () => {
    const repeated = decidePromptCachePolicy({
      model: "gpt-5.6-sol",
      stablePrefixTokens: 2_000,
      expectedReuseProbability: 0.28,
      expectedReuseCount: 1,
      ttlCompatible: true,
      privacyCompatible: true,
      explicitBreakpointAvailable: true,
    });
    const oneOff = decidePromptCachePolicy({
      model: "gpt-5.6-sol",
      stablePrefixTokens: 2_000,
      expectedReuseProbability: 0,
      expectedReuseCount: 0,
      ttlCompatible: true,
      privacyCompatible: true,
      explicitBreakpointAvailable: false,
    });

    expect(repeated.enabled).toBe(true);
    expect(repeated.economics.break_even_reuse_probability).toBeCloseTo(0.2777777778);
    expect(oneOff).toMatchObject({ enabled: false, reason: "explicit_stable_breakpoint_missing" });
  });

  it("derives a stable privacy-scoped key without run identifiers", () => {
    const base = {
      model: "gpt-5.6-sol",
      family: "operator_thread",
      contractVersion: "webapp-openai-v1",
      stablePrefix: "stable useful instructions ".repeat(800),
      stablePrefixTokens: 2_000,
      toolSchema: [{ name: "inspect" }],
      outputSchema: { type: "object" },
      reasoningEffort: "medium",
      privacyScope: "internal_scope",
      processingRegion: "us",
      expectedReuseCount: 1,
      expectedReuseProbability: 1,
      explicitBreakpointAvailable: true,
    };
    const first = createPromptCachePolicy(base);
    const same = createPromptCachePolicy(base);
    const changed = createPromptCachePolicy({ ...base, contractVersion: "webapp-openai-v2" });
    const changedParallel = createPromptCachePolicy({ ...base, parallelToolCalls: false });
    const changedContext = createPromptCachePolicy({
      ...base,
      contextManagement: { type: "compaction" },
    });

    expect(first.cache_key).toBe(same.cache_key);
    expect(first.cache_key).not.toBe(changed.cache_key);
    expect(first.cache_key).not.toBe(changedParallel.cache_key);
    expect(first.cache_key).not.toBe(changedContext.cache_key);
    expect(first.cache_key?.length).toBeLessThanOrEqual(64);
    expect(first.cache_key).not.toContain("internal_scope");
  });

  it("serializes explicit stable developer content before a dynamic user suffix", () => {
    const repeated = buildExplicitOpenAIRequest({
      model: "gpt-5.6-sol",
      taskKind: "operator_thread",
      dynamicPrompt: "run_id=unique timestamp=changing",
      tools: [{ type: "function", name: "inspect" }],
      expectedReuseCount: 1,
      expectedReuseProbability: 1,
    });
    const oneOff = buildExplicitOpenAIRequest({
      model: "gpt-5.6-sol",
      taskKind: "support_triage",
      dynamicPrompt: "one changing support request",
      expectedReuseCount: 0,
      expectedReuseProbability: 0,
    });

    expect(repeated.policy.status).toBe("enabled");
    expect(repeated.request).toMatchObject({
      store: false,
      prompt_cache_options: { mode: "explicit", ttl: "30m" },
      prompt_cache_key: repeated.policy.cache_key,
    });
    const repeatedInput = repeated.request.input as Array<Record<string, any>>;
    expect(repeatedInput.map((item) => item.role)).toEqual(["developer", "user"]);
    expect(repeatedInput[0].content[0].prompt_cache_breakpoint).toEqual({ mode: "explicit" });
    expect(repeatedInput[1].content).toContain("run_id=unique");
    expect(repeatedInput[1].content).not.toContain("prompt_cache_breakpoint");

    expect(oneOff.policy.status).toBe("disabled");
    expect(oneOff.request).toEqual({
      store: false,
      input: "one changing support request",
      prompt_cache_options: { mode: "explicit", ttl: "30m" },
    });
  });

  it("prices Sol write, read, ordinary input, output, and long context separately", () => {
    const standard = normalizeOpenAIUsage({
      id: "resp_1",
      usage: {
        input_tokens: 10_000,
        output_tokens: 100,
        input_tokens_details: { cached_tokens: 6_000, cache_write_tokens: 2_000 },
        output_tokens_details: { reasoning_tokens: 40 },
      },
    }, "gpt-5.6-sol");
    const long = normalizeOpenAIUsage({
      usage: {
        input_tokens: 300_000,
        output_tokens: 8_000,
        input_tokens_details: { cached_tokens: 0, cache_write_tokens: 2_000 },
      },
    }, "gpt-5.6-sol");

    expect(standard).toMatchObject({
      uncached_input_tokens: 2_000,
      uncached_input_cost_usd: 0.008,
      cache_write_cost_usd: 0.01,
      cached_read_cost_usd: 0.0024,
      output_cost_usd: 0.002,
      estimated_total_cost_usd: 0.0224,
    });
    expect(long.cache_write_cost_usd).toBeCloseTo(0.02);
    expect(long.output_cost_usd).toBeCloseTo(0.24);
  });

  it("reserves a worst-case write and never assumes a read", () => {
    const policy = createPromptCachePolicy({
      model: "gpt-5.6-sol",
      family: "operator_thread",
      contractVersion: "webapp-openai-v1",
      stablePrefix: "stable contract ".repeat(800),
      stablePrefixTokens: 2_000,
      toolSchema: [],
      outputSchema: { type: "object" },
      reasoningEffort: "medium",
      privacyScope: "internal",
      processingRegion: "default",
      expectedReuseCount: 1,
      expectedReuseProbability: 1,
      explicitBreakpointAvailable: true,
    });
    const reservation = worstCaseOpenAIReservationUsd({
      model: "gpt-5.6-sol",
      inputTokenCeiling: 300_000,
      maxOutputTokens: 8_000,
      policy,
    });

    expect(reservation).toBeCloseTo(
      (2_000 * 10 + 298_000 * 8 + 8_000 * 30) / 1_000_000,
    );
  });

  it("recomputes the conservative ceiling as tool history grows", () => {
    const initial = conservativeOpenAIInputTokenCeiling(
      [{ role: "user", content: "inspect" }],
      [{ type: "function", name: "inspect" }],
    );
    const followUp = conservativeOpenAIInputTokenCeiling(
      [
        { role: "user", content: "inspect" },
        { type: "message", content: [{ type: "output_text", text: "x".repeat(5_000) }] },
        { type: "function_call_output", output: "y".repeat(5_000) },
      ],
      [{ type: "function", name: "inspect" }],
    );

    expect(followUp).toBeGreaterThan(initial + 9_000);
  });
});
