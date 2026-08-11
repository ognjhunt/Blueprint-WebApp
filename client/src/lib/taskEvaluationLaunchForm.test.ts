import { describe, expect, it } from "vitest";

import {
  defaultTaskEvaluationAuthorityExpiry,
  formatLocalDateTimeValue,
} from "./taskEvaluationLaunchForm";

describe("Task Evaluation launch form", () => {
  it("formats a browser-local datetime value without converting it to UTC", () => {
    const localTime = new Date(2026, 7, 11, 9, 7, 41);

    expect(formatLocalDateTimeValue(localTime)).toBe("2026-08-11T09:07");
  });

  it("defaults authority to a bounded six-hour execution window", () => {
    const now = new Date(2026, 7, 11, 9, 7, 41);

    expect(defaultTaskEvaluationAuthorityExpiry(now)).toBe("2026-08-11T15:07");
  });
});
