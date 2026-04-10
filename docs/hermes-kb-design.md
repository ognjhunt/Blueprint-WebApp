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

## Brain-First Lookup Protocol

Before external research on buyers, companies, competitors, cities, objections, or GTM patterns:

1. Search the existing KB first.
2. Read the most relevant compiled page before starting new web research.
3. Check `knowledge/indexes/contradictions.md` and `knowledge/indexes/stale-pages.md` when the topic may be disputed or stale.
4. Only then call external web search, APIs, or workspace tools for missing evidence.

This is a hard workflow rule, not a style preference.

If a compiled page already exists for the subject, the default action is to update it.
Do not create a new page just because the current run has a new date.

## Page Archetypes

Blueprint should use KB pages that match the company and product, not a generic personal memex taxonomy.

Supported reusable compiled-page archetypes:

- `buyer_dossier`
- `market_entity`
- `city_brief`
- `proof_pattern`
- `doctrine_claim`
- `support_playbook`

These archetypes remain derivative context only.
They do not replace canonical operational systems.

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
    demand-intel/
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
- Prefer Blueprint-native archetypes over broad generic entity taxonomies.

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

### Optional reusable-page fields

Compiled pages and reports may also include:

```yaml
page_kind: buyer_dossier
subject_key: acme-robotics
canonical_refs:
  - system: paperclip
    ref: "issue://1234"
freshness_sla_days: 14
last_signal_at: 2026-04-10
review_status: active
entity_tags:
  - hosted-review
  - robot-team
```

- `page_kind`
  - Blueprint-native reusable page archetype.
- `subject_key`
  - Stable identifier used to avoid duplicate dossier pages.
- `canonical_refs`
  - Pointers to real canonical systems such as Paperclip, Notion, or repo docs.
- `freshness_sla_days`
  - Target review window for the owning agent.
- `last_signal_at`
  - Most recent meaningful evidence update reflected on the page.
- `review_status`
  - One of `active`, `watch`, `stale`, or `blocked`.
- `entity_tags`
  - Lightweight tags for routing and attachment.

### Required sections

Compiled pages must contain:

- `## Summary`
- default shape when `page_kind` is absent:
  - `## Evidence`
  - `## Implications For Blueprint`
  - `## Open Questions`
  - `## Authority Boundary`
- dossier-style shape when `page_kind` is `buyer_dossier`, `market_entity`, or `city_brief`:
  - `## Current State`
  - `## Evidence`
  - `## Signals`
  - `## Implications For Blueprint`
  - `## Open Questions`
  - `## Canonical Links`
  - `## Authority Boundary`
- pattern-style shape when `page_kind` is `proof_pattern`, `doctrine_claim`, or `support_playbook`:
  - `## Pattern`
  - `## Evidence`
  - `## Failure Modes`
  - `## Implications For Blueprint`
  - `## Open Questions`
  - `## Authority Boundary`

Reports must contain:

- `## Summary`
- `## Evidence`
- `## Recommended Follow-up`
- `## Linked KB Pages`
- `## Authority Boundary`

## Compiled Truth And Signals

Blueprint KB pages should keep the reusable summary current and the dated signal trail append-only.

- The upper sections are the current synthesized view.
- `## Signals` is the append-only record of meaningful changes, observations, or updates when a dossier-style page uses that section.
- When a page does not have a dedicated `## Signals` section, dated source-backed changes should still be captured in evidence and linked indexes.

Do not silently overwrite a durable claim without leaving a source-backed trail showing what changed and why.

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

When a subject already has a dossier or reusable page:

- update the existing page first
- append the new signal
- only create a new report if the run also needs a dated one-off artifact

### 4. Emit reports

When a run produces a task-specific artifact, write it to `knowledge/reports/`.

If the report contains reusable findings, update the relevant compiled page and leave the report as a dated derivative artifact.

### 5. Update indexes

After any substantial page addition or rewrite, Hermes updates:

- `open-questions.md` if research gaps remain
- `stale-pages.md` when a page is due for review
- `contradictions.md` if evidence conflicts
- `backlinks.md` when a new cross-page relationship matters

## Background Hygiene Loop

The KB should be maintained as a background support layer for recurring research lanes.

At minimum, the maintenance loop should:

- review pages that crossed their freshness SLA
- record unresolved contradictions in `knowledge/indexes/contradictions.md`
- promote reusable findings from recent reports into existing compiled pages
- update backlinks when a page becomes operationally relevant across multiple lanes
- mark blocked pages when canonical evidence is missing

This is the Blueprint equivalent of the "dream cycle," but it remains derivative and same-stack.

## Session Attachment Rule

When a KB page materially informs:

- a buyer-prep session
- a market or demand research session
- a support, procurement, or enablement session

attach that KB page into startup context instead of pasting a fresh freeform summary into operator notes.

Startup context should carry:

- repo docs for canonical doctrine
- ops documents for extracted source artifacts
- selected KB pages for reusable derivative context

This keeps the KB reusable without making it canonical.

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
  - creates `knowledge/raw/<source-system>/<YYYY-MM-DD>/<slug>/source-note.md`
  - accepts repeated source locators and optional open questions
- `compiled-page`
  - creates `knowledge/compiled/<category>/<slug>.md`
  - supports Blueprint-native page archetypes and optional canonical refs / freshness metadata
  - updates backlinks, open questions, contradictions, and stale-page cleanup based on the flags provided
- `report`
  - creates `knowledge/reports/<category>/<YYYY-MM-DD>-<slug>.md`
  - supports linked KB pages and recommended follow-up scaffolding

Run `npm run ingest:hermes-kb -- --help` for the current flag set.

## Agent Rollout

### Phase 1 writers

Start with the agents whose work is already synthesis-heavy and low-risk with respect to company authority:

1. `market-intel-agent`
   - writes `knowledge/raw/web/`, `knowledge/compiled/market-intel/`, and mirrored operator-facing research artifacts
2. `demand-intel-agent`
   - writes `knowledge/raw/web/`, `knowledge/compiled/demand-intel/`, and `knowledge/reports/account-research/`
3. `supply-intel-agent`
   - writes `knowledge/raw/web/`, `knowledge/compiled/supply-intel/`, and `knowledge/reports/launch-research/`
4. `buyer-solutions-agent`
   - writes `knowledge/compiled/buyer-dossiers/` and account-specific `knowledge/reports/account-research/`
5. `solutions-engineering-agent`
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

This repo now has the file contract, linting, and ingest helper. The next implementation step should be operational adoption:

- attach the KB workflow skill to the Phase 1 writer and reader agents
- make writer agents update `knowledge/` before publishing mirrored Notion artifacts
- make reader agents use KB pages for continuity without treating them as execution truth
- keep the repo KB as the durable markdown work surface and Notion as the mirrored review surface
