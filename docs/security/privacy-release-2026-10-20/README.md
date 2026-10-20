# Privacy controls release and live verification

State: **done** for the requested merge, deployment, and live cookie-consent,
refund-page, and account-deletion-request verification. This does not claim
completed account erasure or legal adoption of the full policy drafts.

## Release identity and evidence

- Objective: release the privacy/account controls and verify their actual
  behavior at `https://tryblueprint.io`.
- Owner instruction: “Go ahead and merge and deploy these changes, then verify
  the cookie consent, refund page, and account deletion request flow on the live
  site.” The accountable engineering owner remained Codex through verification.
- Changes: [PR #1072](https://github.com/ognjhunt/Blueprint-WebApp/pull/1072) and
  [PR #1073](https://github.com/ognjhunt/Blueprint-WebApp/pull/1073), both merged
  through normal protected checks. Final deployed source:
  `b899c9a668f6a331ad9aa2b5a6b0b3567583e7e9`.
- Budget/timeout context: no additional user budget supplied; no paid provider
  job, outbound notice, provider configuration change, or data erasure was
  requested by verification. Browser operations used bounded timeouts.
- Stage reached: merged, exact-commit web and worker deployment, public health
  and readiness, real browser journeys, and independent request readback.
- [Main CI](https://github.com/ognjhunt/Blueprint-WebApp/actions/runs/39361503610)
  passed: 10,798 tests, 13 skipped; 858 passing suites, 3 skipped; 126 security
  rules tests; all required build, type, security, architecture, and browser
  gates, including the 9 focused privacy browser checks. These CI browser
  checks use isolated fixtures; the separate live evidence below does not.
- [Deployment](https://github.com/ognjhunt/Blueprint-WebApp/actions/runs/39362440041)
  succeeded. [Receipt](deploy-verification.json): web
  `dep-dbbdl1s9v7es73erquag` and worker `dep-dbbdl23bc2fs73aqhv50` both `live`
  at the final source commit. Public `/version.json` matched; `/health` and
  `/health/ready` returned 200. [Readiness](health-ready.json) reported zero
  blockers. Verification completed at 2026-10-20T03:09:04Z.

The first release attempt at `89dfbaaefb632536bef9c9e174068eb84d6912a2`
failed because the browser-secret guard rejected the worker's existing Stripe
publishable-key variable. The workflow restored both services to
`0413fec05c16ad1ad7bfc8aa467cb6581be7ebb3`; see the
[verified rollback](superseded-release-rollback.json). PR #1073 accepts only
the exact public variable with a valid publishable-key format; secret,
restricted, webhook, and malformed values still fail. No key value or service
environment was changed. The final successful release supersedes that attempt.

## Live acceptance coverage

| Requirement | Observed result | Evidence |
| --- | --- | --- |
| Cookie consent | Fresh browser: zero optional analytics requests, identifiers, or analytics cookies before choice. Reject persisted through reload. Accept persisted and permitted one real first-party analytics request. Reopening restored choices. Withdrawal stopped requests and removed the identifier in the current document and after navigation. | [Public report](public-report.json), [desktop screenshot](desktop-cookie-choice.png) |
| Refund page | Mobile beta cost link opened `/refunds`; free-beta and historical-purchase text, applicable terms, contact, footer, privacy, and deletion-settings links worked. No horizontal overflow. | [Public report](public-report.json), [mobile screenshot](mobile-refunds.png) |
| Account deletion request | Exactly one synthetic account signed in through the production password UI (200). Confirmation was required. The normal authenticated, CSRF-protected request returned 202. Reload restored the same receipt (200); independent Firestore readback matched the request and identity. The account remained enabled and unprivileged; admin queue access returned 403. Desktop and mobile rendering passed inspection. | [Sanitized request evidence](deletion-live-evidence.json), [desktop](deletion-request-desktop.png), [mobile](deletion-request-mobile.png) |
| Release binding | Both live verifiers checked the exact deployed source commit before and after their journeys. Public checks ran 03:09:34–03:10:11Z; account checks ran 03:09:43–03:09:54Z. | Both reports and [deployment receipt](deploy-verification.json) |

The real analytics response was 202 with `persisted=false`, `disabled=true`,
and `ok=true`. This proves consent-gated client request behavior; it does not
prove durable analytics storage. No Google tag, Google Analytics collector,
or PostHog requests were observed, including after opt-in. The URL-marker
probe found zero markers in observed analytics requests. This is not positive
live coverage of those vendors or verification of GA Enhanced Measurement
settings. Configured-provider and race behavior has local/CI test coverage.

## Retained synthetic request and operational boundary

Synthetic UID: `privacy-qa-b899c9a668f6-cbeeaec6cf42`.
Its email uses reserved `example.invalid`; no real person's account was used.
Request: `deletion_cc929b6b07a4448d58e8b952261f37f0e1ce5a18922b8d44fec69f2b1dbb3ec4`.
Canonical record: `projects/blueprint-8c1ca/databases/(default)/documents/accountDeletionRequests/`
followed by that request ID, schema `account_deletion_request.v1`.
Status at readback: `requested`, reviewer unknown (`null`).

The account and request are retained for operator review; they were not
erased. Exclude this exact synthetic UID from account-notice recipients.
Credentials and the private creation/ownership manifest are protected local
artifacts and are not published here. The published JSON omits the local
session identifier and records the original report hash. No password, token,
session header, or cookie value is included.

Positive admin review, live queue-monitoring adoption, cross-system erasure,
processor/backup handling, and response delivery remain outside this
verification. Follow the [operator runbook](../../runbooks/account-data-deletion.md).
Nijel Hunt owns designation/confirmation of the privacy operations owner; that
adoption has not been observed. The named privacy operator's next action is to
review the retained synthetic fixture without treating it as customer demand.
No further engineering action is required for the three requested live checks.
The broader legal drafts remain unadopted.

## Portability, recovery, and retry

The evidence is canonical in company-controlled Git as Markdown, JSON, PNG,
and JavaScript. [Manifest](manifest.json) records SHA-256 hashes for this
bundle and every source file changed by the release. The deployed commit and
the later evidence-only commit are distinct. The earlier
[local verification manifest](../launch-privacy-verification-2026-10-19.json)
is preserved as historical, pre-release evidence.

Recover the source with `git show b899c9a668f6a331ad9aa2b5a6b0b3567583e7e9:<path>`
and export this directory from its containing Git commit using `git archive`.
The request is independently recoverable through the existing authorized
Firestore Admin/export route. No model-vendor session is canonical storage.
The archived verifiers show the checks performed; copy them to the ignored QA
output directory before any authorized rerun. Do not run the deletion verifier
from this evidence directory or create another account merely to repeat proof.
Reuse the exact existing fixture only with its verified owner and private
credentials, current authorization, and a matching release. Otherwise preserve
it and stop. Public checks can be repeated against a confirmed deployed commit.

No Paperclip/operating-graph projection is required: this was a direct owner
release request tracked by the two GitHub PRs and workflow runs, with no linked
Paperclip issue, provider evaluation, or customer delivery record. The live
deletion request itself is durably projected in Firestore. Dependency
protection remains held; unresolved lease ownership is preserved and no
dependency cleanup was performed.
