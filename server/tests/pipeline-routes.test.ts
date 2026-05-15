// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import fs from "node:fs";
import path from "node:path";

import { parsePipelineAttachmentSyncPayload } from "../utils/pipelineAttachmentContract";

process.env.FIREHOSE_BASE_URL = "https://example.com";

const state = vi.hoisted(() => ({
  queryDocs: [] as Array<{
    ref: { id: string; update: ReturnType<typeof vi.fn> };
    data: () => Record<string, unknown>;
  }>,
  docExists: true,
  docData: {} as Record<string, unknown>,
  docSet: vi.fn().mockResolvedValue(undefined),
  docUpdate: vi.fn().mockResolvedValue(undefined),
  collectionWrites: [] as Array<{
    collection: string;
    id: string;
    payload: Record<string, unknown>;
    options?: Record<string, unknown>;
  }>,
  notesAdds: [] as Array<Record<string, unknown>>,
  storageText: "",
  storageShouldFail: false,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: (name: string) => {
      if (name === "inboundRequests") {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({ docs: state.queryDocs }),
            }),
          }),
          doc: (id?: string) => ({
            id: id || "mock-doc-id",
            get: async () => ({
              exists: state.docExists,
              data: () => state.docData,
            }),
            set: state.docSet,
            update: state.docUpdate,
            collection: (childName: string) => ({
              add: async (payload: Record<string, unknown>) => {
                state.notesAdds.push({ collection: childName, ...payload });
                return { id: "note-1" };
              },
            }),
          }),
        };
      }

      return {
        doc: (id?: string) => ({
          id: id || "mock-doc-id",
          set: async (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
            state.collectionWrites.push({
              collection: name,
              id: id || "mock-doc-id",
              payload,
              options,
            });
          },
        }),
      };
    },
  },
  storageAdmin: {
    bucket: () => ({
      file: () => ({
        download: async () => {
          if (state.storageShouldFail) {
            throw new Error("missing");
          }
          return [Buffer.from(state.storageText, "utf-8")];
        },
      }),
    }),
  },
  authAdmin: null,
}));

vi.mock("../utils/field-encryption", () => ({
  decryptFieldValue: async (value: string) => value,
  decryptInboundRequestForAdmin: async (value: Record<string, unknown>) => value,
  encryptFieldValue: async (value: string) => value,
}));

vi.mock("../utils/access-control", () => ({
  hasAnyRole: async () => true,
}));

vi.mock("../utils/request-review-auth", () => ({
  createRequestReviewToken: () => "valid",
  getRequestReviewCookieName: () => "blueprint-review",
  verifyRequestReviewToken: (token: string) => token === "valid",
}));

async function startServer(
  loadRouter: () => Promise<{ default: express.Router }>
): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await loadRouter();
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    res.locals.firebaseUser = { email: "ops@tryblueprint.io", admin: true };
    next();
  });
  app.use("/", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

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

afterEach(() => {
  state.queryDocs = [];
  state.docExists = true;
  state.docData = {};
  state.docSet.mockReset();
  state.docSet.mockResolvedValue(undefined);
  state.docUpdate.mockReset();
  state.docUpdate.mockResolvedValue(undefined);
  state.collectionWrites = [];
  state.notesAdds = [];
  state.storageText = "";
  state.storageShouldFail = false;
  delete process.env.PIPELINE_SYNC_TOKEN;
  delete process.env.PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS;
  delete process.env.BLUEPRINT_CAPTURE_HANDOFF_TOKEN_SECRET;
  delete process.env.APP_URL;
});

function findCollectionWrites(collection: string) {
  return state.collectionWrites.filter((entry) => entry.collection === collection);
}

const fixturePath = path.resolve(
  import.meta.dirname,
  "fixtures",
  "pipeline-attachment-payload.json",
);
const pipelineAttachmentFixture = JSON.parse(
  fs.readFileSync(fixturePath, "utf-8"),
) as Record<string, unknown>;

describe("pipeline integration routes", () => {
  it("accepts the shared pipeline attachment payload fixture", () => {
    expect(() => parsePipelineAttachmentSyncPayload(pipelineAttachmentFixture)).not.toThrow();
  });

  it("upserts pipeline attachment metadata on the internal route", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    const update = vi.fn().mockResolvedValue(undefined);
    state.queryDocs = [
      {
        ref: { id: "req-1", update },
        data: () => ({
          requestId: "req-1",
          status: "qualified_ready",
          qualification_state: "qualified_ready",
          opportunity_state: "handoff_ready",
          context: {
            demandCity: "Durham, NC",
          },
          contact: {
            roleTitle: "Ops Lead",
          },
          derived_assets: {
            preview_simulation: {
              status: "generated",
              manifest_uri: "gs://bucket/existing-preview.json",
            },
          },
          pipeline: {
            scene_id: "scene-0",
            capture_id: "cap-0",
            pipeline_prefix: "scenes/scene-0/captures/cap-0/pipeline",
            artifacts: {
              readiness_report_uri: "gs://bucket/existing-readiness.md",
            },
          },
        }),
      },
    ];
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Blueprint-Pipeline-Token": "secret",
        },
        body: JSON.stringify({
          ...pipelineAttachmentFixture,
          buyer_request_id: "buyer-req-123",
          capture_job_id: "job-1",
          authoritative_state_update: false,
        }),
      });

      expect(response.status).toBe(200);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          derived_assets: expect.objectContaining({
            preview_simulation: expect.objectContaining({
              status: "generated",
            }),
            scene_memory: expect.objectContaining({
              status: "prep_ready",
            }),
          }),
          pipeline: expect.objectContaining({
            scene_id: "scene-1",
            capture_id: "cap-1",
            artifacts: expect.objectContaining({
              readiness_report_uri: "gs://bucket/existing-readiness.md",
              dashboard_summary_uri:
                "gs://bucket/scenes/scene-1/captures/cap-1/pipeline/dashboard_summary.json",
              privacy_processed_video_uri:
                "gs://bucket/scenes/scene-1/captures/cap-1/privacy/final_walkthrough.mov",
            }),
          }),
          deployment_readiness: expect.objectContaining({
            privacy_processing: expect.objectContaining({
              status: "person_removed",
            }),
          }),
        })
      );
      expect(update).not.toHaveBeenCalledWith(
        expect.objectContaining({
          qualification_state: expect.anything(),
        })
      );

      const graphWrites = findCollectionWrites("operatingGraphEvents");
      expect(graphWrites).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            payload: expect.objectContaining({
              entity_type: "city_program",
              stage: expect.any(String),
            }),
          }),
          expect.objectContaining({
            payload: expect.objectContaining({
              entity_type: "package_run",
              stage: "pipeline_packaging",
              metadata: expect.objectContaining({
                capture_id: "cap-1",
                scene_id: "scene-1",
                buyer_request_id: "buyer-req-123",
                package_id: "cap-1",
                package_run_id: "package_run:cap-1",
                site_submission_id: "req-1",
                capture_job_id: "job-1",
              }),
            }),
          }),
        ])
      );
      expect(
        graphWrites.flatMap((entry) => entry.payload.blocking_conditions as Array<Record<string, unknown>> || [])
      ).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: "warning",
          }),
        ]),
      );
    } finally {
      await stopServer(server);
    }
  }, 60_000);

  it("updates qualification truth only when authoritative_state_update is true", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    const update = vi.fn().mockResolvedValue(undefined);
    state.queryDocs = [
      {
        ref: { id: "req-1", update },
        data: () => ({
          requestId: "req-1",
          status: "submitted",
          qualification_state: "submitted",
          opportunity_state: "not_applicable",
          request: {
            buyerType: "robot_team",
          },
        }),
      },
    ];
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));
    const payload = {
      ...pipelineAttachmentFixture,
      qualification_state: "",
      opportunity_state: "",
      deployment_readiness: {
        ...(pipelineAttachmentFixture.deployment_readiness as Record<string, unknown>),
        qualification_state: "qualified_ready",
        opportunity_state: "handoff_ready",
      },
    };

    try {
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Blueprint-Pipeline-Token": "secret",
        },
        body: JSON.stringify(payload),
      });

      expect(response.status).toBe(200);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "qualified_ready",
          qualification_state: "qualified_ready",
          opportunity_state: "handoff_ready",
          ops: expect.objectContaining({
            proof_path: expect.objectContaining({
              qualified_inbound_at: expect.anything(),
            }),
          }),
        })
      );
    } finally {
      await stopServer(server);
    }
  });

  it("fails closed when pipeline sync arrives before inbound request bootstrap", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    state.queryDocs = [];
    state.docExists = false;

    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Blueprint-Pipeline-Token": "secret",
        },
        body: JSON.stringify(pipelineAttachmentFixture),
      });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          code: "missing_inbound_request_bootstrap",
          request_id: "req-1",
          site_submission_id: "req-1",
        })
      );
      expect(state.docSet).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });

  it("rejects pipeline sync without the upstream buyer request link", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Blueprint-Pipeline-Token": "secret",
        },
        body: JSON.stringify({
          ...pipelineAttachmentFixture,
          buyer_request_id: "",
        }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          code: "missing_pipeline_upstream_link",
          missing_fields: expect.arrayContaining(["buyer_request_id"]),
        })
      );
      expect(state.docSet).not.toHaveBeenCalled();
      expect(state.docUpdate).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });

  it("rejects pipeline sync without the upstream capture job link", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Blueprint-Pipeline-Token": "secret",
        },
        body: JSON.stringify({
          ...pipelineAttachmentFixture,
          capture_job_id: "",
        }),
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          code: "missing_pipeline_upstream_link",
          missing_fields: expect.arrayContaining(["capture_job_id"]),
        })
      );
      expect(state.docSet).not.toHaveBeenCalled();
      expect(state.docUpdate).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });

  it("allows explicit placeholder fallback when pipeline sync fallback is enabled", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    process.env.PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS = "true";
    state.queryDocs = [];
    state.docExists = false;

    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Blueprint-Pipeline-Token": "secret",
        },
        body: JSON.stringify(pipelineAttachmentFixture),
      });

      expect(response.status).toBe(200);
      expect(state.docSet).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-1",
          site_submission_id: "req-1",
          status: "qualified_ready",
          qualification_state: "qualified_ready",
          opportunity_state: "handoff_ready",
          request: expect.objectContaining({
            siteName: "Pipeline site req-1",
            siteLocation: "Scene scene-1",
          }),
          ops: expect.objectContaining({
            proof_path: expect.objectContaining({
              qualified_inbound_at: expect.anything(),
            }),
          }),
          pipeline: expect.objectContaining({
            scene_id: "scene-1",
            capture_id: "cap-1",
          }),
          derived_assets: expect.objectContaining({
            scene_memory: expect.objectContaining({
              status: "prep_ready",
            }),
          }),
          deployment_readiness: expect.objectContaining({
            privacy_processing: expect.objectContaining({
              status: "person_removed",
            }),
          }),
        }),
        { merge: true }
      );
    } finally {
      await stopServer(server);
    }
  });

  it("returns a validated scene dashboard for an attached request", async () => {
    state.docData = {
      requestId: "req-1",
      site_submission_id: "req-1",
      status: "qualified_ready",
      qualification_state: "qualified_ready",
      opportunity_state: "handoff_ready",
      priority: "normal",
      owner: {},
      contact: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines",
        roleTitle: "Ops",
      },
      request: {
        budgetBucket: "$50K-$300K",
        requestedLanes: ["qualification"],
        helpWith: ["benchmark-packs"],
        buyerType: "site_operator",
        siteName: "Durham Facility",
        siteLocation: "Durham, NC",
        taskStatement: "Review a picking workflow.",
      },
      context: { sourcePageUrl: "https://example.com", utm: {} },
      enrichment: {},
      events: {},
      pipeline: {
        scene_id: "scene-1",
        capture_id: "cap-1",
        pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
        artifacts: {
          dashboard_summary_uri: "gs://bucket/scenes/scene-1/captures/cap-1/pipeline/dashboard_summary.json",
        },
      },
    };
    state.storageText = JSON.stringify({
      schema_version: "v1",
      scene: "scene-1",
      whole_home: {
        capture_id: "cap-1",
        status: "qualified_ready",
        confidence: 0.9,
        memo_path: "/tmp/memo.md",
        memo_uri: "gs://bucket/memo.md",
      },
      categories: {
        pick: { counts: { ready: 1, risky: 0, not_ready_yet: 0 }, tasks: [] },
        open_close: { counts: { ready: 0, risky: 0, not_ready_yet: 0 }, tasks: [] },
        navigate: { counts: { ready: 0, risky: 0, not_ready_yet: 0 }, tasks: [] },
      },
      theme_counts: {},
      action_counts: { "advance to human signoff": 1 },
      deployment_summary: {
        total_tasks: 1,
        ready_now: 1,
        needs_redesign: 0,
        outside_robot_envelope: 0,
      },
    });
    const { server, baseUrl } = await startServer(() => import("../routes/admin-leads"));

    try {
      const response = await fetch(`${baseUrl}/req-1/pipeline/dashboard`);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.deployment_summary.ready_now).toBe(1);
      expect(json.scene).toBe("scene-1");
    } finally {
      await stopServer(server);
    }
  }, 60_000);

  it("returns 404 when a request has no attached scene dashboard", async () => {
    state.docData = {
      requestId: "req-1",
      site_submission_id: "req-1",
      status: "qualified_ready",
      qualification_state: "qualified_ready",
      opportunity_state: "handoff_ready",
      priority: "normal",
      owner: {},
      contact: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", company: "Analytical Engines", roleTitle: "Ops" },
      request: {
        budgetBucket: "$50K-$300K",
        requestedLanes: ["qualification"],
        helpWith: ["benchmark-packs"],
        buyerType: "site_operator",
        siteName: "Durham Facility",
        siteLocation: "Durham, NC",
        taskStatement: "Review a picking workflow.",
      },
      context: { sourcePageUrl: "https://example.com", utm: {} },
      enrichment: {},
      events: {},
      pipeline: {
        scene_id: "scene-1",
        capture_id: "cap-1",
        pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
        artifacts: {},
      },
    };
    const { server, baseUrl } = await startServer(() => import("../routes/admin-leads"));

    try {
      const response = await fetch(`${baseUrl}/req-1/pipeline/dashboard`);
      expect(response.status).toBe(404);
    } finally {
      await stopServer(server);
    }
  }, 60_000);

  it("returns 409 when the scene dashboard artifact is malformed", async () => {
    state.docData = {
      requestId: "req-1",
      site_submission_id: "req-1",
      status: "qualified_ready",
      qualification_state: "qualified_ready",
      opportunity_state: "handoff_ready",
      priority: "normal",
      owner: {},
      contact: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", company: "Analytical Engines", roleTitle: "Ops" },
      request: {
        budgetBucket: "$50K-$300K",
        requestedLanes: ["qualification"],
        helpWith: ["benchmark-packs"],
        buyerType: "site_operator",
        siteName: "Durham Facility",
        siteLocation: "Durham, NC",
        taskStatement: "Review a picking workflow.",
      },
      context: { sourcePageUrl: "https://example.com", utm: {} },
      enrichment: {},
      events: {},
      pipeline: {
        scene_id: "scene-1",
        capture_id: "cap-1",
        pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
        artifacts: {
          dashboard_summary_uri: "gs://bucket/scenes/scene-1/captures/cap-1/pipeline/dashboard_summary.json",
        },
      },
    };
    state.storageText = JSON.stringify({ schema_version: "v1", scene: "scene-1" });
    const { server, baseUrl } = await startServer(() => import("../routes/admin-leads"));

    try {
      const response = await fetch(`${baseUrl}/req-1/pipeline/dashboard`);
      expect(response.status).toBe(409);
    } finally {
      await stopServer(server);
    }
  });

  it("writes a hosted-review-run event when buyer review access starts the hosted review", async () => {
    state.docData = {
      requestId: "req-1",
      site_submission_id: "submission-1",
      buyer_request_id: "buyer-request-12",
      contact: {
        email: "ada@example.com",
        roleTitle: "Ops Lead",
      },
      request: {
        buyerType: "robot_team",
        siteName: "Durham Facility",
        siteLocation: "Durham, NC",
        taskStatement: "Review a picking workflow.",
      },
      context: {
        sourcePageUrl: "https://example.com",
        demandCity: "Durham, NC",
        buyerChannelSource: "direct",
        buyerChannelSourceCaptureMode: "manual",
        utm: {},
      },
      ops: {
        proof_path: {
          hosted_review_started_at: null,
        },
      },
      pipeline: {
        capture_id: "cap-1",
        scene_id: "scene-1",
      },
    };

    const { server, baseUrl } = await startServer(() => import("../routes/requests"));

    try {
      const response = await fetch(`${baseUrl}/req-1?access=valid`);
      expect(response.status).toBe(200);
      expect(state.docUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          "ops.proof_path.hosted_review_started_at": "SERVER_TIMESTAMP",
        }),
      );

      expect(findCollectionWrites("operatingGraphEvents")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            payload: expect.objectContaining({
              entity_type: "hosted_review_run",
              stage: "hosted_review_started",
              metadata: expect.objectContaining({
                hosted_review_run_id: "req-1",
                buyer_request_id: "buyer-request-12",
                site_submission_id: "submission-1",
                capture_id: "cap-1",
                scene_id: "scene-1",
              }),
            }),
          }),
        ]),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("serves capture handoff metadata from the server-authoritative request", async () => {
    process.env.BLUEPRINT_CAPTURE_HANDOFF_TOKEN_SECRET = "test-capture-handoff-secret";
    const { createCaptureHandoffToken } = await import("../utils/capture-handoff-token");
    const token = createCaptureHandoffToken({
      requestId: "req-1",
      captureJobId: "job-1",
    });
    state.docData = {
      requestId: "req-1",
      site_submission_id: "submission-1",
      buyer_request_id: "buyer-request-12",
      contact: {
        email: "ada@example.com",
      },
      request: {
        buyerType: "robot_team",
        siteName: "Durham Facility",
        siteLocation: "Durham, NC",
        taskStatement: "Review a picking workflow.",
        displayCaptureMetadata: {
          targetName: "Display Dock A",
          addressLabel: "11 Warehouse Way",
          captureBrief: "Capture approved dock approach and threshold.",
          privacyReminder: "Capture only approved areas.",
          allowedAdvisoryHints: ["hold_steady", "slow_down"],
        },
      },
      context: {
        sourcePageUrl: "https://example.com",
        utm: {},
      },
      pipeline: {
        capture_id: "cap-1",
        scene_id: "scene-1",
        capture_job_id: "job-1",
      },
    };

    const { server, baseUrl } = await startServer(() => import("../routes/requests"));

    try {
      const response = await fetch(`${baseUrl}/capture-handoff/${encodeURIComponent(token)}`);
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload).toMatchObject({
        request_id: "req-1",
        capture_job_id: "job-1",
        target_name: "Display Dock A",
        address_label: "11 Warehouse Way",
        source: "server_verified",
      });
      expect(payload.allowed_advisory_hints).toEqual(["hold_steady", "slow_down"]);
      expect(JSON.stringify(payload)).not.toContain("ada@example.com");
    } finally {
      await stopServer(server);
    }
  });

  it("creates an admin BlueprintCapture handoff without target details in the URL", async () => {
    process.env.BLUEPRINT_CAPTURE_HANDOFF_TOKEN_SECRET = "test-capture-handoff-secret";
    process.env.APP_URL = "https://tryblueprint.io";
    const { verifyCaptureHandoffToken } = await import("../utils/capture-handoff-token");
    state.docData = {
      requestId: "req-1",
      site_submission_id: "submission-1",
      contact: {
        email: "ada@example.com",
      },
      request: {
        buyerType: "robot_team",
        requestedLanes: ["qualification"],
        siteName: "Durham Facility",
        siteLocation: "Durham, NC",
        taskStatement: "Review a picking workflow.",
        displayCaptureMetadata: {
          targetName: "Display Dock A",
          addressLabel: "11 Warehouse Way",
          captureJobId: "job-1",
          captureBrief: "Capture approved dock approach and threshold.",
        },
      },
      context: {
        sourcePageUrl: "https://example.com",
        utm: {},
      },
      pipeline: {
        capture_id: "cap-1",
        scene_id: "scene-1",
        capture_job_id: "job-1",
      },
    };

    const { server, baseUrl } = await startServer(() => import("../routes/admin-leads"));

    try {
      const response = await fetch(`${baseUrl}/req-1/capture-handoff`, {
        method: "POST",
      });
      expect(response.status).toBe(200);
      const payload = await response.json();
      expect(payload.universal_link_url).toMatch(
        /^https:\/\/tryblueprint\.io\/capture\/open\?handoff=/,
      );
      expect(payload.custom_scheme_url).toMatch(/^blueprintcapture:\/\/capture\?handoff=/);
      expect(payload.universal_link_url).not.toContain("Display");
      expect(payload.custom_scheme_url).not.toContain("Warehouse");
      expect(verifyCaptureHandoffToken(payload.handoff_token)).toMatchObject({
        requestId: "req-1",
        captureJobId: "job-1",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("writes buyer follow-up operating-graph events from admin ops stamping", async () => {
    state.docData = {
      requestId: "req-1",
      site_submission_id: "submission-1",
      buyer_request_id: "buyer-request-12",
      contact: {
        email: "ada@example.com",
        roleTitle: "Ops Lead",
      },
      request: {
        buyerType: "robot_team",
        siteName: "Durham Facility",
        siteLocation: "Durham, NC",
        taskStatement: "Review a picking workflow.",
      },
      context: {
        sourcePageUrl: "https://example.com",
        demandCity: "Durham, NC",
        buyerChannelSource: "direct",
        buyerChannelSourceCaptureMode: "manual",
        utm: {},
      },
      ops: {
        proof_path: {
          hosted_review_started_at: "2026-04-20T10:00:00.000Z",
          hosted_review_follow_up_at: null,
          human_commercial_handoff_at: null,
        },
      },
      pipeline: {
        capture_id: "cap-1",
        scene_id: "scene-1",
        capture_job_id: "job-1",
      },
    };

    const { server, baseUrl } = await startServer(() => import("../routes/admin-leads"));

    try {
      const response = await fetch(`${baseUrl}/req-1/ops`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proof_path_stage: "hosted_review_follow_up",
        }),
      });

      expect(response.status).toBe(200);
      expect(findCollectionWrites("operatingGraphEvents")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            payload: expect.objectContaining({
              entity_type: "hosted_review_run",
              stage: "buyer_follow_up_in_progress",
              metadata: expect.objectContaining({
                hosted_review_run_id: "req-1",
                buyer_request_id: "buyer-request-12",
                site_submission_id: "submission-1",
                capture_id: "cap-1",
                scene_id: "scene-1",
                capture_job_id: "job-1",
              }),
            }),
          }),
        ]),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("records an explicit buyer outcome ledger row and buyer outcome event", async () => {
    state.docData = {
      requestId: "req-1",
      site_submission_id: "submission-1",
      buyer_request_id: "buyer-request-12",
      contact: {
        email: "buyer@example.com",
        company: "Analytical Engines",
        roleTitle: "Buyer",
      },
      request: {
        buyerType: "robot_team",
        siteName: "Durham Facility",
        siteLocation: "Durham, NC",
        taskStatement: "Review a picking workflow.",
      },
      context: {
        sourcePageUrl: "https://example.com",
        demandCity: "Durham, NC",
        buyerChannelSource: "direct",
        buyerChannelSourceCaptureMode: "manual",
        utm: {},
      },
      pipeline: {
        capture_id: "cap-1",
        scene_id: "scene-1",
        capture_job_id: "job-1",
      },
      ops: {
        proof_path: {
          hosted_review_started_at: "2026-04-20T10:00:00.000Z",
        },
      },
    };

    const { server, baseUrl } = await startServer(() => import("../routes/admin-leads"));

    try {
      const response = await fetch(`${baseUrl}/req-1/buyer-outcomes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outcome_type: "package_closed_won",
          outcome_status: "completed",
          commercial_value_usd: 25000,
          confidence: 0.92,
          source: "admin_ops",
          notes: "Buyer closed the package after hosted review.",
          proof_refs: ["gs://bucket/proofs/req-1/quote.pdf"],
          buyer_account_id: "buyer-77",
        }),
      });

      expect(response.status).toBe(201);
      expect(findCollectionWrites("buyerOutcomes")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            payload: expect.objectContaining({
              buyer_outcome_id: expect.stringContaining("req-1"),
              city_program_id: "city_program:durham-nc:unscoped",
              site_submission_id: "submission-1",
              capture_id: "cap-1",
              hosted_review_run_id: "req-1",
              buyer_account_id: "buyer-77",
              outcome_type: "package_closed_won",
              outcome_status: "completed",
              commercial_value_usd: 25000,
              confidence: 0.92,
              source: "admin_ops",
              notes: "Buyer closed the package after hosted review.",
              proof_refs: ["gs://bucket/proofs/req-1/quote.pdf"],
            }),
          }),
        ]),
      );
      expect(findCollectionWrites("operatingGraphEvents")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            payload: expect.objectContaining({
              entity_type: "buyer_outcome",
              stage: "buyer_outcome_recorded",
              metadata: expect.objectContaining({
                buyer_outcome_id: expect.stringContaining("req-1"),
                hosted_review_run_id: "req-1",
                buyer_account_id: "buyer-77",
                capture_id: "cap-1",
                site_submission_id: "submission-1",
              }),
            }),
          }),
        ]),
      );
    } finally {
      await stopServer(server);
    }
  });
});
