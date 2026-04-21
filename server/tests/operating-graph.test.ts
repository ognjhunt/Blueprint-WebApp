// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildBuyerOutcomeId,
  buildCaptureRunId,
  buildCityProgramId,
  buildHostedReviewRunId,
  buildPackageRunId,
} from "../utils/operatingGraph";
import {
  projectBuyerOutcomeState,
  projectCaptureRunState,
  projectCityProgramState,
  projectHostedReviewRunState,
  projectOperatingGraphState,
  projectPackageRunState,
} from "../utils/operatingGraphProjectors";
import type { OperatingGraphEvent } from "../utils/operatingGraphTypes";

describe("operating graph projectors", () => {
  const cityProgramId = buildCityProgramId({
    citySlug: "seattle-wa",
    budgetTier: "funded",
  });
  const captureRunId = buildCaptureRunId({ captureId: "capture-123" });
  const packageRunId = buildPackageRunId({ packageId: "package-456" });
  const hostedReviewRunId = buildHostedReviewRunId({ hostedReviewRunId: "review-789" });
  const buyerOutcomeId = buildBuyerOutcomeId({ buyerOutcomeId: "outcome-abc" });

  const events: OperatingGraphEvent[] = [
    {
      id: "city-1",
      event_key: "launch:start",
      entity_type: "city_program",
      entity_id: cityProgramId,
      city: "Seattle, WA",
      city_slug: "seattle-wa",
      stage: "city_selected",
      summary: "City selected.",
      source_repo: "Blueprint-WebApp",
      source_kind: "city_launch_execution",
      origin: { repo: "Blueprint-WebApp" },
      blocking_conditions: [],
      external_confirmations: [],
      next_actions: [],
      metadata: { city_program_id: cityProgramId },
      recorded_at_iso: "2026-04-20T10:00:00.000Z",
      recorded_at: "2026-04-20T10:00:00.000Z",
    },
    {
      id: "capture-1",
      event_key: "capture:start",
      entity_type: "capture_run",
      entity_id: captureRunId,
      city: "Seattle, WA",
      city_slug: "seattle-wa",
      stage: "capture_in_progress",
      summary: "Capture started.",
      source_repo: "BlueprintCapture",
      source_kind: "capture_upload",
      origin: { repo: "BlueprintCapture" },
      blocking_conditions: [],
      external_confirmations: [],
      next_actions: [],
      metadata: {
        capture_id: "capture-123",
        site_submission_id: "submission-9",
        capture_job_id: "job-1",
      },
      recorded_at_iso: "2026-04-20T10:01:00.000Z",
      recorded_at: "2026-04-20T10:01:00.000Z",
    },
    {
      id: "capture-2",
      event_key: "capture:uploaded",
      entity_type: "capture_run",
      entity_id: captureRunId,
      city: "Seattle, WA",
      city_slug: "seattle-wa",
      stage: "capture_uploaded",
      summary: "Capture uploaded.",
      source_repo: "BlueprintCapture",
      source_kind: "capture_upload",
      origin: { repo: "BlueprintCapture" },
      blocking_conditions: [],
      external_confirmations: [],
      next_actions: [],
      metadata: {
        capture_id: "capture-123",
        site_submission_id: "submission-9",
        capture_job_id: "job-1",
      },
      recorded_at_iso: "2026-04-20T10:02:00.000Z",
      recorded_at: "2026-04-20T10:02:00.000Z",
    },
    {
      id: "package-1",
      event_key: "package:start",
      entity_type: "package_run",
      entity_id: packageRunId,
      city: "Seattle, WA",
      city_slug: "seattle-wa",
      stage: "pipeline_packaging",
      summary: "Package workflow started.",
      source_repo: "Blueprint-WebApp",
      source_kind: "pipeline_sync",
      origin: { repo: "Blueprint-WebApp" },
      blocking_conditions: [],
      external_confirmations: [],
      next_actions: [],
      metadata: {
        package_id: "package-456",
        capture_id: "capture-123",
        site_submission_id: "submission-9",
      },
      recorded_at_iso: "2026-04-20T10:03:00.000Z",
      recorded_at: "2026-04-20T10:03:00.000Z",
    },
    {
      id: "package-2",
      event_key: "package:ready",
      entity_type: "package_run",
      entity_id: packageRunId,
      city: "Seattle, WA",
      city_slug: "seattle-wa",
      stage: "package_ready",
      summary: "Package is ready.",
      source_repo: "Blueprint-WebApp",
      source_kind: "pipeline_sync",
      origin: { repo: "Blueprint-WebApp" },
      blocking_conditions: [],
      external_confirmations: [],
      next_actions: [],
      metadata: {
        package_id: "package-456",
        capture_id: "capture-123",
        site_submission_id: "submission-9",
      },
      recorded_at_iso: "2026-04-20T10:04:00.000Z",
      recorded_at: "2026-04-20T10:04:00.000Z",
    },
    {
      id: "review-1",
      event_key: "review:start",
      entity_type: "hosted_review_run",
      entity_id: hostedReviewRunId,
      city: "Seattle, WA",
      city_slug: "seattle-wa",
      stage: "hosted_review_started",
      summary: "Hosted review started.",
      source_repo: "Blueprint-WebApp",
      source_kind: "hosted_session_runtime",
      origin: { repo: "Blueprint-WebApp" },
      blocking_conditions: [],
      external_confirmations: [],
      next_actions: [],
      metadata: {
        hosted_review_run_id: "review-789",
        package_id: "package-456",
        capture_id: "capture-123",
        buyer_request_id: "buyer-request-12",
        buyer_account_id: "buyer-77",
      },
      recorded_at_iso: "2026-04-20T10:05:00.000Z",
      recorded_at: "2026-04-20T10:05:00.000Z",
    },
    {
      id: "outcome-1",
      event_key: "outcome:recorded",
      entity_type: "buyer_outcome",
      entity_id: buyerOutcomeId,
      city: "Seattle, WA",
      city_slug: "seattle-wa",
      stage: "buyer_outcome_recorded",
      summary: "Buyer outcome recorded.",
      source_repo: "Blueprint-WebApp",
      source_kind: "buyer_outcome_ledger",
      origin: { repo: "Blueprint-WebApp" },
      blocking_conditions: [],
      external_confirmations: [],
      next_actions: [],
      metadata: {
        buyer_outcome_id: "outcome-abc",
        hosted_review_run_id: "review-789",
        package_id: "package-456",
        capture_id: "capture-123",
        buyer_account_id: "buyer-77",
      },
      recorded_at_iso: "2026-04-20T10:06:00.000Z",
      recorded_at: "2026-04-20T10:06:00.000Z",
    },
  ];

  it("projects city program state without mixing unrelated entity events", () => {
    const projection = projectCityProgramState(events, cityProgramId);
    expect(projection).not.toBeNull();
    expect(projection?.entityType).toBe("city_program");
    expect(projection?.cityProgramId).toBe(cityProgramId);
    expect(projection?.currentStage).toBe("city_selected");
    expect(projection?.canonicalForeignKeys.cityProgramId).toBe(cityProgramId);
    expect(projection?.latestSummary).toBe("City selected.");
  });

  it("projects capture run state from capture events only", () => {
    const projection = projectCaptureRunState(events, captureRunId);
    expect(projection).not.toBeNull();
    expect(projection?.entityType).toBe("capture_run");
    expect(projection?.captureRunId).toBe(captureRunId);
    expect(projection?.currentStage).toBe("capture_uploaded");
    expect(projection?.latestSummary).toBe("Capture uploaded.");
    expect(projection?.captureId).toBe("capture-123");
    expect(projection?.siteSubmissionId).toBe("submission-9");
    expect(projection?.captureJobId).toBe("job-1");
    expect(projection?.canonicalForeignKeys.captureId).toBe("capture-123");
    expect(projection?.stateKey).toBe(captureRunId);
  });

  it("uses the latest event stage as current stage instead of the max stage ever seen", () => {
    const reopenedEvents: OperatingGraphEvent[] = [
      {
        ...events[0],
        id: "reopen-1",
        entity_type: "capture_run",
        entity_id: captureRunId,
        stage: "capture_uploaded",
        summary: "Capture uploaded.",
        recorded_at_iso: "2026-04-20T11:00:00.000Z",
        recorded_at: "2026-04-20T11:00:00.000Z",
      },
      {
        ...events[0],
        id: "reopen-2",
        entity_type: "capture_run",
        entity_id: captureRunId,
        stage: "capture_in_progress",
        summary: "Capture reopened for retry.",
        recorded_at_iso: "2026-04-20T11:05:00.000Z",
        recorded_at: "2026-04-20T11:05:00.000Z",
      },
    ];

    const projection = projectCaptureRunState(reopenedEvents, captureRunId);
    expect(projection?.currentStage).toBe("capture_in_progress");
    expect(projection?.stagesSeen).toEqual([
      "capture_in_progress",
      "capture_uploaded",
    ]);
    expect(projection?.latestSummary).toBe("Capture reopened for retry.");
  });

  it("projects package run state from package events only", () => {
    const projection = projectPackageRunState(events, packageRunId);
    expect(projection).not.toBeNull();
    expect(projection?.entityType).toBe("package_run");
    expect(projection?.packageRunId).toBe(packageRunId);
    expect(projection?.currentStage).toBe("package_ready");
    expect(projection?.packageId).toBe("package-456");
    expect(projection?.captureId).toBe("capture-123");
    expect(projection?.siteSubmissionId).toBe("submission-9");
    expect(projection?.latestSummary).toBe("Package is ready.");
  });

  it("projects hosted review run state with buyer linkage", () => {
    const projection = projectHostedReviewRunState(events, hostedReviewRunId);
    expect(projection).not.toBeNull();
    expect(projection?.entityType).toBe("hosted_review_run");
    expect(projection?.hostedReviewRunId).toBe(hostedReviewRunId);
    expect(projection?.currentStage).toBe("hosted_review_started");
    expect(projection?.packageId).toBe("package-456");
    expect(projection?.captureId).toBe("capture-123");
    expect(projection?.buyerRequestId).toBe("buyer-request-12");
    expect(projection?.buyerAccountId).toBe("buyer-77");
  });

  it("projects buyer outcome state with explicit outcome linkage", () => {
    const projection = projectBuyerOutcomeState(events, buyerOutcomeId);
    expect(projection).not.toBeNull();
    expect(projection?.entityType).toBe("buyer_outcome");
    expect(projection?.buyerOutcomeId).toBe(buyerOutcomeId);
    expect(projection?.currentStage).toBe("buyer_outcome_recorded");
    expect(projection?.hostedReviewRunId).toBe("review-789");
    expect(projection?.packageId).toBe("package-456");
    expect(projection?.captureId).toBe("capture-123");
    expect(projection?.buyerAccountId).toBe("buyer-77");
    expect(projection?.latestEventId).toBe("outcome-1");
  });

  it("exposes the generic operating graph state helper", () => {
    const projection = projectOperatingGraphState(events, "capture_run", captureRunId);
    expect(projection).not.toBeNull();
    expect(projection?.entityType).toBe("capture_run");
    expect(projection?.entityId).toBe(captureRunId);
    expect(projection?.stateKey).toBe(captureRunId);
    expect(projection?.blockingConditions).toHaveLength(0);
  });

  it("prefers explicit run ids when building run-scoped entity ids", () => {
    expect(
      buildCaptureRunId({
        captureRunId: "capture-run-2",
        captureId: "capture-123",
      }),
    ).toBe("capture_run:capture-run-2");
    expect(
      buildPackageRunId({
        packageRunId: "package-run-2",
        packageId: "package-456",
      }),
    ).toBe("package_run:package-run-2");
  });
});
