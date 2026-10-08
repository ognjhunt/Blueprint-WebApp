import { targetingDimensions, type TargetingCategories, type TargetingDimension, type ListingTargeting, type UpdatePreferences } from '../../client/src/types/updatePreferences';
import type { FieldProvenance, RobotTeamRecord } from '../types/robot-team-registry';

export type TargetingFact = { values: string[] | null; provenance: FieldProvenance | null };
export type TargetingFacts = Partial<Record<TargetingDimension, TargetingFact>>;
export type TargetingClause = { dimension: TargetingDimension; values: string[]; operator: 'any' | 'all' };
export type MatchResult = { status: 'eligible' | 'excluded' | 'unknown'; reasons: string[] };
const normalize = (value: string) => value.trim().toLowerCase();
export function matchClauses(facts: TargetingFacts, clauses: TargetingClause[]): MatchResult {
  const excluded: string[] = [], unknown: string[] = [];
  for (const clause of clauses) {
    if (!clause.values.length) continue;
    const fact = facts[clause.dimension];
    if (!fact?.values?.length || !fact.provenance?.source || !fact.provenance.observedAt || fact.provenance.grade === 'inferred') {
      unknown.push(clause.dimension); continue;
    }
    const values = new Set(fact.values.map(normalize));
    const matches = clause.values.map(value => values.has(normalize(value)));
    if (!(clause.operator === 'all' ? matches.every(Boolean) : matches.some(Boolean))) excluded.push(clause.dimension);
  }
  return excluded.length ? { status: 'excluded', reasons: excluded }
    : unknown.length ? { status: 'unknown', reasons: unknown } : { status: 'eligible', reasons: [] };
}
const clauses = (categories: TargetingCategories, operator: 'any' | 'all'): TargetingClause[] =>
  targetingDimensions.map(dimension => ({ dimension, values: categories[dimension] ?? [], operator }));
export function categoryFacts(categories: TargetingCategories, source: string, observedAt: string): TargetingFacts {
  return Object.fromEntries(targetingDimensions.map(dimension => [dimension, {
    values: categories[dimension]?.length ? categories[dimension] : null,
    provenance: { grade: 'self_reported', source, observedAt },
  }]));
}
/** Legacy prose is not parsed into invented categories. Only exact, sourced registry fields are reused. */
export function registryFacts(team: RobotTeamRecord): TargetingFacts {
  const fields = { embodiments: 'embodiment', taskFamilies: 'taskFamily', regions: 'deploymentRegions' } as const;
  return Object.fromEntries(Object.entries(fields).map(([dimension, field]) => [dimension, {
    values: team.capability[field] ? [team.capability[field]!] : null,
    provenance: team.fieldProvenance[field] ?? null,
  }]));
}
export function matchJob(preferences: UpdatePreferences, job: ListingTargeting, facts: TargetingFacts,
  source: string, observedAt: string): MatchResult {
  const results = [matchClauses(categoryFacts(job.categories, source, observedAt), clauses(preferences.interests, 'any')),
    matchClauses(facts, clauses(job.requiredRecipient, 'all'))];
  const excluded: string[] = [], unknown: string[] = [];
  const requirements = preferences.requirements;
  if (requirements.maxRetentionDays !== undefined) {
    if (job.retentionDays === undefined) unknown.push('retentionDays');
    else if (job.retentionDays > requirements.maxRetentionDays) excluded.push('retentionDays');
  }
  if (requirements.noTraining === true) {
    if (job.trainingUseAllowed === undefined) unknown.push('trainingUseAllowed');
    else if (job.trainingUseAllowed) excluded.push('trainingUseAllowed');
  }
  if (requirements.requiredRightsScopes?.length) {
    if (!job.rightsScopes) unknown.push('rightsScopes');
    else if (!requirements.requiredRightsScopes.every(value => job.rightsScopes!.map(normalize).includes(normalize(value)))) excluded.push('rightsScopes');
  }
  for (const result of results) (result.status === 'excluded' ? excluded : result.status === 'unknown' ? unknown : []).push(...result.reasons);
  return excluded.length ? { status: 'excluded', reasons: excluded }
    : unknown.length ? { status: 'unknown', reasons: unknown } : { status: 'eligible', reasons: [] };
}
