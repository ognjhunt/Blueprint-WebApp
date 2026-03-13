// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "http";

const getBlueprintDocMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    exists: true,
    data: () => ({}),
  }),
);
const dbAdminMock = vi.hoisted(() => ({
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({
      get: getBlueprintDocMock,
    })),
  })),
}));
const getCachedAnswerMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const embedTextsMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const searchVenueMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: dbAdminMock,
}));

vi.mock("../retrieval/answerCache", () => ({
  cacheKey: vi.fn(() => "ai-studio-cache-key"),
  getCachedAnswer: getCachedAnswerMock,
  putCachedAnswer: vi.fn(),
}));

vi.mock("../retrieval/embeddings", () => ({
  embedTexts: embedTextsMock,
}));

vi.mock("../retrieval/venueIndexer", () => ({
  searchVenue: searchVenueMock,
}));

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const { default: aiStudioRouter } = await import("../routes/ai-studio");

  const app = express();
  app.use(express.json());
  app.use(aiStudioRouter);

  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Failed to bind test server");
      }
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

beforeEach(() => {
  vi.unstubAllEnvs();
  getCachedAnswerMock.mockResolvedValue(null);
  embedTextsMock.mockResolvedValue([]);
  searchVenueMock.mockResolvedValue([]);
  getBlueprintDocMock.mockResolvedValue({
    exists: true,
    data: () => ({}),
  });
  dbAdminMock.collection.mockClear();
});

describe("AI Studio route", () => {
  it("returns a bad request when blueprintId is missing", async () => {
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "What is happening in this venue?",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "blueprintId is required",
    });
  });

  it("returns a bad request when message is missing", async () => {
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blueprintId: "bp-123",
      }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "message is required",
    });
  });

  it("returns a cached response without hitting Firestore", async () => {
    getCachedAnswerMock.mockResolvedValue({
      content: "Cached venue answer",
      model: "gemini-test",
      fromCache: false,
    });

    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blueprintId: "bp-123",
        message: "What is happening in this venue?",
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      content: "Cached venue answer",
      model: "gemini-test",
      fromCache: true,
    });
    expect(dbAdminMock.collection).not.toHaveBeenCalled();
  });

  it("returns not found when the blueprint does not exist", async () => {
    getBlueprintDocMock.mockResolvedValue({
      exists: false,
      data: () => ({}),
    });

    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blueprintId: "bp-missing",
        message: "What is happening in this venue?",
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "Blueprint not found",
    });
  });

  it("fails closed when Gemini credentials are missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GOOGLE_API_KEY", "");

    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blueprintId: "bp-123",
        message: "What is happening in this venue?",
      }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error:
        "AI Studio is unavailable because GEMINI_API_KEY or GOOGLE_API_KEY is not configured on the server.",
      code: "gemini_api_key_missing",
    });
  });
});
