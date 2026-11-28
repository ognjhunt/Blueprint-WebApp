/**
 * Public words claim only what the code does. Every sentence a site, a visitor
 * or a deployment company reads on these pages, in the job page's answer and
 * simulation result, in the emails and in `llms*.txt` is checked here against
 * a short list of claims nothing in Blueprint backs.
 *
 * Only user-visible text is read: string literals, template text and JSX text.
 * Comments, imports, type names, identifiers, log and error messages, and
 * single-token codes (ids, class names, keys) are left out.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { visibleTextOf } from "../../scripts/qa/visible-text";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** The site-facing files: the public pages, the job page's answer and simulation result, their sentences, the email copy, the agent-readable summaries. */
const CLAIM_FILES = [
  "client/src/pages/Home.tsx",
  "client/src/pages/Beta.tsx",
  "client/src/pages/Partners.tsx",
  "client/src/pages/Contact.tsx",
  "client/src/lib/publicCopy.ts",
  "client/src/lib/siteStartConsent.ts",
  "client/src/components/site/SiteCaptureStart.tsx",
  "server/routes/site-content.ts",
  "client/src/components/site/RobotScene.tsx",
  "client/src/components/site/Footer.tsx",
  "client/src/components/site/MinimalSiteLayout.tsx",
  // Launch copy (2026-11-20): the header and footer links, the Find jobs sample job and the home page's example card.
  "client/src/components/site/navigation.ts",
  "client/src/components/site/SampleJob.tsx",
  "client/src/components/site/PilotPreview.tsx",
  "client/src/components/site/SiteAnswer.tsx",
  "client/src/components/site/JobCardAnswer.tsx",
  "client/src/components/site/TaskBrowse.tsx",
  "client/src/components/bare/Bare.tsx",
  "client/src/lib/jobCardAnswerConsent.ts",
  "client/src/pages/SelfCaptureUpload.tsx",
  "client/src/lib/simulationProof.ts",
  "client/src/lib/siteAnswer.ts",
  "client/src/data/simulationAccuracy.ts",
  "client/src/data/simulationPolicies.ts",
  "client/src/data/robotFit.ts",
  "server/utils/jobCardAnswer.ts",
  "server/utils/taskLifecycleNotifications.ts",
  "server/utils/captureOutbox.ts",
  "client/src/lib/evaluationPricing.ts",
  // Package C1: what a site and a company read about sends and answers.
  "client/src/lib/companyResponses.ts",
  "client/public/llms.txt",
  "client/public/llms-full.txt",
] as const;

/**
 * Every other file whose strings reach a site, a deployment company or an outside agent (review, 2026-11-12). Found
 * from: every component under `client/src/components/site/` (the public pages and the job page are built from them),
 * the public pages in `client/src/app/routes.tsx` other than the legal ones, the copy libraries those import, every
 * server file that composes an email to a site or a company (`subject:` in `server/utils`, minus Blueprint's own ops
 * and founder mail). (The agent contract, its routes and its answers were removed on 2026-11-12.)
 * These are held to the frame's bans; the claim rules (prove, guarantee, certify, cycle time) stay on `CLAIM_FILES`,
 * whose sentences are written for sites.
 */
const FRAME_FILES = [
  "client/src/components/site/CanvasSurfaceSync.tsx",
  "client/src/components/site/CaptureHandoffQr.tsx",
  "client/src/components/site/CaptureLiveStatus.tsx",
  "client/src/components/site/CaptureRecorder.tsx",
  "client/src/components/site/FilmLinkHandoff.tsx",
  "client/src/components/site/Header.tsx",
  "client/src/components/site/LegalVersionNotes.tsx",
  "client/src/components/site/LoadingScreen.tsx",
  "client/src/components/site/LocationAutocomplete.tsx",
  "client/src/components/site/NextTaskUpdate.tsx",
  "client/src/components/site/OwnerRecordingWithdrawal.tsx",
  "client/src/components/site/PartnerApplication.tsx",
  "client/src/components/site/RobotFit.tsx",
  "client/src/components/site/RobotFitHold.tsx",
  "client/src/components/site/RobotTeamEarlyAccess.tsx",
  "client/src/components/site/SiteAdvisoryReport.tsx",
  "client/src/components/site/SiteLayout.tsx",
  "client/src/components/site/SuccessThresholds.tsx",
  "client/src/components/site/TaskBriefReview.tsx",
  "client/src/components/site/TaskClarification.tsx",
  "client/src/components/site/TaskDestinationChoice.tsx",
  "client/src/components/site/TaskFacts.tsx",
  "client/src/components/site/TaskOutcomeNotice.tsx",
  "client/src/components/site/TaskTargetChoice.tsx",
  "client/src/components/site/TaskThumbnail.tsx",
  "client/src/pages/ClaimSite.tsx",
  "client/src/pages/Login.tsx",
  "client/src/pages/ForgotPassword.tsx",
  "client/src/pages/BusinessSignUpFlow.tsx",
  "client/src/pages/NotFound.tsx",
  "client/src/pages/RobotTeamSignUpFlow.tsx",
  "client/src/lib/jobOutlook.ts",
  "client/src/lib/captureGroundedLanguage.ts",
  "client/src/types/taskBrowse.ts",
  "server/utils/robotTeamAccessEmails.ts",
  "server/utils/accountNotice.ts",
  "server/utils/filmLinkHandoff.ts",
  // Launch copy (2026-11-20): the other files that build an email a site or a company reads, or the page an email
  // link opens (the emails audit's guard coverage gap).
  "server/utils/jobClarifications.ts",
  "server/utils/withdrawalCompanyNotice.ts",
  "server/utils/siteActionNeeded.ts",
  "server/utils/jobOutcomes.ts",
  "server/utils/introductionSiteEmail.ts",
  "server/utils/passwordResetEmail.ts",
  "server/utils/emailLayout.ts",
  "server/utils/email-suppression.ts",
  "server/routes/email-preferences.ts",
  "server/utils/sceneIntentOutcome.ts",
  "server/utils/taskPreparationOutcome.ts",
  "server/utils/taskUpdateCommitment.ts",
  "server/utils/siteAnswer.ts",
  "server/utils/siteTaskScope.ts",
  "server/routes/site-task-brief.ts",
  "client/index.html",
  // Package C1: the company's response route, the send and answer records, and the operator's panel.
  "server/routes/site-worlds.ts",
  "server/utils/jobCompanies.ts",
  "client/src/types/jobCompanies.ts",
  "client/src/components/admin/JobCompaniesConsole.tsx",
  // The job summary a company downloads from a job's page (owner, 2026-11-25): its own lines around the page's words.
  "server/utils/companyJobSummary.ts",
  // Pilot offers (owner, 2026-11-28): the words both pages show, the site's block, the pilot sheet, the company's form,
  // and the file that builds the company's email when a site asks for its pilot.
  "client/src/lib/pilotOffers.ts",
  "client/src/components/site/PilotOffers.tsx",
  "client/src/components/site/PilotSheet.tsx",
  "client/src/pages/PilotOfferSettings.tsx",
  "server/utils/pilotOffers.ts",
  // The simulation on request (owner, 2026-11-28): the words both job pages show, and the press's answers.
  "client/src/lib/simulationRequest.ts",
  "server/utils/simulationRequest.ts",
] as const;

const FILES = [...CLAIM_FILES, ...FRAME_FILES] as const;
const CLAIM_FILE_SET: ReadonlySet<string> = new Set(CLAIM_FILES);

interface Rule { name: string; test: (sentence: string) => boolean; claimFilesOnly?: boolean }

/**
 * The banned claims. Why: a simulation result is a bounded estimate and the answer is a fit check, so
 * nothing Blueprint runs proves, guarantees or certifies anything, and the simulation does not measure
 * cycle time; a public sentence that says otherwise claims more than the code does.
 */
const RULES: Rule[] = [
  { claimFilesOnly: true, name: "prove, proves, proven or proof", test: sentence => /\b(prove|proves|proven|proof)\b/i.test(sentence) },
  { claimFilesOnly: true, name: "guarantee", test: sentence => /\bguarantee(s|d)?\b/i.test(sentence) },
  { claimFilesOnly: true, name: "certif… outside a negation", test: sentence => [...sentence.matchAll(/\bcertif\w*/gi)].some(match => {
    const before = sentence.slice(Math.max(0, match.index! - 30), match.index);
    const after = sentence.slice(match.index! + match[0].length);
    return !/\b(not|never|nor|no)\b|n['’]t\b/i.test(before) && !/^\s+neither\b/i.test(after);
  }) },
  // A promise that the site will see "which … did best": the comparison may find no clear difference. A result
  // ("{policy} did best: …", emitted only when the rule says so) names the policy and is not this form. The one
  // exception the owner's 2026-11-11 framing needed (the bare phrase "which did best") went with that framing on
  // 2026-11-12, so every form is caught.
  { name: "a promise of which one did best", test: sentence => /\bwhich\b(?:\s+[^\s.;:]+){0,4}\s+did best\b/i.test(sentence) },
  { claimFilesOnly: true, name: "cycle time in a sentence about the simulation", test: sentence => /\bcycle[- ]?times?\b/i.test(sentence) && /simulat/i.test(sentence) },
  // The frame of 2026-11-12 (WEBSITE_DECISIONS.md): the old frame's words never reach a site or a company again.
  { name: "the old frame's \"top AI robots\"", test: sentence => /\btop AI robots?\b/i.test(sentence) },
  { name: "the old frame's \"AI robot\"", test: sentence => /\bAI robots?\b/i.test(sentence) },
  { name: "the old frame's \"paper check\"", test: sentence => /\bpaper checks?\b/i.test(sentence) },
  // Allowed only in the recorded statement, word for word (by path, in `allowedIn` below).
  { name: "the old frame's \"your answer\"", test: sentence => /\byour answer\b/i.test(sentence) },
  { name: "deployment companies judging the job", test: sentence => /deployment compan\w*[^.]{0,60}\bjudg|\bjudg\w*[^.]{0,60}deployment compan/i.test(sentence) },
  // No price anywhere a site or a company reads (the legal pages are not scanned here).
  { name: "a price", test: sentence => /[$€£]\s?\d/.test(sentence) },
  // Sharing is the service (owner, 2026-11-12): agreed once when the site sends the job, with no share button, no share
  // setting and no pause. No sentence offers a site the choice, the button or a way to pause or keep a sent job private.
  { name: "a share step, share setting or pause", test: sentence =>
    /\bshare my job\b|\b(choose|chooses|choosing)\s+(whether\s+)?to\s+share\b|\byou can share\b|\bthen you can share\b|\b(pause|resume|stop)\s+sharing\b|\bkeep\s+(it|your job|this job)\s+private\b/i.test(sentence)
    // Launch copy (2026-11-20, d-001, f-093): the save-to-account page offered to pause the job and hide its card.
    || /\bpause\s+(it|your job|this job|the listing)\b|\bcontrol\s+the\s+listing\b|\bhide\s+(its|the|your)\s+card\b/i.test(sentence) },
];

/** A rule a file may break because the file holds a recorded statement that must stay word for word. */
const ALLOWED_IN: Record<string, ReadonlySet<string>> = {
  "client/src/lib/jobCardAnswerConsent.ts": new Set(["the old frame's \"your answer\""]),
  // The company's recorded response statement (PACKAGE_E E5, `company-response-2026-11-12`), word for word.
  "client/src/lib/companyResponses.ts": new Set(["the old frame's \"your answer\""]),
  // A site's reply to a question these components ask ("Saving your answer…"), not the old frame's "your answer".
  "client/src/components/site/TaskClarification.tsx": new Set(["the old frame's \"your answer\""]),
  "client/src/components/site/TaskDestinationChoice.tsx": new Set(["the old frame's \"your answer\""]),
  "client/src/components/site/TaskTargetChoice.tsx": new Set(["the old frame's \"your answer\""]),
  // The same questions' save errors ("Your answer could not be saved.").
  "server/routes/site-task-brief.ts": new Set(["the old frame's \"your answer\""]),
};

/** Each rule a file's visible text breaks, with the sentence that breaks it. */
function publicClaimFindings(read: (file: string) => string): string[] {
  const findings: string[] = [];
  for (const file of FILES) {
    for (const text of visibleTextOf(file, read(file))) {
      for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        for (const rule of RULES) if ((!rule.claimFilesOnly || CLAIM_FILE_SET.has(file)) && rule.test(sentence) && !ALLOWED_IN[file]?.has(rule.name))
          findings.push(`${file}: ${rule.name}: “${sentence}”`);
      }
    }
  }
  return findings;
}

describe("public words claim only what the code does", () => {
  it("no site-facing sentence says prove, proof, guarantee, an unnegated certify, or cycle time about the simulation", () => {
    expect(publicClaimFindings(file => fs.readFileSync(path.join(ROOT, file), "utf8"))).toEqual([]);
  });

  it("lets the recorded statement keep its words, and nothing else", () => {
    const statement = "export const S = \"Shares a summary of your job and your answer, including later test results.\";";
    expect(publicClaimFindings(file => (file === "client/src/lib/jobCardAnswerConsent.ts" ? statement : ""))).toEqual([]);
    expect(publicClaimFindings(file => (file === FILES[0] ? statement : "")).map(finding => finding.split(": ")[1]))
      .toEqual(["the old frame's \"your answer\""]);
  });

  // Review, 2026-11-12: planted phrases in these files gave no findings, because the guard did not scan them.
  it.each(["server/utils/robotTeamAccessEmails.ts", "client/src/lib/captureGroundedLanguage.ts",
    "client/src/components/site/PartnerApplication.tsx", "server/utils/withdrawalCompanyNotice.ts",
    "server/routes/email-preferences.ts"])("scans %s for the frame's bans", planted => {
    const sample = "export const P = \"We test the top AI robots on your job.\"; export const Q = \"Your answer is ready: the paper check.\";";
    expect(publicClaimFindings(file => (file === planted ? sample : "")).map(finding => finding.split(": ")[1])).toEqual([
      "the old frame's \"top AI robots\"", "the old frame's \"AI robot\"", "the old frame's \"paper check\"", "the old frame's \"your answer\""]);
  });

  it.each([
    ["client/index.html", "<meta name=\"description\" content=\"We test the top AI robots on your job.\" />"],
    ["server/routes/site-task-brief.ts", "res.status(409).json({ error: \"We test the top AI robots on your job.\" });"],
  ])("scans %s in its own format", (planted, sample) => {
    expect(publicClaimFindings(file => (file === planted ? sample : "")).map(finding => finding.split(": ")[1]))
      .toContain("the old frame's \"top AI robots\"");
  });

  it("reads only what a reader sees, and catches each banned claim", () => {
    const sample = [
      "// This comment may say proof.",
      "import { proofOf } from \"./proof\";",
      "type Key = \"proof\";",
      "logger.warn({}, \"Could not read the proof\");",
      "const id = \"simulation-proof-title\";",
      "export const A = \"We prove it in simulation.\";",
      "export const B = `The ${name} is guaranteed.`;",
      "export const C = \"It does not certify safety, and never certifies performance; it certifies neither.\";",
      "export const D = \"Blueprint certifies the robot.\";",
      "export const E = \"The simulation checks cycle time on the stack.\";",
      "export const F = <p className=\"site-proof-row site-proof-best\">Your proof in simulation.</p>;",
      "export const G = \"You see which control policy did best in the simulation.\";",
      "export const H = \"In a simulation of your site, π0.5, an AI control policy from Physical Intelligence, did best: it completed the job in 9 of 10 tries.\";",
      // The bare "which did best" was allowed for the 2026-11-11 framing only; since 2026-11-12 it is a finding too.
      "export const I = \"We test the top robots on your job, and show you which did best.\";",
      // The reviewer's planted phrases (2026-11-12), and one of each new ban.
      "export const J = \"We test the top AI robots on your job.\";",
      "export const K = \"Your answer is ready: the paper check.\";",
      "export const L = \"A job packet robot deployment companies can judge.\";",
      "export const M = \"Each job costs $1,000 to evaluate.\";",
      "export const N = \"Approved companies see the jobs sites choose to share.\";",
      "export const O = <button>Share my job</button>;",
      "export const P = \"You can pause sharing from Job settings.\";",
      "const swap: Array<[RegExp, string]> = [[/your (video)/g, \"the site's $1\"]];",
    ].join("\n");
    const findings = publicClaimFindings(file => (file === FILES[0] ? sample : ""));
    expect(findings.map(finding => finding.split(": ")[1])).toEqual([
      "prove, proves, proven or proof", "guarantee", "certif… outside a negation",
      "cycle time in a sentence about the simulation", "prove, proves, proven or proof", "a promise of which one did best",
      "a promise of which one did best",
      "the old frame's \"top AI robots\"", "the old frame's \"AI robot\"",
      "the old frame's \"paper check\"", "the old frame's \"your answer\"",
      "deployment companies judging the job", "a price",
      "a share step, share setting or pause", "a share step, share setting or pause", "a share step, share setting or pause"]);
  });

  it("catches an offer to pause a sent job, control its listing or hide its card", () => {
    const sample = [
      "export const A = \"You can review results, control the listing, and pause it anytime.\";",
      "export const B = \"On your job page you can hide its card from the job library at any time.\";",
    ].join("\n");
    expect(publicClaimFindings(file => (file === "client/src/pages/ClaimSite.tsx" ? sample : "")).map(finding => finding.split(": ")[1]))
      .toEqual(["a share step, share setting or pause", "a share step, share setting or pause"]);
  });
});
