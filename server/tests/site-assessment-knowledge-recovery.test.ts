// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { Usage, type Model, type ModelResponse } from '@openai/agents';
import { createSiteAssessmentAgent, type SiteAssessment } from '../agents/site-assessment';
import { createCompanyHistoryTools } from '../research-learning/company-history';

const args = { query: 'visible manipulation', city: 'Chicago', task: null,
  company: 'fixture-company', kind: 'hypothesis', cursor: 'invalid-fixture-cursor' };
const access = { principalId: 'fixture-scope', companyWide: false, expiresAt: '2099-01-01T00:00:00Z' };
const final: SiteAssessment = { status: 'needs_operator_input', job: [], objects_motions_conditions_variations: [],
  operator_success: [], known: [], estimates: [], missing: [], approaches: [], questions: [],
  next_action: { kind: 'ask_operator', action: 'Clarify the missing evidence',
    why: { text: 'The evidence remains incomplete', basis: 'unknown', evidence: [] } } };

async function runSearch(history: any, searchArgs = args, extra: Record<string, any> = {}) {
  let turn = 0;
  const model: Model = { async getResponse(): Promise<ModelResponse> {
    turn++;
    if (turn === 1) extra.afterFirstModel?.();
    return { usage: new Usage(), output: turn === 1
      ? [{ type: 'function_call', callId: 'search-fixture', name: 'search_robot_knowledge', arguments: JSON.stringify(searchArgs) }]
      : [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(final) }] }] };
  }, async *getStreamedResponse() { throw Error('not_used'); } };
  const agent = await createSiteAssessmentAgent({ request_id: 'offline-search-fixture',
    operator_messages: [{ id: 'owner', text: 'Inspect this offline fixture', source_ref: 'fixture/owner' }],
    site_requirement: { spec: {}, serviceArea: null, location: { label: null, city: null, state: null, country: null }, taskFamily: null } },
  { history_access: access, history_tool: history, model, authorize_model_call: async () => {}, ...extra });
  return { agent, run: () => agent.run() };
}

describe('bounded knowledge pagination recovery (actual SDK tool; no providers)', () => {
  it('keeps successful pagination unchanged and never replaces a valid backend cursor', async () => {
    const result = { ok: true, rows: [{ record_id: 'fixture/record' }], next_cursor: 'fixture/next' };
    const history = vi.fn().mockResolvedValue(result); const { run } = await runSearch(history);
    const packet = await run(); expect(history).toHaveBeenCalledTimes(1);
    expect(history.mock.calls[0][1].cursor).toBe(args.cursor);
    expect(packet.tool_receipts[0].result).toEqual(result);
  });

  it('does not call the backend without existing history access', async () => {
    const history = vi.fn(); const { run } = await runSearch(history, args, { history_access: null });
    const packet = await run(); expect(history).not.toHaveBeenCalled();
    expect(packet.tool_receipts[0].result).toEqual({ ok: false, error: 'knowledge_scope_unavailable' });
  });

  it('checks the deadline before the first backend attempt', async () => {
    let clock = 0; const history = vi.fn();
    const { run } = await runSearch(history, args, { now: () => clock, deadline_at_ms: 10,
      afterFirstModel: () => { clock = 20; } });
    await expect(run()).rejects.toThrow('site_assessment_deadline_exceeded');
    expect(history).not.toHaveBeenCalled();
  });
  it('restarts a rejected cursor through the actual authorized backend without asking the model to retry', async () => {
    const backend = createCompanyHistoryTools({ doc: () => ({ get: async () => ({ exists: false }) }) } as any, access,
      { load: async () => ({ records: [], diagnostics: [], coverage: ['synthetic-empty-corpus'] }), now: () => '2098-01-01T00:00:00Z' });
    const history = vi.fn(backend);
    const { run } = await runSearch(history); const packet = await run();
    expect(history).toHaveBeenCalledTimes(2);
    expect(history.mock.calls[0][1]).toEqual({ query: args.query,
      filters: { city: 'Chicago', company: 'fixture-company', kind: 'hypothesis' }, page_size: 20, cursor: args.cursor });
    expect(history.mock.calls[1][1]).toEqual({ query: args.query,
      filters: { city: 'Chicago', company: 'fixture-company', kind: 'hypothesis' }, page_size: 20 });
    expect(packet.tool_receipts).toHaveLength(1);
    expect(packet.tool_receipts[0].result).toMatchObject({ ok: true, rows: [],
      pagination_recovery: { status: 'completed', initial_result: { ok: false, error: 'company_history_cursor_changed' }, retry_arguments: { ...args, cursor: null } } });
    expect(packet.assessment.status).toBe('needs_operator_input');
  });

  it.each(['company_history_cursor_changed', 'company_history_ranking_changed'])('restarts once for exact %s and preserves access and a second refusal', async error => {
    const first = { ok: false, error, action: 'Restart without a cursor' };
    const second = { ok: false, error: 'company_history_access_expired' };
    const history = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const { run } = await runSearch(history); const packet = await run();
    expect(history).toHaveBeenCalledTimes(2);
    expect(history.mock.calls.every(call => call[2] === access)).toBe(true);
    expect(packet.tool_receipts[0].result).toMatchObject({ ...second,
      pagination_recovery: { status: 'completed', initial_result: first } });
  });

  it('does not enter a third attempt when the fresh request is still refused', async () => {
    const failure = { ok: false, error: 'company_history_cursor_changed' };
    const history = vi.fn().mockResolvedValue(failure);
    const { run } = await runSearch(history); const packet = await run();
    expect(history).toHaveBeenCalledTimes(2);
    expect(packet.tool_receipts[0].result).toMatchObject({ ...failure,
      pagination_recovery: { status: 'completed', initial_result: failure } });
  });

  it.each([null, '', 'null', ' null ', '   '])('does not recover an absent or blank cursor %j', async cursor => {
    const failure = { ok: false, error: 'company_history_cursor_changed' };
    const history = vi.fn().mockResolvedValue(failure);
    const { run } = await runSearch(history, { ...args, cursor } as typeof args); const packet = await run();
    expect(history).toHaveBeenCalledTimes(1);
    expect(packet.tool_receipts[0].result).toMatchObject(failure);
    expect(packet.tool_receipts[0].result).not.toHaveProperty('pagination_recovery');
  });

  it.each(['company_history_access_expired', 'company_history_arguments_invalid', 'company_history_read_failed', 'company_history_scope_invalid'])('does not recover unrelated %s', async error => {
    const failure = { ok: false, error }; const history = vi.fn().mockResolvedValue(failure);
    const { run } = await runSearch(history); const packet = await run();
    expect(history).toHaveBeenCalledTimes(1); expect(packet.tool_receipts[0].result).toEqual(failure);
  });

  it('retains the first refusal and skips recovery if the deadline expires during the first backend read', async () => {
    let clock = 0; const first = { ok: false, error: 'company_history_cursor_changed' };
    const history = vi.fn(async () => { clock = 20; return first; });
    const { agent, run } = await runSearch(history, args, { now: () => clock, deadline_at_ms: 10 });
    await expect(run()).rejects.toThrow('site_assessment_deadline_exceeded');
    expect(history).toHaveBeenCalledTimes(1);
    expect(agent.evidence().tool_receipts[0].result).toMatchObject({ ...first,
      pagination_recovery: { status: 'not_started', initial_result: first } });
  });

  it('preserves the initial result when the recovery throws, with a safe error', async () => {
    const first = { ok: false, error: 'company_history_cursor_changed' };
    const history = vi.fn().mockResolvedValueOnce(first).mockRejectedValueOnce(Error('private-test-diagnostic'));
    const { agent, run } = await runSearch(history); await run();
    expect(history).toHaveBeenCalledTimes(2);
    expect(agent.evidence().tool_receipts[0].result).toMatchObject({ ...first,
      pagination_recovery: { status: 'failed', initial_result: first, error: 'site_assessment_history_retry_failed' } });
    expect(JSON.stringify(agent.evidence())).not.toContain('private-test-diagnostic');
  });
});
