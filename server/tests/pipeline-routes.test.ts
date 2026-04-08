// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import fs from "node:fs";
import path from "node:path";

import { parsePipelineAttachmentSyncPayload } from "../utils/pipelineAttachmentContract";

const state = vi.hoisted(() => ({
  queryDocs: [] as Array<{
    ref: { id: string; update: ReturnType<typeof vi.fn> };
    data: () => Record<string, unknown>;
  }>,
  docExists: true,
  docData: {} as Record<string, unknown>,
  docSet: vi.fn().mockResolvedValue(undefined),
  docUpdate: vi.fn().mockResolvedValue(undefined),
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
    collection: () => ({
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
      }),
    }),
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
  state.storageText = "";
  state.storageShouldFail = false;
  delete process.env.PIPELINE_SYNC_TOKEN;
  delete process.env.PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS;
});

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
});
