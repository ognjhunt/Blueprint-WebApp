// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { main, runUptimeProbe } from "./uptime-probe.mjs";

function site(responses: Record<string, Array<[number, string]>>) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: { body?: string }) => {
    calls.push(url);
    if (url.startsWith("https://hooks.example")) return { ok: true, status: 200, text: async () => "ok", body: init?.body };
    const path = new URL(url).pathname;
    const queue = responses[path] || [[200, path === "/health/outbox" ? '{"status":"moving"}' : ""]];
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

  describe("customer email outbox", () => {
    const website = { "/health": [[200, '"healthy"']], "/version.json": [[200, "git_sha"]], "/health/worker": [[200, '"fresh"']] } as Record<string, Array<[number, string]>>;
    const env = { UPTIME_BASE_URL: "https://site.example", UPTIME_ATTEMPTS: "1", UPTIME_RETRY_DELAY_MS: "0", SLACK_WEBHOOK_URL: "https://hooks.example/x" };

    it.each([
      [503, '{"status":"stalled","oldest_undelivered_age_seconds":9000,"stalled_after_seconds":7200}'],
      [503, '{"status": "unavailable", "oldest_undelivered_age_seconds": null}'],
      // An error that is not the endpoint's own answer is still not a healthy outbox.
      [500, "Internal Server Error"],
      [502, "<html><body>Bad Gateway</body></html>"],
      [200, "<!doctype html><html><body><div id=\"root\"></div></body></html>"],
      [200, '{"status":"stalled"}'],
    ])("pages by name when the outbox answers %i %s", async (status, body) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      const down = site({ ...website, "/health/outbox": [[status, body]] });
      expect(await main(env, down.fetchImpl)).toBe(1);
      const slack = down.fetchImpl.mock.calls.find(([url]) => String(url).startsWith("https://hooks.example"))!;
      expect(JSON.parse(String(slack[1]?.body)).text).toBe(
        `:rotating_light: Blueprint uptime probe failed for https://site.example: /health/outbox=HTTP_${status} (customer email undelivered too long, or the outbox is unreadable)`);
    });

    it.each([
      ["a moving outbox", 200, '{"status":"moving","oldest_undelivered_age_seconds":61,"stalled_after_seconds":7200}', "OK /health/outbox (attempt 1)"],
      // The web service before this endpoint is deployed answers 404 with its page shell.
      ["a build without the endpoint", 404, "<!doctype html><html><body><div id=\"root\"></div></body></html>", "SKIP /health/outbox: HTTP 404, not served by this build yet"],
    ])("passes for %s", async (_name, status, body, line) => {
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      const up = site({ ...website, "/health/outbox": [[status, body]] });
      expect(await main(env, up.fetchImpl)).toBe(0);
      expect(up.calls).toContain("https://site.example/health/outbox");
      expect(log.mock.calls.map(([text]) => text)).toContain(line);
    });
  });

  describe("control-plane host", () => {
    const door = "https://door.example/api/live-pipeline/operator/v1/healthz";
    const website = { "/health": [[200, '"healthy"']], "/version.json": [[200, "git_sha"]], "/health/worker": [[200, '"fresh"']] } as Record<string, Array<[number, string]>>;
    const env = { UPTIME_BASE_URL: "https://site.example", UPTIME_ATTEMPTS: "1", UPTIME_RETRY_DELAY_MS: "0", SLACK_WEBHOOK_URL: "https://hooks.example/x", UPTIME_CONTROL_PLANE_HEALTH_URL: door };

    it("pages by name when the operator door does not answer ok", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      const down = site({ ...website, "/api/live-pipeline/operator/v1/healthz": [[502, "Bad Gateway"]] });
      expect(await main(env, down.fetchImpl)).toBe(1);
      const slack = down.fetchImpl.mock.calls.find(([url]) => String(url).startsWith("https://hooks.example"))!;
      expect(JSON.parse(String(slack[1]?.body)).text).toBe(
        ":rotating_light: Blueprint uptime probe failed for https://site.example: control-plane=HTTP_502 (Pipeline control-plane host or operator door down)");
    });

    it.each(['{"ok": true, "version": "1.0.0"}', '{"ok":true}'])("accepts the door's healthy body %s", async (body) => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      const up = site({ ...website, "/api/live-pipeline/operator/v1/healthz": [[200, body]] });
      expect(await main(env, up.fetchImpl)).toBe(0);
      expect(up.calls).toContain(door);
    });

    it("is not probed unless configured", async () => {
      vi.spyOn(console, "log").mockImplementation(() => undefined);
      const up = site(website);
      const { UPTIME_CONTROL_PLANE_HEALTH_URL: _unset, ...unconfigured } = env;
      expect(await main(unconfigured, up.fetchImpl)).toBe(0);
      expect(up.calls.some((url) => url.includes("/operator/"))).toBe(false);
    });
  });
});
