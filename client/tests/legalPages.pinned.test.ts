/**
 * The Terms and Privacy pages are pinned to their versions by a digest of each page's source file. Any byte change to a
 * page fails here until a new version, approved by the owner, is recorded with the new digest in `legalAcceptance.ts`.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { termsSections } from "@/pages/Terms";
import { previousTermsSections } from "@/pages/TermsPrevious";
import {
  ANNOUNCED_SUPERSEDED_VERSION, EARLIER_TERMS_VERSION, LEGAL_PAGE_DIGESTS, LEGAL_PAGE_DIGEST_VERSIONS, PREVIOUS_PRIVACY_VERSION, PREVIOUS_TERMS_VERSION,
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
  // pages of the sharing version were 2026-11-12.1, and are 2026-11-12.2 since the owner removed the limit on
  // introductions the same day.
  it("keeps the 2026-11-25.1 text, published ahead and replaced before it took effect, frozen as a record", () => {
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsAnnounced.tsx"].version).toBe("2026-11-25.1");
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyAnnounced.tsx"].version).toBe("2026-11-25.1");
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/Terms.tsx"].version).toBe("2026-11-12.2");
  });

  // Owner, 2026-11-12 (~21:45Z): "if they want to talk to 1 that should be fine if they want to go through the steps with 8
  // that should be fine". Version 2026-11-12.2 differs from 2026-11-12.1 by that one sentence and nothing else; the
  // text of 2026-11-12.1 is kept word for word at /terms/previous, and the 2026-11-02.1 page byte for byte as a record.
  it("2026-11-12.2 removes exactly one sentence of 2026-11-12.1; the money sentence stays word for word", () => {
    const LIMIT = " You can ask for up to three introductions for each job.";
    const previous = JSON.stringify(previousTermsSections), current = JSON.stringify(termsSections);
    expect(previous.split(LIMIT)).toHaveLength(2);
    expect(previous.replace(LIMIT, "")).toBe(current);
    expect(current).not.toMatch(/three introductions|up to three/);
    const MONEY = "Blueprint charges no fee for and takes no percentage of any pilot or deployment.";
    expect(previous).toContain(MONEY);
    expect(current).toContain(MONEY);
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsPrevious.tsx"].version).toBe("2026-11-12.1");
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsEarlier.tsx"]).toEqual({ version: "2026-11-02.1",
      sha256: "37a4885464a275f5236ed3dd0edee9b148bbeea9bdc80b6ab7f7b9a4dfb8d7bb" });
    // The Privacy Policy moved to 2026-11-12.2 with its text unchanged: the same file, the same digest as under 2026-11-12.1.
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/Privacy.tsx"]).toEqual({ version: "2026-11-12.2",
      sha256: "b4507322dc8b084a704689bae96c83704da9f885f24b1b0a19eee98e885b80bf" });
  });

  it("each digest was recorded against the version now in force for its page", () => {
    expect({ terms: TERMS_VERSION, privacy: PRIVACY_VERSION, previousTerms: PREVIOUS_TERMS_VERSION, previousPrivacy: PREVIOUS_PRIVACY_VERSION,
      announced: ANNOUNCED_SUPERSEDED_VERSION, earlierTerms: EARLIER_TERMS_VERSION },
      "a legal version changed without recording its page's new digest; a change needs a new version approved by the owner")
      .toEqual(LEGAL_PAGE_DIGEST_VERSIONS);
  });
});
