// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Usage, type Model, type ModelResponse } from '@openai/agents';
import { createHash } from 'node:crypto';
import { createSiteAssessmentAgent, type SiteAssessment } from '../agents/site-assessment';
import { SiteAssessmentBudget } from '../agents/adapters/site-assessment-budget';
import { analyseAgenticVideo } from '../agents/adapters/gemini-video';
import { createCompanyHistoryTools } from '../research-learning/company-history';
vi.mock('../agents/adapters/gemini-video', () => ({
  analyseAgenticVideo: vi.fn(), openVideo: vi.fn(), GeminiVideoError: class extends Error {},
}));
const bytes = Buffer.from('isolated-video-fixture');
const input = { request_id: 'continuation-fixture', operator_messages: [{ id: 'owner', text: 'Assess the recurring job', source_ref: 'fixture/owner' }],
  video: { source_id: 'fixture', source_ref: 'fixture/video', url: 'https://invalid.test/video', sha256: createHash('sha256').update(bytes).digest('hex'), duration_seconds: 30 },
  site_requirement: { spec: {}, serviceArea: null, location: { label: null, city: null, state: null, country: null }, taskFamily: null } };
const final: SiteAssessment = { status: 'needs_operator_input', job: [], objects_motions_conditions_variations: [], operator_success: [], known: [], estimates: [], missing: [], approaches: [],
  next_action: { kind: 'ask_operator', action: 'Clarify the remaining uncertainty', why: { text: 'The evidence is incomplete', basis: 'unknown', evidence: [] } }, questions: [] };
function model(probes: number, after?: (turn: number) => void): Model {
  let turn = 0;
  return { async getResponse(): Promise<ModelResponse> { turn++; after?.(turn);
    return { usage: new Usage(), output: turn <= probes ? [{ type: 'function_call', callId: `probe-${turn}`, name: 'analyze_site_video',
      arguments: JSON.stringify({ question: `Inspect consequential event ${turn}`, processing: 'auto', sampling_fps: 2 }) }]
      : [{ type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(final) }] }] };
  }, async *getStreamedResponse() { throw new Error('not_used'); } };
}
const observation = (n: number) => ({ summary: `Reading ${n}`, observations: [{ category: 'motion' as const, finding: `Motion ${n}`, basis: 'observed' as const,
  start_seconds: n, end_seconds: n + 1, uncertainty: null }], not_observable: ['Success criterion'] });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('GEMINI_API_KEY', 'noncredential-offline-fixture'); vi.stubEnv('BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD', '5'); });
describe('assessment continuation policy (scripted SDK, no provider dispatch)', () => {
  it('recovers string null optional search fields without bypassing real cursor or access checks', async () => {
    let turn = 0;
    const invalid = { query: 'visible manipulation', city: 'Chicago', task: null, company: 'fixture-company', kind: 'hypothesis', cursor: '<opaque next_cursor>' };
    const readRestart = (value: unknown): any => {
      if (typeof value === 'string') { try { return readRestart(JSON.parse(value)); } catch { return undefined; } }
      if (!value || typeof value !== 'object') return undefined;
      if ('retry_arguments' in value) return (value as any).retry_arguments;
      for (const child of Object.values(value)) { const found = readRestart(child); if (found) return found; }
    };
    const scripted: Model = { async getResponse(request) {
      turn++;
      const args = turn === 1 ? { ...invalid, city: 'null', company: 'null', cursor: 'null' }
        : turn === 2 ? invalid : readRestart(request.input) ?? invalid;
      return { usage: new Usage(), output: turn < 4 ? [{ type: 'function_call' as const, callId: `search-${turn}`, name: 'search_robot_knowledge', arguments: JSON.stringify(args) }]
        : [{ type: 'message' as const, role: 'assistant' as const, status: 'completed' as const,
          content: [{ type: 'output_text' as const, text: JSON.stringify(final) }] }] };
    }, async *getStreamedResponse() { throw Error('not_used'); } };
    const access = { principalId: 'retained-scope', companyWide: false, expiresAt: '2099-01-01T00:00:00Z' };
    const backend = createCompanyHistoryTools({ doc: () => ({ get: async () => ({ exists: false }) }) } as any, access, {
      load: async () => ({ records: [], diagnostics: [], coverage: ['synthetic-empty-authorized-corpus'] }), now: () => '2098-01-01T00:00:00Z',
    });
    const history = vi.fn(backend);
    const agent = await createSiteAssessmentAgent({ ...input, operator_messages: [] }, {
      history_access: access, model: scripted, history_tool: history, authorize_model_call: async () => {} });
    const packet = await agent.run();
    expect(history.mock.calls[0].slice(0, 2)).toEqual(['search_company_history', { query: invalid.query, filters: { kind: 'hypothesis' }, page_size: 20 }]);
    expect(history.mock.calls[1][1]).toHaveProperty('cursor', invalid.cursor);
    expect(packet.tool_receipts[1].result).toMatchObject({ ok: true,
      pagination_recovery: { status: 'completed', initial_result: { ok: false, error: 'company_history_cursor_changed' }, retry_arguments: { ...invalid, cursor: null } } });
    expect(history.mock.calls[2][1]).toEqual({ query: invalid.query, filters: { city: 'Chicago', company: 'fixture-company', kind: 'hypothesis' }, page_size: 20 });
    expect(history).toHaveBeenCalledTimes(4);
    expect(history.mock.calls[3][1]).toEqual(history.mock.calls[2][1]);
    expect(packet.tool_receipts.map(row => (row.result as any).ok)).toEqual([true, true, true]);
    expect(packet.sources.some(row => row.kind === 'operator')).toBe(false);
  });
  it('continues past twelve SDK turns while new evidence remains available', async () => {
    let n = 0; const analyze = vi.fn(async () => ({ evidence: observation(++n), receipt: { mode: 'offline' } }));
    const authorize = vi.fn(async () => {});
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(13),
      authorize_model_call: authorize, analyze_video: analyze });
    const packet = await instance.run();
    expect(analyze).toHaveBeenCalledTimes(13);
    expect(authorize).toHaveBeenCalledTimes(14);
    expect(packet.assessment.status).toBe('needs_operator_input');
  });
  it('allows a useful fourth Gemini probe through the real budget admission and response accounting seams', async () => {
    const budget = new SiteAssessmentBudget(); let n = 0;
    vi.mocked(analyseAgenticVideo).mockImplementation(async () => ({ text: JSON.stringify(observation(++n)), processing: 'STATIC',
      usage: { promptTokenCount: 100, candidatesTokenCount: 100 }, modelVersion: 'offline-fixture' } as any));
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(4),
      video_bytes: { body: bytes, byteLength: bytes.length, contentType: 'video/mp4' },
      authorize_model_call: async (provider, name, request) => { if (provider === 'gemini') budget.authorize(provider, name, request); },
      record_model_response: async (provider, name, response) => { if (provider === 'gemini') budget.record(provider, name, response); } });
    const packet = await instance.run();
    expect(analyseAgenticVideo).toHaveBeenCalledTimes(4);
    expect(budget.calls).toHaveLength(4); expect(budget.calls.every(call => call.response !== null)).toBe(true);
    expect(packet.tool_receipts.map(row => (row.result as any).ok)).toEqual([true, true, true, true]);
  });
  it('allows distinct Gemini questions even when consecutive readings repeat known evidence', async () => {
    const analyze = vi.fn(async () => ({ evidence: observation(1), receipt: { mode: 'offline' } }));
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(4), authorize_model_call: async () => {}, analyze_video: analyze });
    const packet = await instance.run(); expect(analyze).toHaveBeenCalledTimes(4);
    expect(packet.tool_receipts.every(row => (row.result as any).ok)).toBe(true);
    expect(packet.assessment.status).toBe('needs_operator_input');
  });
  it('uses evidence progress and operational limits instead of a provider-call spending quota', async () => {
    let n = 0; const analyze = vi.fn(async () => ({ evidence: observation(++n), receipt: { mode: 'offline' } }));
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(4), authorize_model_call: async () => {}, analyze_video: analyze });
    const packet = await instance.run(); expect(analyze).toHaveBeenCalledTimes(4);
    expect(packet.tool_receipts.every(row => (row.result as any).ok)).toBe(true);
  });
  it('does not dispatch a new Gemini or Sol call after the assessment deadline', async () => {
    let clock = 0; const analyze = vi.fn(async () => ({ evidence: observation(1), receipt: {} }));
    const authorize = vi.fn(async () => {});
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(1, () => { clock = 20; }),
      authorize_model_call: authorize, analyze_video: analyze, now: () => clock, deadline_at_ms: 10 });
    await expect(instance.run()).rejects.toThrow('site_assessment_deadline_exceeded');
    expect(analyze).not.toHaveBeenCalled(); expect(authorize).toHaveBeenCalledTimes(1);
    expect(instance.evidence().tool_receipts[0]?.result).toMatchObject({ error: 'assessment_time_budget_exhausted' });
  });
  it('dispatches Gemini despite a former spending cap and retains its usage', async () => {
    vi.stubEnv('BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD', '0.1');
    const budget = new SiteAssessmentBudget(), authorize = vi.fn(async (provider: 'openai' | 'gemini', name: string, request?: unknown) => {
      if (provider === 'gemini') budget.authorize(provider, name, request);
    });
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(1),
      video_bytes: { body: bytes, byteLength: bytes.length, contentType: 'video/mp4' }, authorize_model_call: authorize });
    vi.mocked(analyseAgenticVideo).mockResolvedValue({ text: JSON.stringify(observation(1)), processing: 'STATIC', usage: null } as any);
    await instance.run(); expect(analyseAgenticVideo).toHaveBeenCalledTimes(1); expect(budget.calls).toHaveLength(1);
    expect(authorize.mock.results.some(row => row.type === 'return')).toBe(true);
  });
  it('checks the deadline again after asynchronous Sol admission before dispatch', async () => {
    let clock = 0; const underlying = model(0); const response = vi.spyOn(underlying, 'getResponse');
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: underlying,
      authorize_model_call: async () => { clock = 20; }, now: () => clock, deadline_at_ms: 10 });
    await expect(instance.run()).rejects.toThrow('site_assessment_deadline_exceeded');
    expect(response).not.toHaveBeenCalled();
  });
  it('checks the deadline again after asynchronous Gemini admission before dispatch', async () => {
    let clock = 0;
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(1),
      video_bytes: { body: bytes, byteLength: bytes.length, contentType: 'video/mp4' },
      authorize_model_call: async provider => { if (provider === 'gemini') clock = 20; }, now: () => clock, deadline_at_ms: 10 });
    await expect(instance.run()).rejects.toThrow('site_assessment_deadline_exceeded');
    expect(analyseAgenticVideo).not.toHaveBeenCalled();
  });
  it('does not impose a fresh-call count gate on reordered known observations', async () => {
    let n = 0; const analyze = vi.fn(async () => ({ evidence: { summary: `different wording ${++n}`,
      observations: n % 2 ? [observation(1).observations[0], observation(2).observations[0]]
        : [observation(2).observations[0], observation(1).observations[0]], not_observable: ['Success criterion'] }, receipt: {} }));
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(4), authorize_model_call: async () => {}, analyze_video: analyze });
    const packet = await instance.run(); expect(analyze).toHaveBeenCalledTimes(4);
    expect(packet.tool_receipts.every(row => (row.result as any).ok)).toBe(true);
  });
  it('has no implicit ten-minute assessment deadline while retaining explicit host deadlines', async () => {
    let clock = 0; const analyze = vi.fn(async () => ({ evidence: observation(1), receipt: {} }));
    const instance = await createSiteAssessmentAgent(input, { history_access: null,
      model: model(1, () => { clock += 11 * 60 * 1000; }), now: () => clock,
      authorize_model_call: async () => {}, analyze_video: analyze });
    expect((await instance.run()).assessment.status).toBe('needs_operator_input');
    expect(analyze).toHaveBeenCalledTimes(1);
  });
  it('retains unresolved exposure while permitting distinct useful probes', () => {
    const budget = new SiteAssessmentBudget(); budget.authorize('gemini', 'gemini-3.8-flash');
    expect(() => budget.authorize('gemini', 'gemini-3.8-flash')).not.toThrow();
    expect(budget.calls).toHaveLength(2);
    expect(budget.artifacts().inference_reservation.unknown_usage_reserved_cost_usd).toBeGreaterThan(0);
  });
});
