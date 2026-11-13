import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * One closed set of reasons a provider call failed, for the Anthropic and
 * OpenAI SDK error objects and the adapters' own typed stop failures.
 *
 * Only `no_funds` may ever move a call to another provider. Everything here is
 * read from typed fields (HTTP status, `error.type`, `error.code` or
 * `error.details.error_code`), never from message wording: both providers say
 * their messages can change. A shape the documentation does not settle is not
 * `no_funds`; it falls to the class its status gives.
 *
 * Sources, 2026-11-13:
 * - Anthropic: SDK 1.8.0 types (`ErrorType`, `EnforcedSpendLimitReachedError`,
 *   `RampLimitExceededError`) and the live Errors and Rate limits pages.
 *   402 `billing_error` is a billing or payment problem. 429 with
 *   `enforced_spend_limit_reached` is the tier's monthly spend cap: no
 *   `retry-after`, and it keeps failing until the next month or a tier change.
 *   A spend limit the organization sets itself is a 400
 *   `invalid_request_error` told apart only by its message, so it is NOT
 *   recognised here (`bad_request`).
 * - OpenAI: SDK 6.49.0 `APIError` (`status`, `code`, `type`) and the live
 *   Error codes page: 429 with code `credit_balance_exhausted`,
 *   `organization_spend_limit_exceeded`, `project_spend_limit_exceeded` or
 *   `organization_usage_limit_exceeded`, or with type `insufficient_quota`.
 *   429 `slow_down` and a plain rate limit are not funds.
 */
export type ProviderErrorClass =
  | "no_funds"
  | "rate_limited"
  | "overloaded"
  | "refused"
  | "bad_request"
  | "auth"
  | "other";

export type ProviderErrorClassification = {
  error_class: ProviderErrorClass;
  sdk: "anthropic" | "openai" | "adapter" | "unknown";
  status: number | null;
  type: string | null;
  code: string | null;
};

/** A provider declined to answer (Anthropic `stop_reason: "refusal"`). */
export class ProviderRefusalError extends Error {
  readonly provider_stop_reason = "refusal" as const;
  constructor(
    readonly category: string | null,
    readonly responseId: string | null,
  ) {
    super("provider_refused");
    this.name = "ProviderRefusalError";
  }
}

/** The answer was cut off at the output ceiling (`stop_reason: "max_tokens"`). */
export class ProviderOutputTruncatedError extends Error {
  readonly provider_stop_reason = "max_tokens" as const;
  constructor(readonly responseId: string | null) {
    super("provider_output_truncated");
    this.name = "ProviderOutputTruncatedError";
  }
}

const ANTHROPIC_NO_FUNDS_ERROR_CODES = new Set(["enforced_spend_limit_reached"]);
const OPENAI_NO_FUNDS_CODES = new Set([
  "credit_balance_exhausted",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded",
]);

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function byStatus(status: number | null): ProviderErrorClass {
  if (status === null) return "other";
  if (status === 401 || status === 403) return "auth";
  if (status === 429) return "rate_limited";
  if (status === 529 || status === 503) return "overloaded";
  if (status >= 400 && status < 500 && status !== 408 && status !== 409) return "bad_request";
  return "other";
}

function classifyAnthropic(error: InstanceType<typeof Anthropic.APIError>): ProviderErrorClassification {
  const status = typeof error.status === "number" ? error.status : null;
  // `type` and `errorCode` are typed fields from SDK 1.x; the body is read as
  // well so the classification does not depend on which release produced it.
  const body = record(record(error.error)?.error);
  const type = text((error as { type?: unknown }).type) ?? text(body?.type);
  const code = text((error as { errorCode?: unknown }).errorCode) ?? text(record(body?.details)?.error_code);
  const result = (error_class: ProviderErrorClass): ProviderErrorClassification =>
    ({ error_class, sdk: "anthropic", status, type, code });

  if (status === 402 || type === "billing_error") return result("no_funds");
  if ((status === 429 || type === "rate_limit_error") && code && ANTHROPIC_NO_FUNDS_ERROR_CODES.has(code)) {
    return result("no_funds");
  }
  if (type === "overloaded_error") return result("overloaded");
  if (type === "rate_limit_error") return result("rate_limited");
  if (type === "authentication_error" || type === "permission_error") return result("auth");
  if (status === null && (type === "invalid_request_error" || type === "not_found_error")) {
    return result("bad_request");
  }
  return result(byStatus(status));
}

function classifyOpenAI(error: InstanceType<typeof OpenAI.APIError>): ProviderErrorClassification {
  const status = typeof error.status === "number" ? error.status : null;
  const type = text(error.type);
  const code = text(error.code);
  const result = (error_class: ProviderErrorClass): ProviderErrorClassification =>
    ({ error_class, sdk: "openai", status, type, code });

  if (status === 429 && ((code && OPENAI_NO_FUNDS_CODES.has(code)) || type === "insufficient_quota")) {
    return result("no_funds");
  }
  if (status === 503 && code === "server_is_overloaded") return result("overloaded");
  return result(byStatus(status));
}

// A module replaced in a test may not carry the SDK's error classes.
function isInstance(error: unknown, errorClass: unknown): boolean {
  return typeof errorClass === "function" && error instanceof (errorClass as new (...args: never[]) => unknown);
}

export function classifyProviderError(error: unknown): ProviderErrorClassification {
  if (error instanceof ProviderRefusalError) {
    return { error_class: "refused", sdk: "adapter", status: null, type: "refusal", code: error.category };
  }
  if (error instanceof ProviderOutputTruncatedError) {
    return { error_class: "other", sdk: "adapter", status: null, type: "max_tokens", code: null };
  }
  if (isInstance(error, Anthropic?.APIError)) return classifyAnthropic(error as InstanceType<typeof Anthropic.APIError>);
  if (isInstance(error, OpenAI?.APIError)) return classifyOpenAI(error as InstanceType<typeof OpenAI.APIError>);
  return { error_class: "other", sdk: "unknown", status: null, type: null, code: null };
}
