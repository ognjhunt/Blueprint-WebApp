import { describe, expect, it } from "vitest";
import {
  buildAgentInboundRequestDraft,
  buildContactRequestUrl,
  parseContactRequestPrefill,
} from "@/lib/contactRequestPrefill";

describe("contactRequestPrefill", () => {
  it("parses agent-friendly location, workflow, source, buyer type, and path aliases", () => {
    const prefill = parseContactRequestPrefill(
      "source=site-worlds&buyerType=robot_team&path=hosted-review&location=123%20Unknown%20St&workflow=warehouse%20tote&message=Need%20a%20review",
    );

    expect(prefill).toMatchObject({
      source: "site-worlds",
      buyerType: "robot_team",
      requestPath: "hosted-review",
      commercialRequestPath: "hosted_evaluation",
      siteLocation: "123 Unknown St",
      workflow: "warehouse tote",
      taskStatement: "warehouse tote",
      message: "Need a review",
      primaryNeed: "123 Unknown St",
    });
  });

  it("builds a contact URL with both human-readable and current form prefill keys", () => {
    const href = buildContactRequestUrl({
      source: "site-worlds",
      buyerType: "robot_team",
      requestPath: "hosted-review",
      location: "123 Unknown St",
      workflow: "warehouse tote",
      siteName: "Unknown warehouse",
      targetRobotTeam: "robot-team agent",
      message: "Scope hosted review without granting access.",
    });
    const url = new URL(href, "https://tryblueprint.local");

    expect(url.pathname).toBe("/contact");
    expect(url.searchParams.get("source")).toBe("site-worlds");
    expect(url.searchParams.get("buyerType")).toBe("robot_team");
    expect(url.searchParams.get("path")).toBe("hosted-review");
    expect(url.searchParams.get("location")).toBe("123 Unknown St");
    expect(url.searchParams.get("siteLocation")).toBe("123 Unknown St");
    expect(url.searchParams.get("workflow")).toBe("warehouse tote");
    expect(url.searchParams.get("taskStatement")).toBe("warehouse tote");
    expect(url.searchParams.get("targetRobotTeam")).toBe("robot-team agent");
    expect(url.searchParams.get("proofPathPreference")).toBe("exact_site_required");
    expect(url.searchParams.has("entitlementId")).toBe(false);
    expect(url.searchParams.has("access")).toBe(false);
  });

  it("creates an agent inbound-request draft without access, payment, provider, or hosted grants", () => {
    const draft = buildAgentInboundRequestDraft({
      source: "site-worlds",
      requestPath: "new-capture",
      location: "RDU warehouse aisle",
      workflow: "warehouse tote transfer",
      siteClass: "warehouse aisle",
      sourcePageUrl: "https://tryblueprint.io/contact?source=site-worlds",
    });

    expect(draft).toMatchObject({
      buyerType: "robot_team",
      commercialRequestPath: "capture_access",
      requestedLanes: ["deeper_evaluation"],
      siteLocation: "RDU warehouse aisle",
      taskStatement: "warehouse tote transfer",
      targetSiteType: "warehouse aisle",
      proofPathPreference: "exact_site_required",
      workflowContext: "warehouse tote transfer",
      context: {
        sourcePageUrl: "https://tryblueprint.io/contact?source=site-worlds",
        buyerChannelSourceRaw: "site-worlds",
      },
    });
    expect(draft).not.toHaveProperty("entitlementId");
    expect(draft).not.toHaveProperty("paymentStatus");
    expect(draft).not.toHaveProperty("hostedSessionId");
    expect(draft).not.toHaveProperty("providerRunId");
  });
});
