// @vitest-environment node
import crypto, {createHmac} from "node:crypto";
import express from "express";
import {createServer, type Server} from "node:http";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, Record<string, unknown>>>(),
  handoffs: [] as Record<string, unknown>[],
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
        set: (ref: Reference, payload: Record<string, unknown>) => void;
        update: (ref: Reference, payload: Record<string, unknown>) => void;
      }) => Promise<T>) => callback({
        get: async (ref) => read(ref),
        set: (ref, payload) => write(ref, payload),
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
    res.locals.firebaseUser = {uid, tenantId: `tenant-${uid}`};
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
  normalizeCompanyPolicyContainerContract: (value: unknown) =>
    (value as {valid?: boolean})?.valid
      ? {ok: true, contract: structuredClone(normalizedContract)}
      : {ok: false, code: "company_policy_container_v2_invalid", errors: ["invalid"]},
}));

vi.mock("../utils/companyPolicyCandidateForwarding", () => ({
  forwardCompanyPolicyCandidateToPipeline: async (handoff: Record<string, unknown>) => {
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
  const signature = createHmac("sha256", "pipeline-secret")
    .update(`${timestamp}.${raw}`)
    .digest("hex");
  return {
    raw,
    headers: {
      "Content-Type": "application/json",
      "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": `sha256=${signature}`,
    },
  };
}

beforeEach(() => {
  process.env.FIELD_ENCRYPTION_MASTER_KEY = crypto.randomBytes(32).toString("base64");
  process.env.PIPELINE_SYNC_TOKEN = "pipeline-secret";
  state.collections.set("robotEvalJobRequests", new Map([
    ["run-12345678", {buyer_user_id: "buyer-1", status: "submitted"}],
  ]));
});

afterEach(() => {
  state.collections.clear();
  state.handoffs.length = 0;
  delete process.env.FIELD_ENCRYPTION_MASTER_KEY;
  delete process.env.PIPELINE_SYNC_TOKEN;
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
      expect(credentialPayload.status).toBe("admitted_no_spend");
      expect(credentialPayload.launch_authority_granted).toBe(false);
      expect(credentialPayload.provider_mutation_authorized).toBe(false);

      const leases = state.collections.get("companyPolicyRegistryCredentialLeases");
      expect(leases?.size).toBe(1);
      const storedLease = [...(leases?.values() || [])][0];
      expect(JSON.stringify(storedLease)).not.toContain(secret);
      expect(storedLease).toHaveProperty("encrypted_credential");
      expect(state.handoffs).toHaveLength(1);
      expect(JSON.stringify(state.handoffs[0])).not.toContain(secret);
      expect(state.handoffs[0]).toMatchObject({
        registry_credential_lease_id: credentialPayload.credential_lease.lease_id,
        launch_authority_granted: false,
        provider_mutation_authorized: false,
      });
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

  it("lets Pipeline redeem the exact lease once and deletes ciphertext", async () => {
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
      const consumeBody = {
        schema_version: "company_policy_registry_credential_consume.v1",
        tenant_id: "tenant-buyer-1",
        run_id: "run-12345678",
        submission_id: candidate.submission_id,
        company_id: "acme_robotics",
        contract_digest: normalizedContract.contract_digest,
        image: normalizedContract.container.image,
      };
      const signed = signedPipelineBody(consumeBody);
      const first = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/consume`,
        {method: "POST", headers: signed.headers, body: signed.raw},
      );
      expect(first.status).toBe(200);
      expect(first.headers.get("cache-control")).toBe("no-store");
      await expect(first.json()).resolves.toMatchObject({
        ok: true,
        credential: {registry_server: "registry.acme.example", username: "robot-team", secret},
        lease_receipt: {status: "consumed", ciphertext_deleted: true},
      });
      const stored = state.collections
        .get("companyPolicyRegistryCredentialLeases")
        ?.get(lease.lease_id);
      expect(stored?.status).toBe("consumed");
      expect(stored).not.toHaveProperty("encrypted_credential");

      const replaySigned = signedPipelineBody(consumeBody);
      const replay = await fetch(
        `${baseUrl}/api/internal/pipeline/company-policy-registry-credential-leases/${lease.lease_id}/consume`,
        {method: "POST", headers: replaySigned.headers, body: replaySigned.raw},
      );
      expect(replay.status).toBe(409);
      expect(JSON.stringify(await replay.json())).not.toContain(secret);
    } finally {
      await stopServer(server);
    }
  });
});
