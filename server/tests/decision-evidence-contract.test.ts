import { describe, expect, it } from "vitest";

import {
  normalizeDecisionEvidenceRequest,
  projectDecisionEnvelope,
  validateDecisionEnvelope,
  validateDecisionEvidenceRequest,
} from "../utils/decisionEvidenceContract";
import {
  validDecisionEnvelope,
  validDecisionRequest,
} from "./helpers/decision-evidence-fixtures";

const digest = `sha256:${"a".repeat(64)}`;

describe("Decision/Evidence Router contracts", () => {
  it("accepts a decision-oriented request without simulator selection", () => {
    const request = validDecisionRequest();
    const validation = validateDecisionEvidenceRequest(request);

    expect(validation.ok).toBe(true);
    expect(JSON.stringify(request)).not.toMatch(/mujoco|isaac|cosmos|oscar/i);
    expect(request.routing_authority.system).toBe("BlueprintCapturePipeline");
  });

  it("binds owner and tenant only to authenticated identity", () => {
    const submitted = validDecisionRequest({
      owner: {
        user_id: "attacker-selected-owner",
        tenant_id: "attacker-selected-tenant",
        authenticated_by: "firebase",
      },
    });
    const normalized = normalizeDecisionEvidenceRequest({
      value: submitted,
      authenticatedUserId: "buyer-001",
      authenticatedTenantId: "verified-tenant-001",
      sourceRoute: "/api/task-evaluation-runs",
      receivedAtIso: "2026-07-29T12:00:00-05:00",
    });

    expect(normalized.ok).toBe(true);
    if (normalized.ok) {
      expect(normalized.request.owner).toEqual({
        user_id: "buyer-001",
        tenant_id: "verified-tenant-001",
        authenticated_by: "firebase",
      });
    }
  });

  it("rejects client secrets, raw weights, and client-authoritative pricing", () => {
    const withSecret = {
      ...validDecisionRequest(),
      api_token: "do-not-store",
    };
    expect(validateDecisionEvidenceRequest(withSecret)).toMatchObject({ ok: false });

    const withPrice = validDecisionRequest();
    (withPrice.commercial as { client_supplied_price: boolean }).client_supplied_price = true;
    expect(validateDecisionEvidenceRequest(withPrice)).toMatchObject({ ok: false });
  });

  it("accepts a partial decision and preserves exact artifact versions and digests", () => {
    const result = validateDecisionEnvelope(validDecisionEnvelope());
    expect(result.ok).toBe(true);
    expect(result.envelope?.overall.outcome).toBe("partial");
    expect(result.envelope?.artifacts[0]).toMatchObject({
      version: "1.0.0",
      digest_sha256: digest,
    });
  });

  it("rejects a winner inferred from an abstained result", () => {
    const abstained = validDecisionEnvelope();
    abstained.state = "abstained";
    abstained.overall.outcome = "abstained";
    abstained.overall.selected_candidate_ids = ["candidate-a"];

    expect(validateDecisionEnvelope(abstained)).toMatchObject({ ok: false });
  });

  it("fails closed and keeps an unknown future state visible", () => {
    const future = { ...validDecisionEnvelope(), state: "quantum_review" };
    expect(projectDecisionEnvelope(future)).toEqual({
      supported: false,
      reason: "Unsupported Pipeline run state: quantum_review",
      raw_state: "quantum_review",
    });
  });

  it("translates a sufficiently explicit legacy eval request without carrying simulator preference", () => {
    const translated = normalizeDecisionEvidenceRequest({
      authenticatedUserId: "buyer-001",
      sourceRoute: "/api/robot-eval/job-requests",
      receivedAtIso: "2026-07-29T12:00:00-05:00",
      value: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "legacy-job-001",
        buyer_request_id: "legacy-decision-001",
        decision_question: "Can policy A reach the fixture within the accepted risk?",
        site_package: {
          site_id: "site-001",
          site_slug: "site-001",
          site_name: "Receiving cell",
          package_version: "4",
          testbed_digest_sha256: digest,
        },
        requested_tasks: [{ task_id: "reach-fixture" }],
        claims: [
          {
            claim_id: "reach-target",
            statement: "Policy A can reach the target.",
            threshold_ids: ["reach-rate"],
          },
        ],
        thresholds: [
          {
            threshold_id: "reach-rate",
            metric: "reach success rate",
            operator: "gte",
            value: 0.95,
            unit: "ratio",
          },
        ],
        source: { selection_state: { policy_id: "policy-a", task_id: "reach-fixture" } },
        simulator_preference: "mujoco_first",
        execution_request: {
          simulator_routing: {
            selection_policy: { mode: "mujoco_first_unless_proof_requires_isaac" },
          },
        },
      },
    });

    expect(translated.ok).toBe(true);
    if (translated.ok) {
      expect(translated.compatibility).toBe("translated_robot_eval_job_request_v1");
      expect(translated.request.routing_authority.system).toBe("BlueprintCapturePipeline");
      expect(JSON.stringify(translated.request)).not.toMatch(/mujoco|isaac/i);
    }
  });

  it("rejects legacy customer-visible product intent instead of silently reinterpreting it", () => {
    const result = normalizeDecisionEvidenceRequest({
      authenticatedUserId: "buyer-001",
      sourceRoute: "/api/robot-eval/job-requests",
      receivedAtIso: "2026-07-29T12:00:00-05:00",
      value: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "legacy-paid-001",
        product: "Policy Shortlist",
      },
    });

    expect(result).toMatchObject({
      ok: false,
      code: "legacy_commercial_intent_requires_manual_migration",
    });
  });

  it("returns a precise migration error when legacy intent is underspecified", () => {
    const result = normalizeDecisionEvidenceRequest({
      authenticatedUserId: "buyer-001",
      sourceRoute: "/api/robot-eval/job-requests",
      receivedAtIso: "2026-07-29T12:00:00-05:00",
      value: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "legacy-job-002",
        site_package: { site_id: "site-001" },
        simulator_preference: "mujoco_first",
      },
    });

    expect(result).toMatchObject({ ok: false, code: "legacy_testbed_digest_required" });
  });
});
