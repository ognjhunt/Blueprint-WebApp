// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const sources = vi.hoisted(() => ({ listUsers: vi.fn(), getUser: vi.fn(), profiles: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ authAdmin: sources,
  dbAdmin: { collection: () => ({ select: () => ({ get: sources.profiles }) }) } }));
import { accountNoticeSchema, assessAccountNoticeRecipient, previewAccountNotices } from "../utils/accountNotice";
const input = { noticeId: "synthetic-service-v1", subject: "Service notice", body: "Approved synthetic body",
  eligibility: { audience: { kind: "existing_accounts", createdBefore: "2026-10-14T00:00:00Z" }, reason: "Existing account holders at the time of this change",
    evidenceRef: "synthetic:service-scope-decision", emailVerification: "not_required", includeDisabledAccounts: false,
    exclusions: [{ uid: "known-test", reason: "test_account", evidenceRef: "synthetic:owner-identified-test-account" }] } };
const notice = accountNoticeSchema.parse(input);
function account(uid: string, changes: Record<string, unknown> = {}) {
  return { uid, email: `${uid}@gmail.com`, emailVerified: false, disabled: false, metadata: { creationTime: "2025-02-01T00:00:00Z" }, ...changes } as any;
}
beforeEach(() => { vi.resetAllMocks(); sources.profiles.mockResolvedValue({ docs: [{ id: "orphan-profile" }] }); });

describe("notice-specific account eligibility", () => {
  it("keeps Auth-only and unverified existing users eligible when the notice permits it, regardless of jobs or beta admission", () => {
    expect(assessAccountNoticeRecipient(notice, "existing", account("existing"))).toMatchObject({ state: "eligible", accountLinked: true, emailVerified: false, email: "existing@gmail.com", sourceRecordIds: ["firebase_auth/users/existing"] });
  });
  it("reports verification separately from proven account linkage", () => {
    const verifiedOnly = accountNoticeSchema.parse({ ...input, eligibility: { ...input.eligibility, emailVerification: "required" } });
    expect(assessAccountNoticeRecipient(verifiedOnly, "existing", account("existing"))).toMatchObject({ state: "held", reason: "email_verification_required", accountLinked: true, emailVerified: false });
  });
  it("excludes explicitly identified tests with evidence, and unrelated or newly created accounts by the notice scope", () => {
    expect(assessAccountNoticeRecipient(notice, "known-test", account("known-test"))).toMatchObject({ state: "excluded", reason: "test_account", exclusionEvidenceRef: input.eligibility.exclusions[0].evidenceRef });
    expect(assessAccountNoticeRecipient(notice, "new", account("new", { metadata: { creationTime: "2026-10-14T00:00:00Z" } }))).toMatchObject({ state: "excluded", reason: "created_after_notice_cutoff" });
    const scoped = accountNoticeSchema.parse({ ...input, eligibility: { ...input.eligibility, audience: { kind: "account_uids", uids: ["affected-account"] } } });
    expect(assessAccountNoticeRecipient(scoped, "unrelated", account("unrelated"))).toMatchObject({ state: "excluded", reason: "outside_notice_scope" });
  });
  it("holds unknown or conflicting linkage, missing date/address and source failures for review", () => {
    for (const [auth, failed] of [[null, false], [account("other"), false], [account("existing", { metadata: {} }), false], [account("existing", { email: null }), false], [null, true]] as const)
      expect(assessAccountNoticeRecipient(notice, "existing", auth, true, failed).state).toBe("held");
  });
  it("makes disabled-account inclusion a notice policy choice", () => {
    expect(assessAccountNoticeRecipient(notice, "disabled", account("disabled", { disabled: true }))).toMatchObject({ state: "excluded", reason: "account_disabled" });
    const all = accountNoticeSchema.parse({ ...input, eligibility: { ...input.eligibility, includeDisabledAccounts: true } });
    expect(assessAccountNoticeRecipient(all, "disabled", account("disabled", { disabled: true })).state).toBe("eligible");
  });
  it("rejects legacy arbitrary-address inputs and missing notice scope or exclusion evidence", () => {
    expect(() => accountNoticeSchema.parse({ noticeId: input.noticeId, subject: input.subject, body: input.body, to: "any@example.invalid" })).toThrow();
    expect(() => accountNoticeSchema.parse({ ...input, eligibility: { ...input.eligibility, exclusions: [{ uid: "guess", reason: "test_account" }] } })).toThrow();
  });
});

describe("read-only auditable recipient preview", () => {
  it("pages all Auth users, enumerates profile IDs separately, and reports eligible/excluded/held sources", async () => {
    sources.listUsers.mockResolvedValueOnce({ users: [account("existing")], pageToken: "next-page" })
      .mockResolvedValueOnce({ users: [account("known-test")], pageToken: undefined });
    const report = await previewAccountNotices(input);
    expect(sources.listUsers.mock.calls).toEqual([[1000, undefined], [1000, "next-page"]]);
    expect(report.complete).toBe(true);
    expect(report.recipients).toEqual(expect.arrayContaining([
      expect.objectContaining({ uid: "existing", state: "eligible", sourceRecordIds: ["firebase_auth/users/existing"] }),
      expect.objectContaining({ uid: "known-test", state: "excluded", reason: "test_account" }),
      expect.objectContaining({ uid: "orphan-profile", state: "held", accountLinked: false, sourceRecordIds: ["users/orphan-profile"] }),
    ]));
    expect(sources.getUser).not.toHaveBeenCalled();
  });
  it("does not publish a complete eligible roster when later pagination or profile enumeration fails", async () => {
    sources.listUsers.mockResolvedValueOnce({ users: [account("existing")], pageToken: "next" }).mockRejectedValueOnce(new Error("page unavailable"));
    await expect(previewAccountNotices(input)).rejects.toThrow("page unavailable");
    sources.listUsers.mockResolvedValue({ users: [account("existing")] });
    sources.profiles.mockRejectedValueOnce(new Error("profiles unavailable"));
    await expect(previewAccountNotices(input)).rejects.toThrow("profiles unavailable");
  });
});
