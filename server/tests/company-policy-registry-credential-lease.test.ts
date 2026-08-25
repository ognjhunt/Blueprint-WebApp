// @vitest-environment node
import crypto from "node:crypto";
import {beforeEach, describe, expect, it} from "vitest";

import {
  REGISTRY_CREDENTIAL_LEASE_SCHEMA_VERSION,
  createRegistryCredentialLease,
  decryptRegistryCredentialLease,
  publicRegistryCredentialLease,
} from "../utils/companyPolicyRegistryCredentialLease";

const context = {
  ownerUid: "buyer-123",
  tenantId: "tenant-acme",
  runId: "run-12345678",
  companyId: "acme_robotics",
};

function request() {
  return {
    schema_version: REGISTRY_CREDENTIAL_LEASE_SCHEMA_VERSION,
    submission_id: "submission-12345678",
    contract_digest: `sha256:${"a".repeat(64)}`,
    image: `registry.acme.example/widget-grasp@sha256:${"b".repeat(64)}`,
    registry_username: "oauth2accesstoken",
    registry_secret: "short-lived-secret",
    expires_in_seconds: 300,
    idempotency_key: "credential-12345678",
  };
}

describe("company policy registry credential lease", () => {
  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_MASTER_KEY = crypto.randomBytes(32).toString("base64");
    delete process.env.FIELD_ENCRYPTION_KMS_KEY_NAME;
  });

  it("creates a deterministic opaque lease with no public secret carrier", async () => {
    const first = await createRegistryCredentialLease({
      context,
      value: request(),
      now: new Date("2026-08-25T18:00:00.000Z"),
    });
    const second = await createRegistryCredentialLease({
      context,
      value: request(),
      now: new Date("2026-08-25T18:00:00.000Z"),
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.lease.lease_id).toBe(second.lease.lease_id);
    expect(first.lease.expires_at_iso).toBe("2026-08-25T18:05:00.000Z");
    expect(JSON.stringify(first.lease.encrypted_credential)).not.toContain(
      "short-lived-secret",
    );
    const publicLease = publicRegistryCredentialLease(first.lease);
    expect(publicLease).not.toHaveProperty("encrypted_credential");
    expect(publicLease).not.toHaveProperty("registry_secret");
    expect(JSON.stringify(publicLease)).not.toContain("short-lived-secret");
  });

  it("decrypts only under the exact tenant, run, submission, image, and digest binding", async () => {
    const created = await createRegistryCredentialLease({context, value: request()});
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await expect(
      decryptRegistryCredentialLease({lease: created.lease, context}),
    ).resolves.toEqual({
      registry_server: "registry.acme.example",
      username: "oauth2accesstoken",
      secret: "short-lived-secret",
    });
    await expect(
      decryptRegistryCredentialLease({
        lease: created.lease,
        context: {...context, tenantId: "tenant-other"},
      }),
    ).rejects.toThrow("associated data mismatch");
  });

  it("refuses long-lived, unknown-field, or unpinned requests", async () => {
    for (const value of [
      {...request(), expires_in_seconds: 901},
      {...request(), image: "registry.acme.example/widget-grasp:latest"},
      {...request(), docker_config_json: "secret"},
    ]) {
      const result = await createRegistryCredentialLease({context, value});
      expect(result.ok).toBe(false);
    }
  });
});
