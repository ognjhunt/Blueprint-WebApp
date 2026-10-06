// @vitest-environment node
import https from "node:https";
import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LINKEDIN_PEOPLE_SEARCH_PREFIX, linkedinPeopleSearchHint, linkedinPeopleSearchUrl } from "../agents/communications-linkedin-hint";
import { communicationsFixture, syntheticQualification } from "./fixtures/communications";

// A plain search link for the founder. It is never fetched, never stored and never evidence.
afterEach(() => { vi.restoreAllMocks(); });
const networkSpies = () => ({ fetch: vi.spyOn(globalThis, "fetch"), https: vi.spyOn(https, "request"), http: vi.spyOn(http, "request"),
  httpsGet: vi.spyOn(https, "get") });

describe("LinkedIn people-search link for a hypothesis draft (synthetic)", () => {
  it("encodes the role and operator into the people-search keywords, exactly", () => {
    const spies = networkSpies();
    expect(LINKEDIN_PEOPLE_SEARCH_PREFIX).toBe("https://www.linkedin.com/search/results/people/?keywords=");
    expect(linkedinPeopleSearchUrl("operations manager", "Synthetic Sorting Co"))
      .toBe("https://www.linkedin.com/search/results/people/?keywords=operations%20manager%20Synthetic%20Sorting%20Co");
    expect(linkedinPeopleSearchUrl("Director, Ops & Logistics", "Synthétique S.A. #2/3?"))
      .toBe(LINKEDIN_PEOPLE_SEARCH_PREFIX + encodeURIComponent("Director, Ops & Logistics Synthétique S.A. #2/3?"));
    expect(new URL(linkedinPeopleSearchUrl("plant manager", "A&B=C")).searchParams.get("keywords")).toBe("plant manager A&B=C");
    for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled();
  });
  it("uses the published role, then the brief's decision owner, then operations manager", () => {
    const spies = networkSpies();
    const brief: any = { ...communicationsFixture().brief, qualification: syntheticQualification() };
    const inbox = (person: unknown) => ({ ...brief, contact: { ...brief.contact,
      recipient: { kind: "inbox", addressee: "whoever runs Packing at Synthetic packing site", person } } });
    expect(linkedinPeopleSearchHint(inbox({ name: "Synthetic Person", role: "operations manager", sourceUrl: "https://news.example/story" })))
      .toEqual({ role: "operations manager", operator: brief.facilityName, url: linkedinPeopleSearchUrl("operations manager", brief.facilityName) });
    expect(linkedinPeopleSearchHint({ ...brief, contact: { ...brief.contact, recipient: { kind: "named_person", name: "Synthetic Person",
      role: "Plant Director", sourceUrl: "https://facility.example/team" } } })?.role).toBe("Plant Director");
    expect(linkedinPeopleSearchHint({ ...inbox(null), decisionOwner: "Site general manager" })?.role).toBe("Site general manager");
    expect(linkedinPeopleSearchHint(inbox(null))?.role).toBe("operations manager");
    for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled();
  });
  it("gives no link for a verified-lead brief, and adds nothing to the brief it reads", () => {
    const { brief } = communicationsFixture(), before = structuredClone(brief);
    expect(linkedinPeopleSearchHint(brief)).toBeNull();
    const hypothesis: any = { ...brief, qualification: syntheticQualification() }, copy = structuredClone(hypothesis);
    linkedinPeopleSearchHint(hypothesis);
    expect(hypothesis).toEqual(copy);
    expect(brief).toEqual(before);
  });
});
