// @vitest-environment node
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

const state = vi.hoisted(() => ({
  collections: new Map<string, Map<string, Record<string, unknown>>>(),
  forwarder: vi.fn(),
  transactionTail: Promise.resolve(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  type Reference = {collectionName: string; id: string};
  const reference = (collectionName: string, id: string): Reference => ({collectionName, id});
  const read = (ref: Reference) => {
    const data = state.collections.get(ref.collectionName)?.get(ref.id);
    return {exists: Boolean(data), data: () => data && structuredClone(data), ref};
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
  const collection = (collectionName: string) => ({
    doc: (id: string) => reference(collectionName, id),
    where: (_field: string, _operator: string, status: string) => ({
      limit: (limit: number) => ({
        get: async () => ({
          docs: [...(state.collections.get(collectionName) || new Map()).entries()]
            .filter(([, value]) => value.status === status)
            .slice(0, limit)
            .map(([id, value]) => ({
              ...read(reference(collectionName, id)),
              data: () => structuredClone(value),
            })),
        }),
      }),
    }),
  });
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => "__DELETE__",
        },
      },
    },
    dbAdmin: {
      collection,
      runTransaction: async <T>(callback: (transaction: {
        get: (ref: Reference) => Promise<ReturnType<typeof read>>;
        set: (ref: Reference, payload: Record<string, unknown>, options?: {merge?: boolean}) => void;
      }) => Promise<T>) => {
        const previous = state.transactionTail;
        let release!: () => void;
        state.transactionTail = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await callback({
            get: async (ref) => read(ref),
            set: (ref, payload, options) => write(ref, payload, options?.merge),
          });
        } finally {
          release();
        }
      },
    },
  };
});

vi.mock("../utils/companyPolicyCandidateForwarding", () => ({
  forwardCompanyPolicyCandidateToPipeline: (...args: unknown[]) => state.forwarder(...args),
}));

vi.mock("../logger", () => ({logger: {error: vi.fn()}}));

import {processCompanyPolicyCandidateOutbox} from "../utils/companyPolicyCandidateOutboxWorker";
import {canonicalArtifactDigest} from "../utils/taskCandidateContract";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const submissionId = "policy-candidate-12345678";
const leaseId = "policy-registry-lease-12345678";

function pendingRecord() {
  const handoff = {
    schema_version: "company_policy_container_admission_request.v1",
    tenant_id: "tenant-buyer-1",
    run_id: "run-12345678",
    submission_id: submissionId,
    company_id: "acme_robotics",
    contract_digest: sha("a"),
    contract: {schema_version: "company_policy_container_contract.v2"},
    registry_credential_lease_id: leaseId,
    claim_ceiling: "development_only",
    launch_authority_granted: false,
    provider_mutation_authorized: false,
  };
  return {
    schema_version: "company_policy_candidate_outbox.v1",
    submission_id: submissionId,
    handoff,
    handoff_digest: canonicalArtifactDigest(handoff, "handoff_digest"),
    status: "pending",
    attempt_count: 0,
  };
}

function accepted() {
  return {
    status: "accepted",
    performed: true,
    accepted: true,
    required: true,
    admission_id: "company-policy-admission-12345678",
    admission_digest: sha("b"),
    blockers: [],
  };
}

beforeEach(() => {
  state.collections.clear();
  state.forwarder.mockReset();
  state.transactionTail = Promise.resolve();
  state.collections.set("companyPolicyCandidateOutbox", new Map([
    [submissionId, pendingRecord()],
  ]));
  state.collections.set("companyPolicyCandidateSubmissions", new Map([
    [submissionId, {status: "contract_admitted_awaiting_pipeline"}],
  ]));
  state.collections.set("companyPolicyRegistryCredentialLeases", new Map([
    [leaseId, {status: "active"}],
  ]));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("company policy outbox transactional processing", () => {
  it("allows two workers to race but forwards the handoff exactly once", async () => {
    let releaseForward!: () => void;
    state.forwarder.mockImplementationOnce(() => new Promise((resolve) => {
      releaseForward = () => resolve(accepted());
    }));

    const first = processCompanyPolicyCandidateOutbox();
    await vi.waitFor(() => expect(state.forwarder).toHaveBeenCalledTimes(1));
    const second = processCompanyPolicyCandidateOutbox();
    await expect(second).resolves.toMatchObject({processed: 0});
    releaseForward();
    await expect(first).resolves.toMatchObject({processed: 1});

    expect(state.forwarder).toHaveBeenCalledTimes(1);
    expect(state.collections.get("companyPolicyCandidateOutbox")?.get(submissionId)).toMatchObject({
      status: "delivered",
      attempt_count: 1,
    });
    expect(state.collections.get("companyPolicyCandidateSubmissions")?.get(submissionId)).toMatchObject({
      status: "admitted_no_spend",
    });
    expect(state.collections.get("companyPolicyRegistryCredentialLeases")?.get(leaseId)).toMatchObject({
      admission_id: "company-policy-admission-12345678",
      admission_digest: sha("b"),
    });
  });

  it("recovers a crash-held delivery only after its lease expires", async () => {
    state.forwarder.mockRejectedValueOnce(new Error("simulated worker crash"));
    await expect(processCompanyPolicyCandidateOutbox()).rejects.toThrow(
      "simulated worker crash",
    );
    const outbox = state.collections.get("companyPolicyCandidateOutbox")?.get(submissionId);
    expect(outbox).toMatchObject({status: "delivering"});
    expect(outbox?.delivery_lease_id).toBeTruthy();

    state.forwarder.mockResolvedValueOnce(accepted());
    await expect(processCompanyPolicyCandidateOutbox()).resolves.toMatchObject({processed: 0});
    expect(state.forwarder).toHaveBeenCalledTimes(1);

    if (!outbox) throw new Error("outbox record missing");
    outbox.delivery_lease_expires_at_iso = "1970-01-01T00:00:00.000Z";
    await expect(processCompanyPolicyCandidateOutbox()).resolves.toMatchObject({processed: 1});
    expect(state.forwarder).toHaveBeenCalledTimes(2);
    expect(state.collections.get("companyPolicyCandidateOutbox")?.get(submissionId)?.status)
      .toBe("delivered");
  });
});
