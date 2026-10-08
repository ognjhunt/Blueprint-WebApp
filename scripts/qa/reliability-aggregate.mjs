import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { summarize, summarizeJourneys } from './reliability-schema.mjs';
const root = process.argv[2];
if (!root || !path.isAbsolute(root)) throw new Error('Usage: node scripts/qa/reliability-aggregate.mjs /absolute/private/program-root');
const cases = [], results = [], journeys = [], missing = [];
for (const owner of ['A', 'B', 'C', 'D', 'E']) {
  for (const [name, dest] of [['cases', cases], ['results', results]]) {
    try {
      const data = JSON.parse(await readFile(path.join(root, owner, `${name}.json`), 'utf8'));
      dest.push(...(Array.isArray(data) ? data : data[name] ?? []));
    } catch (error) { if (error.code === 'ENOENT') missing.push(`${owner}/${name}.json`); else throw error; }
  }
  try { const data = JSON.parse(await readFile(path.join(root, owner, 'journeys.json'), 'utf8')); journeys.push(...(Array.isArray(data) ? data : data.journeys ?? [])); }
  catch (error) { if (error.code === 'ENOENT') missing.push(`${owner}/journeys.json`); else throw error; }
}
const journeySummary = summarizeJourneys(journeys);
const infrastructure = cases.filter(c => c.kind !== 'judgment'), judgment = cases.filter(c => c.kind === 'judgment');
const summary = { generatedAt: new Date().toISOString(), missing, journeys: journeySummary, infrastructure: summarize(infrastructure, results.filter(r => infrastructure.some(c => c.caseId === r.caseId))), judgment: summarize(judgment, results.filter(r => judgment.some(c => c.caseId === r.caseId))) };
await writeFile(path.join(root, 'coverage-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
