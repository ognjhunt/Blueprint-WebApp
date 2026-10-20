# Launch privacy and account-controls audit

Date: October 19, 2026 (America/Chicago). Audited baseline:
`0413fec05c16ad1ad7bfc8aa467cb6581be7ebb3`.

Owner request: inventory the app's services/data, draft privacy/terms/refund
policies, add account deletion and flag browser-exposed API keys. Beta journey:
account/privacy rights, consent, intake and service information. This is a
source audit and local implementation. It is not legal adoption, a deployment,
a credential rotation or proof that a production deletion has been completed.

## Checklist

| Item | Observed before work | Result and remaining boundary |
| --- | --- | --- |
| Privacy policy naming tools/data | `/privacy` already existed with detailed footage/retention/rights information and many providers. Several conditional/internal recipients were missing. | Complete source-based inventory and expanded review draft linked below. Public copy updated only for the implemented consent/deletion behavior; proposed full draft remains separate. Live enabled vendors, processing agreements and regions still need verification. |
| Terms limiting liability | `/terms` already contained warranty exclusions, a liability cap (greater of $100 or preceding 12-month fees), indemnity, governing law and contact details. | Full review draft preserves free-beta scope and proposes clearer mandatory-rights, privacy and indemnity limits. Existing published Terms are unchanged. Enforceability is for counsel to assess. |
| Cookie controls | Banner, accept/reject/customize, footer reopening and GPC handling existed. Baseline analytics could initialize before opt-in. | Optional GA/PostHog/first-party analytics now require consent; session recording explicitly off, withdrawal clears analytics storage, private telemetry is sanitized. Local tests cover behavior; production still serves the baseline until release. |
| Account/data deletion | Capture withdrawal had a deletion worker; no account-wide WebApp request flow. | Authenticated, recent-sign-in request with durable receipt, own-status readback and admin review queue. Actual scope-aware deletion, vendor/backup handling and final response are operator work. This is not instant self-service erasure or an observed live service. |
| Refund policy beside purchase | Historical refund terms existed in Terms; no dedicated page. Free beta disables checkout. | Added `/refunds`, footer link and link beside beta cost explanation. Restates existing unused-balance/refund/replacement commitments. No checkout added. A future authorized paid checkout needs the specific terms beside payment. |
| Legal/privacy contact | `Blueprint Robotics, Inc.`, `6801 Burnet Rd, Austin, TX 78757`, `privacy@tryblueprint.io`, `legal@tryblueprint.io` are in canonical company data and public policies. | Present in source. This audit does not prove delivery, inbox staffing, postal control or legal registration. Verify those operational facts before calling them confirmed contact channels. |
| Frontend API keys | Firebase and Maps browser configuration is public by design. Unused client helpers admitted generative-AI/internal access-code variables. | Removed unsafe helpers and added build rejection of secret-like VITE variables outside the public-browser allowlist. Secret scan/inventory linked below. No revocation or provider restriction changes were performed. |

## Deliverables

- [Every identified service, data fields, activation conditions and source references](third-party-data-inventory-2026-10-19.md): 30 directly implemented named service entries, plus infrastructure, upstream/imported sources and unknown configurable recipients. This count is not a claim that all are active.
- [Privacy Policy draft](../legal/privacy-policy-draft-2026-10-19.md).
- [Terms of Service draft](../legal/terms-of-service-draft-2026-10-19.md).
- [Refund Policy draft](../legal/refund-policy-draft-2026-10-19.md) and [implemented page](../../client/src/pages/Refunds.tsx).
- [Account deletion procedure and evidence boundaries](../runbooks/account-data-deletion.md).
- [Frontend privacy/security findings](frontend-privacy-audit-2026-10-19.md), [credential-name inventory](credential-variable-inventory-2026-10-19.json), and [public asset scan](public-frontend-secret-scan-2026-10-19.json). No credential values are included.

## Policy and operational decisions still open

The announced policy update retains November 15, 2026 as its effective date.
The privacy revision changes from `.2` to `.3` for the narrow public-copy changes.
The previous versions remain frozen. None of these edits retroactively extends
recording retention, adopts the proposed seven-year period, activates providers,
reopens paid beta checkout or authorizes account notices. The original
[retention/recording counsel packet](../launch-readiness/2026-10-16-retention-and-recording-counsel-review.md)
remains open.

Before adopting the full drafts, verify actual deployment configuration and
contracts (including any Redis host, remote agent/model gateway and custom
research endpoint), lawful bases/transfers, contact control, cohort retention
and deletion/backup obligations. Assign a human to monitor the admin privacy
queue and exercise one authorized end-to-end request with receipts. The app's
queue alone does not establish that operational duty is being performed.

## External guidance used for drafting

The [ICO notice checklist](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/)
informed the draft's purposes, recipients, retention, rights and transfer
sections. The [ICO consent guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/)
informed accessible accept/reject/change controls. The
[Stripe website checklist](https://docs.stripe.com/get-started/checklist/website)
informed prominent refund/contact information. These sources do not certify this
app or remove the need to review its actual practices and applicable jurisdiction.

## Canonical artifacts and recovery

All drafts, inventories, source and tests live in this company-owned repository
as Markdown, JSON and TypeScript. The credential inventory contains names and
source locations only. The public scan records deployed identity and asset
hashes. Preserve the final source commit and publish through the existing
CI/deployment process when authorized; ordinary Git checkout/export restores
these artifacts without a chat or model-vendor session. Local verification
artifacts do not themselves change the deployed application.

## Verification completed

- 116 focused tests across 15 suites passed, including identity isolation,
  recent-sign-in enforcement, CSRF, write failure, idempotency, capturer/missing
  profile access, consent/revocation races, storage failure, telemetry redaction,
  credential guards and preserved free-beta terms.
- 9 Chromium browser checks passed using loopback Vite, development-only fake
  authentication and mocked APIs. They exercised request/receipt/reload/review,
  retry, mobile layout, consent with a positive opt-in control, withdrawal and
  the public refund/privacy pages. No production account or provider received
  a deletion or analytics request from these tests.
- `npm run check` passed. `BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD=1 npm run
  build` passed; this is a compile/prerender/server-bundle check without the
  production Firebase client configuration and is **not a deployable sign-in
  build**. The generated build-info SHA is the baseline HEAD, not a committed
  identity for these uncommitted changes.
- The provider-portability audit reported no findings; it is a static audit,
  not a live access test. Required Graphify refresh published canonical outputs.
  The default Python 3.14 venv setup failed; the pinned environment provisioned
  successfully with Python 3.13 and the existing interpreter override.
- `git diff --check` and draft/report link checks passed. Source and report
  hashes are recorded in [the verification manifest](launch-privacy-verification-2026-10-19.json).
- Dependencies remain protected. Final protection returned `held`; lease
  registration returned `KEEP: unresolved preservation hold requires an
  ownership handoff`. No hold was cleared and no dependencies were reclaimed.

Live checks were limited to public version/asset reads. No deployment, send,
provider reconfiguration, data erasure, paid action or credential rotation was
performed. In particular, the production GA stream's automatic Enhanced
Measurement events remain unverified; see the frontend audit before treating
app-authored URL sanitization as proof for all vendor-generated events.
