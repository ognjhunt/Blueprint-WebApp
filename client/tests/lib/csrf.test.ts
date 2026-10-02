import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((accept, refuse) => { resolve = accept; reject = refuse; });
  return { promise, resolve, reject };
}
const response = (token: string) => new Response(JSON.stringify({ csrfToken: token }));
beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

describe("CSRF token request lifecycle", () => {
  it("shares ordinary pending reads and caches the credentialed no-store result", async () => {
    const pending = deferred<Response>(), fetcher = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetcher);
    const { getCsrfToken, withCsrfHeader } = await import("@/lib/csrf");
    const first = getCsrfToken(), second = withCsrfHeader({ Authorization: "Bearer synthetic-owner" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    pending.resolve(response("first"));
    expect(await first).toBe("first");
    expect(await second).toEqual({ Authorization: "Bearer synthetic-owner", "X-CSRF-Token": "first" });
    expect(await getCsrfToken()).toBe("first");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).toEqual(["/api/csrf", expect.objectContaining({ credentials: "include", cache: "no-store" })]);
  });

  it("starts a distinct forced refresh and prevents a late older response from replacing its cache", async () => {
    const old = deferred<Response>(), fresh = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    vi.stubGlobal("fetch", fetcher);
    const { getCsrfToken } = await import("@/lib/csrf");
    const first = getCsrfToken(), refreshed = getCsrfToken({ refresh: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    fresh.resolve(response("current-cookie-token"));
    expect(await refreshed).toBe("current-cookie-token");
    // Simulate a transport whose late response arrives despite cancellation.
    old.resolve(response("old-cookie-token"));
    expect(await first).toBe("current-cookie-token");
    expect(await getCsrfToken()).toBe("current-cookie-token");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps ordinary callers on the fresh pending request when an older request finishes first", async () => {
    const old = deferred<Response>(), fresh = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    vi.stubGlobal("fetch", fetcher);
    const { getCsrfToken } = await import("@/lib/csrf");
    const first = getCsrfToken(), refreshed = getCsrfToken({ refresh: true });
    old.resolve(response("old"));
    await new Promise(resolve => setTimeout(resolve, 0));
    const joined = getCsrfToken();
    expect(fetcher).toHaveBeenCalledTimes(2);
    fresh.resolve(response("fresh"));
    expect(await Promise.all([first, refreshed, joined])).toEqual(["fresh", "fresh", "fresh"]);
  });

  it("moves superseded readers to the newest refresh without failing them on the cancelled GET", async () => {
    const old = deferred<Response>(), middle = deferred<Response>(), fresh = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(middle.promise).mockReturnValueOnce(fresh.promise);
    vi.stubGlobal("fetch", fetcher);
    const { getCsrfToken } = await import("@/lib/csrf");
    const first = getCsrfToken(), second = getCsrfToken({ refresh: true }), third = getCsrfToken({ refresh: true });
    expect(fetcher).toHaveBeenCalledTimes(3);
    old.reject(new DOMException("Superseded token request", "AbortError"));
    middle.reject(new DOMException("Superseded token request", "AbortError"));
    fresh.resolve(response("latest"));
    expect(await Promise.all([first, second, third])).toEqual(["latest", "latest", "latest"]);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    expect(fetcher.mock.calls[1][1].signal.aborted).toBe(true);
    expect(fetcher.mock.calls[2][1].signal.aborted).toBe(false);
  });

  it("does not revive an older token when the forced refresh fails, and permits a new read", async () => {
    const old = deferred<Response>(), fresh = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise).mockResolvedValueOnce(response("recovered"));
    vi.stubGlobal("fetch", fetcher);
    const { getCsrfToken } = await import("@/lib/csrf");
    const outcome = (request: Promise<string>) => request.then(value => ({ value }), error => ({ error: error.message }));
    const first = outcome(getCsrfToken()), refreshed = outcome(getCsrfToken({ refresh: true }));
    expect(fetcher).toHaveBeenCalledTimes(2);
    fresh.resolve(new Response("", { status: 503 }));
    expect(await refreshed).toEqual({ error: "Failed to fetch CSRF token (503)" });
    old.resolve(response("obsolete"));
    expect(await first).toEqual({ error: "Failed to fetch CSRF token (503)" });
    expect(await getCsrfToken()).toBe("recovered");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
