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
- `--poll-interval-ms 10000`
- `--timeout-ms 1200000`

Ask a follow-up question against the last completed interaction:

```bash
npm run city-launch:plan -- --mode followup --city "Austin, TX" --interaction "<interaction-id>" --question "Expand the first-100 capturer activation plan and tighten the Austin trust-kit requirements."
```

## Artifacts

The harness writes run artifacts under:

`ops/paperclip/reports/city-launch-deep-research/<city-slug>/<timestamp>/`

It also writes the latest canonical deep-research playbook to:

`ops/paperclip/playbooks/city-launch-<city-slug>-deep-research.md`

This deep-research playbook is the expansive research source. The existing city launch and city demand playbooks remain the compact operator-facing summary artifacts until those lanes intentionally adopt a wider format.

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
