# Retention and recording review packet

Status: prepared for founder/counsel review; no counsel approval, account notice,
data deletion, provider change or external send is represented by this packet.
Journey: L2 recording/consent and X operation. Blocker ID:
`beta-retention-original-collection-terms-20261016`.

## Decision requested

Counsel and the founder should approve a cohort-specific retention and notice
plan before any longer retention period is applied. Recommended answer: preserve
the original collection terms, inventory affected recordings and their job-close
dates, identify legal holds and overdue deletion obligations, and require an
explicit legal basis and reviewed notice/authorization for a prospective change.
A new policy acceptance alone must not extend previously collected recordings.
Notification alone must not be assumed to authorize a retrospective extension.

Execution owner after reply: founder for legal adoption/notice approval; WebApp
and Pipeline owners for the exact approved cohort migration. Immediate action
after a recorded reply: bind the approved policy/hold/deletion decision to each
affected capture, implement and preview the migration, and retain audit receipts.
Checkpoint: before a retention extension or a claim that the privacy issue is
closed. No account email is authorized by this packet. If counsel requires one,
use the existing account-notice preview/outbox workflow with a separately
approved notice and recipient selection (`docs/runbooks/account-notice-email.md`).
Intended routing: founder via the owning review/PR; counsel recipient and sending
authorization are not established here, so this packet remains local.

## Established repository evidence

| Source | What it establishes | What it does not establish |
| --- | --- | --- |
| `client/src/pages/PrivacyPrevious.tsx` | Frozen privacy version `2026-10-13.1` promises site footage retention of 180 days after the job closes. | Which recordings were collected under that or older terms, or their actual deletion state. |
| `client/src/lib/legalAcceptance.ts` and `LegalVersionNotes.tsx` | The announced reissue takes effect November 15, 2026 at 08:00 UTC. Earlier versions remain in force until then; a site/workspace banner announces it. The retention clarification is revision `2026-11-15.2`. | Delivery of any notice to an account holder, informed agreement, or adequacy of a banner under existing contractual notice promises. |
| `docs/runbooks/beta-monitoring.md` | The October 15 owner direction used a future date and a banner, with no account email for that reissue. | Counsel approval of that notice choice. |
| `server/utils/websiteCaptureDeletion.ts` | Withdrawal deletion is queued, waits for upload expiry and Pipeline acknowledgement, records receipts and respects legal holds. It covers only WebApp-owned prefixes. | An automatic 180-day-after-close scheduler, Pipeline/backup deletion, or production deployment/execution. |
| `server/utils/websiteCaptureRetention.ts` | New server-owned manifests preserve first-receipt metadata and review requirements, disallow automatic retrospective extension and omit the unconditional 2,555-day floor. | The collection policy accepted by an individual account or legal authorization for a retention change. |

Storage preservation and internal archive defaults are implementation facts; they
are not permission to replace the terms under which footage was collected. This
repair neither rewrites immutable existing manifests nor deletes originals.

## Review each cohort separately

1. Existing recordings: inventory original notices/acceptance, collection date,
   applicable agreements, job-close date, withdrawal, legal holds, replicas,
   processing copies and backups. Determine whether the 180-day promise or an
   earlier schedule applies and which records require remediation. Later account
   acceptance must remain separate from collection-time authority.
2. Recordings collected while the reissue is pending: the previous policy still
   applies. Do not infer seven-year authority from signing the announced policy
   or from the internal storage minimum. Record the actual applicable terms.
3. Future recordings: assess necessity and proportionality of a seven-year
   period, a fixed maximum versus an indefinite minimum, alternatives, the
   applicable notice/agreement requirements and the deletion/backup process.
   The published proposal is subject to that review; passing the effective date
   does not itself provide approval.

## Remaining questions for counsel

- Retention and deletion: approve the applicable schedule per cohort, required
  notices or agreements, handling of earlier nonperformance, holds, account
  closure and inactivity, processing copies and backups, and implementable
  deletion deadlines. An archive transition is not deletion.
- Recording and sound: review notice/consent requirements for site staff and
  bystanders seen or heard, authority for staff-filmed visits, the original audio
  retained as received, sound removal before automated/provider review, and
  the prohibition on speech analysis. Confirm requirements by jurisdiction.
- Team permission to run: review the invited team's policy execution terms,
  ownership, permitted scene/render inputs and trace/result retention, security,
  restrictions on training/resale, confidentiality and withdrawal effects. Raw
  walkthrough media remains outside robot-team delivery rights.
- Subprocessors and transfers: compare the deployed provider/configuration
  inventory against the Privacy list, including optional Redis/cache deployment,
  consent-gated analytics/monitoring and the distinction between an approved
  vendor and a provider actually used for a particular recording.

Risk: changing copy alone cannot cure historical retention or notice defects.
Neither the report nor a passing test proves the deployed retention state. Before
closure retain the reviewed legal decision, authoritative cohort inventory,
approved notice/authorization records, exact storage/deletion receipts and any
remaining hold/backup exceptions. No external source record or receipt has been
fabricated here.

Alternative: keep the earlier retention schedule for all beta recordings and
implement it, subject to reviewed holds. Any prospective extension still needs
the required legal review and notice/authorization. This packet does not approve
new training uses, broader access, unrelated vendor changes or physical safety
claims.
