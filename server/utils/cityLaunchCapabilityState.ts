export const CITY_LAUNCH_RECIPIENT_BACKED_CONTACTS_ERROR =
  "Activation-ready direct outreach requires 1-3 recipient-backed first-wave contacts with explicit contact_email evidence.";

export type CapabilityStatus =
  | "ready"
  | "warning"
  | "blocked"
  | "pending_upstream_evidence"
  | "external_confirmation_required";

export type CityLaunchCapabilitySnapshot = {
  activation: {
    allowed: boolean;
    blockers: string[];
    warnings: string[];
  };
  execution: {
    contacts: { status: CapabilityStatus; detail: string };
    outbound: { status: CapabilityStatus; detail: string };
    rights: { status: CapabilityStatus; detail: string };
    lawfulAccess: { status: CapabilityStatus; detail: string };
    proofMotion: { status: CapabilityStatus; detail: string };
    hostedReview: { status: CapabilityStatus; detail: string };
    analytics: { status: CapabilityStatus; detail: string };
  };
};

export function assessCityLaunchCapabilities(input: {
  hasCompletedPlaybook: boolean;
  hasActivationPayload: boolean;
  recipientBackedContacts: number;
  senderVerification: "verified" | "unverified" | "unknown" | "unset";
  hasRightsClearedProofAsset: boolean;
  hasHostedReviewStarted: boolean;
  hasSignalProvider: boolean;
}): CityLaunchCapabilitySnapshot {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!input.hasCompletedPlaybook) {
    blockers.push("completed_playbook_missing");
  }
  if (!input.hasActivationPayload) {
    blockers.push("activation_payload_missing");
  }
  if (input.recipientBackedContacts < 1) {
    warnings.push("recipient_backed_contacts_missing");
  }

  return {
    activation: {
      allowed: blockers.length === 0,
      blockers,
      warnings,
    },
    execution: {
      contacts: {
        status: input.recipientBackedContacts > 0 ? "ready" : "pending_upstream_evidence",
        detail: "Recipient-backed contact evidence is required before autonomous first-wave direct outreach can leave draft.",
      },
      outbound: {
        status:
          input.senderVerification === "verified"
            ? "ready"
            : input.senderVerification === "unverified"
              ? "blocked"
              : "warning",
        detail: "Outbound transport readiness is a send-stage capability, not an activation-stage requirement.",
      },
      rights: {
        status: input.hasRightsClearedProofAsset ? "ready" : "external_confirmation_required",
        detail: "Rights-cleared proof assets remain doctrine-gated external confirmations.",
      },
      lawfulAccess: {
        status: "external_confirmation_required",
        detail: "Private controlled capture still requires lawful-access evidence before field execution.",
      },
      proofMotion: {
        status: input.hasRightsClearedProofAsset ? "ready" : "external_confirmation_required",
        detail: "Proof motion requires real proof evidence instead of planning artifacts alone.",
      },
      hostedReview: {
        status: input.hasHostedReviewStarted ? "ready" : "pending_upstream_evidence",
        detail: "Hosted review is a downstream execution milestone, not an activation precondition.",
      },
      analytics: {
        status: input.hasSignalProvider ? "ready" : "warning",
        detail: "External market signals enrich analytics but must not block first-party city-launch scorecards.",
      },
    },
  };
}

export function demoteRecipientBackedContactError(input: {
  warnings: string[];
  errors: string[];
}) {
  const remainingErrors: string[] = [];
  const warnings = [...input.warnings];

  for (const error of input.errors) {
    if (error === CITY_LAUNCH_RECIPIENT_BACKED_CONTACTS_ERROR) {
      if (!warnings.includes(error)) {
        warnings.push(error);
      }
      continue;
    }
    remainingErrors.push(error);
  }

  return {
    warnings,
    errors: remainingErrors,
  };
}
