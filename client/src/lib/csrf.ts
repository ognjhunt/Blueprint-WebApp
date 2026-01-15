let cachedToken: string | null = null;
let inflight: Promise<string> | null = null;

const fetchCsrfToken = async (): Promise<string> => {
  const response = await fetch("/api/csrf", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CSRF token (${response.status})`);
  }

  const data = (await response.json()) as { csrfToken?: string };
  if (!data.csrfToken) {
    throw new Error("CSRF token missing from response");
  }

  cachedToken = data.csrfToken;
  return data.csrfToken;
};

export const getCsrfToken = async (): Promise<string> => {
  if (cachedToken) {
    return cachedToken;
  }

  if (!inflight) {
    inflight = fetchCsrfToken().finally(() => {
      inflight = null;
    });
  }

  return inflight;
};

export const withCsrfHeader = async (
  headers: Record<string, string> = {},
): Promise<Record<string, string>> => ({
  ...headers,
  "X-CSRF-Token": await getCsrfToken(),
});
