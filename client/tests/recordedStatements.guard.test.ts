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
import { describe, expect, it } from "vitest";
import { RECORDING_RIGHTS_STATEMENT, RECORDING_RIGHTS_STATEMENT_SHORT, RECORDING_RIGHTS_STATEMENT_VERSIONS } from "@/lib/recordingRightsStatement";
import { DESCRIPTION_AUTHORITY_STATEMENTS, DESCRIPTION_AUTHORITY_VERSIONS } from "@/lib/siteSubmissionAuthority";
import { TASK_CONFIRMATION_STATEMENT } from "@/lib/taskConfirmationStatement";
import { JOB_CARD_ANSWER_STATEMENTS, JOB_CARD_ANSWER_STATEMENT_VERSIONS } from "@/lib/jobCardAnswerConsent";
import { SITE_START_CONSENT_NO_VIDEO, SITE_START_CONSENT_WITH_VIDEO } from "@/lib/siteStartConsent";

const ROOT = path.resolve(import.meta.dirname, "../..");
const sourceText = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\s+/g, " ");

/** Statements held as constants: version → exact text, written out here so a change to either fails. */
const CONSTANT_STATEMENTS = [
  { name: "recording rights", version: "2026-11-02.v2", actual: RECORDING_RIGHTS_STATEMENT, text: "I am authorized to record this site and to let Blueprint use the recording to draft the job brief, build a simulation of the work area and run candidate robot policies in it." },
  { name: "recording rights, short", version: "2026-11-11.v3", actual: RECORDING_RIGHTS_STATEMENT_SHORT, text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site." },
  { name: "start form, with video", version: "2026-11-11.v3", actual: SITE_START_CONSENT_WITH_VIDEO, text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site." },
  { name: "start form, no video", version: "2026-11-11.v3", actual: SITE_START_CONSENT_NO_VIDEO, text: "By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site." },
  { name: "task confirmation", version: "2026-11-07.v1", actual: TASK_CONFIRMATION_STATEMENT, text: "This is the task I want Blueprint to evaluate." },
  { name: "description authority", version: "2026-10-06.v1", actual: DESCRIPTION_AUTHORITY_STATEMENTS["2026-10-06.v1"], text: "I am authorized to share this job description with Blueprint on behalf of the site." },
  { name: "description authority", version: "2026-11-11.v2", actual: DESCRIPTION_AUTHORITY_STATEMENTS["2026-11-11.v2"], text: "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site." },
  { name: "description authority", version: "2026-11-11.v3", actual: DESCRIPTION_AUTHORITY_STATEMENTS["2026-11-11.v3"], text: "By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site." },
  { name: "share my job", version: "public-task-card-with-answer-v3", actual: JOB_CARD_ANSWER_STATEMENTS["public-task-card-with-answer-v3"], text: "Shares a summary of your job and your answer, including later test results, without saying who you are, with companies we've approved. Your video, address and contacts stay private." },
  { name: "share my job", version: "public-task-card-with-answer-v2", actual: JOB_CARD_ANSWER_STATEMENTS["public-task-card-with-answer-v2"], text: "Shares a summary of your job and this answer, without saying who you are, with companies we've approved. Your video, address and contacts stay private." },
  { name: "share my job", version: "public-task-card-with-answer-v1", actual: JOB_CARD_ANSWER_STATEMENTS["public-task-card-with-answer-v1"], text: "This shares an anonymised summary of your job and this answer with deployment companies Blueprint has approved. Your video, address and contacts stay private." },
];

/** Statements written inline where a person ticks a box: version → file → exact visible text (whitespace collapsed). */
const INLINE_STATEMENTS: Array<{ version: string; file: string; text: string }> = [
  { version: "optional-updates-v1", file: "client/src/components/site/PartnerApplication.tsx",
    text: "Email me relevant job opportunities and Blueprint updates. Optional; unsubscribe anytime." },
  { version: "optional-updates-v1", file: "client/src/components/site/RobotTeamEarlyAccess.tsx",
    text: "Email me relevant new jobs and Blueprint updates (optional). Unsubscribe anytime. Application notices are separate." },
  { version: "optional-updates-v1", file: "client/src/pages/RobotTeamSignUpFlow.tsx",
    text: "Email me relevant jobs and Blueprint updates (optional). Unsubscribe anytime." },
  { version: "optional-updates-v1", file: "client/src/components/workspace/UpdatePreferencesForm.tsx", text: "Blueprint news and updates" },
  { version: "optional-updates-v1", file: "client/src/components/workspace/UpdatePreferencesForm.tsx", text: "Relevant new-job alerts" },
  { version: "public-task-card-v1", file: "client/src/components/site/SiteCaptureStart.tsx",
    text: "Also share an anonymised summary of this job with robot companies Blueprint has approved (optional)" },
  { version: "public-task-card-v1", file: "client/src/components/site/PublicTaskListing.tsx",
    text: "I reviewed the text and thumbnail for identifying details and am authorized to make them public. I can remove this card here at any time." },
  { version: "2026-09-24.v1", file: "client/src/components/site/SiteCaptureStart.tsx",
    text: "For this development test, I authorize Blueprint to send selected frames and task evidence from this recording to Anthropic for Claude Opus 5.5 3D authoring. Blueprint pays the bounded provider cost; this does not train a model on my recording." },
  { version: "2026-09-24.v1", file: "client/src/components/site/SiteCaptureStart.tsx",
    text: "For this development test, I authorize Blueprint to send selected frames and task evidence to OpenAI for GPT-6.1 Sol managed-agent 3D authoring. The agent session can retain that evidence until it is deleted under the configured provider policy. Blueprint pays the bounded provider cost." },
  { version: "terms and privacy acceptance", file: "client/src/components/site/PartnerApplication.tsx", text: "By applying, you agree to our" },
  { version: "terms and privacy acceptance", file: "client/src/components/site/RobotTeamEarlyAccess.tsx", text: "By applying, you agree to our" },
];

describe("recorded statements keep their exact text under their version", () => {
  it.each(CONSTANT_STATEMENTS)("$name ($version)", ({ actual, text }) => {
    expect(actual).toBe(text);
  });

  it("covers every version the stores accept", () => {
    for (const version of RECORDING_RIGHTS_STATEMENT_VERSIONS.filter(v => v !== "2026-09-18.v1"))
      expect(CONSTANT_STATEMENTS.some(row => row.version === version), version).toBe(true);
    for (const version of [...DESCRIPTION_AUTHORITY_VERSIONS, ...JOB_CARD_ANSWER_STATEMENT_VERSIONS])
      expect(CONSTANT_STATEMENTS.some(row => row.version === version), version).toBe(true);
  });

  it.each(INLINE_STATEMENTS)("$version in $file", ({ file, text }) => {
    expect(sourceText(file)).toContain(text);
  });

  it("knows every optional-updates surface: a new one must be added to the table above", () => {
    const surfaces = ["client/src/components/site/PartnerApplication.tsx", "client/src/components/site/RobotTeamEarlyAccess.tsx",
      "client/src/pages/RobotTeamSignUpFlow.tsx"];
    for (const file of surfaces) expect(sourceText(file)).toMatch(/optionalUpdates/);
    const pinned = new Set(INLINE_STATEMENTS.filter(row => row.version === "optional-updates-v1").map(row => row.file));
    for (const file of surfaces) expect(pinned.has(file), file).toBe(true);
  });
});
