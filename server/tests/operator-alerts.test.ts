// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

// R037: shared Firestore/storage mock. Supports both the operator-alerts default
// transport (`collection().add()`) and the marketplace artifact-access route
// (`collection().doc().get()` + storageAdmin), driven by hoisted state.
const state = vi.hoisted(() => ({
  writes: [] as Array<{ collection: string; doc: Record<string, unknown> }>,
  dbFails: false,
  entitlements: new Map<string, Record<string, unknown>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: { serverTimestamp: () => "SERVER_TS" },
    },
  },
  dbAdmin: {
    collection: (name: string) => ({
      add: async (doc: Record<string, unknown>) => {
        if (state.dbFails) {
          throw new Error("firestore unavailable");
        }
        state.writes.push({ collection: name, doc });
        return { id: `op-${state.writes.length}` };
      },
      doc: (id: string) => ({
        get: async () => {
          const data =
            name === "marketplaceEntitlements" ? state.entitlements.get(id) : undefined;
          return { exists: Boolean(data), id, data: () => data };
        },
      }),
    }),
  },
  storageAdmin: {
    bucket: () => ({
      file: () => ({
        getSignedUrl: async () => ["https://signed.example.test/artifact?signed=1"],
      }),
    }),
  },
}));

import { logger } from "../logger";
import {
  emitOperatorAlert,
  setOperatorAlertTransport,
  type OperatorAlertClass,
  type OperatorAlertRecord,
} from "../utils/operator-alerts";

const ALL_CLASSES: OperatorAlertClass[] = [
  "upload_failed",
  "intake_failed",
  "provider_failed",
  "package_failed",
  "buyer_access_failed",
  "payout_failed",
  "spend_alert",
];

beforeEach(() => {
  state.writes = [];
  state.dbFails = false;
  state.entitlements = new Map();
  setOperatorAlertTransport(null); // default Firestore + Slack transport
  delete process.env.SLACK_WEBHOOK_URL;
  delete process.env.SLACK_OPS_ALERT_WEBHOOK_URL;
});

afterEach(() => {
  setOperatorAlertTransport(null);
  vi.restoreAllMocks();
});

describe("emitOperatorAlert", () => {
  it("persists and logs an alert for every failure class (default transport)", async () => {
    const errorSpy = vi.spyOn(logger, "error");

    for (const alertClass of ALL_CLASSES) {
      await emitOperatorAlert({
        class: alertClass,
        message: `failure for ${alertClass}`,
        context: { probe: alertClass },
      });
    }

    // Durable persistence: one operatorAlerts document per class.
    expect(state.writes).toHaveLength(ALL_CLASSES.length);
    for (const alertClass of ALL_CLASSES) {
      const write = state.writes.find(
        (entry) => entry.collection === "operatorAlerts" && entry.doc.class === alertClass,
      );
      expect(write, `expected an operatorAlerts write for ${alertClass}`).toBeTruthy();
      expect(write?.doc.message).toBe(`failure for ${alertClass}`);
      expect(write?.doc.acknowledged).toBe(false);
    }

    // Guaranteed sink: error-level log per class.
    for (const alertClass of ALL_CLASSES) {
      const logged = errorSpy.mock.calls.some(
        (call) => typeof call[1] === "string" && call[1].includes(`operator-alert:${alertClass}`),
      );
      expect(logged, `expected an error log for ${alertClass}`).toBe(true);
    }
  });

  it("never throws when the Firestore transport is unconfigured/unavailable", async () => {
    state.dbFails = true; // simulate an unconfigured/failing durable transport

    await expect(
      emitOperatorAlert({ class: "spend_alert", message: "no transport available" }),
    ).resolves.toBeUndefined();
  });

  it("never throws when a custom transport itself throws", async () => {
    setOperatorAlertTransport(() => {
      throw new Error("transport exploded");
    });

    await expect(
      emitOperatorAlert({ class: "upload_failed", message: "boom" }),
    ).resolves.toBeUndefined();
  });
});

describe("wired failure site: marketplace artifact-access", () => {
  let server: Server;
  let baseUrl = "";

  async function startServer() {
    const { default: router } = await import("../routes/marketplace-entitlements");
    const app = express();
    app.use((_req, res, next) => {
      res.locals.firebaseUser = { uid: "buyer-123" };
      next();
    });
    app.use("/api/marketplace/entitlements", router);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, () => resolve()));
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to bind test server");
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  }

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("emits a buyer_access_failed alert when an owned entitlement is not provisioned", async () => {
    const captured: OperatorAlertRecord[] = [];
    setOperatorAlertTransport((record) => {
      captured.push(record);
    });

    state.entitlements.set("ent-1", {
      id: "ent-1",
      buyer_user_id: "buyer-123",
      access_state: "pending",
      sku: "kitchen-scene",
    });

    await startServer();

    const response = await fetch(
      `${baseUrl}/api/marketplace/entitlements/ent-1/artifact-access`,
    );
    const body = (await response.json()) as Record<string, unknown>;

    // Request behavior is unchanged: still a 409 not-provisioned.
    expect(response.status).toBe(409);
    expect(body.code).toBe("entitlement_not_provisioned");

    // Let the fire-and-forget alert flush.
    await new Promise((resolve) => setTimeout(resolve, 25));

    const alert = captured.find((entry) => entry.class === "buyer_access_failed");
    expect(alert, "expected a buyer_access_failed alert").toBeTruthy();
    expect(alert?.context.entitlement_id).toBe("ent-1");
    expect(alert?.context.code).toBe("entitlement_not_provisioned");
  });
});
