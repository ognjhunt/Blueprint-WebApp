import { describe, expect, it } from "vitest";
import { getSiteWorldById } from "@/data/siteWorlds";
import {
  getSiteWorldCommercialStatus,
  getSiteWorldPublicProofSummary,
  getSiteWorldReadinessDisclosure,
} from "@/lib/siteWorldCommercialStatus";

describe("siteWorldCommercialStatus", () => {
  it("marks the sample listing as a public demo sample without implying blanket approval", () => {
    const site = getSiteWorldById("siteworld-f5fd54898cfb");
    expect(site).not.toBeNull();

    expect(getSiteWorldCommercialStatus(site!)).toMatchObject({
      id: "public_demo_sample",
      label: "Public demo sample",
    });
    expect(getSiteWorldPublicProofSummary(site!)).toContain("runtime still");
    expect(getSiteWorldReadinessDisclosure(site!)).toContain("public listing proves");
  });

  it("keeps non-demo listings request-scoped instead of overclaiming approval", () => {
    const site = getSiteWorldById("sw-chi-01");
    expect(site).not.toBeNull();

    expect(getSiteWorldCommercialStatus(site!)).toMatchObject({
      id: "request_scoped_review",
      label: "Request-scoped commercial review",
    });
    expect(getSiteWorldReadinessDisclosure(site!)).toContain("not a deployment guarantee");
  });
});
