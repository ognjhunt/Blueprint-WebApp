// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { main, runUptimeProbe } from "./uptime-probe.mjs";

function site(responses: Record<string, Array<[number, string]>>) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: { body?: string }) => {
    calls.push(url);
    if (url.startsWith("https://hooks.example")) return { ok: true, status: 200, text: async () => "ok", body: init?.body };
    const path = new URL(url).pathname;
    const queue = responses[path] || [[200, ""]];
    const [status, body] = queue.length > 1 ? queue.shift()! : queue[0];
    return { ok: status === 200, status, text: async () => body };
  });
  return { fetchImpl, calls };
}

describe("uptime probe", () => {
  it("retries before failing and reports the worker heartbeat by name", async () => {
    const { fetchImpl } = site({
      "/health": [[503, ""], [200, '{"status":"healthy"}']],
      "/version.json": [[200, '{"git_sha":"abc"}']],
      "/health/worker": [[503, '{"status":"stale"}']],
    });
    const { failures } = await runUptimeProbe({ baseUrl: "https://site.example", attempts: 2, retryDelayMs: 0, fetchImpl, log: () => undefined });
    expect(failures).toEqual([{ path: "/health/worker", status: "503", meaning: "worker heartbeat stale or missing" }]);
  });

  it("posts one Slack alert and exits 1 on failure, and exits 0 when healthy", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const env = { UPTIME_BASE_URL: "https://site.example/", UPTIME_ATTEMPTS: "1", UPTIME_RETRY_DELAY_MS: "0", SLACK_WEBHOOK_URL: "https://hooks.example/x" };
    const down = site({ "/health": [[502, ""]], "/version.json": [[200, "git_sha"]], "/health/worker": [[200, '"fresh"']] });
    expect(await main(env, down.fetchImpl)).toBe(1);
    const slack = down.fetchImpl.mock.calls.find(([url]) => String(url).startsWith("https://hooks.example"))!;
    expect(JSON.parse(String(slack[1]?.body)).text).toBe(":rotating_light: Blueprint uptime probe failed for https://site.example: /health=HTTP_502");

    const up = site({ "/health": [[200, '"healthy"']], "/version.json": [[200, "git_sha"]], "/health/worker": [[200, '"fresh"']] });
    expect(await main(env, up.fetchImpl)).toBe(0);
    expect(up.calls.some((url) => url.startsWith("https://hooks.example"))).toBe(false);
  });
});
