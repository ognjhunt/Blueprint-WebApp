---
name: cross-repo-operations
description: Workflow for tasks that span Blueprint-WebApp, BlueprintCapturePipeline, and BlueprintCapture.
---

# Cross Repo Operations

Use this skill when a task spans more than one Blueprint repo.

Repos:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline`
- `/Users/nijelhunt_1/workspace/BlueprintCapture`

Checklist:

1. Identify which repo owns the source-of-truth contract.
2. Check whether the other repos consume that contract directly.
3. Update docs or instruction files when contract semantics change.
4. Verify at least one command in every repo whose behavior you changed or put at risk.
