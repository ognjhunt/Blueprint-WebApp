// Firestore security-rules behavior tests for the shared capture_submissions
// contract. These run against the real Firestore emulator (via
// `npm run test:rules`), so they prove the deployed-rule semantics — not a
// string grep of the rules file.
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "blueprint-rules-test";
const CREATOR = "creator-uid-1";
const OTHER = "creator-uid-2";

let testEnv: RulesTestEnvironment;

function validIosCreate(overrides: Record<string, unknown> = {}) {
  return {
    capture_id: "cap-ios-1",
    scene_id: "scene-1",
    creator_id: CREATOR,
    capture_source: "blueprint_capture_ios",
    status: "submitted",
    requested_outputs: ["usdz"],
    has_site_identity: true,
    has_capture_topology: true,
    created_at: new Date(),
    submitted_at: new Date(),
    estimated_payout_cents: 4500,
    rights_profile: "standard_commercial",
    target_address: "12 Factory Way",
    raw_prefix: "scenes/scene-1/captures/cap-ios-1/raw",
    operational_state: {
      assignment_state: "unassigned_or_open_capture",
      upload_state: "uploading",
      qa_state: "queued",
      qa_outcome: null,
    },
    lifecycle: {
      capture_started_at: new Date(),
      upload_started_at: new Date(),
    },
    ...overrides,
  };
}

function validAndroidCreate(overrides: Record<string, unknown> = {}) {
  return {
    capture_id: "cap-android-1",
    creator_id: CREATOR,
    capture_source: "blueprint_capture_android",
    status: "submitted",
    created_at: new Date(),
    submitted_at: new Date(),
    operational_state: {
      upload_state: "uploading",
      qa_state: "not_started",
    },
    ...overrides,
  };
}

// ctx.firestore() initializes settings on every call, and Firestore forbids
// re-initialization on the same context — cache one instance per context.
const firestoreCache = new WeakMap<object, ReturnType<RulesTestEnvironment["authenticatedContext"]>["firestore"] extends (...args: never[]) => infer R ? R : never>();
function dbFor(ctx: ReturnType<RulesTestEnvironment["authenticatedContext"]>) {
  let db = firestoreCache.get(ctx as object);
  if (!db) {
    db = ctx.firestore();
    firestoreCache.set(ctx as object, db);
  }
  return db;
}

function captureDocRef(ctx: ReturnType<RulesTestEnvironment["authenticatedContext"]>, id: string) {
  return doc(dbFor(ctx), `capture_submissions/${id}`);
}

async function seedCapture(id: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `capture_submissions/${id}`), data);
  });
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

describe("capture_submissions create", () => {
  it("denies unauthenticated create", async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(setDoc(captureDocRef(anon, "cap-anon"), validIosCreate()));
  });

  it("denies create claiming another creator's identity", async () => {
    const mallory = testEnv.authenticatedContext(OTHER);
    await assertFails(
      setDoc(captureDocRef(mallory, "cap-spoof"), validIosCreate({ creator_id: CREATOR })),
    );
  });

  it("allows a valid iOS-shaped create for the owner", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertSucceeds(setDoc(captureDocRef(creator, "cap-ios-1"), validIosCreate()));
  });

  it("allows a valid Android-shaped create for the owner", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertSucceeds(setDoc(captureDocRef(creator, "cap-android-1"), validAndroidCreate()));
  });

  it("denies create with arbitrary extra fields", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertFails(
      setDoc(
        captureDocRef(creator, "cap-extra"),
        validIosCreate({ approved_by: "myself" }),
      ),
    );
  });

  it("denies create with a privileged status (self-approval)", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    for (const status of ["approved", "paid", "rejected", "under_review"]) {
      await assertFails(
        setDoc(captureDocRef(creator, `cap-status-${status}`), validIosCreate({ status })),
      );
    }
  });

  it("denies create with a client-authored qa_outcome", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertFails(
      setDoc(
        captureDocRef(creator, "cap-qa"),
        validIosCreate({
          operational_state: {
            upload_state: "uploading",
            qa_state: "queued",
            qa_outcome: "passed",
          },
        }),
      ),
    );
  });
});

describe("capture_submissions update", () => {
  it("allows the legal upload-progress transition (uploading -> uploaded)", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await seedCapture("cap-up", validIosCreate({ capture_id: "cap-up" }));
    await assertSucceeds(
      updateDoc(captureDocRef(creator, "cap-up"), {
        status: "submitted",
        submitted_at: new Date(),
        operational_state: {
          assignment_state: "unassigned_or_open_capture",
          upload_state: "uploaded",
          qa_state: "queued",
          qa_outcome: null,
        },
      }),
    );
  });

  it("allows the documented client failure transition", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await seedCapture("cap-fail", validIosCreate({ capture_id: "cap-fail" }));
    await assertSucceeds(
      updateDoc(captureDocRef(creator, "cap-fail"), {
        status: "upload_failed",
        operational_state: {
          upload_state: "failed",
          qa_state: "blocked_raw_validation",
        },
        upload_error: {
          code: "network_lost",
          message: "connection dropped",
          recorded_at: new Date(),
        },
      }),
    );
  });

  it("denies client escalation to approved/paid via update", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await seedCapture("cap-esc", validIosCreate({ capture_id: "cap-esc" }));
    for (const status of ["approved", "paid"]) {
      await assertFails(updateDoc(captureDocRef(creator, "cap-esc"), { status }));
    }
  });

  it("denies client payout mutation via update", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await seedCapture("cap-payout", validIosCreate({ capture_id: "cap-payout" }));
    await assertFails(
      updateDoc(captureDocRef(creator, "cap-payout"), { estimated_payout_cents: 999999 }),
    );
  });

  it("denies client rights-profile mutation via update", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await seedCapture("cap-rights", validIosCreate({ capture_id: "cap-rights" }));
    await assertFails(
      updateDoc(captureDocRef(creator, "cap-rights"), { rights_profile: "unrestricted_full" }),
    );
  });

  it("denies creator_id reassignment via update", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await seedCapture("cap-owner", validIosCreate({ capture_id: "cap-owner" }));
    await assertFails(updateDoc(captureDocRef(creator, "cap-owner"), { creator_id: OTHER }));
  });

  it("denies raw_prefix mutation via update", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await seedCapture("cap-raw", validIosCreate({ capture_id: "cap-raw" }));
    await assertFails(
      updateDoc(captureDocRef(creator, "cap-raw"), { raw_prefix: "scenes/other/captures/x/raw" }),
    );
  });

  it("denies wrong-owner update entirely", async () => {
    const mallory = testEnv.authenticatedContext(OTHER);
    await seedCapture("cap-victim", validIosCreate({ capture_id: "cap-victim" }));
    await assertFails(
      updateDoc(captureDocRef(mallory, "cap-victim"), { status: "upload_failed" }),
    );
  });

  it("denies regression after the client reported uploaded (monotonic handoff)", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await seedCapture(
      "cap-done",
      validIosCreate({
        capture_id: "cap-done",
        operational_state: {
          assignment_state: "unassigned_or_open_capture",
          upload_state: "uploaded",
          qa_state: "queued",
          qa_outcome: null,
        },
      }),
    );
    await assertFails(
      updateDoc(captureDocRef(creator, "cap-done"), {
        operational_state: { upload_state: "uploading", qa_state: "queued" },
      }),
    );
    await assertFails(
      updateDoc(captureDocRef(creator, "cap-done"), { status: "upload_failed" }),
    );
  });

  it("allows an idempotent replay of the terminal completion write", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await seedCapture(
      "cap-replay",
      validIosCreate({
        capture_id: "cap-replay",
        operational_state: {
          assignment_state: "unassigned_or_open_capture",
          upload_state: "uploaded",
          qa_state: "queued",
          qa_outcome: null,
        },
      }),
    );
    // The client never saw the ack and re-sends the same terminal payload with
    // refreshed registration timestamps — allowed, but only for those keys.
    await assertSucceeds(
      updateDoc(captureDocRef(creator, "cap-replay"), {
        created_at: new Date(),
        submitted_at: new Date(),
        lifecycle: { capture_uploaded_at: new Date() },
      }),
    );
  });

  it("denies updates once the backend moved the doc to a privileged status", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await seedCapture(
      "cap-approved",
      validIosCreate({ capture_id: "cap-approved", status: "approved" }),
    );
    await assertFails(
      updateDoc(captureDocRef(creator, "cap-approved"), { status: "submitted" }),
    );
  });
});

describe("capture_submissions read/delete", () => {
  it("owner reads own submission; others and anon are denied", async () => {
    await seedCapture("cap-read", validIosCreate({ capture_id: "cap-read" }));
    const creator = testEnv.authenticatedContext(CREATOR);
    const mallory = testEnv.authenticatedContext(OTHER);
    const anon = testEnv.unauthenticatedContext();
    await assertSucceeds(getDoc(captureDocRef(creator, "cap-read")));
    await assertFails(getDoc(captureDocRef(mallory, "cap-read")));
    await assertFails(getDoc(captureDocRef(anon, "cap-read")));
  });

  it("client delete is always denied", async () => {
    await seedCapture("cap-del", validIosCreate({ capture_id: "cap-del" }));
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertFails(deleteDoc(captureDocRef(creator, "cap-del")));
  });
});
