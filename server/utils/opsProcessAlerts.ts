import { logger } from "../logger";
import { sendSlackMessage } from "./slack";

/**
 * Process-level observability built on the existing stack: the structured
 * logger plus the ops Slack webhook. No third-party error tracker.
 *
 * Every alert here is rate-limited per key, so a crash loop or an error storm
 * produces one message per window rather than a flood that buries the channel.
 */

type SendFn = (message: string) => Promise<{ sent: boolean; error?: unknown }>;

const DEFAULT_ALERT_INTERVAL_MS = 15 * 60 * 1000;

export function createRateLimitedAlerter(options: {
  minIntervalMs?: number;
  now?: () => number;
  send?: SendFn;
} = {}) {
  const minIntervalMs = Math.max(0, options.minIntervalMs ?? DEFAULT_ALERT_INTERVAL_MS);
  const now = options.now || Date.now;
  const send: SendFn = options.send || ((message) => sendSlackMessage(message));
  const lastSentAt = new Map<string, number>();
  const suppressed = new Map<string, number>();

  return async function alert(key: string, message: string): Promise<{ sent: boolean; suppressed: boolean }> {
    const current = now();
    const previous = lastSentAt.get(key);
    if (previous !== undefined && current - previous < minIntervalMs) {
      suppressed.set(key, (suppressed.get(key) || 0) + 1);
      return { sent: false, suppressed: true };
    }
    lastSentAt.set(key, current);
    const dropped = suppressed.get(key) || 0;
    suppressed.delete(key);
    const text = dropped > 0
      ? `${message}\n- (${dropped} similar alert(s) suppressed in the previous window)`
      : message;
    try {
      const result = await send(text);
      if (!result?.sent) {
        // The alert channel itself is down; the log line is the remaining record.
        logger.error({ event: "ops_alert_undelivered", key }, "Ops alert could not be delivered to Slack");
      }
      return { sent: Boolean(result?.sent), suppressed: false };
    } catch (error) {
      logger.error({ event: "ops_alert_undelivered", key, err: error }, "Ops alert could not be delivered to Slack");
      return { sent: false, suppressed: false };
    }
  };
}

let sharedAlerter: ReturnType<typeof createRateLimitedAlerter> | null = null;

/** Shared, rate-limited ops alert (Slack SLACK_WEBHOOK_URL). */
export function sendRateLimitedOpsAlert(key: string, message: string) {
  if (!sharedAlerter) sharedAlerter = createRateLimitedAlerter();
  return sharedAlerter(key, message);
}

export function __resetOpsProcessAlertsForTests() {
  sharedAlerter = null;
  installedFor = null;
}

function processLabel(processName: string) {
  const service = process.env.RENDER_SERVICE_NAME?.trim();
  return service ? `${processName} (${service})` : processName;
}

function errorSummary(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`.slice(0, 300);
  try {
    return String(value).slice(0, 300);
  } catch {
    return "unprintable rejection reason";
  }
}

let installedFor: string | null = null;

/**
 * Log and alert on process-level failures.
 *
 * - `unhandledRejection`: logged at fatal and alerted; the process keeps
 *   serving, because one stray promise must not take every in-flight request
 *   down with it.
 * - `uncaughtException`: logged at fatal, alerted (bounded wait), then the
 *   process exits non-zero. State after an uncaught exception is undefined;
 *   Render restarts the instance.
 */
export function installProcessErrorHandlers(options: {
  processName: "web" | "worker";
  alert?: (key: string, message: string) => Promise<unknown>;
  exit?: (code: number) => void;
  exitDelayMs?: number;
}) {
  if (installedFor) return false;
  installedFor = options.processName;
  const alert = options.alert || sendRateLimitedOpsAlert;
  const exit = options.exit || ((code: number) => process.exit(code));
  const exitDelayMs = options.exitDelayMs ?? 3_000;
  const label = processLabel(options.processName);

  process.on("unhandledRejection", (reason) => {
    logger.fatal(
      { event: "unhandled_rejection", process: options.processName, err: reason },
      "Unhandled promise rejection",
    );
    void Promise.resolve(
      alert(
        `unhandled_rejection:${options.processName}`,
        [
          `:rotating_light: Blueprint ${label}: unhandled promise rejection`,
          `- ${errorSummary(reason)}`,
          "- The process kept running. Check the Render logs for the stack.",
        ].join("\n"),
      ),
    ).catch(() => undefined);
  });

  process.on("uncaughtException", (error) => {
    logger.fatal(
      { event: "uncaught_exception", process: options.processName, err: error },
      "Uncaught exception; exiting",
    );
    const timer = setTimeout(() => exit(1), exitDelayMs);
    timer.unref?.();
    void Promise.resolve(
      alert(
        `uncaught_exception:${options.processName}`,
        [
          `:rotating_light: Blueprint ${label}: uncaught exception, process exiting`,
          `- ${errorSummary(error)}`,
          "- Render restarts the instance. Check the Render logs for the stack.",
        ].join("\n"),
      ),
    )
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer);
        exit(1);
      });
  });
  return true;
}

/**
 * Sliding-window 5xx counter. Alerts (rate-limited) when the number of 5xx
 * responses in the window reaches the threshold and they are at least
 * `minRatio` of all responses in the window.
 */
export function createServerErrorRateMonitor(options: {
  windowMs?: number;
  threshold?: number;
  minRatio?: number;
  now?: () => number;
  alert?: (key: string, message: string) => Promise<unknown>;
} = {}) {
  const windowMs = Math.max(10_000, options.windowMs ?? numberEnv("BLUEPRINT_5XX_ALERT_WINDOW_MS", 5 * 60 * 1000));
  const threshold = Math.max(1, options.threshold ?? numberEnv("BLUEPRINT_5XX_ALERT_THRESHOLD", 10));
  const minRatio = Math.min(1, Math.max(0, options.minRatio ?? numberEnv("BLUEPRINT_5XX_ALERT_MIN_RATIO", 0.05)));
  const now = options.now || Date.now;
  const alert = options.alert || sendRateLimitedOpsAlert;
  const errors: number[] = [];
  const all: number[] = [];

  const prune = (current: number) => {
    const floor = current - windowMs;
    while (errors.length && errors[0] <= floor) errors.shift();
    while (all.length && all[0] <= floor) all.shift();
    // Bound memory under extreme traffic: the ratio only needs a sample.
    if (all.length > 50_000) all.splice(0, all.length - 50_000);
  };

  return {
    record(statusCode: number, path = ""): boolean {
      const current = now();
      all.push(current);
      if (statusCode >= 500) errors.push(current);
      prune(current);
      if (statusCode < 500 || errors.length < threshold) return false;
      const ratio = all.length ? errors.length / all.length : 1;
      if (ratio < minRatio) return false;
      void Promise.resolve(
        alert(
          "server_5xx_rate",
          [
            `:rotating_light: Blueprint web: elevated 5xx error rate`,
            `- ${errors.length} server errors in the last ${Math.round(windowMs / 60000)} min (${(ratio * 100).toFixed(1)}% of ${all.length} responses)`,
            path ? `- Latest: ${path}` : null,
            "- Check the Render logs (level=error, \"Unhandled application error\").",
          ].filter(Boolean).join("\n"),
        ),
      ).catch(() => undefined);
      return true;
    },
    snapshot() {
      prune(now());
      return { errors: errors.length, total: all.length, windowMs, threshold };
    },
  };
}

function numberEnv(key: string, fallback: number) {
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
