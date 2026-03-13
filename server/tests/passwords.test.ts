// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const bcryptState = vi.hoisted(() => ({
  hash: vi.fn(async (password: string) => `$2mock$${password}`),
  compare: vi.fn(async (password: string, hashed: string) => hashed === `$2mock$${password}`),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: bcryptState.hash,
    compare: bcryptState.compare,
  },
}));

import { hashPassword, verifyPassword } from "../utils/passwords";

describe("password hashing", () => {
  beforeEach(() => {
    bcryptState.hash.mockClear();
    bcryptState.compare.mockClear();
  });

  it("hashes passwords with a salt", async () => {
    const password = "SuperSecure123!";
    const hashed = await hashPassword(password);

    expect(hashed).not.toBe(password);
    expect(hashed.startsWith("$2")).toBe(true);
  });

  it("verifies matching passwords", async () => {
    const password = "AnotherSecure123!";
    const hashed = await hashPassword(password);

    await expect(verifyPassword(password, hashed)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", hashed)).resolves.toBe(false);
    expect(bcryptState.compare).toHaveBeenCalledTimes(2);
  });
});
