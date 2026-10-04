// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assessedSiteGeography, quoteNamesSiteLocation } from "../agents/communications-source-assessment";

const site = (location: string, quote: string) => ({
  candidate: { location, organization_url: "https://operator.example/", evidence: [{ claim: "The operator's posting places the role at this site.", quote,
    url: "https://operator.example/jobs/1", publisher: "Operator", source_date: null, source_checked_at: "2026-10-04T18:50:00Z", checked_date: "2026-10-04",
    classification: "operator", claim_kind: "fact", role: "geography", origin: "live", assertion_scope: "current_operational", retrieval: "static", visibility: "public" }] },
  assessment: { rationale: "Synthetic", contact: null, resolvedGaps: [], conflicts: [] as string[],
    geography: { evidenceIndex: 0, countryCode: "US", address: location, rationale: "Synthetic" } },
});

describe("reviewed site geography", () => {
  it.each([
    ["Hagerstown, Maryland, United States", "Location: 11825 Newgate Blvd, Hagerstown, MD 21740, United States"],
    ["Sacramento, California, United States", "Address: 1635 Main Ave. Ste 3. Sacramento, CA 95838"],
    ["Sacramento, California, United States", "Package Handlers, Sacramento, California, United States"],
    ["New York, New York, United States", "Our warehouse at 200 Varick St, New York, NY 10014, USA"],
    ["Washington, District of Columbia, United States", "1100 First St NE, Washington, DC 20002"],
  ])("accepts the site's own address written the way US sources write it: %s", (location, quote) => {
    const { candidate, assessment } = site(location, quote);
    expect(assessedSiteGeography(candidate, assessment)).toMatchObject({ countryCode: "US", scope: "published_business_site" });
  });
  it.each([
    ["another city in the same state", "Hagerstown, Maryland, United States", "Location: 5 Industry Ln, Frederick, MD 21701, United States"],
    ["the same city name in another state", "Hagerstown, Maryland, United States", "Location: 10 Main St, Hagerstown, IN 47346"],
    ["a headquarters elsewhere", "Hagerstown, Maryland, United States", "Headquartered in Memphis, TN; we also ship to Hagerstown customers nationwide."],
    ["tokens far apart", "Hagerstown, Maryland, United States", "Hagerstown is one of many towns our network serves across several regions including Maryland"],
    ["an explicit not-located statement", "Hagerstown, Maryland, United States", "This role is not located in Hagerstown, MD 21740."],
  ])("refuses a quote that does not place this exact site: %s", (_name, location, quote) => {
    const { candidate, assessment } = site(location, quote);
    expect(() => assessedSiteGeography(candidate, assessment)).toThrow("source_assessment_site_geography_invalid");
  });
  it("still requires the assessed address to be the candidate's own location", () => {
    const { candidate, assessment } = site("Hagerstown, Maryland, United States", "Location: 11825 Newgate Blvd, Hagerstown, MD 21740, United States");
    assessment.geography.address = "Frederick, Maryland, United States";
    expect(() => assessedSiteGeography(candidate, assessment)).toThrow("source_assessment_site_geography_invalid");
    expect(quoteNamesSiteLocation("Toronto, ON, Canada", "Toronto, Ontario, Canada")).toBe(false);
  });
});
