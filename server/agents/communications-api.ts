import { COMMUNICATIONS_INSTRUCTIONS, COMMUNICATIONS_DEFINITION, communicationsDefinitionForInstructions } from "./communications-instructions";
import {
  COMMUNICATIONS_MODEL, COMMUNICATIONS_PROJECT, communicationsDigest,
  type CommunicationsOutput,
} from "./communications-contract";
import { parseCommunicationsOutput, outputTextDigest, CommunicationsOutputValidationError, type CommunicationsOutputSource } from "./communications-output";

export type CommunicationsCheckpoint = {
  createClaimedAt: string | null; sessionId: string | null; turnId: string | null;
  requestDigest?: string;
};
export class CommunicationsRuntimeError extends Error {
  constructor(public code: string, public retryable = false, readonly outputSource?: CommunicationsOutputSource) { super(code); }
}
export { COMMUNICATIONS_INSTRUCTIONS } from "./communications-instructions";

/** Raw public API contract: keeps the repository's existing OpenAI SDK unchanged. */
export class CommunicationsAgentsAPI {
  constructor(private options: {
    apiKey?: string; allowPaidInference: boolean; fetch?: typeof fetch;
    requestTimeoutMs?: number;
    reservePaidDraft?: (jobId: string, requestDigest: string) => Promise<unknown>;
    recordPaidDraftUsage?: (jobId: string, requestDigest: string, usage: unknown) => Promise<unknown>;
    // Existing authenticated operator/service code selects the exact saved
    // artifact. This is never a model/client approval flag or send authority.
    reviewedSavedOutputDigest?: string;
  }) {}
  private headers() {
    if (!this.options.apiKey) throw new CommunicationsRuntimeError("existing_openai_binding_missing");
    return { Authorization: `Bearer ${this.options.apiKey}`, "OpenAI-Project": COMMUNICATIONS_PROJECT,
      "OpenAI-Beta": "agents=v1", "Content-Type": "application/json" };
  }
  private async request(path: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.requestTimeoutMs ?? 30000);
    try {
      const response = await (this.options.fetch ?? fetch)(`https://api.openai.com/v1${path}`, {
        ...init, headers: { ...this.headers(), ...init.headers }, signal: controller.signal,
      });
      if (!response.ok) {
        // HTTP status and operation only: provider errors may contain private input.
        throw new CommunicationsRuntimeError(`agents_api_http_${response.status}`, init.method !== "POST" && (response.status === 429 || response.status >= 500));
      }
      return { response, close: () => { clearTimeout(timeout); controller.abort(); } };
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof CommunicationsRuntimeError) throw error;
      throw new CommunicationsRuntimeError("agents_api_connection_unknown", init.method !== "POST");
    }
  }
  private async json(path: string, maxBytes?: number) {
    const handle = await this.request(path);
    try {
      if (maxBytes === undefined) return await handle.response.json();
      const reader = handle.response.body?.getReader();
      if (!reader) throw new CommunicationsRuntimeError("agents_saved_response_invalid");
      try {
        const decoder = new TextDecoder();
        let text = "", bytes = 0;
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > maxBytes) throw new CommunicationsRuntimeError("agents_saved_response_limit_exceeded");
          text += decoder.decode(chunk.value, { stream: true });
        }
        return JSON.parse(text + decoder.decode());
      } finally { await reader.cancel().catch(() => undefined); }
    } finally { handle.close(); }
  }
  async preflight() {
    const model = await this.json(`/models/${COMMUNICATIONS_MODEL}`);
    if (model.id !== COMMUNICATIONS_MODEL) throw new CommunicationsRuntimeError("requested_luna_model_unavailable");
    return { model: model.id, project: COMMUNICATIONS_PROJECT };
  }
  async run(params: {
    input: string; jobId: string; checkpoint: CommunicationsCheckpoint;
    saveCheckpoint: (checkpoint: CommunicationsCheckpoint) => Promise<void>;
  }): Promise<{ output: CommunicationsOutput; checkpoint: CommunicationsCheckpoint; usage: unknown; outputSource?: CommunicationsOutputSource }> {
    if (!this.options.allowPaidInference) throw new CommunicationsRuntimeError("communications_inference_disabled");
    if (Buffer.byteLength(params.input) > 64000) throw new CommunicationsRuntimeError("communications_input_limit_exceeded");
    const checkpoint = { ...params.checkpoint };
    if (checkpoint.createClaimedAt && !checkpoint.sessionId) throw new CommunicationsRuntimeError("session_create_requires_reconciliation");
    const fresh = !checkpoint.sessionId;
    const requestDigest = fresh
      ? communicationsDigest({ model: COMMUNICATIONS_MODEL, serviceTier: "default", instructions: COMMUNICATIONS_INSTRUCTIONS, input: params.input })
      : checkpoint.requestDigest;
    if (!requestDigest || !/^[a-f0-9]{64}$/.test(requestDigest)) throw new CommunicationsRuntimeError("agents_existing_session_binding_mismatch");
    if (fresh) {
      if (!this.options.reservePaidDraft || !this.options.recordPaidDraftUsage) throw new CommunicationsRuntimeError("communications_paid_draft_admission_required");
      await this.preflight();
      await this.options.reservePaidDraft(params.jobId, requestDigest);
      checkpoint.createClaimedAt = new Date().toISOString();
      checkpoint.requestDigest = requestDigest;
      // Commit the one-use create claim BEFORE any request can reach OpenAI.
      await params.saveCheckpoint({ ...checkpoint });
    }
    const handle = await this.request(fresh ? "/agents/sessions" : `/agents/sessions/${encodeURIComponent(checkpoint.sessionId!)}/events`, fresh ? {
      method: "POST", body: JSON.stringify({
        agent: { model: COMMUNICATIONS_MODEL, instructions: COMMUNICATIONS_INSTRUCTIONS,
          service_tier: "default", reasoning: { effort: "medium" }, text: { verbosity: "low" }, tools: [], multi_agent: { enabled: false } },
        environment: { type: "none" }, input: params.input, stream: true,
        metadata: { blueprint_communications_job: params.jobId, role: "communications",
          blueprint_communications_request_digest: requestDigest,
          blueprint_communications_definition: COMMUNICATIONS_DEFINITION.version,
          blueprint_communications_instructions_digest: COMMUNICATIONS_DEFINITION.instructionsDigest },
      }),
    } : { headers: { Accept: "text/event-stream" } });
    let terminal: string | null = null;
    const reader = handle.response.body?.getReader();
    if (!reader) { handle.close(); throw new CommunicationsRuntimeError("agents_stream_missing", !fresh); }
    // A reconnected observer is opened before saved state is reconciled. No new
    // message is sent, and a missed completion event cannot create a second turn.
    const saved = !fresh ? this.reconcileSaved(checkpoint, params.jobId).then((result) => {
      if (result) handle.close(); return { result, error: null };
    }, (error) => { handle.close(); return { result: null, error }; }) : null;
    try {
      const decoder = new TextDecoder();
      let buffer = "";
      while (!terminal) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
        if (buffer.length > 1000000) throw new CommunicationsRuntimeError("agents_stream_limit_exceeded");
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          const data = frame.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
          if (!data || data === "[DONE]") continue;
          const event = JSON.parse(data);
          if (event.session?.id && !checkpoint.sessionId) { checkpoint.sessionId = event.session.id; await params.saveCheckpoint({ ...checkpoint }); }
          if (event.turn_id && !event.turn?.subagent_id && !checkpoint.turnId) { checkpoint.turnId = event.turn_id; await params.saveCheckpoint({ ...checkpoint }); }
          if (event.turn?.subagent_id) continue;
          if (["agent.session.turn.completed", "agent.session.turn.failed", "agent.session.turn.cancelled"].includes(event.type)) terminal = event.type;
          if (["error", "agent.session.failed", "agent.session.requires_action"].includes(event.type)) throw new CommunicationsRuntimeError("agents_session_failed_or_unexpected_action");
        }
      }
    } catch (error) {
      if (error instanceof CommunicationsRuntimeError) throw error;
      // Lost stream is resolved from persisted turn/items, never from idle/deltas.
    } finally { handle.close(); await reader.cancel().catch(() => undefined); }
    if (terminal && terminal !== "agent.session.turn.completed") throw new CommunicationsRuntimeError("agents_turn_failed_or_cancelled");
    const savedResult = saved ? await saved : null;
    if (savedResult?.error) throw savedResult.error;
    const result = savedResult?.result ?? await this.reconcileSaved(checkpoint, params.jobId);
    if (!result) throw new CommunicationsRuntimeError("agents_turn_pending", !!checkpoint.sessionId);
    await params.saveCheckpoint({ ...result.checkpoint });
    return result;
  }
  /** Read saved artifacts only, including after the inference deadline expires. */
  async reconcileUsage(checkpoint: CommunicationsCheckpoint, jobId: string) {
    if (!checkpoint.sessionId) return null;
    const path = `/agents/sessions/${encodeURIComponent(checkpoint.sessionId)}`;
    const session = await this.json(path);
    if (session.agent?.model !== COMMUNICATIONS_MODEL || session.metadata?.blueprint_communications_job !== jobId
      || session.metadata?.role !== "communications"
      || (checkpoint.requestDigest && session.metadata?.blueprint_communications_request_digest !== checkpoint.requestDigest)) {
      throw new CommunicationsRuntimeError("agents_session_job_binding_mismatch");
    }
    const turns = await this.json(`${path}/turns?order=asc&limit=100`);
    if (turns.has_more || !Array.isArray(turns.data) || turns.data.length > 1) throw new CommunicationsRuntimeError("agents_root_turn_ambiguous");
    const turn = checkpoint.turnId ? turns.data.find((item: any) => item.id === checkpoint.turnId) : turns.data[0];
    if (!turn || turn.subagent_id || !["completed", "failed", "cancelled"].includes(turn.status)) return null;
    // Cost can be observed for a failed/unusable draft without licensing a send.
    return turn.usage ?? null;
  }
  /** Explicit recovery observes an EXISTING session only. The caller cannot
   * supply usage or replace a create claim. Missing legacy request metadata is
   * not proof of a matching request, absence, cancellation or zero spend. */
  async verifyExistingDraftSession(checkpoint: CommunicationsCheckpoint, jobId: string, requestDigest: string) {
    const { turn } = await this.readBoundDraftSession(checkpoint, jobId, requestDigest);
    return { sessionId: checkpoint.sessionId!, requestDigest, turnId: turn?.id ?? null,
      usage: turn && ["completed", "failed", "cancelled"].includes(turn.status) ? turn.usage ?? null : null };
  }
  private async readBoundDraftSession(checkpoint: CommunicationsCheckpoint, jobId: string, requestDigest: string) {
    if (!checkpoint.sessionId || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(checkpoint.sessionId)
      || !/^[a-f0-9]{64}$/.test(requestDigest)) throw new CommunicationsRuntimeError("agents_existing_session_binding_mismatch");
    const path = `/agents/sessions/${encodeURIComponent(checkpoint.sessionId)}`;
    const session = await this.json(path, 256000);
    const definition = communicationsDefinitionForInstructions(session.agent?.instructions);
    if (session.id !== checkpoint.sessionId || typeof session.agent?.id !== "string" || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(session.agent.id)
      || session.agent?.model !== COMMUNICATIONS_MODEL
      || session.agent?.service_tier !== "default" || !definition
      || !Array.isArray(session.agent?.tools) || session.agent.tools.length !== 0
      || session.agent?.multi_agent?.enabled !== false || session.environment?.type !== "none"
      || !Array.isArray(session.vault_ids) || session.vault_ids.length !== 0
      || session.metadata?.blueprint_communications_job !== jobId || session.metadata?.role !== "communications"
      || session.metadata?.blueprint_communications_request_digest !== requestDigest
      || (session.metadata?.blueprint_communications_definition !== undefined
        && session.metadata.blueprint_communications_definition !== definition?.version)
      || (session.metadata?.blueprint_communications_instructions_digest !== undefined
        && session.metadata.blueprint_communications_instructions_digest !== definition?.instructionsDigest)) {
      throw new CommunicationsRuntimeError("agents_existing_session_binding_mismatch");
    }
    const turns = await this.json(`${path}/turns?order=asc&limit=100`, 256000);
    if (turns.has_more || !Array.isArray(turns.data) || turns.data.length > 1) throw new CommunicationsRuntimeError("agents_root_turn_ambiguous");
    const turn = turns.data[0];
    if ((checkpoint.turnId && checkpoint.turnId !== turn?.id) || (turn && (turn.subagent_id
      || typeof turn.id !== "string" || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(turn.id)
      || turn.agent_id !== session.agent.id))) throw new CommunicationsRuntimeError("agents_root_turn_ambiguous");
    return { session, turn, definition: definition! };
  }
  async reconcileSaved(savedCheckpoint: CommunicationsCheckpoint, jobId: string) {
    const checkpoint = { ...savedCheckpoint };
    if (!checkpoint.sessionId) throw new CommunicationsRuntimeError("session_create_requires_reconciliation");
    const path = `/agents/sessions/${encodeURIComponent(checkpoint.sessionId)}`;
    const { session, turn, definition } = await this.readBoundDraftSession(checkpoint, jobId, checkpoint.requestDigest ?? "");
    if (session.status === "failed" || session.status === "requires_action") throw new CommunicationsRuntimeError("agents_session_failed_or_unexpected_action");
    if (!turn) return null;
    checkpoint.turnId = turn.id;
    if (["failed", "cancelled"].includes(turn.status)) throw new CommunicationsRuntimeError(`agents_turn_${turn.status}`);
    if (turn.status !== "completed") return null;
    // Account the bound completed turn even if output parsing/quality later
    // fails. The reservation's digest/day survive a writing-definition update.
    if (this.options.recordPaidDraftUsage) await this.options.recordPaidDraftUsage(jobId, checkpoint.requestDigest!, turn.usage ?? null);
    const items: any[] = [];
    let after = "";
    const cursors = new Set<string>(), readDeadline = Date.now() + 100000;
    let itemBytes = 0;
    while (true) {
      if (Date.now() >= readDeadline) throw new CommunicationsRuntimeError("agents_saved_items_read_deadline", true);
      const result = await this.json(`${path}/items?order=asc&limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`, 256000);
      if (!Array.isArray(result.data)) throw new CommunicationsRuntimeError("agents_items_invalid");
      itemBytes += Buffer.byteLength(JSON.stringify(result.data));
      if (itemBytes > 2000000) throw new CommunicationsRuntimeError("agents_saved_items_export_required");
      items.push(...result.data);
      if (!result.has_more) break;
      if (typeof result.last_id !== "string" || !result.last_id || cursors.has(result.last_id)) throw new CommunicationsRuntimeError("agents_items_cursor_did_not_advance");
      cursors.add(result.last_id);
      after = result.last_id;
    }
    const final = items.filter((item) => item.turn_id === turn.id && item.type === "message"
      && item.role === "assistant" && item.phase === "final_answer" && item.status === "completed");
    if (final.length !== 1) throw new CommunicationsRuntimeError("agents_final_answer_missing_or_ambiguous");
    if (typeof final[0].id !== "string" || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(final[0].id)
      || !Array.isArray(final[0].content)) throw new CommunicationsRuntimeError("agents_final_answer_missing_or_ambiguous");
    const parts = final[0].content.filter((part: any) => part.type === "output_text");
    if (!parts.length || parts.some((part: any) => typeof part.text !== "string")) throw new CommunicationsRuntimeError("agents_final_answer_missing_or_ambiguous");
    const raw = parts.map((part: any) => part.text).join("");
    if (Buffer.byteLength(raw) > 20000) throw new CommunicationsRuntimeError("agents_output_limit_exceeded");
    const outputSource: CommunicationsOutputSource = {
      schema_version: "blueprint.communications-output-source.v1", jobId,
      budgetAdmissionId: communicationsDigest({ jobId }), requestDigest: checkpoint.requestDigest!,
      sessionId: checkpoint.sessionId!, turnId: turn.id, finalItemId: final[0].id,
      definitionVersion: definition.version, instructionsDigest: definition.instructionsDigest,
      rawOutput: raw, rawOutputSha256: outputTextDigest(raw), rawOutputBytes: Buffer.byteLength(raw),
      usageDigest: communicationsDigest(turn.usage ?? null), normalizedMetadataPaths: [],
    };
    if (this.options.reviewedSavedOutputDigest && this.options.reviewedSavedOutputDigest !== outputSource.rawOutputSha256) {
      throw new CommunicationsRuntimeError("communications_saved_output_changed", false, outputSource);
    }
    let parsed;
    try { parsed = parseCommunicationsOutput(raw, this.options.reviewedSavedOutputDigest); }
    catch (error) {
      if (error instanceof CommunicationsOutputValidationError) {
        outputSource.validationIssues = error.validationIssues;
        outputSource.normalizedMetadataPaths = error.normalizedMetadataPaths;
        outputSource.formatNormalizations = error.formatNormalizations;
      }
      throw new CommunicationsRuntimeError("communications_output_invalid", false, outputSource);
    }
    outputSource.normalizedMetadataPaths = parsed.normalizedMetadataPaths;
    if (parsed.formatNormalizations.length) outputSource.formatNormalizations = parsed.formatNormalizations;
    return { output: parsed.output, checkpoint: { ...checkpoint }, usage: turn.usage ?? null, outputSource };
  }
  async cancel(checkpoint: CommunicationsCheckpoint) {
    if (!checkpoint.sessionId) return false;
    const handle = await this.request(`/agents/sessions/${encodeURIComponent(checkpoint.sessionId)}/events`, {
      method: "POST", body: JSON.stringify({ events: [{ type: "agent.session.input.cancel" }] }),
    });
    handle.close();
    return true;
  }
}
