// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";
import { createHmac } from "node:crypto";

// R027: consent revocation must be self-enforcing across the delivery chain.
// These tests prove the WebApp ingestion route flips every entitlement linked to
// a revoked capture to access_state="revoked", that the signed-URL mint paths
// then refuse it, and that unrelated entitlements are untouched.

const state = vi.hoisted(() => ({
  // collection -> docId -> data
  collectionDocData: {} as Record<string, Record<string, Record<string, unknown>>>,
  collectionWrites: [] as Array<{
    collection: string;
    id: string;
    payload: Record<string, unknown>;
    options?: Record<string, unknown>;
  }>,
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
    collection: (name: string) => {
      const docsFor = (filters: Array<{ field: string; value: unknown }>) =>
        Object.entries(state.collectionDocData[name] || {})
          .filter(([, data]) => filters.every(({ field, value }) => data[field] === value))
          .map(([id, data]) => ({ id, data: () => data }));
      const buildQuery = (filters: Array<{ field: string; value: unknown }> = []): {
        where: (field: string, op: string, value: unknown) => ReturnType<typeof buildQuery>;
        limit: (count: number) => { get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }> };
        get: () => Promise<{ docs: Array<{ id: string; data: () => Record<string, unknown> }> }>;
      } => ({
        where: (field: string, _op: string, value: unknown) =>
          buildQuery([...filters, { field, value }]),
        limit: (count: number) => ({
          get: async () => ({ docs: docsFor(filters).slice(0, count) }),
        }),
        get: async () => ({ docs: docsFor(filters) }),
      });
      return {
        doc: (id: string) => ({
          id: id || "mock-doc-id",
          get: async () => {
            const data = state.collectionDocData[name]?.[id];
            return {
              exists: Boolean(data),
              id,
              data: () => data || {},
            };
          },
          set: async (payload: Record<string, unknown>, options?: Record<string, unknown>) => {
            state.collectionWrites.push({ collection: name, id, payload, options });
            state.collectionDocData[name] = state.collectionDocData[name] || {};
            const prev = state.collectionDocData[name][id] || {};
            state.collectionDocData[name][id] = options?.merge
              ? { ...prev, ...payload }
              : { ...payload };
          },
        }),
        where: (field: string, _op: string, value: unknown) => buildQuery([{ field, value }]),
      };
    },
  },
  storageAdmin: {
    bucket: (bucket: string) => ({
      file: (objectPath: string) => ({
        getSignedUrl: async (options: Record<string, unknown>) => {
          state.signedUrlCalls.push({ bucket, objectPath, options });
          return [`https://storage.example.test/${bucket}/${objectPath}?signed=1`];
        },
      }),
    }),
  },
  authAdmin: null,
}));

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: internalPipelineRouter } = await import("../routes/internal-pipeline");
  const { default: marketplaceRouter } = await import("../routes/marketplace-entitlements");
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    res.locals.firebaseUser = { uid: "buyer-123" };
    next();
  });
  app.use("/api/internal/pipeline", internalPipelineRouter);
  app.use("/api/marketplace/entitlements", marketplaceRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
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

function takedownNotice(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "post_training_webapp_rights_privacy_takedown_notice.v1",
    generated_at: "2026-07-09T00:00:00.000Z",
    scene_id: "scene-x",
    capture_id: "cap-x",
    status: "queued_unexecuted_webapp_rights_privacy_blocking",
    consent_revoked: true,
    consent_revoked_at: "2026-07-08T12:00:00.000Z",
    required_webapp_state: "blocked_consent_revoked_takedown_required",
    revocation_takedown_manifest_path: "revocation_takedown_manifest.json",
    required_actions: [
      "mark_webapp_rights_privacy_blocking",
      "hide_package_delivery_affordances",
    ],
    webapp_takedown_executed: false,
    ...overrides,
  };
}

function seedBaselineInventoryAndEntitlements() {
  // Marketplace inventory carries the capture/scene linkage and is keyed by sku.
  state.collectionDocData.publishedMarketplaceInventory = {
    "robot-eval-cap-x": {
      sku: "robot-eval-cap-x",
      capture_id: "cap-x",
      scene_id: "scene-x",
    },
    "robot-eval-cap-y": {
      sku: "robot-eval-cap-y",
      capture_id: "cap-y",
      scene_id: "scene-y",
      artifact_uris: {
        package_uri: "gs://blueprint-artifacts/packages/cap-y/package.zip",
      },
    },
  };
  state.collectionDocData.marketplace_items = {
    "robot-eval-cap-x": {
      sku: "robot-eval-cap-x",
      capture_id: "cap-x",
      scene_id: "scene-x",
    },
  };
  state.collectionDocData.marketplaceEntitlements = {
    "ent-x": {
      id: "ent-x",
      buyer_user_id: "buyer-123",
      sku: "robot-eval-cap-x",
      access_state: "provisioned",
    },
    "ent-unrelated": {
      id: "ent-unrelated",
      buyer_user_id: "buyer-123",
      sku: "robot-eval-cap-y",
      access_state: "provisioned",
    },
  };
}

afterEach(() => {
  state.collectionDocData = {};
  state.collectionWrites = [];
  state.signedUrlCalls = [];
  delete process.env.PIPELINE_SYNC_TOKEN;
  vi.resetModules();
});

describe("consent revocation takedown (R027)", () => {
  it("flips entitlements linked to the revoked capture to revoked and leaves others untouched", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    seedBaselineInventoryAndEntitlements();

    const { server, baseUrl } = await startServer();
    try {
      const signed = signedPipelineRequest(takedownNotice());
      const response = await fetch(`${baseUrl}/api/internal/pipeline/consent-revocation-takedown`, {
        method: "POST",
        ...signed,
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toMatchObject({
        ok: true,
        webapp_takedown_executed: true,
        capture_id: "cap-x",
        scene_id: "scene-x",
        affected_skus: ["robot-eval-cap-x"],
        revoked_entitlement_ids: ["ent-x"],
      });

      // The affected entitlement is now revoked with a takedown audit trail.
      const revoked = state.collectionDocData.marketplaceEntitlements["ent-x"];
      expect(revoked.access_state).toBe("revoked");
      expect(revoked.takedown).toMatchObject({
        revoked: true,
        reason: "consent_revoked_takedown_required",
        capture_id: "cap-x",
        scene_id: "scene-x",
        previous_access_state: "provisioned",
        consent_revoked_at: "2026-07-08T12:00:00.000Z",
        source_notice_id: "consent_revocation_takedown:cap-x:2026-07-09T00:00:00.000Z",
      });

      // The unrelated entitlement is untouched.
      expect(state.collectionDocData.marketplaceEntitlements["ent-unrelated"].access_state).toBe(
        "provisioned",
      );
      expect(state.collectionDocData.marketplaceEntitlements["ent-unrelated"].takedown).toBeUndefined();

      // A ledger row records when/why the takedown happened.
      const ledger = state.collectionWrites.find(
        (write) => write.collection === "consentRevocationTakedowns",
      );
      expect(ledger?.payload).toMatchObject({
        notice_id: "consent_revocation_takedown:cap-x:2026-07-09T00:00:00.000Z",
        capture_id: "cap-x",
        revoked_entitlement_ids: ["ent-x"],
        webapp_takedown_executed: true,
      });
    } finally {
      await stopServer(server);
    }
  });

  it("refuses to mint a signed URL for a revoked entitlement but still mints for unrelated ones", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    seedBaselineInventoryAndEntitlements();

    const { server, baseUrl } = await startServer();
    try {
      // Execute the takedown.
      const signed = signedPipelineRequest(takedownNotice());
      const ingest = await fetch(`${baseUrl}/api/internal/pipeline/consent-revocation-takedown`, {
        method: "POST",
        ...signed,
      });
      expect(ingest.status).toBe(200);

      // Buyer-facing mint path (marketplace-entitlements.ts) now refuses ent-x.
      const revokedMint = await fetch(
        `${baseUrl}/api/marketplace/entitlements/ent-x/artifact-access?artifact=package_uri`,
      );
      expect(revokedMint.status).toBe(403);
      await expect(revokedMint.json()).resolves.toMatchObject({
        code: "entitlement_revoked",
      });
      expect(state.signedUrlCalls).toEqual([]);

      // Internal Pipeline mint path also refuses ent-x with a distinct blocker.
      const internalMint = await fetch(
        `${baseUrl}/api/internal/pipeline/buyer-artifact-access-check`,
        {
          method: "POST",
          ...signedPipelineRequest({
            webapp_response_ids: { entitlement_id: "ent-x" },
          }),
        },
      );
      expect(internalMint.status).toBe(200);
      await expect(internalMint.json()).resolves.toMatchObject({
        ok: false,
        buyer_accessible: false,
        blocker: "marketplace_entitlement_revoked_by_consent_takedown",
      });
      expect(state.signedUrlCalls).toEqual([]);

      // The unrelated, still-provisioned entitlement mints a signed URL normally.
      const unrelatedMint = await fetch(
        `${baseUrl}/api/marketplace/entitlements/ent-unrelated/artifact-access?artifact=package_uri`,
      );
      expect(unrelatedMint.status).toBe(200);
      await expect(unrelatedMint.json()).resolves.toMatchObject({
        entitlement_id: "ent-unrelated",
        artifact_key: "package_uri",
        signed_url:
          "https://storage.example.test/blueprint-artifacts/packages/cap-y/package.zip?signed=1",
      });
      expect(state.signedUrlCalls).toHaveLength(1);
    } finally {
      await stopServer(server);
    }
  });

  it("rejects a notice that does not indicate consent revocation without flipping anything", async () => {
    process.env.PIPELINE_SYNC_TOKEN = "secret";
    seedBaselineInventoryAndEntitlements();

    const { server, baseUrl } = await startServer();
    try {
      const signed = signedPipelineRequest(
        takedownNotice({
          consent_revoked: false,
          status: "not_required",
          required_webapp_state: "",
        }),
      );
      const response = await fetch(`${baseUrl}/api/internal/pipeline/consent-revocation-takedown`, {
        method: "POST",
        ...signed,
      });

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        ok: false,
        webapp_takedown_executed: false,
        code: "notice_not_a_revocation",
      });
      expect(state.collectionDocData.marketplaceEntitlements["ent-x"].access_state).toBe(
        "provisioned",
      );
    } finally {
      await stopServer(server);
    }
  });
});
