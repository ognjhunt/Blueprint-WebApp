// @vitest-environment node
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { describe, expect, it } from "vitest";

import {
  classifyProviderError,
  ProviderOutputTruncatedError,
  ProviderRefusalError,
  type ProviderErrorClass,
} from "../agents/provider-errors";

const headers = (entries: Record<string, string> = {}) => new Headers(entries);

function anthropicError(status: number | undefined, type: string, errorCode?: string, withHeaders = true,
  message = "wording that can change") {
  const body = { type: "error", error: { type, message, ...(errorCode ? { details: { error_code: errorCode } } : {}) } };
  if (status === undefined) {
    // A mid-stream `error` event: no HTTP status, the type comes from the body.
    return new Anthropic.APIError(undefined, body, undefined, headers());
  }
  return Anthropic.APIError.generate(status, body, undefined, withHeaders ? headers() : undefined);
}

function openAiError(status: number, type: string | undefined, code: string | undefined) {
  return OpenAI.APIError.generate(status, { error: { type, code, message: "wording that can change" } }, undefined, headers());
}

describe("provider error classifier: Anthropic", () => {
  const cases: Array<[string, unknown, ProviderErrorClass]> = [
    ["402 billing_error", anthropicError(402, "billing_error"), "no_funds"],
    ["429 tier monthly spend cap", anthropicError(429, "rate_limit_error", "enforced_spend_limit_reached"), "no_funds"],
    ["mid-stream billing_error", anthropicError(undefined, "billing_error"), "no_funds"],
    // The spend-cap code counts only on an HTTP 429.
    ["spend-cap code on a stream error event (no status)", anthropicError(undefined, "rate_limit_error", "enforced_spend_limit_reached"), "rate_limited"],
    ["spend-cap code on a 400", anthropicError(400, "invalid_request_error", "enforced_spend_limit_reached"), "bad_request"],
    ["429 rate limit", anthropicError(429, "rate_limit_error"), "rate_limited"],
    ["429 ramp limit", anthropicError(429, "rate_limit_error", "ramp_limit_exceeded"), "rate_limited"],
    ["529 overloaded", anthropicError(529, "overloaded_error"), "overloaded"],
    ["mid-stream overloaded", anthropicError(undefined, "overloaded_error"), "overloaded"],
    ["500 api_error", anthropicError(500, "api_error"), "other"],
    ["504 timeout_error", anthropicError(504, "timeout_error"), "other"],
    ["400 invalid_request_error", anthropicError(400, "invalid_request_error"), "bad_request"],
    // A spend limit the organization or a workspace set itself: the one row read
    // from the message, and only from its documented opening.
    ["400 organization's own spend limit", anthropicError(400, "invalid_request_error", undefined, true,
      "You have reached your specified API usage limits. You will regain access on 2026-12-01 at 00:00 UTC."), "no_funds"],
    ["400 workspace's own spend limit", anthropicError(400, "invalid_request_error", undefined, true,
      "You have reached your specified workspace API usage limits. You will regain access on 2026-12-01 at 00:00 UTC."), "no_funds"],
    ["400 the same words not at the start", anthropicError(400, "invalid_request_error", undefined, true,
      "Note: You have reached your specified API usage limits"), "bad_request"],
    ["400 reworded limit message", anthropicError(400, "invalid_request_error", undefined, true,
      "Your specified API usage limits have been reached"), "bad_request"],
    ["429 with the limit message is still a rate limit", anthropicError(429, "rate_limit_error", undefined, true,
      "You have reached your specified API usage limits"), "rate_limited"],
    // Unsettled until a paid run records what it returns.
    ["400 credit balance is too low", anthropicError(400, "invalid_request_error", undefined, true,
      "Your credit balance is too low to access the Anthropic API."), "bad_request"],
    ["404 not_found_error", anthropicError(404, "not_found_error"), "bad_request"],
    ["413 request_too_large", anthropicError(413, "request_too_large"), "bad_request"],
    ["401 authentication_error", anthropicError(401, "authentication_error"), "auth"],
    ["403 permission_error", anthropicError(403, "permission_error"), "auth"],
    ["connection error", new Anthropic.APIConnectionError({ message: "offline" }), "other"],
    ["connection timeout", new Anthropic.APIConnectionTimeoutError(), "other"],
  ];
  it.each(cases)("%s", (_label, error, expected) => {
    expect(classifyProviderError(error, "anthropic_agent_sdk").error_class).toBe(expected);
  });

  it("reads typed fields, not the message", () => {
    const error = anthropicError(429, "rate_limit_error", "enforced_spend_limit_reached");
    expect(classifyProviderError(error, "anthropic_agent_sdk")).toEqual({ error_class: "no_funds", provider: "anthropic_agent_sdk", sdk: "anthropic", status: 429,
      type: "rate_limit_error", code: "enforced_spend_limit_reached" });
    const worded = Anthropic.APIError.generate(429, { type: "error", error: { type: "rate_limit_error",
      message: "Your credit balance is too low" } }, undefined, headers());
    expect(classifyProviderError(worded, "anthropic_agent_sdk").error_class).toBe("rate_limited");
    // An error from another SDK (here the OpenAI SDK pointed at another company)
    // is read only by the OpenAI rows.
    expect(classifyProviderError(openAiError(402, "insufficient_balance", undefined), "openai_responses").error_class).toBe("bad_request");
  });
});

describe("provider error classifier: OpenAI", () => {
  const cases: Array<[string, unknown, ProviderErrorClass]> = [
    ["429 credit_balance_exhausted", openAiError(429, undefined, "credit_balance_exhausted"), "no_funds"],
    ["429 organization_spend_limit_exceeded", openAiError(429, undefined, "organization_spend_limit_exceeded"), "no_funds"],
    ["429 project_spend_limit_exceeded", openAiError(429, undefined, "project_spend_limit_exceeded"), "no_funds"],
    ["429 organization_usage_limit_exceeded", openAiError(429, undefined, "organization_usage_limit_exceeded"), "no_funds"],
    ["429 type insufficient_quota", openAiError(429, "insufficient_quota", undefined), "no_funds"],
    ["429 code insufficient_quota", openAiError(429, "requests", "insufficient_quota"), "no_funds"],
    ["400 with a funds code is not a 429", openAiError(400, "invalid_request_error", "insufficient_quota"), "bad_request"],
    ["402 is not on the page", openAiError(402, undefined, "credit_balance_exhausted"), "bad_request"],
    ["429 rate limit", openAiError(429, "requests", "rate_limit_exceeded"), "rate_limited"],
    ["429 slow_down", openAiError(429, "rate_limit_error", "slow_down"), "rate_limited"],
    ["503 server_is_overloaded", openAiError(503, undefined, "server_is_overloaded"), "overloaded"],
    ["500 server error", openAiError(500, "server_error", undefined), "other"],
    ["400 bad request", openAiError(400, "invalid_request_error", undefined), "bad_request"],
    ["401 auth", openAiError(401, "invalid_request_error", "invalid_api_key"), "auth"],
    ["403 region", openAiError(403, undefined, "unsupported_country_region_territory"), "auth"],
    ["connection error", new OpenAI.APIConnectionError({ message: "offline" }), "other"],
  ];
  it.each(cases)("%s", (_label, error, expected) => {
    expect(classifyProviderError(error, "openai_responses").error_class).toBe(expected);
  });
});

describe("provider error classifier: the provider the call went to", () => {
  it("applies OpenAI's rows only to OpenAI, never to another company reached through the same SDK", () => {
    for (const provider of ["deepseek_chat", "zai_glm"] as const) {
      expect(classifyProviderError(openAiError(429, "insufficient_quota", "credit_balance_exhausted"), provider))
        .toMatchObject({ error_class: "rate_limited", provider });
      expect(classifyProviderError(openAiError(402, undefined, undefined), provider).error_class).toBe("bad_request");
    }
    expect(classifyProviderError(openAiError(429, "insufficient_quota", "credit_balance_exhausted"), null).error_class).toBe("rate_limited");
  });
  it("applies Anthropic's rows only to Anthropic's own API", () => {
    expect(classifyProviderError(anthropicError(402, "billing_error"), null).error_class).toBe("bad_request");
    expect(classifyProviderError(anthropicError(429, "rate_limit_error", "enforced_spend_limit_reached"), "openai_responses").error_class)
      .toBe("rate_limited");
  });
});

describe("provider error classifier: wrapped errors", () => {
  it("classifies through the cause chain when a link is a typed SDK error", () => {
    const inner = anthropicError(402, "billing_error");
    expect(classifyProviderError(new Error("adapter failed", { cause: inner }), "anthropic_agent_sdk").error_class).toBe("no_funds");
    expect(classifyProviderError(new Error("outer", { cause: new Error("middle", { cause: openAiError(429, undefined,
      "credit_balance_exhausted") }) }), "openai_responses").error_class).toBe("no_funds");
  });
  it("the first typed link decides, and log text never does", () => {
    expect(classifyProviderError(new Error("outer", { cause: anthropicError(429, "rate_limit_error") }), "anthropic_agent_sdk").error_class).toBe("rate_limited");
    expect(classifyProviderError(new Error("billing_error enforced_spend_limit_reached insufficient_quota"), "anthropic_agent_sdk").error_class).toBe("other");
    expect(classifyProviderError(new Error("outer", { cause: { status: 402, type: "billing_error" } }), "anthropic_agent_sdk").error_class).toBe("other");
  });
});

describe("provider error classifier: adapter stops and unknown errors", () => {
  it("a refusal is refused, never no_funds", () => {
    expect(classifyProviderError(new ProviderRefusalError("cyber", "msg_1"), "anthropic_agent_sdk")).toMatchObject({ error_class: "refused", code: "cyber" });
  });
  it("a cut-off answer is other", () => {
    expect(classifyProviderError(new ProviderOutputTruncatedError("msg_1"), "anthropic_agent_sdk").error_class).toBe("other");
  });
  it.each([new Error("402 billing_error"), "insufficient_quota", null, { status: 402, type: "billing_error" }])(
    "an object that is not an SDK error is other (%s)", (error) => {
      expect(classifyProviderError(error, "anthropic_agent_sdk").error_class).toBe("other");
    });
});
