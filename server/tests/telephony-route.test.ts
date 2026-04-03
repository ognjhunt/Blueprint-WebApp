// @vitest-environment node
import express from "express";
import { createServer } from "http";
import type { Server } from "http";
import { afterEach, describe, expect, it, vi } from "vitest";

const contactRequests = new Map<string, Record<string, unknown>>();
const voicePhoneCalls = new Map<string, Record<string, unknown>>();
const voicePhoneEvents: Array<Record<string, unknown>> = [];

function resetState() {
  contactRequests.clear();
  voicePhoneCalls.clear();
  voicePhoneEvents.length = 0;
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

      if (name === "voice_phone_calls") {
        return {
          doc(id: string) {
            return {
              async set(payload: Record<string, unknown>) {
                voicePhoneCalls.set(id, payload);
              },
            };
          },
        };
      }

      if (name === "voice_phone_call_events") {
        return {
          async add(payload: Record<string, unknown>) {
            voicePhoneEvents.push(payload);
          },
        };
      }

      if (name === "voice_support_conversations" || name === "voice_support_queue") {
        return {
          doc() {
            return {
              async set() {
                return undefined;
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
  const { telephonyInboundHandler, telephonyStatusHandler } = await import("../routes/voice");
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.post("/api/voice/telephony/inbound", telephonyInboundHandler);
  app.post("/api/voice/telephony/status", telephonyStatusHandler);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind telephony test server");
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
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("telephony voice routes", () => {
  it("returns TwiML gather instructions for a fresh inbound call", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/voice/telephony/inbound`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          CallSid: "CA123",
          From: "+19195550123",
          To: "+19195550999",
        }),
      });

      const text = await response.text();
      expect(response.status).toBe(200);
      expect(text).toContain("<Gather");
      expect(text).toContain("press 1 to book a hosted review");
      expect(voicePhoneCalls.get("CA123")).toMatchObject({
        call_sid: "CA123",
        from: "+19195550123",
      });
    } finally {
      await stopServer(server);
    }
  }, 15_000);

  it("mirrors gathered call intent into the support queue and dials a human when configured", async () => {
    vi.stubEnv("BLUEPRINT_VOICE_FORWARD_NUMBER", "+19195550000");
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/voice/telephony/inbound`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          CallSid: "CA456",
          From: "+19195550123",
          To: "+19195550999",
          Digits: "3",
        }),
      });

      const text = await response.text();
      expect(response.status).toBe(200);
      expect(text).toContain("<Dial>+19195550000</Dial>");
      expect(contactRequests.get("call_CA456")).toMatchObject({
        requestSource: "voice_pstn",
        phone: "+19195550123",
        ops_automation: expect.objectContaining({
          status: "pending",
          queue: "support_triage",
        }),
      });
    } finally {
      await stopServer(server);
    }
  }, 15_000);
});
