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

const sendEmailMock = vi.hoisted(() => vi.fn().mockResolvedValue({ sent: true }));
const buildIdempotencyKeyMock = vi.hoisted(() =>
  vi.fn().mockReturnValue({ key: "idempotency:apply:test", ttlMs: 600_000 }),
);
const fetchIdempotencyResponseMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const storeIdempotencyResponseMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

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

vi.mock("../utils/idempotency", () => ({
  buildIdempotencyKey: buildIdempotencyKeyMock,
  fetchIdempotencyResponse: fetchIdempotencyResponseMock,
  storeIdempotencyResponse: storeIdempotencyResponseMock,
}));

async function startApplyServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: applyHandler } = await import("../routes/apply");
  const app = express();
  app.post("/", applyHandler);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind apply route test server");
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
  buildIdempotencyKeyMock.mockClear();
  fetchIdempotencyResponseMock.mockClear();
  storeIdempotencyResponseMock.mockClear();
  vi.resetModules();
});

function buildApplicationForm() {
  const form = new FormData();
  form.set("name", "Ada Lovelace");
  form.set("portfolio", "https://example.com/portfolio");
  form.set("role", "Robotics evaluation engineer");
  form.set("email", "jobs@example.com");
  form.set("contactEmail", "ada@example.com");
  form.set("notes", "Private applicant context must not be copied into route logs.");
  return form;
}

describe("apply route logging", () => {
  it("logs successful application processing with safe operational metadata", async () => {
    const { server, baseUrl } = await startApplyServer();

    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        body: buildApplicationForm(),
      });

      expect(response.status).toBe(202);
      expect(storeIdempotencyResponseMock).toHaveBeenCalled();

      const infoCall = loggerMock.info.mock.calls.find(
        ([, message]) => message === "Application submission received",
      );
      expect(infoCall).toBeDefined();

      const [context] = infoCall ?? [];
      expect(context).toMatchObject({
        event: "application_submission_received",
        applicationRole: "Robotics evaluation engineer",
        hasResume: false,
        sent: true,
        confirmationSent: true,
      });

      const serializedContext = JSON.stringify(context);
      expect(serializedContext).not.toContain("ada@example.com");
      expect(serializedContext).not.toContain("jobs@example.com");
      expect(serializedContext).not.toContain("Private applicant context");
    } finally {
      await stopServer(server);
    }
  });

  it("logs rejected resume uploads with a stable event name", async () => {
    const { server, baseUrl } = await startApplyServer();

    try {
      const form = buildApplicationForm();
      form.set("resume", new Blob(["not a resume"], { type: "text/plain" }), "resume.txt");

      const response = await fetch(baseUrl, {
        method: "POST",
        body: form,
      });

      expect(response.status).toBe(400);

      const warnCall = loggerMock.warn.mock.calls.find(
        ([, message]) => message === "Application resume upload rejected",
      );
      expect(warnCall).toBeDefined();

      const [context] = warnCall ?? [];
      expect(context).toMatchObject({
        event: "application_resume_rejected",
        uploadError: "Only PDF, DOC, or DOCX files are allowed.",
      });
    } finally {
      await stopServer(server);
    }
  });
});
