// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
}));
import { assertWebsiteRunOpen, closeWebsiteRun, projectWebsiteRunClosure } from "../utils/websiteRunClosure";
import { ownerClosure } from "./fixtures/website-run-closure";

const requestId = "req1", captureId = "walkthrough-req1";
beforeEach(() => {
  state.docs.clear();
  state.docs.set("inboundRequests/req1", { request: { buyerType: "site_operator", consent_attestation: { granted: true } },
    website_preparation_spend: { retained: { settlement: { actual_cost_usd: 0.3 } } } });
  state.docs.set(`captureUploadSessions/${captureId}`, { browser_pending_delivery: {
    request_id: requestId, scene_id: `site-${requestId}`, capture_id: captureId, state: "published",
    video: { object_name: `scenes/site-${requestId}/captures/${captureId}/raw/walkthrough.mov`, generation: "123", size_bytes: 100, crc32c: "YQ==" },
  } });
});
it("records an idempotent owner closure while retaining source, rights and accounting", async () => {
  const before = structuredClone(state.docs.get("inboundRequests/req1"));
  const session = structuredClone(state.docs.get(`captureUploadSessions/${captureId}`));
  const closed = await closeWebsiteRun(requestId, captureId);
  expect(await closeWebsiteRun(requestId, captureId)).toEqual(closed);
  const record = state.docs.get("inboundRequests/req1")!;
  expect(record.request).toEqual(before!.request);
  expect(record.website_preparation_spend).toEqual(before!.website_preparation_spend);
  expect(state.docs.get(`captureUploadSessions/${captureId}`)).toEqual(session);
  expect(() => assertWebsiteRunOpen(record, requestId, captureId)).toThrow("website_run_closed_by_owner");
  expect(() => assertWebsiteRunOpen(record, requestId, "walkthrough-another")).not.toThrow();
  expect(projectWebsiteRunClosure(record, requestId, captureId)).toMatchObject({ category: "insufficient_evidence",
    basis: "missing_evidence", title: "Run closed with a conservative abstention", actionOwner: "blueprint" });
});
it("will not silently renew closure against a changed video", async () => {
  await closeWebsiteRun(requestId, captureId);
  const session = state.docs.get(`captureUploadSessions/${captureId}`)! as Record<string, any>;
  session.browser_pending_delivery.video.generation = "124";
  await expect(closeWebsiteRun(requestId, captureId)).rejects.toThrow("website_run_source_changed");
});
it("refuses a capture belonging to another request", async () => {
  (state.docs.get(`captureUploadSessions/${captureId}`)! as Record<string, any>).browser_pending_delivery.request_id = "other";
  await expect(closeWebsiteRun(requestId, captureId)).rejects.toThrow("website_run_source_changed");
  expect(state.docs.get("inboundRequests/req1")).not.toHaveProperty("website_run_closures");
});
it.each([null, [], {}, { ...ownerClosure(), new_execution_authorized: true }])("fails closed on an invalid saved decision %s", value => {
  expect(() => assertWebsiteRunOpen({ website_run_closures: { [captureId]: value } }, requestId, captureId))
    .toThrow("website_run_closure_invalid");
});
it("rejects a signed receipt moved to another capture or request", () => {
  const record = { website_run_closures: { [captureId]: ownerClosure("another", captureId) } };
  expect(() => assertWebsiteRunOpen(record, requestId, captureId)).toThrow("website_run_closure_invalid");
});
