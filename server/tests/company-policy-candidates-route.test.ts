// @vitest-environment node
import crypto, {createHmac} from "node:crypto";
import express from "express";
import {createServer, type Server} from "node:http";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, Record<string, unknown>>>(),
  handoffs: [] as Record<string, unknown>[],
  outboxPresentAtForward: [] as boolean[],
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

vi.mock("../middleware/csrf", () => ({
  csrfProtection: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../middleware/verifyFirebaseToken", () => ({
  default: (req: {header: (name: string) => string | undefined}, res: any, next: () => void) => {
    const uid = String(req.header("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!uid) return res.status(401).json({error: "Unauthorized"});
    res.locals.firebaseUser = {
      uid,
      tenantId: String(req.header("X-Test-Tenant-Id") || `tenant-${uid}`),
      companyId: String(req.header("X-Test-Company-Id") || "acme_robotics"),
    };
    next();
  },
}));

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

vi.mock("../utils/companyPolicyContainerContract", () => ({
  companyPolicyRegistryHost: () => "registry.acme.example",
  normalizeCompanyPolicyContainerContract: (value: unknown) =>
    (value as {valid?: boolean})?.valid
      ? {ok: true, contract: structuredClone(normalizedContract)}
      : {ok: false, code: "company_policy_container_v2_invalid", errors: ["invalid"]},
}));

vi.mock("../utils/companyPolicyCandidateForwarding", () => ({
  forwardCompanyPolicyCandidateToPipeline: async (handoff: Record<string, unknown>) => {
    state.outboxPresentAtForward.push(
      state.collections.get("companyPolicyCandidateOutbox")?.has(String(handoff.submission_id)) === true,
    );
    state.handoffs.push(structuredClone(handoff));
    return {
      status: "accepted",
      performed: true,
      accepted: true,
      required: true,
      admission_id: "admission-1",
      admission_digest: `sha256:${"e".repeat(64)}`,
      blockers: [],
    };
  },
}));

async function startServer() {
  const [{default: candidates}, {default: internalCredentials}] = await Promise.all([
    import("../routes/company-policy-candidates"),
    import("../routes/internal-company-policy-registry-credentials"),
  ]);
  const app = express();
  app.use(express.json({limit: "1mb"}));
  app.use("/api/task-evaluation-runs", candidates);
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

async function stageClaimableCredential(baseUrl: string) {
  const candidateResponse = await fetch(
    `${baseUrl}/api/task-evaluation-runs/run-12345678/policy-candidates`,
    {
      method: "POST",
      headers: {"Content-Type": "application/json", Authorization: "Bearer buyer-1"},
      body: JSON.stringify({contract: {valid: true}, idempotency_key: "candidate-12345678"}),
    },
  );
  const candidate = (await candidateResponse.json() as any).candidate;
  const leaseResponse = await fetch(
    `${baseUrl}/api/task-evaluation-runs/run-12345678/policy-candidates/${candidate.submission_id}/registry-credential`,
    {
      method: "PUT",
      headers: {"Content-Type": "application/json", Authorization: "Bearer buyer-1"},
      body: JSON.stringify({
        schema_version: "company_policy_registry_credential_lease.v1",
        submission_id: candidate.submission_id,
        contract_digest: normalizedContract.contract_digest,
        image: normalizedContract.container.image,
        registry_username: "robot-team",
        registry_secret: "fault-injection-secret",
        expires_in_seconds: 300,
        idempotency_key: "credential-12345678",
      }),
    },
  );
  const lease = (await leaseResponse.json() as any).credential_lease;
  const storedLease = state.collections
    .get("companyPolicyRegistryCredentialLeases")
    ?.get(lease.lease_id);
  if (!storedLease) throw new Error("test lease missing");
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
  process.env.COMPANY_POLICY_ALLOWED_REGISTRIES = "registry.acme.example";
  state.collections.set("robotEvalJobRequests", new Map([
    ["run-12345678", {
      buyer_user_id: "buyer-1",
      status: "submitted",
      decision_request: {owner: {tenant_id: "tenant-buyer-1"}},
    }],
  ]));
});

afterEach(() => {
  state.collections.clear();
  state.handoffs.length = 0;
  state.outboxPresentAtForward.length = 0;
  delete process.env.FIELD_ENCRYPTION_MASTER_KEY;
  delete process.env.PIPELINE_SYNC_TOKEN;
  delete process.env.COMPANY_POLICY_CREDENTIAL_BROKER_TOKEN;
  delete process.env.COMPANY_POLICY_ALLOWED_REGISTRIES;
  vi.resetModules();
});

describe("company policy candidate routes", () => {
  it("stores an owner-scoped immutable contract, then a separate secret-clean lease", async () => {
    const {server, baseUrl} = await startServer();
    try {
      const candidateResponse = await fetch(
        `${baseUrl}/api/task-evaluation-runs/run-12345678/policy-candidates`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json", Authorization: "Bearer buyer-1"},
          body: JSON.stringify({contract: {valid: true}, idempotency_key: "candidate-12345678"}),
        },
      );
      expect(candidateResponse.status).toBe(201);
      const candidatePayload = await candidateResponse.json() as any;
      const submissionId = candidatePayload.candidate.submission_id as string;
      expect(candidatePayload.candidate.status).toBe(
        "contract_admitted_awaiting_registry_credential",
      );
      expect(state.handoffs).toHaveLength(0);

      const secret = "short-lived-registry-secret";
      const credentialResponse = await fetch(
        `${baseUrl}/api/task-evaluation-runs/run-12345678/policy-candidates/${submissionId}/registry-credential`,
        {
          method: "PUT",
          headers: {"Content-Type": "application/json", Authorization: "Bearer buyer-1"},
          body: JSON.stringify({
            schema_version: "company_policy_registry_credential_lease.v1",
            submission_id: submissionId,
            contract_digest: normalizedContract.contract_digest,
            image: normalizedContract.container.image,
            registry_username: "oauth2accesstoken",
            registry_secret: secret,
            expires_in_seconds: 300,
            idempotency_key: "credential-12345678",
          }),
        },
      );
      expect(credentialResponse.status).toBe(201);
      const credentialPayload = await credentialResponse.json() as any;
      expect(JSON.stringify(credentialPayload)).not.toContain(secret);
      expect(credentialPayload.status).toBe("contract_admitted_awaiting_pipeline");
      expect(credentialPayload.launch_authority_granted).toBe(false);
      expect(credentialPayload.provider_mutation_authorized).toBe(false);

      const leases = state.collections.get("companyPolicyRegistryCredentialLeases");
      expect(leases?.size).toBe(1);
      const storedLease = [...(leases?.values() || [])][0];
      expect(JSON.stringify(storedLease)).not.toContain(secret);
      expect(storedLease).toHaveProperty("encrypted_credential");
      expect(state.handoffs).toHaveLength(0);
      const stagedOutbox = state.collections
        .get("companyPolicyCandidateOutbox")
        ?.get(submissionId);
      expect(stagedOutbox).toMatchObject({
        status: "pending",
        attempt_count: 0,
        handoff: {
          registry_credential_lease_id: credentialPayload.credential_lease.lease_id,
          launch_authority_granted: false,
          provider_mutation_authorized: false,
        },
      });
      expect(stagedOutbox?.handoff_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
      expect(JSON.stringify(stagedOutbox)).not.toContain(secret);
    } finally {
      await stopServer(server);
    }
  });

  it("refuses a non-owner before storing a candidate", async () => {
    const {server, baseUrl} = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/task-evaluation-runs/run-12345678/policy-candidates`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json", Authorization: "Bearer buyer-2"},
          body: JSON.stringify({contract: {valid: true}, idempotency_key: "candidate-12345678"}),
        },
      );
      expect(response.status).toBe(403);
      expect(state.collections.get("companyPolicyCandidateSubmissions")?.size || 0).toBe(0);
    } finally {
      await stopServer(server);
    }
  });

  it("refuses a caller-supplied company that differs from the authenticated company", async () => {
    const {server, baseUrl} = await startServer();
    try {
      const response = await fetch(
        `${baseUrl}/api/task-evaluation-runs/run-12345678/policy-candidates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer buyer-1",
            "X-Test-Company-Id": "different_company",
          },
          body: JSON.stringify({contract: {valid: true}, idempotency_key: "candidate-12345678"}),
        },
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({
        code: "policy_candidate_company_identity_mismatch",
      });
      expect(state.handoffs).toHaveLength(0);
    } finally {
      await stopServer(server);
    }
  });

  it("refuses GET access when either tenant or company binding differs", async () => {
    const {server, baseUrl} = await startServer();
    try {
      const candidateResponse = await fetch(
        `${baseUrl}/api/task-evaluation-runs/run-12345678/policy-candidates`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json", Authorization: "Bearer buyer-1"},
          body: JSON.stringify({contract: {valid: true}, idempotency_key: "candidate-12345678"}),
        },
      );
      const candidate = (await candidateResponse.json() as any).candidate;
      for (const identityHeaders of [
        {"X-Test-Tenant-Id": "tenant-other"},
        {"X-Test-Company-Id": "other_company"},
      ]) {
        const response = await fetch(
          `${baseUrl}/api/task-evaluation-runs/run-12345678/policy-candidates/${candidate.submission_id}`,
          {
            headers: {
              Authorization: "Bearer buyer-1",
              ...identityHeaders,
            },
          },
        );
        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toMatchObject({
          code: "policy_candidate_owner_mismatch",
        });
      }
    } finally {
      await stopServer(server);
    }
  });

  it("redelivers a claimed credential after response loss and deletes it only after pull acknowledgement", async () => {
    const {server, baseUrl} = await startServer();
    try {
      const candidateResponse = await fetch(
        `${baseUrl}/api/task-evaluation-runs/run-12345678/policy-candidates`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json", Authorization: "Bearer buyer-1"},
          body: JSON.stringify({contract: {valid: true}, idempotency_key: "candidate-12345678"}),
        },
      );
      const candidate = (await candidateResponse.json() as any).candidate;
      const secret = "consume-once-secret";
      const leaseResponse = await fetch(
        `${baseUrl}/api/task-evaluation-runs/run-12345678/policy-candidates/${candidate.submission_id}/registry-credential`,
        {
          method: "PUT",
          headers: {"Content-Type": "application/json", Authorization: "Bearer buyer-1"},
          body: JSON.stringify({
            schema_version: "company_policy_registry_credential_lease.v1",
            submission_id: candidate.submission_id,
            contract_digest: normalizedContract.contract_digest,
            image: normalizedContract.container.image,
            registry_username: "robot-team",
            registry_secret: secret,
            expires_in_seconds: 300,
            idempotency_key: "credential-12345678",
          }),
        },
      );
      const lease = (await leaseResponse.json() as any).credential_lease;
      const storedLease = state.collections
        .get("companyPolicyRegistryCredentialLeases")
        ?.get(lease.lease_id);
      if (!storedLease) throw new Error("test lease missing");
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
      const {lease, storedLease, claimBody} = await stageClaimableCredential(baseUrl);
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
      const {lease, claimBody} = await stageClaimableCredential(baseUrl);
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
