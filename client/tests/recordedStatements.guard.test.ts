/**
 * Every statement a person agrees to, pinned to its version. Wording someone agreed to keeps its exact text under its
 * version; only the owner approves a new version. A change to any text below without a new version (and the owner's
 * approval) fails here. Added 2026-11-12, after a rewording of the optional-updates opt-in under its old version
 * (`optional-updates-v1`) slipped into a pull request.
 *
 * To change a statement: add a new version beside the old one, keep the old text for records made under it, and
 * update this table in the same change, with the owner's approval recorded in the pull request.
 */
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  RECORDING_RIGHTS_STATEMENT, RECORDING_RIGHTS_STATEMENT_SHORT, RECORDING_RIGHTS_STATEMENT_V4, RECORDING_RIGHTS_STATEMENT_V6, RECORDING_RIGHTS_STATEMENT_VERSIONS,
} from "@/lib/recordingRightsStatement";
import { COMPANY_RESPONSE_STATEMENT, COMPANY_RESPONSE_STATEMENT_VERSION, COMPANY_RESPONSE_STATEMENT_VERSIONS, COMPANY_RESPONSE_STATEMENT_2026_11_12, COMPANY_RESPONSE_STATEMENT_2026_11_12_VERSION, COMPANY_RESPONSE_STATEMENT_2026_11_23, COMPANY_RESPONSE_STATEMENT_2026_11_23_VERSION } from "@/lib/companyResponses";
import { INTRODUCTION_REQUEST_STATEMENT, INTRODUCTION_REQUEST_STATEMENT_VERSION, INTRODUCTION_REQUEST_STATEMENT_2026_11_12,
  INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION, INTRODUCTION_REQUEST_STATEMENT_VERSIONS, introduceSentence } from "@/lib/siteIntroductions";
import { DESCRIPTION_AUTHORITY_STATEMENTS, DESCRIPTION_AUTHORITY_VERSIONS } from "@/lib/siteSubmissionAuthority";
import { TASK_CONFIRMATION_STATEMENTS, TASK_CONFIRMATION_VERSIONS } from "@/lib/taskConfirmationStatement";
import { CURRENT_UPDATE_PREFERENCES_VERSION } from "@/types/updatePreferences";
import { JOB_CARD_ANSWER_STATEMENTS, JOB_CARD_ANSWER_STATEMENT_VERSIONS } from "@/lib/jobCardAnswerConsent";
import { SITE_START_CONSENT_NO_VIDEO, SITE_START_CONSENT_NO_VIDEO_V5, SITE_START_CONSENT_WITH_VIDEO, SITE_START_CONSENT_WITH_VIDEO_V4, SITE_START_CONSENT_WITH_VIDEO_V6 } from "@/lib/siteStartConsent";

const ROOT = path.resolve(import.meta.dirname, "../..");
const sourceText = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\s+/g, " ");

/** Statements held as constants: version → exact text, written out here so a change to either fails. */
const CONSTANT_STATEMENTS = [
  { name: "recording rights", version: "2026-11-02.v2", actual: RECORDING_RIGHTS_STATEMENT, text: "I am authorized to record this site and to let Blueprint use the recording to draft the job brief, build a simulation of the work area and run candidate robot policies in it." },
  { name: "recording rights, short", version: "2026-11-11.v3", actual: RECORDING_RIGHTS_STATEMENT_SHORT, text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site." },
  { name: "start form, with video", version: "2026-11-11.v3", actual: SITE_START_CONSENT_WITH_VIDEO, text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site." },
  { name: "start form, no video", version: "2026-11-11.v3", actual: SITE_START_CONSENT_NO_VIDEO, text: "By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site." },
  { name: "task confirmation", version: "2026-11-07.v1", actual: TASK_CONFIRMATION_STATEMENTS["2026-11-07.v1"], text: "This is the task I want Blueprint to evaluate." },
  // Launch copy (owner approval in the consent pull request): says job, and what happens to it.
  { name: "task confirmation", version: "2026-11-21.v2", actual: TASK_CONFIRMATION_STATEMENTS["2026-11-21.v2"], text: "This is the job I want deployment companies to look at." },
  { name: "description authority", version: "2026-10-06.v1", actual: DESCRIPTION_AUTHORITY_STATEMENTS["2026-10-06.v1"], text: "I am authorized to share this job description with Blueprint on behalf of the site." },
  { name: "description authority", version: "2026-11-11.v2", actual: DESCRIPTION_AUTHORITY_STATEMENTS["2026-11-11.v2"], text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site." },
  { name: "description authority", version: "2026-11-11.v3", actual: DESCRIPTION_AUTHORITY_STATEMENTS["2026-11-11.v3"], text: "By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site." },
  // Sharing is the service (owner, 2026-11-12; PACKAGE_D D1.1): one sentence, one version, on the start form with a video
  // and on a job's page (a job started without a video, or under an older statement).
  { name: "recording rights, shares the job", version: "2026-11-12.v4", actual: RECORDING_RIGHTS_STATEMENT_V4, text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. We share your job, including this video and the simulation we build from it, with robot deployment companies we've approved." },
  { name: "start form, with video, shares the job", version: "2026-11-12.v4", actual: SITE_START_CONSENT_WITH_VIDEO_V4, text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. We share your job, including this video and the simulation we build from it, with robot deployment companies we've approved." },
  { name: "start form, no video, shares the job", version: "2026-11-12.v5", actual: SITE_START_CONSENT_NO_VIDEO_V5, text: "By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site. We share your job with robot deployment companies we've approved." },
  { name: "description authority", version: "2026-11-12.v4", actual: DESCRIPTION_AUTHORITY_STATEMENTS["2026-11-12.v4"], text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. We share your job, including this video and the simulation we build from it, with robot deployment companies we've approved." },
  { name: "description authority", version: "2026-11-12.v5", actual: DESCRIPTION_AUTHORITY_STATEMENTS["2026-11-12.v5"], text: "By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site. We share your job with robot deployment companies we've approved." },
  // The place a company sees (owner, 2026-11-23: "city and state, yes to the wording"): the sharing sentence names the
  // city and state, on the start form with a video, on a job's page and on the upload page. v4 stays for its records.
  { name: "recording rights, shares the job with its city and state", version: "2026-11-23.v6", actual: RECORDING_RIGHTS_STATEMENT_V6, text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. We share your job, including this video, the simulation we build from it and the city and state it is in, with robot deployment companies we've approved." },
  { name: "start form, with video, shares the job with its city and state", version: "2026-11-23.v6", actual: SITE_START_CONSENT_WITH_VIDEO_V6, text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. We share your job, including this video, the simulation we build from it and the city and state it is in, with robot deployment companies we've approved." },
  { name: "description authority", version: "2026-11-23.v6", actual: DESCRIPTION_AUTHORITY_STATEMENTS["2026-11-23.v6"], text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. We share your job, including this video, the simulation we build from it and the city and state it is in, with robot deployment companies we've approved." },
  // A deployment company's answer (PACKAGE_E E5), recorded on every answer.
  { name: "company response", version: "company-response-2026-11-12", actual: COMPANY_RESPONSE_STATEMENT_2026_11_12_VERSION === "company-response-2026-11-12" ? COMPANY_RESPONSE_STATEMENT_2026_11_12 : "", text: "The site is told your answer. If you answer Interested or Tested it: can do and the site asks for an introduction, we give the site your company's name and your contact details, and give you theirs." },
  // Owner, 2026-11-23: a company applies, and the site sees its name and website with the answer and accepts.
  { name: "company response (applicants)", version: "company-response-2026-11-23", actual: COMPANY_RESPONSE_STATEMENT_2026_11_23_VERSION === "company-response-2026-11-23" ? COMPANY_RESPONSE_STATEMENT_2026_11_23 : "", text: "The site sees your company's name and website with your answer. If you apply or answer Tested it: can do and the site accepts, we give the site your contact details, and give you theirs." },
  // Owner, 2026-11-23 ("yes build it this way"): an application may carry an estimate, shown as one before a site visit.
  { name: "company response (estimate)", version: "company-response-2026-11-23.2", actual: COMPANY_RESPONSE_STATEMENT_VERSION === "company-response-2026-11-23.2" ? COMPANY_RESPONSE_STATEMENT : "", text: "The site sees your company's name and website with your answer, and any estimate you give, as an estimate before a site visit, not a quote. If you apply or answer Tested it: can do and the site accepts, we give the site your contact details, and give you theirs." },
  // The site's agreement beside "Introduce us" (planner, 2026-11-12, 18:25Z): the recorded text is the template.
  { name: "introduction request", version: "introduction-request-2026-11-12",
    actual: INTRODUCTION_REQUEST_STATEMENT_2026_11_12_VERSION === "introduction-request-2026-11-12" ? INTRODUCTION_REQUEST_STATEMENT_2026_11_12 : "",
    text: "We give {alias} your name, address and contact details, and give you theirs." },
  // 2026-11-24 (truthfulness): the start form asks for no name and only a city or region, so the sentence says what the
  // company is given. The 2026-11-12 one stays for its records and for a job whose record holds a name the site gave.
  { name: "introduction request (email and place)", version: "introduction-request-2026-11-24",
    actual: INTRODUCTION_REQUEST_STATEMENT_VERSION === "introduction-request-2026-11-24" ? INTRODUCTION_REQUEST_STATEMENT : "",
    text: "We give {alias} your email address and the place you gave us, and give you theirs." },
  // Records only since 2026-11-12: no surface shows or records them any more ("Share my job" is gone).
  { name: "share my job", version: "public-task-card-with-answer-v3", actual: JOB_CARD_ANSWER_STATEMENTS["public-task-card-with-answer-v3"], text: "Shares a summary of your job and your answer, including later test results, without saying who you are, with companies we've approved. Your video, address and contacts stay private." },
  { name: "share my job", version: "public-task-card-with-answer-v2", actual: JOB_CARD_ANSWER_STATEMENTS["public-task-card-with-answer-v2"], text: "Shares a summary of your job and this answer, without saying who you are, with companies we've approved. Your video, address and contacts stay private." },
  { name: "share my job", version: "public-task-card-with-answer-v1", actual: JOB_CARD_ANSWER_STATEMENTS["public-task-card-with-answer-v1"], text: "This shares an anonymised summary of your job and this answer with deployment companies Blueprint has approved. Your video, address and contacts stay private." },
];

/**
 * Statements written inline where a person ticks a box or reads what they agree to: version → file → the element that
 * carries the statement (`tag`) → its whole visible text, whitespace collapsed. The comparison is exact, so a changed
 * word and an appended sentence both fail. A `{expression}` child renders as `{…}`.
 */
const INLINE_STATEMENTS: Array<{ version: string; file: string; tag: string; text: string }> = [
  // v3 (launch copy, owner approval in the consent pull request): the Settings switch says what it sends. The
  // application's and the sign-up's "Blueprint updates" boxes were removed on 2026-11-23 (owner): RETIRED below.
  { version: "optional-updates-v1", file: "client/src/components/workspace/UpdatePreferencesForm.tsx", tag: "label", text: "Blueprint news and updates" },
  { version: "optional-updates-v2", file: "client/src/components/workspace/UpdatePreferencesForm.tsx", tag: "label", text: "Blueprint news and updates" },
  { version: "optional-updates-v3", file: "client/src/components/workspace/UpdatePreferencesForm.tsx", tag: "label", text: "Blueprint news and updates" },
  { version: "optional-updates-v3", file: "client/src/components/workspace/UpdatePreferencesForm.tsx", tag: "label", text: "Email me about each new job" },
  { version: "2026-09-24.v1", file: "client/src/components/site/SiteCaptureStart.tsx", tag: "BareCheck",
    text: "For this development test, I authorize Blueprint to send selected frames and task evidence from this recording to Anthropic for Claude Opus 5.5 3D authoring. Blueprint pays the bounded provider cost; this does not train a model on my recording. See Anthropic’s commercial API terms." },
  { version: "2026-09-24.v1", file: "client/src/components/site/SiteCaptureStart.tsx", tag: "BareCheck",
    text: "For this development test, I authorize Blueprint to send selected frames and task evidence to OpenAI for GPT-6.1 Sol managed-agent 3D authoring. The agent session can retain that evidence until it is deleted under the configured provider policy. Blueprint pays the bounded provider cost." },
  // v2 (launch copy, owner approval in the consent pull request): sign-up says "company" for "organization". The v1
  // text is SUPERSEDED_IN_PLACE.
  { version: "terms and privacy acceptance v2", file: "client/src/pages/RobotTeamSignUpFlow.tsx", tag: "label",
    text: "I agree to the Terms and Privacy Policy and am authorized to create this company’s account." },
];

/**
 * Statements that were written inline and whose surface is gone (2026-11-12: the start form's share box and Share
 * settings were removed). Their texts stay here as the record of what was agreed under each version; none may come back
 * on any page under its old version.
 */
const RETIRED_INLINE_STATEMENTS = [
  // Replaced by v3 on the launch-copy consent change (owner approval in its pull request).
  { version: "optional-updates-v2", was: "client/src/pages/RobotTeamSignUpFlow.tsx",
    text: "Also email me Blueprint updates (optional). You get an email for each new job either way; unsubscribe anytime." },
  { version: "optional-updates-v1 and optional-updates-v2", was: "client/src/components/workspace/UpdatePreferencesForm.tsx",
    text: "Relevant new-job alerts" },
  // The bundled box (job emails and Blueprint updates together, off unless ticked), replaced by v2 on 2026-11-20.
  { version: "optional-updates-v1", was: "client/src/components/site/PartnerApplication.tsx",
    text: "Email me relevant job opportunities and Blueprint updates. Optional; unsubscribe anytime." },
  { version: "optional-updates-v1", was: "client/src/pages/RobotTeamSignUpFlow.tsx",
    text: "Email me relevant jobs and Blueprint updates (optional). Unsubscribe anytime." },
  // The application's and the company sign-up's "Blueprint updates" boxes, removed on 2026-11-23 (owner). Settings
  // keeps the switch.
  { version: "optional-updates-v2 and optional-updates-v3", was: "client/src/components/site/PartnerApplication.tsx and client/src/pages/RobotTeamSignUpFlow.tsx",
    text: "Also email me Blueprint updates. Optional; unsubscribe anytime." },
  // The application agrees to nothing since 2026-11-23 (owner): a Privacy Policy link sits beside Apply instead.
  { version: "terms and privacy acceptance v2", was: "client/src/components/site/PartnerApplication.tsx",
    text: "By applying, you agree to our Terms of Service and Privacy Policy." },
  { version: "terms and privacy acceptance", was: "client/src/components/site/PartnerApplication.tsx",
    text: "By applying, you agree to our Terms of Service and Privacy Policy. Application notices are separate from optional updates." },
  { version: "public-task-card-v1", was: "client/src/components/site/SiteCaptureStart.tsx",
    text: "Also share an anonymised summary of this job with robot companies Blueprint has approved (optional)" },
  { version: "public-task-card-v1", was: "client/src/components/site/PublicTaskListing.tsx",
    text: "I reviewed the text and thumbnail for identifying details and am authorized to make them public. I can remove this card here at any time." },
];

/**
 * Statements whose element now carries a newer version that begins with the same words, so the six-word anchor of the
 * retired check cannot tell them apart. Their texts stay here as the record of what was agreed under each version; the
 * element that carried each one must no longer say it, and the newer version is pinned in INLINE_STATEMENTS.
 */
const SUPERSEDED_IN_PLACE = [
  { version: "terms and privacy acceptance", file: "client/src/pages/RobotTeamSignUpFlow.tsx", tag: "label",
    text: "I agree to the Terms and Privacy Policy and am authorized to create this organization’s account." },
];

/** JSX text as React renders it: lines trimmed where they meet a newline, whitespace-only lines dropped. */
function jsxText(raw: string): string {
  if (!/[\r\n]/.test(raw)) return raw;
  const lines = raw.split(/\r?\n/);
  return lines.map((line, index) => {
    let out = line;
    if (index > 0) out = out.trimStart();
    if (index < lines.length - 1) out = out.trimEnd();
    return out;
  }).filter(line => line.length > 0).join(" ");
}

function visibleText(node: ts.Node): string {
  if (ts.isJsxText(node)) return jsxText(node.text);
  if (ts.isJsxExpression(node)) {
    if (!node.expression) return "";
    if (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression)) return node.expression.text;
    return "{…}";
  }
  if (ts.isJsxElement(node)) return node.children.map(visibleText).join("");
  if (ts.isJsxFragment(node)) return node.children.map(visibleText).join("");
  return "";
}

const tagOf = (node: ts.JsxElement) => node.openingElement.tagName.getText();
const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
const anchorOf = (text: string) => text.split(" ").slice(0, 4).join(" ");

/**
 * Each innermost `tag` element in `source` whose visible text contains the first words of `text`, so the element that
 * carries the statement is still found after a word is changed or a sentence appended, and its whole text is compared.
 */
function statementCarriers(source: string, tag: string, text: string): Array<{ text: string; bodyStart: number; closeStart: number }> {
  const file = ts.createSourceFile("statement.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const anchor = anchorOf(text);
  const found: Array<{ node: ts.JsxElement; text: string }> = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node) && tagOf(node) === tag) {
      const rendered = collapse(visibleText(node));
      if (rendered.includes(anchor)) found.push({ node, text: rendered });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found
    .filter(outer => !found.some(inner => inner !== outer && inner.node.pos >= outer.node.pos && inner.node.end <= outer.node.end))
    .map(row => ({ text: row.text, bodyStart: row.node.openingElement.end, closeStart: row.node.closingElement.getStart() }));
}

const carrierTexts = (source: string, tag: string, text: string) => statementCarriers(source, tag, text).map(row => row.text);

describe("recorded statements keep their exact text under their version", () => {
  it.each(CONSTANT_STATEMENTS)("$name ($version)", ({ actual, text }) => {
    expect(actual).toBe(text);
  });

  it("covers every version the stores accept", () => {
    for (const version of RECORDING_RIGHTS_STATEMENT_VERSIONS.filter(v => v !== "2026-09-18.v1"))
      expect(CONSTANT_STATEMENTS.some(row => row.version === version), version).toBe(true);
    for (const version of [...DESCRIPTION_AUTHORITY_VERSIONS, ...JOB_CARD_ANSWER_STATEMENT_VERSIONS, ...COMPANY_RESPONSE_STATEMENT_VERSIONS])
      expect(CONSTANT_STATEMENTS.some(row => row.version === version), version).toBe(true);
    // The closed sets themselves: a new version must be added here, and to the rows above, on purpose.
    expect([...RECORDING_RIGHTS_STATEMENT_VERSIONS]).toEqual(["2026-09-18.v1", "2026-11-02.v2", "2026-11-11.v3", "2026-11-12.v4", "2026-11-23.v6"]);
    expect([...DESCRIPTION_AUTHORITY_VERSIONS]).toEqual(["2026-10-06.v1", "2026-11-11.v2", "2026-11-11.v3", "2026-11-12.v4", "2026-11-12.v5", "2026-11-23.v6"]);
  });

  it("shows the introduction statement word for word beside the button, and the button records its version", () => {
    expect(introduceSentence("Company A")).toBe("We give Company A your email address and the place you gave us, and give you theirs.");
    expect(introduceSentence("Company A", "introduction-request-2026-11-12"))
      .toBe("We give Company A your name, address and contact details, and give you theirs.");
    expect([...INTRODUCTION_REQUEST_STATEMENT_VERSIONS]).toEqual(["introduction-request-2026-11-24", "introduction-request-2026-11-12"]);
    // The company's name where its answer shows it, else its alias (owner, 2026-11-23), in the job's own version.
    expect(sourceText("client/src/components/site/SiteAnswer.tsx")).toMatch(/helper=\{introduceSentence\(shownName\(entry\), statementVersion\)\}/);
    expect(sourceText("client/src/components/site/SiteAnswer.tsx")).toMatch(/const shownName = \(entry: AnsweredEntry\) => entry\.applicant\?\.name \?\? entry\.alias;/);
    expect(sourceText("client/src/components/site/SiteAnswer.tsx")).toMatch(/body: JSON\.stringify\(\{ alias: alias\.replace\(\/\^Company \/, ""\), statementVersion, answerAtIso: atIso \}\)/);
    // The route refuses a press with no recorded version; the transaction refuses one that is not this job's.
    expect(sourceText("server/routes/site-task-brief.ts")).toMatch(/!isIntroductionStatementVersion\(body\.data\.statementVersion\)/);
    expect(sourceText("server/utils/jobIntroductions.ts")).toMatch(/input\.statementVersion !== statementVersion\) return \{ ok: false, reason: "statement_not_current", statementVersion \}/);
  });

  it("shows the sharing statement word for word on every surface that records it", () => {
    // The start form shows the v6 recording or v3 private-draft terms. The job page shows and records v6.
    const start = sourceText("client/src/components/site/SiteCaptureStart.tsx");
    expect(start).toMatch(/SITE_START_CONSENT_WITH_VIDEO_V6 : SITE_START_CONSENT_NO_VIDEO\b/);
    expect(start).toMatch(/RECORDING_RIGHTS_STATEMENT_V6_VERSION/);
    expect(start).toMatch(/DESCRIPTION_AUTHORITY_WITH_VIDEO_V6_VERSION : DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION\b/);
    for (const file of ["client/src/components/site/SiteAnswer.tsx", "client/src/pages/SelfCaptureUpload.tsx"]) {
      const source = sourceText(file);
      expect(source, file).toMatch(/\{RECORDING_RIGHTS_STATEMENT_V6\}|helper=\{RECORDING_RIGHTS_STATEMENT_V6\}/);
      expect(source, file).toMatch(/statementVersion: RECORDING_RIGHTS_STATEMENT_V6_VERSION/);
    }
  });

  it.each(RETIRED_INLINE_STATEMENTS)("retired: $version is shown nowhere any more ($was)", ({ text }) => {
    const anchor = text.split(" ").slice(0, 6).join(" ");
    const pages = fs.readdirSync(path.join(ROOT, "client/src"), { recursive: true }) as string[];
    for (const file of pages.filter(name => /\.(tsx?|jsx?)$/.test(name)))
      expect(fs.readFileSync(path.join(ROOT, "client/src", file), "utf8").replace(/\s+/g, " "), file).not.toContain(anchor);
  });

  it.each(SUPERSEDED_IN_PLACE)("superseded: $version is no longer said in $file", ({ file, tag, text }) => {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    expect(carrierTexts(source, tag, text)).not.toContain(text);
    expect(INLINE_STATEMENTS.some(row => row.file === file && row.tag === tag && row.text !== text && anchorOf(row.text) === anchorOf(text)), file).toBe(true);
  });

  it("covers every task confirmation version the intake accepts", () => {
    for (const version of TASK_CONFIRMATION_VERSIONS)
      expect(CONSTANT_STATEMENTS.some(row => row.name === "task confirmation" && row.version === version), version).toBe(true);
    expect([...TASK_CONFIRMATION_VERSIONS]).toEqual(["2026-11-07.v1", "2026-11-21.v2"]);
  });

  it.each(INLINE_STATEMENTS)("$version in $file", ({ file, tag, text }) => {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    const carriers = carrierTexts(source, tag, text);
    expect(carriers, `${file}: no <${tag}> carries this statement`).toContain(text);
    // Every element that starts like this statement must say exactly a pinned statement: no near-copy beside it.
    const pinned = INLINE_STATEMENTS.filter(row => row.file === file).map(row => row.text);
    for (const carrier of carriers) expect(pinned, `${file}: <${tag}> says "${carrier}"`).toContain(carrier);
  });

  it.each(INLINE_STATEMENTS)("test of the test, a changed word and an appended sentence fail: $version in $file", ({ file, tag, text }) => {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    const carrier = statementCarriers(source, tag, text).find(row => row.text === text)!;
    expect(carrier).toBeTruthy();
    const body = source.slice(carrier.bodyStart, carrier.closeStart);
    // One word changed: the last word of the statement that appears in the element's own source.
    const word = text.split(" ").map(w => w.replace(/[^\p{L}-]/gu, "")).filter(w => w.length > 2 && body.includes(w)).at(-1)!;
    expect(word).toBeTruthy();
    const wordAt = carrier.bodyStart + body.lastIndexOf(word);
    const changed = source.slice(0, wordAt) + "changed" + source.slice(wordAt + word.length);
    expect(carrierTexts(changed, tag, text)).not.toContain(text);
    // One sentence appended inside the element, just before its closing tag.
    const appended = source.slice(0, carrier.closeStart) + " We may share your email with partners." + source.slice(carrier.closeStart);
    expect(carrierTexts(appended, tag, text)).not.toContain(text);
    expect(carrierTexts(appended, tag, text)).toContain(`${text} We may share your email with partners.`);
  });

  it("knows every optional-updates surface: a new one must be added to the table above", () => {
    // RobotTeamEarlyAccess.tsx carried its own application until 2026-11-20; it now points to the one on /partners. The
    // application's and the sign-up's boxes were removed on 2026-11-23 (owner); Settings is the one place left.
    const surfaces: string[] = [];
    for (const file of surfaces) expect(sourceText(file)).toMatch(/optionalUpdates/);
    const pinned = new Set(INLINE_STATEMENTS.filter(row => row.version === CURRENT_UPDATE_PREFERENCES_VERSION).map(row => row.file));
    for (const file of surfaces) expect(pinned.has(file), file).toBe(true);
  });
});
