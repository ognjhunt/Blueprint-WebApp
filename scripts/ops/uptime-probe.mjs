#!/usr/bin/env node
/**
 * External uptime probe for the production site.
 *
 * Runs every 10 minutes as the `blueprint-uptime-probe` Render cron job
 * (render.yaml), and as a backstop from .github/workflows/uptime.yml, whose
 * schedule GitHub throttles to every few hours. Node built-ins only, so the
 * cron job needs no install step.
 *
 * Checks, each with retries:
 *   /health         the web service answers ("healthy")
 *   /version.json   the deployed build is served ("git_sha")
 *   /health/worker  blueprint-webapp-worker wrote its heartbeat recently ("fresh")
 *
 * On failure it posts to the ops Slack webhook (SLACK_WEBHOOK_URL), the same
 * channel the in-process alerts use, and exits 1 so the platform records a
 * failed run (Render cron and GitHub both notify on failed runs when enabled).
 *
 * Env: UPTIME_BASE_URL (default https://tryblueprint.io), SLACK_WEBHOOK_URL,
 * UPTIME_ATTEMPTS (3), UPTIME_RETRY_DELAY_MS (15000), UPTIME_RUN_URL (optional
 * link added to the alert).
 */
import { pathToFileURL } from "node:url";

export const UPTIME_CHECKS = [
  { path: "/health", expect: '"healthy"' },
  { path: "/version.json", expect: "git_sha" },
  { path: "/health/worker", expect: '"fresh"', meaning: "worker heartbeat stale or missing" },
];

async function probeOnce(baseUrl, check, fetchImpl, timeoutMs) {
  try {
    const response = await fetchImpl(`${baseUrl}${check.path}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "blueprint-uptime-probe" },
    });
    const body = await response.text();
    return { ok: response.status === 200 && body.includes(check.expect), status: String(response.status) };
  } catch {
    return { ok: false, status: "none" };
  }
}

/** Probe every check; returns the ones that failed every attempt. */
export async function runUptimeProbe({
  baseUrl,
  checks = UPTIME_CHECKS,
  attempts = 3,
  retryDelayMs = 15_000,
  timeoutMs = 20_000,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  log = console.log,
}) {
  const failures = [];
  for (const check of checks) {
    let result = { ok: false, status: "none" };
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      result = await probeOnce(baseUrl, check, fetchImpl, timeoutMs);
      if (result.ok) {
        log(`OK ${check.path} (attempt ${attempt})`);
        break;
      }
      log(`Attempt ${attempt}/${attempts} for ${check.path}: HTTP ${result.status}`);
      if (attempt < attempts) await sleep(retryDelayMs);
    }
    if (!result.ok) failures.push({ path: check.path, status: result.status, meaning: check.meaning || null });
  }
  return { failures };
}

export function uptimeAlertText({ baseUrl, failures, runUrl }) {
  const detail = failures
    .map((failure) => `${failure.path}=HTTP_${failure.status}${failure.meaning ? ` (${failure.meaning})` : ""}`)
    .join(", ");
  return [`:rotating_light: Blueprint uptime probe failed for ${baseUrl}: ${detail}`, runUrl].filter(Boolean).join("\n");
}

export async function main(env = process.env, fetchImpl = fetch) {
  const baseUrl = (env.UPTIME_BASE_URL || "https://tryblueprint.io").replace(/\/+$/, "");
  const attempts = Math.max(1, Number(env.UPTIME_ATTEMPTS) || 3);
  const retryDelayMs = Math.max(0, Number(env.UPTIME_RETRY_DELAY_MS ?? 15_000) || 0);
  const { failures } = await runUptimeProbe({ baseUrl, attempts, retryDelayMs, fetchImpl });
  if (!failures.length) return 0;
  const text = uptimeAlertText({ baseUrl, failures, runUrl: env.UPTIME_RUN_URL });
  console.error(text);
  if (!env.SLACK_WEBHOOK_URL) {
    console.error("SLACK_WEBHOOK_URL is not set; the failed run is the alert.");
    return 1;
  }
  try {
    const response = await fetchImpl(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) console.error(`Slack post failed: HTTP ${response.status}`);
  } catch (error) {
    console.error(`Slack post failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
