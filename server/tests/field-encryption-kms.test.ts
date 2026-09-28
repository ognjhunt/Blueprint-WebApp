// @vitest-environment node
import crypto from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";

const kms = vi.hoisted(() => ({ options: null as unknown }));
vi.mock("@google-cloud/kms", () => ({ KeyManagementServiceClient: class {
  constructor(options: unknown) { kms.options = options; }
  async encrypt({ plaintext }: { plaintext: Buffer }) { return [{ ciphertext: Buffer.from(plaintext), name: "kms-version-1" }]; }
  async decrypt({ ciphertext }: { ciphertext: Buffer }) { return [{ plaintext: Buffer.from(ciphertext) }]; }
} }));

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); kms.options = null; });

it("uses the deployed JSON service account for KMS and still decrypts older local records", async () => {
  vi.resetModules();
  vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "");
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", JSON.stringify({
    project_id: "proof-project", client_email: "proof@proof-project.iam.gserviceaccount.com", private_key: "test-only-key",
  }));
  vi.stubEnv("FIELD_ENCRYPTION_MASTER_KEY", crypto.randomBytes(32).toString("base64"));
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "");
  const encryption = await import("../utils/field-encryption");
  const old = await encryption.encryptFieldValue("old-record");
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "projects/proof-project/locations/us-central1/keyRings/private-policy/cryptoKeys/leases");
  const binding = "tenant-a\u0000candidate-a";
  const lease = await encryption.encryptBoundFieldValue("private-registry-token", binding);
  expect(lease.dekAlg).toBe("kms");
  expect(kms.options).toEqual({ projectId: "proof-project", credentials: {
    client_email: "proof@proof-project.iam.gserviceaccount.com", private_key: "test-only-key",
  } });
  await expect(encryption.decryptBoundFieldValue(lease, binding)).resolves.toBe("private-registry-token");
  await expect(encryption.decryptBoundFieldValue(lease, "tenant-b\u0000candidate-a")).rejects.toThrow("associated data mismatch");
  await expect(encryption.decryptFieldValue(old)).resolves.toBe("old-record");
});

it("retains ADC when a credential file is configured", async () => {
  vi.resetModules();
  vi.stubEnv("GOOGLE_APPLICATION_CREDENTIALS", "/test-only/adc.json");
  vi.stubEnv("FIREBASE_SERVICE_ACCOUNT_JSON", "invalid-json");
  vi.stubEnv("FIELD_ENCRYPTION_KMS_KEY_NAME", "key");
  const encryption = await import("../utils/field-encryption");
  await encryption.encryptFieldValue("test");
  expect(kms.options).toBeUndefined();
});
