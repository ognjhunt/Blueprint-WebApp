import { describe, expect, it } from "vitest";
import { getSiteWorldById } from "@/data/siteWorlds";
import {
  getSiteWorldCommercialStatus,
  getSiteWorldFreshnessSummary,
  getSiteWorldHostedAccessDisclosure,
  getSiteWorldPackageAccessSummary,
  getSiteWorldPublicProofSummary,
  getSiteWorldReadinessDisclosure,
  getSiteWorldVisualDisclosure,
} from "@/lib/siteWorldCommercialStatus";

describe("siteWorldCommercialStatus", () => {
  it("marks the sample listing as a public demo sample without implying blanket approval", () => {
    const site = getSiteWorldById("siteworld-f5fd54898cfb");
    expect(site).not.toBeNull();

    expect(getSiteWorldCommercialStatus(site!)).toMatchObject({
      id: "public_demo_sample",
      label: "Public demo sample",
    });
    expect(getSiteWorldPublicProofSummary(site!)).toContain("hosted still");
    expect(getSiteWorldVisualDisclosure(site!)).toMatchObject({
      label: "Public sample proof",
      proofBacked: true,
    });
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
    expect(getSiteWorldReadinessDisclosure(site!)).toContain("Hosted launch is checked separately");
    expect(getSiteWorldVisualDisclosure(site!)).toMatchObject({
      label: "Listing proof preview",
      proofBacked: true,
    });
    expect(getSiteWorldFreshnessSummary(site!)).toBe("Freshness confirmed during request review");
    expect(getSiteWorldPackageAccessSummary(site!)).toContain("request-specific rights");
    expect(
      getSiteWorldHostedAccessDisclosure({
        ...site!,
        deploymentReadiness: {
          ...(site!.deploymentReadiness || {}),
          native_world_model_primary: true,
        },
      }),
    ).toMatchObject({
      label: "Hosted request path",
      launchVerified: false,
    });
  });

  it("labels static catalog profiles as planned instead of current supply", () => {
    const site = getSiteWorldById("sw-atl-02");
    expect(site).not.toBeNull();

    expect(getSiteWorldCommercialStatus(site!)).toMatchObject({
      id: "planned_catalog_profile",
      label: "Planned catalog profile",
    });
    expect(getSiteWorldPublicProofSummary(site!)).toContain("no listing-specific proof yet");
    expect(getSiteWorldFreshnessSummary(site!)).toContain("Planned");
    expect(getSiteWorldPackageAccessSummary(site!)).toContain("request");
    expect(getSiteWorldVisualDisclosure(site!)).toMatchObject({
      label: "Planned route diagram",
      proofBacked: false,
    });
  });
});
