// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const ports = vi.hoisted(() => ({ get: null as any, post: null as any, record: vi.fn() }));
vi.mock("express", () => ({ Router: () => ({ get: (_path: string, handler: any) => { ports.get = handler; }, post: (_path: string, handler: any) => { ports.post = handler; } }) }));
vi.mock("../utils/email-suppression", () => ({ normalizeSuppressionEmail: (value: string) => value.trim().toLowerCase(), recordEmailSuppression: ports.record }));
import "../routes/email-preferences";
const response = () => { const res: any = { status: vi.fn(() => res), json: vi.fn(() => res), type: vi.fn(() => res), send: vi.fn(() => res) }; return res; };
beforeEach(() => { vi.clearAllMocks(); ports.record.mockResolvedValue({ persisted: true }); });
describe("commercial first-contact all-marketing opt-out", () => {
  it("uses the ordinary one-page public route to persist all-marketing suppression", async () => {
    const res = response(); await ports.get({ method: "GET", query: { email: "OPS@business.co", scope: "all" }, accepts: () => false }, res);
    expect(ports.record).toHaveBeenCalledWith(expect.objectContaining({ email: "ops@business.co", scope: "all", reason: "unsubscribe" }));
    expect(res.status).toHaveBeenCalledWith(200); expect(res.send).toHaveBeenCalledWith(expect.stringContaining("unsubscribed"));
  });
  it("reports unavailable persistence instead of claiming an opt-out succeeded", async () => {
    ports.record.mockResolvedValue({ persisted: false }); const res = response();
    await ports.post({ method: "POST", query: {}, body: { email: "ops@business.co", scope: "all" }, accepts: () => true }, res);
    expect(res.status).toHaveBeenCalledWith(503); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false })); expect(res.send).not.toHaveBeenCalled();
  });
});
