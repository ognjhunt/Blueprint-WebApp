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

function anthropicError(status: number | undefined, type: string, errorCode?: string, withHeaders = true) {
  const body = { type: "error", error: { type, message: "wording that can change", ...(errorCode ? { details: { error_code: errorCode } } : {}) } };
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
    ["429 rate limit", anthropicError(429, "rate_limit_error"), "rate_limited"],
    ["429 ramp limit", anthropicError(429, "rate_limit_error", "ramp_limit_exceeded"), "rate_limited"],
    ["529 overloaded", anthropicError(529, "overloaded_error"), "overloaded"],
    ["mid-stream overloaded", anthropicError(undefined, "overloaded_error"), "overloaded"],
    ["500 api_error", anthropicError(500, "api_error"), "other"],
    ["504 timeout_error", anthropicError(504, "timeout_error"), "other"],
    ["400 invalid_request_error", anthropicError(400, "invalid_request_error"), "bad_request"],
    // A spend limit the organization set itself: a 400 told apart only by its
    // message. Not recognised, so it never switches providers.
    ["400 own spend limit", anthropicError(400, "invalid_request_error"), "bad_request"],
    ["404 not_found_error", anthropicError(404, "not_found_error"), "bad_request"],
    ["413 request_too_large", anthropicError(413, "request_too_large"), "bad_request"],
    ["401 authentication_error", anthropicError(401, "authentication_error"), "auth"],
    ["403 permission_error", anthropicError(403, "permission_error"), "auth"],
    ["connection error", new Anthropic.APIConnectionError({ message: "offline" }), "other"],
    ["connection timeout", new Anthropic.APIConnectionTimeoutError(), "other"],
  ];
  it.each(cases)("%s", (_label, error, expected) => {
    expect(classifyProviderError(error).error_class).toBe(expected);
  });

  it("reads typed fields, not the message", () => {
    const error = anthropicError(429, "rate_limit_error", "enforced_spend_limit_reached");
    expect(classifyProviderError(error)).toEqual({ error_class: "no_funds", sdk: "anthropic", status: 429,
      type: "rate_limit_error", code: "enforced_spend_limit_reached" });
    const worded = Anthropic.APIError.generate(429, { type: "error", error: { type: "rate_limit_error",
      message: "Your credit balance is too low" } }, undefined, headers());
    expect(classifyProviderError(worded).error_class).toBe("rate_limited");
  });
});

describe("provider error classifier: OpenAI", () => {
  const cases: Array<[string, unknown, ProviderErrorClass]> = [
    ["429 credit_balance_exhausted", openAiError(429, undefined, "credit_balance_exhausted"), "no_funds"],
    ["429 organization_spend_limit_exceeded", openAiError(429, undefined, "organization_spend_limit_exceeded"), "no_funds"],
    ["429 project_spend_limit_exceeded", openAiError(429, undefined, "project_spend_limit_exceeded"), "no_funds"],
    ["429 organization_usage_limit_exceeded", openAiError(429, undefined, "organization_usage_limit_exceeded"), "no_funds"],
    ["429 type insufficient_quota", openAiError(429, "insufficient_quota", undefined), "no_funds"],
    // Not on the live page: kept out of no_funds until it is documented.
    ["429 code insufficient_quota alone", openAiError(429, "requests", "insufficient_quota"), "rate_limited"],
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
    expect(classifyProviderError(error).error_class).toBe(expected);
  });
});

describe("provider error classifier: adapter stops and unknown errors", () => {
  it("a refusal is refused, never no_funds", () => {
    expect(classifyProviderError(new ProviderRefusalError("cyber", "msg_1"))).toMatchObject({ error_class: "refused", code: "cyber" });
  });
  it("a cut-off answer is other", () => {
    expect(classifyProviderError(new ProviderOutputTruncatedError("msg_1")).error_class).toBe("other");
  });
  it.each([new Error("402 billing_error"), "insufficient_quota", null, { status: 402, type: "billing_error" }])(
    "an object that is not an SDK error is other (%s)", (error) => {
      expect(classifyProviderError(error).error_class).toBe("other");
    });
});
