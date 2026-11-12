---
name: site-world-creative-production
description: Plan, storyboard, prompt, and route Blueprint image/video creative for exact-site and robot-world-model marketing while preserving proof boundaries.
---

# Site-World Creative Production

Use this skill when a Blueprint marketing, advertising, brand, community, or buyer-facing issue needs imagery, reference frames, short-form video prompts, motion-storyboards, or creative review.

This skill is for the whole creative packet, not just the final asset. It covers the path we want agents to follow before any generated image or video is treated as usable.

## Role Split

### Hermes / Paperclip growth lanes

Own:

- creative objective and audience
- proof pack, allowed claims, blocked claims, and human gates
- concept options
- storyboard beats
- camera and motion prompt
- reference-image request for `webapp-codex`
- review criteria and closeout evidence

Do not assume direct final image generation from a Hermes lane.

### `webapp-codex`

Own:

- Codex desktop OAuth-backed image execution with `gpt-image-2`
- screenshot/reference gathering when it improves fidelity
- first-frame, last-frame, storyboard, and environment reference image generation
- repo-bound visual asset placement when the issue requires it
- exact prompt and output-path closeout

Do not switch to a paid image API fallback when the issue is explicitly routed to Codex image generation.

### Video provider lane

Own video rendering only when the issue explicitly authorizes it and the provider/tool is available. Seedance 2.0 / Dreamina / Higgsfield-style work should start from the approved prompt and reference packet, not from loose copy.

## Required Workflow

1. **Ground the creative**
   - target audience
   - placement or channel
   - exact-site/product truth being shown
   - proof links or evidence paths
   - allowed claims
   - blocked claims
   - human-review gate

2. **Brainstorm bounded concepts**
   - propose 2-4 concepts when the direction is open
   - keep each concept tied to one site, workflow, robot task, buyer question, or proof path
   - select one direction before generating final prompts or images

3. **Storyboard before generation**
   For each video or motion asset, write a shot table with:
   - beat name
   - first frame
   - middle action
   - last frame
   - camera position and trajectory
   - subject action
   - environment continuity
   - reference images needed
   - truth boundary

4. **Prepare reference-image instructions**
   If a video tool supports multiple references, define how to use them:
   - robot/product identity references
   - environment references
   - first/middle/last frame references per scenario
   - style/lighting references
   - any frames that must remain consistent across the series

   Default image generation lane: route to `webapp-codex` using Codex desktop `gpt-image-2`.

5. **Write the video prompt packet**
   Include:
   - global consistency block
   - scenario prompt
   - camera trajectory
   - subject motion constraints
   - environment constraints
   - aspect ratio, resolution, and duration
   - reference-image usage plan
   - negative prompt
   - review checklist

6. **Review and label**
   Before any asset is sent, published, or used as proof, record:
   - model/tool used
   - prompts used
   - reference image paths or URLs
   - output path or URL
   - whether the asset is illustrative, sample/generated, proof-backed, or customer-cleared
   - remaining human review needs

## Default Video Packet Shape

Use this shape for Seedance 2.0 / Dreamina / Higgsfield-style short-form video prompts:

```text
Format: 16:9, 720p unless the issue specifies otherwise.
Duration: 7 seconds unless the issue specifies otherwise.
Visual continuity: [same location, lighting, robot/product identity, color/material palette]
Scene: [site-specific environment]
Subject: [robot/product/person/action]
Task: [one concrete job]
Camera: [first/third person, height, lens feel, starting position, path, end position]
Action timing: [0-2s, 2-5s, 5-7s]
World-model evaluation emphasis: [clearance, reachability, occlusion, localization, safety, proof path]
Reference plan: [which references to upload and why]
Truth boundary: [illustrative/generated/sample/proof-backed/customer-cleared]
Negative prompt: [brand labels, wrong robot, impossible motion, UI overlays, unsupported claims]
```

## Truth Rules

- Generated imagery and generated video are not capture proof, hosted-session proof, provider success, customer traction, or robot policy success by themselves.
- Do not include real customer names, private site labels, readable brands, logos, license plates, faces, or proprietary layouts unless the issue includes rights/provenance clearance.
- Do not claim a robot completed a real task unless a real execution record supports that claim.
- Keep sample world-model/evaluation language explicit: "illustrative", "sample", "generated reference", or "task-conditioned preview" when the artifact is not proof.
- Keep public sends, paid spend, pricing, legal, rights, privacy, and commercial commitments human-gated.

## Downstream Issue Packet

When routing to `webapp-codex`, include:

- asset goal
- target audience/channel
- aspect ratio, resolution, and duration if video-related
- proof links and allowed/blocked claims
- concept selected
- storyboard beats
- exact reference-image request
- desired image model: `gpt-image-2`
- video prompt packet if applicable
- whether to save files into the repo or leave them as review-only outputs
- closeout requirements: output paths, prompts used, truth-boundary label, remaining review gates

## Do Not

- generate final imagery directly from a Hermes lane when the intended lane is Codex image generation
- spend image/video provider credits when the issue only needs a prompt/reference packet
- use Dreamina, Higgsfield, Seedance, or any live video provider without explicit execution authorization
- treat a nice-looking clip as evidence of product, provider, robot, or customer readiness
