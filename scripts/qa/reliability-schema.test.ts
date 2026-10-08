// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { semanticHash, summarize, summarizeJourneys } from './reliability-schema.mjs';
const sample = (caseId: string, layer = 'actual-handler/fake-storage') => ({ caseId, family: 5, parameters: { evidence: 'missing marker' }, expectedTransitions: ['published', 'retained'], layer, replayCommand: 'local-replay', semanticHash: '' });
describe('reliability evidence denominator', () => {
  it('deduplicates renamed fixtures and different code revisions, retains every execution, and exposes a failing repeat', () => {
    const a = { ...sample('a'), codeSha: 'before', seed: 1 }, b = { ...sample('b'), codeSha: 'after', seed: 2 };
    expect(semanticHash(a)).toBe(semanticHash(b));
    const report = summarize([a, b], [{ caseId: 'a', status: 'passed', attempted: true }, { caseId: 'b', status: 'passed', attempted: true }, { caseId: 'b', status: 'failed', attempted: true }]);
    expect(report.counts).toMatchObject({ generated: 2, deduplicated: 1, attempted: 1, passed: 0, failed: 1, executions: 3 });
  });
  it('keeps missing and blocked evidence outside pass counts', () => {
    const a = sample('a'), b = { ...sample('b'), parameters: { evidence: 'database unavailable' } }, c = { ...sample('c'), parameters: { evidence: 'held out video unavailable' } };
    const report = summarize([a, b, c], [{ caseId: 'a', status: 'passed', attempted: true }, { caseId: 'b', status: 'blocked', attempted: false }]);
    expect(report.counts).toMatchObject({ deduplicated: 3, attempted: 1, passed: 1, blocked: 1, notExecuted: 1 });
  });
  it('refuses uncorrelated results, duplicate identities and stale semantic hashes', () => {
    expect(() => summarize([sample('a')], [{ caseId: 'unknown', status: 'passed' }])).toThrow('Unknown result');
    expect(() => summarize([sample('a'), sample('a')], [])).toThrow('Duplicate caseId');
    expect(() => summarize([{ ...sample('a'), semanticHash: 'stale' }], [])).toThrow('Semantic hash mismatch');
  });
});

 it('counts browser repeats once and never credits intercepted UI as real backend', () => {
   const mock = { journeyId: 'ui-one', parameters: { boundary: 'lost response' }, layer: 'intercepted-api', status: 'passed', attempted: true, normalUi: true, fullJourneyComplete: false };
   const report = summarizeJourneys([mock, { ...mock, repeat: 2 }, { ...mock, journeyId: 'renamed-ui', repeat: 3 }]);
   expect(report).toMatchObject({ generated: 2, deduplicated: 1, executions: 3, attempted: 1, passedBoundary: 1, normalUiAttempted: 1, normalUiRealBackendAttempted: 0, fullJourneyComplete: 0 });
 });
