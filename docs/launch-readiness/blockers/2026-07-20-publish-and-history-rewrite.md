# Blocker Title

Approve coordinated publication and credential-history cleanup

## Blocker Id

`human-blocker:webapp-remediation-publication-2026-07-20`

## Why This Is Blocked

The complete remediation is a large, intentionally destructive cleanup layered
onto a pre-existing dirty working tree. Publishing it requires an owner decision
on branch/PR ownership and review. Rewriting Git history to remove previously
committed credentials and large generated blobs is separately disruptive to
every clone and must not be inferred from an implementation request.

Channel target: email to `ohstnhunt@gmail.com`, with Slack DM to `Nijel Hunt`
for the time-sensitive branch decision.

## Recommended Answer

After provider rotation is confirmed, authorize a dedicated remediation branch
and PR containing the reviewed working-tree changes. Merge and deploy that PR,
then schedule a coordinated `git-filter-repo` history rewrite with collaborator
notice and a repository backup.

## Alternatives

- Publish the remediation PR now but defer history rewriting after rotation;
  document the residual repository-history exposure.
- Split the product remediation and generated-artifact deletion into two PRs if
  review bandwidth is the limiting factor.

## Downside / Risk

The large PR needs careful review to avoid absorbing unrelated dirty work. A
later history rewrite changes commit SHAs, invalidates open branches, and
requires collaborators to re-clone or carefully rebase.

## Exact Response Needed

Reply with one of:

- `APPROVE ONE REMEDIATION PR; DEFER HISTORY REWRITE`, or
- `APPROVE ONE REMEDIATION PR AND COORDINATED HISTORY REWRITE AFTER ROTATION`.

Also name the reviewer responsible for approving the PR. This approval must
arrive only after the credential-rotation blocker is resolved.

## Execution Owner After Reply

`webapp-codex` for branch/PR preparation and verification; `blueprint-cto` for
history-rewrite coordination.

## Immediate Next Action After Reply

Reconcile the exact diff against `origin/main`, isolate known unrelated changes,
create the approved branch and commit sequence, open the PR, and attach the
local verification record. If history rewrite is approved, prepare a dry-run
inventory and collaborator migration notice before any force update.

## Deadline / Checkpoint

After credential rotation and before claiming the fixes are integrated on
`main` or live in production.

## Evidence

- Local `HEAD` and `origin/main` are currently `0 0` ahead/behind at
  `e6c3e20`, while the remediation exists only as a large dirty-tree diff.
- The retained safety stash is
  `264cab6df0a7e784b2687fad428911d2641b9b40`.
- Local typecheck, production build, generated-output tests, claims guard, and
  browser QA pass; publication and deployment are distinct unproven states.
- Safe proof: `git status --short --branch && git rev-list --left-right --count HEAD...origin/main && git diff --check`.

## Non-Scope

This reply does not authorize deleting the safety stash, force-pushing before
the approved history-rewrite window, deploying before CI, rotating credentials,
or claiming production readiness from local tests.
