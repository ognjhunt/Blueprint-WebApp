/**
 * A stored identity field that cannot be decrypted is unknown, not absent (review of #1320): removing identity
 * with it missing would let the site's name through. Reading it fails closed: the Pipeline's projection does not
 * proceed, and a company's job page shows no sentence rather than one that might still name the site.
 */
import { describe, expect, it, vi } from "vitest";

const decrypt = vi.fn();
vi.mock("../utils/field-encryption", () => ({ decryptFieldValue: (value: unknown) => decrypt(value) }));

const { knownSiteIdentity } = await import("../utils/siteIdentity");
const { taskContextSiteIdentity, TASK_CONTEXT_IDENTITY_FIELD } = await import("../utils/websiteTaskContext");

const record = { [TASK_CONTEXT_IDENTITY_FIELD]: true,
  contact: { firstName: "enc:first", lastName: "enc:last", company: "enc:company" },
  request: { siteName: "enc:site" } };

describe("an identity that cannot be decrypted", () => {
  it("is refused, never read as absent", async () => {
    decrypt.mockImplementation(async (value: string) => {
      if (value === "enc:site") throw new Error("kms_unavailable");
      return value.replace("enc:", "Plain ");
    });
    await expect(knownSiteIdentity(record)).rejects.toThrow("site_identity_unreadable");
    await expect(taskContextSiteIdentity(record)).rejects.toThrow("site_identity_unreadable");
  });

  it("reads every field when decryption works", async () => {
    decrypt.mockImplementation(async (value: string) => value.replace("enc:", "Plain "));
    const known = await knownSiteIdentity(record);
    expect(known.names).toContain("Plain site");
    expect(known.names).toContain("Plain first Plain last");
  });

  it("leaves an absent field absent, without a key-service call", async () => {
    decrypt.mockReset();
    const known = await knownSiteIdentity({ contact: {}, request: {} });
    expect(decrypt).not.toHaveBeenCalled();
    expect(known.names.filter(Boolean)).toEqual([]);
  });
});
