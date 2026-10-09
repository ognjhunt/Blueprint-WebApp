// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { communicationsFixture, communicationsNow, memoryFirestore } from "./fixtures/communications";
import { communicationsDigest } from "../agents/communications-contract";
import { runCommunicationsFactRefresh } from "../agents/communications-fact-refresh";
import { COMMUNICATIONS_ROOT } from "../agents/communications-store";
describe("bounded stale-fact refresh", () => {
  it("retains fresh source bytes beyond three attempts without redating the old claim or authorizing sends", async () => {
    const { brief } = communicationsFixture(); const db = memoryFirestore();
    await db.doc(`${COMMUNICATIONS_ROOT}/briefs/${brief.briefId}`).set(brief);
    await db.doc(`${COMMUNICATIONS_ROOT}/refreshRequests/job`).set({ state: "pending", attempts: 5, job: { briefId: brief.briefId, briefDigest: communicationsDigest(brief) } });
    const reader = vi.fn(async (url: string) => ({ requestedUrl: url, finalUrl: url, redirects: [], checkedAt: new Date(communicationsNow).toISOString(),
      status: 200 as const, contentType: "text/plain", bodyBase64: Buffer.from(brief.facts[0].claim).toString("base64") }));
    await runCommunicationsFactRefresh(db, reader, () => communicationsNow);
    await runCommunicationsFactRefresh(db, reader, () => communicationsNow);
    expect(reader).toHaveBeenCalledTimes(1);
    expect(db.records.get(`${COMMUNICATIONS_ROOT}/briefs/${brief.briefId}`)).toEqual(brief);
    expect(db.records.get(`${COMMUNICATIONS_ROOT}/refreshRequests/job`)).toMatchObject({ state: "unresolved", attempts: 6, sendsAuthorized: false,
      reason: "fresh_evidence_requires_research_qa", evidence: [expect.objectContaining({ assessment: "literal_match_requires_review" })] });
    expect([...db.records.keys()].some(key => key.includes("/refreshEvidence/"))).toBe(true);
  });
  it("leaves intake contact and research-owner requests to their owners, untouched", async () => {
    const { brief } = communicationsFixture(); const db = memoryFirestore();
    await db.doc(`${COMMUNICATIONS_ROOT}/briefs/${brief.briefId}`).set(brief);
    await db.doc(`${COMMUNICATIONS_ROOT}/refreshRequests/job`).set({ state: "pending", job: { briefId: brief.briefId, briefDigest: communicationsDigest(brief) } });
    const contact = { state: "pending", kind: "public_contact_resolution", owner: "blueprint-communications-agent", reasons: ["hypothesis_public_contact_missing"] };
    const owner = { state: "running", kind: "research_owner_refresh", owner: "blueprint-research-agent", reasons: ["outreach_ready_tier_mismatch"] };
    await db.doc(`${COMMUNICATIONS_ROOT}/refreshRequests/intake_contact`).set(contact);
    await db.doc(`${COMMUNICATIONS_ROOT}/refreshRequests/intake_owner`).set(owner);
    const reader = vi.fn(async (url: string) => ({ requestedUrl: url, finalUrl: url, redirects: [], checkedAt: new Date(communicationsNow).toISOString(),
      status: 200 as const, contentType: "text/plain", bodyBase64: Buffer.from(brief.facts[0].claim).toString("base64") }));
    await runCommunicationsFactRefresh(db, reader, () => communicationsNow);
    expect(db.records.get(`${COMMUNICATIONS_ROOT}/refreshRequests/intake_contact`)).toEqual(contact);
    expect(db.records.get(`${COMMUNICATIONS_ROOT}/refreshRequests/intake_owner`)).toEqual(owner);
    expect(db.records.get(`${COMMUNICATIONS_ROOT}/refreshRequests/job`)).toMatchObject({ state: "unresolved", reason: "fresh_evidence_requires_research_qa" });
  });
  it("terminates a changed brief explicitly before retrieving any source", async () => {
    const db = memoryFirestore(), { brief } = communicationsFixture();
    await db.doc(`${COMMUNICATIONS_ROOT}/briefs/${brief.briefId}`).set(brief);
    await db.doc(`${COMMUNICATIONS_ROOT}/refreshRequests/job`).set({ state: "pending", job: { briefId: brief.briefId, briefDigest: "old" } });
    const reader = vi.fn(); await runCommunicationsFactRefresh(db, reader, () => communicationsNow);
    expect(reader).not.toHaveBeenCalled();
    expect(db.records.get(`${COMMUNICATIONS_ROOT}/refreshRequests/job`)).toMatchObject({ state: "unresolved", reason: "research_brief_changed" });
  });
});
