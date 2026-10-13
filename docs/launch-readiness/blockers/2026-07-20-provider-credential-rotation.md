# Blocker Title

Rotate exposed Blueprint-WebApp provider credentials

## Blocker Id

`human-blocker:webapp-provider-credential-rotation-2026-07-20`

## Status (2026-10-13)

**Still open.** The code side is done (the client-bundled Lindy token and the
Perplexity/Firecrawl keys were deleted in PR #418, live since 2026-07-21), but
no provider-side revocation evidence has been recorded for any of the four
credentials. Only the founder can close this.

## Founder checklist (about 20 minutes)

Do each row, then record only the provider, account/workspace label and
timestamp under *Evidence* below. Never paste key values anywhere.

| # | Credential | Where it is used today | Revoke / rotate | Replace |
| --- | --- | --- | --- | --- |
| 1 | **Lindy** webhook bearer token (was in `client/src/utils/lindyWebhook.ts`, shipped in the public bundle) | Nothing in the repo or Render reads it any more. | Lindy → the agent/workflow that owned the webhook → regenerate or delete the webhook secret (or delete the webhook trigger). | Nothing to replace; leave it deleted unless a server-side Lindy integration is approved. |
| 2 | **Perplexity** API key (`pplx-…`, was in `FeatureConfigScreens.jsx`) | Not used by the WebApp. `PERPLEXITY_API_KEY` is only listed as an optional research-spend source in `config/autonomy/spend-sources.yaml`. | Perplexity → Settings → API → delete the exposed key. | Only if a server-side research lane needs it: create a new key and store it as `PERPLEXITY_API_KEY` in the Render dashboard (never in the repo or client). |
| 3 | **Firecrawl** API key (`fc-…`, six call sites in the same dead file) | Not used by the WebApp; no env var reads it. | Firecrawl → Dashboard → API Keys → revoke the exposed key. | None needed. |
| 4 | **Render** API key (pasted in a task chat on 2026-07-20) | GitHub Actions secret `RENDER_API_KEY` (`.github/workflows/deploy.yml`, rollback in `scripts/release/render-rollback.mjs`); also used ad hoc by `npm run render:import-env`. | Render → Account Settings → API Keys → create a new key, then delete the exposed one. | GitHub → repo Settings → Secrets and variables → Actions → update `RENDER_API_KEY`. Then re-run the Deploy workflow (or wait for the next green main) and confirm it reaches `/health/ready`. |

Read-only evidence helper (offline; prints counts and paths, never values):

```bash
bash scripts/ops/credential-exposure-scan.sh          # tree, built bundle, git history
```

A clean tree and bundle do not prove revocation: the keys remain in git history
until the separately approved history rewrite
(`2026-07-20-publish-and-history-rewrite.md`). Provider-side revocation is what
makes them harmless.

## Why This Is Blocked

The remediation removes the client-bundled Lindy bearer token and dead-code
Perplexity and Firecrawl keys, but repository edits cannot revoke credentials
in those provider accounts. A Render API credential was also pasted into the
remediation task while deployment access was being diagnosed. It was verified
with a read-only request and was not written to the repository, but plaintext
disclosure still requires rotation. A provider account owner must rotate or
revoke all four credentials before the exposure can be treated as contained.

Channel target: email to `ohstnhunt@gmail.com` for the durable security trail,
with an optional Slack DM to `Nijel Hunt` carrying the same blocker id.

## Recommended Answer

Revoke the exposed Lindy credential and rotate the affected Perplexity,
Firecrawl, and Render credentials now. Confirm only provider name,
account/workspace, and completion timestamp; do not paste replacement secrets
into chat, email, or the repository.

## Alternatives

- Disable the affected provider integrations until new server-only credentials
  can be installed.
- If a provider confirms a key was already revoked, provide that provider's
  revocation timestamp as the rotation evidence.

## Downside / Risk

Dependent provider workflows may stop until replacement credentials are added
to their approved server-side secret stores.

## Exact Response Needed

Reply with: `APPROVE ROTATION`, then list `Lindy`, `Perplexity`, `Firecrawl`,
and `Render` with the account/workspace label and revocation or rotation
timestamp for each. Do not include credential values.

## Execution Owner After Reply

`webapp-codex`, with `blueprint-cto` owning provider-account coordination.

## Immediate Next Action After Reply

Record the rotation evidence, rerun source and production-bundle secret scans,
then proceed to publish and deploy the remediation without reintroducing a
client-side provider credential.

## Deadline / Checkpoint

Before the remediation is deployed or any affected provider integration is
re-enabled.

## Evidence

- The audit identified a Lindy bearer token in a routed client flow and
  Perplexity/Firecrawl keys in committed dead code at baseline SHA `e6c3e20`.
- The remediation in PR #418 deletes those files; the client source secret
  guard and claims guard pass at head
  `bc60b90c92fd3e81c328e762c8276f00ffc4a77e` in hosted CI run
  `29806484254`.
- The Render API credential shared during the task returned HTTP 200 for a
  read-only service lookup. It was not committed or printed into an artifact;
  successful authentication is why it must now be treated as exposed.
- Production's latest live Render deploy is current main SHA
  `2a73ad614a3ab569fc8a021022eb317285b55996`, not PR #418; code deletion in an
  unmerged branch is not provider revocation evidence.
- Safe proof: `npm run check && npx vitest run client/tests/security/client-source-secret-guard.test.ts`.

## Non-Scope

This reply does not authorize publishing, deployment, history rewriting,
provider spending, or live provider calls. Deleting source is not accepted as
proof that a provider credential was revoked.
