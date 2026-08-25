// @vitest-environment node
import {afterEach, describe, expect, it, vi} from "vitest";

import {
  type CompanyPolicyCandidateHandoff,
  forwardCompanyPolicyCandidateToPipeline,
} from "../utils/companyPolicyCandidateForwarding";
import {buildPipelineSyncSignature} from "../utils/pipelineSyncSecurity";

function handoff(): CompanyPolicyCandidateHandoff {
  return {
    schema_version: "company_policy_container_admission_request.v1",
    tenant_id: "tenant-acme",
    run_id: "run-12345678",
    submission_id: "submission-12345678",
    company_id: "acme_robotics",
    contract_digest: `sha256:${"a".repeat(64)}`,
    contract: {
      rights: {provider_use_status: "authorization granted for this evaluation"},
    },
    registry_credential_lease_id: "lease-12345678",
    claim_ceiling: "development_only",
    launch_authority_granted: false,
    provider_mutation_authorized: false,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("company policy candidate Pipeline forwarding", () => {
  it("sends only the secret-free immutable handoff with a valid HMAC", async () => {
    vi.stubEnv(
      "COMPANY_POLICY_CONTAINER_FORWARD_URL",
      "http://127.0.0.1:8765/api/live-pipeline/company-policy-containers",
    );
    vi.stubEnv("PIPELINE_SYNC_TOKEN", "pipeline-secret");
    vi.stubEnv("COMPANY_POLICY_CONTAINER_FORWARD_REQUIRED", "true");
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => ({
      ok: true,
      status: 201,
      json: async () => ({
        accepted: true,
        admission_id: "admission-1",
        admission_digest: `sha256:${"b".repeat(64)}`,
        blockers: [],
      }),
      init,
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(forwardCompanyPolicyCandidateToPipeline(handoff())).resolves.toMatchObject({
      status: "accepted",
      performed: true,
      accepted: true,
      required: true,
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = String(init.body);
    const timestamp = String((init.headers as Record<string, string>)["X-Blueprint-Pipeline-Timestamp"]);
    expect(body).not.toContain("registry_secret");
    expect(body).not.toContain("encrypted_credential");
    expect((init.headers as Record<string, string>)["X-Blueprint-Pipeline-Signature"]).toBe(
      `sha256=${buildPipelineSyncSignature({secret: "pipeline-secret", timestamp, body})}`,
    );
  });

  it("blocks structural secret carriers and remote cleartext URLs before fetch", async () => {
    vi.stubEnv("PIPELINE_SYNC_TOKEN", "pipeline-secret");
    vi.stubEnv("COMPANY_POLICY_CONTAINER_FORWARD_REQUIRED", "true");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    vi.stubEnv(
      "COMPANY_POLICY_CONTAINER_FORWARD_URL",
      "http://127.0.0.1:8765/api/live-pipeline/company-policy-containers",
    );
    const secretCarrier = handoff();
    secretCarrier.contract = {registry_secret: "must-not-cross"};
    await expect(forwardCompanyPolicyCandidateToPipeline(secretCarrier)).resolves.toMatchObject({
      status: "blocked",
      blockers: ["company_policy_container_handoff_secret_carrier_detected"],
    });

    vi.stubEnv(
      "COMPANY_POLICY_CONTAINER_FORWARD_URL",
      "http://pipeline.example/api/live-pipeline/company-policy-containers",
    );
    await expect(forwardCompanyPolicyCandidateToPipeline(handoff())).resolves.toMatchObject({
      status: "blocked",
      blockers: ["company_policy_container_forward_url_not_https_or_loopback"],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
