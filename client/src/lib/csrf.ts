let cachedToken: string | null = null;
type TokenRequest = { promise: Promise<string>; controller: AbortController; pending: boolean };
let latestRequest: TokenRequest | null = null;

const fetchCsrfToken = async (signal: AbortSignal): Promise<string> => {
  const response = await fetch("/api/csrf", {
    credentials: "include",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token (${response.status})`);
  }

  const data = (await response.json()) as { csrfToken?: string };
  if (!data.csrfToken) {
    throw new Error("CSRF token missing from response");
  }

  return data.csrfToken;
};

export const getCsrfToken = async (options: { refresh?: boolean } = {}): Promise<string> => {
  if (options.refresh) cachedToken = null;
  if (cachedToken) {
    return cachedToken;
  }

  if (options.refresh || !latestRequest?.pending) {
    const previous = latestRequest, controller = new AbortController();
    let request: TokenRequest;
    const promise = fetchCsrfToken(controller.signal).then(token => {
      // Only the newest GET can populate the cache. Older callers follow its
      // result even if their transport finishes after it or ignores abort.
      if (latestRequest !== request) return latestRequest!.promise;
      cachedToken = token;
      return token;
    }).catch(error => {
      if (latestRequest !== request) return latestRequest!.promise;
      throw error;
    }).finally(() => { request.pending = false; });
    request = { promise, controller, pending: true };
    latestRequest = request;
    // Cancel only superseded token GETs, never a mutation. Already received
    // cookie headers still rely on the server's unchanged CSRF check.
    if (options.refresh && previous?.pending) previous.controller.abort();
  }

  return latestRequest!.promise;
};

export const withCsrfHeader = async (
  headers: Record<string, string> = {},
  options: { refresh?: boolean } = {},
): Promise<Record<string, string>> => ({
  ...headers,
  "X-CSRF-Token": await getCsrfToken(options),
});
