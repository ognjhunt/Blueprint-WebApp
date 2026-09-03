import { describe, expect, it } from "vitest";

import {
  GLOBAL_RATE_LIMIT_SKIP_PATHS,
  globalRateLimitSkipsPath,
} from "../utils/globalRateLimitPolicy";

describe("global API rate-limit policy", () => {
  it("exempts only signed result byte delivery, not ticket authorization", () => {
    expect(GLOBAL_RATE_LIMIT_SKIP_PATHS).toContain(
      "/task-evaluation-result-downloads",
    );
    expect(globalRateLimitSkipsPath(
      "/task-evaluation-result-downloads/result-1/video?expires=1&signature=x",
    )).toBe(true);
    expect(globalRateLimitSkipsPath(
      "/task-evaluation-results/result-1/artifacts/video/ticket",
    )).toBe(false);
  });
});
