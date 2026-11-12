// @vitest-environment node
// Route-level tests of the credential broker the Pipeline's policy sandbox calls
// (company_policy_sandbox_executor.py). Moved out of the retired candidate
// routes' test file (2026-11-12); what each case asserts is unchanged. The
// candidate and lease the retired routes wrote are built directly in the fake
// store with the same lease util.
import crypto, {createHmac} from "node:crypto";
import express from "express";
import {createServer, type Server} from "node:http";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, Record<string, unknown>>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  type Reference = {collectionName: string; id: string};
  const reference = (collectionName: string, id: string): Reference => ({collectionName, id});
  const read = (ref: Reference) => {
    const data = state.collections.get(ref.collectionName)?.get(ref.id);
    return {exists: Boolean(data), data: () => data && structuredClone(data)};
  };
  const write = (
    ref: Reference,
    payload: Record<string, unknown>,
    merge = false,
  ) => {
    const collection = state.collections.get(ref.collectionName) || new Map();
    const next = merge ? {...(collection.get(ref.id) || {})} : {};
    for (const [key, value] of Object.entries(structuredClone(payload))) {
      if (value === "__DELETE__") delete next[key];
      else next[key] = value;
    }
    collection.set(ref.id, next);
    state.collections.set(ref.collectionName, collection);
  };
  return {
    default: {
      firestore: {
        Timestamp: {
          fromDate: (value: Date) => ({iso: value.toISOString()}),
        },
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => "__DELETE__",
        },
      },
    },
    dbAdmin: {
      collection: (name: string) => ({
        doc: (id: string) => ({
          ...reference(name, id),
          get: async () => read(reference(name, id)),
          set: async (payload: Record<string, unknown>, options?: {merge?: boolean}) =>
            write(reference(name, id), payload, options?.merge),
        }),
      }),
      runTransaction: async <T>(callback: (transaction: {
        get: (ref: Reference) => Promise<ReturnType<typeof read>>;
        set: (ref: Reference, payload: Record<string, unknown>, options?: {merge?: boolean}) => void;
        update: (ref: Reference, payload: Record<string, unknown>) => void;
      }) => Promise<T>) => callback({
        get: async (ref) => read(ref),
        set: (ref, payload, options) => write(ref, payload, options?.merge),
        update: (ref, payload) => write(ref, payload, true),
      }),
    },
  };
});

const normalizedContract = {
  schema_version: "company_policy_container_contract.v2",
  policy_id: "acme_widget_grasp_v3",
  company_id: "acme_robotics",
  claim_ceiling: "development_only",
  container: {
    visibility: "private",
    image: `registry.acme.example/widget-grasp@sha256:${"c".repeat(64)}`,
  },
  security_profile: {network_mode: "none_with_blueprint_proxy"},
  contract_digest: `sha256:${"d".repeat(64)}`,
};

const SUBMISSION_ID = `policy-candidate-${"9".repeat(40)}`;

async function startServer() {
  const {default: internalCredentials} = await import("../routes/internal-company-policy-registry-credentials");
  const app = express();
  app.use(express.json({limit: "1mb"}));
  app.use("/api/internal/pipeline", internalCredentials);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  return {server, baseUrl: `http://127.0.0.1:${address.port}`};
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function signedPipelineBody(body: Record<string, unknown>) {
  const raw = JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const clientId = "blueprint-policy-sandbox-worker";
  const nonce = `credential-consume-${crypto.randomBytes(24).toString("hex")}`;
  const signature = createHmac("sha256", "credential-broker-secret")
    .update(`${timestamp}.${clientId}.${nonce}.${raw}`)
    .digest("hex");
  return {
    raw,
    headers: {
      "Content-Type": "application/json",
      "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Client-Id": clientId,
      "X-Blueprint-Pipeline-Nonce": nonce,
      "X-Blueprint-Pipeline-Signature": `sha256=${signature}`,
    },
  };
}

async function stageClaimableCredential(secret = "fault-injection-secret") {
  const {createRegistryCredentialLease} = await import("../utils/companyPolicyRegistryCredentialLease");
  const candidate = {submission_id: SUBMISSION_ID};
  const created = await createRegistryCredentialLease({
    context: {ownerUid: "buyer-1", tenantId: "tenant-buyer-1", runId: "run-12345678", companyId: "acme_robotics"},
    value: {
      schema_version: "company_policy_registry_credential_lease.v1",
      submission_id: SUBMISSION_ID,
      contract_digest: normalizedContract.contract_digest,
      image: normalizedContract.container.image,
      registry_username: "robot-team",
      registry_secret: secret,
      expires_in_seconds: 300,
      idempotency_key: "credential-12345678",
    },
  });
  if (!created.ok) throw new Error(`test lease not created: ${created.code}`);
  const leases = state.collections.get("companyPolicyRegistryCredentialLeases") || new Map();
  leases.set(created.lease.lease_id, {
    ...structuredClone(created.lease),
    created_at: "SERVER_TIMESTAMP",
    expires_at: {iso: created.lease.expires_at_iso},
  });
  state.collections.set("companyPolicyRegistryCredentialLeases", leases);
  const lease = {lease_id: created.lease.lease_id};
  const storedLease = leases.get(created.lease.lease_id)!;
  storedLease.admission_id = "admission-1";
  storedLease.admission_digest = `sha256:${"e".repeat(64)}`;
  const claimBody = {
    schema_version: "company_policy_registry_credential_claim.v1",
    tenant_id: "tenant-buyer-1",
    run_id: "run-12345678",
    submission_id: candidate.submission_id,
    company_id: "acme_robotics",
    contract_digest: normalizedContract.contract_digest,
    admission_id: "admission-1",
    admission_digest: `sha256:${"e".repeat(64)}`,
    sandbox_attempt_id: "sandbox-attempt-12345678",
    sandbox_plan_digest: `sha256:${"f".repeat(64)}`,
    pipeline_release_sha: "a".repeat(40),
    worker_identity: "blueprint-policy-sandbox-worker-01",
    purpose: "pull_digest_pinned_company_policy_image",
    image: normalizedContract.container.image,
  };
  return {candidate, lease, storedLease, claimBody};
}

beforeEach(() => {
  process.env.FIELD_ENCRYPTION_MASTER_KEY = crypto.randomBytes(32).toString("base64");
  process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
  process.env.COMPANY_POLICY_CREDENTIAL_BROKER_TOKEN = "credential-broker-secret";
});

afterEach(() => {
  state.collections.clear();
  delete process.env.FIELD_ENCRYPTION_MASTER_KEY;
  delete process.env.PIPELINE_SYNC_TOKEN;
  delete process.env.COMPANY_POLICY_CREDENTIAL_BROKER_TOKEN;
  vi.resetModules();
});

describe("company policy registry credential broker routes", () => {
  it("redelivers a claimed credential after response loss and deletes it only after pull acknowledgement", async () => {
    const {server, baseUrl} = await startServer();
    try {
      // Stored state the retired candidate routes used to write (2026-11-12): the
      // lease is built with the same util and stored in the same collection.
      const secret = "consume-once-secret";
      const {lease, claimBody} = await stageClaimableCredential(secret);
      const signed = signedPipelineBody(claimBody);
      const first = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/claim`,
        {method: "POST", headers: signed.headers, body: signed.raw},
      );
      expect(first.status).toBe(200);
      expect(first.headers.get("cache-control")).toContain("no-store");
      const firstPayload = await first.json() as any;
      expect(firstPayload).toMatchObject({
        ok: true,
        credential: {registry_server: "registry.acme.example", username: "robot-team", secret},
        delivery_receipt: {
          status: "claimed",
          ciphertext_deleted: false,
          redelivered_after_response_loss: false,
        },
      });
      const storedAfterClaim = state.collections
        .get("companyPolicyRegistryCredentialLeases")
        ?.get(lease.lease_id);
      expect(storedAfterClaim?.status).toBe("claimed");
      expect(storedAfterClaim).toHaveProperty("encrypted_credential");
      expect(storedAfterClaim?.claimed_for).toMatchObject({
        admission_id: "admission-1",
        sandbox_attempt_id: "sandbox-attempt-12345678",
        pipeline_release_sha: "a".repeat(40),
        purpose: "pull_digest_pinned_company_policy_image",
      });

      const redeliverySigned = signedPipelineBody(claimBody);
      const redelivery = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/claim`,
        {method: "POST", headers: redeliverySigned.headers, body: redeliverySigned.raw},
      );
      expect(redelivery.status).toBe(200);
      await expect(redelivery.json()).resolves.toMatchObject({
        credential: {secret},
        delivery_receipt: {
          delivery_id: firstPayload.delivery_receipt.delivery_id,
          redelivered_after_response_loss: true,
          ciphertext_deleted: false,
        },
      });

      const acknowledgementBody = {
        ...claimBody,
        schema_version: "company_policy_registry_credential_acknowledgement.v1",
        delivery_id: firstPayload.delivery_receipt.delivery_id,
        image_pull_receipt_digest: `sha256:${"1".repeat(64)}`,
        pulled_image_digest: `sha256:${"c".repeat(64)}`,
      };
      const acknowledgementSigned = signedPipelineBody(acknowledgementBody);
      const acknowledgement = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/acknowledge`,
        {method: "POST", headers: acknowledgementSigned.headers, body: acknowledgementSigned.raw},
      );
      expect(acknowledgement.status).toBe(200);
      await expect(acknowledgement.json()).resolves.toMatchObject({
        ok: true,
        lease_receipt: {
          status: "consumed",
          delivery_id: firstPayload.delivery_receipt.delivery_id,
          image_pull_receipt_digest: `sha256:${"1".repeat(64)}`,
          pulled_image_digest: `sha256:${"c".repeat(64)}`,
          ciphertext_deleted: true,
          idempotent_replay: false,
        },
      });
      const storedAfterAck = state.collections
        .get("companyPolicyRegistryCredentialLeases")
        ?.get(lease.lease_id);
      expect(storedAfterAck?.status).toBe("consumed");
      expect(storedAfterAck).not.toHaveProperty("encrypted_credential");
      expect(state.collections.get("companyPolicyCredentialBrokerNonces")?.size).toBe(3);

      const ackReplaySigned = signedPipelineBody(acknowledgementBody);
      const ackReplay = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/acknowledge`,
        {method: "POST", headers: ackReplaySigned.headers, body: ackReplaySigned.raw},
      );
      expect(ackReplay.status).toBe(200);
      await expect(ackReplay.json()).resolves.toMatchObject({
        lease_receipt: {idempotent_replay: true, ciphertext_deleted: true},
      });
    } finally {
      await stopServer(server);
    }
  });

  it("refuses mismatched or expired credential claims without deleting ciphertext", async () => {
    const {server, baseUrl} = await startServer();
    try {
      const {lease, storedLease, claimBody} = await stageClaimableCredential();
      const mismatched = signedPipelineBody({...claimBody, tenant_id: "tenant-other"});
      const mismatchResponse = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/claim`,
        {method: "POST", headers: mismatched.headers, body: mismatched.raw},
      );
      expect(mismatchResponse.status).toBe(409);
      await expect(mismatchResponse.json()).resolves.toMatchObject({
        code: "registry_credential_lease_binding_mismatch",
      });
      expect(storedLease).toHaveProperty("encrypted_credential");

      storedLease.expires_at_iso = "1970-01-01T00:00:00.000Z";
      const expired = signedPipelineBody(claimBody);
      const expiredResponse = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/claim`,
        {method: "POST", headers: expired.headers, body: expired.raw},
      );
      expect(expiredResponse.status).toBe(410);
      await expect(expiredResponse.json()).resolves.toMatchObject({
        code: "registry_credential_lease_expired",
      });
      expect(storedLease.status).toBe("active");
      expect(storedLease).toHaveProperty("encrypted_credential");
    } finally {
      await stopServer(server);
    }
  });

  it("refuses nonce replay and incorrect or expired pull acknowledgements", async () => {
    const {server, baseUrl} = await startServer();
    try {
      const {lease, claimBody} = await stageClaimableCredential();
      const signedClaim = signedPipelineBody(claimBody);
      const claimResponse = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/claim`,
        {method: "POST", headers: signedClaim.headers, body: signedClaim.raw},
      );
      expect(claimResponse.status).toBe(200);
      const claimPayload = await claimResponse.json() as any;

      const replayResponse = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/claim`,
        {method: "POST", headers: signedClaim.headers, body: signedClaim.raw},
      );
      expect(replayResponse.status).toBe(409);
      await expect(replayResponse.json()).resolves.toMatchObject({
        code: "credential_broker_nonce_replayed",
      });

      const acknowledgement = {
        ...claimBody,
        schema_version: "company_policy_registry_credential_acknowledgement.v1",
        delivery_id: claimPayload.delivery_receipt.delivery_id,
        image_pull_receipt_digest: `sha256:${"1".repeat(64)}`,
        pulled_image_digest: `sha256:${"c".repeat(64)}`,
      };
      const wrongDigest = signedPipelineBody({
        ...acknowledgement,
        pulled_image_digest: `sha256:${"0".repeat(64)}`,
      });
      const wrongDigestResponse = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/acknowledge`,
        {method: "POST", headers: wrongDigest.headers, body: wrongDigest.raw},
      );
      expect(wrongDigestResponse.status).toBe(409);
      await expect(wrongDigestResponse.json()).resolves.toMatchObject({
        code: "registry_credential_acknowledgement_image_digest_mismatch",
      });

      const wrongDelivery = signedPipelineBody({
        ...acknowledgement,
        delivery_id: "policy-registry-delivery-wrong-12345678",
      });
      const wrongDeliveryResponse = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/acknowledge`,
        {method: "POST", headers: wrongDelivery.headers, body: wrongDelivery.raw},
      );
      expect(wrongDeliveryResponse.status).toBe(409);
      await expect(wrongDeliveryResponse.json()).resolves.toMatchObject({
        code: "registry_credential_delivery_id_mismatch",
      });
      const claimedLease = state.collections
        .get("companyPolicyRegistryCredentialLeases")
        ?.get(lease.lease_id);
      expect(claimedLease?.status).toBe("claimed");
      expect(claimedLease).toHaveProperty("encrypted_credential");

      if (!claimedLease) throw new Error("claimed lease missing");
      claimedLease.claim_expires_at_iso = "1970-01-01T00:00:00.000Z";
      const expiredAck = signedPipelineBody(acknowledgement);
      const expiredAckResponse = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/acknowledge`,
        {method: "POST", headers: expiredAck.headers, body: expiredAck.raw},
      );
      expect(expiredAckResponse.status).toBe(410);
      await expect(expiredAckResponse.json()).resolves.toMatchObject({
        code: "registry_credential_delivery_claim_expired",
      });
      expect(claimedLease.status).toBe("claimed");
      expect(claimedLease).toHaveProperty("encrypted_credential");
    } finally {
      await stopServer(server);
    }
  });
});
