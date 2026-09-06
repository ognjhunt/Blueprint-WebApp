// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
const state = vi.hoisted(() => ({
  claims: {} as Record<string, unknown>,
  disabled: false,
  profileRead: vi.fn(),
  tenant: vi.fn(),
}));
vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const auth = {
    getUser: async () => ({
      customClaims: state.claims,
      disabled: state.disabled,
      email: "operator@example.com",
    }),
  };
  return {
    dbAdmin: { collection: state.profileRead },
    authAdmin: {
      ...auth,
      tenantManager: () => ({
        authForTenant: (tenant: string) => {
          state.tenant(tenant);
          return auth;
        },
      }),
    },
  };
});
import { resolveExecutionAccessContext } from "../utils/access-control";
import { requireExecutionRole } from "../middleware/requireAdminRole";
beforeEach(() => {
  state.claims = {};
  state.disabled = false;
  state.profileRead.mockReset();
  state.tenant.mockReset();
});
describe("verified paid execution roles", () => {
  it("does not read formerly client-writable profiles or trust stale principal roles", async () => {
    const res = {
      locals: {
        firebaseUser: { uid: "operator", admin: true, roles: ["ops"] },
      },
    } as unknown as Response;
    expect(await resolveExecutionAccessContext(res)).toMatchObject({
      uid: "operator",
      isAdmin: false,
      isOps: false,
    });
    expect(state.profileRead).not.toHaveBeenCalled();
  });
  it("admits existing live operator claims in the exact Firebase tenant and rejects disabled users", async () => {
    state.claims = { ops: true };
    const res = {
      locals: {
        firebaseUser: { uid: "operator", firebase: { tenant: "tenant-one" } },
      },
    } as unknown as Response;
    expect(await resolveExecutionAccessContext(res)).toMatchObject({
      isOps: true,
      isAdmin: false,
    });
    expect(state.tenant).toHaveBeenCalledWith("tenant-one");
    state.disabled = true;
    expect(await resolveExecutionAccessContext(res)).toMatchObject({
      isOps: false,
    });
  });
  it("fails the paid-route middleware closed before its handler", async () => {
    const res = {
      locals: { firebaseUser: { uid: "operator" } },
      status: vi.fn(),
      json: vi.fn(),
    } as unknown as Response;
    vi.mocked(res.status).mockReturnValue(res);
    const next = vi.fn();
    await requireExecutionRole({} as any, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    state.claims = { admin: true };
    await requireExecutionRole({} as any, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
