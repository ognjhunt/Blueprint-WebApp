import { COMMUNICATIONS_INSTRUCTIONS, communicationsDefinitionForInstructions } from "./communications-instructions";
import {
  COMMUNICATIONS_MODEL, COMMUNICATIONS_PROJECT, communicationsDigest,
  type CommunicationsOutput,
} from "./communications-contract";
import { parseCommunicationsOutput, outputTextDigest, CommunicationsOutputValidationError, type CommunicationsOutputSource } from "./communications-output";
import { COMMUNICATIONS_SAVED_AGENT_ID, COMMUNICATIONS_SAVED_CONFIGURATION_DIGEST,
  verifiedCommunicationsSavedAgent, verifiedCommunicationsHistoryAgent, COMMUNICATIONS_HISTORY_PROFILE,
  COMMUNICATIONS_HISTORY_DEFINITION, COMMUNICATIONS_HISTORY_CONFIGURATION, COMMUNICATIONS_HISTORY_CONFIGURATION_DIGEST,
  verifiedCommunicationsCurrentSavedAgent, verifiedCommunicationsGmailBinding, verifiedCommunicationsGmailAgent,
  COMMUNICATIONS_GMAIL_READ_DEFINITION, COMMUNICATIONS_GMAIL_READ_TOOLS, type CommunicationsGmailSessionBinding } from "./communications-saved-agent";

import { getCompanyHistoryAccess, runOperatorTool } from "./operator-tools";
import { toolFailure } from "./adapters/tool-recovery";
import { projectAgentEvidence, hydrateAgentEvidence } from "./private-evidence";

export type CommunicationsHistoryReceipt = {
  callId: string; turnId: string; name: string; arguments: unknown; requestDigest: string;
  output: string; success: boolean; resultDigest: string; idempotencyKey: string;
  historyAccessDigest?: string | null;
  delivery: "prepared" | "submitted" | "ack_unknown";
};
export type CommunicationsCheckpoint = {
  createClaimedAt: string | null; sessionId: string | null; turnId: string | null;
  requestDigest?: string;
  historyProfile?: typeof COMMUNICATIONS_HISTORY_PROFILE; historyConfigurationDigest?: string;
  historyToolReceipts?: CommunicationsHistoryReceipt[];
  historyEvidence?: Record<string, unknown>;
  gmailMcp?: CommunicationsGmailSessionBinding;
  nativeMcpItems?: unknown[];
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
    const saved = await this.json(`/agents/${COMMUNICATIONS_SAVED_AGENT_ID}`, 256000);
    let checked;
    try { checked = verifiedCommunicationsCurrentSavedAgent(saved); }
    catch { throw new CommunicationsRuntimeError("communications_saved_agent_definition_changed"); }
    return { model: model.id, project: COMMUNICATIONS_PROJECT, ...checked, runtime: "saved_agent" as const };
  }
  async run(params: {
    input: string; jobId: string; checkpoint: CommunicationsCheckpoint;
    saveCheckpoint: (checkpoint: CommunicationsCheckpoint) => Promise<void>;
  }): Promise<{ output: CommunicationsOutput; checkpoint: CommunicationsCheckpoint; usage: unknown; outputSource?: CommunicationsOutputSource }> {
    if (!this.options.allowPaidInference) throw new CommunicationsRuntimeError("communications_inference_disabled");
    if (Buffer.byteLength(params.input) > 64000) throw new CommunicationsRuntimeError("communications_input_limit_exceeded");
    const checkpoint = await this.hydrateHistoryCheckpoint(params.checkpoint, params.jobId);
    const saveCheckpoint = async (value: CommunicationsCheckpoint) => params.saveCheckpoint(await this.projectHistoryCheckpoint(value, params.jobId));
    if (checkpoint.createClaimedAt && !checkpoint.sessionId) throw new CommunicationsRuntimeError("session_create_requires_reconciliation");
    const fresh = !checkpoint.sessionId;
    let requestDigest = checkpoint.requestDigest;
    if (fresh) {
      if (!this.options.reservePaidDraft || !this.options.recordPaidDraftUsage) throw new CommunicationsRuntimeError("communications_paid_draft_admission_required");
      const checked = await this.preflight();
      const configurationDigest = checked.gmailMcp?.configurationDigest ?? COMMUNICATIONS_HISTORY_CONFIGURATION_DIGEST;
      requestDigest = communicationsDigest({ agentId: COMMUNICATIONS_SAVED_AGENT_ID,
        configurationDigest, historyProfile: COMMUNICATIONS_HISTORY_PROFILE, input: params.input,
        ...(checked.gmailMcp ? { mcpProfile: checked.gmailMcp.profile, savedConfigurationDigest: checked.gmailMcp.savedConfigurationDigest } : {}) });
      await this.options.reservePaidDraft(params.jobId, requestDigest);
      checkpoint.createClaimedAt = new Date().toISOString();
      checkpoint.requestDigest = requestDigest;
      checkpoint.historyProfile = COMMUNICATIONS_HISTORY_PROFILE;
      checkpoint.historyConfigurationDigest = configurationDigest;
      if (checked.gmailMcp) checkpoint.gmailMcp = checked.gmailMcp;
      else delete checkpoint.gmailMcp;
      // Commit the one-use create claim BEFORE any request can reach OpenAI.
      await saveCheckpoint({ ...checkpoint });
    }
    if (!requestDigest || !/^[a-f0-9]{64}$/.test(requestDigest)) throw new CommunicationsRuntimeError("agents_existing_session_binding_mismatch");
    let gmailMcp;
    try { gmailMcp = checkpoint.gmailMcp ? verifiedCommunicationsGmailBinding(checkpoint.gmailMcp) : undefined; }
    catch { throw new CommunicationsRuntimeError("agents_existing_session_mcp_binding_mismatch"); }
    const definition = gmailMcp ? COMMUNICATIONS_GMAIL_READ_DEFINITION : COMMUNICATIONS_HISTORY_DEFINITION;
    const handle = await this.request(fresh ? "/agents/sessions" : `/agents/sessions/${encodeURIComponent(checkpoint.sessionId!)}/events`, fresh ? {
      method: "POST", body: JSON.stringify({
        agent_id: COMMUNICATIONS_SAVED_AGENT_ID, agent: gmailMcp?.configuration ?? COMMUNICATIONS_HISTORY_CONFIGURATION,
        environment: { type: "none" }, input: params.input, stream: true,
        metadata: { blueprint_communications_job: params.jobId, role: "communications",
          blueprint_communications_request_digest: requestDigest,
          blueprint_communications_saved_agent: COMMUNICATIONS_SAVED_AGENT_ID,
          blueprint_communications_configuration_digest: gmailMcp?.savedConfigurationDigest ?? COMMUNICATIONS_SAVED_CONFIGURATION_DIGEST,
          blueprint_communications_history_profile: COMMUNICATIONS_HISTORY_PROFILE,
          blueprint_communications_history_configuration_digest: checkpoint.historyConfigurationDigest,
          ...(gmailMcp ? { blueprint_communications_mcp_profile: gmailMcp.profile } : {}),
          blueprint_communications_definition: definition.version,
          blueprint_communications_instructions_digest: definition.instructionsDigest },
      }),
    } : { headers: { Accept: "text/event-stream" } });
    let terminal: string | null = null;
    const reader = handle.response.body?.getReader();
    if (!reader) { handle.close(); throw new CommunicationsRuntimeError("agents_stream_missing", !fresh); }
    // A reconnected observer is opened before saved state is reconciled. No new
    // message is sent, and a missed completion event cannot create a second turn.
    const saved = !fresh && !checkpoint.historyProfile ? this.reconcileSaved(checkpoint, params.jobId, saveCheckpoint).then((result) => {
      if (result) handle.close(); return { result, error: null };
    }, (error) => { handle.close(); return { result: null, error }; }) : null;
    try {
      if (!fresh && checkpoint.historyProfile) await this.handleHistoryActions(checkpoint, params.jobId, saveCheckpoint);
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
          if (event.session?.id && !checkpoint.sessionId) { checkpoint.sessionId = event.session.id; await saveCheckpoint({ ...checkpoint }); }
          if (event.turn_id && !event.turn?.subagent_id && !checkpoint.turnId) { checkpoint.turnId = event.turn_id; await saveCheckpoint({ ...checkpoint }); }
          if (event.turn?.subagent_id) continue;
          if (["agent.session.turn.completed", "agent.session.turn.failed", "agent.session.turn.cancelled"].includes(event.type)) terminal = event.type;
          if (event.type === "agent.session.requires_action" && checkpoint.historyProfile) {
            await this.handleHistoryActions(checkpoint, params.jobId, saveCheckpoint);
          } else if (["error", "agent.session.failed", "agent.session.requires_action"].includes(event.type)) {
            throw new CommunicationsRuntimeError("agents_session_failed_or_unexpected_action");
          }
        }
      }
    } catch (error) {
      if (error instanceof CommunicationsRuntimeError) throw error;
      // Lost stream is resolved from persisted turn/items, never from idle/deltas.
    } finally { handle.close(); await reader.cancel().catch(() => undefined); }
    if (terminal && terminal !== "agent.session.turn.completed") throw new CommunicationsRuntimeError("agents_turn_failed_or_cancelled");
    const savedResult = saved ? await saved : null;
    if (savedResult?.error) throw savedResult.error;
    let result = savedResult?.result ?? await this.reconcileSaved(checkpoint, params.jobId, saveCheckpoint);
    if (!result && checkpoint.historyProfile) {
      // Recover missed required-action events without a new user message/turn.
      await this.handleHistoryActions(checkpoint, params.jobId, saveCheckpoint);
      result = await this.reconcileSaved(checkpoint, params.jobId, saveCheckpoint);
    }
    if (!result) throw new CommunicationsRuntimeError("agents_turn_pending", !!checkpoint.sessionId);
    const projected = await this.projectHistoryCheckpoint(result.checkpoint, params.jobId);
    await params.saveCheckpoint(projected);
    return { ...result, checkpoint: projected };
  }
  private async projectHistoryCheckpoint(checkpoint: CommunicationsCheckpoint, jobId: string) {
    if (!checkpoint.historyToolReceipts && !checkpoint.nativeMcpItems) return { ...checkpoint };
    if (!checkpoint.sessionId || checkpoint.historyProfile !== COMMUNICATIONS_HISTORY_PROFILE) {
      throw new CommunicationsRuntimeError("agents_existing_session_history_binding_mismatch");
    }
    const scope = { collection: "agentCheckpoints" as const, id: `communications-history:${jobId}:${checkpoint.sessionId}` };
    const projection = await projectAgentEvidence({ snapshot: checkpoint.gmailMcp
      ? { historyToolReceipts: checkpoint.historyToolReceipts ?? [], nativeMcpItems: checkpoint.nativeMcpItems ?? [] }
      : checkpoint.historyToolReceipts }, scope);
    const projected = { ...checkpoint };
    if (projection.agent_evidence_ref) {
      delete projected.historyToolReceipts;
      delete projected.nativeMcpItems;
      projected.historyEvidence = projection;
    } else delete projected.historyEvidence;
    return projected;
  }
  private async hydrateHistoryCheckpoint(value: CommunicationsCheckpoint, jobId: string) {
    const checkpoint = { ...value };
    if (!checkpoint.historyEvidence) return checkpoint;
    if (!checkpoint.sessionId || checkpoint.historyProfile !== COMMUNICATIONS_HISTORY_PROFILE || checkpoint.historyToolReceipts || checkpoint.nativeMcpItems) {
      throw new CommunicationsRuntimeError("agents_existing_session_history_binding_mismatch");
    }
    const hydrated = await hydrateAgentEvidence(checkpoint.historyEvidence,
      { collection: "agentCheckpoints", id: `communications-history:${jobId}:${checkpoint.sessionId}` });
    if (checkpoint.gmailMcp) {
      const snapshot = hydrated.snapshot as any;
      if (!snapshot || !Array.isArray(snapshot.historyToolReceipts) || !Array.isArray(snapshot.nativeMcpItems)) {
        throw new CommunicationsRuntimeError("agents_history_receipt_binding_mismatch");
      }
      checkpoint.historyToolReceipts = snapshot.historyToolReceipts;
      checkpoint.nativeMcpItems = snapshot.nativeMcpItems;
    } else {
      if (!Array.isArray(hydrated.snapshot)) throw new CommunicationsRuntimeError("agents_history_receipt_binding_mismatch");
      checkpoint.historyToolReceipts = hydrated.snapshot;
    }
    delete checkpoint.historyEvidence;
    return checkpoint;
  }
  /** Function results continue the existing root turn. Requests and exact results
   * are durable before submission; unknown ACKs are observed on replacement and
   * reuse the same provider idempotency key, never a new message or create. */
  private async handleHistoryActions(checkpoint: CommunicationsCheckpoint, jobId: string,
    saveCheckpoint: (checkpoint: CommunicationsCheckpoint) => Promise<void>) {
    const { session, turn } = await this.readBoundDraftSession(checkpoint, jobId, checkpoint.requestDigest ?? "");
    if (!checkpoint.historyProfile) throw new CommunicationsRuntimeError("agents_history_profile_required");
    const actions = session.required_actions ?? [];
    if (!Array.isArray(actions)) throw new CommunicationsRuntimeError("agents_history_actions_invalid");
    if (!turn) {
      if (actions.length) throw new CommunicationsRuntimeError("agents_history_action_turn_mismatch");
      return;
    }
    if (actions.length && !["queued", "in_progress", "waiting"].includes(turn.status)) throw new CommunicationsRuntimeError("agents_history_action_turn_mismatch");
    checkpoint.turnId = turn.id;
    const receipts = checkpoint.historyToolReceipts ?? [];
    if (!Array.isArray(receipts)) throw new CommunicationsRuntimeError("agents_history_receipt_binding_mismatch");
    const callIds = new Set<string>();
    for (const action of actions) {
      if (action?.type !== "function_call" || typeof action.call_id !== "string"
        || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(action.call_id) || action.turn_id !== turn.id
        || typeof action.name !== "string" || !("arguments" in action) || callIds.has(action.call_id)) {
        throw new CommunicationsRuntimeError("agents_history_action_provenance_invalid");
      }
      callIds.add(action.call_id);
    }
    // Validate all retained receipts before interpreting delivery status. A
    // changed request/result cannot silently reuse an earlier successful call.
    const retainedIds = new Set<string>();
    for (const receipt of receipts) {
      if (!receipt || typeof receipt !== "object" || typeof receipt.output !== "string"
        || typeof receipt.success !== "boolean" || typeof receipt.callId !== "string" || typeof receipt.name !== "string"
        || receipt.turnId !== turn.id || retainedIds.has(receipt.callId)
        || receipt.requestDigest !== communicationsDigest({ sessionId: checkpoint.sessionId, turnId: receipt.turnId,
          callId: receipt.callId, name: receipt.name, arguments: receipt.arguments })
        || receipt.resultDigest !== communicationsDigest({ success: receipt.success, output: receipt.output })
        || receipt.idempotencyKey !== `communications-history-${receipt.requestDigest}`
        || !["prepared", "submitted", "ack_unknown"].includes(receipt.delivery)) {
        throw new CommunicationsRuntimeError("agents_history_receipt_binding_mismatch");
      }
      retainedIds.add(receipt.callId);
    }
    for (const receipt of receipts) if (!callIds.has(receipt.callId) && receipt.delivery !== "submitted") {
      receipt.delivery = "submitted"; // verified provider no longer requests it
      await saveCheckpoint({ ...checkpoint, historyToolReceipts: receipts.map(item => ({ ...item })) });
    }
    const historyAccess = actions.length ? await getCompanyHistoryAccess({ kind: "outbound_outreach" }) : null;
    for (const action of actions) {
      const requestDigest = communicationsDigest({ sessionId: checkpoint.sessionId, turnId: turn.id,
        callId: action.call_id, name: action.name, arguments: action.arguments });
      let receipt = receipts.find(item => item.callId === action.call_id);
      if (receipt && receipt.requestDigest !== requestDigest) throw new CommunicationsRuntimeError("agents_history_call_redefined");
      if (!receipt) {
        let result: unknown, success = false, historyAccessDigest: string | null = null;
        if (!["search_company_history", "fetch_company_history_record"].includes(action.name)) {
          result = { status: "control_denied", code: "tool_not_declared", retryAllowed: false,
            allowedRepair: "Choose a declared read-only history tool; this result grants no authority." };
        } else if (Buffer.byteLength(JSON.stringify(action.arguments)) > 64000) {
          result = { status: "recoverable_issue", code: "tool_arguments_resource_limit", retryAllowed: true,
            allowedRepair: "Shorten the query/filters within the 64KB request limit." };
        } else {
          try {
            let args;
            try { args = typeof action.arguments === "string" ? JSON.parse(action.arguments) : action.arguments; }
            catch { result = { status: "recoverable_issue", code: "tool_arguments_json_invalid", retryAllowed: true,
              issues: [{ path: "/", code: "invalid_json", expectations: { type: "object" } }] }; }
            if (result === undefined && (!args || typeof args !== "object" || Array.isArray(args))) {
              result = { status: "recoverable_issue", code: "tool_arguments_invalid", retryAllowed: true,
                issues: [{ path: "/", code: "invalid_type", expectations: { expected: "object" } }] };
            }
            if (result === undefined) {
              historyAccessDigest = historyAccess ? communicationsDigest(historyAccess) : null;
              result = await runOperatorTool(action.name, args, historyAccess ?? undefined);
              success = !!result && typeof result === "object" && (result as { ok?: unknown }).ok === true;
            }
          } catch (error) { result = toolFailure(error, action.name); }
        }
        let output = JSON.stringify(result);
        if (Buffer.byteLength(output) > 256000) {
          success = false; output = JSON.stringify({ status: "recoverable_issue", code: "tool_result_resource_limit", retryAllowed: true,
            allowedRepair: "Use a smaller page_size or fetch a narrower record; response exceeds the 256KB transport limit." });
        }
        receipt = { callId: action.call_id, turnId: turn.id, name: action.name, arguments: action.arguments, requestDigest,
          output, success, historyAccessDigest, resultDigest: communicationsDigest({ success, output }),
          idempotencyKey: `communications-history-${requestDigest}`, delivery: "prepared" };
        receipts.push(receipt);
        checkpoint.historyToolReceipts = receipts;
        await saveCheckpoint({ ...checkpoint, historyToolReceipts: receipts.map(item => ({ ...item })) });
      }
      // Sensitive cached output cannot outlive or widen its original retained
      // read binding, including after an unknown provider acknowledgment.
      if (receipt.historyAccessDigest || receipt.success) {
        const currentAccess = await getCompanyHistoryAccess({ kind: "outbound_outreach" });
        if (!historyAccess || Date.parse(historyAccess.expiresAt) <= Date.now() || !currentAccess
          || Date.parse(currentAccess.expiresAt) <= Date.now()
          || receipt.historyAccessDigest !== communicationsDigest(currentAccess)) {
          throw new CommunicationsRuntimeError("agents_history_retained_access_changed_or_expired");
        }
      }
      // A pending action plus the immutable result/key is safe to resubmit. The
      // provider's documented idempotency header prevents a second acceptance.
      const event = { type: "agent.session.input.tool_result", turn_id: receipt.turnId, call_id: receipt.callId,
        success: receipt.success, ...(receipt.success ? { output: receipt.output } : { error: receipt.output }) };
      try {
        const submitted = await this.request(`/agents/sessions/${encodeURIComponent(checkpoint.sessionId!)}/events`, {
          method: "POST", headers: { "Idempotency-Key": receipt.idempotencyKey }, body: JSON.stringify({ events: [event] }),
        });
        submitted.close(); receipt.delivery = "submitted";
      } catch (error) {
        receipt.delivery = "ack_unknown";
        await saveCheckpoint({ ...checkpoint, historyToolReceipts: receipts.map(item => ({ ...item })) });
        throw new CommunicationsRuntimeError("agents_history_result_ack_unknown", true);
      }
      await saveCheckpoint({ ...checkpoint, historyToolReceipts: receipts.map(item => ({ ...item })) });
    }
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
    const hasHistory = checkpoint.historyProfile !== undefined || session.metadata?.blueprint_communications_history_profile !== undefined;
    const hasGmail = checkpoint.gmailMcp !== undefined || session.metadata?.blueprint_communications_mcp_profile !== undefined;
    let gmailMcp;
    if (hasGmail) {
      try { gmailMcp = verifiedCommunicationsGmailBinding(checkpoint.gmailMcp!); }
      catch { throw new CommunicationsRuntimeError("agents_existing_session_mcp_binding_mismatch"); }
      if (!hasHistory || session.metadata?.blueprint_communications_mcp_profile !== gmailMcp.profile) {
        throw new CommunicationsRuntimeError("agents_existing_session_mcp_binding_mismatch");
      }
    }
    let definition = communicationsDefinitionForInstructions(session.agent?.instructions);
    if (hasHistory) {
      if (checkpoint.historyProfile !== COMMUNICATIONS_HISTORY_PROFILE
        || checkpoint.historyConfigurationDigest !== (gmailMcp?.configurationDigest ?? COMMUNICATIONS_HISTORY_CONFIGURATION_DIGEST)
        || session.metadata?.blueprint_communications_history_profile !== COMMUNICATIONS_HISTORY_PROFILE
        || session.metadata?.blueprint_communications_history_configuration_digest !== checkpoint.historyConfigurationDigest) {
        throw new CommunicationsRuntimeError("agents_existing_session_history_binding_mismatch");
      }
      try { definition = gmailMcp ? verifiedCommunicationsGmailAgent(session.agent, gmailMcp) : verifiedCommunicationsHistoryAgent(session.agent); }
      catch { throw new CommunicationsRuntimeError("agents_existing_session_history_binding_mismatch"); }
    }
    const usesSavedAgent = session.metadata?.blueprint_communications_saved_agent !== undefined;
    if (usesSavedAgent) {
      try { if (!hasHistory) verifiedCommunicationsSavedAgent(session.agent); }
      catch { throw new CommunicationsRuntimeError("agents_existing_session_binding_mismatch"); }
      if (session.metadata.blueprint_communications_saved_agent !== COMMUNICATIONS_SAVED_AGENT_ID
        || session.metadata.blueprint_communications_configuration_digest !== (gmailMcp?.savedConfigurationDigest ?? COMMUNICATIONS_SAVED_CONFIGURATION_DIGEST)) {
        throw new CommunicationsRuntimeError("agents_existing_session_binding_mismatch");
      }
    }
    if (session.id !== checkpoint.sessionId || typeof session.agent?.id !== "string" || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(session.agent.id)
      || session.agent?.model !== COMMUNICATIONS_MODEL
      || session.agent?.service_tier !== (usesSavedAgent ? "auto" : "default") || !definition
      || !Array.isArray(session.agent?.tools) || (!hasHistory && session.agent.tools.length !== 0)
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
  async reconcileSaved(savedCheckpoint: CommunicationsCheckpoint, jobId: string,
    saveCheckpoint?: (checkpoint: CommunicationsCheckpoint) => Promise<void>) {
    const checkpoint = await this.hydrateHistoryCheckpoint(savedCheckpoint, jobId);
    if (!checkpoint.sessionId) throw new CommunicationsRuntimeError("session_create_requires_reconciliation");
    const path = `/agents/sessions/${encodeURIComponent(checkpoint.sessionId)}`;
    const { session, turn, definition } = await this.readBoundDraftSession(checkpoint, jobId, checkpoint.requestDigest ?? "");
    if (session.status === "failed" || (session.status === "requires_action" && !checkpoint.historyProfile)) throw new CommunicationsRuntimeError("agents_session_failed_or_unexpected_action");
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
    if (checkpoint.gmailMcp) {
      // Availability is not proof of use. Retain GET-observed native calls and
      // original arguments/results privately, including failed observations.
      const calls = items.filter(item => item.type === "mcp_call");
      checkpoint.nativeMcpItems = calls;
      if (saveCheckpoint) await saveCheckpoint({ ...checkpoint });
      const allowed = checkpoint.gmailMcp.savedTool.allowed_tools ?? COMMUNICATIONS_GMAIL_READ_TOOLS;
      if (calls.some(item => item.turn_id !== turn.id || item.server_label !== "gmail" || !allowed.includes(item.name))) {
        throw new CommunicationsRuntimeError("agents_native_mcp_call_binding_mismatch");
      }
    }
    const final = items.filter((item) => item.turn_id === turn.id && item.type === "message"
      && item.role === "assistant" && item.phase === "final_answer" && item.status === "completed");
    if (final.length !== 1) throw new CommunicationsRuntimeError("agents_final_answer_missing_or_ambiguous");
    if (typeof final[0].id !== "string" || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(final[0].id)
      || !Array.isArray(final[0].content)) throw new CommunicationsRuntimeError("agents_final_answer_missing_or_ambiguous");
    const parts = final[0].content.filter((part: any) => part.type === "output_text");
    if (!parts.length || parts.some((part: any) => typeof part.text !== "string")) throw new CommunicationsRuntimeError("agents_final_answer_missing_or_ambiguous");
    const raw = parts.map((part: any) => part.text).join("");
    // The fully read item page is already bounded at 256KB. A second 20KB
    // whole-output limit would discard schema-valid Unicode drafts/metadata
    // before retaining their source; preserve all observed bytes instead.
    const outputSource: CommunicationsOutputSource & { nativeMcpEvidence?: Record<string, unknown> } = {
      schema_version: "blueprint.communications-output-source.v1", jobId,
      budgetAdmissionId: communicationsDigest({ jobId }), requestDigest: checkpoint.requestDigest!,
      sessionId: checkpoint.sessionId!, turnId: turn.id, finalItemId: final[0].id,
      definitionVersion: definition.version, instructionsDigest: definition.instructionsDigest,
      rawOutput: raw, rawOutputSha256: outputTextDigest(raw), rawOutputBytes: Buffer.byteLength(raw),
      usageDigest: communicationsDigest(turn.usage ?? null), normalizedMetadataPaths: [],
      ...(checkpoint.nativeMcpItems ? { nativeMcpEvidence: {
        recordRef: `blueprintCommunications/default/jobs/${jobId}`, field: "checkpoint",
        profile: checkpoint.gmailMcp!.profile, configurationDigest: checkpoint.gmailMcp!.configurationDigest,
        callsDigest: communicationsDigest(checkpoint.nativeMcpItems), observedCalls: checkpoint.nativeMcpItems.length,
      } } : {}),
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
    return { output: parsed.output, checkpoint: await this.projectHistoryCheckpoint(checkpoint, jobId), usage: turn.usage ?? null, outputSource };
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
