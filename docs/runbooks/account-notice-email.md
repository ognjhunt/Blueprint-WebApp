# Blueprint account-notice email

Account/service notices, including Terms and policy updates, use the production
`CUSTOMER_JOB_EMAIL_IDENTITY`, `brandedEmail`, `captureOutbox`, and Resend
transport. From is `Blueprint <hello@tryblueprint.io>`; Reply-To is
`hello@tryblueprint.io`, whose existing Google mailbox route stays in place.
The body uses the current styled wrapper, live-text Blueprint wordmark,
`https://tryblueprint.io/brand/email-mark.png`, and company footer.
Personal founder outreach retains its existing `nijel@tryblueprint.io` path.

## Prepare and review

Save one JSON input per recipient in an ignored/private location. Example
content below is a synthetic preview, not approved legal wording or a send list:

```json
{
  "noticeId": "example-account-update-v1",
  "to": "account@example.invalid",
  "subject": "An update to your Blueprint account",
  "body": "Hi,\n\nThis is a local preview of an account notice.\n\nRead the update:\nhttps://tryblueprint.io/terms\n\n— The Blueprint team"
}
```

```bash
npm run email:account-notice -- --input /private/path/notice.json --output output/email/account-notice/review
```

Inspect `notice.html`, `notice.txt`, and `notice.json` for the complete message,
recipient, sender, reply routing, and durable intent. Preview loads no live
services and sends nothing. Plain-text copy is preserved; HTML is escaped and
rendered by the same components as scene-ready email. Sender, Reply-To and raw
HTML overrides are rejected. Use the shared team signoff in approved copy.
These artifacts contain private recipient/content data: keep them out of Git,
public assets, and unapproved destinations.

The [synthetic mobile preview](../qa/account-notice-branding-2026-10-14/mobile.png)
shows the existing production layout. Local browser checks cover desktop,
mobile, dark mode, and blocked images, with all external requests intercepted.
See the [render measurements](../qa/account-notice-branding-2026-10-14/browser-proof.json).

## Approved delivery

Only after explicit approval of the exact content and recipient list, run the
same command with `--enqueue` in an existing authorized runtime with Firebase
Admin access. This flag creates live delivery intent: the existing outbox pump
can send it immediately. Do not run it just to test branding.

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
logo, and branded wrapper. No dedicated Terms/account-notice producer was found
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
