# Routine release

Use normal CI and `.github/workflows/deploy.yml`, without the historical
communications incident sequence, continuous-freeze proof, or recovery replay.
The existing automatic admission flag and workflow enabled state remain operator
controls. This change does not enable workers, spending, sends, or automatic deploys.

CI measures the exact base-to-head change. Pure public data/copy changes run
related tests and required authentication/spending/data-access tests. Backend
helpers and agent code use dependency-related tests with the same required safety
floor, including evidence retention and prompt contracts. Route composition, UI,
rules, migrations, dependencies, workflow, deletions and unknown changes retain
the full lane.
Typecheck, claims, doctrine, rules, build and health protections remain required.
Content and backend/helper changes skip unrelated browser journeys. Missing related tests fail.

For already supported capture-client message copy, use the existing authenticated
admin client-runtime-config PUT with message and expectedRevision. Reads use
no-store and observe the committed revision on the next request, without a build
or paid model call. Each update atomically retains immutable revisions in the
existing appConfig/clientRuntime/revisions subcollection. Admin GET with
?revision=N retrieves a prior revision. Roll back by PUTting its message with the
current expectedRevision; history remains intact. No admin/CSRF/access grant changes.
For operator/agent instructions, use the existing admin startup-packs PATCH with
operatorNotes and expectedVersion. Each new run resolves the attached pack fresh;
no build or model call is needed to publish it. Current and archived versions are
committed atomically. GET /api/admin/agent/startup-packs/:id?version=N retrieves a
revision. Roll back by PATCHing that revision's operatorNotes with the current
expectedVersion. Frozen code-owned safety/output contracts remain in code.
Hardcoded website copy still requires its bounded content release.

Deployment keeps the existing render-deploy-main serialization and current-main
exact SHA admission. Health and readiness must succeed for web and worker. Before a release, capture the live healthy pair and require its exact main CI
proof. If deploy or health verification fails, automatically redeploy that SHA to
both services inside the same serialized job and verify the restored pair and
health. Use the normal exact-SHA deploy API with current settings: native Render
rollback restores previous environment values and could revive retired controls.
No repository write credential/permission is introduced. The failed release stays
red even after a verified rollback. A reviewed revert remains available to remove
the failed source change from main. Revert newest first; dirty, divergent
or merge-containing ranges fail closed.

The previous incident-only inspection job is retained in
archived-incident-inspection-20261008.txt for audit, outside active Actions jobs.
Existing held dispatch checks remain available as optional operational safeguards.
