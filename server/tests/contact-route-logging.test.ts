// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "http";

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const sendEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: false }));

vi.mock("../logger", async () => {
  const actual = await vi.importActual<typeof import("../logger")>("../logger");
  return {
    ...actual,
    logger: loggerMock,
  };
});

vi.mock("../utils/email", () => ({
  sendEmail: sendEmailMock,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => ({ __type: "serverTimestamp" }),
      },
    },
  },
  dbAdmin: null,
}));

async function startContactServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: contactHandler } = await import("../routes/contact");
  const app = express();
  app.use(express.json());
  app.post("/", contactHandler);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind contact route test server");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

afterEach(() => {
  loggerMock.info.mockReset();
  loggerMock.warn.mockReset();
  loggerMock.error.mockReset();
  sendEmailMock.mockClear();
  vi.resetModules();
});

describe("contact route logging", () => {
  it("logs the durable Firestore blocker without raw email or payload data", async () => {
    const { server, baseUrl } = await startContactServer();

    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestSource: "website-contact-form",
          requestType: "dataset",
          name: "Ada Lovelace",
          email: "ada@example.com",
          company: "Analytical Engines",
          message: "Private site details should not be copied into route logs.",
        }),
      });

      expect(response.status).toBe(503);

      const errorCall = loggerMock.error.mock.calls.find(
        ([, message]) => message === "Contact form Firestore records unavailable",
      );
      expect(errorCall).toBeDefined();

      const [context] = errorCall ?? [];
      expect(context).toMatchObject({
        event: "contact_form_firestore_required_unavailable",
        requestSource: "website-contact-form",
        requestType: "dataset",
        emailDomain: "example.com",
        hasMessage: true,
      });

      const serializedContext = JSON.stringify(context);
      expect(serializedContext).not.toContain("ada@example.com");
      expect(serializedContext).not.toContain("Private site details");
      expect(serializedContext).not.toContain("Analytical Engines");
    } finally {
      await stopServer(server);
    }
  });
});
