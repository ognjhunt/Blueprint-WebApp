// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { officialResearchInput } from "./fixtures/official-contact-research";
import { memoryFirestore } from "./fixtures/communications";
const bindings = vi.hoisted(() => ({ db: null as any, access: vi.fn(), suppressed: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ get dbAdmin() { return bindings.db; }, default: {} }));
vi.mock("../utils/access-control", () => ({ resolveExecutionAccessContext: bindings.access }));
vi.mock("../utils/email-suppression", () => ({ isEmailSuppressed: bindings.suppressed }));
import router from "../routes/admin-communications-research";
import { REVIEWED_RESEARCH_ROOT } from "../agents/communications-reviewed-research";
import { COMMUNICATIONS_ROOT } from "../agents/communications-store";

async function invoke(body: unknown) {
  const layer = router.stack.find(x => x.route?.path === "/research-admissions")!;
  const res = { locals: { firebaseUser: { uid: "request-user", admin: true } }, status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res); res.json.mockReturnValue(res);
  await layer.route.stack[0].handle({ body }, res, vi.fn());
  return { status: res.status.mock.calls[0][0], body: res.json.mock.calls[0][0] };
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-01T21:05:00Z"));
  bindings.db = memoryFirestore(); bindings.access.mockReset(); bindings.suppressed.mockReset();
  bindings.access.mockResolvedValue({ isAdmin: true, uid: "server-verified-user" });
  bindings.suppressed.mockResolvedValue(false);
});
afterEach(() => vi.useRealTimers());
describe("authenticated reviewed-research admission route", () => {
  it("ignores client role claims and blocks missing/revoked server authority without writes", async () => {
    bindings.access.mockResolvedValue({ isAdmin: false, uid: "request-user" });
    expect((await invoke(officialResearchInput())).status).toBe(403);
    expect(bindings.db.records.size).toBe(0);
  });
  it("rejects caller-controlled approval, reviewer or invented API-session fields", async () => {
    for (const addition of [{ approved: true }, { reviewedBy: "forged-agent" }, { sessionId: "fake-api-session" }]) {
      expect((await invoke({ ...officialResearchInput(), ...addition })).status).toBe(400);
    }
    expect(bindings.db.records.size).toBe(0);
  });
  it("persists server actor/time, public-role assessment and truthful projection status while queuing no session/send", async () => {
    const input = officialResearchInput(); input.crm.checkedAt = new Date().toISOString();
    const response = await invoke(input);
    expect(response).toMatchObject({ status: 200, body: { state: "admitted", sheetsPublished: false,
      notionPublished: false, provenanceKind: "codex_report", sent: false, sessionCreated: false } });
    const saved = bindings.db.records.get(`${REVIEWED_RESEARCH_ROOT}/${response.body.admissionId}`);
    expect(saved.row.review.reviewer_reference).toBe("authenticated:server-verified-user");
    expect(saved.row.packet.assessment.contact.selection.kind).toBe("general_inbox");
    expect(bindings.db.records.get(`${COMMUNICATIONS_ROOT}/jobs/${response.body.jobId}`)).toMatchObject({ state: "queued",
      checkpoint: { createClaimedAt: null, sessionId: null, turnId: null } });
  });
  it("returns unavailable store without requesting credentials or changing access", async () => {
    bindings.db = null;
    expect((await invoke(officialResearchInput())).status).toBe(503);
  });
});
