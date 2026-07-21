# Blocker Title

Configure the CI-gated Render deploy hook

## Blocker Id

`human-blocker:webapp-render-deploy-hook-2026-07-20`

## Why This Is Blocked

The deploy workflow now fails closed when `RENDER_DEPLOY_HOOK_URL` is absent,
and the GitHub Actions repository currently has no configured secrets. A
read-only Render API check succeeded and confirmed the production
`Blueprint-WebApp` service on `main`, but Render currently has automatic deploys
enabled. That means a merge can deploy before GitHub's main-branch CI finishes,
so the current provider setting bypasses the intended CI-gated workflow.

Channel target: Slack DM to `Nijel Hunt`, mirrored by email to
`ohstnhunt@gmail.com` for the durable credential/configuration trail.

## Recommended Answer

Create a deploy hook for the production Blueprint-WebApp Render service, add
its URL as the GitHub Actions secret `RENDER_DEPLOY_HOOK_URL`, and disable
Render automatic deploys so the verified main workflow is the only deploy
trigger.

## Alternatives

- Explicitly designate a different production deployment owner and replace the
  workflow with that approved provider's fail-closed deployment contract.
- Keep deployment disabled and continue preview-only QA; this does not make the
  public remediation live.

## Downside / Risk

A hook bound to the wrong Render service could deploy the correct commit to the
wrong target. The service name and production domain must be checked in Render
before the secret is saved.

## Exact Response Needed

Reply with `RENDER HOOK CONFIGURED; AUTO DEPLOY DISABLED` and the Render service
name only after the production hook exists, GitHub Actions contains a secret
named exactly `RENDER_DEPLOY_HOOK_URL`, and the Render service reports automatic
deploys disabled. Do not send the hook URL itself.

## Execution Owner After Reply

`webapp-codex`, with `blueprint-cto` owning Render/GitHub configuration.

## Immediate Next Action After Reply

Verify the secret name with `gh secret list --app actions`, publish the approved
remediation commit, observe the CI-gated deploy run, and verify `/version.json`,
`/health`, `/health/ready`, canonical routes, and the live bundle.

## Deadline / Checkpoint

Before the remediation can be called deployed or public-launch-current.

## Evidence

- `gh secret list --app actions` returned no configured Actions secrets when
  rechecked on 2026-07-21.
- A read-only Render API request returned HTTP 200 and identified production
  service `srv-d4vnmk3e5dus73aiohk0` (`Blueprint-WebApp`, branch `main`, automatic
  deploy enabled). No credential value was written to the repository.
- Production auto-deployed current main SHA `2a73ad61` even though GitHub has no
  deploy-hook secret, proving the present path is not actually CI-gated.
- Deploy run `29776034602` failed for SHA `e6c3e20` while the matching CI run
  `29775636637` passed.
- Production's latest live Render deploy remains current main SHA
  `2a73ad614a3ab569fc8a021022eb317285b55996`; PR #418 has not been merged or
  deployed.
- PR #418 head `bc60b90c92fd3e81c328e762c8276f00ffc4a77e`
  passed all hosted checks in CI run `29806484254`; the deploy job correctly
  skipped on the pull-request event.
- Safe proof: `gh secret list --app actions` (secret names only; never print the
  hook value).

## Non-Scope

This reply does not authorize a deploy from an unreviewed tree, changing the
production domain, exposing the hook value, bypassing CI, or treating a fired
hook as successful deployment proof.
