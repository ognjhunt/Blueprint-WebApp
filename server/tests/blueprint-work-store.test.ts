// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getProfile: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  authAdmin: { getUser: mocks.getUser, tenantManager: () => ({ authForTenant: () => ({ getUser: mocks.getUser }) }) },
  dbAdmin: { collection: mocks.getProfile },
}));
import { checkWorkOperator } from "../utils/blueprintWorkStore";
beforeEach(() => { vi.clearAllMocks(); });
describe("Work uses current server-owned Firebase execution authority", () => {
  const identity = { uid: "one", tenantId: null, authTime: 1000 };
  it("does not accept browser profile roles or a normal user", async () => {
    mocks.getUser.mockResolvedValue({ disabled: false, customClaims: {} });
    expect(await checkWorkOperator(identity)).toBe(false);
    expect(mocks.getProfile).not.toHaveBeenCalled();
  });
  it("accepts a current operator but refuses disabled users and revoked login sessions", async () => {
    mocks.getUser.mockResolvedValue({ disabled: false, customClaims: { roles: ["ops"] }, tokensValidAfterTime: new Date(500000).toISOString() });
    expect(await checkWorkOperator(identity)).toBe(true);
    mocks.getUser.mockResolvedValue({ disabled: true, customClaims: { admin: true } });
    expect(await checkWorkOperator(identity)).toBe(false);
    mocks.getUser.mockResolvedValue({ disabled: false, customClaims: { admin: true }, tokensValidAfterTime: new Date(1001000).toISOString() });
    expect(await checkWorkOperator(identity)).toBe(false);
    mocks.getUser.mockRejectedValue(new Error("unavailable"));
    expect(await checkWorkOperator(identity)).toBe(false);
  });
});
