// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  fileContents: new Map<string, string>(),
  apps: [] as Array<Record<string, unknown>>,
  certCalls: [] as Array<Record<string, unknown>>,
  applicationDefaultCalls: 0,
}));

vi.mock("node:fs", () => ({
  default: {
    readFileSync: (filePath: string) => {
      const value = state.fileContents.get(filePath);
      if (value == null) {
        throw new Error(`ENOENT: ${filePath}`);
      }
      return value;
    },
  },
}));

vi.mock("firebase-admin", () => {
  const admin = {
    apps: state.apps,
    credential: {
      cert: (serviceAccount: Record<string, unknown>) => {
        state.certCalls.push(serviceAccount);
        return { kind: "cert", serviceAccount };
      },
      applicationDefault: () => {
        state.applicationDefaultCalls += 1;
        return { kind: "applicationDefault" };
      },
    },
    initializeApp: (config: Record<string, unknown>) => {
      const app = { config };
      state.apps.push(app);
      return app;
    },
    firestore: (app: Record<string, unknown>) => ({ app, type: "firestore" }),
    storage: (app: Record<string, unknown>) => ({ app, type: "storage" }),
    auth: (app: Record<string, unknown>) => ({ app, type: "auth" }),
  };

  return {
    default: admin,
    credential: admin.credential,
    initializeApp: admin.initializeApp,
    firestore: admin.firestore,
    storage: admin.storage,
    auth: admin.auth,
  };
});

beforeEach(() => {
  vi.resetModules();
  state.fileContents.clear();
  state.apps.length = 0;
  state.certCalls.length = 0;
  state.applicationDefaultCalls = 0;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.K_SERVICE;
});

afterEach(() => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.K_SERVICE;
});

describe("firebaseAdmin config", () => {
  it("loads credentials from GOOGLE_APPLICATION_CREDENTIALS when a key file path is provided", async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/firebase-admin.json";
    state.fileContents.set(
      "/tmp/firebase-admin.json",
      JSON.stringify({
        project_id: "blueprint-test",
        client_email: "svc@example.com",
        private_key: "private-key",
      }),
    );

    const module = await import("../../client/src/lib/firebaseAdmin");

    expect(module.dbAdmin).toBeTruthy();
    expect(module.authAdmin).toBeTruthy();
    expect(state.certCalls).toHaveLength(1);
    expect(state.applicationDefaultCalls).toBe(0);
  });

  it("falls back to application default credentials on managed GCP runtimes", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "blueprint-prod";
    process.env.K_SERVICE = "blueprint-web";

    const module = await import("../../client/src/lib/firebaseAdmin");

    expect(module.dbAdmin).toBeTruthy();
    expect(module.authAdmin).toBeTruthy();
    expect(state.certCalls).toHaveLength(0);
    expect(state.applicationDefaultCalls).toBe(1);
  });
});
