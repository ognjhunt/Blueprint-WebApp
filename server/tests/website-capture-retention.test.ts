// @vitest-environment node
import { describe, expect, it } from "vitest";
import { websiteCaptureRetention } from "../utils/websiteCaptureRetention";

describe("website capture retention authority", () => {
  it("preserves the earlier collection cohort without imposing the internal seven-year floor", () => {
    expect(websiteCaptureRetention("2026-10-16T12:00:00.000Z")).toMatchObject({
      first_received_at_iso: "2026-10-16T12:00:00.000Z",
      prior_policy_may_apply: true,
      prior_policy_window_days_after_job_close: 180,
      minimum_retention_floor_days_if_delete_is_ever_introduced: null,
      extension_authorized: false,
      account_reacceptance_extends_existing_recordings: false,
      collection_policy_verification_required: true,
    });
  });

  it("does not authorize a longer period merely because the announced date passed", () => {
    expect(websiteCaptureRetention("2026-12-01T12:00:00.000Z")).toMatchObject({
      prior_policy_may_apply: true,
      received_before_announced_effective_date: false,
      collection_policy_version: null,
      extension_authorized: false,
      review_required: true,
      live_enforcement_proven_by_bundle: false,
    });
  });

  it.each([null, "not-a-date"])("keeps an unknown collection date unresolved: %s", (date) => {
    expect(websiteCaptureRetention(date)).toMatchObject({ first_received_at_iso: null,
      prior_policy_may_apply: true, collection_policy_version: null, extension_authorized: false });
  });
});
