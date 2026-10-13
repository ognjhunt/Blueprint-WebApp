// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const userDocs = vi.hoisted(() => new Map<string, Record<string, unknown>>());
const sendSlackMessage = vi.hoisted(() => vi.fn(async () => ({ sent: true })));
const logger = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), fatal: vi.fn() }));

vi.mock("../logger", () => ({ logger }));
vi.mock("../utils/slack", () => ({ sendSlackMessage }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  authAdmin: null,
  dbAdmin: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => ({ exists: userDocs.has(id), data: () => userDocs.get(id) }),
      }),
    }),
  },
}));
vi.mock("../utils/taskEvaluationLaunchStore", () => ({ withTaskEvaluationLaunchStoreTimeout: (p: Promise<unknown>) => p }));

import { resolveAllowedOrigins } from "../utils/corsOrigins";
import { resolveAccessContext } from "../utils/access-control";
import { isResendQuotaError } from "../utils/email";

afterEach(() => {
  vi.unstubAllEnvs();
  userDocs.clear();
  logger.warn.mockReset();
  sendSlackMessage.mockClear();
  vi.resetModules();
});

describe("CORS default allowlist", () => {
  it("defaults to the public hostnames only in production", () => {
    expect(resolveAllowedOrigins(undefined, "production")).toEqual(["https://tryblueprint.io", "https://www.tryblueprint.io"]);
    expect(resolveAllowedOrigins("", "production").some((origin) => origin.includes("localhost"))).toBe(false);
  });
  it("keeps localhost as a development default and honours an explicit list", () => {
    expect(resolveAllowedOrigins(undefined, "development")).toContain("http://localhost:5000");
    expect(resolveAllowedOrigins(" https://a.example , https://b.example ", "production")).toEqual(["https://a.example", "https://b.example"]);
  });
});

describe("admin role sources", () => {
  const res = (user: Record<string, unknown>) => ({ locals: { firebaseUser: user } }) as never;

  it("grants roles from custom claims and the verified-email allowlist", async () => {
    expect((await resolveAccessContext(res({ uid: "c", admin: true }))).isAdmin).toBe(true);
    vi.stubEnv("BLUEPRINT_ADMIN_EMAIL_ALLOWLIST", "Founder@Example.com");
    expect((await resolveAccessContext(res({ uid: "f", email: "founder@example.com", email_verified: true }))).isAdmin).toBe(true);
    expect((await resolveAccessContext(res({ uid: "f", email: "founder@example.com", email_verified: false }))).isAdmin).toBe(false);
  });

  it("keeps legacy users-doc roles working but logs them, and can turn them off", async () => {
    userDocs.set("legacy", { admin: true });
    expect((await resolveAccessContext(res({ uid: "legacy" }))).isAdmin).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "admin_role_from_user_doc", uid: "legacy" }), expect.any(String));
    vi.stubEnv("BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK", "0");
    expect((await resolveAccessContext(res({ uid: "legacy" }))).isAdmin).toBe(false);
  });

  it("does not log a doc role that a claim already grants", async () => {
    userDocs.set("both", { admin: true });
    await resolveAccessContext(res({ uid: "both", admin: true }));
    expect(logger.warn).not.toHaveBeenCalled();
  });
});

describe("hosted session UI signing secret", () => {
  it("refuses to sign with the public dev fallback in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BLUEPRINT_SESSION_UI_TOKEN_SECRET", "");
    vi.stubEnv("PIPELINE_SYNC_TOKEN", "");
    const { createHostedSessionUiToken, verifyHostedSessionUiToken } = await import("../utils/hosted-session-ui-auth");
    expect(() => createHostedSessionUiToken("session-1")).toThrow(/signing secret is required/);
    // A token minted with the old public fallback must not verify.
    vi.stubEnv("NODE_ENV", "development");
    const forged = createHostedSessionUiToken("session-1");
    vi.stubEnv("NODE_ENV", "production");
    expect(verifyHostedSessionUiToken(forged, "session-1")).toBeNull();
  });

  it("signs and verifies with a configured secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BLUEPRINT_SESSION_UI_TOKEN_SECRET", "configured-secret");
    const { createHostedSessionUiToken, verifyHostedSessionUiToken } = await import("../utils/hosted-session-ui-auth");
    expect(verifyHostedSessionUiToken(createHostedSessionUiToken("s"), "s")).toMatchObject({ sessionId: "s" });
  });
});

describe("launch readiness alerting", () => {
  it("alerts when the first readiness snapshot after boot is not ready", async () => {
    const { maybeAlertOnLaunchReadinessTransition } = await import("../utils/ops-alerts");
    await maybeAlertOnLaunchReadinessTransition({ status: "not_ready", blockers: ["redis: REDIS_URL is not set"], warnings: [], checks: {} });
    expect(sendSlackMessage).toHaveBeenCalledWith(expect.stringContaining("NOT ready after boot"));
    expect(sendSlackMessage).toHaveBeenCalledWith(expect.stringContaining("REDIS_URL"));
    // The same state on the next check does not repeat.
    await maybeAlertOnLaunchReadinessTransition({ status: "not_ready", blockers: [], warnings: [], checks: {} });
    expect(sendSlackMessage).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the first snapshot is ready", async () => {
    const { maybeAlertOnLaunchReadinessTransition } = await import("../utils/ops-alerts");
    await maybeAlertOnLaunchReadinessTransition({ status: "ready", blockers: [], warnings: [], checks: {} });
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });
});

describe("Resend quota detection", () => {
  it("recognises quota rejections and not ordinary failures", () => {
    expect(isResendQuotaError({ name: "daily_quota_exceeded", statusCode: 429 })).toBe(true);
    expect(isResendQuotaError({ name: "monthly_quota_exceeded", statusCode: 429 })).toBe(true);
    expect(isResendQuotaError({ statusCode: 429, message: "You have reached your daily email sending quota" })).toBe(true);
    expect(isResendQuotaError({ name: "rate_limit_exceeded", statusCode: 429, message: "Too many requests" })).toBe(false);
    expect(isResendQuotaError({ name: "validation_error", statusCode: 422 })).toBe(false);
    expect(isResendQuotaError(null)).toBe(false);
  });
});
