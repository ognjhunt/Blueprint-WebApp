import { describe, expect, it } from "vitest";

import { friendlyAuthError } from "@/lib/siteClaim";

describe("sign-in errors", () => {
  it("turns known Firebase codes into sentences and never shows a raw code", () => {
    const tooMany = Object.assign(new Error("Firebase: Error (auth/too-many-requests)."), { code: "auth/too-many-requests" });
    expect(friendlyAuthError(tooMany, "fallback")).toBe("Too many attempts in a row. Wait a few minutes, then try again.");
    const unknown = Object.assign(new Error("Firebase: Error (auth/internal-error)."), { code: "auth/internal-error" });
    expect(friendlyAuthError(unknown, "We could not sign you in.")).toBe("We could not sign you in.");
    expect(friendlyAuthError(new Error("Firebase: Error (auth/whatever)."), "fallback")).toBe("fallback");
  });

  it("keeps a plain message and explains a network failure", () => {
    expect(friendlyAuthError(new Error("That team key is not valid any more."), "fallback")).toBe("That team key is not valid any more.");
    expect(friendlyAuthError(new TypeError("Failed to fetch"), "fallback")).toMatch(/could not reach Blueprint/);
  });
});
