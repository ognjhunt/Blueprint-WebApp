// @vitest-environment node
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

const verifyPipelineSyncRequest = vi.hoisted(() => vi.fn());
const documents = vi.hoisted(() => new Map<string, Record<string, any>>());
const launches = vi.hoisted(() => new Map<string, Record<string, any>>());

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: (collection: string) => ({
      doc: (id: string) => ({ collection, id }),
    }),
    runTransaction: async (callback: (transaction: any) => Promise<unknown>) => callback({
      get: async (ref: { collection: string; id: string }) => {
        const value = launches.get(ref.id);
        return { exists: Boolean(value), data: () => value };
      },
      getAll: async (...refs: Array<{ collection: string; id: string }>) => refs.map((ref) => {
        const value = documents.get(ref.id);
        return { exists: Boolean(value), data: () => value };
      }),
      create: (ref: { collection: string; id: string }, value: Record<string, any>) => {
        documents.set(ref.id, value);
      },
      set: () => undefined,
    }),
  },
}));

vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter:
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest,
}));

function packetFixture(options?: { launchId?: string | null; suffix?: string }) {
  const suffix = options?.suffix ?? "1";
  const call: Record<string, unknown> = {
    schema_version: "openai_prompt_cache_usage.v1",
    call_id: `sha256:${"1".repeat(63)}${suffix}`,
    capability: "task_aware_robot_placement_proposal",
    provider: "openai",
    model: "gpt-5.6-sol",
    cache_family: "task_aware_robot_placement_proposal",
    cache_policy_status: "enabled",
    cache_decision_reason: "expected_cached_cost_lower",
    cache_key_digest: `sha256:${"2".repeat(64)}`,
    prompt_contract_version: "robot-placement-proposal-v2",
    stable_prefix_digest: `sha256:${"3".repeat(64)}`,
    breakpoint_digests: [`sha256:${"3".repeat(64)}`],
    policy_digest: `sha256:${"4".repeat(64)}`,
    privacy_scope: "task_evaluation_rights_admitted",
    processing_region: "default",
    reusable_prefix_tokens: 1_200,
    dynamic_suffix_tokens: 800,
    input_tokens: 2_000,
    cached_tokens: 1_200,
    cache_write_tokens: 0,
    uncached_input_tokens: 800,
    output_tokens: 20,
    reasoning_tokens: 5,
    cache_hit_ratio: 0.6,
    uncached_input_cost_usd: 0.0032,
    cache_write_cost_usd: 0,
    cached_read_cost_usd: 0.00048,
    output_cost_usd: 0.0004,
    estimated_total_cost_usd: 0.00408,
    estimated_cost_without_caching_usd: 0.0084,
    estimated_savings_usd: 0.00432,
    cost_status: "model_pricing_estimate_not_official_billing",
    provider_response_id: `resp_${suffix}`,
    provider_request_id: `req_${suffix}`,
    usage_detail_status: "complete",
    dynamic_content_before_breakpoint: false,
    raw_prompt_recorded: false,
    raw_secret_values_recorded: false,
    usage_receipt_digest: "",
  };
  call.usage_receipt_digest = canonicalArtifactDigest(call, "usage_receipt_digest");
  const packet: Record<string, unknown> = {
    schema_version: "blueprint_openai_inference_usage_packet.v1",
    run_id: "run-cache-proof",
    launch_id: options?.launchId ?? null,
    source_commit: "a".repeat(40),
    source_receipt_digest: `sha256:${"5".repeat(64)}`,
    generated_at_utc: "2026-08-31T13:00:00Z",
    calls: [call],
    raw_prompts_recorded: false,
    raw_secret_values_recorded: false,
    packet_digest: "",
  };
  packet.packet_digest = canonicalArtifactDigest(packet, "packet_digest");
  return packet;
}

async function startServer() {
  const { default: router } = await import("../routes/internal-task-evaluation-launches");
  const app = express();
  app.use(express.json());
  app.use("/api/internal/pipeline", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server bind failed");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

afterEach(() => {
  documents.clear();
  launches.clear();
  verifyPipelineSyncRequest.mockReset();
  vi.resetModules();
});

describe("signed Pipeline OpenAI usage ingestion", () => {
  it("authenticates, projects safe costs, replays idempotently, and rejects conflicts", async () => {
    verifyPipelineSyncRequest.mockReturnValue({ ok: true });
    const { server, url } = await startServer();
    try {
      const packet = packetFixture();
      const first = await fetch(`${url}/api/internal/pipeline/openai-inference-usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packet),
      });
      const replay = await fetch(`${url}/api/internal/pipeline/openai-inference-usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packet),
      });
      const conflictPacket = packetFixture({ suffix: "1" });
      conflictPacket.generated_at_utc = "2026-08-31T13:01:00Z";
      conflictPacket.packet_digest = canonicalArtifactDigest(conflictPacket, "packet_digest");
      const conflict = await fetch(`${url}/api/internal/pipeline/openai-inference-usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(conflictPacket),
      });

      expect(first.status).toBe(201);
      expect(replay.status).toBe(200);
      expect((await replay.json()).status).toBe("replayed");
      expect(conflict.status).toBe(409);
      const stored = [...documents.values()][0];
      expect(stored.artifacts.usage).toMatchObject({
        input_tokens_details: {
          cached_tokens: 1_200,
          cache_write_tokens: 0,
        },
        cached_read_cost_usd: 0.00048,
        estimated_savings_usd: 0.00432,
      });
      expect(JSON.stringify(stored)).not.toContain("sensitive prompt content");
      expect(JSON.stringify(stored)).not.toContain("blueprint:cache:v1:");
    } finally {
      await stopServer(server);
    }
  });

  it("rejects bad signatures and launch binding mismatches", async () => {
    verifyPipelineSyncRequest.mockReturnValueOnce({
      ok: false,
      status: 401,
      message: "bad signature",
      code: "pipeline_signature_invalid",
    }).mockReturnValue({ ok: true });
    launches.set("launch-1", { run_id: "different-run" });
    const { server, url } = await startServer();
    try {
      const unauthorized = await fetch(`${url}/api/internal/pipeline/openai-inference-usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packetFixture()),
      });
      const mismatch = await fetch(`${url}/api/internal/pipeline/openai-inference-usage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packetFixture({ launchId: "launch-1" })),
      });
      expect(unauthorized.status).toBe(401);
      expect(mismatch.status).toBe(409);
    } finally {
      await stopServer(server);
    }
  });
});
