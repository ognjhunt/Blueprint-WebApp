// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { disablePublicSignup } from "./disable-public-signup.mjs";
describe("Firebase public signup release gate", () => {
  it("audits without changing permissions and prints no configuration keys", async () => {
    const request = vi.fn(async () => ({ data: { client: { apiKey: "private-receipt-sentinel", permissions: { disabledUserDeletion: true } } } }));
    const result = await disablePublicSignup(request, "blueprint-8c1ca");
    expect(request).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ projectId: "blueprint-8c1ca", applied: false, disabledUserSignup: false, disabledUserDeletion: true });
  });
  it("uses only the signup update mask, preserves deletion policy and verifies the readback", async () => {
    const request = vi.fn().mockResolvedValueOnce({ data: { client: { permissions: { disabledUserDeletion: true } } } })
      .mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: { client: { permissions: { disabledUserSignup: true, disabledUserDeletion: true } } } });
    expect(await disablePublicSignup(request, "blueprint-8c1ca", true)).toMatchObject({ applied: true, disabledUserSignup: true, disabledUserDeletion: true });
    expect(request.mock.calls[1][0]).toMatchObject({ method: "PATCH", params: { updateMask: "client.permissions.disabledUserSignup" }, data: { client: { permissions: { disabledUserSignup: true } } } });
  });
  it("fails a release when Firebase readback still allows signup", async () => {
    await expect(disablePublicSignup(async () => ({ data: {} }), "blueprint-8c1ca", true)).rejects.toThrow("did not confirm");
  });
});
