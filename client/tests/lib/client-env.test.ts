// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  getCaptureAppPlaceholderUrl,
  resetClientEnvCacheForTests,
} from "@/lib/client-env";

describe("client env capture-app fallback", () => {
  afterEach(() => {
    resetClientEnvCacheForTests();
  });

  it("does not fall back to localhost in production when no app URL is configured", () => {
    const originalMode = import.meta.env.MODE;
    import.meta.env.MODE = "production";

    expect(getCaptureAppPlaceholderUrl()).toBe("/capture-app");

    import.meta.env.MODE = originalMode;
  });
});
