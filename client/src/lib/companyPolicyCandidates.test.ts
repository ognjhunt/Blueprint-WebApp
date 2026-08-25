import {describe, expect, it} from "vitest";

import {
  COMPANY_POLICY_CONTRACT_TEMPLATE,
  buildCompanyPolicyContractSubmission,
} from "./companyPolicyCandidates";

describe("company policy candidate form contract", () => {
  it("server-binds company identity and image digest without a secret carrier", () => {
    const contract = buildCompanyPolicyContractSubmission({
      contractText: JSON.stringify({
        ...COMPANY_POLICY_CONTRACT_TEMPLATE,
        company_id: "caller_spoof",
        contract_digest: `sha256:${"f".repeat(64)}`,
      }),
      companyId: "acme_robotics",
      imageRepository: "registry.acme.example/team/policy",
      imageDigest: `sha256:${"a".repeat(64)}`,
      visibility: "private",
    });
    expect(contract.company_id).toBe("acme_robotics");
    expect(contract).not.toHaveProperty("contract_digest");
    expect(contract.container).toMatchObject({
      image: `registry.acme.example/team/policy@sha256:${"a".repeat(64)}`,
      visibility: "private",
    });
    expect(JSON.stringify(contract)).not.toContain("registry_secret");
  });

  it("refuses malformed JSON, tags, and missing account company identity", () => {
    expect(() => buildCompanyPolicyContractSubmission({
      contractText: "not json",
      companyId: "acme_robotics",
      imageRepository: "registry.acme.example/team/policy",
      imageDigest: `sha256:${"a".repeat(64)}`,
      visibility: "private",
    })).toThrow("not valid JSON");
    expect(() => buildCompanyPolicyContractSubmission({
      contractText: "{}",
      companyId: "",
      imageRepository: "registry.acme.example/team/policy:latest",
      imageDigest: "latest",
      visibility: "public",
    })).toThrow();
  });
});
