/**
 * The legal pages state the free beta the founder set on 2026-10-13: nothing
 * Blueprint does is charged, Blueprint recommends one team whose evaluation
 * passed, and the physical pilot is agreed between the site and the team.
 */
import { describe, expect, it } from "vitest";

import {
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
    expect(TERMS_VERSION).toBe("2026-10-13.1");
    expect(PRIVACY_VERSION).toBe("2026-10-13.1");
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

  it("covers in-person filming visits and leaves governing law unchanged", () => {
    const visit = termsSections.find((section) => /In-person filming visits/.test(section.title));
    expect(visit?.items?.join(" ")).toMatch(/follow the site's safety rules/);
    expect(visit?.items?.join(" ")).toMatch(/limited as described in section 9/);
    const law = termsSections.find((section) => /Governing law/.test(section.title));
    expect(law?.paragraphs?.[0]).toMatch(/laws of the State of North Carolina/);
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
