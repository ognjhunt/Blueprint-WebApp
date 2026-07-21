# Blocker Title

Approve coordinated publication and credential-history cleanup

## Blocker Id

`human-blocker:webapp-remediation-publication-2026-07-20`

## Why This Is Blocked

The complete remediation is a large, intentionally destructive cleanup that
was reconciled from a pre-existing dirty working tree into isolated PR #418.
The branch is published and hosted CI is green; merging still requires the
designated owner/reviewer after provider rotation. Rewriting Git history to
remove previously committed credentials and large generated blobs is
separately disruptive to every clone and must not be inferred from an
implementation request.

Channel target: email to `ohstnhunt@gmail.com`, with Slack DM to `Nijel Hunt`
for the time-sensitive branch decision.

## Recommended Answer

After provider rotation is confirmed, review and approve PR #418. Merge it only
after the Render deploy hook is configured, then verify the CI-gated production
deployment. Schedule a coordinated `git-filter-repo` history rewrite later,
with collaborator notice and a repository backup.

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

- `APPROVE PR 418; DEFER HISTORY REWRITE`, or
- `APPROVE PR 418 AND COORDINATED HISTORY REWRITE AFTER ROTATION`.

Also name the reviewer responsible for approving the PR. This approval must
arrive only after the credential-rotation blocker is resolved.

## Execution Owner After Reply

`webapp-codex` for branch/PR preparation and verification; `blueprint-cto` for
history-rewrite coordination.

## Immediate Next Action After Reply

Reconfirm PR #418 is clean against `origin/main`, merge after rotation and
deploy-hook configuration, observe the main CI/deploy chain, and verify the
live build identity and canonical routes. If history rewrite is approved,
prepare a dry-run inventory and collaborator migration notice before any force
update.

## Deadline / Checkpoint

After credential rotation and before claiming the fixes are integrated on
`main` or live in production.

## Evidence

- PR #418 contains commits `7a25f4e2` and `2e3cfaf0`, is cleanly mergeable,
  and all five required hosted CI jobs pass at head `2e3cfaf0`.
- The isolated branch is exactly two commits ahead of `origin/main`; the
  primary dirty checkout remains untouched behind two retained safety stashes.
- Local typecheck, 1,691 tests, production build, generated-output tests,
  claims guard, and browser QA pass; merge and deployment remain distinct
  unproven states.
- Safe proof: `git status --short --branch && git rev-list --left-right --count HEAD...origin/main && git diff --check`.

## Non-Scope

This reply does not authorize deleting the safety stash, force-pushing before
the approved history-rewrite window, deploying before CI, rotating credentials,
or claiming production readiness from local tests.
