# Blocker Title

Choose and configure production beta capacity limits

## Blocker Id

`human-blocker:webapp-production-beta-capacity-2026-07-20`

## Status (2026-10-13)

**Resolved; kept for history.** The later blocker records show production
`/health/ready` returning 200: `2026-07-20-publish-and-history-rewrite.md`
(PR #418 merge `41e17825f8716efa91a9dfc99f5329ad0544a02f` live, `/health` and
`/health/ready` both 200) and `2026-07-20-render-deploy-hook.md` (deploy of
`1cf156f2e38127c3b2a38727232c7c7451d6646e`, `/health/ready` 200 with
`blocker_count: 0`). Readiness fails closed without positive beta caps, so a
200 with zero blockers means both caps were set to positive values. The exact
values were not recorded here and should not be inferred.

Note for the free open beta: the caps still bound intake. If sites start
hitting them, raise `BLUEPRINT_BETA_INVITE_CAP` and
`BLUEPRINT_BETA_COHORT_DAILY_LIMIT` in Render rather than removing them.
Readiness now also blocks on Slack, Resend, Redis and the Stripe queue
consumer in production; see `docs/runbooks/beta-monitoring.md`.

The sections below are the original 2026-07-20 request.

## Why This Is Blocked

Production is healthy at `/health` but returns HTTP 503 from `/health/ready`
with exactly one blocker. Render's environment contains neither
`BLUEPRINT_BETA_INVITE_CAP` nor `BLUEPRINT_BETA_COHORT_DAILY_LIMIT`. The
readiness contract deliberately treats missing or non-positive values as a
launch blocker, and the intake gates fail closed for the same reason. Choosing
capacity is a business/operations decision; fixture values must not be promoted
to production by an agent.

Channel target: Slack DM to `Nijel Hunt`, mirrored by email to
`ohstnhunt@gmail.com` for the durable production-configuration trail.

## Recommended Answer

Choose a positive total invite cap and a positive per-cohort daily admission
limit for the current beta. Keep the allowed-market and allowed-site-type lists
empty unless the launch is intentionally restricted. The deployment contract's
documented starting point is `BLUEPRINT_BETA_INVITE_CAP=100` and
`BLUEPRINT_BETA_COHORT_DAILY_LIMIT=25`; these are recommendations, not values
an agent may silently promote to production.

## Alternatives

- Set `BLUEPRINT_BETA_KILL_SWITCH=1` to explicitly keep intake closed. This is
  operationally honest but `/health/ready` will remain blocked.
- Set positive limits and narrow `BLUEPRINT_BETA_ALLOWED_MARKETS` and
  `BLUEPRINT_BETA_ALLOWED_SITE_TYPES` to an approved launch cohort.

## Downside / Risk

Limits that are too high can admit more work than operations can fulfill.
Limits that are too low can reject legitimate buyer/capturer requests. A zero
or missing limit intentionally closes intake and cannot support a ready claim.

## Exact Response Needed

Reply with:

- `BLUEPRINT_BETA_INVITE_CAP=<positive integer>`
- `BLUEPRINT_BETA_COHORT_DAILY_LIMIT=<positive integer>`
- optional approved market/site-type allowlists, or `UNRESTRICTED`

Do not include credentials.

## Execution Owner After Reply

`blueprint-cto` owns the capacity decision; `webapp-codex` can verify the
resulting Render configuration and readiness response.

## Immediate Next Action After Reply

Set the approved values in the production Render service, allow the service to
restart, then verify `/health`, `/health/ready`, and the relevant intake gates.
Record only variable names and non-secret numeric/allowlist values.

## Deadline / Checkpoint

Before claiming operational launch readiness or merging a change that will
auto-deploy to production.

## Evidence

- Rechecked on 2026-07-21: live `/health` returned HTTP 200 while
  `/health/ready` returned HTTP 503.
- Rechecked on 2026-07-21: the latest live Render deploy is main SHA
  `2a73ad614a3ab569fc8a021022eb317285b55996`.
- A read-only Render environment-key inventory again confirmed both
  beta-capacity variables are absent; no environment values were printed.
- `server/utils/beta-cohort-policy.ts` and
  `server/utils/launch-readiness.ts` fail closed when either value is missing,
  invalid, or non-positive.

## Non-Scope

This response does not authorize merging PR #418, changing credentials,
triggering a deploy, relaxing the fail-closed gate, or inventing production
capacity from local smoke-test fixtures.
