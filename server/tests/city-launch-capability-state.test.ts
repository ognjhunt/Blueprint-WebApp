// @vitest-environment node
import { describe, expect, it } from "vitest";

import { assessCityLaunchCapabilities } from "../utils/cityLaunchCapabilityState";

describe("city launch capability state", () => {
  it("treats proof and hosted review as execution blockers, not activation blockers", () => {
    const snapshot = assessCityLaunchCapabilities({
      hasCompletedPlaybook: true,
      hasActivationPayload: true,
      recipientBackedContacts: 0,
      senderVerification: "unknown",
      hasRightsClearedProofAsset: false,
      hasHostedReviewStarted: false,
      hasSignalProvider: false,
    });

    expect(snapshot.activation.allowed).toBe(true);
    expect(snapshot.activation.warnings).toContain("recipient_backed_contacts_missing");
    expect(snapshot.execution.proofMotion.status).toBe("external_confirmation_required");
    expect(snapshot.execution.hostedReview.status).toBe("pending_upstream_evidence");
  });

  it("keeps doctrine-required rights gates explicit while allowing activation", () => {
    const snapshot = assessCityLaunchCapabilities({
      hasCompletedPlaybook: true,
      hasActivationPayload: true,
      recipientBackedContacts: 2,
      senderVerification: "verified",
      hasRightsClearedProofAsset: false,
      hasHostedReviewStarted: false,
      hasSignalProvider: false,
    });

    expect(snapshot.activation.allowed).toBe(true);
    expect(snapshot.execution.contacts.status).toBe("ready");
    expect(snapshot.execution.rights.status).toBe("external_confirmation_required");
    expect(snapshot.execution.analytics.status).toBe("warning");
  });
});
