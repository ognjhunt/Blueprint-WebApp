// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  profileData: {} as Record<string, unknown>,
  docSet: vi.fn().mockResolvedValue(undefined),
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
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => state.profileData,
        }),
        set: state.docSet,
      }),
      where: () => ({
        get: async () => ({ docs: [] }),
      }),
    }),
  },
}));

async function startCreatorServer() {
  const { default: creatorRouter } = await import("../routes/creator");
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    res.locals.firebaseUser = { uid: "creator-auth-123" };
    next();
  });
  app.use("/v1/creator", creatorRouter);
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

afterEach(() => {
  state.profileData = {};
  state.docSet.mockReset();
  state.docSet.mockResolvedValue(undefined);
});

describe("native creator auth binding", () => {
  it("rejects creator headers that do not match the authenticated Firebase uid", async () => {
    const { server, baseUrl } = await startCreatorServer();
    try {
      const response = await fetch(`${baseUrl}/v1/creator/profile`, {
        headers: {
          "X-Blueprint-Creator-Id": "someone-else",
        },
      });

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        error: "Creator identity does not match authenticated user",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("binds writes to the authenticated uid when no creator header is supplied", async () => {
    const { server, baseUrl } = await startCreatorServer();
    try {
      const response = await fetch(`${baseUrl}/v1/creator/devices/current`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: "iOS",
          fcm_token: "token-auth",
          authorization_status: "authorized",
          app_version: "1.0",
        }),
      });

      expect(response.status).toBe(200);
      expect(state.docSet).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_device: expect.objectContaining({
            creator_id: "creator-auth-123",
          }),
        }),
        { merge: true },
      );
    } finally {
      await stopServer(server);
    }
  });
});
