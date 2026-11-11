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
  delete process.env.BLUEPRINT_E2E;
  delete process.env.BLUEPRINT_E2E_ALLOW_LIVE_FIREBASE;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
});

afterEach(() => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.K_SERVICE;
  delete process.env.BLUEPRINT_E2E;
  delete process.env.BLUEPRINT_E2E_ALLOW_LIVE_FIREBASE;
  delete process.env.FIRESTORE_EMULATOR_HOST;
  delete process.env.FIREBASE_STORAGE_EMULATOR_HOST;
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

const liveKey = JSON.stringify({ project_id: "blueprint-test", client_email: "svc@example.com", private_key: "private-key" });

describe("a browser-test server never uses a live credential", () => {
  it("does not initialise when BLUEPRINT_E2E=1 and a service account is in the environment", async () => {
    process.env.BLUEPRINT_E2E = "1";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = liveKey;

    const module = await import("../../client/src/lib/firebaseAdmin");

    expect(module.dbAdmin).toBeNull();
    expect(module.storageAdmin).toBeNull();
    expect(module.authAdmin).toBeNull();
    expect(state.apps).toHaveLength(0);
    expect(state.certCalls).toHaveLength(0);
  });

  it("does not initialise when BLUEPRINT_E2E=1 and a key file is named", async () => {
    process.env.BLUEPRINT_E2E = "1";
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/firebase-admin.json";
    state.fileContents.set("/tmp/firebase-admin.json", liveKey);

    const module = await import("../../client/src/lib/firebaseAdmin");

    expect(module.dbAdmin).toBeNull();
    expect(state.apps).toHaveLength(0);
  });

  it("does not initialise on application-default credentials alone", async () => {
    process.env.BLUEPRINT_E2E = "1";
    process.env.GOOGLE_CLOUD_PROJECT = "blueprint-prod";
    process.env.K_SERVICE = "blueprint-web";

    const module = await import("../../client/src/lib/firebaseAdmin");

    expect(module.dbAdmin).toBeNull();
    expect(state.apps).toHaveLength(0);
    expect(state.applicationDefaultCalls).toBe(0);
  });

  it("does not initialise when only one of the two emulators is set", async () => {
    process.env.BLUEPRINT_E2E = "1";
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = liveKey;

    let module = await import("../../client/src/lib/firebaseAdmin");
    expect(module.dbAdmin).toBeNull();

    vi.resetModules();
    delete process.env.FIRESTORE_EMULATOR_HOST;
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
    module = await import("../../client/src/lib/firebaseAdmin");
    expect(module.dbAdmin).toBeNull();
    expect(state.apps).toHaveLength(0);
  });

  it("still initialises against both local emulators", async () => {
    process.env.BLUEPRINT_E2E = "1";
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
    process.env.GOOGLE_CLOUD_PROJECT = "demo-blueprint-reliability";

    const module = await import("../../client/src/lib/firebaseAdmin");

    expect(module.dbAdmin).toBeTruthy();
    expect(module.browserTestServerMustNotUseLiveFirebase()).toBe(false);
  });

  it("leaves the emulator harnesses, which do not set BLUEPRINT_E2E, initialising as before", async () => {
    // The environment scripts/qa/reliability-local-app.mjs gives its server.
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
    process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
    process.env.GOOGLE_CLOUD_PROJECT = "demo-blueprint-reliability";

    const module = await import("../../client/src/lib/firebaseAdmin");

    expect(module.dbAdmin).toBeTruthy();
    expect(state.applicationDefaultCalls).toBe(1);
  });

  it("initialises when a live project is allowed on purpose", async () => {
    process.env.BLUEPRINT_E2E = "1";
    process.env.BLUEPRINT_E2E_ALLOW_LIVE_FIREBASE = "1";
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = liveKey;

    const module = await import("../../client/src/lib/firebaseAdmin");

    expect(module.dbAdmin).toBeTruthy();
    expect(state.certCalls).toHaveLength(1);
  });

  it("leaves an ordinary server untouched", async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON = liveKey;

    const module = await import("../../client/src/lib/firebaseAdmin");

    expect(module.dbAdmin).toBeTruthy();
    expect(module.browserTestServerMustNotUseLiveFirebase()).toBe(false);
  });
});
