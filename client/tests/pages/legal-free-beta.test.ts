/**
 * The legal pages state the free beta the founder set on 2026-10-13: nothing
 * Blueprint does is charged, Blueprint recommends one team whose evaluation
 * passed, and the physical pilot is agreed between the site and the team.
 */
import { describe, expect, it } from "vitest";

import {
  capturePrivacyAnnex,
  californiaPrivacyRows,
  inPersonVisitPrivacy,
  jobClosedDefinition,
  privacyPolicySections,
  privacySubprocessorCategories,
} from "@/pages/Privacy";
import { termsSections } from "@/pages/Terms";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legalAcceptance";

const terms = JSON.stringify(termsSections);
const privacy = JSON.stringify({ privacyPolicySections, californiaPrivacyRows, inPersonVisitPrivacy, jobClosedDefinition, privacySubprocessorCategories });

describe("terms for the free beta", () => {
  it("is versioned for the free-beta decision", () => {
    expect(TERMS_VERSION).toBe("2026-10-14.2");
    expect(PRIVACY_VERSION).toBe("2026-10-14.1");
  });

  it("charges nothing and invoices nothing", () => {
    expect(terms).toMatch(/booking the recommended pilot cost the site nothing/);
    expect(terms).toMatch(/no Blueprint fee, invoice or payment step/);
    expect(terms).not.toMatch(/\$2,500|\$99\b|invoices the site|No pilot, no fee/);
    expect(terms).not.toMatch(/refund your fee/i);
  });

  it("recommends one team whose evaluation passed and keeps the pilot between the site and the team", () => {
    expect(terms).toMatch(/recommends one robot team whose evaluation on your job passed/);
    expect(terms).toMatch(/do not have to compare teams/);
    expect(terms).toMatch(/site and the robot team agree the physical pilot/);
    expect(terms).toMatch(/takes no percentage of any pilot or deployment/);
    expect(terms).not.toMatch(/\bmatch(?:ed|es|ing)?\b/i);
  });

  it("covers in-person filming visits and Delaware governing law", () => {
    const visit = termsSections.find((section) => /In-person filming visits/.test(section.title));
    expect(visit?.items?.join(" ")).toMatch(/follow the site's safety rules/);
    expect(visit?.items?.join(" ")).toMatch(/limited as described in section 9/);
    const law = termsSections.find((section) => /Governing law/.test(section.title));
    expect(law?.paragraphs?.[0]).toMatch(/laws of the State of Delaware/);
  });

  it("disables paid evaluations and top-ups for robot teams", () => {
    expect(terms).toMatch(/no paid private evaluations, balances, top-ups or checkout/);
  });
});

describe("privacy for the free beta", () => {
  it("drops pricing, matching and checkout language", () => {
    expect(privacy).not.toMatch(/\bmatch(?:ed|es|ing)?\b|runs you buy|your balance|checkout in progress/i);
  });

  it("states California rights and honours Global Privacy Control", () => {
    const ca = californiaPrivacyRows.map(([label, detail]) => `${label}: ${detail}`).join(" ");
    expect(ca).toMatch(/We do not sell personal information/);
    expect(ca).toMatch(/cross-context behavioral advertising/);
    expect(ca).toMatch(/Global Privacy Control/);
  });

  it("defines when a job closes", () => {
    expect(jobClosedDefinition).toMatch(/12 months passing with no activity/);
    expect(jobClosedDefinition).toMatch(/withdrawing permission to use the recording/);
  });

  it("names the AI providers that can receive capture frames", () => {
    const ai = privacySubprocessorCategories.find((group) => /AI/.test(group.category))!;
    const names = ai.providers.map(([name]) => name);
    expect(names).toEqual(expect.arrayContaining(["OpenAI", "Anthropic", "Google Gemini"]));
    expect(ai.providers.find(([name]) => name === "OpenAI")?.[1]).toMatch(/frames from a site capture to draft the job brief/);
  });

  it("treats footage filmed by Blueprint staff like self-filmed footage", () => {
    expect(inPersonVisitPrivacy.map(([, detail]) => detail).join(" ")).toMatch(/handled exactly like footage a site films itself/);
  });
});

describe("recording notice, sound and the listing choice", () => {
  const annex = JSON.stringify(capturePrivacyAnnex);

  it("requires notice to people seen or heard and recommends avoiding conversations", () => {
    expect(terms).toMatch(/Share only footage you are authorized to share/);
    expect(terms).toMatch(/tell the people in the work area that you are recording and that the video will be shared with Blueprint/);
    expect(terms).toMatch(/from people who can be seen or heard/);
    expect(terms).toMatch(/avoid recording conversations and turn sound off/);
    expect(annex).toMatch(/tell people in the work area that you are recording and sharing the video with Blueprint/);
  });

  it("keeps the original as received, removes sound before automated review and does not analyze speech", () => {
    for (const text of [terms, privacy, annex]) {
      expect(text).toMatch(/remove (?:its |the )?sound before any automated review/);
      expect(text).toMatch(/do not analyze speech/);
    }
    expect(terms).toMatch(/keeps your original upload as received/);
    expect(privacy).toMatch(/keep the original upload as received, including any sound/);
    const ai = privacySubprocessorCategories.find((group) => /AI/.test(group.category))!;
    for (const name of ["Google Gemini", "World Labs"]) {
      expect(ai.providers.find(([provider]) => provider === name)?.[1]).toMatch(/with its sound removed/);
    }
  });

  it("describes the keep-private choice the start form offers", () => {
    expect(terms).toMatch(/the form shows the anonymized job card .* and lets you keep the job private instead/);
    expect(terms).toMatch(/Unless the site keeps a job private when starting it/);
    expect(`${terms}${annex}`).not.toMatch(/previously chose private handling|previously marked private/);
  });
});
