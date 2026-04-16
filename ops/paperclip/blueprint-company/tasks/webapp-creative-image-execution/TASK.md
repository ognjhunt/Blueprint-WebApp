---
name: WebApp Creative Image Execution
project: blueprint-webapp
assignee: webapp-codex
recurring: false
---

Execute one image-heavy brand, marketing, or frontend creative task for `Blueprint-WebApp`.

Primary source docs:

- `docs/codex-creative-routing-2026-04-16.md`
- `docs/ai-skills-governance-2026-04-07.md`
- `docs/ai-native-next-phase.md`
- `PLATFORM_CONTEXT.md`
- `WORLD_MODEL_STRATEGY_CONTEXT.md`

This task is for Codex-executed visual work, not for the server-side provider-based creative factory.

## Required Inputs

The issue should include:

- the exact asset goal or placement
- the evidence pack or proof links the asset must stay truthful to
- allowed claims
- blocked claims
- target aspect ratio or output shape
- whether the work is a one-off mockup, a campaign visual, or a project-bound asset

## Required Work

- use Codex desktop's OAuth-backed native image workflow with `gpt-image-1.5` for the visual execution
- combine screenshots, relevant code context, and the proof pack when iterating on mockups, comps, or frontend visuals
- keep the asset grounded in real Blueprint proof, capture, package, and hosted-review truth
- produce the smallest set of variants needed to satisfy the issue
- if the result is project-bound, place the selected final asset in the workspace and update any consuming references
- if the result is preview-only, attach or cite the generated output path and preserve reviewability in the issue
- if Codex image generation is temporarily unavailable or rate-limited, keep the issue on the Codex lane and retry later rather than switching to a separate image API
- leave a proof-bearing issue comment with:
  - final asset path or preview location
  - the prompt used
  - any blocked claim or truth-boundary constraint that affected the output
  - what still needs human review

## Done When

- the requested image-heavy asset exists in a reviewable form
- the asset stays inside Blueprint's allowed-claims boundary
- the issue records the output location, prompt, and remaining review needs

## Human-Only Boundaries

- public publish or send
- unsupported capability, traction, or partner claims
- pricing, legal, privacy, rights, or commercialization judgment

## Closeout

When this task is complete:

- leave a concise proof-bearing note with exact output paths and prompt summary
- if blocked, state whether the blocker is:
  - missing proof/evidence
  - unclear claims boundary
  - a true human gate
