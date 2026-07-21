# Blocker Title

Coordinate credential rotation and optional history cleanup

## Blocker Id

`human-blocker:webapp-remediation-publication-2026-07-20`

## Why This Is Blocked

The publication portion is resolved: PR #418 merged on 2026-07-21 as
`41e17825f8716efa91a9dfc99f5329ad0544a02f` and that exact SHA is live. Rewriting
Git history to remove previously committed credentials and large generated
blobs remains separately disruptive to every clone and must not be inferred
from the merge authorization.

Channel target: email to `ohstnhunt@gmail.com`, with Slack DM to `Nijel Hunt`
for the time-sensitive branch decision.

## Recommended Answer

Rotate every exposed provider credential, including the Render key that was
shared in chat, and replace active secret-store values. Schedule a coordinated
`git-filter-repo` history rewrite later, with collaborator notice and a
repository backup, only if the owner separately approves it.

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

No publication response remains. For history cleanup, reply explicitly with
`APPROVE COORDINATED HISTORY REWRITE AFTER ROTATION`; otherwise history rewrite
remains deferred.

## Execution Owner After Reply

`webapp-codex` for branch/PR preparation and verification; `blueprint-cto` for
history-rewrite coordination.

## Immediate Next Action After Reply

Complete provider credential rotation. If history rewrite is approved, prepare
a dry-run inventory and collaborator migration notice before any force update.

## Deadline / Checkpoint

After credential rotation and before claiming historical credential exposure
has been remediated.

## Evidence

- PR #418 merged at `41e17825f8716efa91a9dfc99f5329ad0544a02f`.
- Production `/version.json` reports that exact SHA, and `/health` plus
  `/health/ready` both return 200.
- Main CI run `29828655494` passed all substantive verification jobs; its only
  failure was the separately tracked obsolete deploy-hook job.
- Safe proof: `git status --short --branch && git rev-list --left-right --count HEAD...origin/main && git diff --check`.

## Non-Scope

This reply does not authorize deleting the safety stash, force-pushing before
the approved history-rewrite window, deploying before CI, rotating credentials,
or claiming production readiness from local tests.
