---
name: higgsfield-creative-video
description: Use Higgsfield MCP for authenticated agent-side video generation while preserving Blueprint's Codex image-routing and proof-led creative guardrails.
---

# Higgsfield Creative Video

Use this skill when a Blueprint creative issue needs agent-side short-form video generation or video-provider exploration through Higgsfield MCP.

## Approved Use

- Generate or iterate short-form video only when the run is already approved for creative execution.
- Prefer Seedance 2.0 through Higgsfield or a Dreamina-style UI when the issue asks for a non-OpenRouter video path and the relevant account/tool is authenticated.
- Use the `site-world-creative-production` workflow first: grounded brief, bounded concept, storyboard, reference-image plan, proof-led prompts, and explicit claims boundaries from the owning issue or creative run.
- Use approved first frames, last frames, multi-reference boards, or reference packs generated through the `webapp-codex` / `gpt-image-2` lane when they materially improve visual consistency.
- Record model, prompt, source image, output URL or file path, and remaining review gates in the Paperclip issue.

## Routing Rules

- Codex-executed image work still uses Codex desktop OAuth image generation on `gpt-image-2`.
- Hermes lanes may prepare briefs, motion prompts, storyboards, reference plans, and review criteria. They should only run Higgsfield/Dreamina/Seedance video tools when the issue explicitly calls for video execution or provider testing.
- Server-side creative workers stay on their explicit provider contracts until a separate migration wires Higgsfield into that runtime.
- If Higgsfield/Dreamina OAuth, credits, or tool discovery are unavailable, leave the video step blocked or route back to the configured explicit provider path. Do not invent a generated asset.

## Truth Rules

- Do not present simulated or generated clips as capture proof, hosted-session evidence, buyer traction, or deployment success.
- Do not use real customer names, site labels, logos, or performance claims unless the owning issue provides evidence and permission.
- Keep public sends, paid spend, commercial commitments, and unsupported product claims behind the existing human gates.
