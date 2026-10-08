import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { summarize } from './reliability-schema.mjs';
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
const journeyIds = new Set();
for (const journey of journeys) { if (!journey.journeyId || !journey.layer || !journey.status) throw new Error('Incomplete journey record'); if (journeyIds.has(journey.journeyId)) throw new Error('Duplicate journey identity'); journeyIds.add(journey.journeyId); }
const journeySummary = { generated: journeys.length, attempted: journeys.filter(j => j.attempted === true).length, passedBoundary: journeys.filter(j => j.status === 'passed').length, failed: journeys.filter(j => j.status === 'failed').length, blocked: journeys.filter(j => j.status === 'blocked').length, partial: journeys.filter(j => j.status === 'partial').length, normalUi: journeys.filter(j => j.normalUi === true && j.attempted === true).length, fullJourneyComplete: journeys.filter(j => j.fullJourneyComplete === true && j.status === 'passed').length, layers: Object.fromEntries([...new Set(journeys.map(j => j.layer))].map(layer => [layer, journeys.filter(j => j.layer === layer).length])), note: 'Boundary passes do not imply completed upload/assessment/notification customer journeys.' };
const infrastructure = cases.filter(c => c.kind !== 'judgment'), judgment = cases.filter(c => c.kind === 'judgment');
const summary = { generatedAt: new Date().toISOString(), missing, journeys: journeySummary, infrastructure: summarize(infrastructure, results.filter(r => infrastructure.some(c => c.caseId === r.caseId))), judgment: summarize(judgment, results.filter(r => judgment.some(c => c.caseId === r.caseId))) };
await writeFile(path.join(root, 'coverage-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
