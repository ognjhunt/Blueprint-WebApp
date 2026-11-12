---
name: Docs Agent Sweep
project: blueprint-executive-ops
assignee: docs-agent
recurring: true
---

Run the scheduled cross-repo documentation accuracy sweep.

Each run must:

- inspect recent merged changes across `Blueprint-WebApp`, `BlueprintCapturePipeline`, and `BlueprintCapture`
- identify only doc-impacting changes that are already merged and live in repo reality
- prioritize updates by the docs-agent tier model:
  - Tier 1: capture guides, API docs, onboarding materials
  - Tier 2: platform and org docs
  - Tier 3: README, FAQ, and architecture sweep items
- make the minimal accurate update instead of broad rewriting
- create or update a Paperclip issue when the correct documentation state is ambiguous or requires engineering clarification
- leave proof in the issue comments showing which merge or current code path triggered the documentation change

Human-only boundaries:

- new docs from scratch still require CTO review before publishing
- do not document planned or unmerged work
