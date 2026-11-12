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
- `ops/paperclip/blueprint-company/skills/site-world-creative-production/SKILL.md`
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
- for video-related creative: target duration, model/tool preference, storyboard beats, camera path, reference-image plan, and whether the request is prompt/reference-only or authorized video execution

## Required Work

- use Codex desktop's OAuth-backed native image workflow with `gpt-image-2` for the visual execution
- for video/reference-pack requests, produce the storyboard/reference frames with `gpt-image-2` and a copy-ready video prompt packet before any live video provider is used
- combine screenshots, relevant code context, and the proof pack when iterating on mockups, comps, or frontend visuals
- keep the asset grounded in real Blueprint proof, capture, package, and hosted-review truth
- produce the smallest set of variants needed to satisfy the issue
- when a tool accepts multiple references, make the reference plan explicit: identity refs, environment refs, first/middle/last frames, and any continuity constraints
- if the result is project-bound, place the selected final asset in the workspace and update any consuming references
- if the result is preview-only, attach or cite the generated output path and preserve reviewability in the issue
- if Codex image generation is temporarily unavailable or rate-limited, keep the issue on the Codex lane and retry later rather than switching to a separate image API
- do not call Dreamina, Higgsfield, Seedance, or another live video provider unless the issue explicitly authorizes video execution and the required account/tooling is available
- leave a proof-bearing issue comment with:
  - final asset path or preview location
  - the prompt used
  - storyboard or reference-frame paths when applicable
  - video prompt packet when applicable
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
