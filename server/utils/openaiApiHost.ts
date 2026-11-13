/**
 * OpenAI: where the calls go.
 *
 * The base URL is written here, not read from the environment. The `openai`
 * SDK would otherwise obey `OPENAI_BASE_URL`, and a value left over from
 * another company's OpenAI-compatible endpoint would send every lane that runs
 * on OpenAI, a site's job text included, and the key, to that company. When
 * the variable is set and names any host other than OpenAI's own, OpenAI is
 * not configured for any client here: none is built and nothing is sent. Only
 * the reason is reported, never the value.
 */
export const OPENAI_API_BASE_URL = "https://api.openai.com/v1";
const OPENAI_API_HOST = "api.openai.com";

export type OpenAiConfigurationIssue = "openai_api_key_missing" | "openai_base_url_names_another_host";

/** Why `OPENAI_BASE_URL` makes OpenAI unusable here, or null (unset, or OpenAI's own host). */
export function getOpenAiBaseUrlIssue(): "openai_base_url_names_another_host" | null {
  const baseUrl = process.env.OPENAI_BASE_URL?.trim();
  if (!baseUrl) return null;
  let host: string | null = null;
  try {
    const parsed = new URL(baseUrl);
    host = parsed.protocol === "https:" ? parsed.hostname.toLowerCase() : null;
  } catch {
    host = null;
  }
  return host === OPENAI_API_HOST ? null : "openai_base_url_names_another_host";
}

/** Why OpenAI cannot be used here, or null when it can. */
export function getOpenAiConfigurationIssue(): OpenAiConfigurationIssue | null {
  if (!process.env.OPENAI_API_KEY?.trim()) return "openai_api_key_missing";
  return getOpenAiBaseUrlIssue();
}

/** The key, only when OpenAI is usable here; otherwise null and no client may be built. */
export function getUsableOpenAiApiKey(): string | null {
  return getOpenAiConfigurationIssue() === null ? process.env.OPENAI_API_KEY!.trim() : null;
}
