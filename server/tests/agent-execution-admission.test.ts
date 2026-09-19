// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeDecisionEvidenceRequest } from "../utils/decisionEvidenceContract";
import { createHash } from "node:crypto";
import { validDecisionRequest } from "./helpers/decision-evidence-fixtures";

const records = vi.hoisted(() => new Map<string, Map<string, Record<string, unknown>>>());

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => {
          const value = records.get(name)?.get(id);
          return { exists: Boolean(value), data: () => value };
        },
      }),
      limit: () => ({
        get: async () => ({
          docs: [...(records.get(name)?.entries() || [])].map(([id, value]) => ({
            id,
            data: () => value,
          })),
        }),
      }),
    }),
  },
}));

const sha = (letter: string) => `sha256:${letter.repeat(64)}`;

beforeEach(() => records.clear());

describe("agent execution admission", () => {
  async function seedPrepared() {
    const { agentExecutionAdmissionDigest, discoverAgentExecutionAdmission, prepareAgentExecutionAdmission } = await import(
      "../utils/agentExecutionAdmission"
    );
    const desired = validDecisionRequest({
      request_id: "request-1",
      site_task: {
        site_id: "site-1",
        site_name: "Site",
        task_id: "approved-task-1",
        task_description: "Move tote",
        conditions: ["captured condition"],
      },
      testbed: { testbed_id: "testbed-1", version: "1", digest_sha256: sha("b") },
      candidates: [{
        candidate_id: "checkpoint-1",
        kind: "policy",
        label: "José policy",
        reference: { external_id: "https://policy.example" },
      }],
      constraints: {
        ...validDecisionRequest().constraints,
        available_physical_evidence: [{
          artifact_id: "capture-job-1",
          kind: "capture",
          uri: "gs://capture-job-1",
          version: "1",
          digest_sha256: sha("a"),
          evidence_class: "real_observation",
        }],
      },
      authorization: {
        entitlement_id: "ent-1",
        access_state: "provisioned",
        verified_by: "server_marketplace_entitlement",
      },
    });
    const canonical = {
      schema_version: "robot_eval_job_request.v1",
      job_id: "request-1",
      buyer_request_id: "decision-1",
      decision_question: desired.decision_question,
      claims: desired.claims, thresholds: desired.thresholds,
      constraints: desired.constraints,
      source: { selection_state: { policy_id: "checkpoint-1", task_id: "approved-task-1" } },
      customer: { id: "team-1", name: "José Robotics" },
      site_package: { site_id: "site-1", capture_id: "capture-job-1", capture_root: "/capture", testbed_digest_sha256: sha("b"), package_version: "1" },
      requested_tasks: [{ task_id: "approved-task-1", scenario_ids: ["nominal"] }],
      robot_profile: { robot_profile_id: "arm-1" },
      policy_package: { policy_api_endpoint: { endpoint_url: "https://policy.example" } },
      entitlement: { entitlement_id: "ent-1", approved: true },
      execution_authorization: {
        authorized_by_user_id: "buyer-1",
        principal_team_id: "team-1",
        task_id: "approved-task-1",
        scenario_id: "nominal",
        episodes: 5,
        max_cost_usd: 25,
        rights_cleared: true,
        one_time_purchase: true,
      },
    };
    const normalized = normalizeDecisionEvidenceRequest({ value: canonical, authenticatedUserId: "buyer-1", sourceRoute: "/api/task-evaluation-runs", receivedAtIso: "2026-09-19T12:00:00Z" });
    expect(normalized.ok, JSON.stringify(normalized)).toBe(true);
    if (!normalized.ok) throw new Error("invalid fixture");
    const decision = { ...normalized.request, authorization: desired.authorization };
    records.set("robotCheckpoints", new Map([["checkpoint-1", {
      checkpointId: "checkpoint-1", teamId: "team-1", runtime: "policy_endpoint", reference: "https://policy.example",
    }]]));
    records.set("inboundRequests", new Map([["scene-1", { pipeline: { capture_job_id: "capture-job-1" } }]]));
    records.set("captureUploadSessions", new Map([["capture-job-1", {
      pipeline_site_task_testbed: {
        testbed_digest: sha("b"),
        testbed: {
          approved_task_definition: { approved_task_id: "approved-task-1" },
          task_distribution: { task_family: "rigid_object_pick_place" },
          source_capture_bundles: [{ bundle_id: "capture-job-1", digest: sha("a") }],
          compiled_cards: { site_card: { id: "site-1" } },
        },
      },
    }]]));
    records.set("robotEvalJobRequests", new Map([["request-1", {
      status: "prepared_agent_execution",
      buyer_user_id: "buyer-1",
      entitlement_proof: { entitlement_id: "ent-1" },
      pipeline_forward: { performed: false },
      decision_request: decision,
      canonical_execution_request: canonical,
      canonical_execution_request_sha256: agentExecutionAdmissionDigest(canonical),
    }]]));

    return { agentExecutionAdmissionDigest, discoverAgentExecutionAdmission };
  }

  const selection = { teamId: "team-1", checkpointId: "checkpoint-1", sceneId: "scene-1", quotedEpisodes: 5, quotedUsd: 25 };
  it("discovers the real legacy normalization output and freezes identical UTF-8 bytes", async () => {
    const { agentExecutionAdmissionDigest, discoverAgentExecutionAdmission } = await seedPrepared();
    const result = await discoverAgentExecutionAdmission({
      teamId: "team-1", checkpointId: "checkpoint-1", sceneId: "scene-1", quotedEpisodes: 5, quotedUsd: 25,
    });
    expect(result.admitted, JSON.stringify(result)).toBe(true);
    if (!result.admitted) return;
    expect(JSON.parse(result.canonicalJson)).toEqual(result.envelope);
    expect(result.digestSha256).toBe(agentExecutionAdmissionDigest(result.envelope));
    expect(result.digestSha256).toBe(`sha256:${createHash("sha256").update(result.canonicalJson, "utf8").digest("hex")}`);
    expect(result.canonicalJson).toContain("José");
    expect(result.envelope).toMatchObject({ binding: {
      task_id: "approved-task-1", task_family: "rigid_object_pick_place", scenario_id: "nominal",
    }});
  });
  it.each(["forwarded", "digest", "price", "episodes", "checkpoint", "capture"])("refuses changed or unbound %s before funds can be reserved", async (kind) => {
    const { discoverAgentExecutionAdmission } = await seedPrepared();
    const record = records.get("robotEvalJobRequests")!.get("request-1")!;
    if (kind === "forwarded") record.pipeline_forward = { performed: true };
    if (kind === "digest") record.canonical_execution_request_sha256 = sha("d");
    if (kind === "checkpoint") records.get("robotCheckpoints")!.get("checkpoint-1")!.reference = "https://different.example";
    if (kind === "capture") records.get("inboundRequests")!.get("scene-1")!.pipeline = { capture_job_id: "missing" };
    const result = await discoverAgentExecutionAdmission({ ...selection, ...(kind === "price" ? { quotedUsd: 50 } : {}), ...(kind === "episodes" ? { quotedEpisodes: 50 } : {}) });
    expect(result.admitted).toBe(false);
  });

});
