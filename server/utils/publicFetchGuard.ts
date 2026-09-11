/**
 * Fetching a URL that came from outside.
 *
 * Both callers — a site's task-footage link and a robot team's website — hand
 * us a URL that a stranger chose. Without a guard, "go and read this" is an
 * SSRF primitive: a worker with network access reading its own metadata
 * endpoint, an internal service, or a loopback admin port, and returning the
 * contents to a model that will happily summarise them.
 *
 * So the rules are deliberately blunt: public https only, no embedded
 * credentials, no private or link-local address space, a byte ceiling, and a
 * timeout. Anything else is refused with a code the caller can act on rather
 * than a generic failure — "the site shared a viewer page" and "the fetch
 * failed" need different answers.
 */

export class PublicFetchError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Reject anything that is not a plain public https URL.
 *
 * Hostname checks only; this does not resolve DNS, so a hostname that resolves
 * to a private address still gets through. That residual risk is accepted here
 * because the fetch result is never executed and never returned verbatim to a
 * user — it is summarised by a model into a reviewed proposal. A caller that
 * needs stronger isolation should fetch through an egress proxy instead.
 */
export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new PublicFetchError("url_invalid", "Not a valid URL");
  }

  if (url.protocol !== "https:") {
    throw new PublicFetchError("url_not_https", "URL must be https");
  }
  if (url.username || url.password) {
    throw new PublicFetchError("url_has_credentials", "URL must not embed credentials");
  }

  const host = url.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]" ||
    host === "0.0.0.0";
  if (isPrivate) {
    throw new PublicFetchError("url_private_host", "URL must point at a public host");
  }

  return url;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Read a public page as text.
 *
 * Truncates rather than refuses when a page is long: a product page's first
 * two megabytes contain the spec table, and failing the whole read because a
 * site ships a large bundle would lose information for no safety gain.
 */
export async function fetchPublicText(
  rawUrl: string,
  options: { maxBytes?: number; timeoutMs?: number; fetcher?: typeof fetch } = {},
): Promise<{ url: string; text: string; truncated: boolean }> {
  const url = assertPublicHttpsUrl(rawUrl);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetcher(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: { accept: "text/html,text/plain,application/xhtml+xml" },
    });
    if (!response.ok) {
      throw new PublicFetchError("fetch_failed", `URL returned HTTP ${response.status}`);
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !/text\/html|text\/plain|xhtml|application\/json/.test(contentType)) {
      throw new PublicFetchError(
        "not_readable_text",
        `URL served ${contentType.split(";")[0]} rather than a readable page`,
      );
    }

    const raw = await response.text();
    const truncated = raw.length > maxBytes;
    return { url: url.toString(), text: truncated ? raw.slice(0, maxBytes) : raw, truncated };
  } catch (error) {
    if (error instanceof PublicFetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PublicFetchError("fetch_timeout", "URL timed out");
    }
    throw new PublicFetchError(
      "fetch_failed",
      error instanceof Error ? error.message : "URL could not be read",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Strip markup down to the words.
 *
 * Crude on purpose. The model is reading for a spec line, not rendering a page,
 * and a real HTML parser here would be a dependency and an attack surface for
 * no gain in what gets extracted.
 */
export function toReadableText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
