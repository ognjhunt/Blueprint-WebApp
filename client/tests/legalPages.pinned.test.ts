/**
 * The Terms and Privacy pages are pinned to their versions by a digest of each page's source file. Any byte change to a
 * page fails here until a new version, approved by the owner, is recorded with the new digest in `legalAcceptance.ts`.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANNOUNCED_SUPERSEDED_VERSION, LEGAL_PAGE_DIGESTS, LEGAL_PAGE_DIGEST_VERSIONS, PREVIOUS_PRIVACY_VERSION, PREVIOUS_TERMS_VERSION,
  PRIVACY_VERSION, TERMS_VERSION,
} from "@/lib/legalAcceptance";

const ROOT = path.resolve(import.meta.dirname, "../..");
const digest = (file: string) => createHash("sha256").update(fs.readFileSync(path.join(ROOT, file))).digest("hex");
const MESSAGE = "this page's text changed; a change needs a new version approved by the owner";

describe("legal pages are pinned to their versions", () => {
  it("covers every legal page in client/src/pages", () => {
    const pages = fs.readdirSync(path.join(ROOT, "client/src/pages"))
      .filter(name => /^(Terms|Privacy)/.test(name)).map(name => `client/src/pages/${name}`).sort();
    expect(pages).toEqual(Object.keys(LEGAL_PAGE_DIGESTS).sort());
  });

  it.each(Object.entries(LEGAL_PAGE_DIGESTS))("%s", (file, pinned) => {
    expect(digest(file), `${file} (version ${pinned.version}): ${MESSAGE}`).toBe(pinned.sha256);
  });

  // 2026-11-12: the version published ahead as 2026-11-25.1 never took effect; its pages are frozen records, and the
  // current pages are the sharing version 2026-11-12.1.
  it("keeps the 2026-11-25.1 text, published ahead and replaced before it took effect, frozen as a record", () => {
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsAnnounced.tsx"].version).toBe("2026-11-25.1");
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyAnnounced.tsx"].version).toBe("2026-11-25.1");
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/Terms.tsx"].version).toBe("2026-11-12.1");
  });

  it("each digest was recorded against the version now in force for its page", () => {
    expect({ terms: TERMS_VERSION, privacy: PRIVACY_VERSION, previousTerms: PREVIOUS_TERMS_VERSION, previousPrivacy: PREVIOUS_PRIVACY_VERSION,
      announced: ANNOUNCED_SUPERSEDED_VERSION },
      "a legal version changed without recording its page's new digest; a change needs a new version approved by the owner")
      .toEqual(LEGAL_PAGE_DIGEST_VERSIONS);
  });
});
