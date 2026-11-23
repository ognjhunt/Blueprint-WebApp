/**
 * The legal pages state the free beta the founder set on 2026-10-13: nothing
 * Blueprint does is charged, Blueprint recommends one team whose evaluation
 * passed, and the physical pilot is agreed between the site and the team.
 */
import { describe, expect, it, vi } from "vitest";
import { CITY_STATE_PRIVACY_VERSION, COMPANY_APPLICATION_VERSION, COMPANY_ESTIMATE_TERMS_VERSION, LAUNCH_COPY_VERSION, LIBRARY_MODEL_TERMS_VERSION,
  NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION } from "@/lib/legalAcceptance";

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
  BYGONE_PRIVACY_VERSION,
  BYGONE_TERMS_VERSION,
  FORMER_PRIVACY_VERSION,
  FORMER_TERMS_VERSION,
  LAPSED_TERMS_VERSION,
  OLDER_PRIVACY_VERSION,
  OLDER_TERMS_VERSION,
  PRIOR_PRIVACY_VERSION,
  PAST_PRIVACY_VERSION,
  PAST_TERMS_VERSION,
  PRIOR_TERMS_VERSION,
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
  it("describes footage processing as it happens: no person removal, no blurring for a new job, Meta listed", () => {
    // Owner decision D-16 (2026-11-02): footage is not screened or blurred for providers beyond the World Labs face blur.
    // Owner, 2026-11-17 ("idc about face blurring"): no face blur either for a job started under 2026-11-17.1; a job
    // started under an earlier version keeps it, which the Pipeline decides by the job's recorded Privacy version. Since
    // 2026-11-19.1 the page names those versions: published before November 17, 2026.
    expect(privacy).not.toMatch(/We remove people from the frames/);
    expect(privacy).toMatch(/We do not remove people from job footage or blur them\./);
    expect(privacy).toMatch(/World Labs included, receive the footage, with its sound removed, or frames from it as recorded, which can show people/);
    expect(privacy).toMatch(/For a job started under a version of this policy published before November 17, 2026, we still blur faces in the frames we send to World Labs to rebuild the work area\./);
    expect(privacy.match(/blur faces/g)).toHaveLength(1);
    expect(privacy).not.toMatch(/We blur faces in the frames we send to World Labs/);
    const retention = JSON.stringify(betaRetentionSchedule);
    expect(retention).toMatch(/the frames and any blurred copies we make from them/);
    expect(retention).toMatch(/Scratch files from processing footage that sit in our temporary processing storage/);
    expect(retention).toMatch(/Frames and any blurred copies stored with the capture are kept like the capture/);
    expect(retention).not.toMatch(/blurring footage|the frames and blurred copies|Frames and blurred copies/);
    const providers = privacySubprocessorCategories.flatMap((group) => group.providers.map(([name]) => name));
    expect(providers).toContain("Meta");
    expect(privacy).not.toMatch(/to flag privacy issues/);
  });

  it("counts only the 2026-11-12 sharing version once it is in force: every older acceptance is asked again", () => {
    const after = legalEffectiveAtMs(TERMS_VERSION);
    expect(acceptedVersionsAreCurrent(TERMS_VERSION, PRIVACY_VERSION, after)).toBe(true);
    for (const [termsVersion, privacyVersion] of [["2026-11-15.4", "2026-11-15.5"], [LAPSED_TERMS_VERSION, PAST_PRIVACY_VERSION],
      [ANNOUNCED_SUPERSEDED_VERSION, ANNOUNCED_SUPERSEDED_VERSION], ["2026-11-15.3", "2026-11-15.4"]]) {
      expect(acceptedVersionsAreCurrent(termsVersion, privacyVersion, after)).toBe(false);
      // A day after the current version took effect (2026-11-20 until Terms 2026-11-21.1 moved the date, 2026-11-22 until
      // Terms 2026-11-23.2 moved it).
      expect(acceptedVersionsAreCurrent(termsVersion, privacyVersion, Date.parse("2026-11-24T00:00:00Z"))).toBe(false);
    }
  });

  it("puts the library-model Terms in force at once beside the application Privacy Policy; nobody who had accepted is asked again", () => {
    // Owner, 2026-11-12: sharing is the service (2026-11-12.1), then no limit on introductions (Terms 2026-11-12.2, the
    // same day). Owner decision 1 of 2026-11-13: Anthropic may process a new job like OpenAI (Privacy 2026-11-13.1). Owner,
    // 2026-11-17: no face blurring for a new job (Terms and Privacy 2026-11-17.1), effective at once, and earlier
    // acceptances keep counting. Owner: the early trial dropped on 2026-11-14, permission to update both documents given
    // on 2026-11-19 (Terms and Privacy 2026-11-19.1), effective at once; it only narrows, so earlier acceptances keep
    // counting. Owner, 2026-11-21: the launch-copy legal edits approved (Terms and Privacy 2026-11-21.1), effective at
    // once; they correct the documents to what the Service already does and ask nothing new, so earlier acceptances keep
    // counting. The version published ahead for November 25 never took effect. Owner, 2026-11-23: "yes to the privacy
    // wording" (Privacy 2026-11-23.1, one sentence: a company sees the city, state and country of a job), effective at
    // once; the Terms kept 2026-11-21.1 and earlier acceptances keep counting. Owner, 2026-11-23: "yes, update both"
    // (Terms and Privacy 2026-11-23.2: a company applies, and a site sees its name and website and accepts it),
    // effective at once; earlier acceptances keep counting. Owner, 2026-11-23: "yes build it this way" (Terms 2026-11-23.3:
    // an estimate a company gives with its answer is its own, before a site visit, not a quote), effective at once; the
    // Privacy Policy keeps 2026-11-23.2 and earlier acceptances keep counting. Owner, 2026-11-23: one sentence approved
    // (Terms 2026-11-23.4: a model in a simulation from a public library stays under that library's license; Blueprint
    // does not own it and the Terms do not restrict it), effective at once; it only loosens, the Privacy Policy keeps
    // 2026-11-23.2 and earlier acceptances keep counting.
    expect(TERMS_VERSION).toBe(LIBRARY_MODEL_TERMS_VERSION);
    expect(PRIVACY_VERSION).toBe(COMPANY_APPLICATION_VERSION);
    expect(ANNOUNCED_SUPERSEDED_VERSION).toBe("2026-11-25.1");
    expect([PREVIOUS_TERMS_VERSION, PREVIOUS_PRIVACY_VERSION]).toEqual([COMPANY_ESTIMATE_TERMS_VERSION, CITY_STATE_PRIVACY_VERSION]);
    expect([OLDER_TERMS_VERSION, OLDER_PRIVACY_VERSION]).toEqual([COMPANY_APPLICATION_VERSION, LAUNCH_COPY_VERSION]);
    expect([FORMER_TERMS_VERSION, FORMER_PRIVACY_VERSION]).toEqual([LAUNCH_COPY_VERSION, NO_EARLY_TRIAL_VERSION]);
    expect([PRIOR_TERMS_VERSION, PRIOR_PRIVACY_VERSION]).toEqual([NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION]);
    expect([PAST_TERMS_VERSION, PAST_PRIVACY_VERSION]).toEqual([NO_FACE_BLUR_VERSION, "2026-11-13.1"]);
    expect([BYGONE_TERMS_VERSION, BYGONE_PRIVACY_VERSION]).toEqual(["2026-11-12.2", "2026-11-12.2"]);
    expect(LAPSED_TERMS_VERSION).toBe("2026-11-12.1");
    const now = legalEffectiveAtMs(LIBRARY_MODEL_TERMS_VERSION) + 10 * 3_600_000;
    // Accepted before this release: still current, nothing is asked again.
    for (const [termsVersion, privacyVersion] of [["2026-11-12.2", "2026-11-12.2"], ["2026-11-12.2", "2026-11-13.1"],
      ["2026-11-12.2", NO_FACE_BLUR_VERSION], [NO_FACE_BLUR_VERSION, "2026-11-13.1"], [NO_FACE_BLUR_VERSION, NO_FACE_BLUR_VERSION],
      [NO_EARLY_TRIAL_VERSION, NO_EARLY_TRIAL_VERSION], [LAUNCH_COPY_VERSION, LAUNCH_COPY_VERSION],
      [LAUNCH_COPY_VERSION, CITY_STATE_PRIVACY_VERSION], [COMPANY_APPLICATION_VERSION, COMPANY_APPLICATION_VERSION],
      [COMPANY_ESTIMATE_TERMS_VERSION, COMPANY_APPLICATION_VERSION], [LIBRARY_MODEL_TERMS_VERSION, COMPANY_APPLICATION_VERSION]])
      expect(acceptedVersionsAreCurrent(termsVersion, privacyVersion, now), `${termsVersion} ${privacyVersion}`).toBe(true);
    // What was already asked again stays asked: Terms 2026-11-12.1 and older, with any Privacy version.
    expect(acceptedVersionsAreCurrent("2026-11-12.1", "2026-11-12.1", now)).toBe(false);
    expect(acceptedVersionsAreCurrent("2026-11-12.1", LAUNCH_COPY_VERSION, now)).toBe(false);
    expect(acceptedVersionsAreCurrent("2026-11-02.1", LAUNCH_COPY_VERSION, now)).toBe(false);
    // A Privacy version that did not count before this release still does not.
    expect(acceptedVersionsAreCurrent("2026-11-12.2", "2026-11-02.1", now)).toBe(false);
    expect(acceptedVersionsAreCurrent(LAUNCH_COPY_VERSION, "2026-11-12.1", now)).toBe(false);
    expect(legalEffectiveDate(TERMS_VERSION)).toBe("November 23, 2026");
    expect(legalEffectiveDate(PRIVACY_VERSION)).toBe("November 23, 2026");
    expect(legalUpdatePending(legalEffectiveAtMs(LIBRARY_MODEL_TERMS_VERSION))).toBe(false);
  });

  it("charges nothing and invoices nothing", () => {
    // Terms 2026-11-21.1 (launch copy): the site's cost line is the one money sentence for sites, and the company's the
    // one for companies.
    const items = (number: string) => termsSections.find(section => section.title.startsWith(number))?.items ?? [];
    expect(items("3.")).toContain("Free for sites.");
    expect(items("4.")).toContain("Nothing is charged today.");
    // The money sentence stays word for word (owner, 2026-11-12).
    expect(terms).toContain("Blueprint charges no fee for and takes no percentage of any pilot or deployment. If the site goes ahead, the site and the deployment company agree the physical pilot's dates, scope and any price directly, and the deployment company or its integrator contracts for the physical work.");
    expect(terms).not.toMatch(/\$2,500|\$99\b|invoices the site|No pilot, no fee/);
    // Terms 2026-11-23.3: an estimate a company gives is its own and not a quote; Blueprint states no price of its own.
    expect(terms).toContain("An estimate a deployment company gives with its answer is its own, given before a site visit. It is not a quote, and Blueprint does not check or guarantee it.");
    expect(terms).not.toMatch(/refund your fee/i);
  });

  // Owner: the early trial dropped on 2026-11-14 (Terms 2026-11-19.1): the Terms no longer say Blueprint runs one.
  it("says nothing of an early trial and keeps the pilot between the site and the deployment company", () => {
    expect(`${terms}${privacy}`).not.toMatch(/early trial|openly available robot software/i);
    // Terms 2026-11-21.1 (launch copy): a company may test its own robot in the downloaded simulation; Blueprint tests none.
    expect(terms).toMatch(/Blueprint does not test any robot in the simulation\. Once the simulation can be downloaded, a deployment company may test its own robot in it, using its own tools\./);
    expect(terms).not.toMatch(/Deployment companies do not run their own software/);
    expect(terms).toMatch(/site and the deployment company agree the physical pilot/);
    expect(terms).not.toMatch(/recommended pilot|invite robot teams|book the recommended/i);
    expect(terms).toMatch(/takes no percentage of any pilot or deployment/);
    expect(terms).not.toMatch(/\bmatch(?:ed|es|ing)?\b/i);
  });

  it("no longer offers filming visits, and keeps Delaware governing law", () => {
    // Owner, 2026-11-11: Blueprint filming visits are retired. Owner, 2026-11-21: no outside site ever had one, so the
    // section on earlier visits leaves too (Terms 2026-11-21.1).
    expect(termsSections.find((section) => /filming visits/i.test(section.title))).toBeUndefined();
    expect(terms).not.toMatch(/filming visit|films jobs in person/i);
    expect(terms).not.toMatch(/has Blueprint film it|ask Blueprint staff to film|Austin metro/);
    const law = termsSections.find((section) => /Governing law/.test(section.title));
    expect(law?.paragraphs?.[0]).toMatch(/laws of the State of Delaware/);
  });

  // Owner, 2026-11-21: no outside customer ever bought a pre-beta balance, so the balance and refund clauses leave.
  it("says nothing of paid evaluations, balances or refunds, and drops what the removal made untrue (API keys, agent actions, policies)", () => {
    expect(terms).not.toMatch(/paid private evaluations|balance|top-up|checkout|refund/i);
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
    expect(ai.providers.find(([name]) => name === "OpenAI")?.[1]).toMatch(/frames from its video to draft the job description/);
  });

  it("lists the providers the code uses, and not the waived Redis", () => {
    const providers = new Map(privacySubprocessorCategories.flatMap((group) => group.providers.map(([name, use]) => [name, use] as const)));
    // Owner, 2026-11-21: there is no phone line or voice assistant; Twilio sends texts only and ElevenLabs is not used.
    expect(providers.get("Twilio")).toBe("Text messages that send a filming link to a phone number you give us");
    expect(providers.has("ElevenLabs")).toBe(false);
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
    expect(terms).toMatch(/Starting a job means that, once it has its video, we share it with robot deployment companies we've approved/);
    expect(terms).not.toMatch(/You can hide it at any time|anonymized job card/);
    expect(`${terms}${privacy}`).not.toMatch(/keep the job private instead|keeps a job private when starting|chose to keep/);
    expect(`${terms}${annex}`).not.toMatch(/previously chose private handling|previously marked private/);
  });
});

describe("acceptance while a reissue is announced", () => {
  it("keeps the versions in force usable before and, as the owner decided for the no-blur version, after the new ones take effect", async () => {
    const legal = await import("@/lib/legalAcceptance");
    const effective = legal.legalEffectiveAtMs(legal.TERMS_VERSION);
    expect(legal.acceptedVersionsAreCurrent(legal.PREVIOUS_TERMS_VERSION, legal.PREVIOUS_PRIVACY_VERSION, effective - 1)).toBe(true);
    for (const now of [effective, effective + 1, effective + 86400000]) {
      expect(legal.acceptedVersionsAreCurrent(legal.PREVIOUS_TERMS_VERSION, legal.PREVIOUS_PRIVACY_VERSION, now)).toBe(true);
      expect(legal.acceptedVersionsAreCurrent(legal.LAPSED_TERMS_VERSION, legal.PREVIOUS_PRIVACY_VERSION, now)).toBe(false);
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

  it("counts the versions in force until the new ones take effect, and after only those the new ones list", async () => {
    const legal = await import("@/lib/legalAcceptance");
    const before = legal.legalEffectiveAtMs(legal.TERMS_VERSION) - 1;
    const after = legal.legalEffectiveAtMs(legal.TERMS_VERSION) + 1;
    expect(legal.acceptedVersionsAreCurrent(legal.PREVIOUS_TERMS_VERSION, legal.PREVIOUS_PRIVACY_VERSION, before)).toBe(true);
    expect(legal.acceptedVersionsAreCurrent(legal.PREVIOUS_TERMS_VERSION, legal.PREVIOUS_PRIVACY_VERSION, after)).toBe(true);
    expect(legal.acceptedVersionsAreCurrent(legal.LAPSED_TERMS_VERSION, legal.PAST_PRIVACY_VERSION, after)).toBe(false);
    expect(legal.acceptedVersionsAreCurrent(legal.TERMS_VERSION, legal.PRIVACY_VERSION, before)).toBe(true);
    expect(legal.acceptedVersionsAreCurrent("2026-10-09.1", legal.PREVIOUS_PRIVACY_VERSION, before)).toBe(false);
  });
});
