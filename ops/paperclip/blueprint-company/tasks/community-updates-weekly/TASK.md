---
name: Community Updates Weekly
project: blueprint-webapp
assignee: community-updates-agent
recurring: true
---

Run the weekly community-update drafting loop.

Each run must:

- read `ops/paperclip/programs/community-updates-agent-program.md`
- gather the week's real shipped changes, visible ops progress, and relevant community signals
- draft a concise blog-plus-email update for users, capturers, robot teams, and partners
- record the asset key, source evidence, and blocked-claim rules when the deterministic writer supports content-asset metadata
- create draft artifacts in Notion plus an internal growth-ready review note
- create follow-up issues when proof links, metrics, or audience signals are missing
- note whether any update section is useful for site-operator, capturer, or robot-team lifecycle cadence variants; do not make the weekly update a substitute for those persona cadences
- if the update needs generated visuals, create or update a downstream `webapp-codex` issue using `ops/paperclip/blueprint-company/tasks/webapp-creative-image-execution/TASK.md`
- run the final copy through [$humanizer](/Users/nijelhunt_1/.agents/skills/humanizer/SKILL.md)

Human-only boundaries:

- live send or public publish
- unsupported traction claims
- rights-sensitive or commercially sensitive disclosures
