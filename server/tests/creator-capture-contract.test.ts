// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
}));

vi.mock("../utils/slack", () => ({
  sendSlackMessage: vi.fn(async () => ({ ok: true })),
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
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const data = state.docs.get(`${name}/${id}`);
          return { exists: Boolean(data), data: () => data };
        },
        set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
          const key = `${name}/${id}`;
          const previous = state.docs.get(key) || {};
          state.docs.set(key, options?.merge ? { ...previous, ...data } : data);
        },
      }),
      where: () => ({
        get: async () => ({ docs: [] }),
      }),
    }),
  },
}));

const BETA_ENV = {
  BLUEPRINT_BETA_INVITE_CAP: "10",
  BLUEPRINT_BETA_COHORT_DAILY_LIMIT: "10",
} as const;

async function startCreatorServer(uid = "creator-auth-123") {
  for (const [key, value] of Object.entries(BETA_ENV)) {
    process.env[key] = value;
  }
  const { default: creatorRouter } = await import("../routes/creator");
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    res.locals.firebaseUser = { uid };
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
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function postJson(baseUrl: string, path: string, body: unknown) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  state.docs.clear();
  for (const key of Object.keys(BETA_ENV)) {
    delete process.env[key];
  }
  vi.resetModules();
});

describe("creator capture registration contract", () => {
  it("registers narrow client evidence with server-owned authoritative fields", async () => {
    const { server, baseUrl } = await startCreatorServer();
    try {
      const response = await postJson(`${baseUrl}`, "/v1/creator/captures", {
        id: "cap-1",
        captured_at: "2026-07-10T10:00:00.000Z",
        target_address: "12 Factory Way",
        estimated_payout_cents: 5000,
        rights_profile: "commercial_full",
        platform: "ios",
        app_version: "2.1.0",
      });
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        id: "cap-1",
        status: "submitted",
      });

      const doc = state.docs.get("creatorCaptures/cap-1")!;
      expect(doc).toMatchObject({
        creator_id: "creator-auth-123",
        status: "submitted",
        estimated_payout_cents: null,
        rejection_reason: null,
        quality: null,
        earnings: null,
        rights_clearance: null,
      });
      expect(doc.client_reported).toMatchObject({
        estimated_payout_cents: 5000,
        rights_profile: "commercial_full",
        platform: "ios",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("never persists client-asserted status, payout, QA, or earnings escalation", async () => {
    const { server, baseUrl } = await startCreatorServer();
    try {
      const response = await postJson(`${baseUrl}`, "/v1/creator/captures", {
        id: "cap-esc",
        status: "paid",
        estimated_payout_cents: 999999,
        rejection_reason: "none",
        quality: { score: 100 },
        device_multiplier: 9,
        bonuses: [{ label: "self-award", amount_cents: 100000 }],
        earnings: { total_payout_cents: 999999 },
      });
      expect(response.status).toBe(201);

      const doc = state.docs.get("creatorCaptures/cap-esc")!;
      expect(doc.status).toBe("submitted");
      expect(doc.estimated_payout_cents).toBeNull();
      expect(doc.rejection_reason).toBeNull();
      expect(doc.quality).toBeNull();
      expect(doc.earnings).toBeNull();
      expect(JSON.stringify(doc)).not.toContain("self-award");
    } finally {
      await stopServer(server);
    }
  });

  it("rejects arbitrary unknown fields with a deterministic error code", async () => {
    const { server, baseUrl } = await startCreatorServer();
    try {
      const response = await postJson(`${baseUrl}`, "/v1/creator/captures", {
        id: "cap-unknown",
        totally_made_up_field: "x",
      });
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({
        code: "invalid_fields",
        fields: ["totally_made_up_field"],
      });
      expect(state.docs.has("creatorCaptures/cap-unknown")).toBe(false);
    } finally {
      await stopServer(server);
    }
  });

  it("is idempotent for same-creator replays and never regresses backend state", async () => {
    const { server, baseUrl } = await startCreatorServer();
    try {
      const first = await postJson(`${baseUrl}`, "/v1/creator/captures", { id: "cap-replay" });
      expect(first.status).toBe(201);

      // Simulate backend review having advanced the capture.
      const key = "creatorCaptures/cap-replay";
      state.docs.set(key, { ...state.docs.get(key)!, status: "approved", estimated_payout_cents: 4200 });

      const replay = await postJson(`${baseUrl}`, "/v1/creator/captures", { id: "cap-replay" });
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({ ok: true, replay: true, status: "approved" });
      expect(state.docs.get(key)).toMatchObject({ status: "approved", estimated_payout_cents: 4200 });
    } finally {
      await stopServer(server);
    }
  });

  it("refuses to overwrite another creator's capture id", async () => {
    state.docs.set("creatorCaptures/cap-owned", { id: "cap-owned", creator_id: "someone-else" });
    const { server, baseUrl } = await startCreatorServer();
    try {
      const response = await postJson(`${baseUrl}`, "/v1/creator/captures", { id: "cap-owned" });
      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toMatchObject({ code: "capture_id_conflict" });
      expect(state.docs.get("creatorCaptures/cap-owned")).toMatchObject({ creator_id: "someone-else" });
    } finally {
      await stopServer(server);
    }
  });
});

describe("creator capture preflight", () => {
  it("allows an up-to-date client and performs no mutation", async () => {
    const { server, baseUrl } = await startCreatorServer();
    try {
      const docCountBefore = state.docs.size;
      const response = await postJson(`${baseUrl}`, "/v1/creator/captures/preflight", {
        platform: "ios",
        app_version: "2.1.0",
        app_build: "210",
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        allowed: true,
        code: "allowed",
      });
      expect(state.docs.size).toBe(docCountBefore);
    } finally {
      await stopServer(server);
    }
  });

  it("denies with the kill switch before any upload work", async () => {
    state.docs.set("appConfig/clientRuntime", { killSwitch: true, message: "Paused for maintenance." });
    const { server, baseUrl } = await startCreatorServer();
    try {
      const response = await postJson(`${baseUrl}`, "/v1/creator/captures/preflight", {
        platform: "ios",
        app_version: "2.1.0",
      });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        allowed: false,
        code: "capture_client_kill_switch_active",
      });
    } finally {
      await stopServer(server);
    }
  });

  it("requires an update when the client is below the minimum version", async () => {
    state.docs.set("appConfig/clientRuntime", { minSupportedVersion: "3.0.0" });
    const { server, baseUrl } = await startCreatorServer();
    try {
      const stale = await postJson(`${baseUrl}`, "/v1/creator/captures/preflight", {
        platform: "android",
        app_version: "2.9.9",
      });
      expect(stale.status).toBe(426);
      await expect(stale.json()).resolves.toMatchObject({ code: "client_update_required" });

      const current = await postJson(`${baseUrl}`, "/v1/creator/captures/preflight", {
        platform: "android",
        app_version: "3.0.1",
      });
      expect(current.status).toBe(200);
    } finally {
      await stopServer(server);
    }
  });

  it("fails closed when beta capacity limits are not configured", async () => {
    const { server, baseUrl } = await startCreatorServer();
    delete process.env.BLUEPRINT_BETA_INVITE_CAP;
    delete process.env.BLUEPRINT_BETA_COHORT_DAILY_LIMIT;
    try {
      const response = await postJson(`${baseUrl}`, "/v1/creator/captures/preflight", {
        platform: "ios",
        app_version: "2.1.0",
      });
      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ code: "beta_limits_not_configured" });
    } finally {
      await stopServer(server);
    }
  });
});

describe("creator client telemetry hardening", () => {
  it("namespaces telemetry ids by creator and acknowledges replays without rewriting", async () => {
    const { server, baseUrl } = await startCreatorServer();
    try {
      const first = await postJson(`${baseUrl}`, "/v1/creator/client-telemetry", {
        event_id: "evt-1",
        event_type: "upload_failed",
        operation: "raw_upload",
        status: "failed",
      });
      expect(first.status).toBe(202);
      expect(state.docs.has("creatorClientTelemetry/creator-auth-123__evt-1")).toBe(true);
      expect(state.docs.has("creatorClientTelemetry/evt-1")).toBe(false);

      const stored = state.docs.get("creatorClientTelemetry/creator-auth-123__evt-1")!;
      const replay = await postJson(`${baseUrl}`, "/v1/creator/client-telemetry", {
        event_id: "evt-1",
        event_type: "upload_failed",
        operation: "mutated-on-replay",
        status: "failed",
      });
      expect(replay.status).toBe(202);
      await expect(replay.json()).resolves.toMatchObject({ accepted: true, duplicate: true });
      expect(state.docs.get("creatorClientTelemetry/creator-auth-123__evt-1")).toEqual(stored);
    } finally {
      await stopServer(server);
    }
  });

  it("redacts secrets, contact data, coordinates, and paths from telemetry", async () => {
    const { server, baseUrl } = await startCreatorServer();
    try {
      const response = await postJson(`${baseUrl}`, "/v1/creator/client-telemetry", {
        event_id: "evt-redact",
        event_type: "upload_failed",
        operation: "raw_upload",
        status: "failed",
        metadata: {
          note: "user jane.doe@example.com called +1 (919) 555-0100",
          auth: "Authorization: Bearer abc123SECRETtoken",
          location: "35.994034,-78.898621",
          file: "/Users/jane/Library/capture/raw.usdz",
        },
      });
      expect(response.status).toBe(202);
      const stored = JSON.stringify(state.docs.get("creatorClientTelemetry/creator-auth-123__evt-redact"));
      expect(stored).not.toContain("jane.doe@example.com");
      expect(stored).not.toContain("555-0100");
      expect(stored).not.toContain("abc123SECRETtoken");
      expect(stored).not.toContain("35.994034");
      expect(stored).not.toContain("/Users/jane");
      expect(stored).toContain("[redacted-email]");
    } finally {
      await stopServer(server);
    }
  });
});
