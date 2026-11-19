// @vitest-environment node
/**
 * The listing backfill for jobs sent with their description only (owner approval, 2026-11-19): a v5 job submitted before
 * its submission wrote a listing record gets the record a new v5 submission writes, once, from the automatic send's
 * sweep. Withdrawn jobs, older statements, jobs with a recording grant and jobs with any listing record are never touched,
 * and a second run changes nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
import { anonymizedOpportunityDraft } from "../../client/src/types/taskBrowse";

vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore, default: {}, storageAdmin: null,
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/field-encryption", async importOriginal => ({ ...await importOriginal<typeof import("../utils/field-encryption")>(),
  // A plain string (older records) or an EncryptedField object (what intake stores): this stand-in reads either.
  decryptFieldValue: vi.fn(async (value: unknown) => typeof value === "string" ? value.replace(/^encrypted:/, "")
    : String((value as { ciphertext: string }).ciphertext)) }));

const { backfillDescriptionSharedListings, DESCRIPTION_LISTING_BACKFILL_DOC } = await import("../utils/jobSharedListing");
const { teamJobAccess } = await import("../utils/teamJobAccess");
const { logger } = await import("../logger");

const AT = "2026-11-13T09:00:00.000Z";
const authority = (version: string) => ({ granted: true, statement_version: version, recorded_at_iso: AT });
const v5Job = (extra: Record<string, unknown> = {}, request: Record<string, unknown> = {}) => ({
  request: { buyerType: "site_operator", capture_mode: "self_capture", consent_attestation: null,
    description_authority: authority("2026-11-12.v5"), taskStatement: "encrypted:Acme Depot moves cartons onto a pallet", ...request },
  ...extra });
const doc = (id: string) => state.docs.get(`inboundRequests/${id}`) as Record<string, any>;
const jobs = () => [...state.docs.entries()].filter(([key]) => key.startsWith("inboundRequests/"));

beforeEach(() => {
  state.docs.clear();
  vi.mocked(logger.info).mockClear();
  state.docs.set("inboundRequests/due", v5Job());
  state.docs.set("inboundRequests/withdrawn", v5Job({ consent_revoked: true, capture_withdrawal: { state: "uploads_stopped_cleanup_pending" } },
    { consent_attestation: { granted: false, revoked_at_iso: AT } }));
  state.docs.set("inboundRequests/older", v5Job({}, { description_authority: authority("2026-11-11.v3") }));
  state.docs.set("inboundRequests/recorded-older", v5Job({}, { consent_attestation: authority("2026-11-11.v3") }));
  state.docs.set("inboundRequests/revoked-authority", v5Job({}, { description_authority: { ...authority("2026-11-12.v5"), revoked_at_iso: AT } }));
  state.docs.set("inboundRequests/has-card", v5Job({ public_task_listing: { enabled: false, consentVersion: "public-task-card-v1" } }));
});

describe("the listing backfill for description-only jobs", () => {
  it("writes the record a v5 submission writes, once, to the due job only, and logs a count", async () => {
    const before = new Map(jobs().map(([key, value]) => [key, structuredClone(value)]));
    expect(await backfillDescriptionSharedListings()).toEqual({ examined: 5, written: 1, finished: true });
    expect(doc("due").public_task_listing).toEqual({ enabled: true, details: anonymizedOpportunityDraft("Acme Depot moves cartons onto a pallet"),
      consentVersion: "job-shared-2026-11-12", approvedAtIso: AT, wentLiveIso: AT, approvedBy: "description_statement",
      recordingStatementVersion: null, descriptionStatementVersion: "2026-11-12.v5", thumbnailDigest: null, reviewRequired: false });
    expect(doc("due").summary_shared_notice).toEqual({ owed: true });
    expect(JSON.stringify(doc("due").public_task_listing)).not.toMatch(/Acme/);
    expect(teamJobAccess(doc("due"))).toMatchObject({ listed: true, reason: "no_video_yet" });
    // Withdrawn, older statements, a recording grant under an older statement, a revoked authority and an existing card:
    // untouched, byte for byte.
    for (const id of ["withdrawn", "older", "recorded-older", "revoked-authority", "has-card"])
      expect(doc(id), id).toEqual(before.get(`inboundRequests/${id}`));
    expect(logger.info).toHaveBeenCalledWith({ examined: 5, written: 1, finished: true }, expect.any(String));
  });

  it("reads the sentence intake stores encrypted, so a backfilled job gets its own title and family", async () => {
    // What encryptInboundRequestForStorage() writes: an EncryptedField object, not a string.
    const stored = { ciphertext: "Acme Depot moves cartons onto a pallet", iv: "iv", authTag: "tag", dek: "dek",
      keyVersion: "1", alg: "aes-256-gcm", dekAlg: "kms" };
    state.docs.set("inboundRequests/due", v5Job({}, { taskStatement: stored }));
    expect(await backfillDescriptionSharedListings()).toMatchObject({ written: 1 });
    expect(doc("due").public_task_listing.details).toEqual(anonymizedOpportunityDraft("Acme Depot moves cartons onto a pallet"));
    expect(doc("due").public_task_listing.details).not.toEqual(anonymizedOpportunityDraft(""));
    expect(JSON.stringify(doc("due").public_task_listing)).not.toMatch(/Acme/);
  });

  it("is a no-op the second time, whether or not the first pass finished", async () => {
    await backfillDescriptionSharedListings();
    const after = new Map(jobs().map(([key, value]) => [key, structuredClone(value)]));
    expect(await backfillDescriptionSharedListings()).toEqual({ examined: 0, written: 0, finished: true });
    // Even with the finished marker gone, a re-run finds nothing due and changes no job.
    state.docs.delete(DESCRIPTION_LISTING_BACKFILL_DOC);
    expect(await backfillDescriptionSharedListings()).toMatchObject({ written: 0, finished: true });
    expect(new Map(jobs())).toEqual(after);
  });

  it("walks page by page, never overwriting a record written in between", async () => {
    for (const id of ["a1", "a2", "a3"]) state.docs.set(`inboundRequests/${id}`, v5Job());
    const first = await backfillDescriptionSharedListings(2);
    expect(first.finished).toBe(false);
    // A record written meanwhile (by a submission or another pass) is kept as it is.
    const kept = { enabled: true, consentVersion: "job-shared-2026-11-12", approvedAtIso: "2026-11-19T00:00:00.000Z", marker: "kept" };
    state.docs.set("inboundRequests/due", { ...doc("due"), public_task_listing: kept });
    while (!(await backfillDescriptionSharedListings(2)).finished) { /* next page */ }
    expect(doc("due").public_task_listing).toEqual(kept);
    for (const id of ["a1", "a2", "a3"]) expect(doc(id).public_task_listing?.approvedBy).toBe("description_statement");
  });
});
