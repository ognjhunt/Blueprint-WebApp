# Beta Ops Incident Runbook

Status: Active beta runbook for WebApp/Pipeline/Capture operational incidents. Counsel/security review is still required for regulated notification decisions.

Primary owner: `blueprint-cto` until a named incident commander is assigned for the beta cohort.
Ops owner: `ops-lead`.
Finance owner: the monitored finance-review owner recorded in the payout/finance queue before live money movement is enabled.
Escalation owner: Founder/CEO for customer-visible, legal, finance, or public-claim decisions.

## Scope

Use this runbook for 100-user beta incidents involving:

- capture upload or bundle-integrity failures;
- WebApp intake or WebApp-to-Pipeline forwarding failures;
- package generation, marketplace entitlement, buyer artifact access, or hosted review failures;
- provider/GPU/spend failures;
- Stripe payment disputes, refunds, payout failures, or payout holds;
- rights/privacy takedown, consent revocation, restricted-zone, or data-deletion requests;
- bad deploys, regressions, or false buyer-facing readiness claims.

## Severity

- SEV-1: active data exposure, money movement risk, buyer access leak, provider runaway spend, production outage, unlawful capture/use, or public false claim.
- SEV-2: failed package/access path for one or more beta users, repeated upload/intake/provider failures, payout exception, or takedown propagation failure.
- SEV-3: contained single-user issue, documentation gap, non-live rehearsal failure, or degraded support path with no data/money exposure.

## First 15 Minutes

1. Open an incident record in the ops queue and assign an incident commander.
2. Freeze risky automation: disable live sends, live payout execution, provider launch envs, or buyer access paths as applicable.
3. Preserve evidence: request ids, capture ids, entitlement ids, order ids, Stripe event ids, provider run ids, deployment SHA, and logs.
4. Classify the incident severity and affected users.
5. Decide whether to run rollback, takedown, or customer comms.

## Rollback

Use the non-destructive rollback helper. It creates revert commits; it does not reset the repository.

```bash
npm run deploy:rollback -- --target <last-known-good-sha> --verify-command "npm run check && npm test -- --run client/tests/pages/Routes.test.ts"
```

After the rollback commit deploys, run a deployed health check:

```bash
npm run deploy:rollback -- --target <last-known-good-sha> --health-url https://tryblueprint.io --verify-command "npm run check"
```

Rollback evidence required before closing:

- rollback target SHA/tag;
- revert commit SHA;
- CI or local verification command output;
- deployed `/health/ready` result or explicit blocker;
- incident record with user-visible impact and customer-comms decision.

## Takedown And Access Freeze

For consent revocation, rights/privacy failure, payment dispute, or buyer-access leak:

1. Set the affected marketplace entitlement to non-provisioned or revoked.
2. Block new signed URL minting for the entitlement.
3. Record affected artifact URIs and any already-minted URL TTL risk.
4. Notify Pipeline to stop using the capture/package and preserve a takedown manifest.
5. Preserve the raw capture truth separately from derived buyer artifacts.

Do not claim already-minted signed URLs are dead unless provider logs or TTL expiry prove it.

## Customer Communications

Customer-visible messages require Founder/CEO or delegated incident commander approval.

Initial holding note:

> We found an issue affecting your Blueprint package or access path. We have paused the affected workflow while we verify the evidence and will follow up with a specific status update.

Resolved note:

> The issue affecting your Blueprint package or access path has been resolved. The affected records were reviewed, the current access state is documented, and the next step is listed below.

Blocked note:

> The issue is contained, but we cannot yet restore the workflow because a required provider, legal, finance, or rights/privacy decision is still pending.

## Closeout

An incident can close only when the record includes:

- severity, commander, owners, and timeline;
- affected users/orders/captures/entitlements;
- containment and rollback/takedown actions;
- verification evidence;
- customer-comms decision and sent message if any;
- follow-up issues with owners.
