// Firestore security-rules behavior tests for the Android capture telemetry
// collections. The valid payload mirrors CaptureClientTelemetryService
// .firestorePayload in BlueprintCapture/android, the only client writer.
// Runs against the real Firestore emulator via `npm run test:rules`.
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "blueprint-rules-test";
const CREATOR = "creator-uid-1";
const OTHER = "creator-uid-2";
const EVENT_ID = "0b6f3c1e-8a5d-4c1f-9a3e-2d7c5b4a1f00";

let testEnv: RulesTestEnvironment;

function androidEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_id: EVENT_ID,
    event_type: "nonfatal_error",
    severity: "warning",
    operation: "upload_storage_failed",
    status: "failure",
    occurred_at: "2026-10-14T18:00:00.000Z",
    app_version: "1.4.0",
    app_build: "140",
    os_version: "Android 15",
    device_model: "Google Pixel 9 Pro",
    metadata: { capture_id: "cap-1", session_id: "sess-1", reason: "x".repeat(240) },
    breadcrumbs: [
      { name: "upload_started", status: "ok", occurred_at: "2026-10-14T17:59:00.000Z", metadata: {} },
    ],
    source: "blueprint_capture_android_client",
    beta_alert_candidate: true,
    platform: "android",
    creator_id: CREATOR,
    session_id: "sess-1",
    capture_id: "cap-1",
    created_at: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe.each(["captureClientTelemetry", "clientCrashReports", "clientErrorTelemetry"])("%s", (collection) => {
  const target = (db: any) => doc(db, `${collection}/${EVENT_ID}`);

  it("accepts the Android client's event and its own set(merge) retry", async () => {
    const db = testEnv.authenticatedContext(CREATOR).firestore();
    await assertSucceeds(setDoc(target(db), androidEvent(), { merge: true }));
    await assertSucceeds(setDoc(target(db), androidEvent(), { merge: true }));
  });

  it("accepts the event without its optional fields", async () => {
    const db = testEnv.authenticatedContext(CREATOR).firestore();
    const { session_id: _s, capture_id: _c, ...rest } = androidEvent();
    await assertSucceeds(setDoc(target(db), rest));
  });

  it.each([
    ["an unknown field", { blob: "x" }],
    ["another user's creator_id", { creator_id: OTHER }],
    ["an over-long event_type", { event_type: "e".repeat(121) }],
    ["an over-long operation", { operation: "o".repeat(121) }],
    ["an over-long occurred_at", { occurred_at: "t".repeat(65) }],
    ["an over-long device_model", { device_model: "d".repeat(201) }],
    ["an over-long session_id", { session_id: "s".repeat(257) }],
    ["a non-string app_version", { app_version: 14 }],
    ["a non-bool beta_alert_candidate", { beta_alert_candidate: "yes" }],
    ["21 metadata pairs", { metadata: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, "v"])) }],
    ["metadata that is not a map", { metadata: "k=v" }],
    ["25 breadcrumbs", { breadcrumbs: Array.from({ length: 25 }, () => ({ name: "n", status: "s" })) }],
    ["a client-chosen created_at", { created_at: new Date("2020-01-01") }],
  ])("refuses an event with %s", async (_label, overrides) => {
    const db = testEnv.authenticatedContext(CREATOR).firestore();
    await assertFails(setDoc(target(db), androidEvent(overrides)));
  });

  it("refuses an event missing a required identifier", async () => {
    const db = testEnv.authenticatedContext(CREATOR).firestore();
    const { event_type: _e, ...rest } = androidEvent();
    await assertFails(setDoc(target(db), rest));
  });

  it("refuses unauthenticated writes, other users' updates, reads and deletes", async () => {
    await assertFails(setDoc(target(testEnv.unauthenticatedContext().firestore()), androidEvent()));
    const db = testEnv.authenticatedContext(CREATOR).firestore();
    await assertSucceeds(setDoc(target(db), androidEvent()));
    const mallory = testEnv.authenticatedContext(OTHER).firestore();
    await assertFails(setDoc(target(mallory), androidEvent({ creator_id: OTHER }), { merge: true }));
  });

  it("lets a merge leave created_at as it was, but refuses one that grows the event past its bounds", async () => {
    const db = testEnv.authenticatedContext(CREATOR).firestore();
    await assertSucceeds(setDoc(target(db), androidEvent()));
    await assertSucceeds(setDoc(target(db), { status: "flushed_after_launch" }, { merge: true }));
    await assertFails(setDoc(target(db), { status: "s".repeat(121), created_at: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(target(db), { extra: "x", created_at: serverTimestamp() }, { merge: true }));
    await assertFails(setDoc(target(db), { created_at: new Date("2020-01-01") }, { merge: true }));
  });
});
