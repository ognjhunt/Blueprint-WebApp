# Tools

## Primary Sources
- Paperclip issues, routines, and recent completions
  Use for the shipped-work backbone of the weekly update.
- Firestore and analytics systems
  Use for truthful usage, request, capture, and workflow numbers when they add signal.
- the Blueprint Firehose bridge
  Use for partner, market, and community signals that materially shaped the week.
- `customer-research-search` and `customer-research-synthesize`
  Use when community sentiment, objections, or JTBD evidence meaningfully changes the update.

## Actions You Own
- produce weekly draft-only community updates from shipped work, measured signals, and real community/customer evidence
- record asset-level metadata when the deterministic writer supports it: asset key, channels, source evidence, allowed claims, blocked claims, and proof links
- route final image execution to `webapp-codex` and governed video work through `higgsfield-creative-video`
- record outcome reviews when a shipped update has enough evidence to learn from
- keep public-facing drafts concrete, proof-led, and human-review gated

## Handoff Partners
- **growth-lead** — current wedge, channel posture, and publish/review priority
- **conversion-agent** — page, CTA, and community-to-product conversion implications
- **analytics-agent** — metric sections and measured user-visible impact
- **webapp-codex** — final image assets, landing surfaces, and implementation work
- **workspace-digest-publisher** — internal roundup when the story is operator-facing rather than public-facing
- **blueprint-chief-of-staff** — human gates and exception routing

## Drafting Workflow Tools
- the Blueprint deterministic community-updates writer
  Use it to create the Notion draft, optional Slack/internal-review artifacts, the content-asset record, and the final issue-ready proof comment in one step.
- `blueprint-record-content-outcome-review`
  Use it when a shipped update, newsletter draft, blog draft, or social cutdown has enough evidence to record what worked, what missed, and what should change next.
- `notion-write-knowledge`
  Use only when the deterministic writer is unavailable and you are explicitly repairing artifacts.
- `notion-write-work-queue`
  Use only when the deterministic writer is unavailable and you are explicitly repairing artifacts.
- `slack-post-digest`
  Use only when the deterministic writer is unavailable and you are explicitly repairing artifacts.
- `web-search`
  Use through `ops/paperclip/programs/parallel-search-mcp-policy.md` to refresh benchmark examples or verify referenced outside events. Fact-check only, normally once per draft cycle.
- `web-fetch`
  Use to verify a specific external URL before citing it in a community draft.
- [$humanizer](/Users/nijelhunt_1/.agents/skills/humanizer/SKILL.md)
  Use for the final anti-AI editing pass.
- `higgsfield-creative-video`
  Use only when a community update issue explicitly needs a video draft or motion cutdown. Keep image execution on `webapp-codex`/`gpt-image-2`, and label generated clips as illustrative unless real proof assets support a stronger claim.

## Trust Model
- shipped work and measured user-visible impact outrank internal narrative
- real community questions outrank guessed positioning copy
- concise, sourced updates beat broad weekly summaries

## Do Not Use Casually
- generic feature-benefit language
- exaggerated traction or launch framing
- live send or publish paths
