# AI Marketing Skills Adoption Map

Reference repo:

- `ops/paperclip/external/ai-marketing-skills/`

This repo is vendored as source material only. Do not bind its `SKILL.md` files directly to Blueprint agents without adaptation.

## Wrapper Map

### `truthful-quality-gate`

Upstream source files:

- `ops/paperclip/external/ai-marketing-skills/content-ops/SKILL.md`
- `ops/paperclip/external/ai-marketing-skills/content-ops/scripts/content-quality-gate.py`
- `ops/paperclip/external/ai-marketing-skills/content-ops/scripts/content-quality-scorer.py`
- `ops/paperclip/external/ai-marketing-skills/content-ops/references/expert-assembly.md`
- `ops/paperclip/external/ai-marketing-skills/content-ops/scoring-rubrics/content-quality.md`
- `ops/paperclip/external/ai-marketing-skills/content-ops/scoring-rubrics/conversion-quality.md`
- `ops/paperclip/external/ai-marketing-skills/content-ops/scoring-rubrics/strategic-quality.md`

Blueprint wrapper:

- `ops/paperclip/blueprint-company/skills/truthful-quality-gate/SKILL.md`

Adaptation notes:

- Removes telemetry and recursive 90+ scoring loop.
- Replaces generic quality rules with Blueprint truth rules: capture-first, exact-site package truth, rights/privacy/provenance truth, no invented traction, no fake providers, no unsupported capability claims.
- Optimized for buyer proofs, investor updates, community drafts, outbound drafts, and package recommendations.

### `growth-experiment-engine`

Upstream source files:

- `ops/paperclip/external/ai-marketing-skills/growth-engine/SKILL.md`
- `ops/paperclip/external/ai-marketing-skills/growth-engine/experiment-engine.py`
- `ops/paperclip/external/ai-marketing-skills/growth-engine/autogrowth-weekly-scorecard.py`
- `ops/paperclip/external/ai-marketing-skills/growth-engine/pacing-alert.py`
- `ops/paperclip/external/ai-marketing-skills/conversion-ops/SKILL.md`
- `ops/paperclip/external/ai-marketing-skills/conversion-ops/cro_audit.py`

Blueprint wrapper:

- `ops/paperclip/blueprint-company/skills/growth-experiment-engine/SKILL.md`

Adaptation notes:

- Keeps hypothesis, baseline, guardrail, and decision discipline.
- Replaces generic channel metrics with Blueprint funnel metrics and product constraints.
- Splits ownership cleanly across `growth-lead`, `conversion-agent`, and `analytics-agent`.
- Avoids introducing external platform assumptions or statistical theater when traffic is too low.

### `buyer-package-framing`

Upstream source files:

- `ops/paperclip/external/ai-marketing-skills/sales-playbook/SKILL.md`
- `ops/paperclip/external/ai-marketing-skills/sales-playbook/value_pricing_packager.py`
- `ops/paperclip/external/ai-marketing-skills/sales-playbook/value_pricing_briefing.py`
- `ops/paperclip/external/ai-marketing-skills/sales-playbook/pricing_pattern_library.py`
- `ops/paperclip/external/ai-marketing-skills/outbound-engine/SKILL.md`

Blueprint wrapper:

- `ops/paperclip/blueprint-company/skills/buyer-package-framing/SKILL.md`

Adaptation notes:

- Replaces agency upsell logic with exact-site package and hosted-session framing.
- Forces inclusion/exclusion, proof path, delivery caveats, and blockers.
- Keeps founder-only gates for pricing, discounts, terms, and commitments.

### `meeting-action-extractor`

Upstream source files:

- `ops/paperclip/external/ai-marketing-skills/team-ops/SKILL.md`
- `ops/paperclip/external/ai-marketing-skills/team-ops/meeting_action_extractor.py`

Blueprint wrapper:

- `ops/paperclip/blueprint-company/skills/meeting-action-extractor/SKILL.md`

Adaptation notes:

- Keeps only the meeting intelligence portion.
- Routes outputs toward Paperclip and Notion instead of CRM tasks.
- Adds owner, due date, handoff, and escalation framing that matches the Blueprint managerial runtime.
