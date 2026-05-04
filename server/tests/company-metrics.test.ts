// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe("company metrics projector", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("projects truthful, partial, and blocked metrics from canonical evidence", async () => {
    const { buildCompanyScoreboard } = await import("../utils/companyScoreboard");

    const scoreboard = buildCompanyScoreboard(
      {
        generatedAt: "2026-04-20T12:00:00.000Z",
        cityLaunchLedgers: [
          {
            city: "Austin, TX",
            trackedSupplyProspectsContacted: 5,
            onboardedCapturers: 2,
          },
          {
            city: "San Francisco, CA",
            trackedSupplyProspectsContacted: 4,
            onboardedCapturers: 1,
          },
        ],
        budgetEvents: [
          {
            city: "Austin, TX",
            amountUsd: 500,
            eventType: "actual",
            createdAtIso: "2026-04-18T10:00:00.000Z",
          },
          {
            city: "San Francisco, CA",
            amountUsd: 300,
            eventType: "actual",
            createdAtIso: "2026-04-19T09:00:00.000Z",
          },
        ],
        captureSubmissions: [
          {
            id: "cap-austin-1",
            captureId: "cap-austin-1",
            sceneId: "scene-austin-1",
            siteSubmissionId: "submission-austin-1",
            buyerRequestId: "buyer-request-austin-1",
            captureJobId: "job-austin-1",
            city: "Austin, TX",
            citySlug: "austin-tx",
            submittedAtIso: "2026-04-19T00:00:00.000Z",
            captureStartedAtIso: null,
            captureUploadedAtIso: "2026-04-19T00:00:00.000Z",
            uploadState: "uploaded",
            status: "submitted",
          },
          {
            id: "cap-austin-2",
            captureId: "cap-austin-2",
            sceneId: "scene-austin-2",
            siteSubmissionId: "submission-austin-2",
            buyerRequestId: "buyer-request-austin-2",
            captureJobId: "job-austin-2",
            city: "Austin, TX",
            citySlug: "austin-tx",
            submittedAtIso: "2026-04-19T02:00:00.000Z",
            captureStartedAtIso: null,
            captureUploadedAtIso: "2026-04-19T02:00:00.000Z",
            uploadState: "uploaded",
            status: "submitted",
          },
          {
            id: "cap-sf-1",
            captureId: "cap-sf-1",
            sceneId: "scene-sf-1",
            siteSubmissionId: "submission-sf-1",
            buyerRequestId: "buyer-request-sf-1",
            captureJobId: "job-sf-1",
            city: "San Francisco, CA",
            citySlug: "san-francisco-ca",
            submittedAtIso: "2026-04-19T03:00:00.000Z",
            captureStartedAtIso: null,
            captureUploadedAtIso: "2026-04-19T03:00:00.000Z",
            uploadState: "uploaded",
            status: "submitted",
          },
        ],
        operatingGraphEvents: [
          {
            id: "package-austin-1",
            event_key: "package:austin-1:ready",
            entity_type: "package_run",
            entity_id: "package_run:cap-austin-1",
            city: "Austin, TX",
            city_slug: "austin-tx",
            stage: "package_ready",
            summary: "Austin package ready.",
            source_repo: "Blueprint-WebApp",
            source_kind: "pipeline_sync",
            origin: { repo: "Blueprint-WebApp" },
            blocking_conditions: [],
            external_confirmations: [],
            next_actions: [],
            metadata: {
              capture_id: "cap-austin-1",
              site_submission_id: "submission-austin-1",
              package_id: "cap-austin-1",
            },
            recorded_at_iso: "2026-04-19T06:00:00.000Z",
            recorded_at: "2026-04-19T06:00:00.000Z",
          },
          {
            id: "package-austin-2",
            event_key: "package:austin-1:review-ready",
            entity_type: "package_run",
            entity_id: "package_run:cap-austin-1",
            city: "Austin, TX",
            city_slug: "austin-tx",
            stage: "hosted_review_ready",
            summary: "Austin hosted review ready.",
            source_repo: "Blueprint-WebApp",
            source_kind: "pipeline_sync",
            origin: { repo: "Blueprint-WebApp" },
            blocking_conditions: [],
            external_confirmations: [],
            next_actions: [],
            metadata: {
              capture_id: "cap-austin-1",
              site_submission_id: "submission-austin-1",
              package_id: "cap-austin-1",
            },
            recorded_at_iso: "2026-04-19T08:00:00.000Z",
            recorded_at: "2026-04-19T08:00:00.000Z",
          },
          {
            id: "package-sf-1",
            event_key: "package:sf-1:ready",
            entity_type: "package_run",
            entity_id: "package_run:cap-sf-1",
            city: "San Francisco, CA",
            city_slug: "san-francisco-ca",
            stage: "package_ready",
            summary: "SF package ready.",
            source_repo: "Blueprint-WebApp",
            source_kind: "pipeline_sync",
            origin: { repo: "Blueprint-WebApp" },
            blocking_conditions: [],
            external_confirmations: [],
            next_actions: [],
            metadata: {
              capture_id: "cap-sf-1",
              site_submission_id: "submission-sf-1",
              package_id: "cap-sf-1",
            },
            recorded_at_iso: "2026-04-19T10:00:00.000Z",
            recorded_at: "2026-04-19T10:00:00.000Z",
          },
          {
            id: "review-austin-start",
            event_key: "review:austin:start",
            entity_type: "hosted_review_run",
            entity_id: "hosted_review_run:req-austin",
            city: "Austin, TX",
            city_slug: "austin-tx",
            stage: "hosted_review_started",
            summary: "Austin hosted review started.",
            source_repo: "Blueprint-WebApp",
            source_kind: "buyer_review_access",
            origin: { repo: "Blueprint-WebApp" },
            blocking_conditions: [],
            external_confirmations: [],
            next_actions: [],
            metadata: {
              hosted_review_run_id: "req-austin",
              package_id: "cap-austin-1",
            },
            recorded_at_iso: "2026-04-19T10:00:00.000Z",
            recorded_at: "2026-04-19T10:00:00.000Z",
          },
          {
            id: "review-austin-followup",
            event_key: "review:austin:followup",
            entity_type: "hosted_review_run",
            entity_id: "hosted_review_run:req-austin",
            city: "Austin, TX",
            city_slug: "austin-tx",
            stage: "buyer_follow_up_in_progress",
            summary: "Austin follow-up in progress.",
            source_repo: "Blueprint-WebApp",
            source_kind: "admin_ops_follow_up",
            origin: { repo: "Blueprint-WebApp" },
            blocking_conditions: [],
            external_confirmations: [],
            next_actions: [],
            metadata: {
              hosted_review_run_id: "req-austin",
              package_id: "cap-austin-1",
            },
            recorded_at_iso: "2026-04-19T12:00:00.000Z",
            recorded_at: "2026-04-19T12:00:00.000Z",
          },
        ],
        operatingGraphStates: [],
        buyerOutcomes: [
          {
            id: "outcome-austin-1",
            buyerOutcomeId: "outcome-austin-1",
            cityProgramId: "city_program:austin-tx:unscoped",
            siteSubmissionId: "submission-austin-1",
            captureId: "cap-austin-1",
            hostedReviewRunId: "req-austin",
            buyerAccountId: "buyer-1",
            outcomeType: "won",
            outcomeStatus: "completed",
            recordedAtIso: "2026-04-20T00:00:00.000Z",
            commercialValueUsd: 25000,
          },
        ],
        humanBlockerThreads: [
          {
            id: "thread-austin",
            blockerId: "city-launch-approval-austin-tx",
            title: "Austin approval",
            channel: "email",
            gateMode: "universal_founder_inbox",
            createdAtIso: "2026-04-18T12:00:00.000Z",
            reportPaths: ["ops/paperclip/reports/city-launch-execution/austin-tx/report.md"],
          },
          {
            id: "thread-sf",
            blockerId: "city-launch-approval-san-francisco-ca",
            title: "SF approval",
            channel: "email",
            gateMode: "universal_founder_inbox",
            createdAtIso: "2026-04-19T16:00:00.000Z",
            reportPaths: ["ops/paperclip/reports/city-launch-execution/san-francisco-ca/report.md"],
          },
          {
            id: "thread-repo-local",
            blockerId: "solutions-engineering-missing-buyer-context",
            title: "Missing buyer context for Solutions Engineering review",
            channel: "repo",
            gateMode: "repo_local_no_send",
            createdAtIso: "2026-04-20T10:00:00.000Z",
            reportPaths: ["ops/paperclip/reports/solutions-engineering/review.md"],
          },
        ],
        humanBlockerDispatches: [
          {
            id: "dispatch-1",
            blockerId: "city-launch-approval-austin-tx",
            createdAtIso: "2026-04-18T12:00:00.000Z",
          },
          {
            id: "dispatch-2",
            blockerId: "city-launch-approval-austin-tx",
            createdAtIso: "2026-04-19T12:00:00.000Z",
          },
          {
            id: "dispatch-3",
            blockerId: "city-launch-approval-san-francisco-ca",
            createdAtIso: "2026-04-19T16:00:00.000Z",
          },
        ],
      },
      { generatedAt: "2026-04-20T12:00:00.000Z" },
    );

    expect(scoreboard.contract.version).toBe("2026-04-20.company-metrics.v1");

    const weeklyMetrics = Object.fromEntries(
      scoreboard.views.weekly.metrics.map((metric) => [metric.key, metric]),
    );

    expect(weeklyMetrics.capture_fill_rate_by_city.status).toBe("truthful");
    expect(weeklyMetrics.capture_fill_rate_by_city.cityValues).toEqual([
      expect.objectContaining({
        city: "Austin, TX",
        numerator: 2,
        denominator: 5,
        value: 0.4,
      }),
      expect.objectContaining({
        city: "San Francisco, CA",
        numerator: 1,
        denominator: 4,
        value: 0.25,
      }),
    ]);

    expect(weeklyMetrics.package_ready_latency.status).toBe("truthful");
    expect(weeklyMetrics.package_ready_latency.value).toBe(6.5);

    expect(weeklyMetrics.hosted_review_ready_rate.status).toBe("truthful");
    expect(weeklyMetrics.hosted_review_ready_rate.numerator).toBe(1);
    expect(weeklyMetrics.hosted_review_ready_rate.denominator).toBe(2);
    expect(weeklyMetrics.hosted_review_ready_rate.value).toBe(0.5);

    expect(weeklyMetrics.hosted_review_start_rate.value).toBe(1);
    expect(weeklyMetrics.commercial_handoff_rate.value).toBe(1);
    expect(weeklyMetrics.buyer_outcome_conversion_rate.value).toBe(1);

    expect(weeklyMetrics.city_launch_cac.status).toBe("partial");
    expect(weeklyMetrics.city_launch_cac.value).toBe(400);
    expect(weeklyMetrics.city_launch_payback_estimate.status).toBe("partial");
    expect(weeklyMetrics.city_launch_payback_estimate.value).toBeCloseTo(800 / 25000, 6);

    expect(weeklyMetrics.blocker_recurrence_rate.status).toBe("truthful");
    expect(weeklyMetrics.blocker_recurrence_rate.numerator).toBe(1);
    expect(weeklyMetrics.blocker_recurrence_rate.denominator).toBe(3);
    expect(weeklyMetrics.blocker_recurrence_rate.value).toBeCloseTo(1 / 3, 5);

    expect(weeklyMetrics.human_interrupt_rate.status).toBe("truthful");
    expect(weeklyMetrics.human_interrupt_rate.cityValues).toEqual([
      expect.objectContaining({
        city: "Austin, TX",
        numerator: 1,
        denominator: 1,
        value: 1,
      }),
      expect.objectContaining({
        city: "San Francisco, CA",
        numerator: 1,
        denominator: 1,
        value: 1,
      }),
    ]);
    expect(scoreboard.ceoOperatingScreen.needsFounder).toEqual([
      expect.objectContaining({
        id: "city-launch-approval-san-francisco-ca",
        reason: "founder_inbox_thread",
      }),
    ]);
    expect(scoreboard.ceoOperatingScreen.needsFounder).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "solutions-engineering-missing-buyer-context",
        }),
      ]),
    );
    expect(scoreboard.ceoOperatingScreen.recentChangeSummary.founderThreads).toBe(1);

    expect(weeklyMetrics.capture_to_upload_success_rate.status).toBe("blocked");
    expect(weeklyMetrics.upload_to_package_success_rate.status).toBe("truthful");
    expect(weeklyMetrics.upload_to_package_success_rate.value).toBeCloseTo(2 / 3, 5);

    expect(scoreboard.ceoOperatingScreen.captureToHostedReviewLifecycle.summary).toMatchObject({
      uploadedCaptures: 3,
      packageReadyCaptures: 2,
      hostedReviewReadyCaptures: 1,
      hostedReviewStartedCaptures: 1,
    });
    expect(scoreboard.ceoOperatingScreen.captureToHostedReviewLifecycle.rows).toEqual([
      expect.objectContaining({
        captureId: "cap-austin-1",
        currentStage: "hosted_review_started",
        completedStages: [
          "capture_uploaded",
          "package_ready",
          "hosted_review_ready",
          "hosted_review_started",
        ],
        nextMissingStage: null,
        evidenceRefs: expect.arrayContaining([
          "capture_submissions/cap-austin-1",
          "operatingGraphEvents/package-austin-1",
          "operatingGraphEvents/package-austin-2",
          "operatingGraphEvents/review-austin-start",
        ]),
      }),
      expect.objectContaining({
        captureId: "cap-austin-2",
        currentStage: "capture_uploaded",
        completedStages: ["capture_uploaded"],
        nextMissingStage: "pipeline_packaging",
        evidenceRefs: ["capture_submissions/cap-austin-2"],
      }),
      expect.objectContaining({
        captureId: "cap-sf-1",
        currentStage: "package_ready",
        completedStages: ["capture_uploaded", "package_ready"],
        nextMissingStage: "hosted_review_ready",
        evidenceRefs: expect.arrayContaining([
          "capture_submissions/cap-sf-1",
          "operatingGraphEvents/package-sf-1",
        ]),
      }),
    ]);
  });
});

describe("admin company metrics route", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns the company scoreboard for an ops user", async () => {
    const collectCompanyScoreboard = vi.fn(async () => ({
      generatedAt: "2026-04-20T12:00:00.000Z",
      contract: {
        version: "2026-04-20.company-metrics.v1",
        metrics: [],
      },
      views: {
        daily: {
          window: {
            key: "daily",
            lookbackDays: 1,
            startAt: "2026-04-19T12:00:00.000Z",
            endAt: "2026-04-20T12:00:00.000Z",
          },
          metrics: [],
          summary: {
            truthfulCount: 0,
            partialCount: 0,
            blockedCount: 0,
          },
        },
        weekly: {
          window: {
            key: "weekly",
            lookbackDays: 7,
            startAt: "2026-04-13T12:00:00.000Z",
            endAt: "2026-04-20T12:00:00.000Z",
          },
          metrics: [],
          summary: {
            truthfulCount: 0,
            partialCount: 0,
            blockedCount: 0,
          },
        },
      },
    }));

    vi.doMock("../utils/companyScoreboard", () => ({
      COMPANY_SCOREBOARD_VERSION: "2026-04-20.company-scoreboard.v1",
      collectCompanyScoreboard,
    }));
    vi.doMock("../utils/access-control", () => ({
      hasAnyRole: vi.fn(async () => true),
      resolveAccessContext: vi.fn(async () => ({ email: "ops@tryblueprint.io" })),
    }));

    const { default: router } = await import("../routes/admin-company-metrics");
    const app = express();
    app.use((_req, res, next) => {
      res.locals.firebaseUser = { uid: "ops-user" };
      next();
    });
    app.use("/api/admin/company-metrics", router);

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server");
    }

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/admin/company-metrics`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        scoreboard: expect.objectContaining({
          generatedAt: "2026-04-20T12:00:00.000Z",
        }),
      });
      expect(collectCompanyScoreboard).toHaveBeenCalledTimes(1);
    } finally {
      await stopServer(server);
    }
  });
});
