// @vitest-environment node
/**
 * A deployed production service that cannot alert anyone, cannot send email,
 * has no shared rate-limit store, or queues Stripe events nobody drains must
 * say so in /health/ready.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, default: {} }));
vi.mock("../utils/hosted-session-live-store", () => ({
  getHostedSessionLiveStoreStatus: () => ({ backend: "memory", redisConfigured: false, redisConnected: false }),
}));

import { buildLaunchReadinessSnapshot } from "../utils/launch-readiness";

const CHANNEL_ENV = [
  "SLACK_WEBHOOK_URL", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "REDIS_URL", "RATE_LIMIT_REDIS_URL",
  "BLUEPRINT_READINESS_REDIS_WAIVED", "BLUEPRINT_STRIPE_WEBHOOK_QUEUE", "BLUEPRINT_STRIPE_WEBHOOK_INLINE",
  "BLUEPRINT_STRIPE_WEBHOOK_QUEUE_CONSUMER_CONFIRMED", "BLUEPRINT_LOCAL_LAUNCH_SMOKE", "BASE_URL",
  "BLUEPRINT_EMAIL_DELIVERY_REQUIRED", "RESEND_API_KEY_FILE",
];

function production() {
  vi.stubEnv("NODE_ENV", "production");
  for (const key of CHANNEL_ENV) vi.stubEnv(key, "");
}

function blockerKeys() {
  return buildLaunchReadinessSnapshot().blockers.map((blocker) => blocker.split(":")[0]);
}

afterEach(() => vi.unstubAllEnvs());

describe("production readiness ops channels", () => {
  it("blocks on missing Resend and warns on missing Slack and Redis in production", () => {
    production();
    const snapshot = buildLaunchReadinessSnapshot();
    const keys = blockerKeys();
    expect(keys).toContain("email");
    // Slack and Redis degrade the beta rather than break it; a blocker would
    // fail the deploy health gate and roll the whole release back.
    expect(keys).not.toEqual(expect.arrayContaining(["slackOpsAlerts"]));
    expect(keys).not.toContain("redis");
    expect(snapshot.warnings.find((w) => w.startsWith("slackOpsAlerts"))).toMatch(/SLACK_WEBHOOK_URL is not set/);
    expect(snapshot.warnings.find((w) => w.startsWith("redis"))).toMatch(/REDIS_URL is not set/);
    expect(snapshot.status).toBe("not_ready");
  });

  it("clears the Slack warning when SLACK_WEBHOOK_URL is set", () => {
    production();
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.test/x");
    expect(buildLaunchReadinessSnapshot().warnings.some((w) => w.startsWith("slackOpsAlerts"))).toBe(false);
  });

  it("records a consciously waived Redis as a warning", () => {
    production();
    vi.stubEnv("BLUEPRINT_READINESS_REDIS_WAIVED", "1");
    const snapshot = buildLaunchReadinessSnapshot();
    expect(snapshot.blockers.some((b) => b.startsWith("redis"))).toBe(false);
    expect(snapshot.warnings.find((w) => w.startsWith("redis"))).toMatch(/waived/);
    expect(snapshot.checks.redis).toBe(true);
  });

  it("blocks Stripe queue mode without a confirmed consumer, in any environment", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BLUEPRINT_STRIPE_WEBHOOK_INLINE", "");
    vi.stubEnv("BLUEPRINT_STRIPE_WEBHOOK_QUEUE", "1");
    vi.stubEnv("BLUEPRINT_STRIPE_WEBHOOK_QUEUE_CONSUMER_CONFIRMED", "");
    expect(blockerKeys()).toContain("stripeWebhookQueue");
    vi.stubEnv("BLUEPRINT_STRIPE_WEBHOOK_QUEUE_CONSUMER_CONFIRMED", "1");
    expect(blockerKeys()).not.toContain("stripeWebhookQueue");
    vi.stubEnv("BLUEPRINT_STRIPE_WEBHOOK_QUEUE_CONSUMER_CONFIRMED", "");
    vi.stubEnv("BLUEPRINT_STRIPE_WEBHOOK_INLINE", "1");
    expect(blockerKeys()).not.toContain("stripeWebhookQueue");
  });

  it("does not apply the production channel requirements to development or the loopback launch smoke", () => {
    for (const key of CHANNEL_ENV) vi.stubEnv(key, "");
    vi.stubEnv("NODE_ENV", "development");
    expect(blockerKeys()).not.toEqual(expect.arrayContaining(["slackOpsAlerts"]));
    expect(blockerKeys()).not.toContain("redis");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BLUEPRINT_LOCAL_LAUNCH_SMOKE", "1");
    vi.stubEnv("BASE_URL", "http://127.0.0.1:5000");
    const keys = blockerKeys();
    expect(keys).not.toContain("slackOpsAlerts");
    expect(keys).not.toContain("redis");
    expect(keys).not.toContain("email");
  });
});
