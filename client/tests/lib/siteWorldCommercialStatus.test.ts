import { describe, expect, it } from "vitest";
import { getSiteWorldById } from "@/data/siteWorlds";
import {
  getSiteWorldCommercialStatus,
  getSiteWorldBuyerFlowDisclosure,
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
      label: "Public sample packet",
    });
    expect(getSiteWorldPublicProofSummary(site!)).toContain("hosted still");
    expect(getSiteWorldVisualDisclosure(site!)).toMatchObject({
      label: "Public sample packet",
      proofBacked: true,
    });
    expect(getSiteWorldReadinessDisclosure(site!)).toContain("public listing proves");
    expect(getSiteWorldBuyerFlowDisclosure(site!)).toMatchObject({
      proofLabel: "Sample-backed package",
    });
    expect(getSiteWorldBuyerFlowDisclosure(site!).packageAccess).toContain("Sample files are visible");
  });

  it("keeps non-demo listings request-scoped instead of overclaiming approval", () => {
    const site = getSiteWorldById("sw-chi-01");
    expect(site).not.toBeNull();

    expect(getSiteWorldCommercialStatus(site!)).toMatchObject({
      id: "request_scoped_review",
      label: "Access-reviewed listing",
    });
    expect(getSiteWorldReadinessDisclosure(site!)).toContain("not a deployment guarantee");
    expect(getSiteWorldReadinessDisclosure(site!)).toContain("Hosted launch is checked separately");
    expect(getSiteWorldVisualDisclosure(site!)).toMatchObject({
      label: "Listing proof preview",
      proofBacked: true,
    });
    expect(getSiteWorldFreshnessSummary(site!)).toBe("Freshness confirmed during request review");
    expect(getSiteWorldPackageAccessSummary(site!)).toContain("request-specific rights");
    expect(getSiteWorldBuyerFlowDisclosure(site!)).toMatchObject({
      proofLabel: "Request-scoped listing",
    });
    expect(getSiteWorldBuyerFlowDisclosure(site!).hostedAccess).toContain("gated");
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
      label: "Planned example profile",
    });
    expect(getSiteWorldPublicProofSummary(site!)).toContain("proof opens after capture/package review");
    expect(getSiteWorldFreshnessSummary(site!)).toContain("Planned");
    expect(getSiteWorldPackageAccessSummary(site!)).toContain("request");
    expect(getSiteWorldVisualDisclosure(site!)).toMatchObject({
      label: "Planned route diagram",
      proofBacked: false,
    });
    expect(getSiteWorldBuyerFlowDisclosure(site!)).toMatchObject({
      proofLabel: "Planned example profile",
    });
  });
});
