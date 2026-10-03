// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const ports = vi.hoisted(() => ({ get: null as any, post: null as any, record: vi.fn() }));
vi.mock("express", () => ({ Router: () => ({ get: (_path: string, handler: any) => { ports.get = handler; }, post: (_path: string, handler: any) => { ports.post = handler; } }) }));
vi.mock("../utils/email-suppression", () => ({ normalizeSuppressionEmail: (value: string) => value.trim().toLowerCase(), recordEmailSuppression: ports.record }));
import "../routes/email-preferences";
const response = () => { const res: any = { status: vi.fn(() => res), json: vi.fn(() => res), type: vi.fn(() => res), set: vi.fn(() => res), send: vi.fn(() => res) }; return res; };
beforeEach(() => { vi.clearAllMocks(); ports.record.mockResolvedValue({ persisted: true }); });
describe("explicit public email opt-out", () => {
  it.each(["GET", "HEAD"])("displays confirmation for %s without changing suppression", async method => {
    const res = response(); await ports.get({ method, query: { email: "OPS@business.co", scope: "all" }, accepts: () => "html" }, res);
    expect(ports.record).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('method="post" action="/api/growth/email/unsubscribe"'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('name="email" value="ops@business.co"'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('name="scope" value="all"'));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('name="confirmation" value="unsubscribe"'));
    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it("returns a read-only JSON confirmation requirement, never an unsubscribe receipt", async () => {
    const res = response(); await ports.get({ method: "GET", query: { email: "ops@business.co", scope: "all" }, accepts: () => "json" }, res);
    expect(ports.record).not.toHaveBeenCalled(); expect(res.json).toHaveBeenCalledWith({ ok: true, confirmationRequired: true, email: "ops@business.co", scope: "all" });
  });
  it("escapes email and link metadata in the confirmation form", async () => {
    const res = response(); await ports.get({ method: "GET", query: { email: 'a"<x>&@business.co', scope: "all", campaignId: '\"><script>bad</script>', cadenceId: "a&b'" }, accepts: () => "html" }, res);
    const html = res.send.mock.calls[0][0];
    expect(html).not.toContain("<script>"); expect(html).not.toContain("<x>");
    expect(html).toContain('value="a&quot;&lt;x&gt;&amp;@business.co"');
    expect(html).toContain('value="&quot;&gt;&lt;script&gt;bad&lt;/script&gt;"');
    expect(html).toContain('value="a&amp;b&#39;"'); expect(ports.record).not.toHaveBeenCalled();
  });
  it.each(["all", "growth_campaign", "lifecycle"])("records the deliberately confirmed %s scope", async scope => {
    const res = response(); await ports.post({ method: "POST", query: {}, body: { email: "OPS@business.co", scope, confirmation: "unsubscribe", campaignId: "campaign-1", cadenceId: "cadence-1" }, accepts: () => "json" }, res);
    expect(ports.record).toHaveBeenCalledWith({ email: "ops@business.co", scope, reason: "unsubscribe", source: "email_preferences_route", campaignId: "campaign-1", cadenceId: "cadence-1" });
    expect(res.status).toHaveBeenCalledWith(200); expect(res.json).toHaveBeenCalledWith({ ok: true, email: "ops@business.co", scope });
  });
  it.each(["missing", "email_mismatch", "scope_mismatch"])("refuses %s confirmation without persistence", async kind => {
    const body: any = { email: "ops@business.co", scope: "all", confirmation: "unsubscribe" };
    if (kind === "missing") delete body.confirmation;
    const query = kind === "email_mismatch" ? { email: "another@business.co" } : kind === "scope_mismatch" ? { scope: "lifecycle" } : {};
    const res = response(); await ports.post({ method: "POST", query, body, accepts: () => "json" }, res);
    expect(res.status).toHaveBeenCalledWith(400); expect(ports.record).not.toHaveBeenCalled();
  });
  it("reports unavailable persistence instead of claiming a confirmed opt-out succeeded", async () => {
    ports.record.mockResolvedValue({ persisted: false }); const res = response();
    await ports.post({ method: "POST", query: {}, body: { email: "ops@business.co", scope: "all", confirmation: "unsubscribe" }, accepts: () => "json" }, res);
    expect(res.status).toHaveBeenCalledWith(503); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false })); expect(res.send).not.toHaveBeenCalled();
  });
});
