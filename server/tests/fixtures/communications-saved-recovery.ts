import { communicationsFixture, communicationsNow, memoryFirestore } from "./communications";
import { communicationsDigest, COMMUNICATIONS_MODEL } from "../../agents/communications-contract";
import { CommunicationsStore, COMMUNICATIONS_ROOT } from "../../agents/communications-store";
import { CommunicationsAgentsAPI } from "../../agents/communications-api";
import { LEGACY_COMMUNICATIONS_INSTRUCTIONS } from "../../agents/communications-instructions";
import { outputTextDigest } from "../../agents/communications-output";

/** Synthetic/offline provider and company records. No credentials or transport. */
export async function savedRecoveryFixture(mode: "success" | "failure" | "cancelled" = "success") {
  const f = communicationsFixture(), db = memoryFirestore(), now = () => communicationsNow;
  const store = new CommunicationsStore(db, now);
  await db.doc(`${COMMUNICATIONS_ROOT}/briefs/${f.brief.briefId}`).set(f.brief);
  await db.doc(`${COMMUNICATIONS_ROOT}/handoffs/${f.job.briefDigest}`).set(f.handoff);
  await db.doc(`outboundProspects/${f.brief.prospectId}`).set({ contactEmail: f.brief.contact.email,
    siteId: f.brief.siteId, taskId: f.brief.taskId, stage: "drafted" });
  const { jobId: ignored, ...enqueue } = f.job;
  const job = await store.enqueue(enqueue), path = `${COMMUNICATIONS_ROOT}/jobs/${job.jobId}`;
  const checkpoint = { createClaimedAt: new Date(communicationsNow - 3600000).toISOString(), sessionId: "synthetic-saved-session",
    turnId: "synthetic-saved-turn", requestDigest: "e".repeat(64) };
  await db.doc(path).update({ state: "blocked", reason: "agents_native_mcp_call_binding_mismatch", attempts: 1, checkpoint, lease: { owner: "old-owner", until: 0 } });
  const original = (await db.doc(path).get()).data(), raw = JSON.stringify(f.output), requests: string[] = [];
  const budgetPath = `${COMMUNICATIONS_ROOT}/draftBudgetState/current`;
  await db.doc(budgetPath).set({ activeAdmissionId: "original-unknown-liability", actualModelMicros: 14755 });
  const api = new CommunicationsAgentsAPI({ apiKey: "synthetic-never-real", allowPaidInference: false,
    reviewedSavedOutputDigest: outputTextDigest(raw), fetch: async (url, init: RequestInit = {}) => {
      if ((init.method ?? "GET") !== "GET") throw new Error("synthetic_paid_call_forbidden");
      const pathname = new URL(String(url)).pathname; requests.push(pathname);
      if (mode === "failure") throw new Error("synthetic_provider_failure");
      if (pathname.endsWith("/synthetic-saved-session")) return Response.json({ id: checkpoint.sessionId, status: "idle",
        agent: { id: "synthetic-agent", model: COMMUNICATIONS_MODEL, instructions: LEGACY_COMMUNICATIONS_INSTRUCTIONS,
          service_tier: "default", tools: [], multi_agent: { enabled: false } }, environment: { type: "none" }, vault_ids: [],
        metadata: { role: "communications", blueprint_communications_job: job.jobId, blueprint_communications_request_digest: checkpoint.requestDigest } });
      if (pathname.endsWith("/turns")) return Response.json({ data: [{ id: checkpoint.turnId, agent_id: "synthetic-agent", subagent_id: null,
        status: mode === "cancelled" ? "cancelled" : "completed", usage: { input_tokens: 10396, output_tokens: 2373, total_tokens: 12769 } }], has_more: false });
      if (pathname.endsWith("/items")) return Response.json({ data: [{ id: "synthetic-final", type: "message", role: "assistant",
        phase: "final_answer", status: "completed", turn_id: checkpoint.turnId, content: [{ type: "output_text", text: raw }] }], has_more: false });
      throw new Error("synthetic_unexpected_path");
    } });
  const input = { jobId: job.jobId, prospectId: f.brief.prospectId, briefDigest: f.job.briefDigest, expectedJobDigest: communicationsDigest(original),
    expectedCheckpointDigest: communicationsDigest(checkpoint), sessionId: checkpoint.sessionId, rawOutputSha256: outputTextDigest(raw), expectedSourceCommit: "a".repeat(40) };
  const deps = { store, api, readResearch: async () => f.snapshot, verifyMailbox: async () => ({}), readThread: async () => f.thread!,
    isSuppressed: async () => false, suppress: async () => ({ persisted: true }), now };
  return { ...f, db, path, deps, input, requests, budgetPath, original };
}
