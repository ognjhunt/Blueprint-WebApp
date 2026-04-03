# Hermes KB Design

## Purpose

This repo gets a constrained Hermes knowledge base under [`knowledge/`](/Users/nijelhunt_1/workspace/Blueprint-WebApp/knowledge).

The goal is not to create a second company brain that competes with Paperclip, Notion, Firebase, package manifests, or capture provenance. The goal is to give Hermes-backed research and enablement agents a durable markdown workspace where useful research compounds across runs.

This design follows Blueprint's repo doctrine:

- Paperclip remains the source of truth for work state and ownership.
- Rights, privacy, approvals, pricing commitments, package/runtime truth, and capture provenance stay in their canonical systems.
- Hermes KB pages are support artifacts for research, synthesis, and reusable enablement.

## Authority Boundary

The Hermes KB is allowed to support:

- market and competitor research
- account dossiers
- sales, procurement, and support playbooks
- documentation synthesis
- founder brief background research

The Hermes KB is not allowed to become the source of truth for:

- Paperclip work state
- approvals or sign-off state
- rights or privacy decisions
- pricing or legal commitments
- capture provenance
- package manifests or hosted runtime truth

If a KB page discusses any of the forbidden categories, it must link out to the authoritative system and explicitly say that the KB page is derivative context only.

## Directory Layout

```text
knowledge/
  AGENTS.md
  README.md
  raw/
    README.md
    web/
    notion/
    drive/
    repo/
    paperclip/
  compiled/
    README.md
    market-intel/
    supply-intel/
    buyer-dossiers/
    playbooks/
    founder-research/
    docs-synthesis/
  reports/
    README.md
    founder-briefs/
    account-research/
    launch-research/
    support-analysis/
  indexes/
    README.md
    backlinks.md
    open-questions.md
    stale-pages.md
    contradictions.md
  templates/
    compiled-page.template.md
    report.template.md
    raw-source-note.template.md
```

## Storage Rules

### `knowledge/raw/`

This is the intake layer.

- Store source markdown, clipped pages, exports, transcripts, screenshots, spreadsheets, and sidecar notes here.
- Prefer preserving source structure over rewriting content.
- Web clips, screenshots, and exports should be saved close together.
- A raw source can have a sidecar note in markdown when Hermes needs to explain provenance, extraction issues, or scope.

### `knowledge/compiled/`

This is the reusable wiki.

- Hermes writes topic pages here.
- Pages summarize and connect source evidence.
- Pages must cite source locators and maintain explicit authority boundaries.
- Pages should be stable enough to reuse across future runs.

### `knowledge/reports/`

This is the output layer.

- Short-lived artifacts, founder briefs, account memos, and one-off research outputs live here.
- Reports may link back into compiled pages and raw evidence.
- Useful report findings should be filed back into `compiled/` when they become reusable knowledge.

### `knowledge/indexes/`

This is the hygiene layer.

- `backlinks.md`: high-signal page relationships Hermes discovered.
- `open-questions.md`: unresolved questions that deserve future research.
- `stale-pages.md`: pages past freshness thresholds.
- `contradictions.md`: pages or claims that appear inconsistent and need review.

## Metadata Schema

Every page in `knowledge/compiled/` and `knowledge/reports/` must have YAML frontmatter with these required fields:

```yaml
authority: derived
source_system: web
source_urls:
  - "https://example.com/source"
last_verified_at: 2026-04-03
owner: demand-intel-agent
sensitivity: internal
confidence: 0.76
```

### Field definitions

- `authority`
  - `canonical`: only for repo-local documents that restate and point to an already canonical file in this repo. Use sparingly.
  - `derived`: default for synthesized pages.
  - `draft`: in-progress page that should not yet be treated as reusable.
- `source_system`
  - One of `paperclip`, `notion`, `repo`, `web`, `drive`.
  - Use the dominant source system for the page.
- `source_urls`
  - Array of source locators.
  - May include public URLs, Notion URLs, Paperclip URLs, Drive URLs, or repo locators such as `repo:///docs/marketplace-semantic-search.md`.
- `last_verified_at`
  - ISO date string `YYYY-MM-DD`.
- `owner`
  - Agent or team responsible for freshness.
- `sensitivity`
  - One of `public`, `internal`, `restricted`.
- `confidence`
  - Decimal between `0` and `1`.

### Required sections

Compiled pages must contain:

- `## Summary`
- `## Evidence`
- `## Implications For Blueprint`
- `## Open Questions`
- `## Authority Boundary`

Reports must contain:

- `## Summary`
- `## Evidence`
- `## Recommended Follow-up`
- `## Linked KB Pages`
- `## Authority Boundary`

## Ingest Flow

### 1. Capture raw evidence

An agent gathers evidence into `knowledge/raw/<source-system>/...`.

Examples:

- clipped competitor article
- exported Notion page
- copied repo doc excerpt
- screenshot set
- Paperclip issue transcript used for background context

### 2. Add or update a raw source note when needed

If the source is messy or ambiguous, add a sidecar markdown file using [`knowledge/templates/raw-source-note.template.md`](/Users/nijelhunt_1/workspace/Blueprint-WebApp/knowledge/templates/raw-source-note.template.md).

Use it to record:

- where the source came from
- extraction gaps
- whether the source is partial
- whether any sensitivity restrictions apply

### 3. Compile knowledge

Hermes writes or updates a page in `knowledge/compiled/` when:

- a finding is likely to be reused
- multiple sources need synthesis
- future runs would otherwise repeat the same research

Hermes should prefer updating an existing page over creating duplicates.

### 4. Emit reports

When a run produces a task-specific artifact, write it to `knowledge/reports/`.

If the report contains reusable findings, update the relevant compiled page and leave the report as a dated derivative artifact.

### 5. Update indexes

After any substantial page addition or rewrite, Hermes updates:

- `open-questions.md` if research gaps remain
- `stale-pages.md` when a page is due for review
- `contradictions.md` if evidence conflicts
- `backlinks.md` when a new cross-page relationship matters

### 6. Respect human gates

If a run touches legal, rights, privacy, approvals, pricing, commercialization commitments, or runtime/package truth:

- do not decide in the KB
- link to the canonical system
- open or update the Paperclip work item instead

## Lint Checks

`npm run lint:hermes-kb` validates the repo KB contract.

Current checks:

- required KB directories exist
- required index files exist
- compiled and report pages have valid frontmatter
- `authority`, `source_system`, and `sensitivity` use allowed enum values
- `source_urls` is a non-empty array of strings
- `last_verified_at` uses ISO date format
- `owner` is non-empty
- `confidence` is numeric and between `0` and `1`
- required section headings exist by page type

The lint script is intentionally structural, not semantic. It prevents schema drift without pretending to verify factual correctness.

## Ingest Helper

Use `npm run ingest:hermes-kb -- <command> ...` to scaffold new KB entries from templates.

Supported commands:

- `raw-source`
  - creates `knowledge/raw/<source-system>/<slug>/source-note.md`
  - accepts repeated source locators and optional open questions
- `compiled-page`
  - creates `knowledge/compiled/<category>/<slug>.md`
  - updates backlinks, open questions, contradictions, and stale-page cleanup based on the flags provided

Run `npm run ingest:hermes-kb -- --help` for the current flag set.

## Agent Rollout

### Phase 1 writers

Start with the agents whose work is already synthesis-heavy and low-risk with respect to company authority:

1. `demand-intel-agent`
   - writes `knowledge/raw/web/`, `knowledge/compiled/market-intel/`, and `knowledge/reports/account-research/`
2. `supply-intel-agent`
   - writes `knowledge/raw/web/`, `knowledge/compiled/supply-intel/`, and `knowledge/reports/launch-research/`
3. `buyer-solutions-agent`
   - writes `knowledge/compiled/buyer-dossiers/` and account-specific `knowledge/reports/account-research/`
4. `solutions-engineering-agent`
   - writes `knowledge/compiled/playbooks/` and technical buyer reports

### Phase 1 readers

1. `blueprint-chief-of-staff`
   - reads compiled pages and reports for founder background context only
2. `growth-lead`
   - reads market and supply intelligence
3. `ops-lead`
   - reads launch and buyer enablement reports
4. `notion-manager-agent`
   - reads for reconciliation targets and freshness checks, but does not use KB pages as execution truth

### Phase 2 writers

After the structure proves stable:

1. `blueprint-chief-of-staff`
   - writes founder brief background reports into `knowledge/reports/founder-briefs/`
2. `notion-manager-agent`
   - writes raw Notion exports and freshness sidecars only
3. `analytics-agent`
   - writes recurring support-analysis or demand-analysis reports

### Explicit non-writers at launch

These agents should read canonical systems directly and should not write Hermes KB truth as part of launch:

- rights-provenance-agent
- capture-qa-agent
- capture-codex
- pipeline-codex

Those agents operate too close to provenance, runtime, and delivery truth to benefit from an autonomous derived KB as a primary write surface.

## Operating Rules

### Reuse rule

Before creating a new compiled page, Hermes should search `knowledge/compiled/` for an existing page to extend.

### Freshness rule

Any page older than 30 days that is still actively referenced should appear in `knowledge/indexes/stale-pages.md`.

### Contradiction rule

If a new source materially conflicts with a compiled page, Hermes should:

1. lower page confidence if needed
2. add an entry to `knowledge/indexes/contradictions.md`
3. avoid silently rewriting away the disagreement

### Canonical-link rule

When a page touches company policy, work state, or package truth, it must link to the canonical file or system of record.

## Recommended Next Implementation Step

This repo change establishes the file contract and linting. The next implementation step should be a small ingest helper that:

- creates dated source folders in `knowledge/raw/`
- scaffolds compiled pages from templates
- updates index files after a write

That helper should come after at least a few manual KB pages prove the schema is actually ergonomic for Hermes.
