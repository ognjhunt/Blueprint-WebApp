# Blocker Title

Rotate credentials previously committed to Blueprint-WebApp

## Blocker Id

`human-blocker:webapp-provider-credential-rotation-2026-07-20`

## Why This Is Blocked

The remediation removes the client-bundled Lindy bearer token and dead-code
Perplexity and Firecrawl keys, but repository edits cannot revoke credentials
in those provider accounts. A provider account owner must rotate or revoke all
three before the exposure can be treated as contained.

Channel target: email to `ohstnhunt@gmail.com` for the durable security trail,
with an optional Slack DM to `Nijel Hunt` carrying the same blocker id.

## Recommended Answer

Revoke the exposed Lindy credential and rotate the affected Perplexity and
Firecrawl credentials now. Confirm only provider name, account/workspace, and
completion timestamp; do not paste replacement secrets into chat, email, or
the repository.

## Alternatives

- Disable the affected provider integrations until new server-only credentials
  can be installed.
- If a provider confirms a key was already revoked, provide that provider's
  revocation timestamp as the rotation evidence.

## Downside / Risk

Dependent provider workflows may stop until replacement credentials are added
to their approved server-side secret stores.

## Exact Response Needed

Reply with: `APPROVE ROTATION`, then list `Lindy`, `Perplexity`, and `Firecrawl`
with the account/workspace label and revocation or rotation timestamp for each.
Do not include credential values.

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
- The local remediation deletes those files and the client source secret guard
  passes.
- Production still reports build SHA `e6c3e20`; code deletion is not provider
  revocation evidence.
- Safe proof: `npm run check && npx vitest run client/tests/security/client-source-secret-guard.test.ts`.

## Non-Scope

This reply does not authorize publishing, deployment, history rewriting,
provider spending, or live provider calls. Deleting source is not accepted as
proof that a provider credential was revoked.
