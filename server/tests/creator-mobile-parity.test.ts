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

async function startServer() {
  const { default: creatorRouter } = await import("../routes/creator");
  const app = express();
  app.use(express.json());
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

describe("creator mobile parity routes", () => {
  it("stores the current notification device registration", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/v1/creator/devices/current`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Blueprint-Creator-Id": "creator-123",
        },
        body: JSON.stringify({
          creator_id: "creator-123",
          platform: "iOS",
          fcm_token: "token-123",
          authorization_status: "authorized",
          app_version: "1.0 (1)",
          last_seen_at: "2026-03-20T12:00:00.000Z",
        }),
      });

      expect(response.status).toBe(200);
      expect(state.docSet).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_device: expect.objectContaining({
            creator_id: "creator-123",
            fcm_token: "token-123",
            authorization_status: "authorized",
          }),
        }),
        { merge: true },
      );
    } finally {
      await stopServer(server);
    }
  });

  it("round-trips notification preferences with mobile field names", async () => {
    state.profileData = {
      notification_preferences: {
        nearby_jobs: false,
        reservations: true,
        capture_status: false,
        payouts: true,
        account: false,
      },
    };

    const { server, baseUrl } = await startServer();
    try {
      const getResponse = await fetch(
        `${baseUrl}/v1/creator/notifications/preferences`,
        {
          headers: {
            "X-Blueprint-Creator-Id": "creator-123",
          },
        },
      );
      expect(getResponse.status).toBe(200);
      await expect(getResponse.json()).resolves.toMatchObject({
        nearby_jobs: false,
        reservations: true,
        capture_status: false,
        payouts: true,
        account: false,
      });

      const putResponse = await fetch(
        `${baseUrl}/v1/creator/notifications/preferences`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-Blueprint-Creator-Id": "creator-123",
          },
          body: JSON.stringify({
            nearby_jobs: true,
            reservations: false,
            capture_status: true,
            payouts: false,
            account: true,
          }),
        },
      );

      expect(putResponse.status).toBe(200);
      expect(state.docSet).toHaveBeenCalledWith(
        expect.objectContaining({
          notification_preferences: {
            nearby_jobs: true,
            reservations: false,
            capture_status: true,
            payouts: false,
            account: true,
          },
        }),
        { merge: true },
      );
    } finally {
      await stopServer(server);
    }
  });
});
