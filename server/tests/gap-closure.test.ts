// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendSlackMessage = vi.hoisted(() => vi.fn());

vi.mock("../utils/slack", () => ({
  sendSlackMessage,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  authAdmin: null,
  dbAdmin: null,
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => ({ mocked: true }),
      },
    },
  },
}));

vi.mock("../utils/launch-readiness", () => ({
  buildLaunchReadinessSnapshot: () => ({
    status: "ready",
    blockers: [],
    warnings: [],
    checks: {},
    dependencies: {
      launchChecks: {},
    },
  }),
  listActiveReadinessFindings: () => [],
}));

beforeEach(() => {
  sendSlackMessage.mockReset();
});

describe("gap closure automation findings", () => {
  it("returns separate findings for a forced worker failure and a stale no-progress queue", async () => {
    const { listAutomationWorkerFindingsFromSnapshots } = await import("../utils/gap-closure");

    const findings = listAutomationWorkerFindingsFromSnapshots({
      now: "2026-05-24T12:00:00.000Z",
      thresholds: {
        staleQueueMs: 60 * 60 * 1000,
        noProgressMs: 30 * 60 * 1000,
        minBacklogCount: 1,
      },
      workerStatusDocs: [
        {
          id: "inbound_qualification",
          data: {
            status: "failed",
            last_error: "forced scheduler failure",
            last_run_completed_at_iso: "2026-05-24T09:00:00.000Z",
            last_processed_count: 0,
          },
        },
      ],
      queueDocs: [
        {
          collection: "inboundRequests",
          id: "req-old",
          data: {
            queue_key: "exact_site_hosted_review_queue",
            createdAt: "2026-05-24T08:00:00.000Z",
            ops_automation: {
              queue: "exact_site_hosted_review_queue",
              status: "pending",
              processed_at: null,
            },
          },
        },
      ],
      queueMonitors: [
        {
          collection: "inboundRequests",
          workerKey: "inbound_qualification",
          queueKey: "exact_site_hosted_review_queue",
          statusPath: "ops_automation.status",
          queuedAtPaths: ["createdAt"],
          progressAtPaths: ["ops_automation.processed_at"],
        },
      ],
    });

    const workerFinding = findings.find((finding) => finding.findingType === "worker_failure");
    const queueFinding = findings.find((finding) => finding.findingType === "stuck_queue");

    expect(workerFinding).toMatchObject({
      stableId: "automation_worker:inbound_qualification",
      kind: "automation_worker",
      workerKey: "inbound_qualification",
      title: "Automation worker failure: inbound qualification",
      detail: "forced scheduler failure",
      severity: "operational",
      findingType: "worker_failure",
    });
    expect(queueFinding).toMatchObject({
      stableId: "automation_queue:inboundRequests:exact_site_hosted_review_queue",
      kind: "automation_queue",
      workerKey: "inbound_qualification",
      queueKey: "exact_site_hosted_review_queue",
      collection: "inboundRequests",
      severity: "operational",
      findingType: "stuck_queue",
    });
    expect(queueFinding?.title).toContain("Stuck automation queue");
    expect(queueFinding?.detail).toContain("req-old");
    expect(queueFinding?.detail).toContain("no progress");
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });

  it("does not flag an old backlog when the worker has recent successful progress", async () => {
    const { listAutomationWorkerFindingsFromSnapshots } = await import("../utils/gap-closure");

    const findings = listAutomationWorkerFindingsFromSnapshots({
      now: "2026-05-24T12:00:00.000Z",
      thresholds: {
        staleQueueMs: 60 * 60 * 1000,
        noProgressMs: 30 * 60 * 1000,
        minBacklogCount: 1,
      },
      workerStatusDocs: [
        {
          id: "support_triage",
          data: {
            status: "idle",
            last_run_completed_at_iso: "2026-05-24T11:55:00.000Z",
            last_processed_count: 3,
          },
        },
      ],
      queueDocs: [
        {
          collection: "contactRequests",
          id: "contact-old",
          data: {
            createdAt: "2026-05-24T08:00:00.000Z",
            ops_automation: {
              queue: "support_triage",
              status: "pending",
              processed_at: null,
            },
          },
        },
      ],
      queueMonitors: [
        {
          collection: "contactRequests",
          workerKey: "support_triage",
          queueKey: "support_triage",
          statusPath: "ops_automation.status",
          queuedAtPaths: ["createdAt"],
          progressAtPaths: ["ops_automation.processed_at"],
        },
      ],
    });

    expect(findings).toEqual([]);
    expect(sendSlackMessage).not.toHaveBeenCalled();
  });
});
