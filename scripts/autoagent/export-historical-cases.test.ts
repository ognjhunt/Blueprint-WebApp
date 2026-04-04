import { describe, expect, it } from "vitest";

import {
  extractPreviewCase,
  extractSupportCase,
  extractWaitlistCase,
  pickDatasetSplit,
} from "./export-historical-cases.ts";

describe("autoagent historical case exporter helpers", () => {
  it("assigns deterministic dataset splits", () => {
    expect(pickDatasetSplit("waitlist_triage-alpha")).toBe(pickDatasetSplit("waitlist_triage-alpha"));
    expect(["dev", "holdout", "shadow"]).toContain(pickDatasetSplit("waitlist_triage-alpha"));
  });

  it("extracts a waitlist case from a resolved document", () => {
    const exported = extractWaitlistCase("submission-1", {
      email: "ada@example.com",
      email_domain: "example.com",
      location_type: "retail",
      market: "Durham",
      role: "capturer",
      device: "iPhone 15 Pro",
      phone: "555-0000",
      source: "capture_app_private_beta",
      status: "invite_ready",
      queue: "capturer_beta_invite_review",
      filter_tags: ["market:durham"],
      automation_confidence: 0.91,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-02T00:00:00.000Z",
      ops_automation: {
        status: "completed",
        recommendation: "invite_now",
        recommended_path: "capturer_beta_invite_review",
        next_action: "Send invite",
        rationale: "Strong fit.",
        market_summary: "Strong local market.",
        market_fit_score: 88,
        device_fit_score: 93,
        invite_readiness_score: 90,
        draft_email: {
          subject: "Invite",
          body: "Welcome",
        },
        market_context: {
          sameMarketCount: 3,
          sameMarketDeviceCount: 2,
          sameMarketPendingCount: 1,
          sameRoleCount: 4,
          recentExamples: [],
        },
      },
    });

    expect(exported?.lane).toBe("waitlist_triage");
    expect(exported?.expected.recommendation).toBe("invite_now");
    expect(exported?.expected.recommended_queue).toBe("capturer_beta_invite_review");
  });

  it("extracts a support case from a resolved document", () => {
    const exported = extractSupportCase("contact-1", {
      name: "Ada Lovelace",
      email: "ada@example.com",
      company: "Analytical Engines",
      city: "Durham",
      state: "NC",
      companyWebsite: "https://analytical.example",
      message: "Please help",
      summary: "Support request",
      requestSource: "contact_request",
      queue: "support_general",
      priority: "normal",
      automation_confidence: 0.92,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
      human_review_required: false,
      ops_automation: {
        status: "completed",
        recommended_path: "general_support",
        queue: "support_general",
        next_action: "Send reply",
        rationale: "Routine support request.",
        internal_summary: "Safe support reply.",
        suggested_response: {
          subject: "Thanks",
          body: "We received your message.",
        },
      },
    });

    expect(exported?.lane).toBe("support_triage");
    expect(exported?.expected.category).toBe("general_support");
    expect(exported?.expected.queue).toBe("support_general");
  });

  it("extracts a preview case from a resolved inbound request", async () => {
    const exported = await extractPreviewCase("request-1", {
      requestId: "request-1",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
      contact: {
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        roleTitle: "Ops Lead",
        company: "Analytical Engines",
      },
      request: {
        budgetBucket: "$50K-$300K",
        requestedLanes: ["qualification"],
        helpWith: [],
        buyerType: "site_operator",
        siteName: "Durham Facility",
        siteLocation: "Durham, NC",
        taskStatement: "Review a picking workflow.",
      },
      human_review_required: true,
      automation_confidence: 0.84,
      ops_automation: {
        status: "blocked",
        queue: "preview_release_review",
        recommended_path: "provider_escalation",
        next_action: "Escalate to provider review",
        retryable: false,
        requires_human_review: true,
        retry_recommended: false,
        rationale: "Provider-side artifact issue.",
        internal_summary: "Provider escalation needed.",
      },
      deployment_readiness: {
        preview_status: "failed",
        provider_run: {
          provider_name: "worldlabs",
          provider_model: "wm-preview",
          provider_run_id: "run-1",
          failure_reason: "artifact mismatch",
          preview_manifest_uri: "gs://preview.json",
        },
      },
      pipeline: {
        scene_id: "scene-1",
        artifacts: {
          worldlabs_operation_manifest_uri: "gs://operation.json",
          worldlabs_world_manifest_uri: "gs://world.json",
        },
      },
    });

    expect(exported?.lane).toBe("preview_diagnosis");
    expect(exported?.expected.disposition).toBe("provider_escalation");
    expect(exported?.input.provider_name).toBe("worldlabs");
  });
});
