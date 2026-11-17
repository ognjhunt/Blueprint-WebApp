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
import { previousTermsSections as olderTermsSections } from "@/pages/TermsOlder";
import {
  ANNOUNCED_SUPERSEDED_VERSION, EARLIER_PRIVACY_VERSION, EARLIER_TERMS_VERSION, LEGAL_PAGE_DIGESTS, LEGAL_PAGE_DIGEST_VERSIONS, OLDER_PRIVACY_VERSION,
  OLDER_TERMS_VERSION, PREVIOUS_PRIVACY_VERSION, PREVIOUS_TERMS_VERSION, PRIVACY_VERSION, TERMS_VERSION,
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
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsPrevious.tsx"].version).toBe("2026-11-12.2");
  });

  // Owner, 2026-11-12 (~21:45Z): "if they want to talk to 1 that should be fine if they want to go through the steps with 8
  // that should be fine". Version 2026-11-12.2 differs from 2026-11-12.1 by that one sentence and nothing else. Since
  // 2026-11-17.1 the text of 2026-11-12.2 is at /terms/previous and the 2026-11-12.1 page is kept byte for byte at
  // `TermsOlder.tsx`, as the 2026-11-02.1 page is at `TermsEarlier.tsx`.
  it("2026-11-12.2 removes exactly one sentence of 2026-11-12.1; the money sentence stays word for word", () => {
    const LIMIT = " You can ask for up to three introductions for each job.";
    const previous = JSON.stringify(olderTermsSections), current = JSON.stringify(previousTermsSections);
    expect(previous.split(LIMIT)).toHaveLength(2);
    expect(previous.replace(LIMIT, "")).toBe(current);
    expect(current).not.toMatch(/three introductions|up to three/);
    const MONEY = "Blueprint charges no fee for and takes no percentage of any pilot or deployment.";
    expect(previous).toContain(MONEY);
    expect(current).toContain(MONEY);
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsOlder.tsx"]).toEqual({ version: "2026-11-12.1",
      sha256: "ccb2fb154ddab8e8c052c5870ca13084e461d4f2815c2eb8c7f5454ffbc12f27" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsEarlier.tsx"]).toEqual({ version: "2026-11-02.1",
      sha256: "37a4885464a275f5236ed3dd0edee9b148bbeea9bdc80b6ab7f7b9a4dfb8d7bb" });
    // The Privacy Policy moved to 2026-11-12.2 with its text unchanged; that text is now kept at `PrivacyOlder.tsx`.
  });

  // Owner decision 1 of 2026-11-13: Anthropic may process a site's job like OpenAI, for jobs started and requests sent
  // under the new version only. Privacy 2026-11-13.1 has three changes of substance: the Google Gemini row, the
  // Anthropic row and the "AI in the Service" paragraph. Every other row stays word for word, the DeepSeek row
  // included (the Paperclip operations agents in this repository still default to it). The Terms do not change at all
  // and keep their id 2026-11-12.2 (planner: nobody agrees again to text that did not change).
  // Since 2026-11-17.1 the 2026-11-13.1 text is at /privacy/previous and the 2026-11-12.2 page at `PrivacyOlder.tsx`.
  it("Privacy 2026-11-13.1 changes only two AI rows and the AI paragraph; nothing on the Terms pages changes", () => {
    const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
    const previous = read("client/src/pages/PrivacyOlder.tsx"), current = read("client/src/pages/PrivacyPrevious.tsx");
    const body = (source: string) => source.slice(source.indexOf("const SHARING_SENTENCE") === -1
      ? 0 : source.indexOf("SHARING_SENTENCE ="), source.indexOf("export default function"))
      .replace(/^export const /gm, "const ");
    const changes: Array<[string, string]> = [
      ['      ["Google Gemini", "Watching site footage, with its sound removed, and frames from it to draft and check the job brief and to find what the simulated scene needs"],\n',
        '      ["Google Gemini", "Watching site footage, with its sound removed, and frames from it, together with the job description, to draft and check the job brief and to find what the simulated scene needs"],\n'],
      ['      ["Anthropic", "Drafting the job brief from capture frames only when a site explicitly chooses that option, and drafting and sorting internal work where we configure it"],\n',
        '      ["Anthropic", "For jobs started and requests sent under this version of the policy or a later one, may read the job description and frames from a site capture to draft the job brief and prepare the simulated scene, draft replies, and sort incoming requests; for earlier jobs, drafting the job brief from capture frames only when a site explicitly chooses that option; and drafting and sorting internal work where we configure it"],\n'],
    ];
    let expected = body(previous);
    for (const [from, to] of changes) {
      expect(expected.split(from), from).toHaveLength(2);
      expected = expected.replace(from, to);
    }
    expect(body(current)).toBe(expected);
    const paragraph = (source: string) => source.slice(source.indexOf("<h2>AI in the Service</h2>"), source.indexOf("<h2>How long we keep it</h2>"));
    expect(paragraph(previous).replace(
      "By default that is OpenAI, with Google Gemini reviewing the footage;\n          Anthropic receives frames only when a site explicitly chooses that option. We also use the providers listed",
      "These are processed by OpenAI or, for jobs started and requests sent\n          under this version of the policy or a later one, by Anthropic, with Google Gemini reviewing the\n          footage; for an earlier job, Anthropic receives frames only when the site explicitly chose that option. We also\n          use the providers listed")).toBe(paragraph(current));
    // Everything after the AI paragraph is the same.
    const tail = (source: string) => source.slice(source.indexOf("<h2>How long we keep it</h2>"));
    expect(tail(current)).toBe(tail(previous));
    expect(current).not.toMatch(/Z\.ai|OpenRouter/);
    expect(current).toContain('["DeepSeek", "Drafting and sorting internal work, where we configure it"]');
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsOlder.tsx"]).toEqual({ version: "2026-11-12.1",
      sha256: "ccb2fb154ddab8e8c052c5870ca13084e461d4f2815c2eb8c7f5454ffbc12f27" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyOlder.tsx"]).toEqual({ version: "2026-11-12.2",
      sha256: "c2a859cb17b3b54629e4b88545a3c950e842f85c4a52d0a2652943fe749e895f" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyPrevious.tsx"].version).toBe("2026-11-13.1");
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyEarlier.tsx"]).toEqual({ version: "2026-11-02.1",
      sha256: "cad7fcac5cc1ec468ab74471a13a5e61a208b697deafd97b4039f01ab38eab3c" });
  });

  // Owner, 2026-11-17: "idc about face blurring - please find where this comes from and remove it." Terms and Privacy
  // 2026-11-17.1 change only the sentences on blurring; a job started under an earlier Privacy version keeps it. The
  // previous pages keep the text of Terms 2026-11-12.2 and Privacy 2026-11-13.1 word for word: only the page shell
  // (imports, the effective-date line, the note, the title and the names) differs, as it did for every previous page.
  it("the no-blur version changes only the sentences on blurring; the previous pages keep the text in force before it", () => {
    const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
    const EARLIER_JOB = "For a job started under an earlier version of this policy, we still blur faces in the frames we send to World Labs to rebuild the work area.";
    const NOT_BLURRED = "We do not remove people from job footage or blur them. Blueprint and the listed processing providers, World Labs included, receive the footage, with its sound removed, or frames from it as recorded, which can show people. " + EARLIER_JOB;
    const privacyChanges: Array<[string, string]> = [
      ["We do not remove people from job footage. We blur faces in the frames we send to World Labs to rebuild the work area; the other listed providers receive the footage, with its sound removed, or frames from it as recorded, which can show people, including hands or arms performing the job.", NOT_BLURRED],
      ["We do not remove people from job footage. We blur faces in the frames we send to World Labs to rebuild the work area; otherwise Blueprint and the listed processing providers process the footage, with its sound removed, and frames from it as recorded, for job review and building the simulation.", NOT_BLURRED],
      ["the frames and blurred copies we make from them", "the frames and any blurred copies we make from them"],
      ["Scratch files from rebuilding a scene or blurring footage that sit", "Scratch files from processing footage that sit"],
      ["Frames and blurred copies stored with the capture", "Frames and any blurred copies stored with the capture"],
      // "this version" meant 2026-11-13.1 when it was written; the new page names that version so the meaning stays.
      ['"For jobs started and requests sent under this version of the policy or a later one, may read',
        '"For jobs started and requests sent under the version of this policy effective November 13, 2026, or a later one, may read'],
    ];
    const paragraphChange: [string, string] = ["under this version of the policy or a later one, by Anthropic, with Google Gemini reviewing the\n          footage;",
      "under the version of this policy effective November 13, 2026, or a later one, by Anthropic, with Google Gemini\n          reviewing the footage;"];
    const shell = (source: string) => source.slice(source.indexOf("SHARING_SENTENCE ="), source.indexOf("export default function"))
      .replace(/^export const /gm, "const ");
    let expected = shell(read("client/src/pages/PrivacyPrevious.tsx"));
    for (const [from, to] of privacyChanges) {
      expect(expected.split(from), from).toHaveLength(2);
      expected = expected.replace(from, to);
    }
    const privacy = read("client/src/pages/Privacy.tsx");
    expect(shell(privacy)).toBe(expected);
    // Everything after the effective-date line and the note is the same, but for the AI paragraph's version name.
    const body = (source: string) => source.slice(source.indexOf("        This policy explains how"));
    expect(body(privacy).length).toBeGreaterThan(1000);
    expect(body(read("client/src/pages/PrivacyPrevious.tsx")).split(paragraphChange[0])).toHaveLength(2);
    expect(body(privacy)).toBe(body(read("client/src/pages/PrivacyPrevious.tsx")).replace(paragraphChange[0], paragraphChange[1]));
    const TERMS_FROM = "We do not remove people from the footage or from frames taken from it; we blur faces only in the frames we send to World Labs to rebuild the work area.";
    const TERMS_TO = "We do not remove people from the footage or from frames taken from it, and we do not blur them. For a job started under an earlier version of our Privacy Policy, we still blur faces in the frames we send to World Labs to rebuild the work area.";
    const previousTerms = JSON.stringify(previousTermsSections);
    expect(previousTerms.split(TERMS_FROM)).toHaveLength(2);
    expect(previousTerms.replace(TERMS_FROM, TERMS_TO)).toBe(JSON.stringify(termsSections));
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsPrevious.tsx"].version).toBe("2026-11-12.2");
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyPrevious.tsx"].version).toBe("2026-11-13.1");
    // The previous pages are today's pages before this change, word for word in their sections and copy.
    const previousPrivacy = read("client/src/pages/PrivacyPrevious.tsx");
    for (const [from] of privacyChanges) expect(previousPrivacy).toContain(from);
  });

  it("each digest was recorded against the version now in force for its page", () => {
    expect({ terms: TERMS_VERSION, privacy: PRIVACY_VERSION, previousTerms: PREVIOUS_TERMS_VERSION, previousPrivacy: PREVIOUS_PRIVACY_VERSION,
      olderTerms: OLDER_TERMS_VERSION, olderPrivacy: OLDER_PRIVACY_VERSION,
      announced: ANNOUNCED_SUPERSEDED_VERSION, earlierTerms: EARLIER_TERMS_VERSION, earlierPrivacy: EARLIER_PRIVACY_VERSION },
      "a legal version changed without recording its page's new digest; a change needs a new version approved by the owner")
      .toEqual(LEGAL_PAGE_DIGEST_VERSIONS);
  });
});
