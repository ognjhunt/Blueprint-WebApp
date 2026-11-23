// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const ports = vi.hoisted(() => ({ get: null as any, post: null as any, record: vi.fn(),
  verify: vi.fn((token: string) => token === "sealed-ok" ? { email: "ops@business.co", scope: "optional_updates" } : null) }));
vi.mock("express", () => ({ Router: () => ({ get: (_path: string, handler: any) => { ports.get = handler; }, post: (_path: string, handler: any) => { ports.post = handler; } }) }));
vi.mock("../utils/email-suppression", () => ({ normalizeSuppressionEmail: (value: string) => value.trim().toLowerCase(), recordEmailSuppression: ports.record,
  OPTIONAL_UPDATES_EMAILS: "new-job emails and Blueprint updates", verifyUnsubscribeToken: ports.verify }));
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
  // Launch copy (e-032 to e-035, f-104 to f-106): the page names the emails the link stops, never a scope's internal name,
  // and a browser is answered with a page, never raw JSON.
  it("names what the new-job email's link stops, and says it is done in the same words", async () => {
    const get = response(); await ports.get({ method: "GET", query: { email: "dana@northwind.example", scope: "optional_updates" }, accepts: () => "html" }, get);
    const page = get.send.mock.calls[0][0];
    expect(page).toContain("<h1>Unsubscribe from new-job emails and Blueprint updates?</h1><p>We'll stop sending them to dana@northwind.example.</p>");
    expect(page).toContain('value="unsubscribe">Unsubscribe</button>');
    expect(page).not.toMatch(/optional updates|opt-out|Confirm the preference/i);
    const post = response();
    await ports.post({ method: "POST", query: {}, body: { email: "dana@northwind.example", scope: "optional_updates", confirmation: "unsubscribe" }, accepts: () => "html" }, post);
    expect(post.type).toHaveBeenCalledWith("html");
    expect(post.send).toHaveBeenCalledWith(expect.stringContaining("<h1>You're unsubscribed. We won't send you new-job emails or Blueprint updates.</h1>"));
  });
  it.each(["all", "growth_campaign", "lifecycle"])("names a %s link plainly, by no internal name", async scope => {
    const res = response(); await ports.get({ method: "GET", query: { email: "ops@business.co", scope }, accepts: () => "html" }, res);
    const page = res.send.mock.calls[0][0], shown = page.slice(page.indexOf("<main>"), page.indexOf("<form"));
    expect(shown).toBe("<main><h1>Stop these emails from Blueprint?</h1><p>We'll stop sending this kind of email to ops@business.co. Nothing has changed yet.</p>\n      ");
    expect(shown).not.toContain(scope.replace("_", " "));
  });
  it("answers a browser with a page, not JSON, when the link is incomplete, changed or cannot be saved", async () => {
    const incomplete = response(); await ports.get({ method: "GET", query: { email: "not-an-email" }, accepts: () => "html" }, incomplete);
    expect(incomplete.status).toHaveBeenCalledWith(400); expect(incomplete.json).not.toHaveBeenCalled();
    expect(incomplete.send).toHaveBeenCalledWith(expect.stringContaining("This unsubscribe link is incomplete. Use the link in your latest Blueprint email, or write to hello@tryblueprint.io."));
    const changed = response();
    await ports.post({ method: "POST", query: { scope: "lifecycle" }, body: { email: "ops@business.co", scope: "all", confirmation: "unsubscribe" }, accepts: () => "html" }, changed);
    expect(changed.status).toHaveBeenCalledWith(400); expect(changed.json).not.toHaveBeenCalled();
    expect(changed.send).toHaveBeenCalledWith(expect.stringContaining("This link changed. Open it again from the email."));
    ports.record.mockResolvedValue({ persisted: false }); const unsaved = response();
    await ports.post({ method: "POST", query: {}, body: { email: "ops@business.co", scope: "all", confirmation: "unsubscribe" }, accepts: () => "html" }, unsaved);
    expect(unsaved.status).toHaveBeenCalledWith(503); expect(unsaved.json).not.toHaveBeenCalled();
    expect(unsaved.send).toHaveBeenCalledWith(expect.stringContaining("We couldn't save that just now. Open the link again shortly."));
  });
  it("reports unavailable persistence instead of claiming a confirmed opt-out succeeded", async () => {
    ports.record.mockResolvedValue({ persisted: false }); const res = response();
    await ports.post({ method: "POST", query: {}, body: { email: "ops@business.co", scope: "all", confirmation: "unsubscribe" }, accepts: () => "json" }, res);
    expect(res.status).toHaveBeenCalledWith(503); expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: false })); expect(res.send).not.toHaveBeenCalled();
  });
  it("takes the address and scope from the link's sealed token, and confirms with the token, not an address", async () => {
    const get = response(); await ports.get({ method: "GET", query: { token: "sealed-ok", email: "another@business.co", scope: "all" }, accepts: () => "html" }, get);
    const page = get.send.mock.calls[0][0];
    expect(page).toContain('name="token" value="sealed-ok"'); expect(page).not.toContain('name="email"');
    expect(page).toContain("We'll stop sending them to ops@business.co."); expect(ports.record).not.toHaveBeenCalled();
    const swapped = response();
    await ports.post({ method: "POST", query: { token: "sealed-ok" }, body: { token: "other", confirmation: "unsubscribe" }, accepts: () => "json" }, swapped);
    expect(swapped.status).toHaveBeenCalledWith(400); expect(ports.record).not.toHaveBeenCalled();
    const post = response();
    await ports.post({ method: "POST", query: {}, body: { token: "sealed-ok", confirmation: "unsubscribe" }, accepts: () => "json" }, post);
    expect(ports.record).toHaveBeenCalledWith(expect.objectContaining({ email: "ops@business.co", scope: "optional_updates", reason: "unsubscribe" }));
    expect(post.status).toHaveBeenCalledWith(200);
  });
  it("refuses a token that does not open, without falling back to an address in the query", async () => {
    const res = response(); await ports.get({ method: "GET", query: { token: "forged", email: "ops@business.co" }, accepts: () => "html" }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("This unsubscribe link is incomplete."));
  });
});
