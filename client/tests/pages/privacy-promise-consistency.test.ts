/**
 * The promises a site reads before agreeing, pinned so they cannot be weakened silently (PACKAGE_D D1.2 as amended by
 * PACKAGE_E, 2026-11-12: sharing is the service).
 *
 * The Terms, the Privacy Policy and the site's page for its own agreement say the same thing:
 * - a site's name, address and contact details go to a deployment company only through an introduction the site asked for;
 * - the video goes without its sound, only to the deployment companies Blueprint approves, only so they can judge the job;
 * - a company's name reaches a site only through an introduction;
 * - a site can withdraw, and the job then leaves every company's view at once.
 * A change to any of these needs a new Terms and Privacy version, and this test changed with it on purpose.
 */
import { describe, expect, it } from "vitest";

import * as privacy from "@/pages/Privacy";
import { capturePrivacyAnnex, privacyPolicySections, rolePrivacyAnnex } from "@/pages/Privacy";
import * as terms from "@/pages/Terms";
import { termsSections } from "@/pages/Terms";
import { siteAssessment } from "@/lib/evaluationPricing";
import { FOOTAGE_UPLOAD_NOTICE } from "@/lib/footageNotice";
import { AGREEING_ALSO_LINE } from "@/lib/siteStartConsent";

const termsText = termsSections.flatMap(section => [...(section.paragraphs ?? []), ...(section.items ?? [])]).join("\n");
const privacyText = [...privacyPolicySections.map(section => section.body), ...capturePrivacyAnnex.map(row => row[1]),
  ...rolePrivacyAnnex.map(role => role.body)].join("\n");

function annexRow(label: string): string {
  const row = capturePrivacyAnnex.find((entry) => entry[0] === label);
  expect(row, `annex row "${label}" is missing`).toBeTruthy();
  return row![1];
}

const PROMISES = {
  sharing: "Starting a job means we share it with robot deployment companies we've approved, so they can judge it without a visit. We share your description of the job, your video without its sound, the simulation we build from it, what counts as the job done, our first look at which robots fit, and the result of any early trial we run.",
  contacts: "We do not share your name, your street address or your contact details with a deployment company unless you ask for an introduction to it.",
  companyUse: "A deployment company may use your job only to decide whether it can do it. It may not pass it on, use it to train software, or keep it after we ask it to delete it.",
  withdrawal: "You can withdraw your job at any time. It then leaves every company's view at once, and we ask any company that saved a copy to delete it. We cannot take back a copy a company has already saved.",
  olderJob: "A job started before 12 November 2026 is not shown to companies unless you accept the current statement on its page.",
  companyAlias: "A site sees your answer under an alias. It sees your company's name and your contact details only when it asks for an introduction after you answered Interested.",
};

describe("the sharing promises, in the Terms and the Privacy Policy, word for word", () => {
  it.each(Object.entries(PROMISES))("%s", (_, sentence) => {
    expect(termsText).toContain(sentence);
    expect(privacyText).toContain(sentence);
  });

  it("are the same constants on both pages", () => {
    for (const name of ["SHARING_SENTENCE", "CONTACT_DETAILS_SENTENCE", "COMPANY_USE_SENTENCE", "WITHDRAWAL_SENTENCE",
      "OLDER_JOB_SENTENCE", "COMPANY_ALIAS_SENTENCE"] as const)
      expect((privacy as Record<string, unknown>)[name], name).toBe((terms as Record<string, unknown>)[name]);
  });
});

describe("name, address and contacts", () => {
  it("go to a company only through an introduction the site asked for, on every page that says what is shared", () => {
    expect(annexRow("Deployment companies")).toContain(PROMISES.contacts);
    expect(AGREEING_ALSO_LINE).toBe("Our Terms and Privacy Policy. We don't share your name, address or contact details unless you ask for an introduction.");
    expect(annexRow("Location")).toMatch(/sees the country of the job, not the address you typed/);
  });
});

describe("the video", () => {
  it("is shared without its sound, only with approved deployment companies, only for judging the job", () => {
    const video = annexRow("Your video");
    expect(video).toMatch(/shared, without its sound, only with the robot deployment companies we approve, and only so they can judge the job/);
    expect(video).toContain(PROMISES.companyUse);
    expect(annexRow("Sound")).toMatch(/remove the sound before any automated review, before sending footage to an AI or 3D-processing provider and before a deployment company sees it/);
    expect(termsText).toMatch(/We remove its sound before any automated review, before sending footage to an AI or 3D-processing provider, and before a deployment company sees it/);
    expect(FOOTAGE_UPLOAD_NOTICE).toMatch(/shared with Blueprint and with the robot deployment companies we approve/);
    // No sentence on either page says the video stays private or never reaches a company.
    expect(`${termsText}\n${privacyText}`).not.toMatch(/never (?:give your recording to|delivered to) a robot team|video stays private|anonymized job card/i);
  });

  it("is not licensed for training, and faces are blurred only for World Labs", () => {
    expect(termsText).toContain("We do not license your recording to anyone for training without your written agreement.");
    expect(termsText).toContain("we blur faces only in the frames we send to World Labs");
    expect(termsText).toContain("Companies see your video as you filmed it, without its sound.");
    expect(annexRow("People in job footage")).toContain("We blur faces in the frames we send to World Labs");
    expect(annexRow("People in job footage")).toContain("Companies see your video as you filmed it, without its sound.");
  });

  it("agrees with the site assessment copy", () => {
    expect(siteAssessment.whatWeGetFromIt).toMatch(/see your job, with your video without its sound, only to decide whether they can do it/);
    expect(siteAssessment.whatWeGetFromIt).not.toMatch(/never receive your recording/i);
  });
});

describe("a company's name", () => {
  it("reaches a site only through an introduction", () => {
    expect(rolePrivacyAnnex.find(role => role.title === "Deployment companies")?.body).toContain(PROMISES.companyAlias);
    expect(termsText).toContain(PROMISES.companyAlias);
  });
});

describe("withdrawal", () => {
  it("closes every company's view at once, and says what cannot be taken back", () => {
    expect(annexRow("Withdrawal")).toBe(PROMISES.withdrawal);
    expect(privacyPolicySections.find(section => section.title === "Your choices")?.body).toContain(PROMISES.withdrawal);
  });
});
