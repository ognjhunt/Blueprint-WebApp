// The BlueprintCapture app is retired (owner, 2026-11-11). Its client-SDK
// collections fall to the default deny: a signed-in account can no longer read
// or write them, even for documents that name it. Stored documents stay, and
// the Admin SDK still reads them. Runs against the Firestore emulator via
// `npm run test:rules`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const UID = "old-capturer";
let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "blueprint-rules-test",
    firestore: { rules: readFileSync(resolve("firestore.rules"), "utf8") },
  });
});
beforeEach(async () => {
  await environment.clearFirestore();
});
afterAll(async () => {
  await environment.cleanup();
});

const STORED: Array<[string, Record<string, unknown>]> = [
  ["capture_jobs/job-1", { field_ops: { capturer_assignment: { creator_id: UID } } }],
  ["capture_submissions/cap-1", { creator_id: UID, status: "submitted" }],
  ["reservations/target-1", { userId: UID }],
  ["target_state/target-1", { reservedBy: UID }],
  ["sessions/session-1", { userId: UID }],
  ["sessionEvents/event-1", { userId: UID }],
  ["referralCodes/CODE1", { owner: UID }],
  ["users/old-capturer/referrals/friend-1", { referredUserId: "friend-1" }],
  ["captureClientTelemetry/event-1", { creator_id: UID }],
  ["clientCrashReports/event-1", { creator_id: UID }],
  ["clientErrorTelemetry/event-1", { creator_id: UID }],
];

describe("retired capture-app collections", () => {
  it.each(STORED)("denies the client SDK on %s, even for a document naming the account", async (path, data) => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), path), data);
    });
    const db = environment.authenticatedContext(UID).firestore();
    await assertFails(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), data));
  });
});
