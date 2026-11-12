/**
 * Owner request (2026-10-18): the beta's expected timeline comes from one named
 * constant the owner can change, and it promises no recommendation date.
 */
import { describe, expect, it } from "vitest";

import { REPLY_TIMELINE } from "@/data/betaTimelines";

describe("the beta's expected timeline", () => {
  it("is the owner's reply range, and dates no recommendation", () => {
    expect(REPLY_TIMELINE).toBe("We usually reply within an hour.");
    expect(REPLY_TIMELINE).not.toMatch(/recommend/i);
  });
});
