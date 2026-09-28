import { describe, expect, it } from "vitest";
import { compareDeploymentCoverage } from "../../client/src/lib/deploymentCoverage";
import { toSiteRequirement } from "../utils/siteMatchRun";
import { matchRobotTeam } from "../../client/src/lib/robotMatch";
import type { InboundRequest } from "../types/inbound-request";

const ohio = { country: "US", state: "OH", city: "Columbus", label: "Columbus, Ohio" };

describe("deployment and support coverage", () => {
  it("matches a self-recorded site outside Austin to nationwide coverage", () => {
    expect(compareDeploymentCoverage("outside_texas", ohio, "us_national", null)).toBe("clears");
  });
  it("carries the site's actual location from intake through to matching", () => {
    const request = { request: {
      siteLocation: "Columbus, Ohio", capture_region: "us",
      siteLocationMetadata: { city: "Columbus", state: "OH", country: "US" },
      siteTaskGates: { serviceArea: "outside_texas" },
    } } as unknown as InboundRequest;
    const requirement = toSiteRequirement(request);
    const result = matchRobotTeam(requirement, {
      id: "ohio-team", capability: {}, deploymentGeography: "specific_regions", deploymentRegions: "Ohio",
    });
    expect(result.findings.find((finding) => finding.scaleId === "geography")?.comparison).toBe("clears");
    expect(requirement.location).toMatchObject({ country: "US", state: "OH", city: "Columbus" });
  });
  it("compares declared states with the actual site, rather than the capture area", () => {
    expect(compareDeploymentCoverage(null, ohio, "specific_regions", "Texas; Ohio")).toBe("clears");
    expect(compareDeploymentCoverage(null, ohio, "specific_regions", "Texas")).toBe("short");
  });
  it("uses a full city and state declaration without widening it to the whole state", () => {
    expect(compareDeploymentCoverage(null, ohio, "specific_regions", "Columbus, OH")).toBe("clears");
    expect(compareDeploymentCoverage(null, ohio, "specific_regions", "Cleveland, OH")).toBe("short");
  });
  it("accepts explicit state components of a manually supplied US address", () => {
    const manual = { country: "US", label: "10 Main Street, Columbus, OH 43215" };
    expect(compareDeploymentCoverage(null, manual, "specific_regions", "Ohio")).toBe("clears");
    expect(compareDeploymentCoverage(null, { country: "US", label: "Los Angeles, CA" }, "specific_regions", "California")).toBe("clears");
  });
  it("matches countries internationally without treating nationwide US coverage as global", () => {
    const canada = { country: "CA", label: "Toronto, Canada" };
    expect(compareDeploymentCoverage(null, canada, "specific_regions", "Canada")).toBe("clears");
    expect(compareDeploymentCoverage(null, canada, "us_national", null)).toBe("short");
    expect(compareDeploymentCoverage(null, { label: "Toronto, Canada" }, "specific_regions", "Canada")).toBe("clears");
    expect(compareDeploymentCoverage(null, { label: "Toronto, Canada" }, "specific_regions", "Toronto, Canada")).toBe("clears");
    expect(compareDeploymentCoverage(null, { country: "GB" }, "specific_regions", "UK")).toBe("clears");
    expect(compareDeploymentCoverage(null, { country: "UK" }, "specific_regions", "United Kingdom")).toBe("clears");
  });
  it("keeps missing locations, ambiguous region names and conditional prose provisional", () => {
    expect(compareDeploymentCoverage(null, {}, "us_national", null)).toBe("unknown");
    expect(compareDeploymentCoverage(null, ohio, "specific_regions", "Western Europe")).toBe("unknown");
    expect(compareDeploymentCoverage(null, ohio, "specific_regions", "United States except Ohio")).toBe("unknown");
    expect(compareDeploymentCoverage(null, ohio, "specific_regions", "United States; except Ohio")).toBe("unknown");
    expect(compareDeploymentCoverage(null, ohio, "specific_regions", "Texas; for the right contract")).toBe("unknown");
    expect(compareDeploymentCoverage(null, ohio, "specific_regions", "CA")).toBe("unknown");
    expect(compareDeploymentCoverage(null, { country: "US", state: "GA" }, "specific_regions", "Georgia")).toBe("unknown");
    expect(compareDeploymentCoverage(null, { country: "US", state: "GA" }, "specific_regions", "Georgia, US")).toBe("clears");
  });
  it("keeps a bare city name provisional", () => {
    expect(compareDeploymentCoverage(null, ohio, "specific_regions", "Columbus")).toBe("unknown");
    expect(compareDeploymentCoverage(null, { country: "US", label: "Washington, US" }, "specific_regions", "Washington")).toBe("unknown");
  });
  it("retains historical Austin answers without widening them to other jobs", () => {
    for (const answer of ["yes", "right_opportunity", "size_dependent"]) {
      expect(compareDeploymentCoverage("austin_metro", {}, answer, null)).toBe("clears");
      expect(compareDeploymentCoverage("outside_texas", ohio, answer, null)).toBe("unknown");
    }
    expect(compareDeploymentCoverage("austin_metro", {}, "no", null)).toBe("short");
    expect(compareDeploymentCoverage("outside_texas", ohio, "no", null)).toBe("unknown");
  });
  it("does not match a team with no deployment coverage", () => {
    expect(compareDeploymentCoverage(null, ohio, "not_deploying", null)).toBe("short");
  });
});
