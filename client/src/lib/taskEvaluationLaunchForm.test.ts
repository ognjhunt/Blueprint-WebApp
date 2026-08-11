import { describe, expect, it } from "vitest";

import {
  defaultTaskEvaluationAuthorityExpiry,
  formatLocalDateTimeValue,
  formatTaskEvaluationMaxSpend,
  taskEvaluationSpendCoversProfile,
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

  it("formats and enforces the selected immutable profile spend requirement", () => {
    expect(formatTaskEvaluationMaxSpend(6)).toBe("6.00");
    expect(taskEvaluationSpendCoversProfile("6.00", 6)).toBe(true);
    expect(taskEvaluationSpendCoversProfile("5.99", 6)).toBe(false);
    expect(taskEvaluationSpendCoversProfile("2.00", undefined)).toBe(true);
  });
});
