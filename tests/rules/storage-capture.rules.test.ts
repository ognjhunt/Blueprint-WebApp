// Storage security-rules behavior tests for the shared raw-capture upload path
// and buyer marketplace-artifact entitlement gating. Runs against the real
// Storage + Firestore emulators via `npm run test:rules`.
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "blueprint-rules-test";
const CREATOR = "creator-uid-1";
const OTHER = "creator-uid-2";
const SHA256 = "a".repeat(64);
const RAW_PATH = "scenes/scene-1/captures/cap-1/raw/room.usdz";

let testEnv: RulesTestEnvironment;

function rawMetadata(overrides: Record<string, string> = {}) {
  return {
    customMetadata: {
      creatorId: CREATOR,
      sceneId: "scene-1",
      captureId: "cap-1",
      sha256: SHA256,
      ...overrides,
    },
  };
}

const payload = new Uint8Array([1, 2, 3, 4]);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
    },
    storage: {
      rules: readFileSync(path.resolve(__dirname, "../../storage.rules"), "utf8"),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearStorage();
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("raw capture uploads (scenes/{sceneId}/captures/{captureId}/raw/**)", () => {
  it("allows the owner to upload with complete, matching metadata", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertSucceeds(
      uploadBytes(ref(creator.storage(), RAW_PATH), payload, rawMetadata()),
    );
  });

  it("denies unauthenticated upload", async () => {
    const anon = testEnv.unauthenticatedContext();
    await assertFails(uploadBytes(ref(anon.storage(), RAW_PATH), payload, rawMetadata()));
  });

  it("denies upload whose creatorId metadata is another user", async () => {
    const mallory = testEnv.authenticatedContext(OTHER);
    await assertFails(
      uploadBytes(ref(mallory.storage(), RAW_PATH), payload, rawMetadata()),
    );
  });

  it("denies upload with missing or mismatched path metadata", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertFails(
      uploadBytes(ref(creator.storage(), RAW_PATH), payload, {
        customMetadata: { creatorId: CREATOR, sceneId: "scene-1" },
      }),
    );
    await assertFails(
      uploadBytes(
        ref(creator.storage(), RAW_PATH),
        payload,
        rawMetadata({ sceneId: "some-other-scene" }),
      ),
    );
    await assertFails(
      uploadBytes(
        ref(creator.storage(), RAW_PATH),
        payload,
        rawMetadata({ captureId: "some-other-capture" }),
      ),
    );
  });

  it("denies upload with a malformed sha256", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertFails(
      uploadBytes(ref(creator.storage(), RAW_PATH), payload, rawMetadata({ sha256: "nope" })),
    );
    await assertFails(
      uploadBytes(
        ref(creator.storage(), RAW_PATH),
        payload,
        rawMetadata({ sha256: "Z".repeat(64) }),
      ),
    );
  });

  it("raw objects are immutable: owner delete is denied", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertSucceeds(
      uploadBytes(ref(creator.storage(), RAW_PATH), payload, rawMetadata()),
    );
    // GCS overwrites create a new object generation, which Storage rules
    // evaluate as `create` (still bound by owner+sha metadata); the
    // update/delete=false clause is proven via the delete denial.
    await assertFails(deleteObject(ref(creator.storage(), RAW_PATH)));
  });

  it("only the owner can read a raw object", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertSucceeds(
      uploadBytes(ref(creator.storage(), RAW_PATH), payload, rawMetadata()),
    );
    await assertSucceeds(getBytes(ref(creator.storage(), RAW_PATH)));
    const mallory = testEnv.authenticatedContext(OTHER);
    await assertFails(getBytes(ref(mallory.storage(), RAW_PATH)));
  });
});

describe("marketplace delivery artifacts (marketplace-artifacts/{entitlementId}/**)", () => {
  const ARTIFACT_PATH = "marketplace-artifacts/ent-1/package/dataset.zip";

  async function seedArtifact(entitlement: Record<string, unknown>) {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "marketplaceEntitlements/ent-1"), entitlement);
      await uploadBytes(ref(ctx.storage(), ARTIFACT_PATH), payload);
    });
  }

  it("allows the entitled buyer to read while the entitlement is provisioned", async () => {
    await seedArtifact({ buyer_user_id: CREATOR, access_state: "provisioned" });
    const buyer = testEnv.authenticatedContext(CREATOR);
    await assertSucceeds(getBytes(ref(buyer.storage(), ARTIFACT_PATH)));
  });

  it("denies a different signed-in user even when an entitlement exists", async () => {
    await seedArtifact({ buyer_user_id: CREATOR, access_state: "provisioned" });
    const mallory = testEnv.authenticatedContext(OTHER);
    await assertFails(getBytes(ref(mallory.storage(), ARTIFACT_PATH)));
  });

  it("denies the buyer once the entitlement is revoked or expired", async () => {
    await seedArtifact({ buyer_user_id: CREATOR, access_state: "revoked" });
    const buyer = testEnv.authenticatedContext(CREATOR);
    await assertFails(getBytes(ref(buyer.storage(), ARTIFACT_PATH)));
  });

  it("denies buyer writes to delivery artifacts", async () => {
    await seedArtifact({ buyer_user_id: CREATOR, access_state: "provisioned" });
    const buyer = testEnv.authenticatedContext(CREATOR);
    await assertFails(uploadBytes(ref(buyer.storage(), ARTIFACT_PATH), payload));
  });
});

describe("default deny", () => {
  it("denies reads and writes outside modeled prefixes", async () => {
    const creator = testEnv.authenticatedContext(CREATOR);
    await assertFails(uploadBytes(ref(creator.storage(), "random/other.bin"), payload));
    await assertFails(getBytes(ref(creator.storage(), "random/other.bin")));
  });
});
