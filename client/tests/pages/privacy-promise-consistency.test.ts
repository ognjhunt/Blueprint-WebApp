/**
 * The promises a site reads before agreeing, pinned so they cannot be weakened silently (PACKAGE_D D1.2 as amended by
 * PACKAGE_E, 2026-11-12: sharing is the service).
 *
 * The Terms, the Privacy Policy and the site's page for its own agreement say the same thing:
 * - a site's name, address and contact details go to a deployment company only through an introduction the site asked for;
 * - the video goes without its sound, only to the deployment companies Blueprint approves, only so they can decide
 *   whether they can do the job;
 * - a company's name reaches a site only through an introduction (since Terms and Privacy 2026-11-23.2: with its website,
 *   beside each answer given under the answer line `company-response-2026-11-23`; its contact details only when the site
 *   accepts it, and an earlier answer stays under an alias);
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
import { COMPANY_RESPONSE_LABELS } from "@/lib/companyResponses";

const termsText = termsSections.flatMap(section => [...(section.paragraphs ?? []), ...(section.items ?? [])]).join("\n");
const privacyText = [...privacyPolicySections.map(section => section.body), ...capturePrivacyAnnex.map(row => row[1]),
  ...rolePrivacyAnnex.map(role => role.body)].join("\n");

function annexRow(label: string): string {
  const row = capturePrivacyAnnex.find((entry) => entry[0] === label);
  expect(row, `annex row "${label}" is missing`).toBeTruthy();
  return row![1];
}

// Terms and Privacy 2026-11-19.1 (owner: the early trial dropped): the sharing sentence no longer names an early trial
// result, the one item that left what a company receives. Nothing a company receives was added.
// Terms and Privacy 2026-11-21.1 (owner approval of 2026-11-21, launch copy): the same promises, clearer and no weaker.
// Sharing says when a job is shared (once it has its video) and why ("decide whether they can do it", not "judge"),
// with every item a company receives still listed; withdrawal says where (the job's page) and still says a saved copy is
// asked to be deleted and cannot be taken back; the older-job sentence uses a US date and says what the site does; the
// company's sentence adds that a site reads its reason, with its name and contact details taken out.
// Terms and Privacy 2026-11-23.2 (owner, 2026-11-23: "yes, update both"): a company applies, and a site sees its name and
// website with each answer and its reason, with its contact details taken out; the site gets the contact details only
// when it accepts the company, and an answer given before November 23, 2026 stays under an alias. The other promises
// stay word for word.
// Terms 2026-11-23.3 (owner, 2026-11-23: "yes build it this way"): two sentences on the estimate a company may give with
// its answer; the Privacy Policy keeps 2026-11-23.2, and every promise below stays word for word on both pages.
// Terms 2026-11-23.4 (owner, 2026-11-23): one sentence in section 6, Ownership, on a model in a simulation that comes from
// a public library; the Privacy Policy keeps 2026-11-23.2, and every promise below stays word for word on both pages.
const PROMISES = {
  sharing: "Starting a job means that, once it has its video, we share it with robot deployment companies we've approved, so they can decide without a visit whether they can do it. We share your description of the job, your video without its sound, the simulation we build from it, what counts as the job done, and our first look at which robots fit.",
  contacts: "We do not share your name, your street address or your contact details with a deployment company unless you ask for an introduction to it.",
  companyUse: "A deployment company may use your job only to decide whether it can do it. It may not pass it on, use it to train software, or keep it after we ask it to delete it.",
  withdrawal: "You can withdraw your job at any time from its page. It then leaves every company's view at once, and we ask any company that saved a copy to delete it. We cannot take back a copy a company has already saved.",
  olderJob: "A job started before November 12, 2026 is shared with companies only after you agree to share it on the job's page.",
  companyApplication: "A site sees your company's name and website with each answer you give and the reason you give, with your contact details taken out. It gets your contact details only when it accepts your application, after you applied or answered Tested it: can do. Answers you gave before November 23, 2026 stay under an alias.",
};

describe("the sharing promises, in the Terms and the Privacy Policy, word for word", () => {
  it.each(Object.entries(PROMISES))("%s", (_, sentence) => {
    expect(termsText).toContain(sentence);
    expect(privacyText).toContain(sentence);
  });

  it("are the same constants on both pages", () => {
    for (const name of ["SHARING_SENTENCE", "CONTACT_DETAILS_SENTENCE", "COMPANY_USE_SENTENCE", "WITHDRAWAL_SENTENCE",
      "OLDER_JOB_SENTENCE", "COMPANY_APPLICATION_SENTENCE"] as const)
      expect((privacy as Record<string, unknown>)[name], name).toBe((terms as Record<string, unknown>)[name]);
  });
});

describe("name, address and contacts", () => {
  it("go to a company only through an introduction the site asked for, on every page that says what is shared", () => {
    expect(annexRow("Deployment companies")).toContain(PROMISES.contacts);
    expect(AGREEING_ALSO_LINE).toBe("We don't share your name, address or contact details unless you ask for an introduction.");
    expect(annexRow("Location")).toMatch(/sees the city, state and country of the job, not the address you typed/);
  });
});

describe("the video", () => {
  it("is shared without its sound, only with approved deployment companies, only to decide whether they can do the job", () => {
    const video = annexRow("Your video");
    expect(video).toMatch(/shared, without its sound, only with the robot deployment companies we approve, and only so they can decide whether they can do the job/);
    expect(video).toContain(PROMISES.companyUse);
    expect(annexRow("Sound")).toMatch(/remove the sound before any automated review, before sending footage to an AI or 3D-processing provider and before a deployment company sees it/);
    expect(termsText).toMatch(/We remove its sound before any automated review, before sending footage to an AI or 3D-processing provider, and before a deployment company sees it/);
    expect(FOOTAGE_UPLOAD_NOTICE).toMatch(/goes to Blueprint and to deployment companies we approve/);
    // No sentence on either page says the video stays private or never reaches a company.
    expect(`${termsText}\n${privacyText}`).not.toMatch(/never (?:give your recording to|delivered to) a robot team|video stays private|anonymized job card/i);
  });

  // Owner, 2026-11-17: no face blurring for a job started under 2026-11-17.1; a job started under an earlier Privacy
  // version keeps the World Labs face blur. Both documents say so in the same terms. Since 2026-11-19.1 they name those
  // versions ("published before November 17, 2026"), so "earlier" cannot be read to take in 2026-11-17.1.
  it("is not licensed for training, and faces are blurred only for an earlier job, only for World Labs", () => {
    expect(termsText).toContain("We do not license your recording to anyone for training without your written agreement.");
    expect(termsText).toContain("We do not remove people from the footage or from frames taken from it, and we do not blur them. For a job started under a version of our Privacy Policy published before November 17, 2026, we still blur faces in the frames we send to World Labs to rebuild the work area.");
    expect(termsText).not.toContain("we blur faces only in the frames we send to World Labs");
    expect(`${termsText}\n${privacyText}`).not.toContain("under an earlier version");
    expect(termsText).toContain("Companies see your video as you filmed it, without its sound.");
    expect(annexRow("People in job footage")).toContain("We do not remove people from job footage or blur them. Blueprint and the listed processing providers, World Labs included, receive the footage, with its sound removed, or frames from it as recorded, which can show people. For a job started under a version of this policy published before November 17, 2026, we still blur faces in the frames we send to World Labs to rebuild the work area.");
    expect(annexRow("People in job footage")).toContain("Companies see your video as you filmed it, without its sound.");
  });

  it("agrees with the site assessment copy", () => {
    expect(siteAssessment.whatWeGetFromIt).toMatch(/see your job, with your video without its sound, only to decide whether they can do it/);
    expect(siteAssessment.whatWeGetFromIt).not.toMatch(/never receive your recording/i);
  });
});

describe("a company's name", () => {
  it("reaches a site with its website beside each answer, and its contact details only when the site accepts it", () => {
    expect(rolePrivacyAnnex.find(role => role.title === "Deployment companies")?.body).toContain(PROMISES.companyApplication);
    expect(termsText).toContain(PROMISES.companyApplication);
    expect(termsText).toContain("A deployment company's answer reaches you with its name and website, with its contact details taken out. An answer given before November 23, 2026 reaches you under an alias.");
  });
});

// Terms 2026-11-23.3: a deployment company may give an estimate with its answer. The Terms tell the site, beside how an
// answer reaches it, that the estimate is the company's own, given before a site visit, not a quote, and that Blueprint
// does not check or guarantee it; they tell the company, beside what a site sees of its answer, that the site sees it as
// an estimate before a site visit, not a quote. Blueprint states no price of its own.
describe("a company's estimate", () => {
  it("is the company's own, before a site visit and not a quote, in the section for sites and the section for companies", () => {
    const items = (number: string) => termsSections.find(section => section.title.startsWith(number))?.items ?? [];
    expect(items("3.").join("\n")).toContain("An answer given before November 23, 2026 reaches you under an alias. An estimate a deployment company gives with its answer is its own, given before a site visit. It is not a quote, and Blueprint does not check or guarantee it.");
    expect(items("4.")).toContain(`${PROMISES.companyApplication} If you give an estimate with your answer, the site sees it as an estimate before a site visit, not a quote.`);
    expect(privacyText).not.toMatch(/not a quote/);
  });
});

// Terms 2026-11-23.4: models from public libraries (Google Scanned Objects, NVIDIA SimReady) go into the simulation a
// deployment company downloads. They stay under their library's license, named in the simulation's README; Blueprint does
// not own them and the Terms do not restrict them. The sentence sits in section 6 right after what Blueprint owns, in the
// same paragraph, so it reads for everyone and for the section on what a deployment company may do with a job. What a
// company may do with the rest of a job, and what a site is told about it, stays word for word.
describe("a model from a public library", () => {
  it("stays under its library's license, right after what Blueprint owns, and the use promises stay as they were", () => {
    const OWNS = "Blueprint owns the Service, our software, and the simulations, their files and the reports we create, subject to the rights these Terms give you, including a site's right to withdraw its job.";
    const ownership = termsSections.find(section => section.title === "6. Ownership")?.paragraphs ?? [];
    expect(ownership).toHaveLength(1);
    expect(ownership[0]).toContain(`${OWNS} ${terms.LIBRARY_MODEL_SENTENCE} If you send us feedback`);
    expect(termsText.split(terms.LIBRARY_MODEL_SENTENCE)).toHaveLength(2);
    expect(termsSections.find(section => section.title === "4. For deployment companies")?.items)
      .toContain("You may use a job only to decide whether you can do it. You may not pass it on, use it to train software, or keep it after we ask you to delete it.");
    expect(termsText).toContain(PROMISES.companyUse);
    expect(privacyText).not.toMatch(/public library/);
  });
});

describe("withdrawal", () => {
  it("closes every company's view at once, and says what cannot be taken back", () => {
    expect(annexRow("Withdrawal")).toBe(PROMISES.withdrawal);
    expect(privacyPolicySections.find(section => section.title === "Your choices")?.body).toContain(PROMISES.withdrawal);
  });
});

// Review M3 and S1: an introduction gives the address too, and the Terms name all five answers. Since Terms and Privacy
// 2026-11-23.2 a site makes the introduction by accepting a company.
describe("what an introduction gives, and the answers a company can give", () => {
  it("says the address goes when the site accepts a company, in the Terms and the Privacy Policy", () => {
    expect(termsText).toContain("When you accept a company that applied or answered Tested it: can do, we give it your name, your address and your contact details, and give you its name and contact details.");
    expect(privacyText).toContain("When a site accepts your application, we give you the site's name, address and contact details.");
    expect(termsText).not.toMatch(/we give it your name and contact details/);
  });

  // Terms 2026-11-21.1: the answers by the labels a company picks (`COMPANY_RESPONSE_LABELS`), the two tested answers
  // once the simulation can be downloaded, in the Service section and the deployment companies' section. Terms
  // 2026-11-23.2: the answer that was Interested is labelled Apply.
  it("lists the five answers by their labels", () => {
    expect(termsText.split("can answer Apply, Not a fit or Need more details.").length - 1).toBe(1);
    expect(termsText.split("can answer each one: Apply, Not a fit or Need more details.").length - 1).toBe(1);
    expect(termsText.split("can also answer Tested it: can do or Tested it: cannot yet.").length - 1).toBe(2);
    for (const label of Object.values(COMPANY_RESPONSE_LABELS)) expect(termsText).toContain(label);
    expect(termsText).not.toMatch(/would need something|interested, not a fit|Interested|Introduce us/);
  });
});
