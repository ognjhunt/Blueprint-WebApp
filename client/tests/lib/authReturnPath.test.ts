import { describe, expect, it } from "vitest";
import { resultSignInHref } from "@/lib/authReturnPath";

describe("result sign-in return path", () => {
  it("keeps a valid result URL through sign-in", () => {
    expect(resultSignInHref("/app/results/capture-run-123"))
      .toBe("/sign-in?next=%2Fapp%2Fresults%2Fcapture-run-123");
  });

  it("ignores unrelated paths", () => {
    expect(resultSignInHref("//outside.example/app/results/123")).toBe("/sign-in");
    expect(resultSignInHref("/app/runs")).toBe("/sign-in");
  });
});
