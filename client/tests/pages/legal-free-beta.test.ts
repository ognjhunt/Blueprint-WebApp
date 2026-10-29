/**
 * The legal pages state the free beta the founder set on 2026-10-13: nothing
 * Blueprint does is charged, Blueprint recommends one team whose evaluation
 * passed, and the physical pilot is agreed between the site and the team.
 */
import { describe, expect, it, vi } from "vitest";

import {
  betaRetentionSchedule,
  capturePrivacyAnnex,
  californiaPrivacyRows,
  inPersonVisitPrivacy,
  jobClosedDefinition,
  privacyPolicySections,
  privacySubprocessorCategories,
} from "@/pages/Privacy";
import { termsSections } from "@/pages/Terms";
import {
  PREVIOUS_PRIVACY_VERSION,
  PREVIOUS_TERMS_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
  legalEffectiveDate,
  legalUpdatePending,
} from "@/lib/legalAcceptance";

const terms = JSON.stringify(termsSections);
const privacy = JSON.stringify({ privacyPolicySections, californiaPrivacyRows, inPersonVisitPrivacy, jobClosedDefinition, privacySubprocessorCategories });

describe("terms for the free beta", () => {
  it("is reissued with a future effective date and keeps the previous version in force", () => {
    // Owner decision 2026-10-15: published 2026-10-15, in force 30+ days later.
    expect(TERMS_VERSION).toBe("2026-11-15.3");
    expect(PRIVACY_VERSION).toBe("2026-11-15.4");
    expect([PREVIOUS_TERMS_VERSION, PREVIOUS_PRIVACY_VERSION]).toEqual(["2026-10-14.1", "2026-10-13.1"]);
    expect(legalEffectiveDate(TERMS_VERSION)).toBe("November 15, 2026");
    expect(legalUpdatePending(Date.parse("2026-11-14T23:59:00-08:00"))).toBe(true);
    expect(legalUpdatePending(Date.parse("2026-11-15T00:00:00-08:00"))).toBe(false);
  });

  it("charges nothing and invoices nothing", () => {
    expect(terms).toMatch(/the evaluation and its result cost the site nothing/);
    expect(terms).toMatch(/no Blueprint fee, invoice or payment step/);
    expect(terms).not.toMatch(/\$2,500|\$99\b|invoices the site|No pilot, no fee/);
    expect(terms).not.toMatch(/refund your fee/i);
  });

  it("has Blueprint run the evaluation and keeps the pilot between the site and the deployment company", () => {
    expect(terms).toMatch(/run candidate robot policies in that simulation ourselves/);
    expect(terms).toMatch(/Teams do not run their own evaluations of a site's job/);
    expect(terms).toMatch(/site and the deployment company agree the physical pilot/);
    expect(terms).not.toMatch(/recommended pilot|invite robot teams|book the recommended/i);
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

  it("lists the providers the code uses, and not the waived Redis", () => {
    const providers = new Map(privacySubprocessorCategories.flatMap((group) => group.providers.map(([name, use]) => [name, use] as const)));
    expect(providers.get("Twilio")).toMatch(/phone line.*text messages that send a filming link/);
    expect(providers.get("ElevenLabs")).toMatch(/voice assistant/);
    expect(providers.get("DigitalOcean")).toMatch(/internal operations tools/);
    expect(JSON.stringify(privacySubprocessorCategories)).not.toMatch(/redis/i);
  });

  it("preserves existing recording terms and does not authorize the proposed seven-year extension", () => {
    const footage = betaRetentionSchedule.find((row) => row.record === "Site footage and capture data")!;
    expect(footage.defaultWindow).toMatch(/Existing recordings keep their original retention terms/);
    expect(footage.notes).toMatch(/180 days after the job closes/);
    expect(footage.notes).toMatch(/accepting it later does not extend that period/);
    expect(footage.notes).toMatch(/requires legal review and the notice and authorization/);
    expect(footage.notes).toMatch(/does not currently delete originals automatically/);
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

  it("names reCAPTCHA Enterprise, which App Check sends job and upload requests through", () => {
    const abuse = privacySubprocessorCategories.find((group) => group.category === "Abuse prevention")!;
    expect(abuse.providers[0][0]).toMatch(/Google reCAPTCHA Enterprise, through Firebase App Check/);
    expect(abuse.providers[0][1]).toMatch(/job submission or footage upload/);
  });

  // Owner decision 2026-10-22: the start form offers no keep-private choice.
  it("describes the job card every started job authorizes, and no keep-private choice", () => {
    expect(terms).toMatch(/Starting a job authorizes Blueprint to publish an anonymized job card/);
    expect(terms).toMatch(/You can hide it at any time/);
    expect(`${terms}${privacy}`).not.toMatch(/keep the job private instead|keeps a job private when starting|chose to keep/);
    expect(`${terms}${annex}`).not.toMatch(/previously chose private handling|previously marked private/);
  });
});

describe("acceptance while a reissue is announced", () => {
  it("keeps an earlier announced pair usable only before its existing effective date", async () => {
    const legal = await import("@/lib/legalAcceptance");
    const effective = Date.parse("2026-11-15T08:00:00.000Z");
    expect(legal.acceptedVersionsAreCurrent("2026-11-15.2", "2026-11-15.4", effective - 1)).toBe(true);
    for (const now of [effective, effective + 1, effective + 86400000]) {
      expect(legal.acceptedVersionsAreCurrent("2026-11-15.2", "2026-11-15.4", now)).toBe(false);
      expect(legal.acceptedVersionsAreCurrent(legal.TERMS_VERSION, legal.PRIVACY_VERSION, now)).toBe(true);
    }
    for (const [terms, privacy] of [
      ["2026-11-15.1", "2026-11-15.4"], ["2026-11-15.2", "2026-11-15.3"],
      ["2026-11-15.2", legal.PREVIOUS_PRIVACY_VERSION], [undefined, "2026-11-15.4"],
    ]) expect(legal.acceptedVersionsAreCurrent(terms, privacy, effective - 1)).toBe(false);
  });

  it("preserves the recorded acceptance and writes the latest versions for a new acceptance", async () => {
    const legal = await import("@/lib/legalAcceptance");
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-10-29T04:50:00Z"));
    try {
      const record = { ...legal.buildLegalAcceptanceRecord({ acceptedAt: "2026-10-23T12:00:00Z" }),
        terms_version: "2026-11-15.2", privacy_version: "2026-11-15.4" };
      const retained = structuredClone(record);
      expect(legal.isCurrentLegalAcceptance(record)).toBe(true);
      expect(legal.isCurrentLegalAcceptance({ ...record, accepted_terms: false })).toBe(false);
      expect(legal.isCurrentLegalAcceptance({ ...record, accepted_terms: undefined })).toBe(false);
      expect(legal.isCurrentLegalAcceptance({ ...record, accepted_at: null })).toBe(false);
      expect(record).toEqual(retained);
      expect(legal.buildLegalAcceptanceRecord({ acceptedAt: "2026-10-29T04:50:00Z" })).toMatchObject({
        accepted_terms: true, terms_version: legal.TERMS_VERSION, privacy_version: legal.PRIVACY_VERSION,
      });
    } finally { clock.mockRestore(); }
  });

  it("counts the versions in force until the new ones take effect, and only the new ones after", async () => {
    const legal = await import("@/lib/legalAcceptance");
    const before = legal.legalEffectiveAtMs(legal.TERMS_VERSION) - 1;
    const after = legal.legalEffectiveAtMs(legal.TERMS_VERSION) + 1;
    expect(legal.acceptedVersionsAreCurrent(legal.PREVIOUS_TERMS_VERSION, legal.PREVIOUS_PRIVACY_VERSION, before)).toBe(true);
    expect(legal.acceptedVersionsAreCurrent(legal.PREVIOUS_TERMS_VERSION, legal.PREVIOUS_PRIVACY_VERSION, after)).toBe(false);
    expect(legal.acceptedVersionsAreCurrent(legal.TERMS_VERSION, legal.PRIVACY_VERSION, before)).toBe(true);
    expect(legal.acceptedVersionsAreCurrent("2026-10-09.1", legal.PREVIOUS_PRIVACY_VERSION, before)).toBe(false);
  });
});
