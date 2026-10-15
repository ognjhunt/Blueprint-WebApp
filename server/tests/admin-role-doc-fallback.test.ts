// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK stays on by default because production
 * roles cannot be audited from the repo. What these pin is the evidence the
 * founder needs before setting it to 0: every authorisation that rests only on
 * a users-doc role is counted, and logged (at most hourly per uid) with what
 * the caller would keep without the fallback.
 */

const userDocs = vi.hoisted(() => new Map<string, Record<string, unknown>>());
const logger = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock("../logger", () => ({ logger }));
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
vi.mock("../utils/taskEvaluationLaunchStore", () => ({
  withTaskEvaluationLaunchStoreTimeout: (p: Promise<unknown>) => p,
}));

const res = (user: Record<string, unknown>) => ({ locals: { firebaseUser: user } }) as never;

async function load() {
  return import("../utils/access-control");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  userDocs.clear();
  logger.warn.mockReset();
});

describe("users-doc role fallback evidence", () => {
  it("logs a structured warning naming the doc-only role and what claims/allowlist still grant", async () => {
    userDocs.set("legacy-ops", { roles: ["admin", "ops"] });
    vi.stubEnv("BLUEPRINT_OPS_EMAIL_ALLOWLIST", "ops@example.com");
    const { resolveAccessContext } = await load();

    const context = await resolveAccessContext(
      res({ uid: "legacy-ops", email: "ops@example.com", email_verified: true }),
    );

    expect(context.isAdmin).toBe(true);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      {
        event: "admin_role_from_user_doc",
        metric: "admin_role_doc_fallback_grant",
        uid: "legacy-ops",
        roles: ["admin"],
        claimRoles: [],
        allowlistRoles: ["ops"],
        deniedWhenFallbackOff: true,
        fallbackSetting: "BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK",
        docOnlyGrantsSinceBoot: 1,
        docOnlyPrincipalsSinceBoot: 1,
      },
      expect.stringContaining("BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK=0"),
    );
  });

  it("counts every doc-only grant but logs each uid at most hourly", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T12:00:00Z"));
    userDocs.set("a", { admin: true });
    userDocs.set("b", { role: "ops" });
    const { resolveAccessContext, adminRoleDocFallbackStatus } = await load();

    await resolveAccessContext(res({ uid: "a" }));
    await resolveAccessContext(res({ uid: "a" }));
    await resolveAccessContext(res({ uid: "b" }));
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(adminRoleDocFallbackStatus()).toEqual({
      fallbackEnabled: true,
      docOnlyGrantsSinceBoot: 3,
      docOnlyPrincipalsSinceBoot: 2,
      lastDocOnlyGrantAt: "2026-10-14T12:00:00.000Z",
    });

    vi.setSystemTime(new Date("2026-10-14T13:00:01Z"));
    await resolveAccessContext(res({ uid: "a" }));
    expect(logger.warn).toHaveBeenCalledTimes(3);
    expect(adminRoleDocFallbackStatus().docOnlyGrantsSinceBoot).toBe(4);
  });

  it("neither logs nor counts a doc role that a custom claim already grants", async () => {
    userDocs.set("claimed", { admin: true });
    const { resolveAccessContext, adminRoleDocFallbackStatus } = await load();

    await resolveAccessContext(res({ uid: "claimed", admin: true }));

    expect(logger.warn).not.toHaveBeenCalled();
    expect(adminRoleDocFallbackStatus().docOnlyGrantsSinceBoot).toBe(0);
  });

  it("with the fallback off, grants nothing from the doc and records nothing", async () => {
    vi.stubEnv("BLUEPRINT_ADMIN_ROLE_DOC_FALLBACK", "0");
    userDocs.set("legacy", { admin: true });
    const { resolveAccessContext, adminRoleDocFallbackStatus } = await load();

    expect((await resolveAccessContext(res({ uid: "legacy" }))).isAdmin).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(adminRoleDocFallbackStatus()).toMatchObject({ fallbackEnabled: false, docOnlyGrantsSinceBoot: 0 });
  });
});
