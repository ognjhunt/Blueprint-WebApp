/**
 * The Terms and Privacy pages are pinned to their versions by a digest of each page's source file. Any byte change to a
 * page fails here until a new version, approved by the owner, is recorded with the new digest in `legalAcceptance.ts`.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { termsSections } from "@/pages/Terms";
import { previousTermsSections as terms19Sections } from "@/pages/TermsPrevious";
import { previousTermsSections as terms17Sections } from "@/pages/TermsOlder";
import { previousTermsSections as terms122Sections } from "@/pages/TermsFormer";
import { previousTermsSections as terms121Sections } from "@/pages/TermsPrior";
import {
  ANNOUNCED_SUPERSEDED_VERSION, EARLIER_PRIVACY_VERSION, EARLIER_TERMS_VERSION, FORMER_PRIVACY_VERSION, FORMER_TERMS_VERSION, LAUNCH_COPY_VERSION,
  LEGAL_PAGE_DIGESTS, LEGAL_PAGE_DIGEST_VERSIONS, NO_EARLY_TRIAL_VERSION, OLDER_PRIVACY_VERSION, OLDER_TERMS_VERSION, PREVIOUS_PRIVACY_VERSION,
  PREVIOUS_TERMS_VERSION, PRIOR_PRIVACY_VERSION, PRIOR_TERMS_VERSION, PRIVACY_VERSION, TERMS_VERSION, legalEffectiveDate,
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
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsFormer.tsx"].version).toBe("2026-11-12.2");
  });

  // Owner, 2026-11-12 (~21:45Z): "if they want to talk to 1 that should be fine if they want to go through the steps with 8
  // that should be fine". Version 2026-11-12.2 differs from 2026-11-12.1 by that one sentence and nothing else. Since
  // 2026-11-17.1 the text of 2026-11-12.2 was at /terms/previous and the 2026-11-12.1 page at `TermsOlder.tsx`; since
  // 2026-11-19.1 the 2026-11-12.2 page was kept byte for byte at `TermsOlder.tsx` and the 2026-11-12.1 page at
  // `TermsFormer.tsx`; since 2026-11-21.1 they are at `TermsFormer.tsx` and `TermsPrior.tsx`, as the 2026-11-02.1 page
  // is at `TermsEarlier.tsx`.
  it("2026-11-12.2 removes exactly one sentence of 2026-11-12.1; the money sentence stays word for word", () => {
    const LIMIT = " You can ask for up to three introductions for each job.";
    const previous = JSON.stringify(terms121Sections), current = JSON.stringify(terms122Sections);
    expect(previous.split(LIMIT)).toHaveLength(2);
    expect(previous.replace(LIMIT, "")).toBe(current);
    expect(current).not.toMatch(/three introductions|up to three/);
    const MONEY = "Blueprint charges no fee for and takes no percentage of any pilot or deployment.";
    expect(previous).toContain(MONEY);
    expect(current).toContain(MONEY);
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsPrior.tsx"]).toEqual({ version: "2026-11-12.1",
      sha256: "ccb2fb154ddab8e8c052c5870ca13084e461d4f2815c2eb8c7f5454ffbc12f27" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsEarlier.tsx"]).toEqual({ version: "2026-11-02.1",
      sha256: "37a4885464a275f5236ed3dd0edee9b148bbeea9bdc80b6ab7f7b9a4dfb8d7bb" });
    // The Privacy Policy moved to 2026-11-12.2 with its text unchanged; that text is now kept at `PrivacyPrior.tsx`.
  });

  // Owner decision 1 of 2026-11-13: Anthropic may process a site's job like OpenAI, for jobs started and requests sent
  // under the new version only. Privacy 2026-11-13.1 has three changes of substance: the Google Gemini row, the
  // Anthropic row and the "AI in the Service" paragraph. Every other row stays word for word, the DeepSeek row
  // included (the Paperclip operations agents in this repository still default to it). The Terms do not change at all
  // and keep their id 2026-11-12.2 (planner: nobody agrees again to text that did not change).
  // Since 2026-11-21.1 the 2026-11-13.1 page is kept byte for byte at `PrivacyFormer.tsx` and the 2026-11-12.2 page at
  // `PrivacyPrior.tsx`.
  it("Privacy 2026-11-13.1 changes only two AI rows and the AI paragraph; nothing on the Terms pages changes", () => {
    const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
    const previous = read("client/src/pages/PrivacyPrior.tsx"), current = read("client/src/pages/PrivacyFormer.tsx");
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
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsPrior.tsx"]).toEqual({ version: "2026-11-12.1",
      sha256: "ccb2fb154ddab8e8c052c5870ca13084e461d4f2815c2eb8c7f5454ffbc12f27" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyPrior.tsx"]).toEqual({ version: "2026-11-12.2",
      sha256: "c2a859cb17b3b54629e4b88545a3c950e842f85c4a52d0a2652943fe749e895f" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyFormer.tsx"].version).toBe("2026-11-13.1");
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyEarlier.tsx"]).toEqual({ version: "2026-11-02.1",
      sha256: "cad7fcac5cc1ec468ab74471a13a5e61a208b697deafd97b4039f01ab38eab3c" });
  });

  // Owner, 2026-11-17: "idc about face blurring - please find where this comes from and remove it." Terms and Privacy
  // 2026-11-17.1 change only the sentences on blurring; a job started under an earlier Privacy version keeps it. The
  // previous pages keep the text of Terms 2026-11-12.2 and Privacy 2026-11-13.1 word for word: only the page shell
  // (imports, the effective-date line, the note, the title and the names) differs, as it did for every previous page.
  // Since 2026-11-19.1 the 2026-11-17.1 pages were the previous pages and the pages before them were kept at `*Older.tsx`;
  // since 2026-11-21.1 the 2026-11-17.1 pages are at `*Older.tsx` and the pages before them at `*Former.tsx`.
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
      // "Our previous policy" meant 2026-10-13.1 when it was written (2026-10-16, beside the reissue 2026-11-15.2): the
      // version whose retention row said "180 days after the job closes". The new page names it by its effective date.
      ["Recordings collected under our previous policy keep its 180 days after the job closes schedule",
        "Recordings collected under the version of this policy effective October 13, 2026 keep its 180 days after the job closes schedule"],
      // "this version" meant 2026-11-13.1 when it was written; the new page names that version so the meaning stays.
      ['"For jobs started and requests sent under this version of the policy or a later one, may read',
        '"For jobs started and requests sent under the version of this policy effective November 13, 2026, or a later one, may read'],
    ];
    const paragraphChange: [string, string] = ["under this version of the policy or a later one, by Anthropic, with Google Gemini reviewing the\n          footage;",
      "under the version of this policy effective November 13, 2026, or a later one, by Anthropic, with Google Gemini\n          reviewing the footage;"];
    const shell = (source: string) => source.slice(source.indexOf("SHARING_SENTENCE ="), source.indexOf("export default function"))
      .replace(/^export const /gm, "const ");
    let expected = shell(read("client/src/pages/PrivacyFormer.tsx"));
    for (const [from, to] of privacyChanges) {
      expect(expected.split(from), from).toHaveLength(2);
      expected = expected.replace(from, to);
    }
    const privacy = read("client/src/pages/PrivacyOlder.tsx");
    expect(shell(privacy)).toBe(expected);
    // Everything after the effective-date line and the note is the same, but for the AI paragraph's version name.
    const body = (source: string) => source.slice(source.indexOf("        This policy explains how"));
    expect(body(privacy).length).toBeGreaterThan(1000);
    expect(body(read("client/src/pages/PrivacyFormer.tsx")).split(paragraphChange[0])).toHaveLength(2);
    expect(body(privacy)).toBe(body(read("client/src/pages/PrivacyFormer.tsx")).replace(paragraphChange[0], paragraphChange[1]));
    const TERMS_FROM = "We do not remove people from the footage or from frames taken from it; we blur faces only in the frames we send to World Labs to rebuild the work area.";
    const TERMS_TO = "We do not remove people from the footage or from frames taken from it, and we do not blur them. For a job started under an earlier version of our Privacy Policy, we still blur faces in the frames we send to World Labs to rebuild the work area.";
    const previousTerms = JSON.stringify(terms122Sections);
    expect(previousTerms.split(TERMS_FROM)).toHaveLength(2);
    expect(previousTerms.replace(TERMS_FROM, TERMS_TO)).toBe(JSON.stringify(terms17Sections));
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsFormer.tsx"].version).toBe("2026-11-12.2");
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyFormer.tsx"].version).toBe("2026-11-13.1");
    // The pages before it are the pages of 2026-11-13 before this change, word for word in their sections and copy.
    const previousPrivacy = read("client/src/pages/PrivacyFormer.tsx");
    for (const [from] of privacyChanges) expect(previousPrivacy).toContain(from);
  });

  // Owner: the early trial dropped on 2026-11-14; permission to update the Privacy Policy and Terms given on 2026-11-19.
  // Terms and Privacy 2026-11-19.1 remove every statement that Blueprint runs, keeps or shares an early trial or its
  // result, and change nothing else in meaning. The one other change names the version that "an earlier version" meant
  // in the blurring sentence, so a job started under 2026-11-17.1 is not read as blurred. Both are frozen pages since
  // 2026-11-21.1: 2026-11-19.1 at `*Previous.tsx`, 2026-11-17.1 at `*Older.tsx`; only the page shell differed when each
  // was frozen, so their sections compare as they did.
  it("the no-early-trial version removes only the early trial; the pages before it keep the 2026-11-17.1 text", () => {
    const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
    const SHARING_FROM = "the simulation we build from it, what counts as the job done, our first look at which robots fit, and the result of any early trial we run.";
    const SHARING_TO = "the simulation we build from it, what counts as the job done, and our first look at which robots fit.";
    const BLUR_FROM = "For a job started under an earlier version of this policy, we still blur faces";
    const BLUR_TO = "For a job started under a version of this policy published before November 17, 2026, we still blur faces";
    const privacyChanges: Array<[string, string, number]> = [
      [SHARING_FROM, SHARING_TO, 1],
      ["use the footage to draft the job brief, review the job, rebuild the work area as a simulated scene, and run our early trial.",
        "use the footage to draft the job brief, review the job, and rebuild the work area as a simulated scene.", 1],
      [BLUR_FROM, BLUR_TO, 2],
      ["draft the job brief, rebuild scenes, run our early trial, share each job", "draft the job brief, rebuild scenes, share each job", 1],
      ["The rebuilt scene, early trial results, the answers deployment companies gave", "The rebuilt scene, the answers deployment companies gave", 1],
    ];
    const shareParagraph: [string, string] = ["simulation, what counts as the job done, our first look and any early trial result, only so they can judge",
      "simulation, what counts as the job done and our first look, only so they can judge"];
    const shell = (source: string) => source.slice(source.indexOf("SHARING_SENTENCE ="), source.indexOf("export default function"))
      .replace(/^export const /gm, "const ");
    const previousPrivacy = read("client/src/pages/PrivacyOlder.tsx"), privacy = read("client/src/pages/PrivacyPrevious.tsx");
    let expected = shell(previousPrivacy);
    for (const [from, to, count] of privacyChanges) {
      expect(expected.split(from), from).toHaveLength(count + 1);
      expected = expected.split(from).join(to);
    }
    expect(shell(privacy)).toBe(expected);
    const body = (source: string) => source.slice(source.indexOf("        This policy explains how"));
    expect(body(privacy).length).toBeGreaterThan(1000);
    expect(body(previousPrivacy).split(shareParagraph[0])).toHaveLength(2);
    expect(body(privacy)).toBe(body(previousPrivacy).replace(shareParagraph[0], shareParagraph[1]));

    // The sharing sentence is a constant the sections use twice (sections 1 and 3); every other change is one sentence.
    const termsChanges: Array<[string, string, number]> = [
      [SHARING_FROM, SHARING_TO, 2],
      ["We rebuild the work area as a simulated scene and, where we can, run openly available robot software in that simulation ourselves as an early trial.",
        "We rebuild the work area as a simulated scene.", 1],
      ["A simulation or early trial result is a bounded estimate from a simulated scene.", "A simulation is a bounded estimate from a simulated scene.", 1],
      ["to draft the job brief, build the simulation and run our early trial.", "to draft the job brief and build the simulation.", 1],
      ["For a job started under an earlier version of our Privacy Policy, we still blur faces",
        "For a job started under a version of our Privacy Policy published before November 17, 2026, we still blur faces", 1],
      ["to review them, build the simulation, run our early trial, show you the results, and share your job",
        "to review them, build the simulation, show you the results, and share your job", 1],
      ["Submitting a job, building the simulation, our early trial and sharing your job with deployment companies cost the site nothing.",
        "Submitting a job, building the simulation and sharing your job with deployment companies cost the site nothing.", 1],
    ];
    let expectedTerms = JSON.stringify(terms17Sections);
    for (const [from, to, count] of termsChanges) {
      expect(expectedTerms.split(from), from).toHaveLength(count + 1);
      expectedTerms = expectedTerms.split(from).join(to);
    }
    expect(JSON.stringify(terms19Sections)).toBe(expectedTerms);
    // Nothing on the 2026-11-19.1 pages says Blueprint runs, keeps or shares an early trial.
    for (const text of [privacy, read("client/src/pages/TermsPrevious.tsx")]) expect(text).not.toMatch(/early trial|robot software/i);

    expect([PREVIOUS_TERMS_VERSION, PREVIOUS_PRIVACY_VERSION]).toEqual([NO_EARLY_TRIAL_VERSION, NO_EARLY_TRIAL_VERSION]);
    expect([OLDER_TERMS_VERSION, OLDER_PRIVACY_VERSION]).toEqual(["2026-11-17.1", "2026-11-17.1"]);
    expect(legalEffectiveDate(PREVIOUS_TERMS_VERSION)).toBe("November 19, 2026");
    expect(legalEffectiveDate(PREVIOUS_PRIVACY_VERSION)).toBe("November 19, 2026");
  });

  // Owner, 2026-11-21: the launch-copy legal edits approved. Terms and Privacy 2026-11-21.1 correct both documents to what
  // the Service already does: the questions after an introduction (14, 45 and 90 days), the answer labels, "job" and
  // "job description", a company's reason a site reads, where a site withdraws, and when a job is shared; they drop the
  // refund and pre-beta balance clauses, filming visits, the phone line and voice assistant, restricted areas a site
  // marks, and the "review" and "evaluation" words. Every change is listed here; nothing else moves. The retention row
  // for site footage (g-003) and the money sentence (g-018) are held word for word. The previous pages keep the
  // 2026-11-19.1 text word for word: only the page shell differs, as for every previous page.
  it("the launch-copy version makes exactly the approved changes; the previous pages keep the 2026-11-19.1 text", () => {
    const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");
    const SHARING_FROM = "Starting a job means we share it with robot deployment companies we've approved, so they can judge it without a visit.";
    const SHARING_TO = "Starting a job means that, once it has its video, we share it with robot deployment companies we've approved, so they can decide without a visit whether they can do it.";
    const WITHDRAW_FROM = "You can withdraw your job at any time. It then leaves every company's view at once";
    const WITHDRAW_TO = "You can withdraw your job at any time from its page. It then leaves every company's view at once";
    const OLDER_FROM = "A job started before 12 November 2026 is not shown to companies unless you accept the current statement on its page.";
    const OLDER_TO = "A job started before November 12, 2026 is shared with companies only after you agree to share it on the job's page.";
    const ALIAS_FROM = "A site sees your answer under an alias. It sees";
    const ALIAS_TO = "A site sees your answer and the reason you give, under an alias, with your company's name and contact details taken out. It sees";
    const termsChanges: Array<[string, string, number]> = [
      [SHARING_FROM, SHARING_TO, 2], [WITHDRAW_FROM, WITHDRAW_TO, 1], [OLDER_FROM, OLDER_TO, 1], [ALIAS_FROM, ALIAS_TO, 1],
      ["can correct the short job brief we draft from the video.", "can correct the job description we draft from the video.", 1],
      [" We rebuild the work area as a simulated scene. Deployment companies do not run their own software on a site's job in our simulation.",
        " Blueprint does not test any robot in the simulation. Once the simulation can be downloaded, a deployment company may test its own robot in it, using its own tools.", 1],
      ["A deployment company we approved can answer: interested, not a fit, would need something, tested it: can do, or tested it: cannot yet.",
        "An approved deployment company can answer Interested, Not a fit or Need more details. Once the simulation can be downloaded, it can also answer Tested it: can do or Tested it: cannot yet.", 1],
      ["A simulation is a bounded estimate from a simulated scene.", "A simulation is a bounded estimate.", 1],
      ["The deployment company remains responsible for installation and operation; the site and responsible delivery parties approve the safety plan. Blueprint may record agreed pilot outcomes under the parties' permissions.",
        "The deployment company is responsible for installation and operation, and the site and the others responsible for the work approve the safety plan. After an introduction, we ask both sides what happened, up to three times (14, 45 and 90 days later), and record their answers on the job.", 1],
      ["When you start a capture with footage, you confirm", "When you send a video, you confirm", 1],
      ["Task footage may show people, including hands or arms performing the task,", "Job footage may show people, including hands or arms doing the job,", 1],
      ["and with the robot deployment companies we approve, and obtain any permission the law",
        "and with the robot deployment companies we approve. Get any permission the law", 1],
      ["to draft the job brief and build the simulation.", "to draft the job description and build the simulation.", 1],
      ["to review them, build the simulation, show you the results, and share your job",
        "to make the job packet and the simulation, show you companies' responses, and share your job", 1],
      ["\"Submitting a job, building the simulation and sharing your job with deployment companies cost the site nothing. There is no Blueprint fee, invoice or payment step for the site.\"",
        "\"Free for sites.\"", 1],
      ["\"If a deployment company withdraws or changes its proposed scope before agreement, Blueprint helps review suitable alternatives. A replacement needs its own evidence and your approval. Blueprint charges no fee during the beta, so there is no fee to refund. To ask for a replacement, contact hello@tryblueprint.io with your job link.\"",
        "\"If a company you were introduced to drops out, you can ask for an introduction to another company that answered Interested or Tested it: can do.\"", 1],
      ["{\"title\":\"4. Earlier filming visits\",\"paragraphs\":[\"Blueprint no longer films jobs in person. Video from an earlier Blueprint filming visit is handled exactly like video a site uploads itself: the same license, privacy commitments and rights apply, and the job is shared only as section 3 describes.\"]},", "", 1],
      ...([[5, "For deployment companies"], [6, "Acceptable use"], [7, "Ownership"], [8, "Disclaimers"], [9, "Limitation of liability"],
        [10, "Indemnity"], [11, "Suspension and termination"], [12, "Changes to these Terms"], [13, "Governing law and general terms"]] as const)
        .map(([n, name]): [string, string, number] => [`"${n}. ${name}"`, `"${n - 1}. ${name}"`, 1]),
      ["and can answer each one: interested, not a fit, would need something, tested it: can do, or tested it: cannot yet.\"",
        "and can answer each one: Interested, Not a fit or Need more details. Once a job's simulation can be downloaded, it can also answer Tested it: can do or Tested it: cannot yet.\"", 1],
      ["\"Blueprint does not charge deployment companies today.\"", "\"Nothing is charged today.\"", 1],
      [",\"The beta has no paid private evaluations, balances, top-ups or checkout. Balances bought before the free beta, ledger records and historical results are preserved under their original sharing restrictions.\",\"You can ask for a refund of any unused balance bought before the free beta by writing to hello@tryblueprint.io from your account email. Existing refund and settlement terms continue to apply to those prior purchases.\"", "", 1],
      ["and the scenes, simulation assets and reports we create,", "and the simulations, their files and the reports we create,", 1],
      [" If we end the Service for a reason other than your breach, we refund any unused balance bought before the free beta. Sections 3 (license for completed work), 7, 8, 9, 10 and 13 survive termination.",
        " The license in section 3 for jobs you already sent, and sections 6, 7, 8, 9 and 12, survive termination.", 1],
      ["We will post the new version here with its effective date, and tell account holders about material changes by email before they take effect. Continuing to use the Service after that means you accept the updated Terms.",
        "We post each new version here with its effective date, and email account holders before a material change takes effect. A change that asks something new of you applies to you only once you agree to it.", 1],
      ["together with any order form or written agreement you sign with us,", "together with any written agreement you sign with us,", 1],
    ];
    let expectedTerms = JSON.stringify(terms19Sections);
    for (const [from, to, count] of termsChanges) {
      expect(expectedTerms.split(from), from).toHaveLength(count + 1);
      expectedTerms = expectedTerms.split(from).join(to);
    }
    expect(JSON.stringify(termsSections)).toBe(expectedTerms);
    const termsText = JSON.stringify(termsSections);
    // Held word for word (owner, 2026-11-21).
    expect(termsText).toContain("Blueprint charges no fee for and takes no percentage of any pilot or deployment.");
    // Section 11 (12 before) is the section that promises account holders an email before a material change.
    expect(termsSections.find(section => section.title === "11. Changes to these Terms")?.paragraphs?.[0])
      .toMatch(/email account holders before a material change takes effect/);

    const privacyChanges: Array<[string, string, number]> = [
      [SHARING_FROM, SHARING_TO, 1], [WITHDRAW_FROM, WITHDRAW_TO, 1], [OLDER_FROM, OLDER_TO, 1], [ALIAS_FROM, ALIAS_TO, 1],
      ["your answers to the job brief; account details; and messages you send us. If a site",
        "your answers to our questions about the job; account details; and messages you send us. After an introduction, we ask the site and the deployment company what happened, and keep their answers. If a site", 1],
      ["Blueprint takes no payments during the beta; Stripe holds the records of payments made before it.", "Nothing is charged today; Stripe holds the records of payments made before the free beta.", 1],
      ["and errors the site runs into.", "and errors the website runs into.", 1],
      ["use the footage to draft the job brief, review the job, and rebuild the work area as a simulated scene.",
        "use the footage to draft and check the job description and to build the simulation.", 1],
      ["To run the Service: to reply to you, set up your job or account, draft the job brief, rebuild scenes, share each job with the deployment companies we approve, make the introductions a site asks for, record physical-pilot outcomes only under the parties' agreed permissions, send the emails you need (such as a job update or a company's answer), keep the Service secure and prevent fraud, understand how the site is used so we can improve it, and meet our legal obligations.",
        "To run the Service: to reply to you; to set up your job or account; to draft the job description and build the simulation; to share each job with the deployment companies we approve; to make the introductions a site asks for and ask both sides afterwards what happened; to record a physical pilot's outcomes only under the parties' agreed permissions; to send the emails you need, such as a job update or a company's answer; to keep the Service secure and prevent fraud; to see how the website is used so we can improve it; and to meet our legal obligations.", 1],
      ["  // approves, only so they can judge the job. Name, address and contacts go only through an introduction the site asks for.",
        "  // approves, only so they can decide whether they can do the job. Name, address and contacts go only through an introduction\n  // the site asks for.", 1],
      ["Your recording is used inside Blueprint to draft the job brief, review the job and rebuild the work area. It is shared, without its sound, only with the robot deployment companies we approve, and only so they can judge the job.",
        "We and our listed providers use your recording to draft and check the job description and to build the simulation. It is shared, without its sound, only with the robot deployment companies we approve, and only so they can decide whether they can do the job.", 1],
      ["Used to tie a result to the right site, and to keep restricted areas you mark out of the scene.", "Used to tie the job to the right site.", 1],
      ["[\"Physical pilot records\", \"If the site and the deployment company agree to share pilot outcomes with Blueprint, those permissions set what operating records we receive, who may see them, and the permitted uses. A simulation result does not become a physical result without actual trial evidence.\"]",
        "[\"After an introduction\", \"We ask the site and the deployment company what happened, up to three times (14, 45 and 90 days after the introduction), and record their answers on the job. If the site and the company also agree to share a pilot's records with us, that agreement sets what we receive, who may see it and how it may be used.\"]", 1],
      [" Results and records from before the free beta keep their original sharing restrictions.", "", 1],
      ["the job brief, your footage, the areas you mark as restricted, the answers deployment companies gave and the introductions you asked for.",
        "the job description, your footage, the answers deployment companies gave, the introductions you asked for and what each side told us happened after.", 1],
      ["record: \"Scenes, evaluation results, pilot records and reports\"", "record: \"Simulations, company answers, introductions and reports\"", 1],
      ["The rebuilt scene, the answers deployment companies gave, introductions and reports. Physical pilot measurements are included",
        "The simulation, the answers deployment companies gave, introductions, what each side told us happened after, and reports. Physical pilot records are included", 1],
      ["[\"Twilio\", \"Calls to our phone line, including the caller's number and what they say or key in, and text messages that send a filming link to a phone number you give us\"],\n      [\"ElevenLabs\", \"Speaking our voice assistant's replies and, if you talk to the assistant, processing that conversation\"],",
        "[\"Twilio\", \"Text messages that send a filming link to a phone number you give us\"],", 1],
      ["\"Reading the job description and frames from a site capture to draft the job brief and prepare the simulated scene, drafting replies, and sorting incoming requests\"",
        "\"Reading what the site wrote about the job and frames from its video to draft the job description and prepare the simulation, drafting replies, and sorting incoming requests\"", 1],
      ["together with the job description, to draft and check the job brief and to find what the simulated scene needs\"",
        "together with what the site wrote about the job, to draft and check the job description and to find what the simulation needs\"", 1],
      ["with its sound removed, to prepare the simulated scene\"", "with its sound removed, to prepare the simulation\"", 1],
      ["\"For jobs started and requests sent under the version of this policy effective November 13, 2026, or a later one, may read the job description and frames from a site capture to draft the job brief and prepare the simulated scene, draft replies, and sort incoming requests; for earlier jobs, drafting the job brief from capture frames only when a site explicitly chooses that option; and drafting and sorting internal work where we configure it\"",
        "\"May read what the site wrote about the job and frames from its video to draft the job description and prepare the simulation, draft replies, and sort incoming requests, for jobs started and requests sent under the version of this policy effective November 13, 2026, or a later one. For earlier jobs: only drafting the job description from video frames, when the site chose that option. Also drafting and sorting internal work where we configure it\"", 1],
      ["\"Cloud GPU servers that rebuild scenes and run simulated evaluations\"", "\"Cloud GPU servers that build and check simulations\"", 1],
    ];
    const bodyChanges: Array<[string, string]> = [
      ["      <section>\n        <h2>Earlier filming visits</h2>\n        <p>Video from an earlier Blueprint filming visit is handled like uploaded video.</p>\n      </section>\n\n", ""],
      ["because the site does not work without them.", "because the website does not work without them."],
      ["works. Both are off until you allow them,\n          and neither is pre-selected. Google Analytics, PostHog and optional analytics events sent to our own servers\n          stay off until you allow the corresponding category. Session recording is disabled. Necessary service and\n          security requests still run. If your browser sends a Global Privacy Control signal, we keep both off unless you\n          turn them on yourself.",
        "works. Google Analytics, PostHog and\n          optional analytics events sent to our own servers stay off until you allow the corresponding category, and\n          neither category is pre-selected. We do not record sessions. If your browser sends a Global Privacy Control\n          signal, we keep both off unless you turn them on yourself."],
      ["They receive it as the job&rsquo;s\n          recipients, not as our providers: the site&rsquo;s description of the job, its video without its sound, the\n          simulation, what counts as the job done and our first look, only so they can judge\n          the job. A site&rsquo;s name, address and contact details go to a company only when the site asks for an introduction\n          to it, and the site then receives the company&rsquo;s name and contact details.",
        "They receive the site&rsquo;s\n          description of the job, its video without its sound, the simulation, what counts as the job done and our first\n          look, only to decide whether they can do the job. They are not our providers. A site&rsquo;s name, address and\n          contact details go to a company only when the site asks for an introduction to it, and the site then receives\n          the company&rsquo;s name and contact details."],
      ["          Frames from a site capture, together with the job description, are processed by AI model providers acting as\n          our sub-processors to draft the job brief. These are processed by OpenAI or, for jobs started and requests sent\n          under the version of this policy effective November 13, 2026, or a later one, by Anthropic, with Google Gemini\n          reviewing the footage; for an earlier job, Anthropic receives frames only when the site explicitly chose that option. We also\n          use the providers listed\n          above to rebuild scenes and sort incoming requests. We send each provider only what the step needs, footage\n          goes to them with its sound removed, the provider may not use it for its own purposes, and we do not give any\n          of them your footage as training data.",
        "          AI providers working for us read frames from a site&rsquo;s video, with what the site wrote about the job, to\n          draft the job description. That is OpenAI, or Anthropic for jobs started and requests sent under the version of\n          this policy effective November 13, 2026, or a later one, with Google Gemini checking the footage. For an earlier\n          job, Anthropic receives frames only if the site chose that option. We also use the providers listed above to\n          build simulations and sort incoming requests. Each provider gets only what its step needs and receives footage\n          without its sound. No provider may use it for its own purposes, and none receives your footage as training data."],
      ["          To request deletion of your account and personal data, open <a href=\"/settings?privacy=1\">account deletion in Settings</a>.\n          You can view your request reference and status there. Submitting the request starts our review; it does not mean\n          your account is already closed or every copy is erased. We review site and company records, provider copies,\n          backups and any required retention before confirming the outcome. You can also email us, including if you cannot sign in.",
        "          To delete your account and personal data, open <a href=\"/settings?privacy=1\">account deletion in Settings</a>, where\n          you can follow your request. Deletion is not immediate: we first check your jobs or company records, copies our\n          providers hold and backups, then confirm what we deleted and anything we must keep. If you have no account or\n          cannot sign in, email us."],
    ];
    const shell = (source: string) => source.slice(source.indexOf("SHARING_SENTENCE ="), source.indexOf("export default function"))
      .replace(/^export const /gm, "const ");
    const previousPrivacy = read("client/src/pages/PrivacyPrevious.tsx"), privacy = read("client/src/pages/Privacy.tsx");
    let expected = shell(previousPrivacy);
    for (const [from, to, count] of privacyChanges) {
      expect(expected.split(from), from).toHaveLength(count + 1);
      expected = expected.split(from).join(to);
    }
    expect(shell(privacy)).toBe(expected);
    const body = (source: string) => source.slice(source.indexOf("        This policy explains how"));
    expect(body(privacy).length).toBeGreaterThan(1000);
    let expectedBody = body(previousPrivacy);
    for (const [from, to] of bodyChanges) {
      expect(expectedBody.split(from), from).toHaveLength(2);
      expectedBody = expectedBody.replace(from, to);
    }
    expect(body(privacy)).toBe(expectedBody);
    // What left stays gone, on both current pages. (The Privacy Policy keeps Stripe's records of payments made before
    // the free beta, refunds included: no decision moved that row.)
    for (const text of [privacy, read("client/src/pages/Terms.tsx")]) {
      expect(text).not.toMatch(/early trial|robot software|unused balance|filming visit|phone line|voice assistant|ElevenLabs|mark as restricted|you mark out|job brief|simulated evaluation|order form/i);
    }
    expect(read("client/src/pages/Terms.tsx")).not.toMatch(/refund/i);

    expect(TERMS_VERSION).toBe(LAUNCH_COPY_VERSION);
    expect(PRIVACY_VERSION).toBe(LAUNCH_COPY_VERSION);
    expect([PREVIOUS_TERMS_VERSION, PREVIOUS_PRIVACY_VERSION]).toEqual(["2026-11-19.1", "2026-11-19.1"]);
    expect(legalEffectiveDate(TERMS_VERSION)).toBe("November 21, 2026");
    expect(legalEffectiveDate(PRIVACY_VERSION)).toBe("November 21, 2026");
    // The pages that moved are kept byte for byte: their digests are the ones they had before the move.
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsOlder.tsx"]).toEqual({ version: "2026-11-17.1",
      sha256: "cb7276aa54fa2044a391900ce89ac1a23c64a0a088bbc7b2de4104390d6135c9" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyOlder.tsx"]).toEqual({ version: "2026-11-17.1",
      sha256: "dd1cf7021b9bcd521dd82d75051649d6a1ec176580d74f22b3870cb9de8db229" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsFormer.tsx"]).toEqual({ version: "2026-11-12.2",
      sha256: "6370c9c16803d758afa2348c619f300747ee20e66fb420ff5cd88fd29256b231" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyFormer.tsx"]).toEqual({ version: "2026-11-13.1",
      sha256: "cc64b063dc906beb69ba2e7ddcdd02cadaf2e27e86c0b59157478cc038eb8099" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/TermsPrior.tsx"]).toEqual({ version: "2026-11-12.1",
      sha256: "ccb2fb154ddab8e8c052c5870ca13084e461d4f2815c2eb8c7f5454ffbc12f27" });
    expect(LEGAL_PAGE_DIGESTS["client/src/pages/PrivacyPrior.tsx"]).toEqual({ version: "2026-11-12.2",
      sha256: "c2a859cb17b3b54629e4b88545a3c950e842f85c4a52d0a2652943fe749e895f" });
  });

  it("each digest was recorded against the version now in force for its page", () => {
    expect({ terms: TERMS_VERSION, privacy: PRIVACY_VERSION, previousTerms: PREVIOUS_TERMS_VERSION, previousPrivacy: PREVIOUS_PRIVACY_VERSION,
      olderTerms: OLDER_TERMS_VERSION, olderPrivacy: OLDER_PRIVACY_VERSION, formerTerms: FORMER_TERMS_VERSION, formerPrivacy: FORMER_PRIVACY_VERSION,
      priorTerms: PRIOR_TERMS_VERSION, priorPrivacy: PRIOR_PRIVACY_VERSION, announced: ANNOUNCED_SUPERSEDED_VERSION, earlierTerms: EARLIER_TERMS_VERSION, earlierPrivacy: EARLIER_PRIVACY_VERSION },
      "a legal version changed without recording its page's new digest; a change needs a new version approved by the owner")
      .toEqual(LEGAL_PAGE_DIGEST_VERSIONS);
  });
});
