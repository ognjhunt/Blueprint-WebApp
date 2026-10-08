# Provisional semantic mutation catalog

`program-semantic-variants.json` contains **120 distinct typed evidence states**, 20 in each of six families: visibility; timing/requested action; owner/spec/video conflicts; measurements; robot capability; citation entailment. Sixty different evidence questions each have two consequentially different conditions. Differences include hidden versus visible contact, action outside versus inside the crop, adjacent versus requested action, trusted versus reversed ordering, matching versus stale configuration, conflicting versus compatible numeric limits, omitted versus retained qualifications, and simulation versus physical source attribution. Identifiers, seeds, source names, task-topic substitutions and rationale prose do not enter the semantic-state hash. All 120 typed states remain distinct even when claim text and relationship names are excluded.

These are **PROVISIONAL, unscored synthetic evidence packets**, authored for this program and retained in Blueprint-owned Git. They contain no actual video bytes, people, customer records, private dishwasher fixture, external footage or provider output. The twelve source groups organize evidence questions; each pair shares its source and development split. Source hashes identify the invented packet metadata; case hashes identify the actual meaningful evidence state, claim and source relationship. They are portable JSON, not provider-dependent identifiers. No source is an untouched holdout: every authoring agent can inspect all fixtures and labels.

Generated: **120**; meaningful-state deduplicated: **120**; catalog structure/hash checks attempted/passed: **120/120**. Semantic model judgments attempted/scored: **0/0**; semantic cases unscored: **120**. Human-reviewed truth labels: **0**; real reference videos added: **0**. Expected constraints are 2 invariant, 7 weaken, 88 change and 23 abstain. “Change” can require a bounded negative finding or a bounded positive finding; it never implies general robot suitability. The invariant pairs preserve an unestablished hourly-throughput/physical-measurement claim despite a meaningful source condition change.

Every case retains typed facts, its candidate claim, paired source relationship, provisional response constraint, forbidden claim and rationale. Agent agreement does not turn expectations into gold. Independent expectation inspection found overqualification of several narrow positive claims and incorrect handling of a visible fixture translation. Corrections are explicitly retained in `definitionCorrections` as label version `provisional.v2`: each case now states provisional claim support (55 supported, 32 contradicted, 33 unknown), with broader forbidden claims when the narrow claim has support. Source authenticity and physical outcomes remain unscored. Independent reinspection approved the corrected expectations and separately passed 120 catalog checks. A stricter final dedup check found one identical full-clip state serving different temporal questions; the placement positive now uses an ending-only destination camera crop showing placement while hiding pickup and the source-to-destination path. This is a consequential view change, not an arbitrary timestamp multiplier. Independent review also approved this refinement. The correction is retained explicitly; any further correction must be versioned explicitly. No semantic acceptance threshold or accuracy denominator was scored. This catalog replaces the old topic-multiplied inventory's semantic count; it must not be added to that inventory as another 120 cases.

Existing production video projection functions enforce timestamps, allowed evidence states and interval arithmetic. They cannot establish the meanings of these invented observations, physical measurements, source contradictions or capability claims. Calling those guards would not execute a semantic judgment, so none is credited. Running a future model evaluation would require its own authorized resources and evidence/label policy; this artifact performs no paid call, upload or send.

Replay the catalog checks from the repository root with Node only:

```bash
node --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const path = 'docs/reliability/2026-10-07/program-semantic-variants.json';
const d = JSON.parse(readFileSync(path, 'utf8'));
const canonical = x => x !== null && typeof x === 'object'
  ? Array.isArray(x) ? x.map(canonical)
    : Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
const hash = x => createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
assert.equal(d.schemaVersion, 'blueprint-semantic-variants.v1');
assert.equal(d.status, 'PROVISIONAL_UNSCORED');
assert.equal(d.labelVersion, 'provisional.v2');
assert.equal(d.cases.length, 120);
assert.equal(new Set(d.cases.map(c => c.semanticHash)).size, 120);
assert.equal(new Set(d.cases.map(c => hash(c.meaningfulParameters.evidenceState))).size, 120);
assert.equal(new Set(d.cases.map(c => c.id)).size, 120);
const sources = new Map(d.sources.map(s => [s.sourceId, s]));
const cases = new Map(d.cases.map(c => [c.id, c]));
assert.equal(sources.size, 12);
for (const s of sources.values()) {
  const { sourceHash, ...metadata } = s;
  assert.equal(sourceHash, hash(metadata));
  assert.equal(s.split, 'development');
}
const counts = {};
for (const c of d.cases) {
  assert.equal(c.semanticHash, hash(c.meaningfulParameters));
  assert.equal(c.id, `SEM-${c.semanticHash.slice(0,16)}`);
  assert.equal(c.labelStatus, 'PROVISIONAL');
  assert.equal(c.labelVersion, 'provisional.v2');
  assert.ok(['supported','contradicted','unknown'].includes(c.claimSupport));
  if (c.claimSupport === 'supported') assert.notEqual(c.forbiddenClaim, c.meaningfulParameters.candidateClaim);
  assert.equal(c.sourceHash, sources.get(c.sourceId)?.sourceHash);
  assert.equal(c.split, 'development');
  assert.ok(['invariant','weaken','change','abstain'].includes(c.expectedBehavior));
  assert.ok(c.rationale && c.forbiddenClaim && c.expectationMeaning);
  const peer = cases.get(c.sourceRelationship.counterpartCaseId);
  assert.equal(peer.pairId, c.pairId);
  assert.equal(peer.sourceId, c.sourceId);
  assert.notEqual(peer.pairSide, c.pairSide);
  assert.notEqual(hash(peer.meaningfulParameters.evidenceState), hash(c.meaningfulParameters.evidenceState));
  assert.equal(c.execution.catalogCheck, 'passed');
  assert.equal(c.execution.semanticModelAttempted, false);
  assert.equal(c.execution.semanticScore, null);
  counts[c.family] = (counts[c.family] || 0) + 1;
}
assert.equal(Object.keys(counts).length, 6);
assert.ok(Object.values(counts).every(n => n === 20));
assert.equal(d.counts.semanticModelAttempted, 0);
assert.equal(d.counts.semanticUnscored, 120);
assert.equal(d.counts.humanReviewedLabels, 0);
assert.equal(d.holdout.claimed, false);
console.log(JSON.stringify({catalogChecked:120,catalogPassed:120,familyCounts:counts,semanticAttempted:0,semanticUnscored:120}));
JS
```

This command checks schema, source lineage, paired differences and byte-stable hashes. It does not verify semantic entailment, observation truth, footage accuracy or beta readiness. The JSON and this command are the canonical export/recovery route; no private raw trace needs sharing because no semantic run occurred.
