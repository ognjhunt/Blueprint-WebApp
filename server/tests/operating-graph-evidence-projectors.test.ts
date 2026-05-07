// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const collectionDocs = vi.hoisted(() => new Map<string, Array<{ id: string; data: Record<string, unknown> }>>());
const appendOperatingGraphEvent = vi.hoisted(() => vi.fn(async (input: Record<string, unknown>) => ({
  id: `${input.entityId}:${input.stage}`,
  ...input,
})));
const listCityLaunchActivations = vi.hoisted(() => vi.fn());
const listCityLaunchProspects = vi.hoisted(() => vi.fn());

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: (name: string) => ({
      limit: (limit: number) => ({
        get: async () => ({
          docs: (collectionDocs.get(name) || []).slice(0, limit).map((doc) => ({
            id: doc.id,
            data: () => doc.data,
          })),
        }),
      }),
    }),
  },
}));

vi.mock("../utils/operatingGraph", async () => {
  const actual = await vi.importActual<typeof import("../utils/operatingGraph")>(
    "../utils/operatingGraph",
  );
  return {
    ...actual,
    appendOperatingGraphEvent,
  };
});

vi.mock("../utils/cityLaunchLedgers", () => ({
  listCityLaunchActivations,
  listCityLaunchProspects,
}));

describe("operating graph evidence projectors", () => {
  beforeEach(() => {
    collectionDocs.clear();
    appendOperatingGraphEvent.mockClear();
    listCityLaunchActivations.mockReset();
    listCityLaunchProspects.mockReset();
  });

  it("projects capture_submissions lifecycle rows into capture_run events", async () => {
    collectionDocs.set("capture_submissions", [
      {
        id: "capture-1",
        data: {
          capture_id: "capture-1",
          scene_id: "scene-1",
          site_submission_id: "submission-1",
          buyer_request_id: "buyer-1",
          capture_job_id: "job-1",
          city_context: {
            city: "Durham, NC",
            city_slug: "durham-nc",
          },
          lifecycle: {
            capture_started_at: "2026-04-22T12:00:00.000Z",
            upload_started_at: "2026-04-22T12:01:00.000Z",
            capture_uploaded_at: "2026-04-22T12:05:00.000Z",
          },
          operational_state: {
            upload_state: "uploaded",
          },
          status: "submitted",
        },
      },
      {
        id: "capture-missing-city",
        data: {
          capture_id: "capture-missing-city",
          lifecycle: {
            capture_started_at: "2026-04-22T12:00:00.000Z",
          },
        },
      },
    ]);

    const { projectCaptureSubmissionsIntoOperatingGraph } = await import(
      "../utils/operatingGraphEvidenceProjectors"
    );
    const result = await projectCaptureSubmissionsIntoOperatingGraph();

    expect(result.scannedCount).toBe(2);
    expect(result.projectedEventCount).toBe(2);
    expect(result.projectedEntityCount).toBe(1);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        id: "capture-missing-city",
        reason: "missing_city_context",
        sourceRef: "capture_submissions/capture-missing-city",
        requiredFields: expect.arrayContaining(["city_context.city", "city_context.city_slug"]),
        nextAction: expect.stringContaining("do not infer city"),
      }),
    ]);
    expect(result.skippedSummary).toEqual({ missing_city_context: 1 });
    expect(appendOperatingGraphEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "capture_run",
        entityId: "capture_run:capture-1",
        city: "Durham, NC",
        citySlug: "durham-nc",
        stage: "capture_in_progress",
        sourceRepo: "BlueprintCapture",
        recordedAtIso: "2026-04-22T12:01:00.000Z",
      }),
    );
    expect(appendOperatingGraphEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "capture_run",
        entityId: "capture_run:capture-1",
        stage: "capture_uploaded",
        recordedAtIso: "2026-04-22T12:05:00.000Z",
        metadata: expect.objectContaining({
          capture_id: "capture-1",
          capture_run_id: "capture_run:capture-1",
          city_program_id: "city_program:durham-nc:unscoped",
        }),
      }),
    );
  });

  it("projects city-launch prospects into supply_target graph state", async () => {
    listCityLaunchActivations.mockResolvedValue([
      {
        city: "Durham, NC",
        citySlug: "durham-nc",
        budgetTier: "zero_budget",
      },
    ]);
    listCityLaunchProspects.mockResolvedValue([
      {
        id: "prospect-1",
        city: "Durham, NC",
        citySlug: "durham-nc",
        launchId: "launch-1",
        sourceBucket: "local-research",
        channel: "professional-capturer",
        name: "Durham Capture Operator",
        email: null,
        status: "identified",
        ownerAgent: "capturer-growth-agent",
        notes: null,
        firstContactedAt: null,
        lastContactedAt: null,
        siteAddress: null,
        locationSummary: null,
        lat: null,
        lng: null,
        siteCategory: null,
        workflowFit: "warehouse-capture",
        priorityNote: null,
        researchProvenance: null,
        createdAtIso: "2026-04-22T10:00:00.000Z",
        updatedAtIso: "2026-04-22T10:00:00.000Z",
      },
      {
        id: "prospect-2",
        city: "Durham, NC",
        citySlug: "durham-nc",
        launchId: "launch-1",
        sourceBucket: "local-research",
        channel: "professional-capturer",
        name: "Contactable Capture Operator",
        email: "operator@example.com",
        status: "contacted",
        ownerAgent: "capturer-growth-agent",
        notes: null,
        firstContactedAt: "2026-04-22T11:00:00.000Z",
        lastContactedAt: null,
        siteAddress: null,
        locationSummary: null,
        lat: null,
        lng: null,
        siteCategory: null,
        workflowFit: "warehouse-capture",
        priorityNote: null,
        researchProvenance: null,
        createdAtIso: "2026-04-22T10:30:00.000Z",
        updatedAtIso: "2026-04-22T11:00:00.000Z",
      },
    ]);

    const { projectCityLaunchSupplyTargetsIntoOperatingGraph } = await import(
      "../utils/operatingGraphEvidenceProjectors"
    );
    const result = await projectCityLaunchSupplyTargetsIntoOperatingGraph();

    expect(result.scannedCount).toBe(2);
    expect(result.projectedEntityCount).toBe(2);
    expect(appendOperatingGraphEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "supply_target",
        entityId: "supply_target:prospect-1",
        stage: "supply_seeded",
        blockingConditions: [
          expect.objectContaining({
            id: "supply_target:prospect-1:contact_evidence",
            status: "awaiting_external_confirmation",
          }),
        ],
        metadata: expect.objectContaining({
          city_program_id: "city_program:durham-nc:zero_budget",
          city_launch_prospect_id: "prospect-1",
        }),
      }),
    );
    expect(appendOperatingGraphEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "supply_target",
        entityId: "supply_target:prospect-2",
        stage: "supply_contactable",
        blockingConditions: [],
      }),
    );
  });

  it("classifies Firestore quota failures as blocked projection results", async () => {
    const {
      buildOperatingGraphProjectionBlockedResult,
      isFirestoreResourceExhausted,
    } = await import("../utils/operatingGraphEvidenceProjectors");
    const error = Object.assign(new Error("8 RESOURCE_EXHAUSTED: Quota exceeded."), {
      code: 8,
    });

    expect(isFirestoreResourceExhausted(error)).toBe(true);
    expect(buildOperatingGraphProjectionBlockedResult(error)).toEqual(
      expect.objectContaining({
        failedCount: 1,
        status: "blocked",
        blockers: [
          expect.objectContaining({
            key: "firestore_resource_exhausted",
            retryCondition: expect.stringContaining("Firestore quota recovers"),
          }),
        ],
        warnings: expect.arrayContaining([
          expect.stringContaining("No successful operating graph projection should be claimed"),
        ]),
      }),
    );
  });
});
