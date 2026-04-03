// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "http";
import { afterEach, describe, expect, it, vi } from "vitest";

const contactRequests = new Map<string, Record<string, unknown>>();
const voiceConversations = new Map<string, Record<string, unknown>>();
const voiceQueue = new Map<string, Record<string, unknown>>();

function resetState() {
  contactRequests.clear();
  voiceConversations.clear();
  voiceQueue.clear();
}

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "timestamp",
      },
    },
  },
  dbAdmin: {
    collection(name: string) {
      if (name === "contactRequests") {
        return {
          doc(id: string) {
            return {
              async get() {
                return { exists: contactRequests.has(id) };
              },
              async set(payload: Record<string, unknown>) {
                contactRequests.set(id, {
                  ...(contactRequests.get(id) || {}),
                  ...payload,
                });
              },
            };
          },
        };
      }

      if (name === "voice_support_conversations") {
        return {
          doc(id: string) {
            return {
              async set(payload: Record<string, unknown>) {
                voiceConversations.set(id, payload);
              },
            };
          },
        };
      }

      if (name === "voice_support_queue") {
        return {
          doc(id: string) {
            return {
              async set(payload: Record<string, unknown>) {
                voiceQueue.set(id, payload);
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection ${name}`);
    },
  },
}));

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: voiceRouter } = await import("../routes/voice");
  const app = express();
  app.use(express.json());
  app.use(voiceRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind voice test server");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  if ("closeAllConnections" in server && typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

afterEach(() => {
  resetState();
  vi.resetModules();
});

describe("voice support route", () => {
  it("mirrors booking and support conversations into the support triage queue", async () => {
    const { server, baseUrl } = await startServer();

    try {
      const response = await fetch(`${baseUrl}/support/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: "voice-1",
          message: "Can I book a demo for the exact site review?",
          pageContext: "exact-site hosted review landing page",
        }),
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        ok: boolean;
        bookingUrl?: string;
      };
      expect(payload.ok).toBe(true);
      expect(payload.bookingUrl).toBeTruthy();

      expect(voiceConversations.get("voice-1")).toMatchObject({
        conversation_id: "voice-1",
        category: "booking",
      });
      expect(voiceQueue.get("voice-1")).toMatchObject({
        conversation_id: "voice-1",
        category: "booking",
      });
      expect(contactRequests.get("voice-1")).toMatchObject({
        requestSource: "voice_concierge",
        message: "Can I book a demo for the exact site review?",
        pageContext: "exact-site hosted review landing page",
        human_review_required: true,
        ops_automation: expect.objectContaining({
          status: "pending",
          queue: "support_triage",
          next_action: "triage voice concierge request",
        }),
        voice_concierge: expect.objectContaining({
          conversation_id: "voice-1",
          category: "booking",
        }),
      });
    } finally {
      await stopServer(server);
    }
  }, 15_000);
});
