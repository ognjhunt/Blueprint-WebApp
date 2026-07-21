// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  blueprints: new Map<string, Record<string, unknown>>(),
  transactionalNotifications: new Map<string, Record<string, unknown>>(),
  uploadToBackblaze: vi.fn(),
  recordBetaOpsFailureSignal: vi.fn(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {},
  dbAdmin: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data =
            name === "blueprints"
              ? state.blueprints.get(id)
              : name === "transactionalNotifications"
                ? state.transactionalNotifications.get(id)
                : undefined;
          return {
            exists: Boolean(data),
            data: () => data,
          };
        },
        set: async (payload: Record<string, unknown>) => {
          if (name === "transactionalNotifications") {
            state.transactionalNotifications.set(id, payload);
          }
        },
      }),
    }),
  },
}));

vi.mock("../utils/storage-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/storage-provider")>();
  return {
    ...actual,
    uploadToBackblaze: state.uploadToBackblaze,
  };
});

vi.mock("../utils/ops-alerts", () => ({
  recordBetaOpsFailureSignal: state.recordBetaOpsFailureSignal,
}));

async function startServer(firebaseUser: Record<string, unknown> = { uid: "buyer-123" }) {
  const { default: router } = await import("../routes/storage-uploads");
  const app = express();
  app.use((_, res, next) => {
    res.locals.firebaseUser = firebaseUser;
    next();
  });
  app.use("/uploads", router);

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

function uploadForm(objectPath: string, fileName = "placeholder.txt") {
  const form = new FormData();
  form.set("path", objectPath);
  form.set("file", new Blob(["hello"], { type: "text/plain" }), fileName);
  return form;
}

afterEach(() => {
  state.blueprints.clear();
  state.transactionalNotifications.clear();
  state.uploadToBackblaze.mockReset();
  state.recordBetaOpsFailureSignal.mockReset();
  delete process.env.BLUEPRINT_STORAGE_PROVIDER;
});

describe("storage uploads route", () => {
  it("uploads an owned blueprint object when Backblaze is active", async () => {
    process.env.BLUEPRINT_STORAGE_PROVIDER = "backblaze";
    state.blueprints.set("bp-owned", { ownerId: "buyer-123" });
    state.uploadToBackblaze.mockResolvedValue({
      provider: "backblaze",
      objectPath: "blueprints/bp-owned/placeholder.txt",
      url: "https://b2.example/blueprints/bp-owned/placeholder.txt",
      bucketName: "blueprint",
    });

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/uploads`, {
        method: "POST",
        body: uploadForm("blueprints/bp-owned/placeholder.txt"),
      });

      await expect(response.json()).resolves.toMatchObject({
        provider: "backblaze",
        objectPath: "blueprints/bp-owned/placeholder.txt",
      });
      expect(response.status).toBe(200);
      expect(state.uploadToBackblaze).toHaveBeenCalledWith(
        expect.objectContaining({
          objectPath: "blueprints/bp-owned/placeholder.txt",
          contentType: "text/plain",
          data: expect.any(Buffer),
        }),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("denies user-scoped writes for a different owner", async () => {
    process.env.BLUEPRINT_STORAGE_PROVIDER = "backblaze";

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/uploads`, {
        method: "POST",
        body: uploadForm("captures/other-user/capture.bin", "capture.bin"),
      });

      await expect(response.json()).resolves.toMatchObject({
        error: "Storage path access denied",
      });
      expect(response.status).toBe(403);
      expect(state.uploadToBackblaze).not.toHaveBeenCalled();
      expect(Array.from(state.transactionalNotifications.values())).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event_type: "capture_rejected",
            channel: "in_app",
            status: "queued",
            recipient_user_id: "buyer-123",
            subject_id: "captures/other-user/capture.bin",
          }),
        ]),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("refuses the server upload route when Firebase storage mode is active", async () => {
    process.env.BLUEPRINT_STORAGE_PROVIDER = "firebase";
    state.blueprints.set("bp-owned", { ownerId: "buyer-123" });

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/uploads`, {
        method: "POST",
        body: uploadForm("blueprints/bp-owned/placeholder.txt"),
      });

      await expect(response.json()).resolves.toMatchObject({
        error: "Server storage provider is not Backblaze.",
        provider: "firebase",
      });
      expect(response.status).toBe(409);
      expect(state.uploadToBackblaze).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });

  it("records a capture upload failure signal when Backblaze upload fails", async () => {
    process.env.BLUEPRINT_STORAGE_PROVIDER = "backblaze";
    state.blueprints.set("bp-owned", { ownerId: "buyer-123" });
    state.uploadToBackblaze.mockRejectedValue(new Error("B2 unavailable"));

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/uploads`, {
        method: "POST",
        body: uploadForm("blueprints/bp-owned/placeholder.txt"),
      });

      await expect(response.json()).resolves.toMatchObject({
        error: "Storage upload failed",
      });
      expect(response.status).toBe(500);
      expect(state.recordBetaOpsFailureSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "capture_upload_failure",
          scopeId: "blueprints/bp-owned/placeholder.txt",
          severity: "critical",
          summary: "Storage upload failed.",
          details: expect.objectContaining({
            uid: "buyer-123",
            provider: "backblaze",
            object_path: "blueprints/bp-owned/placeholder.txt",
            status_code: 500,
            error_message: "B2 unavailable",
          }),
        }),
      );
    } finally {
      await stopServer(server);
    }
  });
});
