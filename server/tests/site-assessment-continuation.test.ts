// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Usage, type Model, type ModelResponse } from '@openai/agents';
import { createHash } from 'node:crypto';
import { createSiteAssessmentAgent, type SiteAssessment } from '../agents/site-assessment';
import { SiteAssessmentBudget } from '../agents/adapters/site-assessment-budget';
import { analyseAgenticVideo } from '../agents/adapters/gemini-video';
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
  it('stops fresh probes after two consecutive probes add no new exact typed evidence items', async () => {
    const analyze = vi.fn(async () => ({ evidence: observation(1), receipt: { mode: 'offline' } }));
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(4), authorize_model_call: async () => {}, analyze_video: analyze });
    const packet = await instance.run(); expect(analyze).toHaveBeenCalledTimes(3);
    expect(packet.tool_receipts.at(-1)?.result).toMatchObject({ ok: false, error: 'assessment_video_no_new_evidence' });
    expect(packet.assessment.status).toBe('needs_operator_input');
  });
  it('preserves an explicit host allowance rather than replacing program-specific authority', async () => {
    let n = 0; const analyze = vi.fn(async () => ({ evidence: observation(++n), receipt: { mode: 'offline' } }));
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(4), authorize_model_call: async () => {}, analyze_video: analyze, max_video_calls: 1 });
    const packet = await instance.run(); expect(analyze).toHaveBeenCalledTimes(1);
    expect(packet.tool_receipts.at(-1)?.result).toMatchObject({ ok: false, error: 'video_call_limit' });
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
  it('does not dispatch Gemini when the unchanged spending reservation cannot fit', async () => {
    vi.stubEnv('BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD', '0.1');
    const budget = new SiteAssessmentBudget(), authorize = vi.fn(async (provider: 'openai' | 'gemini', name: string, request?: unknown) => {
      if (provider === 'gemini') budget.authorize(provider, name, request);
    });
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(1),
      video_bytes: { body: bytes, byteLength: bytes.length, contentType: 'video/mp4' }, authorize_model_call: authorize });
    await instance.run(); expect(analyseAgenticVideo).not.toHaveBeenCalled(); expect(budget.calls).toHaveLength(0);
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
  it('does not count reordered known observations as progress', async () => {
    let n = 0; const analyze = vi.fn(async () => ({ evidence: { summary: `different wording ${++n}`,
      observations: n % 2 ? [observation(1).observations[0], observation(2).observations[0]]
        : [observation(2).observations[0], observation(1).observations[0]], not_observable: ['Success criterion'] }, receipt: {} }));
    const instance = await createSiteAssessmentAgent(input, { history_access: null, model: model(4), authorize_model_call: async () => {}, analyze_video: analyze });
    const packet = await instance.run(); expect(analyze).toHaveBeenCalledTimes(3);
    expect(packet.tool_receipts.at(-1)?.result).toMatchObject({ error: 'assessment_video_no_new_evidence' });
  });
  it('preserves unresolved-exposure blocking before additional useful probes', () => {
    const budget = new SiteAssessmentBudget(); budget.authorize('gemini', 'gemini-3.8-flash');
    expect(() => budget.authorize('gemini', 'gemini-3.8-flash')).toThrow('site_assessment_cost_unresolved');
    expect(budget.artifacts().inference_reservation.unknown_usage_reserved_cost_usd).toBeGreaterThan(0);
  });
});
