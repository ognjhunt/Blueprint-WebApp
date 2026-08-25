// @vitest-environment node
import {afterEach, describe, expect, it, vi} from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({dbAdmin: null}));
vi.mock("../logger", () => ({logger: {error: vi.fn()}}));

import {
  forwardStoredCompanyPolicyCandidate,
  validateCompanyPolicyOutboxRecord,
} from "../utils/companyPolicyCandidateOutboxWorker";
import {canonicalArtifactDigest} from "../utils/taskCandidateContract";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function record() {
  const handoff = {
    schema_version: "company_policy_container_admission_request.v1",
    tenant_id: "tenant-buyer-1",
    run_id: "run-12345678",
    submission_id: "policy-candidate-12345678",
    company_id: "acme_robotics",
    contract_digest: sha("a"),
    contract: {schema_version: "company_policy_container_contract.v2"},
    registry_credential_lease_id: "policy-registry-lease-12345678",
    claim_ceiling: "development_only",
    launch_authority_granted: false,
    provider_mutation_authorized: false,
  };
  return {
    schema_version: "company_policy_candidate_outbox.v1",
    submission_id: handoff.submission_id,
    handoff,
    handoff_digest: canonicalArtifactDigest(handoff, "handoff_digest"),
    status: "pending",
    attempt_count: 0,
  };
}

afterEach(() => {
  delete process.env.COMPANY_POLICY_OUTBOX_MAX_ATTEMPTS;
  delete process.env.COMPANY_POLICY_OUTBOX_RETRY_BASE_MS;
});

describe("company policy candidate outbox worker", () => {
  it("delivers only the exact digest-bound no-spend handoff", async () => {
    const forwarder = vi.fn(async () => ({
      status: "accepted",
      performed: true,
      accepted: true,
      required: true,
      admission_id: "company-policy-admission-12345678",
      admission_digest: sha("b"),
      blockers: [],
    }));
    const result = await forwardStoredCompanyPolicyCandidate(record(), forwarder, 1_000);
    expect(result).toMatchObject({
      status: "delivered",
      attempt_count: 1,
      retryable: false,
      launch_authority_granted: false,
      provider_mutation_authorized: false,
    });
    expect(forwarder).toHaveBeenCalledTimes(1);
  });

  it("terminally blocks tampering before any network request", async () => {
    const tampered = record();
    tampered.handoff.contract = {changed: true};
    const forwarder = vi.fn();
    expect(validateCompanyPolicyOutboxRecord(tampered)).toContain(
      "company_policy_outbox_handoff_digest_mismatch",
    );
    const result = await forwardStoredCompanyPolicyCandidate(tampered, forwarder);
    expect(result).toMatchObject({status: "terminal_blocked", retryable: false});
    expect(forwarder).not.toHaveBeenCalled();
  });

  it("backs off transient failures and terminally classifies contract rejection", async () => {
    process.env.COMPANY_POLICY_OUTBOX_RETRY_BASE_MS = "1000";
    const transient = await forwardStoredCompanyPolicyCandidate(
      record(),
      async () => ({
        status: "blocked",
        performed: true,
        accepted: false,
        required: true,
        blockers: ["company_policy_container_forward_timeout"],
      }),
      1_000,
    );
    expect(transient).toMatchObject({
      status: "retry_pending",
      attempt_count: 1,
      next_attempt_at_iso: "1970-01-01T00:00:02.000Z",
      retryable: true,
    });

    const terminal = await forwardStoredCompanyPolicyCandidate(
      record(),
      async () => ({
        status: "blocked",
        performed: true,
        accepted: false,
        required: true,
        pipeline_status: 409,
        blockers: ["admission_conflict"],
      }),
      1_000,
    );
    expect(terminal).toMatchObject({
      status: "terminal_blocked",
      retryable: false,
      blockers: ["admission_conflict", "company_policy_pipeline_terminal_http_409"],
    });
  });
});
