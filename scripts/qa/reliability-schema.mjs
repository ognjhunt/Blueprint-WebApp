import { createHash } from 'node:crypto';
export const SCHEMA_VERSION = 'blueprint_reliability.v1';
export const FAMILIES = { 1: 'intake', 2: 'upload', 3: 'return', 4: 'ordering', 5: 'storage-index', 6: 'access-consent', 7: 'provider', 8: 'worker', 9: 'status-assessment', 10: 'notification-accounting' };
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, canonical(val)]));
  return value;
}
// Version, opaque identity, seed, and repeated execution are deliberately absent.
export function semanticHash(testCase) {
  return createHash('sha256').update(JSON.stringify(canonical({ kind: testCase.kind ?? 'infrastructure', family: testCase.family, parameters: testCase.parameters, expectedTransitions: testCase.expectedTransitions, sourceId: testCase.sourceId ?? null, split: testCase.split ?? null }))).digest('hex');
}
export function summarize(cases, results) {
  const unique = new Map();
  const ids = new Set();
  for (const testCase of cases) {
    if (!testCase.caseId || !testCase.parameters || !testCase.expectedTransitions || !testCase.layer || !testCase.replayCommand) throw new Error('Incomplete case definition');
    if (ids.has(testCase.caseId)) throw new Error(`Duplicate caseId: ${testCase.caseId}`);
    ids.add(testCase.caseId);
    const hash = semanticHash(testCase);
    if (testCase.semanticHash && testCase.semanticHash !== hash) throw new Error(`Semantic hash mismatch: ${testCase.caseId}`);
    if (!unique.has(hash)) unique.set(hash, []);
    unique.get(hash).push(testCase);
  }
  for (const result of results) if (!ids.has(result.caseId)) throw new Error(`Unknown result caseId: ${result.caseId}`);
  const count = { generated: cases.length, deduplicated: unique.size, attempted: 0, passed: 0, failed: 0, skipped: 0, blocked: 0, partial: 0, notExecuted: 0, executions: results.length };
  const layers = {}; const families = {};
  // Any failing repeat fails its semantic case. A partial or blocked repeat cannot be hidden by a pass.
  const precedence = ['failed', 'partial', 'blocked', 'skipped', 'passed'];
  for (const equivalents of unique.values()) {
    const executions = results.filter(result => equivalents.some(testCase => testCase.caseId === result.caseId));
    if (executions.some(result => result.attempted === true)) count.attempted++;
    for (const result of executions) if (!precedence.includes(result.status)) throw new Error(`Unknown result status: ${result.status}`);
    const status = precedence.find(candidate => executions.some(result => result.status === candidate)) ?? 'notExecuted';
    count[status]++;
    const testCase = equivalents[0];
    const family = `${testCase.kind ?? 'infrastructure'}:${testCase.family}`;
    families[family] ??= { deduplicated: 0, attempted: 0, passed: 0, failed: 0, blocked: 0, partial: 0, skipped: 0, notExecuted: 0 };
    families[family].deduplicated++; families[family][status]++;
    if (executions.some(result => result.attempted === true)) families[family].attempted++;
    for (const layer of new Set(equivalents.map(c => c.layer))) {
      layers[layer] ??= { semanticCases: 0, executions: 0 };
      layers[layer].semanticCases++; layers[layer].executions += executions.filter(r => (r.layer ?? testCase.layer) === layer).length;
    }
  }
  const measurements = {};
  for (const result of results) {
    const testCase = cases.find(c => c.caseId === result.caseId);
    const layer = result.layer ?? testCase.layer;
    measurements[layer] ??= { latencyMs: [], knownCostRows: 0, unknownCostRows: 0, knownCostByCurrency: {} };
    const metric = measurements[layer];
    if (Number.isFinite(result.latencyMs) && result.latencyMs >= 0) metric.latencyMs.push(result.latencyMs);
    if (result.cost?.known === true && Number.isFinite(result.cost.total) && result.cost.currency) {
      metric.knownCostRows++; metric.knownCostByCurrency[result.cost.currency] = (metric.knownCostByCurrency[result.cost.currency] ?? 0) + result.cost.total;
    } else metric.unknownCostRows++;
  }
  for (const metric of Object.values(measurements)) {
    const values = metric.latencyMs.sort((a, b) => a - b);
    metric.latencyMs = { executionCount: values.length, minimum: values[0] ?? null, median: values[Math.floor(values.length / 2)] ?? null, p95: values[Math.max(0, Math.ceil(values.length * .95) - 1)] ?? null, maximum: values.at(-1) ?? null };
  }
  return { schemaVersion: SCHEMA_VERSION, counts: count, families, layers, measurements, note: 'Layer totals can overlap: never sum them as unique coverage. Executions include repeats, not extra semantic cases.' };
}
