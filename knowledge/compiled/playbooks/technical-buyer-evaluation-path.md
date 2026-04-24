---
authority: derived
source_system: repo
source_urls:
  - 'repo:///client/public/samples/sample-site-package-manifest.json'
  - 'repo:///client/public/samples/sample-rights-sheet.md'
  - 'repo:///client/public/samples/sample-export-bundle.json'
  - 'repo:///proof-reel/BlueprintProofReel.tsx'
  - 'repo:///docs/blueprint-secondary-pages-mockup-prompt-pack-2026-04-21.md'
last_verified_at: "2026-04-23"
owner: blueprint-ops-lead
sensitivity: internal
confidence: 0.9
---

# Technical Buyer Evaluation Path

## Summary

This page is the reusable technical buyer enablement path for Blueprint.
It reflects the current product nouns already present in the repo:

- `Real site`
- `Site package`
- `Hosted evaluation`
- `Exports`

The goal is to help a serious technical buyer evaluate one exact site without inventing a broader capability story than the product truth supports.

## Active Delivery Review Gate

An active delivery review only starts when the repo has all of the following:

- a live buyer thread or wake context
- one exact site, site package, or equivalent artifact target
- a hosted-session or evaluation target the buyer can actually use next
- a clear rights/provenance posture for anything the buyer will inspect or export

If any of those are missing, keep the motion in scoping mode and route the blocker instead of drafting a false "buyer-ready" path.

## Current Supported Path

1. Start with one real site.
2. Inspect the sample site package and rights sheet.
3. Review the hosted-evaluation loop.
4. Confirm the export bundle the buyer expects to receive back.
5. Decide whether the buyer should run in Blueprint's hosted loop or take the package into their own stack.

The current repo assets show this path clearly:

- the proof reel frames the product as `real site -> site package -> hosted access -> exports`
- the sample manifest defines the site metadata, proof depth, rights class, and export types
- the sample rights sheet defines sharing and retention boundaries
- the sample export bundle defines the buyer-facing outputs returned from the hosted path

## What To Check In Evaluation

Use this checklist when a buyer asks whether Blueprint fits their stack:

- Is there a live buyer thread, wake comment, or other issue-bound context?
- Which exact site are we evaluating?
- Is the buyer asking for hosted evaluation, self-hosted package usage, or both?
- Does the listing have a concrete `site_id`, `capture_date`, and `rights_class`?
- Does the manifest name the available export types the buyer needs?
- Does the rights sheet allow the intended sharing scope?
- Does the export bundle contain the artifacts the buyer will actually inspect?
- Does the buyer need reruns, comparison, or only a one-time proof pass?
- Are there any rights, privacy, export-control, or access constraints that require human review?

If the answer to the first question is no, do not turn the thread into a generic evaluation plan. First create or recover the live buyer context, then resume the checklist.

## Artifact Reading Order

When a buyer needs proof, show artifacts in this order:

1. Sample site package manifest
2. Sample rights sheet
3. Hosted evaluation preview
4. Export bundle
5. Proof reel

That order keeps the conversation grounded in evidence before evaluation claims.

## Buyer Questions This Path Answers

- What is in the package?
- What rights and sharing limits apply?
- What does hosted evaluation actually do?
- What outputs come back after a run?
- When should the buyer run Blueprint's hosted loop versus taking the bundle elsewhere?

## Unsupported Or Human-Gated Asks

Do not imply support for any of the following unless a separate proof path exists:

- deployment guarantees
- custom engineering commitments
- air-gapped or export-controlled handling without human review
- rights or privacy exceptions without provenance review
- pricing or contract promises

Route those requests to the correct owner instead of stretching the technical buyer path.

## Blocked Review Pattern

When a buyer thread is missing a concrete hosted-session target, the right response is:

1. say the evaluation path cannot be finalized yet
2. identify the missing artifact or rights gate
3. route the follow-up to the owning agent
4. keep the buyer thread truthful about what exists today

Do not create a fake evaluation story just to keep the thread moving.

## Owner Map

- `buyer-solutions-agent`: owns the live commercial thread and standard buyer progression
- designated human commercial owner: owns standard quote and commercial decisions
- `rights-provenance-agent`: owns rights, provenance, privacy, and export-control questions
- `solutions-engineering-agent`: owns the technical evaluation plan, integration checklist, and product-truth framing

## Recommended Reply Pattern

When answering a buyer thread, keep the response in this shape:

1. The exact buyer objective
2. The supported Blueprint path using current artifacts
3. The integration or evaluation checklist
4. The blockers or unsupported asks
5. The owner and next step for each blocker
