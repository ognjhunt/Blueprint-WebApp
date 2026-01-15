// @vitest-environment node
import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../utils/passwords";

describe("password hashing", () => {
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
  });
});
