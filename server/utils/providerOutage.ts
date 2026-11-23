/**
 * Whether a failed model call failed on the provider's side: the provider refused or did not answer (rate or quota,
 * a refused or missing key, a funding refusal, a 5xx, a timeout). That is an outage, not a reading that went wrong:
 * the call was never answered, so trying it again later reads the same video for the first time.
 *
 * Only the call's own error text is read. A failure the video or the answer caused (a link that does not open, a
 * reply that is not the shape asked for) is not an outage and is classified null.
 */
export type ProviderOutageCause = "funding_refused" | "key_refused" | "rate_limited" | "provider_error" | "timeout";
export type ProviderOutage = { provider: string; cause: ProviderOutageCause };

/** The video adapter's codes for a request to the provider itself (`server/agents/adapters/gemini-video.ts`). */
const PROVIDER_CALL_CODES = /^(gemini_video_provider_failed|gemini_video_upload_failed|gemini_video_file_failed|gemini_output_correction_provider_failed):/;

export function classifyProviderFailure(provider: string, error: unknown): ProviderOutage | null {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : typeof error === "string" ? error : "";
  if (!text) return null;
  const outage = (cause: ProviderOutageCause): ProviderOutage => ({ provider, cause });
  // A funding refusal, in the words providers use for it (OpenAI: 429 insufficient_quota, "You have no credits remaining").
  if (/insufficient_quota|no credits remaining|credit balance is too low|exceeded your current quota|billing/i.test(text))
    return outage("funding_refused");
  if (/^gemini_video_not_configured\b/.test(text)) return outage("key_refused");
  if (/^gemini_video_file_timeout\b/.test(text)) return outage("timeout");
  const status = PROVIDER_CALL_CODES.test(text) ? Number(/HTTP (\d{3})\b/.exec(text)?.[1]) : NaN;
  if (status === 402) return outage("funding_refused");
  if (status === 401 || status === 403) return outage("key_refused");
  if (status === 429) return outage("rate_limited");
  if (status === 408) return outage("timeout");
  if (status >= 500 && status <= 599) return outage("provider_error");
  // The provider request was sent and not answered in time (`AbortSignal.timeout`); a video link's own timeout is not.
  if (/^gemini_video_failed:.*(aborted due to timeout|timed out|TimeoutError)/i.test(text)) return outage("timeout");
  return null;
}

/** The first retry after an outage, and the longest wait between two. */
export const PROVIDER_OUTAGE_FIRST_RETRY_MS = 2 * 60_000;
export const PROVIDER_OUTAGE_MAX_RETRY_MS = 60 * 60_000;

/** How long to wait before the next try after `retries` earlier tries met an outage: 2, 4, 8, 16, 32, then 60 minutes. */
export function providerOutageRetryDelayMs(retries: number): number {
  const n = Number.isFinite(retries) && retries > 0 ? Math.floor(retries) : 0;
  return Math.min(PROVIDER_OUTAGE_MAX_RETRY_MS, PROVIDER_OUTAGE_FIRST_RETRY_MS * 2 ** Math.min(n, 10));
}

const PROVIDER_NAMES: Record<string, string> = { gemini: "Gemini", openai: "OpenAI" };
const CAUSE_WORDS: Record<ProviderOutageCause, string> = {
  funding_refused: "for lack of credit",
  key_refused: "our key",
  rate_limited: "for rate or quota (HTTP 429)",
  provider_error: "with server errors",
  timeout: "by timing out",
};

/** The ops alert's one line: "OpenAI refuses for lack of credit: 3 jobs waiting". */
export function providerOutageAlertText(outage: ProviderOutage, jobsWaiting: number): string {
  const name = PROVIDER_NAMES[outage.provider] ?? outage.provider;
  const verb = outage.cause === "timeout" ? "fails" : outage.cause === "provider_error" ? "fails" : "refuses";
  return `${name} ${verb} ${CAUSE_WORDS[outage.cause]}: ${jobsWaiting} job${jobsWaiting === 1 ? "" : "s"} waiting`
    + " (video reading retries by itself)";
}
