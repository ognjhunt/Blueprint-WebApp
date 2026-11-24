/**
 * What a signed-in, approved deployment company's client SDK can read or write directly in Firestore (stress test round 2,
 * 2026-11-24). Every collection here is written by the server (Admin SDK); none may be read by a company, and a Terms
 * acceptance is recorded only by the server.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, collectionGroup, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { beforeAll, afterAll, beforeEach, describe, it } from "vitest";

let environment: RulesTestEnvironment;
const JOB = "job-r2";
beforeAll(async () => {
  environment = await initializeTestEnvironment({ projectId: "blueprint-rules-test",
    firestore: { rules: readFileSync(resolve("firestore.rules"), "utf8") } });
});
beforeEach(async () => {
  await environment.clearFirestore();
  await environment.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, `inboundRequests/${JOB}`), { contact: { email: "enc:site@example.invalid" }, request: { buyerType: "site_operator" } });
    await setDoc(doc(db, `inboundRequests/${JOB}/robotTeamInterest/other-co`), { state: "interested", inputs: "Other company's words" });
    await setDoc(doc(db, `inboundRequests/${JOB}/robotTeamInterest/co-a`), { state: "interested", inputs: "Own words" });
    await setDoc(doc(db, `inboundRequests/${JOB}/freeTextScreenings/abc`), { status: "done", text: "screened site words" });
    await setDoc(doc(db, `inboundRequests/${JOB}/introductions/other-co`), { siteShared: { email: "enc:x" } });
    await setDoc(doc(db, `inboundRequests/${JOB}/companySends/other-co`), { sentBy: "system" });
    await setDoc(doc(db, `inboundRequests/${JOB}/companyViews/other-co`), { views: 3 });
    await setDoc(doc(db, `inboundRequests/${JOB}/notes/n1`), { text: "staff note" });
    await setDoc(doc(db, "billableEvents/e1"), { requestId: JOB, companyId: "other-co" });
    await setDoc(doc(db, "robotTeamAccess/other-co"), { email: "other@co.example", status: "approved" });
    await setDoc(doc(db, "captureOutbox/o1"), { to: "site@example.invalid", body: "words" });
    await setDoc(doc(db, "siteTaskBriefs/" + JOB), { summary: "site sentence" });
    await setDoc(doc(db, "users/site-owner"), { email: "site@example.invalid" });
    await setDoc(doc(db, "taskThumbnails/" + JOB), { pngBase64: "" });
  });
});
afterAll(async () => { await environment.cleanup(); });

const company = () => environment.authenticatedContext("co-a-uid", { email: "a@co-a.example", email_verified: true }).firestore();

describe("a signed-in deployment company reads nothing the server owns", () => {
  for (const path of [`inboundRequests/${JOB}`, `inboundRequests/${JOB}/robotTeamInterest/other-co`,
    `inboundRequests/${JOB}/robotTeamInterest/co-a`, `inboundRequests/${JOB}/freeTextScreenings/abc`,
    `inboundRequests/${JOB}/introductions/other-co`, `inboundRequests/${JOB}/companySends/other-co`,
    `inboundRequests/${JOB}/companyViews/other-co`, `inboundRequests/${JOB}/notes/n1`, "billableEvents/e1",
    "robotTeamAccess/other-co", "captureOutbox/o1", `siteTaskBriefs/${JOB}`, "users/site-owner", `taskThumbnails/${JOB}`])
    it(`get ${path}`, async () => { await assertFails(getDoc(doc(company(), path))); });
  for (const group of ["robotTeamInterest", "introductions", "freeTextScreenings", "companySends"])
    it(`collection group ${group}`, async () => { await assertFails(getDocs(collectionGroup(company(), group))); });
  it("query billableEvents for its own company id", async () => {
    await assertFails(getDocs(query(collection(company(), "billableEvents"), where("companyId", "==", "co-a"))));
  });
});

describe("a company cannot write what the server decides", () => {
  it("cannot write its own answer or an introduction", async () => {
    await assertFails(setDoc(doc(company(), `inboundRequests/${JOB}/robotTeamInterest/co-a`), { state: "interested" }));
    await assertFails(setDoc(doc(company(), `inboundRequests/${JOB}/introductions/co-a`), { madeAtIso: "2026-11-24T00:00:00Z" }));
    await assertFails(setDoc(doc(company(), "robotTeamAccess/co-a"), { status: "approved" }));
  });
  it("cannot write admin or ops on its own profile", async () => {
    await assertSucceeds(setDoc(doc(company(), "users/co-a-uid"), { name: "A" }));
    await assertFails(updateDoc(doc(company(), "users/co-a-uid"), { admin: true }));
    await assertFails(updateDoc(doc(company(), "users/co-a-uid"), { roles: ["admin"] }));
  });
});

describe("a Terms acceptance is recorded only by the server", () => {
  const ACCEPTANCE_FIELDS: Record<string, unknown> = {
    termsAcceptance: { accepted_terms: true, terms_version: "x", privacy_version: "y", accepted_at: "2019-01-01T00:00:00.000Z" },
    termsAcceptanceSource: { kind: "deployment_company", companyId: "co-a" },
    termsAcceptanceByServer: { terms_version: "x", privacy_version: "y", kind: "deployment_company" },
    acceptedTerms: true, termsVersion: "x", privacyVersion: "y",
  };
  for (const [field, value] of Object.entries(ACCEPTANCE_FIELDS)) {
    it(`a client cannot create its profile with ${field}`, async () => {
      await assertFails(setDoc(doc(company(), "users/co-a-uid"), { name: "A", [field]: value }));
    });
    it(`a client cannot add or change ${field} on its profile`, async () => {
      await assertSucceeds(setDoc(doc(company(), "users/co-a-uid"), { name: "A" }));
      await assertFails(updateDoc(doc(company(), "users/co-a-uid"), { [field]: value }));
    });
  }
  it("a profile whose acceptance the server wrote stays editable in its other fields, and its acceptance cannot be changed", async () => {
    await environment.withSecurityRulesDisabled(async context => {
      await setDoc(doc(context.firestore(), "users/co-a-uid"), { name: "A", ...ACCEPTANCE_FIELDS });
    });
    await assertSucceeds(updateDoc(doc(company(), "users/co-a-uid"), { name: "A changed" }));
    await assertFails(updateDoc(doc(company(), "users/co-a-uid"), { "termsAcceptance.accepted_at": "2018-01-01T00:00:00.000Z" }));
    await assertFails(updateDoc(doc(company(), "users/co-a-uid"), { acceptedTerms: false }));
  });
});
