import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { workspaceRequest } from "@/lib/workspace";

const { authHeaders, csrfHeaders } = vi.hoisted(() => ({
  authHeaders: vi.fn(), csrfHeaders: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/firebaseAuthHeaders", () => ({ withFirebaseAuthHeaders: authHeaders }));
vi.mock("@/lib/csrf", () => ({ withCsrfHeader: csrfHeaders }));

beforeEach(() => {
  vi.useFakeTimers();
  authHeaders.mockResolvedValue({ Authorization: "Bearer test" });
  csrfHeaders.mockResolvedValue({ "X-CSRF-Token": "test" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("workspace request deadlines", () => {
  const open = () => workspaceRequest(null, "/tasks/owned/task-link", "POST", {}, { timeoutMs: 15000 });

  it("aborts a stalled link fetch and permits a fresh retry", async () => {
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: "/capture-upload/test" })));
    vi.stubGlobal("fetch", fetch);
    const pending = open();
    const rejected = expect(pending).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
    await expect(open()).resolves.toEqual({ url: "/capture-upload/test" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["auth", "csrf"])("times out stalled %s preparation without sending a late request", async (stage) => {
    let finish!: (value: Record<string, string>) => void;
    (stage === "auth" ? authHeaders : csrfHeaders).mockImplementationOnce(
      () => new Promise(resolve => { finish = resolve; }),
    );
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const pending = open();
    const rejected = expect(pending).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    finish({});
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("bounds a stalled response body and preserves server errors", async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: () => new Promise(() => {}) })
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Job not found." }), { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    const rejected = expect(open()).rejects.toMatchObject({ code: "request_timeout" });
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    await expect(open()).rejects.toMatchObject({ status: 404, message: "Job not found." });
    expect(vi.getTimerCount()).toBe(0);
  });
});
