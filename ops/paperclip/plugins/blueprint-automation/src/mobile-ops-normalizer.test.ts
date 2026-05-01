import { describe, expect, it } from "vitest";
import { normalizeMobileOpsSignal } from "./mobile-ops-normalizer.js";
import type { OpsRoutingConfig } from "./ops-webhooks.js";

const routing: OpsRoutingConfig = {
  opsLead: "ops-lead",
  intakeAgent: "intake-agent",
  captureCodexAgent: "capture-codex",
  captureQaAgent: "capture-qa-agent",
  capturerSuccessAgent: "capturer-success-agent",
  fieldOpsAgent: "field-ops-agent",
  financeSupportAgent: "finance-support-agent",
};

describe("mobile ops lifecycle normalizer", () => {
  it("routes failed uploads to Capture Codex", () => {
    const workItems = normalizeMobileOpsSignal({
      collection: "capture_submissions",
      documentId: "cap-1",
      data: {
        creator_id: "creator-1",
        operational_state: { upload_state: "failed" },
        upload_error: { code: "upload_timeout" },
      },
    }, routing);

    expect(workItems).toHaveLength(1);
    expect(workItems[0]).toMatchObject({
      sourceType: "mobile-capture-lifecycle",
      sourceId: "capture_submissions:cap-1:technical",
      assignee: "capture-codex",
      priority: "high",
      projectName: "blueprint-capture",
    });
    expect(workItems[0]?.description).toContain("Do not mark this complete from app-side optimism.");
  });

  it("splits recapture needs into QA and capturer-success work", () => {
    const workItems = normalizeMobileOpsSignal({
      collection: "creatorCaptures",
      documentId: "capture-2",
      data: {
        capture_id: "capture-2",
        qa_state: "recapture_needed",
      },
    }, routing);

    expect(workItems.map((item) => item.assignee).sort()).toEqual([
      "capture-qa-agent",
      "capturer-success-agent",
    ]);
    expect(workItems.map((item) => item.sourceId).sort()).toEqual([
      "creatorCaptures:capture-2:recapture-qa",
      "creatorCaptures:capture-2:recapture-support",
    ]);
  });

  it("routes payout action to finance support", () => {
    const workItems = normalizeMobileOpsSignal({
      collection: "creatorPayouts",
      documentId: "payout-1",
      data: {
        status: "action_required",
        creator_id: "creator-2",
      },
    }, routing);

    expect(workItems[0]).toMatchObject({
      sourceType: "mobile-payout-lifecycle",
      assignee: "finance-support-agent",
      projectName: "blueprint-webapp",
      priority: "high",
    });
  });

  it("routes field ops assignment gaps to field ops", () => {
    const workItems = normalizeMobileOpsSignal({
      collection: "capture_jobs",
      documentId: "job-1",
      data: {
        status: "capture_requested",
        site_id: "site-1",
      },
    }, routing);

    expect(workItems[0]).toMatchObject({
      sourceType: "mobile-field-ops-lifecycle",
      assignee: "field-ops-agent",
      projectName: "blueprint-capture",
    });
  });

  it("routes stalled uploads from timestamps", () => {
    const workItems = normalizeMobileOpsSignal({
      collection: "capture_submissions",
      documentId: "cap-3",
      data: {
        status: "uploading",
        createdAt: "2026-05-01T10:00:00.000Z",
      },
    }, routing, {
      now: new Date("2026-05-01T13:30:00.000Z"),
      uploadStalledAfterHours: 2,
    });

    expect(workItems).toHaveLength(1);
    expect(workItems[0]?.sourceId).toBe("capture_submissions:cap-3:technical");
  });
});
