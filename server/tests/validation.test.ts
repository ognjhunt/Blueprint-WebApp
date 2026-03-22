// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  isValidEmailAddress,
  isValidPhoneNumber,
  validateWaitlistData,
} from "../utils/validation";

describe("email validation", () => {
  it("rejects known invalid email formats", () => {
    const invalidEmails = [
      "plainaddress",
      "missing-at-sign.net",
      "user@@example.com",
      "user@.com",
      "user@domain",
      "user@domain..com",
      "user@domain,com",
      " user@domain.com",
    ];

    for (const email of invalidEmails) {
      expect(isValidEmailAddress(email)).toBe(false);
    }
  });

  it("flags invalid emails in waitlist validation", () => {
    const errors = validateWaitlistData({
      name: "Test User",
      email: "user@domain..com",
      company: "Example Co",
      city: "Durham",
      state: "NC",
      offWaitlistUrl: "https://example.com",
    });

    expect(errors.some((error) => error.field === "email")).toBe(true);
  });

  it("accepts common phone formats and rejects invalid ones", () => {
    expect(isValidPhoneNumber("(919) 555-0123")).toBe(true);
    expect(isValidPhoneNumber("+1 919 555 0123")).toBe(true);
    expect(isValidPhoneNumber("555-0123")).toBe(false);
    expect(isValidPhoneNumber("abc-def-ghij")).toBe(false);
  });
});
