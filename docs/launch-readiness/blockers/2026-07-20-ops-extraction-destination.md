# Blocker Title

Choose the destination for autonomous-operations code

## Blocker Id

`human-blocker:webapp-ops-extraction-destination-2026-07-20`

## Why This Is Blocked

`ops/paperclip`, `labs`, and `knowledge` are substantial, active operating-system
surfaces inside the product repository. Moving them changes repository
ownership, CI paths, secrets, issue references, and agent contracts across the
organization. No destination repository or archival policy is currently
authoritative, so an agent cannot safely invent one.

Channel target: email to `ohstnhunt@gmail.com`; optional Slack DM to
`Nijel Hunt` for a faster strategic decision.

## Recommended Answer

Approve a new private repository named `Blueprint-Operations` as the canonical
home for `ops/paperclip`, `labs`, and `knowledge`, preserving history with a
subtree/filter migration and leaving only documented integration contracts in
Blueprint-WebApp.

## Alternatives

- Keep the directories in this repository but formally declare Blueprint-WebApp
  an agent-operations monorepo and scope CI/reviewer ownership accordingly.
- Archive inactive historical material outside Git while leaving currently
  imported runtime code in place until its dependencies are untangled.

## Downside / Risk

Extraction can break scripts, tests, documentation links, Paperclip routines,
and ownership automation unless it is staged with compatibility checks across
all three Blueprint repositories.

## Exact Response Needed

Reply with one of:

- `EXTRACT TO PRIVATE Blueprint-Operations`,
- `KEEP AS MONOREPO`, or
- `ARCHIVE INACTIVE MATERIAL; PROPOSE RUNTIME SPLIT`.

Name the repository owner and target organization if extraction is selected.

## Execution Owner After Reply

`blueprint-cto` for the cross-repository contract; `webapp-codex` for the staged
WebApp-side migration and verification.

## Immediate Next Action After Reply

Produce a dependency/import inventory and a no-delete migration plan, then move
one bounded surface at a time with CI and link checks before removing its source
copy from Blueprint-WebApp.

## Deadline / Checkpoint

Before a diligence claim that Blueprint-WebApp is a product-only repository.
This is not a blocker to deploying the public-surface remediation itself.

## Evidence

- The directories remain in the repository after generated `output`, `outputs`,
  `tmp`, and tracked `issue-updates` artifacts were removed.
- Their tests and scripts are active in the current full test graph, so deletion
  without a destination would break real operating contracts.
- The retained tree currently contains 2,004 files under `ops`, 166 under
  `labs`, 135 under `knowledge`, and 2 under `knowledge-artifacts`. The root
  package exposes 106 scripts, with 458 retained code/document references to
  the ops-oriented command families. Script-surface cleanup is therefore part
  of the extraction decision, not a safe independent deletion.
- Safe proof: `rg -n 'ops/paperclip|knowledge/|labs/' package.json .github scripts server client --glob '!node_modules/**'`.

## Non-Scope

This reply does not authorize deleting operational history, changing provider
credentials, moving product runtime code blindly, creating a public repository,
or weakening cross-repo verification.
