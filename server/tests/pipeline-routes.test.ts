// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { createHmac } from "node:crypto";
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
  collectionDocData: {} as Record<string, Record<string, Record<string, unknown>>>,
  notesAdds: [] as Array<Record<string, unknown>>,
  storageText: "",
  storageShouldFail: false,
  signedUrlCalls: [] as Array<{ bucket: string; objectPath: string; options: Record<string, unknown> }>,
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
    runTransaction: async (callback: (transaction: {
      get: (ref: { get: () => Promise<unknown> }) => Promise<unknown>;
      set: (ref: { set: (payload: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown> }, payload: Record<string, unknown>, options?: Record<string, unknown>) => void;
    }) => Promise<unknown>) => {
      const writes: Array<() => Promise<unknown>> = [];
      const result = await callback({
        get: (ref) => ref.get(),
        set: (ref, payload, options) => { writes.push(() => ref.set(payload, options)); },
      });
      for (const write of writes) await write();
      return result;
    },
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

      const queryDocs = (
        filters: Array<{ field: string; value: unknown }> = [],
      ) =>
        Object.entries(state.collectionDocData[name] || {})
          .filter(([, data]) =>
            filters.every(({ field, value }) => data[field] === value),
          )
          .map(([id, data]) => ({
            id,
            data: () => data,
            ref: {
              id,
              update: async (payload: Record<string, unknown>) => {
                state.collectionWrites.push({
                  collection: name,
                  id,
                  payload,
                  options: { update: true },
                });
                state.collectionDocData[name] = state.collectionDocData[name] || {};
                state.collectionDocData[name][id] = {
                  ...(state.collectionDocData[name][id] || {}),
                  ...payload,
                };
              },
            },
          }));
      const buildQuery = (filters: Array<{ field: string; value: unknown }> = []) => ({
        where: (field: string, _op: string, value: unknown) =>
          buildQuery([...filters, { field, value }]),
        limit: (count: number) => ({
          get: async () => ({ docs: queryDocs(filters).slice(0, count) }),
        }),
        get: async () => ({ docs: queryDocs(filters) }),
      });

      return {
        doc: (id?: string) => ({
          id: id || "mock-doc-id",
          get: async () => {
            const data = state.collectionDocData[name]?.[id || "mock-doc-id"];
            return {
              exists: Boolean(data),
              id: id || "mock-doc-id",
              data: () => data || {},
            };
          },
          set: async (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
            state.collectionWrites.push({
              collection: name,
              id: id || "mock-doc-id",
              payload,
              options,
            });
            state.collectionDocData[name] = state.collectionDocData[name] || {};
            state.collectionDocData[name][id || "mock-doc-id"] = options?.merge
              ? {
                  ...(state.collectionDocData[name][id || "mock-doc-id"] || {}),
                  ...payload,
                }
              : { ...payload };
          },
          update: async (payload: Record<string, unknown>) => {
            state.collectionWrites.push({
              collection: name,
              id: id || "mock-doc-id",
              payload,
              options: { update: true },
            });
            state.collectionDocData[name] = state.collectionDocData[name] || {};
            state.collectionDocData[name][id || "mock-doc-id"] = {
              ...(state.collectionDocData[name][id || "mock-doc-id"] || {}),
              ...payload,
            };
          },
          create: async (payload: Record<string, unknown>) => {
            const existing = state.collectionDocData[name]?.[id || "mock-doc-id"];
            if (existing) {
              // Firestore's already-exists: the dedup contract `create` gives
              // enqueueOutbox.
              const error = new Error("already exists") as Error & { code?: number };
              error.code = 6;
              throw error;
            }
            state.collectionWrites.push({
              collection: name,
              id: id || "mock-doc-id",
              payload,
              options: { create: true },
            });
            state.collectionDocData[name] = state.collectionDocData[name] || {};
            state.collectionDocData[name][id || "mock-doc-id"] = { ...payload };
          },
        }),
        where: (field: string, _op: string, value: unknown) =>
          buildQuery([{ field, value }]),
      };
    },
  },
  storageAdmin: {
    bucket: (bucket: string) => ({
      file: (objectPath: string) => ({
        download: async () => {
          if (state.storageShouldFail) {
            throw new Error("missing");
          }
          return [Buffer.from(state.storageText, "utf-8")];
        },
        getSignedUrl: async (options: Record<string, unknown>) => {
          state.signedUrlCalls.push({ bucket, objectPath, options });
          return [`https://storage.example.test/${bucket}/${objectPath}?signed=1`];
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

vi.mock("../utils/slack", () => ({
  sendSlackMessage: vi.fn().mockResolvedValue({ sent: true }),
}));

vi.mock("../utils/request-review-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/request-review-auth")>();
  return {
    ...actual,
    createRequestReviewToken: () => "valid",
    getRequestReviewCookieName: () => "blueprint-review",
    verifyRequestReviewToken: (token: string) => token === "valid",
  };
});

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
  state.collectionDocData = {};
  state.notesAdds = [];
  state.storageText = "";
  state.storageShouldFail = false;
  state.signedUrlCalls = [];
  delete process.env.PIPELINE_SYNC_TOKEN;
  delete process.env.PIPELINE_SYNC_ALLOWED_GCS_PREFIXES;
  delete process.env.PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS;
  delete process.env.BLUEPRINT_CAPTURE_HANDOFF_TOKEN_SECRET;
  delete process.env.APP_URL;
});

function findCollectionWrites(collection: string) {
  return state.collectionWrites.filter((entry) => entry.collection === collection);
}

function signedPipelineRequest(body: Record<string, unknown>, secret = "secret") {
  const rawBody = JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return {
    headers: {
      "Content-Type": "application/json",
      "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": `sha256=${signature}`,
    },
    body: rawBody,
  };
}

const fixturePath = path.resolve(
  import.meta.dirname,
  "fixtures",
  "pipeline-attachment-payload.json",
);
const pipelineAttachmentFixture = JSON.parse(
  fs.readFileSync(fixturePath, "utf-8"),
) as Record<string, unknown>;

function withCompleteRobotEvalPublicationArtifacts(payload: Record<string, unknown>) {
  return {
    ...payload,
    artifacts: {
      ...((payload.artifacts as Record<string, unknown>) || {}),
      post_training_data_package_uri:
        "gs://bucket/marketplace-artifacts/ent-robot-eval-1/post_training_data_package.tar.gz",
      delivery_manifest_uri:
        "gs://bucket/marketplace-artifacts/ent-robot-eval-1/delivery_manifest.json",
      robot_eval_dataset_manifest_uri: "gs://bucket/robot-eval/dataset_manifest.json",
      robot_eval_site_card_uri: "gs://bucket/robot-eval/site_card.json",
      robot_eval_task_cards_uri: "gs://bucket/robot-eval/task_cards.json",
      robot_eval_scenario_cards_uri: "gs://bucket/robot-eval/scenario_cards.json",
      robot_eval_cards_uri: "gs://bucket/robot-eval/eval_cards.json",
      robot_eval_proof_boundaries_uri: "gs://bucket/robot-eval/proof_boundaries.json",
      robot_task_ontology_v1_uri: "gs://bucket/robot-eval/task_ontology_v1.json",
      robot_scenario_family_library_uri: "gs://bucket/robot-eval/scenario_family_library.json",
      robot_scoring_methodology_uri: "gs://bucket/robot-eval/scoring_methodology.json",
      robot_eval_task_thresholds_uri: "gs://bucket/robot-eval/task_thresholds.json",
      robot_eval_publication_readiness_uri: "gs://bucket/robot-eval/publication_readiness.json",
    },
  };
}

describe("pipeline integration routes", () => {
  beforeEach(() => {
    process.env.PIPELINE_SYNC_ALLOWED_GCS_PREFIXES = "gs://bucket/";
  });

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
    state.collectionDocData = {
      capture_submissions: {
        "cap-1": {
          creator_id: "creator-auth-123",
        },
      },
    };
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));
    const signedRequest = signedPipelineRequest({
      ...pipelineAttachmentFixture,
      buyer_request_id: "buyer-req-123",
      capture_job_id: "job-1",
      authoritative_state_update: false,
    });

    try {
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        ...signedRequest,
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
          evaluation_readiness: expect.objectContaining({
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

  it("records provider and package failure alerts from pipeline sync statuses", async () => {
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
          site_submission_id: "req-1",
          buyer_request_id: "buyer-req-123",
          context: {
            demandCity: "Durham, NC",
          },
          pipeline: {
            scene_id: "scene-0",
            capture_id: "cap-0",
            pipeline_prefix: "scenes/scene-0/captures/cap-0/pipeline",
            artifacts: {},
          },
        }),
      },
    ];
    const payload = {
      ...pipelineAttachmentFixture,
      buyer_request_id: "buyer-req-123",
      capture_job_id: "job-1",
      authoritative_state_update: false,
      derived_assets: {
        ...((pipelineAttachmentFixture.derived_assets as Record<string, unknown>) || {}),
        preview_simulation: {
          status: "failed",
          manifest_uri:
            "gs://bucket/scenes/scene-1/captures/cap-1/pipeline/preview_simulation/failed_manifest.json",
        },
        dataset_package: {
          status: "failed",
          artifact_uri:
            "gs://bucket/scenes/scene-1/captures/cap-1/pipeline/package_failed.json",
        },
      },
      evaluation_readiness: {
        ...((pipelineAttachmentFixture.evaluation_readiness as Record<string, unknown>) || {}),
        provider_run: {
          provider_name: "openai",
          provider_model: "world-preview",
          provider_run_id: "provider-run-1",
          status: "failed",
          failure_reason: "Provider timed out before producing review media.",
        },
        robot_eval_dataset_summary: {
          ...(((pipelineAttachmentFixture.evaluation_readiness as Record<string, unknown>)
            ?.robot_eval_dataset_summary as Record<string, unknown>) || {}),
          required_artifact_status: "failed",
          missing_required_artifacts: ["post_training_data_package_uri"],
        },
      },
    };
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        ...signedPipelineRequest(payload),
      });

      expect(response.status).toBe(200);
      expect(findCollectionWrites("opsAlertSignals")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "provider_run_failure:provider-run-1",
            payload: expect.objectContaining({
              kind: "provider_run_failure",
              scope_id: "provider-run-1",
              event_count: 1,
              threshold: 1,
              last_details: expect.objectContaining({
                provider_run_id: "provider-run-1",
                status: "failed",
                failure_reason: "Provider timed out before producing review media.",
              }),
            }),
          }),
          expect.objectContaining({
            id: "package_generation_failure:cap-1",
            payload: expect.objectContaining({
              kind: "package_generation_failure",
              scope_id: "cap-1",
              event_count: 1,
              threshold: 1,
              last_details: expect.objectContaining({
                package_id: "cap-1",
                failures: expect.arrayContaining([
                  expect.objectContaining({
                    surface: "derived_assets.dataset_package",
                    status: "failed",
                  }),
                  expect.objectContaining({
                    surface:
                      "evaluation_readiness.robot_eval_dataset_summary.required_artifact_status",
                    status: "failed",
                  }),
                ]),
              }),
            }),
          }),
        ]),
      );
      expect(findCollectionWrites("opsAlerts")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "provider_run_failure:provider-run-1",
            payload: expect.objectContaining({
              status: "open",
              kind: "provider_run_failure",
              requires_human_review: true,
            }),
          }),
          expect.objectContaining({
            id: "package_generation_failure:cap-1",
            payload: expect.objectContaining({
              status: "open",
              kind: "package_generation_failure",
              requires_human_review: true,
            }),
          }),
        ]),
      );
    } finally {
      await stopServer(server);
    }
  }, 60_000);

  it("publishes qualified robot-eval packages into marketplace inventory", async () => {
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
          site_submission_id: "req-1",
          buyer_request_id: "buyer-req-123",
          request: {
            buyerType: "robot_team",
            siteName: "Durham Facility",
            siteLocation: "Durham, NC",
          },
          context: {
            demandCity: "Durham, NC",
          },
          pipeline: {
            scene_id: "scene-0",
            capture_id: "cap-0",
            pipeline_prefix: "scenes/scene-0/captures/cap-0/pipeline",
            artifacts: {},
          },
        }),
      },
    ];
    state.collectionDocData = {
      marketplaceEntitlements: {
        "ent-robot-eval-1": {
          id: "ent-robot-eval-1",
          buyer_user_id: "buyer-123",
          buyer_email: "buyer@example.com",
          sku: "robot-eval-cap-1",
          access_state: "provisioned",
          capture_id: "cap-1",
          site_submission_id: "req-1",
          buyer_request_id: "buyer-req-123",
        },
      },
    };
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));
    const payload = withCompleteRobotEvalPublicationArtifacts({
      ...pipelineAttachmentFixture,
      creator_id: "creator-auth-123",
      buyer_request_id: "buyer-req-123",
      capture_job_id: "job-1",
      authoritative_state_update: false,
    });

    try {
      const signedRequest = signedPipelineRequest(payload);
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        ...signedRequest,
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual(
        expect.objectContaining({
          marketplace_publication: null,
          capture_creator_linkage: {
            capture_id: "cap-1",
            creator_id: "creator-auth-123",
          },
          buyer_entitlement_artifact_sync: {
            status: "synced",
            entitlement_ids: ["ent-robot-eval-1"],
            artifact_keys: expect.arrayContaining([
              "post_training_data_package_uri",
            ]),
          },
        }),
      );
      // Existing marketplace records remain readable, but a current pipeline
      // attachment never mints a standalone product or zero-price SKU.
      expect(findCollectionWrites("publishedMarketplaceInventory")).toEqual([]);
      expect(findCollectionWrites("marketplace_items")).toEqual([]);
      // Capturer profiles are no longer written (outside capturers retired 2026-11-11).
      expect(findCollectionWrites("creatorProfiles")).toEqual([]);
      expect(findCollectionWrites("marketplaceEntitlements")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "ent-robot-eval-1",
            payload: expect.objectContaining({
              post_training_data_package_uri:
                "gs://bucket/marketplace-artifacts/ent-robot-eval-1/post_training_data_package.tar.gz",
              artifact_uris: expect.objectContaining({
                post_training_data_package_uri:
                  "gs://bucket/marketplace-artifacts/ent-robot-eval-1/post_training_data_package.tar.gz",
              }),
              artifact_delivery: expect.objectContaining({
                status: "artifact_ready",
                source: "pipeline_attachment_sync",
              }),
            }),
            options: { update: true },
          }),
        ]),
      );
      expect(findCollectionWrites("transactionalNotifications")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            payload: expect.objectContaining({
              event_type: "delivery_ready",
              channel: "in_app",
              status: "queued",
              recipient_user_id: "buyer-123",
              subject_id: "ent-robot-eval-1",
            }),
          }),
          expect.objectContaining({
            payload: expect.objectContaining({
              event_type: "delivery_ready",
              channel: "email",
              status: "skipped",
              skip_reason: "transactional_email_disabled",
              recipient_email_domain: "example.com",
            }),
          }),
        ]),
      );
    } finally {
      await stopServer(server);
    }
  }, 60_000);

  it("checks buyer artifact access with a provisioned entitlement and signed URL", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    state.collectionDocData = {
      marketplaceEntitlements: {
        "ent-robot-eval-1": {
          id: "ent-robot-eval-1",
          buyer_user_id: "buyer-123",
          sku: "robot-eval-cap-1",
          access_state: "provisioned",
        },
      },
      publishedMarketplaceInventory: {
        "robot-eval-cap-1": {
          sku: "robot-eval-cap-1",
          artifact_uris: {
            package_uri: "gs://bucket/marketplace-artifacts/ent-robot-eval-1/package.zip",
            buyer_readout_uri:
              "gs://bucket/marketplace-artifacts/ent-robot-eval-1/readout.json",
          },
        },
      },
    };
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const signedRequest = signedPipelineRequest({
        webapp_response_ids: {
          entitlement_id: "ent-robot-eval-1",
          listing_id: "robot-eval-cap-1",
        },
        artifact_key: "package_uri",
      });
      const response = await fetch(`${baseUrl}/buyer-artifact-access-check`, {
        method: "POST",
        ...signedRequest,
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          ok: true,
          buyer_access_checked: true,
          buyer_accessible: true,
          entitlement_verified: true,
          status: "signed_url_minted",
          entitlement_id: "ent-robot-eval-1",
          sku: "robot-eval-cap-1",
          artifact_key: "package_uri",
          artifact_uri: "gs://bucket/marketplace-artifacts/ent-robot-eval-1/package.zip",
          signed_url:
            "https://storage.example.test/bucket/marketplace-artifacts/ent-robot-eval-1/package.zip?signed=1",
        }),
      );
      expect(state.signedUrlCalls).toEqual([
        expect.objectContaining({
          bucket: "bucket",
          objectPath: "marketplace-artifacts/ent-robot-eval-1/package.zip",
        }),
      ]);
    } finally {
      await stopServer(server);
    }
  });

  it("applies pipeline rights/privacy revocation and blocks new buyer artifact URLs", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    state.collectionDocData = {
      marketplaceEntitlements: {
        "ent-robot-eval-revoked": {
          id: "ent-robot-eval-revoked",
          buyer_user_id: "buyer-123",
          buyer_email: "buyer@example.com",
          sku: "robot-eval-cap-revoked",
          scene_id: "scene-1",
          capture_id: "cap-1",
          access_state: "provisioned",
          artifact_uris: {
            package_uri:
              "gs://bucket/marketplace-artifacts/ent-robot-eval-revoked/package.zip",
          },
        },
      },
    };
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const revocationRequest = signedPipelineRequest({
        schema_version: "webapp_consent_revocation_signal.v1",
        verdict: "revoked",
        scene_id: "scene-1",
        capture_id: "cap-1",
        consent_revoked_at: "2026-07-08T12:00:00Z",
        webapp_response_ids: {
          entitlement_id: "ent-robot-eval-revoked",
        },
        required_actions: ["revoke_buyer_and_reviewer_access"],
      });
      const revocationResponse = await fetch(`${baseUrl}/rights-privacy-revocation`, {
        method: "POST",
        ...revocationRequest,
      });

      expect(revocationResponse.status).toBe(200);
      await expect(revocationResponse.json()).resolves.toEqual(
        expect.objectContaining({
          ok: true,
          status: "revocation_applied",
          webapp_takedown_executed: true,
          revoked_entitlement_ids: ["ent-robot-eval-revoked"],
        }),
      );
      expect(
        state.collectionDocData.marketplaceEntitlements["ent-robot-eval-revoked"].access_state,
      ).toBe("revoked");
      expect(
        state.collectionDocData.marketplaceEntitlements["ent-robot-eval-revoked"].rights_privacy_takedown,
      ).toEqual(
        expect.objectContaining({
          status: "blocked_consent_revoked_takedown_required",
          verdict: "revoked",
          scene_id: "scene-1",
          capture_id: "cap-1",
        }),
      );
      expect(Object.values(state.collectionDocData.transactionalNotifications || {})).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event_type: "consent_revocation",
            channel: "in_app",
            status: "queued",
            recipient_user_id: "buyer-123",
            subject_id: "ent-robot-eval-revoked",
          }),
          expect.objectContaining({
            event_type: "consent_revocation",
            channel: "email",
            status: "skipped",
            skip_reason: "transactional_email_disabled",
            recipient_email_domain: "example.com",
          }),
        ]),
      );

      const accessRequest = signedPipelineRequest({
        webapp_response_ids: {
          entitlement_id: "ent-robot-eval-revoked",
          listing_id: "robot-eval-cap-revoked",
        },
        artifact_key: "package_uri",
      });
      const accessResponse = await fetch(`${baseUrl}/buyer-artifact-access-check`, {
        method: "POST",
        ...accessRequest,
      });

      expect(accessResponse.status).toBe(200);
      await expect(accessResponse.json()).resolves.toEqual(
        expect.objectContaining({
          ok: false,
          buyer_accessible: false,
          entitlement_verified: false,
          blocker: "marketplace_entitlement_revoked_by_consent_takedown",
          status: "blocked",
        }),
      );
      expect(state.signedUrlCalls).toEqual([]);
    } finally {
      await stopServer(server);
    }
  });

  it("blocks buyer artifact access when a provisioned entitlement is expired", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    state.collectionDocData = {
      marketplaceEntitlements: {
        "ent-robot-eval-expired": {
          id: "ent-robot-eval-expired",
          buyer_user_id: "buyer-123",
          sku: "robot-eval-cap-expired",
          access_state: "provisioned",
          expires_at: "2026-01-01T00:00:00.000Z",
          artifact_uris: {
            package_uri:
              "gs://bucket/marketplace-artifacts/ent-robot-eval-expired/package.zip",
          },
        },
      },
    };
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const signedRequest = signedPipelineRequest({
        webapp_response_ids: {
          entitlement_id: "ent-robot-eval-expired",
          listing_id: "robot-eval-cap-expired",
        },
        artifact_key: "package_uri",
      });
      const response = await fetch(`${baseUrl}/buyer-artifact-access-check`, {
        method: "POST",
        ...signedRequest,
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          ok: false,
          buyer_access_checked: true,
          buyer_accessible: false,
          entitlement_verified: false,
          blocker: "marketplace_entitlement_expired",
          status: "blocked",
        }),
      );
      expect(state.signedUrlCalls).toEqual([]);
    } finally {
      await stopServer(server);
    }
  });

  it("checks buyer artifact access by listing id and blocks when no provisioned entitlement exists", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    state.collectionDocData = {
      marketplaceEntitlements: {
        "ent-robot-eval-2": {
          id: "ent-robot-eval-2",
          buyer_user_id: "buyer-123",
          sku: "robot-eval-cap-2",
          access_state: "pending",
        },
      },
    };
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const signedRequest = signedPipelineRequest({
        webapp_response_ids: {
          listing_id: "robot-eval-cap-2",
        },
      });
      const response = await fetch(`${baseUrl}/buyer-artifact-access-check`, {
        method: "POST",
        ...signedRequest,
      });

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          ok: false,
          buyer_access_checked: true,
          buyer_accessible: false,
          entitlement_verified: false,
          blocker: "provisioned_marketplace_entitlement_not_found",
          status: "blocked",
        }),
      );
      expect(state.signedUrlCalls).toEqual([]);
    } finally {
      await stopServer(server);
    }
  });

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
      evaluation_readiness: {
        ...(pipelineAttachmentFixture.evaluation_readiness as Record<string, unknown>),
        qualification_state: "qualified_ready",
        opportunity_state: "handoff_ready",
      },
    };

    try {
      const signedRequest = signedPipelineRequest(payload);
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        ...signedRequest,
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
      const signedRequest = signedPipelineRequest(pipelineAttachmentFixture);
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        ...signedRequest,
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
      const signedRequest = signedPipelineRequest({
        ...pipelineAttachmentFixture,
        buyer_request_id: "",
      });
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        ...signedRequest,
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
      const signedRequest = signedPipelineRequest({
        ...pipelineAttachmentFixture,
        capture_job_id: "",
      });
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        ...signedRequest,
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
      const signedRequest = signedPipelineRequest(pipelineAttachmentFixture);
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        ...signedRequest,
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
          evaluation_readiness: expect.objectContaining({
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

  it("keeps placeholder fallback disabled in production even when the flag is enabled", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    process.env.PIPELINE_SYNC_ALLOW_PLACEHOLDER_REQUESTS = "true";
    state.queryDocs = [];
    state.docExists = false;

    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));

    try {
      const signedRequest = signedPipelineRequest(pipelineAttachmentFixture);
      const response = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        ...signedRequest,
      });

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ code: "missing_inbound_request_bootstrap" }),
      );
      expect(state.docSet).not.toHaveBeenCalled();
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
      await stopServer(server);
    }
  });






  it("accepts scene attachments without demanding an account claim", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    state.docExists = true;
    state.docData = {
      request: { buyerType: "site_operator" },
      contact: { email: "owner@example.com" },
    };
    const { server, baseUrl } = await startServer(() => import("../routes/internal-pipeline"));
    const signedRequest = signedPipelineRequest({
      ...pipelineAttachmentFixture,
      authoritative_state_update: true,
      qualification_state: "qualified_ready",
    });

    try {
      const first = await fetch(`${baseUrl}/attachments`, {
        method: "POST",
        ...signedRequest,
      });
      expect(first.status).toBe(200);
      await fetch(`${baseUrl}/attachments`, { method: "POST", ...signedRequest });

      const invites = findCollectionWrites("captureOutbox")
        .filter(row => row.payload.kind === "assessment_ready");
      expect(invites).toHaveLength(0);
    } finally {
      await stopServer(server);
    }
  });
});
