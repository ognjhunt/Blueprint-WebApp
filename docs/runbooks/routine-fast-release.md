# Routine release

Use normal CI and `.github/workflows/deploy.yml`, without the historical
communications incident sequence, continuous-freeze proof, or recovery replay.
The existing automatic admission flag and workflow enabled state remain operator
controls. This change does not enable workers, spending, sends, or automatic deploys.

CI measures the exact base-to-head change. Pure public data/copy changes run
related tests and required authentication/spending tests; unknown, mixed, server,
auth, budget, data-access, dependency and workflow changes retain the full lane.
Typecheck, claims, doctrine, rules, build and health protections remain required.
Content-only changes skip unrelated browser journeys. Missing related tests fail.

For already supported capture-client message copy, use the existing authenticated
admin client-runtime-config PUT with message and expectedRevision. Reads use
no-store and observe the committed revision on the next request, without a build
or paid model call. Each update atomically retains immutable revisions in the
existing appConfig/clientRuntime/revisions subcollection. Admin GET with
?revision=N retrieves a prior revision. Roll back by PUTting its message with the
current expectedRevision; history remains intact. No admin/CSRF/access grant changes.
This does not externalize other hardcoded agent prompts or website copy.

Deployment keeps the existing render-deploy-main serialization and current-main
exact SHA admission. Health and readiness must succeed for web and worker. If
verification fails, prepare a reviewed revert using deploy:rollback and send that
new commit through the same CI gate. Rollback is not automatic: no new repository
write credential/permission is introduced. Revert newest first; dirty, divergent
or merge-containing ranges fail closed.

The previous incident-only inspection job is retained in
archived-incident-inspection-20261008.txt for audit, outside active Actions jobs.
Existing held dispatch checks remain available as optional operational safeguards.
