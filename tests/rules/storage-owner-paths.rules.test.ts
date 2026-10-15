// Storage security-rules behavior tests for the owner-scoped users/{uid}/**
// and accounts/{uid}/** prefixes: owner-only, 20 MiB, images and PDFs only.
// Runs against the real Storage emulator via `npm run test:rules`.
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "blueprint-rules-test";
const OWNER = "owner-uid-1";
const OTHER = "owner-uid-2";
const MIB = 1024 * 1024;

let testEnv: RulesTestEnvironment;

const small = new Uint8Array([1, 2, 3, 4]);

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
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe.each(["users", "accounts"])("%s/{uid}/** owner files", (prefix) => {
  const own = (name: string) => `${prefix}/${OWNER}/${name}`;

  it.each([
    ["image/jpeg", "avatar.jpg"],
    ["image/png", "avatar.png"],
    ["image/webp", "avatar.webp"],
    ["image/heic", "photo.heic"],
    ["application/pdf", "agreement.pdf"],
  ])("lets the owner upload %s", async (contentType, name) => {
    const owner = testEnv.authenticatedContext(OWNER);
    await assertSucceeds(uploadBytes(ref(owner.storage(), own(name)), small, { contentType }));
  });

  it.each(["text/html", "image/svg+xml", "application/octet-stream", "application/javascript", "video/mp4"])(
    "refuses the owner's %s upload",
    async (contentType) => {
      const owner = testEnv.authenticatedContext(OWNER);
      await assertFails(uploadBytes(ref(owner.storage(), own("file")), small, { contentType }));
    },
  );

  it("refuses an upload over 20 MiB and accepts one at the bound", async () => {
    const owner = testEnv.authenticatedContext(OWNER);
    await assertSucceeds(
      uploadBytes(ref(owner.storage(), own("at-bound.pdf")), new Uint8Array(20 * MIB), { contentType: "application/pdf" }),
    );
    await assertFails(
      uploadBytes(ref(owner.storage(), own("over-bound.pdf")), new Uint8Array(20 * MIB + 1), { contentType: "application/pdf" }),
    );
  });

  it("refuses another signed-in user and anonymous callers", async () => {
    const mallory = testEnv.authenticatedContext(OTHER);
    await assertFails(uploadBytes(ref(mallory.storage(), own("avatar.png")), small, { contentType: "image/png" }));
    const anon = testEnv.unauthenticatedContext();
    await assertFails(uploadBytes(ref(anon.storage(), own("avatar.png")), small, { contentType: "image/png" }));
  });

  it("keeps owner read and delete, and denies them to others", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await uploadBytes(ref(ctx.storage(), own("avatar.png")), small, { contentType: "image/png" });
    });
    const mallory = testEnv.authenticatedContext(OTHER);
    await assertFails(getBytes(ref(mallory.storage(), own("avatar.png"))));
    await assertFails(deleteObject(ref(mallory.storage(), own("avatar.png"))));
    const owner = testEnv.authenticatedContext(OWNER);
    await assertSucceeds(getBytes(ref(owner.storage(), own("avatar.png"))));
    await assertSucceeds(deleteObject(ref(owner.storage(), own("avatar.png"))));
  });
});
