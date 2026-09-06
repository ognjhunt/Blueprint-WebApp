import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, updateDoc, deleteField } from "firebase/firestore";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";

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
describe("owner profile writes cannot grant paid execution authority", () => {
  it("preserves capturer onboarding and ordinary profile edits", async () => {
    const ref = doc(
      environment.authenticatedContext("owner").firestore(),
      "users/owner",
    );
    await assertSucceeds(
      setDoc(ref, { role: "capturer", roles: ["capturer"], name: "Name" }),
    );
    await assertSucceeds(updateDoc(ref, { name: "Updated" }));
    await assertSucceeds(setDoc(ref, { role: "guest", roles: ["guest"] }));
  });
  it("denies privileged authority on create including normalization variants", async () => {
    const db = environment.authenticatedContext("owner").firestore();
    for (const value of [
      { admin: true },
      { ops: true },
      { accessRoles: ["admin"] },
      { role: "admin" },
      { role: " Ops " },
      { roles: ["capturer", "OPS"] },
    ])
      await assertFails(setDoc(doc(db, "users/owner"), value));
  });
  it("denies privileged authority updates and permits server-owned authority retention", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/owner"), {
        admin: true,
        role: "admin",
        name: "Name",
      });
    });
    const ref = doc(
      environment.authenticatedContext("owner").firestore(),
      "users/owner",
    );
    await assertSucceeds(updateDoc(ref, { name: "Updated" }));
    for (const value of [
      { admin: false },
      { ops: true },
      { accessRoles: ["ops"] },
      { role: "ops" },
      { roles: ["admin"] },
      { admin: deleteField() },
    ])
      await assertFails(updateDoc(ref, value));
  });
});
