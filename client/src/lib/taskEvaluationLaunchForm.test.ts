import { describe, expect, it } from "vitest";

import {
  defaultTaskEvaluationAuthorityExpiry,
  formatLocalDateTimeValue,
  prefillTaskEvaluationMaxSpend,
  requiredTaskEvaluationMaxSpendUsd,
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

  it("reads the required spend only from a well-formed catalog projection", () => {
    expect(
      requiredTaskEvaluationMaxSpendUsd({
        required_authorization: { max_spend_usd: 6, hard_ttl_seconds: 5400 },
      }),
    ).toBe(6);
    expect(requiredTaskEvaluationMaxSpendUsd(undefined)).toBeNull();
    expect(requiredTaskEvaluationMaxSpendUsd({})).toBeNull();
    expect(
      requiredTaskEvaluationMaxSpendUsd({ required_authorization: { max_spend_usd: 0 } }),
    ).toBeNull();
    expect(
      requiredTaskEvaluationMaxSpendUsd({
        required_authorization: { max_spend_usd: Number.NaN },
      }),
    ).toBeNull();
  });

  it("prefills the authorized spend from the profile requirement", () => {
    const profile = {
      required_authorization: { max_spend_usd: 6, hard_ttl_seconds: 5400 },
    };

    expect(prefillTaskEvaluationMaxSpend(profile, "2.00")).toBe("6.00");
    expect(prefillTaskEvaluationMaxSpend(undefined, "2.00")).toBe("2.00");
    expect(prefillTaskEvaluationMaxSpend({}, "3.50")).toBe("3.50");
  });
});
