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

  // The record main wrote before Privacy 2026-11-13.1, for the same inputs: that version does not touch retention.
  it.each([
    ["2026-11-12T07:59:59.000Z", true],
    ["2026-11-12T08:00:00.000Z", false],
    ["2026-11-12T20:00:00.000Z", false],
    ["2026-11-13T09:00:00.000Z", false],
  ])("keeps the record of the version that announced the retention change for a capture received %s", (date, before) => {
    expect(websiteCaptureRetention(date)).toMatchObject({ policy_id: "website_capture_retention_review.v1",
      first_received_at_iso: date, announced_privacy_version: "2026-11-12.2", prior_privacy_version: "2026-11-02.1",
      received_before_announced_effective_date: before });
  });

  it.each([null, "not-a-date"])("keeps an unknown collection date unresolved: %s", (date) => {
    expect(websiteCaptureRetention(date)).toMatchObject({ first_received_at_iso: null,
      prior_policy_may_apply: true, collection_policy_version: null, extension_authorized: false });
  });
});
