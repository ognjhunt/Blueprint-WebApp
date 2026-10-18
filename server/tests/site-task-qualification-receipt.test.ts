// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { sharedFakeFirestoreState as state, sharedFakeFirestore as database } from "./helpers/fake-firestore";
import { qualifiedReceipt } from "./helpers/siteTaskQualificationReceipt";
import { crossRuntimeArtifactDigest } from "../utils/crossRuntimeCanonical";
import {
  publishSiteTaskQualificationReceipt, siteTaskQualificationReceiptSchema,
  validateSiteTaskQualificationReceipt,
} from "../utils/siteTaskQualificationReceipt";

const reseal = (value: Record<string, unknown>) => {
  value.receipt_digest = crossRuntimeArtifactDigest(value, "receipt_digest");
  return value;
};
beforeEach(() => state.docs.clear());

describe("site-task qualification receipt integrity", () => {
  it("accepts the full retained receipt and preserves its bytes and digest", () => {
    const receipt = qualifiedReceipt();
    expect(validateSiteTaskQualificationReceipt(receipt)).toEqual(receipt);
    expect(siteTaskQualificationReceiptSchema.safeParse(receipt).success).toBe(true);
  });

  it("keeps canonical capture digests distinct from raw source bytes", () => {
    const receipt = qualifiedReceipt({ binding: { capture_id: "capture-other", source_capture_digest: `sha256:${"0".repeat(64)}` } });
    expect(receipt.source_artifacts.find(row => row.role === "capture")?.sha256).not.toBe(receipt.binding.source_capture_digest);
    expect(validateSiteTaskQualificationReceipt(receipt)).toEqual(receipt);
  });

  it("cannot qualify a five-field self-assertion", () => {
    expect(() => validateSiteTaskQualificationReceipt(qualifiedReceipt().qualification)).toThrow();
  });

  it("rejects tampering with either the outer or a contained receipt", () => {
    const receipt = qualifiedReceipt();
    receipt.reviewed_by = "another-reviewer";
    expect(() => validateSiteTaskQualificationReceipt(receipt)).toThrow(/receipt_digest/);
    const altered = qualifiedReceipt();
    altered.registration_receipt.checks[0].max_abs_error = 0.001;
    expect(() => validateSiteTaskQualificationReceipt(reseal(altered))).toThrow(/registration_receipt.*receipt_digest|receipt_digest/s);
  });

  it.each(["binding", "request_digest", "profile_digest"])("rejects a different contained %s even when all hashes are refreshed", (field) => {
    const receipt = qualifiedReceipt();
    if (field === "binding") receipt.registration_receipt.binding = { ...receipt.binding, capture_id: "another-capture" };
    else receipt.registration_receipt[field] = `sha256:${"0".repeat(64)}`;
    reseal(receipt.registration_receipt);
    receipt.qualification.registration_receipt_digest = receipt.registration_receipt.receipt_digest;
    expect(() => validateSiteTaskQualificationReceipt(reseal(receipt))).toThrow(field);
  });

  it("binds the five-field projection and source measurement hashes to the contained receipts", () => {
    const projection = qualifiedReceipt();
    projection.qualification.capture_id = "another-capture";
    expect(() => validateSiteTaskQualificationReceipt(reseal(projection))).toThrow(/qualification/);
    const source = qualifiedReceipt();
    source.source_artifacts.find(row => row.role === "measurement")!.sha256 = `sha256:${"0".repeat(64)}`;
    expect(() => validateSiteTaskQualificationReceipt(reseal(source))).toThrow(/measurement/);
  });

  it("requires every source role exactly once", () => {
    const missing = qualifiedReceipt();
    missing.source_artifacts.pop();
    expect(() => validateSiteTaskQualificationReceipt(reseal(missing))).toThrow(/source_artifacts/);
    const duplicate = qualifiedReceipt();
    duplicate.source_artifacts[0] = duplicate.source_artifacts[1];
    expect(() => validateSiteTaskQualificationReceipt(reseal(duplicate))).toThrow(/source_artifacts/);
  });

  it("rejects a robot model whose retained bytes do not match the admitted model", () => {
    const receipt = qualifiedReceipt();
    receipt.source_artifacts.find(row => row.role === "robot_model")!.sha256 = `sha256:${"0".repeat(64)}`;
    expect(() => validateSiteTaskQualificationReceipt(reseal(receipt))).toThrow(/robot_model_digest/);
  });

  it.each([NaN, Infinity, -1, true])("rejects invalid numeric error %s", (error) => {
    const receipt = qualifiedReceipt();
    receipt.registration_receipt.checks[0].max_abs_error = error as number;
    expect(() => validateSiteTaskQualificationReceipt(receipt)).toThrow();
  });

  it("requires passed thresholds, all six dimensions, and globally unique check IDs", () => {
    for (const mutate of [
      (r: ReturnType<typeof qualifiedReceipt>) => { r.registration_receipt.checks[0].max_abs_error = 1; },
      (r: ReturnType<typeof qualifiedReceipt>) => { r.registration_receipt.checks[0].dimension = "collision"; },
      (r: ReturnType<typeof qualifiedReceipt>) => { r.fidelity_review_receipt.checks[0].id = r.registration_receipt.checks[0].id; },
    ]) {
      const receipt = qualifiedReceipt(); mutate(receipt);
      reseal(receipt.registration_receipt); reseal(receipt.fidelity_review_receipt);
      receipt.qualification.registration_receipt_digest = receipt.registration_receipt.receipt_digest;
      receipt.qualification.fidelity_review_receipt_digest = receipt.fidelity_review_receipt.receipt_digest;
      expect(() => validateSiteTaskQualificationReceipt(reseal(receipt))).toThrow();
    }
  });

  it("retains historical evidence but requires valid UTC chronology", () => {
    expect(validateSiteTaskQualificationReceipt(qualifiedReceipt({ reviewed_at_iso: "2020-01-01T00:00:00Z", expires_at_iso: "2020-01-02T00:00:00Z" }))).toBeTruthy();
    for (const date of ["not-a-date", "2026-02-30T00:00:00Z", "2026-10-17T00:00:00Z", "2026-10-18T00:00:00Z"]) {
      expect(() => validateSiteTaskQualificationReceipt(qualifiedReceipt({ expires_at_iso: date }))).toThrow();
    }
  });

  it("does not silently strip unknown fields or normalize identity bytes", () => {
    expect(() => validateSiteTaskQualificationReceipt(reseal({ ...qualifiedReceipt(), override_approved: true }))).toThrow();
    const receipt = qualifiedReceipt();
    receipt.binding.capture_id = " capture-scoring ";
    expect(() => validateSiteTaskQualificationReceipt(reseal(receipt))).toThrow();
  });
});

describe("immutable qualification publication", () => {
  it("stores the complete receipt under its digest and makes a retry idempotent", async () => {
    const receipt = qualifiedReceipt();
    expect(await publishSiteTaskQualificationReceipt(receipt, database)).toEqual({ created: true, receiptDigest: receipt.receipt_digest });
    const path = `siteTaskQualifications/${receipt.receipt_digest.slice(7)}`;
    const first = structuredClone(state.docs.get(path));
    expect(first?.receipt).toEqual(receipt);
    expect(first?.publishedAtIso).toEqual(expect.any(String));
    expect(await publishSiteTaskQualificationReceipt(receipt, database)).toEqual({ created: false, receiptDigest: receipt.receipt_digest });
    expect(state.docs.get(path)).toEqual(first);
  });

  it("refuses conflicting retained content without overwriting it", async () => {
    const receipt = qualifiedReceipt();
    const path = `siteTaskQualifications/${receipt.receipt_digest.slice(7)}`;
    const corrupted = { receipt: { ...receipt, reviewed_by: "different" }, publishedAtIso: "keep-original" };
    state.docs.set(path, corrupted);
    await expect(publishSiteTaskQualificationReceipt(receipt, database)).rejects.toThrow(/conflict/);
    expect(state.docs.get(path)).toEqual(corrupted);
  });

  it("creates only one immutable document when identical publications race", async () => {
    const receipt = qualifiedReceipt();
    const results = await Promise.all([
      publishSiteTaskQualificationReceipt(receipt, database), publishSiteTaskQualificationReceipt(receipt, database),
    ]);
    expect(results.map(result => result.created).sort()).toEqual([false, true]);
    expect(state.docs.size).toBe(1);
  });

  it("does not write invalid evidence", async () => {
    await expect(publishSiteTaskQualificationReceipt(qualifiedReceipt().qualification, database)).rejects.toThrow();
    expect(state.docs.size).toBe(0);
  });

  it("fails closed when the explicitly selected store is unavailable", async () => {
    await expect(publishSiteTaskQualificationReceipt(qualifiedReceipt(), null)).rejects.toThrow(/database_unavailable/);
    expect(state.docs.size).toBe(0);
  });
});
