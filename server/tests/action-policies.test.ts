// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CAPTURER_COMMS_POLICY,
  GROWTH_CAMPAIGN_POLICY,
  INBOUND_POLICY,
  PAYOUT_POLICY,
  PERSONA_LIFECYCLE_POLICY,
  RESCHEDULE_POLICY,
  SITE_ACCESS_POLICY,
  SUPPORT_POLICY,
  WAITLIST_POLICY,
  classifyActionExecution,
  evaluateActionTier,
  validateEmailContent,
  type ActionPayload,
  type DraftOutput,
} from "../agents/action-policies";

// ---------------------------------------------------------------------------
// WAITLIST_POLICY
// ---------------------------------------------------------------------------

describe("WAITLIST_POLICY", () => {
  it("auto-approves when all criteria met", () => {
    const draft: DraftOutput = {
      recommendation: "invite_now",
      confidence: 0.90,
      scores: { market_fit: 80 },
      requires_human_review: false,
      automation_status: "ready",
    };
    expect(WAITLIST_POLICY.autoApproveCriteria(draft)).toBe(true);
  });

  it("rejects auto-approve when confidence too low", () => {
    const draft: DraftOutput = {
      recommendation: "invite_now",
      confidence: 0.70,
      scores: { market_fit: 80 },
    };
    expect(WAITLIST_POLICY.autoApproveCriteria(draft)).toBe(false);
  });

  it("rejects auto-approve when market_fit too low", () => {
    const draft: DraftOutput = {
      recommendation: "invite_now",
      confidence: 0.90,
      scores: { market_fit: 50 },
    };
    expect(WAITLIST_POLICY.autoApproveCriteria(draft)).toBe(false);
  });

  it("rejects auto-approve when recommendation is wrong", () => {
    const draft: DraftOutput = {
      recommendation: "decline_for_now",
      confidence: 0.95,
      scores: { market_fit: 90 },
    };
    expect(WAITLIST_POLICY.autoApproveCriteria(draft)).toBe(false);
  });

  it("rejects auto-approve when requires_human_review is true", () => {
    const draft: DraftOutput = {
      recommendation: "invite_now",
      confidence: 0.90,
      scores: { market_fit: 80 },
      requires_human_review: true,
    };
    expect(WAITLIST_POLICY.autoApproveCriteria(draft)).toBe(false);
  });

  it("rejects auto-approve when automation_status is blocked", () => {
    const draft: DraftOutput = {
      recommendation: "invite_now",
      confidence: 0.90,
      scores: { market_fit: 80 },
      automation_status: "blocked",
    };
    expect(WAITLIST_POLICY.autoApproveCriteria(draft)).toBe(false);
  });

  it("always reviews decline_for_now", () => {
    expect(
      WAITLIST_POLICY.alwaysHumanReview({ recommendation: "decline_for_now" }),
    ).toBe(true);
  });

  it("always reviews when requires_human_review", () => {
    expect(
      WAITLIST_POLICY.alwaysHumanReview({ requires_human_review: true }),
    ).toBe(true);
  });

  it("always reviews when blocked", () => {
    expect(
      WAITLIST_POLICY.alwaysHumanReview({ automation_status: "blocked" }),
    ).toBe(true);
  });

  it("does not force review for normal invite_now", () => {
    expect(
      WAITLIST_POLICY.alwaysHumanReview({
        recommendation: "invite_now",
        requires_human_review: false,
        automation_status: "ready",
      }),
    ).toBe(false);
  });
});

describe("classifyActionExecution", () => {
  it("routes payout actions to the universal founder inbox", () => {
    const decision = classifyActionExecution({
      lane: "payout",
      actionType: "send_email",
      draft: { recommendation: "manual_review" },
      policy: PAYOUT_POLICY,
    });
    expect(decision.executionMode).toBe("universal_founder_inbox");
    expect(decision.irreversibleActionClass).toBe("money_movement");
  });

  it("routes growth sends to the universal founder inbox", () => {
    const decision = classifyActionExecution({
      lane: "growth_campaign",
      actionType: "send_campaign_emails",
      draft: { recommendation: "send_campaign", requires_human_review: true },
      policy: GROWTH_CAMPAIGN_POLICY,
    });
    expect(decision.executionMode).toBe("universal_founder_inbox");
    expect(decision.irreversibleActionClass).toBe("external_send");
  });

  it("routes persona lifecycle sends to the universal founder inbox", () => {
    const decision = classifyActionExecution({
      lane: "lifecycle_cadence",
      actionType: "send_email",
      draft: {
        recommendation: "persona_lifecycle_touch",
        requires_human_review: true,
      },
      policy: PERSONA_LIFECYCLE_POLICY,
    });
    expect(decision.executionMode).toBe("universal_founder_inbox");
    expect(decision.irreversibleActionClass).toBe("external_send");
    expect(decision.reasonCategory).toBe("campaign_or_lifecycle_send_requires_review");
  });

  it("keeps safe waitlist work auto-executable", () => {
    const decision = classifyActionExecution({
      lane: "waitlist",
      actionType: "send_email",
      draft: {
        recommendation: "invite_now",
        confidence: 0.95,
        scores: { market_fit: 90 },
      },
      policy: WAITLIST_POLICY,
    });
    expect(decision.executionMode).toBe("auto_execute");
    expect(decision.irreversibleActionClass).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// INBOUND_POLICY
// ---------------------------------------------------------------------------

describe("INBOUND_POLICY", () => {
  it("auto-approves submitted with high confidence", () => {
    const draft: DraftOutput = {
      recommendation: "submitted",
      confidence: 0.85,
    };
    expect(INBOUND_POLICY.autoApproveCriteria(draft)).toBe(true);
  });

  it("auto-approves needs_more_evidence with high confidence", () => {
    const draft: DraftOutput = {
      recommendation: "needs_more_evidence",
      confidence: 0.80,
    };
    expect(INBOUND_POLICY.autoApproveCriteria(draft)).toBe(true);
  });

  it("rejects auto-approve for qualified_ready", () => {
    const draft: DraftOutput = {
      recommendation: "qualified_ready",
      confidence: 0.95,
    };
    expect(INBOUND_POLICY.autoApproveCriteria(draft)).toBe(false);
  });

  it("always reviews qualified_ready", () => {
    expect(
      INBOUND_POLICY.alwaysHumanReview({ recommendation: "qualified_ready" }),
    ).toBe(true);
  });

  it("always reviews escalated_to_geometry", () => {
    expect(
      INBOUND_POLICY.alwaysHumanReview({
        recommendation: "escalated_to_geometry",
      }),
    ).toBe(true);
  });

  it("does not force review for submitted", () => {
    expect(
      INBOUND_POLICY.alwaysHumanReview({ recommendation: "submitted" }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SUPPORT_POLICY
// ---------------------------------------------------------------------------

describe("SUPPORT_POLICY", () => {
  it("auto-approves general_support with high confidence", () => {
    const draft: DraftOutput = {
      confidence: 0.90,
      category: "general_support",
      priority: "normal",
    };
    expect(SUPPORT_POLICY.autoApproveCriteria(draft)).toBe(true);
  });

  it("rejects auto-approve for high priority", () => {
    const draft: DraftOutput = {
      confidence: 0.90,
      category: "general_support",
      priority: "high",
    };
    expect(SUPPORT_POLICY.autoApproveCriteria(draft)).toBe(false);
  });

  it("always reviews billing_question", () => {
    expect(
      SUPPORT_POLICY.alwaysHumanReview({ category: "billing_question" }),
    ).toBe(true);
  });

  it("always reviews high priority", () => {
    expect(SUPPORT_POLICY.alwaysHumanReview({ priority: "high" })).toBe(true);
  });

  it("does not force review for general_support normal priority", () => {
    expect(
      SUPPORT_POLICY.alwaysHumanReview({
        category: "general_support",
        priority: "normal",
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CAPTURER_COMMS_POLICY
// ---------------------------------------------------------------------------

describe("CAPTURER_COMMS_POLICY", () => {
  it("auto-approves reminder_48h", () => {
    expect(
      CAPTURER_COMMS_POLICY.autoApproveCriteria({
        recommendation: "reminder_48h",
      }),
    ).toBe(true);
  });

  it("auto-approves confirmation", () => {
    expect(
      CAPTURER_COMMS_POLICY.autoApproveCriteria({
        recommendation: "confirmation",
      }),
    ).toBe(true);
  });

  it("rejects auto-approve for cancellation", () => {
    expect(
      CAPTURER_COMMS_POLICY.autoApproveCriteria({
        recommendation: "cancellation",
      }),
    ).toBe(false);
  });

  it("always reviews reschedule_notice", () => {
    expect(
      CAPTURER_COMMS_POLICY.alwaysHumanReview({
        recommendation: "reschedule_notice",
      }),
    ).toBe(true);
  });

  it("always reviews custom", () => {
    expect(
      CAPTURER_COMMS_POLICY.alwaysHumanReview({ recommendation: "custom" }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RESCHEDULE_POLICY
// ---------------------------------------------------------------------------

describe("RESCHEDULE_POLICY", () => {
  it("auto-approves same_day_time_change", () => {
    expect(
      RESCHEDULE_POLICY.autoApproveCriteria({
        recommendation: "same_day_time_change",
      }),
    ).toBe(true);
  });

  it("rejects auto-approve for other recommendations", () => {
    expect(
      RESCHEDULE_POLICY.autoApproveCriteria({
        recommendation: "different_day",
      }),
    ).toBe(false);
  });

  it("always reviews anything that is not same_day_time_change", () => {
    expect(
      RESCHEDULE_POLICY.alwaysHumanReview({
        recommendation: "different_day",
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PAYOUT_POLICY
// ---------------------------------------------------------------------------

describe("PAYOUT_POLICY", () => {
  it("never auto-approves regardless of input", () => {
    expect(
      PAYOUT_POLICY.autoApproveCriteria({
        recommendation: "approve",
        confidence: 1.0,
      }),
    ).toBe(false);
  });

  it("always requires human review", () => {
    expect(PAYOUT_POLICY.alwaysHumanReview({})).toBe(true);
    expect(PAYOUT_POLICY.alwaysHumanReview({ confidence: 1.0 })).toBe(true);
  });

  it("has zero maxDailyAutoSends", () => {
    expect(PAYOUT_POLICY.maxDailyAutoSends).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SITE_ACCESS_POLICY
// ---------------------------------------------------------------------------

describe("SITE_ACCESS_POLICY", () => {
  it("auto-approves initial_outreach", () => {
    expect(
      SITE_ACCESS_POLICY.autoApproveCriteria({
        recommendation: "initial_outreach",
      }),
    ).toBe(true);
  });

  it("rejects auto-approve for follow_up", () => {
    expect(
      SITE_ACCESS_POLICY.autoApproveCriteria({
        recommendation: "follow_up",
      }),
    ).toBe(false);
  });

  it("always reviews non-initial_outreach", () => {
    expect(
      SITE_ACCESS_POLICY.alwaysHumanReview({
        recommendation: "follow_up",
      }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateActionTier
// ---------------------------------------------------------------------------

describe("evaluateActionTier", () => {
  it("returns tier 3 when alwaysHumanReview is true", () => {
    const draft: DraftOutput = { recommendation: "decline_for_now" };
    expect(evaluateActionTier(draft, WAITLIST_POLICY)).toBe(3);
  });

  it("returns tier 1 when autoApproveCriteria is met", () => {
    const draft: DraftOutput = {
      recommendation: "invite_now",
      confidence: 0.95,
      scores: { market_fit: 90 },
    };
    expect(evaluateActionTier(draft, WAITLIST_POLICY)).toBe(1);
  });

  it("returns tier 2 when neither human-review nor auto-approve applies", () => {
    // A draft that doesn't trigger alwaysHumanReview but also doesn't meet
    // autoApproveCriteria (e.g., recommendation is invite_now but confidence
    // is too low).
    const draft: DraftOutput = {
      recommendation: "invite_now",
      confidence: 0.60,
      scores: { market_fit: 90 },
    };
    expect(evaluateActionTier(draft, WAITLIST_POLICY)).toBe(2);
  });

  it("always returns tier 3 for PAYOUT_POLICY", () => {
    expect(evaluateActionTier({}, PAYOUT_POLICY)).toBe(3);
    expect(
      evaluateActionTier(
        { recommendation: "approve", confidence: 1.0 },
        PAYOUT_POLICY,
      ),
    ).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// validateEmailContent
// ---------------------------------------------------------------------------

describe("validateEmailContent", () => {
  const validPayload: ActionPayload = {
    type: "send_email",
    to: "buyer@warehouse-robotics.co",
    subject: "Welcome to Blueprint",
    body: "Thank you for signing up for Blueprint. We are excited to have you on board and look forward to working with you.",
  };

  it("passes valid email content", () => {
    expect(validateEmailContent(validPayload)).toEqual({ valid: true });
  });

  it("rejects missing to address", () => {
    const result = validateEmailContent({ ...validPayload, to: undefined });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Invalid recipient/i);
  });

  it("rejects to address without @", () => {
    const result = validateEmailContent({ ...validPayload, to: "invalid" });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Invalid recipient/i);
  });

  it("rejects reserved example-domain recipients", () => {
    const result = validateEmailContent({
      ...validPayload,
      to: "person@example.com",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/placeholder|reserved|Invalid recipient/i);
  });

  it("rejects reserved example-TLD recipients", () => {
    const result = validateEmailContent({
      ...validPayload,
      to: "person@robotteam.example",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/placeholder|reserved|Invalid recipient/i);
  });

  it("rejects invalid-test-domain recipients", () => {
    const result = validateEmailContent({
      ...validPayload,
      to: "person@robotteam.invalid",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/placeholder|reserved|Invalid recipient/i);
  });

  it("rejects empty subject", () => {
    const result = validateEmailContent({ ...validPayload, subject: "" });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Empty subject/i);
  });

  it("rejects whitespace-only subject", () => {
    const result = validateEmailContent({ ...validPayload, subject: "   " });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Empty subject/i);
  });

  it("rejects body shorter than 50 chars", () => {
    const result = validateEmailContent({ ...validPayload, body: "Short" });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/Body too short/i);
  });

  it("rejects body with {{ placeholder", () => {
    const result = validateEmailContent({
      ...validPayload,
      body: "Hello {{first_name}}, welcome to Blueprint! We are excited to have you on board.",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/placeholder/i);
  });

  it("rejects body with [TODO]", () => {
    const result = validateEmailContent({
      ...validPayload,
      body: "Hello, welcome to Blueprint! [TODO] Add more content here to make this complete.",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/placeholder/i);
  });

  it("rejects body with [NAME]", () => {
    const result = validateEmailContent({
      ...validPayload,
      body: "Hello [NAME], welcome to Blueprint! We are excited to have you on board with us.",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/placeholder/i);
  });

  it("rejects subject with placeholder", () => {
    const result = validateEmailContent({
      ...validPayload,
      subject: "Welcome {{first_name}}",
    });
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/placeholder/i);
  });
});
