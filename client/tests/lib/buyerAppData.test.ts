import { describe, expect, it } from "vitest";

import { runStatusLabel } from "@/lib/buyerAppData";

describe("buyer app run status labels", () => {
  it("does not turn an absent run status into an operational state", () => {
    expect(runStatusLabel(null)).toBe("Not recorded");
    expect(runStatusLabel(undefined)).toBe("Not recorded");
  });
});
