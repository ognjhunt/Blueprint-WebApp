// @vitest-environment node
import express from "express";
import { createServer, type Server } from "http";
import { afterEach, describe, expect, it, vi } from "vitest";

const ingestHumanReplyPayload = vi.hoisted(() => vi.fn());
const evaluateSlackHumanReplySurface = vi.hoisted(() => vi.fn());

vi.mock("../utils/human-reply-worker", () => ({
  ingestHumanReplyPayload,
}));

vi.mock("../utils/human-reply-slack", () => ({
  evaluateSlackHumanReplySurface,
}));

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: slackEventsRouter } = await import("../routes/slack-events");
  const app = express();
  app.use(
    express.json({
      verify: (req: express.Request & { rawBody?: string }, _res, buf) => {
        req.rawBody = buf.toString("utf8");
      },
    }),
  );
  app.use("/api/slack", slackEventsRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind slack test server");
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
  vi.unstubAllEnvs();
  vi.resetModules();
  ingestHumanReplyPayload.mockReset();
  evaluateSlackHumanReplySurface.mockReset();
});

describe("slack events route", () => {
  it("responds to slack url verification challenges", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/slack/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "url_verification",
          challenge: "challenge-token",
        }),
      });

      const text = await response.text();
      expect(response.status).toBe(200);
      expect(text).toBe("challenge-token");
    } finally {
      await stopServer(server);
    }
  });

  it("forwards human reply candidate messages into the reply ingest pipeline", async () => {
    evaluateSlackHumanReplySurface.mockReturnValue({
      accepted: true,
      reason: "dm_allowed",
    });
    ingestHumanReplyPayload.mockResolvedValue({
      processed: true,
      blocker_id: "blocker-1",
    });

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/slack/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "event_callback",
          event_id: "Ev123",
          event_time: 1712960000,
          event: {
            type: "message",
            channel: "D123",
            user: "U123",
            text: "I added FIELD_ENCRYPTION_MASTER_KEY",
            ts: "1712960000.000200",
            thread_ts: "1712960000.000100",
          },
        }),
      });

      expect(response.status).toBe(200);
      expect(ingestHumanReplyPayload).toHaveBeenCalledWith({
        channel: "slack",
        external_message_id: "1712960000.000200",
        external_thread_id: "D123:1712960000.000100",
        sender: "U123",
        recipient: "D123",
        subject: null,
        body: "I added FIELD_ENCRYPTION_MASTER_KEY",
        received_at: new Date(1712960000 * 1000).toISOString(),
      });
      expect(evaluateSlackHumanReplySurface).toHaveBeenCalledWith({
        channel: "D123",
        channelType: null,
        threadTs: "1712960000.000100",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("fails closed for root channel replies outside the allowed Slack surfaces", async () => {
    evaluateSlackHumanReplySurface.mockReturnValue({
      accepted: false,
      reason: "root_channel_not_supported",
    });

    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/api/slack/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "event_callback",
          event_id: "Ev124",
          event_time: 1712960001,
          event: {
            type: "message",
            channel: "Callowed",
            channel_type: "channel",
            user: "U123",
            text: "approved",
            ts: "1712960001.000200",
          },
        }),
      });

      expect(response.status).toBe(200);
      expect(ingestHumanReplyPayload).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });
});
