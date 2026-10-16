import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, documentId, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let environment: RulesTestEnvironment;
beforeAll(async () => {
  environment = await initializeTestEnvironment({ projectId: "blueprint-rules-test",
    firestore: { rules: readFileSync(resolve("firestore.rules"), "utf8") } });
});
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [id, uid] of [["assigned", "capturer"], ["other", "another-capturer"]]) {
      await setDoc(doc(db, "capture_jobs", id), {
        address: "Private address", lat: 37.123456, lng: -122.123456, active: true,
        field_ops: { capturer_assignment: { creator_id: uid } },
      });
      await setDoc(doc(db, "target_state", id), { lat: 37.123456, lng: -122.123456 });
    }
    await setDoc(doc(db, "capture_jobs", "unassigned"), { address: "Private address", active: true });
    await setDoc(doc(db, "target_state", "legacy"), { lat: 37.123456, lng: -122.123456, reservedBy: "legacy-owner" });
  });
});
afterAll(async () => environment.cleanup());

describe("precise capture locations require a server-owned assignment", () => {
  it("denies anonymous, unrelated accounts, unassigned jobs and broad listing", async () => {
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), "capture_jobs", "assigned")));
    const db = environment.authenticatedContext("unrelated").firestore();
    await assertFails(getDoc(doc(db, "capture_jobs", "assigned")));
    await assertFails(getDoc(doc(db, "capture_jobs", "unassigned")));
    await assertFails(getDocs(query(collection(db, "capture_jobs"), where("active", "==", true))));
  });

  it("preserves the assigned capturer's direct read and constrained mobile query", async () => {
    const db = environment.authenticatedContext("capturer").firestore();
    await assertSucceeds(getDoc(doc(db, "capture_jobs", "assigned")));
    await assertFails(getDoc(doc(db, "capture_jobs", "other")));
    await assertSucceeds(getDocs(query(collection(db, "capture_jobs"),
      where("field_ops.capturer_assignment.creator_id", "==", "capturer"))));
  });

  it("does not turn a self-authored reservation or profile role into location access", async () => {
    const db = environment.authenticatedContext("unrelated").firestore();
    await assertSucceeds(setDoc(doc(db, "reservations", "assigned"), { userId: "unrelated" }));
    await assertSucceeds(setDoc(doc(db, "users", "unrelated"), { role: "capturer" }));
    await assertFails(getDoc(doc(db, "capture_jobs", "assigned")));
    await assertFails(setDoc(doc(db, "capture_jobs", "assigned"), {
      field_ops: { capturer_assignment: { creator_id: "unrelated" } },
    }, { merge: true }));
  });

  it.each([{ admin: true }, { ops: true }, { role: "ops" }, { roles: ["admin"] }])(
    "preserves operator access through trusted custom claims %j", async claims => {
      const db = environment.authenticatedContext("operator", claims).firestore();
      await assertSucceeds(getDoc(doc(db, "capture_jobs", "unassigned")));
      await assertSucceeds(getDocs(collection(db, "capture_jobs")));
      await assertSucceeds(getDocs(collection(db, "target_state")));
    });

  it("protects target-state coordinate mirrors while preserving assigned batch reads", async () => {
    const db = environment.authenticatedContext("capturer").firestore();
    await assertSucceeds(getDoc(doc(db, "target_state", "assigned")));
    await assertSucceeds(getDocs(query(collection(db, "target_state"), where(documentId(), "in", ["assigned"]))));
    await assertFails(getDoc(doc(db, "target_state", "other")));
    await assertFails(getDocs(collection(db, "target_state")));
    await assertSucceeds(setDoc(doc(db, "reservations", "other"), { userId: "capturer" }));
    await assertFails(getDoc(doc(db, "target_state", "other")));
  });

  it("preserves server-recorded legacy owner state without releasing it to strangers", async () => {
    await assertSucceeds(getDoc(doc(environment.authenticatedContext("legacy-owner").firestore(), "target_state", "legacy")));
    await assertFails(getDoc(doc(environment.authenticatedContext("stranger").firestore(), "target_state", "legacy")));
    await assertFails(getDoc(doc(environment.unauthenticatedContext().firestore(), "target_state", "legacy")));
  });
});
