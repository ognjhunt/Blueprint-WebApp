/**
 * The start form's account from an email alone (owner decision 2026-10-28).
 *
 * Nobody chooses or sees its password, so the only ways back in are the ones
 * that take the inbox. This pins that the secret is fresh and strong, and
 * passes a password policy that asks for every character class.
 */
import { describe, expect, it } from "vitest";

import { unseenAccountSecret } from "@/lib/accountAuth";

describe("unseenAccountSecret", () => {
  it("is 32 random bytes plus one character of each class, and never repeats", () => {
    const secrets = Array.from({ length: 50 }, () => unseenAccountSecret());
    for (const secret of secrets) {
      expect(secret).toMatch(/^[A-Za-z0-9_-]{43}-Aa1$/);
      expect(secret).toMatch(/[a-z]/);
      expect(secret).toMatch(/[A-Z]/);
      expect(secret).toMatch(/[0-9]/);
      expect(secret).toMatch(/[^A-Za-z0-9]/);
    }
    expect(new Set(secrets).size).toBe(secrets.length);
  });
});
