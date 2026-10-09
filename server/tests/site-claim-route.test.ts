// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

const store = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: { collection: () => ({ doc: () => ({ get: store.get }) }) },
}));
vi.mock("../utils/field-encryption", () => ({ decryptInboundRequestForAdmin: vi.fn(async value => value) }));
vi.mock("../logger", () => ({ logger: { warn: vi.fn() } }));

import router from "../routes/site-claim";
import { createSiteClaimToken } from "../utils/request-review-auth";

const handler = router.stack.find(layer => layer.route?.path === "/:token")!.route!.stack[0].handle;
async function read(token = createSiteClaimToken("claim-fixture")) {
  const response = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  // Await the actual async Express handler. Express 4 does not catch a rejected
  // promise: this assertion fails immediately if a read escapes the boundary,
  // rather than leaving an HTTP socket hanging until the test timeout.
  await handler({ params: { token } } as unknown as Request, response as unknown as Response, vi.fn());
  return response;
}

beforeEach(() => { vi.clearAllMocks(); store.get.mockReset(); });

describe("private site-claim summary", () => {
  it("returns a retryable 503 on a datastore outage and recovers on the next read", async () => {
    store.get.mockRejectedValueOnce(new Error("datastore unavailable")).mockResolvedValueOnce({
      exists: true, data: () => ({ request: { buyerType: "site_operator", siteName: "Fixture site" }, contact: { email: "fixture@example.test" } }),
    });
    const unavailable = await read();
    expect(unavailable.status).toHaveBeenCalledWith(503);
    expect(unavailable.json).toHaveBeenCalledWith({ error: "We could not load that right now. Try again shortly." });
    const recovered = await read();
    expect(recovered.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, requestId: "claim-fixture" }));
    expect(recovered.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });

  it("returns 404 for an absent record without confusing it with unavailable storage", async () => {
    store.get.mockResolvedValue({ exists: false });
    expect((await read()).status).toHaveBeenCalledWith(404);
  });

  it("rejects an invalid token before reading any record", async () => {
    expect((await read("invalid")).status).toHaveBeenCalledWith(404);
    expect(store.get).not.toHaveBeenCalled();
  });
});

it("prefills identity and organization from the submitted job", async () => {
  store.get.mockResolvedValue({ exists: true, data: () => ({ request: { buyerType: "site_operator", siteName: "Site" }, contact: { email: "fixture@example.test", firstName: "Alex", lastName: "Owner", company: "Actual Company" } }) });
  expect((await read()).json).toHaveBeenCalledWith(expect.objectContaining({ accountDefaults: { name: "Alex Owner", organization: "Actual Company" } }));
});
it.each([{ request: { buyerType: "robot_team" }, contact: { email: "fixture@example.test" } }, { request: { buyerType: "site_operator" }, contact: {} }])("does not offer site account creation for an unusable job", async record => {
  store.get.mockResolvedValue({ exists: true, data: () => record });
  expect((await read()).status).toHaveBeenCalledWith(404);
});
