import { describe, expect, it } from 'vitest';
import { canaryCandidateSummaries, pairedCanaryComparison } from '@/lib/policyCanaryResultPortal';
import type { TaskEvaluationResultSiteRecord } from '@/lib/taskEvaluationResults';

const ep = (candidate: string, cell: number, outcome: boolean | null, valid: unknown = true): any => ({
  episode_id: `${candidate}-${cell}`, episode_kind: 'learned_candidate', subject_id: candidate,
  variation: { cell_id: `cell-${cell}`, seed: cell },
  score: { task_succeeded: outcome, policy_outcome_interpretable: valid },
});
const record = (episodes: any[], ids = ['a', 'b']) => ({ publication: {
  policy_candidates: ids.map(candidate_id => ({ candidate_id, display_name: candidate_id })),
  result_delivery: { episodes },
} } as unknown as TaskEvaluationResultSiteRecord);

describe('paired arithmetic independent regressions', () => {
  it('uses 2 shared pairs, not marginal 2/6 versus 4/6, and is order invariant', () => {
    const episodes = Array.from({length: 10}, (_, i) => [
      ep('a', i, i < 2, i < 6), ep('b', i, i >= 6, i < 2 || i >= 6),
    ]).flat();
    for (const rows of [episodes, [...episodes].reverse()]) for (const ids of [['a','b'], ['b','a']]) {
      const result = pairedCanaryComparison(record(rows, ids));
      expect(result).toMatchObject({ leader: { candidate_id: 'a' }, deltaPoints: 100,
        comparablePairs: 2, leaderOnlyWins: 2, laggardOnlyWins: 0, pValue: 0.5 });
    }
    expect(canaryCandidateSummaries(record(episodes))).toMatchObject([
      {success_count: 2, interpretable_count: 6, excluded_count: 4},
      {success_count: 4, interpretable_count: 6, excluded_count: 4},
    ]);
  });
  it('does not compare disjoint validity sets or no delivered pairs', () => {
    for (const rows of [[], [ep('a',0,true), ep('b',0,null,false), ep('a',1,null,false), ep('b',1,true)]]) {
      expect(pairedCanaryComparison(record(rows))).toMatchObject({leader: null, comparablePairs: 0, deltaPoints: null, pValue: null});
    }
  });
  it('keeps unequal overall denominators separate', () => {
    const rows = [ep('a',0,false), ep('b',0,true), ep('a',1,true)];
    expect(pairedCanaryComparison(record(rows))).toMatchObject({deltaPoints: 100, comparablePairs: 1, pValue: 1});
    expect(canaryCandidateSummaries(record(rows)).map(x => x.interpretable_count)).toEqual([2,1]);
  });
  it('handles all ties and a single tied pair without invented uncertainty', () => {
    for (const rows of [[ep('a',0,true),ep('b',0,true)], [ep('a',0,true),ep('b',0,true),ep('a',1,false),ep('b',1,false)]]) {
      expect(pairedCanaryComparison(record(rows))).toMatchObject({deltaPoints: 0, leader: null, discordantPairs: 0, pValue: null});
    }
  });
  it.each([undefined, null, false])('excludes unknown/uninterpretable score %s', valid => {
    const a = ep('a',0,true); a.score.policy_outcome_interpretable = valid;
    expect(pairedCanaryComparison(record([a,ep('b',0,false)]))?.comparablePairs).toBe(0);
  });
  it('excludes absent scores and absent binding', () => {
    const a = ep('a',0,true); delete a.score;
    expect(pairedCanaryComparison(record([a,ep('b',0,false)]))?.comparablePairs).toBe(0);
    a.score = {task_succeeded:true,policy_outcome_interpretable:true}; delete a.variation;
    expect(pairedCanaryComparison(record([a,ep('b',0,false)]))?.comparablePairs).toBe(0);
  });
  it('does not select an arbitrary duplicate or discard valid failures', () => {
    const rows = [ep('a',0,true),ep('a',0,false),ep('b',0,true),ep('a',1,false),ep('b',1,true)];
    for (const order of [rows,[...rows].reverse()]) {
      expect(pairedCanaryComparison(record(order))).toMatchObject({comparablePairs:1,deltaPoints:100,leader:{candidate_id:'b'}});
      expect(canaryCandidateSummaries(record(order))[0]).toMatchObject({success_count:0,interpretable_count:1,excluded_count:2});
    }
  });
  it("excludes missing outcomes even when interpretability is explicitly true", () => {
    const a=ep('a',0,null); delete a.score.task_succeeded;
    expect(pairedCanaryComparison(record([a,ep('b',0,true)]))?.comparablePairs).toBe(0);
  });

});
