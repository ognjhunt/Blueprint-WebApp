/**
 * No price anywhere a site or a deployment company reads (owner, 2026-11-12): the site pays nothing; deployment
 * companies will pay, how is not decided, and no price is stated anywhere.
 *
 * The files are found, not listed: every source file under `client/src`, `server/routes` and `server/utils`, and the
 * public text files, less only what no site or company reads (Blueprint's own console, internal routes, Blueprint's
 * own provider spend tracking and model prompts), each with its reason. A new page, email or route is scanned the day
 * it is written. Only the text a reader sees is read (`scripts/qa/visible-text.ts`); what counts as a price is
 * `scripts/qa/price-statements.ts`.
 *
 * A figure that is not Blueprint's price (a cited market number, the site's own budget, the Terms' liability cap) is
 * allowed below by file, rule and sentence, with its reason, and each allowance must still match something, so none
 * outlives the sentence it was written for. The built emails are checked in `server/tests/money-emails-no-price.test.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PRICE_RULES, priceFindings, sentencesOf } from "../../../scripts/qa/price-statements";
import { visibleTextOf } from "../../../scripts/qa/visible-text";

const ROOT = path.resolve(import.meta.dirname, "../../..");

const SCANNED_TREES = ["client/src", "server/routes", "server/utils"] as const;
const SCANNED_FILES = ["client/index.html", "client/public/llms.txt", "client/public/llms-full.txt"] as const;

/** What no site and no deployment company reads, and why. Internal spend tracking is Blueprint's control, not a price. */
const NOT_READ_BY_SITES_OR_COMPANIES: ReadonlyArray<[RegExp, string]> = [
  [/(?:^|\/)tests?\/|\.test\.tsx?$/, "tests"],
  [/^client\/src\/(?:components\/admin\/|pages\/Admin)/, "Blueprint's own console"],
  [/^server\/routes\/(?:admin|internal|operator)[-\w]*\.ts$/, "admin, operator and Pipeline-to-WebApp routes"],
  [/^server\/utils\/(?:agentCostTelemetry|anthropicPricing|openaiPromptCache)\.ts$/,
    "Blueprint's own provider spend tracking and the internal model prompts"],
];

interface Allowance { file: RegExp; rule: string; sentence: RegExp; reason: string }

/** Figures and words that are not Blueprint's price. */
const ALLOWED: readonly Allowance[] = [
  { file: /^client\/src\/data\/deploymentMarket\.ts$/, rule: "*", sentence: /./,
    reason: "cited third-party market figures, each with its source (AGENTS.md, Two Truths); held below to never name Blueprint" },
  { file: /^(?:client\/src\/data\/(?:siteTaskQualification|robotTeamQualification)|client\/src\/types\/inbound-request|client\/src\/lib\/structuredIntake|server\/routes\/inbound-request)\.ts$/,
    rule: "an amount of money", sentence: /^(?:Under |Over |[<>])?\$\d+[KM]?(?:\s?[-–]\s?\$\d+[KM])?$/,
    reason: "a budget band the site or the company is asked for: its own budget, not a Blueprint price" },
  { file: /^client\/src\/components\/site\/TaskFacts\.tsx$/, rule: "a fee or a price",
    sentence: /^(?:Site's proposed pilot price|Ongoing price target)$/,
    reason: "labels for the pilot figure the site itself typed, shown to companies; not a Blueprint price (an owner decision is listed)" },
  { file: /^client\/src\/pages\/(?:Terms\w*|Refunds)\.tsx$/, rule: "a fee or a price",
    sentence: /the site and the deployment company agree the physical pilot.{0,30}\bprice\b/i,
    reason: "a pilot's price is agreed between the site and the company; Blueprint states none" },
  { file: /^client\/src\/pages\/Terms\w*\.tsx$/, rule: "an amount of money",
    sentence: /^Blueprint's total liability for all claims .* and \$100\.$/, reason: "the Terms' liability cap, not a price" },
  { file: /^client\/src\/pages\/Privacy\w*\.tsx$/, rule: "a payment element", sentence: /^Stripe$/,
    reason: "the processor the privacy policy names for payment records made before the free beta" },
  { file: /^server\/utils\/transactional-notifications\.ts$/, rule: "a payment element",
    sentence: /^Your Blueprint payout was marked paid by Stripe\.$/,
    reason: "the retired capture app's payout notice: never dispatched (pinned in server/tests/money-site-flows-reach-no-payment.test.ts)" },
];

function filesUnder(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(entry => {
    const relative = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return filesUnder(relative);
    return /\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}

function scannedFiles(): string[] {
  return [...SCANNED_TREES.flatMap(filesUnder), ...SCANNED_FILES]
    .filter(file => !NOT_READ_BY_SITES_OR_COMPANIES.some(([pattern]) => pattern.test(file))).sort();
}

interface Finding { file: string; rule: string; sentence: string }

function findingsIn(files: readonly string[], read: (file: string) => string): Finding[] {
  const findings: Finding[] = [];
  for (const file of files)
    for (const text of visibleTextOf(file, read(file)))
      for (const sentence of sentencesOf(text))
        for (const rule of PRICE_RULES) if (rule.test(sentence)) findings.push({ file, rule: rule.name, sentence });
  return findings;
}

const allowanceFor = (finding: Finding) => ALLOWED.find(allowed => allowed.file.test(finding.file)
  && (allowed.rule === "*" || allowed.rule === finding.rule) && allowed.sentence.test(finding.sentence));

const readFile = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("no price anywhere a site or a deployment company reads", () => {
  const files = scannedFiles();
  const findings = findingsIn(files, readFile);

  it("finds no price, rate, fee or payment element outside the named allowances", () => {
    const unallowed = findings.filter(finding => !allowanceFor(finding))
      .map(({ file, rule, sentence }) => `${file}: ${rule}: “${sentence}”`);
    expect(unallowed).toEqual([]);
  });

  it("keeps every allowance in use, so none outlives the sentence it was written for", () => {
    const unused = ALLOWED.filter(allowed => !findings.some(finding => allowanceFor(finding) === allowed)).map(({ reason }) => reason);
    expect(unused).toEqual([]);
  });

  it("never lets a cited market figure be Blueprint's own", () => {
    const market = findings.filter(finding => finding.file === "client/src/data/deploymentMarket.ts");
    expect(market.length).toBeGreaterThan(0);
    expect(market.filter(finding => /\bBlueprint\b/i.test(finding.sentence)).map(({ sentence }) => sentence)).toEqual([]);
  });

  it("reads the pages, the job page, every email to a site or a company, and the routes that answer them", () => {
    for (const file of [
      "client/src/pages/Home.tsx", "client/src/pages/Partners.tsx", "client/src/pages/Beta.tsx", "client/src/pages/Terms.tsx",
      "client/src/pages/Refunds.tsx", "client/src/pages/CompanyJob.tsx", "client/src/pages/SelfCaptureUpload.tsx",
      "client/src/components/site/JobWorkspace.tsx", "client/src/components/site/TaskBrowse.tsx",
      "client/src/lib/siteIntroductions.ts", "client/src/lib/companyResponses.ts", "client/src/lib/evaluationPricing.ts",
      // The emails the hand-kept list of `publicClaims.guard.test.ts` did not read (2026-11-19).
      "server/utils/introductionSiteEmail.ts", "server/utils/jobIntroductions.ts", "server/utils/jobAutoSend.ts",
      "server/utils/jobOutcomes.ts", "server/utils/withdrawalCompanyNotice.ts", "server/utils/passwordResetEmail.ts",
      "server/utils/emailLayout.ts", "server/utils/robotTeamAccessEmails.ts", "server/utils/taskLifecycleNotifications.ts",
      "server/routes/site-task-brief.ts", "server/routes/site-worlds.ts", "server/routes/site-content.ts",
      "server/routes/robot-team-access.ts", "server/routes/job-outcomes.ts", "client/public/llms.txt",
    ]) expect(files, file).toContain(file);
  });

  it("finds a price planted in a file it had not been told about", () => {
    const planted = "export const SUBJECT = \"Meet the company\"; export const BODY = \"Each introduction is $250, billed per month.\";";
    const found = findingsIn(["server/utils/introductionSiteEmail.ts"], () => planted).map(({ rule }) => rule);
    expect(found).toEqual(["an amount of money", "a rate"]);
  });
});

describe("what the detector counts as a price", () => {
  it.each([
    { sentence: "$49/month", rules: ["an amount of money", "a rate"] },
    { sentence: "Each introduction costs USD 30.", rules: ["an amount of money"] },
    { sentence: "Introductions are 20 dollars each.", rules: ["an amount of money"] },
    { sentence: "€5 per lead.", rules: ["an amount of money", "a rate"] },
    { sentence: "Pay with your credit card at checkout.", rules: ["a payment element"] },
    { sentence: "Start your subscription today.", rules: ["a payment element"] },
    { sentence: "Upgrade to the Pro plan for more jobs.", rules: ["a payment element"] },
    { sentence: "Blueprint charges a small fee for each introduction.", rules: ["a fee or a price"] },
    { sentence: "See pricing.", rules: ["a payment element"] },
    { sentence: "It is free: $0.", rules: ["an amount of money"] },
  ])("finds $sentence", ({ sentence, rules }) => {
    expect(priceFindings(sentence).map(finding => finding.split(": ")[0])).toEqual(rules);
  });

  it.each([
    "Free for sites. Nothing is charged today.",
    "There is no Blueprint fee, invoice or payment step for the site.",
    "The beta has no paid private evaluations, balances, top-ups or checkout.",
    "Blueprint charges no fee for and takes no percentage of any pilot or deployment.",
    "Change your preferences in Settings or unsubscribe below.",
    "One introduction per company; the site presses once for each company it wants to meet.",
    "The robot reaches 1.3 m and lifts 5 kg.",
  ])("leaves %s alone", sentence => {
    expect(priceFindings(sentence)).toEqual([]);
  });
});
