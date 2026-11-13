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
  ANNOUNCED_SUPERSEDED_VERSION,
  acceptedVersionsAreCurrent,
  legalEffectiveAtMs,
  legalEffectiveDate,
  legalUpdatePending,
} from "@/lib/legalAcceptance";

const terms = JSON.stringify(termsSections);
const privacy = JSON.stringify({ privacyPolicySections, californiaPrivacyRows, jobClosedDefinition, privacySubprocessorCategories });

describe("terms for the free beta", () => {
  it("describes footage processing as it happens: no person removal, faces blurred only for World Labs, Meta listed", () => {
    // Owner decision D-16 (2026-11-02): footage is not screened or blurred for providers beyond the World Labs face blur.
    expect(privacy).not.toMatch(/We remove people from the frames/);
    expect(privacy).toMatch(/We do not remove people from job footage/);
    expect(privacy).toMatch(/blur faces in the frames we send to World Labs/);
    const providers = privacySubprocessorCategories.flatMap((group) => group.providers.map(([name]) => name));
    expect(providers).toContain("Meta");
    expect(privacy).not.toMatch(/to flag privacy issues/);
  });

  it("counts only the 2026-11-12 sharing version once it is in force: every older acceptance is asked again", () => {
    const after = legalEffectiveAtMs(TERMS_VERSION);
    expect(acceptedVersionsAreCurrent(TERMS_VERSION, PRIVACY_VERSION, after)).toBe(true);
    for (const [termsVersion, privacyVersion] of [["2026-11-15.4", "2026-11-15.5"], [PREVIOUS_TERMS_VERSION, PREVIOUS_PRIVACY_VERSION],
      [ANNOUNCED_SUPERSEDED_VERSION, ANNOUNCED_SUPERSEDED_VERSION], ["2026-11-15.3", "2026-11-15.4"]]) {
      expect(acceptedVersionsAreCurrent(termsVersion, privacyVersion, after)).toBe(false);
      expect(acceptedVersionsAreCurrent(termsVersion, privacyVersion, Date.parse("2026-11-20T00:00:00Z"))).toBe(false);
    }
  });

  it("keeps Terms 2026-11-12.2 and puts Privacy 2026-11-13.1 in force at once; a Privacy-only change asks nobody again", () => {
    // Owner, 2026-11-12: sharing is the service (2026-11-12.1), then no limit on introductions (Terms 2026-11-12.2, the
    // same day). Owner decision 1 of 2026-11-13: Anthropic may process a new job like OpenAI (Privacy 2026-11-13.1 only;
    // the Terms keep their id). The version published ahead for November 25 never took effect.
    expect(TERMS_VERSION).toBe("2026-11-12.2");
    expect(PRIVACY_VERSION).toBe("2026-11-13.1");
    expect(ANNOUNCED_SUPERSEDED_VERSION).toBe("2026-11-25.1");
    expect([PREVIOUS_TERMS_VERSION, PREVIOUS_PRIVACY_VERSION]).toEqual(["2026-11-12.1", "2026-11-12.2"]);
    const now = Date.parse("2026-11-13T09:00:00Z");
    // Accepted before this release (Terms and Privacy 2026-11-12.2): still current, nothing is asked again.
    expect(acceptedVersionsAreCurrent("2026-11-12.2", "2026-11-12.2", now)).toBe(true);
    expect(acceptedVersionsAreCurrent("2026-11-12.2", "2026-11-13.1", now)).toBe(true);
    // A Terms change still asks again: whoever accepted Terms 2026-11-12.1 is asked, with either Privacy version.
    expect(acceptedVersionsAreCurrent("2026-11-12.1", "2026-11-12.1", now)).toBe(false);
    expect(acceptedVersionsAreCurrent("2026-11-12.1", "2026-11-13.1", now)).toBe(false);
    // A Privacy version older than the one it replaced by a new-jobs-only change still asks again.
    expect(acceptedVersionsAreCurrent("2026-11-12.2", "2026-11-02.1", now)).toBe(false);
    expect(legalEffectiveDate(TERMS_VERSION)).toBe("November 12, 2026");
    expect(legalEffectiveDate(PRIVACY_VERSION)).toBe("November 13, 2026");
    expect(legalUpdatePending(Date.parse("2026-11-13T08:00:00Z"))).toBe(false);
  });

  it("charges nothing and invoices nothing", () => {
    expect(terms).toMatch(/our early trial and sharing your job with deployment companies cost the site nothing/);
    expect(terms).toMatch(/no Blueprint fee, invoice or payment step/);
    // The money sentence stays word for word (owner, 2026-11-12).
    expect(terms).toContain("Blueprint charges no fee for and takes no percentage of any pilot or deployment. If the site goes ahead, the site and the deployment company agree the physical pilot's dates, scope and any price directly, and the deployment company or its integrator contracts for the physical work.");
    expect(terms).not.toMatch(/\$2,500|\$99\b|invoices the site|No pilot, no fee/);
    expect(terms).not.toMatch(/refund your fee/i);
  });

  it("has Blueprint run the early trial and keeps the pilot between the site and the deployment company", () => {
    expect(terms).toMatch(/run openly available robot software in that simulation ourselves as an early trial/);
    expect(terms).toMatch(/Deployment companies do not run their own software on a site's job in our simulation/);
    expect(terms).toMatch(/site and the deployment company agree the physical pilot/);
    expect(terms).not.toMatch(/recommended pilot|invite robot teams|book the recommended/i);
    expect(terms).toMatch(/takes no percentage of any pilot or deployment/);
    expect(terms).not.toMatch(/\bmatch(?:ed|es|ing)?\b/i);
  });

  it("no longer offers filming visits, and keeps Delaware governing law", () => {
    // Owner, 2026-11-11: Blueprint filming visits are retired.
    const visit = termsSections.find((section) => /filming visits/i.test(section.title));
    expect(visit?.title).toBe("4. Earlier filming visits");
    expect(JSON.stringify(visit)).toMatch(/Blueprint no longer films jobs in person/);
    expect(terms).not.toMatch(/has Blueprint film it|ask Blueprint staff to film|Austin metro/);
    const law = termsSections.find((section) => /Governing law/.test(section.title));
    expect(law?.paragraphs?.[0]).toMatch(/laws of the State of Delaware/);
  });

  it("disables paid evaluations and top-ups, and drops what the removal made untrue (API keys, agent actions, policies)", () => {
    expect(terms).toMatch(/no paid private evaluations, balances, top-ups or checkout/);
    expect(terms).not.toMatch(/API key|our published API|actions an agent takes|policies you were not entitled|container images|Teams do not run/);
    expect(privacy).not.toMatch(/robot teams' evaluations|Robot team sharing|endpoints or container images|through our API/);
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

  it("no longer describes visits as a way video is collected", () => {
    expect(privacy).not.toMatch(/Blueprint staff film it|ask Blueprint staff to film|In-person filming visits/);
  });
});

describe("recording notice, sound and the listing choice", () => {
  const annex = JSON.stringify(capturePrivacyAnnex);

  it("requires notice to people seen or heard and recommends avoiding conversations", () => {
    expect(terms).toMatch(/Share only footage you are authorized to share/);
    expect(terms).toMatch(/tell the people in the work area that you are recording and that the video will be shared with Blueprint and with the robot deployment companies we approve/);
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

  // Owner, 2026-11-12: sharing is the service; no share choice, no hiding, only withdrawal.
  it("describes the sharing every started job carries, and no keep-private or hide choice", () => {
    expect(terms).toMatch(/Starting a job means we share it with robot deployment companies we've approved/);
    expect(terms).not.toMatch(/You can hide it at any time|anonymized job card/);
    expect(`${terms}${privacy}`).not.toMatch(/keep the job private instead|keeps a job private when starting|chose to keep/);
    expect(`${terms}${annex}`).not.toMatch(/previously chose private handling|previously marked private/);
  });
});

describe("acceptance while a reissue is announced", () => {
  it("keeps the versions in force usable only before the announced versions take effect", async () => {
    const legal = await import("@/lib/legalAcceptance");
    const effective = legal.legalEffectiveAtMs(legal.TERMS_VERSION);
    expect(legal.acceptedVersionsAreCurrent(legal.PREVIOUS_TERMS_VERSION, legal.PREVIOUS_PRIVACY_VERSION, effective - 1)).toBe(true);
    for (const now of [effective, effective + 1, effective + 86400000]) {
      expect(legal.acceptedVersionsAreCurrent(legal.PREVIOUS_TERMS_VERSION, legal.PREVIOUS_PRIVACY_VERSION, now)).toBe(false);
      expect(legal.acceptedVersionsAreCurrent(legal.TERMS_VERSION, legal.PRIVACY_VERSION, now)).toBe(true);
    }
    for (const [terms, privacy] of [
      ["2026-11-15.1", "2026-11-15.4"], ["2026-11-15.2", "2026-11-15.4"], ["2026-11-15.3", "2026-11-15.4"],
      ["2026-11-15.2", legal.PREVIOUS_PRIVACY_VERSION], [undefined, "2026-11-15.4"],
    ]) expect(legal.acceptedVersionsAreCurrent(terms, privacy, effective - 1)).toBe(false);
  });

  it("preserves the recorded acceptance and writes the latest versions for a new acceptance", async () => {
    const legal = await import("@/lib/legalAcceptance");
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-01T04:50:00Z"));
    try {
      const record = { ...legal.buildLegalAcceptanceRecord({ acceptedAt: "2026-10-23T12:00:00Z" }),
        terms_version: legal.PREVIOUS_TERMS_VERSION, privacy_version: legal.PREVIOUS_PRIVACY_VERSION };
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
