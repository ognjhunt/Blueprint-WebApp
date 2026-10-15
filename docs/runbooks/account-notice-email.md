# Blueprint account-notice email

Account/service notices, including Terms and policy updates, use the production
`CUSTOMER_JOB_EMAIL_IDENTITY`, `brandedEmail`, `captureOutbox`, and Resend
transport. From is `Blueprint <hello@tryblueprint.io>`; Reply-To is
`hello@tryblueprint.io`, whose existing Google mailbox route stays in place.
The body uses the current styled wrapper, live-text Blueprint wordmark,
`https://tryblueprint.io/brand/email-mark.png`, and company footer.
Personal founder outreach retains its existing `nijel@tryblueprint.io` path.

## Prepare and review

Save a notice definition in an ignored/private location. It must state why the
notice applies, its evidence reference, the exact account audience, and the
email-verification and disabled-account rules. This synthetic example grants
no send authority and is not approved legal wording:

```json
{
  "noticeId": "example-account-update-v1",
  "subject": "An update to your Blueprint account",
  "body": "Hi,\n\nThis is a local preview of an account notice.\n\nRead the update:\nhttps://tryblueprint.io/terms\n\n— The Blueprint team",
  "eligibility": {
    "audience": {
      "kind": "existing_accounts",
      "createdBefore": "2026-10-14T00:00:00Z"
    },
    "reason": "A service change applicable to accounts existing before this cutoff",
    "evidenceRef": "company-controlled reference for the notice scope decision",
    "emailVerification": "not_required",
    "includeDisabledAccounts": false,
    "exclusions": [
      {
        "uid": "synthetic-owner-identified-test-uid",
        "reason": "test_account",
        "evidenceRef": "company-controlled record explicitly identifying this test account"
      }
    ]
  }
}
```

For a notice affecting particular accounts, use
`"audience": { "kind": "account_uids", "uids": ["affected-uid"] }` with a
scope reason and evidence reference. Do not substitute arbitrary addresses.
Record explicitly identified test accounts or unrelated accounts in
`exclusions` by UID, reason (`test_account` or `unrelated`) and evidence ref.
There is no existing authoritative test-account classification field in the
account schema; names, Gmail domains, profile text and guessed intent are not
classification evidence. An empty exclusions list records no identified
exclusions; it does not certify that a roster has no test accounts.

```bash
npm run email:account-notice -- --input /private/path/notice.json --output output/email/account-notice/review
```

This is a **read-only** account audit using existing Firebase Admin access. It
pages the configured app's entire Firebase Auth roster and separately reads
`users` document IDs, including orphan profiles. It writes a private
`selection.json` with schema `blueprint.account_notice_recipients.v1`, capture
time, notice digest and one decision per UID: eligible, excluded or held, the
reason, source record IDs, account linkage, canonical Auth email, creation time
and email-verification and disabled-status facts. Unknown or malformed account
flags are reported as unknown and held for review. It also writes common branded HTML/text and the
notice definition. An incomplete source read fails instead of publishing a
complete eligible list. Keep these private JSON/HTML/text files out of Git,
public assets and unapproved destinations; files are written with mode 0600.

Auth owns account existence, UID, email and creation time. Owner-writable
`users/<uid>` profile fields are join context and cannot establish eligibility.
An Auth-only account may qualify for a service notice without a profile, active
job or current beta admission. A profile with no current Auth linkage is held.
Email verification is reported separately from account linkage: an unverified
account exists, but may receive this notice only if its explicit policy permits
unverified addresses. Disabled-account inclusion is likewise a notice policy
choice. Scope and exclusions require review against the actual notice, not a
blanket activity or marketing-subscription rule.

The [synthetic mobile preview](../qa/account-notice-branding-2026-10-14/mobile.png)
shows the existing production layout. Local browser checks cover desktop,
mobile, dark mode, and blocked images, with all external requests intercepted.
See the [render measurements](../qa/account-notice-branding-2026-10-14/browser-proof.json).

## Approved delivery

Only after explicit approval of the exact content and the **saved eligible
recipient list**, run the same command with `--enqueue --reviewed <path to the
reviewed selection.json>` in an existing authorized runtime. No such batch is
authorized by this code change. The command requires a complete selection whose
notice digest matches the current notice definition; it does not silently
rescan and widen the approved list. Excluded and held rows are never enqueued.
The flag creates live delivery intent, so the existing pump can send it without
another command. Do not run it to test branding or selection.

Before enqueue and again before dispatch, the current Auth identity must still
qualify and match the reviewed UID, email and creation time. Changed/deleted or
recreated identities, unavailable lookup, and missing/legacy eligibility
provenance are held for review without a provider call. A queued intent retains
its policy and account evidence, bound into the existing dispatch digest.
`review_required` rows consume no send attempt and are not automatically retried;
inspect their `lastError` and source records with existing authorized access.
They are not evidence of failed email delivery. Releasing a hold needs a fresh
eligible review and explicit send authority; this change provides no automatic
resend, reset or retarget operation.

The key binds `noticeId` to the normalized recipient. Keep the same notice ID
when retrying; an existing matching intent is returned with its current status.
Changed copy under an existing key is rejected, and no replacement is written.
Do not invent a new ID to work around a sent or unknown result. The existing
outbox owns concurrency, dispatch receipts, bounded retries, and ambiguous
provider outcomes. Inspect `captureOutbox/<idempotencyKey>` and its
`deliveryReceipts` using the established authorized Firestore read/export path.
If retries exhaust, the existing beta monitor's alert includes this exact
Firestore document path and directs inspection of `deliveryReceipts`. Account
notices have no inbound lead; the alert does not link to `/admin/leads/`.
An enqueued record or provider acceptance is not evidence of inbox delivery.
Do not invoke the pump manually or fall back to Gmail after a provider error.

## October 14 incident and scope

The delegated verified evidence records 11 October 14 Terms notices sent by
external Gmail API HTTPREST calls with bare From/Reply-To
`nijel@tryblueprint.io`, minimal paragraph HTML, and a Nijel/Blueprint signoff.
The October 12 scene-ready message used the hello display name, reply route,
logo, and branded wrapper. No original selection export/query or roster provenance
was found for those eleven recipients. Their existence as recipients does not
prove they were actual account holders, and a current roster could not recreate
the historical selection. This release does not certify or reconstruct it. No dedicated Terms/account-notice producer was found
in the current WebApp source at `bcfd8d4d`.

This entry point closes the missing reusable app path and the repo instructions
direct future account notices to it. It cannot intercept unrelated external
Gmail tools. No October 14 notice is re-enqueued, resent, or scheduled by this
change, and no test mail is sent.

## Sender picture is separate

The body logo, From display name, and recipient mail client's circular sender
avatar are separate. Read-only inspection on October 14 found a configured
photo on the connected `nijel@tryblueprint.io` Google profile. There is no
evidence that the photo was removed, and the received-copy avatar cause remains
unverified. Sending application mail through Resend does not establish that
Gmail will show that Google profile photo for `hello@`.

If the owner wants the circular avatar changed, inspect the hello sender's
Google identity/profile and the recipient's sender card separately. Any account
security, DNS/BIMI, credential, or paid plan change needs separate approval.
Do not change those settings or promise an avatar from a body-template release.
