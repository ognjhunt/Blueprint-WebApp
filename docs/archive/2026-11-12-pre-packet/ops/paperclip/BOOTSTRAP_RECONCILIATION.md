# Bootstrap Reconciliation

Date: 2026-04-01

## Why This Exists

The live Paperclip package had 30 bootstrap tasks still marked `todo` even though the org had already moved into an active operating baseline with:

- a live company package and active routines
- validated employee-kit structure
- targeted passing automation tests for the chief-of-staff loop, phase-2 workflows, field-ops automation, scheduler startup, and post-signup execution
- active recurring routines that supersede one-off “establish your operating posture” work for already-live agents

That backlog was no longer truthful as launch-readiness metadata.

## Resolution Rule

Bootstrap tasks were reconciled using this rule:

- if the role is live in the package and its current operating posture is already represented by active routines, validated instructions, and current automation surfaces, the bootstrap task is resolved
- if the bootstrap key existed in `.paperclip.yaml` without a matching task file, add the missing task file so the repo and package agree
- future setup drift should reopen or add concrete follow-up work rather than leaving bootstrap placeholders permanently `todo`

## Scope

This reconciliation covers bootstrap tasks for:

- executive roles
- repo specialists
- ops roles
- growth roles
- commercial and publishing roles

## Evidence Anchors

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/.paperclip.yaml`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company/agents/README.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/BLUEPRINT_AUTOMATION.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/agents/tasks/index.ts`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/server/utils/opsAutomationScheduler.ts`

## Follow-On Rule

Do not use bootstrap tasks as a permanent graveyard for unresolved reality.

If a live role still has a real launch blocker, create or update a concrete Paperclip issue that names the blocker directly:

- missing connector auth
- unsafe human-gate boundary
- broken routing
- absent proof artifact
- stale playbook
- unsupported buyer claim

Those are real issues.

“Bootstrap this live agent someday” is not.
