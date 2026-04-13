# City Launch Deep Research Harness

Date: 2026-04-11

Status: Active

## Purpose

Use Gemini Deep Research as the required upstream planning engine for city-launch planning work in `Blueprint-WebApp`.

This harness exists because city launch planning for Blueprint is not a lightweight memo-writing task. It requires:

- long-form comparative research
- city-specific supply and demand analysis
- critique of weak analogies or unsupported assumptions
- synthesis into an operator-ready playbook that humans and agents can execute

## Current Google API Rules

This design follows Google's current docs:

- Gemini Deep Research is available only through the Interactions API and not `generateContent`
- Deep Research is powered by Gemini 3.1 Pro
- Deep Research must run with `background=true`
- follow-up questions should use `previous_interaction_id`
- Deep Research currently does not support custom function-calling tools or structured outputs

Those constraints mean the correct Blueprint pattern is:

1. Deep Research pass for broad evidence gathering
2. Gemini 3.1 Pro critique pass for gap finding
3. Deep Research follow-up pass to resolve critique gaps
4. Gemini 3.1 Pro synthesis pass for the final playbook

## Command

Run a full city playbook pass:

```bash
npm run city-launch:plan -- --city "Austin, TX"
```

Useful flags:

- `--critique-rounds 2`
- `--region "Texas"`
- `--similar-companies "Uber,DoorDash,Instacart,Airbnb,Lime"`
- `--file-search-store "fileSearchStores/blueprint-city-launch"`
- `--poll-interval-ms 10000`
- `--timeout-ms 1200000`

Optional internal grounding:

- By default Deep Research uses public-web tools only.
- To add a small curated Blueprint document store, pass `--file-search-store`.
- The value may be a single File Search store name or a comma-separated list of store names.
- Keep this narrow and curated. Do not index the whole repo by default.
- You can also set `BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE` to make a default store automatic for `city-launch:plan`.
- For all Gemini Deep Research brief runs across the org, you can set `BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE`.

Build a narrow curated File Search store for city-launch docs:

```bash
npm run city-launch:file-search-store -- --display-name "blueprint-city-launch"
```

Include existing city-specific artifacts when helpful:

```bash
npm run city-launch:file-search-store -- --display-name "blueprint-city-launch" --city "Austin, TX"
```

Inspect the curated document set without uploading:

```bash
npm run city-launch:file-search-store -- --city "Austin, TX" --dry-run
```

The builder prints the actual `storeName` resource. Use that value in `--file-search-store` for Deep Research runs.

Default the planning harness to a store via env:

```bash
export BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE="fileSearchStores/blueprintcitylaunch-kp7lbdr92tfb"
```

CLI flags still win over the env default when both are provided.

Default all generic Deep Research brief runs to a store via env:

```bash
export BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE="fileSearchStores/blueprintcitylaunch-kp7lbdr92tfb"
```

Paperclip agents that use `npm run deep-research:brief` can then inherit the same store automatically.

Refresh the research grounding store on demand:

```bash
npm run research-grounding:refresh -- --city "Austin, TX"
```

Operational rule:

- `research-grounding:refresh` is the explicit maintenance command that Paperclip agents may call when they need fresher internal grounding before a Gemini Deep Research run.
- It does not run automatically before every research pass.
- If `BLUEPRINT_CITY_LAUNCH_FILE_SEARCH_STORE` or `BLUEPRINT_DEEP_RESEARCH_FILE_SEARCH_STORE` is set, the refresh command will update that existing store by default.

Ask a follow-up question against the last completed interaction:

```bash
npm run city-launch:plan -- --mode followup --city "Austin, TX" --interaction "<interaction-id>" --question "Tighten the lawful access decision tree, activation payload issue seeds, and Austin trust-kit requirements."
```

## Artifacts

The harness writes run artifacts under:

`ops/paperclip/reports/city-launch-deep-research/<city-slug>/<timestamp>/`

It also writes the latest canonical deep-research playbook to:

`ops/paperclip/playbooks/city-launch-<city-slug>-deep-research.md`

This deep-research playbook is the expansive research source. The existing city launch and city demand playbooks remain the compact operator-facing summary artifacts until those lanes intentionally adopt a wider format.

The final synthesized playbook must also include a machine-readable structured appendix at the end of the document. The current harness prompt requires a fenced `city-launch-records` JSON block so downstream parser/materializer code can extract:

- researched capture-location candidates
- buyer target candidates
- first-touch candidates
- optional budget recommendations
- provenance fields that preserve explicit vs inferred data

The final synthesized playbook must also include a fenced `city-launch-activation-payload` JSON block.
That payload is the control-plane artifact for:

- city thesis and wedge routing
- lawful access modes
- required approvals and validation blockers
- issue seeds mapped to named Paperclip lanes
- metrics dependencies that must be tracked before autonomous governance is trusted

When `NOTION_API_TOKEN` or `NOTION_API_KEY` is configured, the harness also mirrors:

- the final playbook into the Blueprint Knowledge database in Notion
- a review breadcrumb into the Blueprint Work Queue database

That keeps the research readable by the broader team without requiring access to the repo artifact path.

## General Briefs

For non-city research briefs, use the generic Deep Research brief runner:

```bash
npm run deep-research:brief -- --title "Austin warehouse robotics demand patterns" --owner "demand-intel-agent" --business-lane Growth --brief-file /abs/path/to/brief.md
```

This writes repo artifacts under `ops/paperclip/reports/deep-research-briefs/` and, when Notion credentials are configured, mirrors the final brief into Blueprint Knowledge plus a review breadcrumb in Work Queue.

## Agents Allowed To Use This Capability

Strong candidates for direct Deep Research use on substantial briefs:

- `supply-intel-agent`
- `demand-intel-agent`
- `market-intel-agent`

Conditional use only:

- `site-operator-partnership-agent`
- `growth-lead`
- `investor-relations-agent`
- `security-procurement-agent`

These agents may invoke Deep Research when the work genuinely benefits from long-form comparative research, multi-step evidence gathering, and cited synthesis. They should not default to Deep Research for routine heartbeat work, lightweight updates, or execution tasks.

## Required Inputs

The harness automatically grounds itself in:

- `PLATFORM_CONTEXT.md`
- `WORLD_MODEL_STRATEGY_CONTEXT.md`
- `AUTONOMOUS_ORG.md`
- `DEPLOYMENT.md`
- city launch and city demand playbooks when present
- the generic capturer supply and robot-team demand playbooks

## Operating Rule

Use this harness for planning.

Do not use it to make live public claims, change human gates, send outreach, or assert unsupported readiness. Planning artifacts remain subject to Blueprint's existing founder, Growth Lead, Ops Lead, commercial, and rights/privacy review lanes.
