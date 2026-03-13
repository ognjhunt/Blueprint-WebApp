import '@testing-library/jest-dom';
import { afterEach, beforeEach, vi } from "vitest";

function buildDefaultResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function normalizeRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

async function defaultFetch(input: RequestInfo | URL): Promise<Response> {
  const rawUrl = normalizeRequestUrl(input);
  const resolvedUrl =
    rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? new URL(rawUrl)
      : new URL(rawUrl, "http://localhost:3000");

  const isLocalAppRequest =
    resolvedUrl.origin === "http://localhost:3000" ||
    resolvedUrl.origin === "http://127.0.0.1:3000";

  if (!isLocalAppRequest) {
    throw new Error(`Unexpected outbound fetch in test: ${resolvedUrl.toString()}`);
  }

  if (resolvedUrl.pathname === "/api/csrf") {
    return buildDefaultResponse({ csrfToken: "test-csrf-token" });
  }

  if (resolvedUrl.pathname.startsWith("/api/")) {
    return buildDefaultResponse({});
  }

  return new Response("", { status: 200 });
}

beforeEach(() => {
  if (typeof window === "undefined") {
    return;
  }
  global.fetch = vi.fn(defaultFetch) as typeof fetch;
});

afterEach(() => {
  if (typeof window === "undefined") {
    return;
  }
  vi.clearAllMocks();
});
