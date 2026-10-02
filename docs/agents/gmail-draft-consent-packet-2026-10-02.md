# Gmail draft copy — concrete owner decision

**Blocker title:** Separate Gmail compose consent and one draft-only copy.
**Blocker ID:** `BP-BLOCKER-GMAIL-DRAFT-20261002`.
**Workstream:** 2, communications / ADP partner outreach review. Observed blocker:
Gmail draft creation requires compose scope; the installed founder binding has
read-only plus send scope. Completion artifact: an exact-revision, readback-
verified Gmail `DRAFT` delivery copy, with canonical company records preserved.

**Why blocked:** OAuth expansion and a real mailbox draft write need the owner's
explicit permission. This packet is prepared; consent and draft writes remain
disabled. The existing send grant is not message-send authorization. Google
`gmail.compose` permits managing drafts **and sending**, so Google's consent
cannot itself express draft-only use. Blueprint's stopped send controls and
separate message approvals remain necessary.

**Recommended answer:** Approve adding only `gmail.compose` to the current
founder read/send grant, then create one Gmail draft copy of Tony's exact
current saved revision. Retain the existing grant's other scopes; do not add
`gmail.modify`, full-mail access, another mailbox or another client.

**Alternative:** Continue reviewing/editing the same draft in Blueprint's
Approvals tab, with no OAuth change and no Gmail draft copy.

**Downside:** Gmail's compose capability includes sending even though this
implementation uses only draft create/update/get/list. Gmail may rewrite draft
transport metadata; exact recipient, body/footer, subject and Blueprint
identity headers must pass readback before reporting verified. Unknown create
acknowledgements remain unresolved until that exact draft appears; they cannot
trigger another create.

**Exact response needed:** “Approve the separate compose consent for
nijel@tryblueprint.io and one draft-only Gmail copy of Tony's preserved revision
6554668d42ff72712f4d656afaeaedb0c2590dfb2956afe1fa510faec28d118d;
do not send or resume schedules.” The founder completes Google's consent in
the existing authenticated owner browser. No secret value is entered in chat.

**Execution owner after reply:** This audit's communications owner, with Nijel
Hunt completing the Google account consent. Channel target for this packet is
this current owner chat; no Slack/email was dispatched.

**Immediate next action after reply:** Record the reply on this blocker, install
its separate non-secret approval reference, and prepare the existing client
browser flow at `/api/communications/gmail/oauth/draft-upgrade/start` and
`/draft-upgrade/complete`. Fixed registered callback remains
`https://tryblueprint.io/api/communications/gmail/oauth/callback`. Exact profile
and founder sender checks run before encrypted binding replacement. The flow
compares the existing binding revision atomically and retains its prior
encrypted credential in the flow's private recovery record. Draft writes remain
off until the owner-authorized manual request below.

**Deadline/checkpoint:** Before the first Gmail draft write; this is not a
scheduled task. Resume only after the actual owner reply, deployed disabled
code and verified existing OAuth registration. Disallowed workarounds: reuse
ops credentials, environment-token scope assumptions, browser cookies,
mailbox switching, auto-consent, blind retry after an uncertain token exchange,
or treating compose/send consent as approval to send.

**Evidence:** Existing Firestore reads on 2026-10-02 verified Tony's job
`8bd2e1ad55b127866236c5ffd0872a59f6434ed378fa9dea319a53daedf8f0d0`,
ledger `communications_8bd2e1ad55b127866236c5ffd0872a59f6434ed378fa9dea319a53daedf8f0d0`,
and the revision above at `2026-10-02T07:23:09.614Z`. Both remain
`pending_approval`. Review digest:
`26fecd10fcecd41f900ab4e4b1a0ff73c0002557bc9df00d1819ec546e3bd725`;
full payload digest:
`65c5c7d753daa0adad770c09d3e2902bcb662a9540fab4a631484a17ea8f91af`.
Recipient matches the preserved Tony draft. Approved footer is unchanged,
hard checks pass, blockers are empty, immutable revision exists. Approval,
execution attempts, send receipt and Gmail draft ID are absent/zero. The
retained founder credential metadata is v2, exact founder mailbox, encrypted,
with `gmail.readonly` and `gmail.send`; no compose scope. This executor lacks
founder client configuration, so no live inbox/sent readback is claimed.

Safe metadata-only proof reads the exact credential document and canonical
job/ledger/revision/send-receipt IDs above, prints only version/scope names,
matching identity booleans and content digests, and never decrypts a credential,
polls Gmail, starts consent or changes provider state. Export/recovery uses the
existing canonical Firestore documents and immutable revision history; Gmail
IDs are optional delivery references. The installed stopped-worker flags
remain independently verified by the release coordinator.

A safe metadata-only proof command with the existing ADC is:

```bash
node --input-type=module <<'JS'
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
const db=getFirestore(initializeApp({credential:applicationDefault()},'draft-metadata-proof'));
try {
  const id='8bd2e1ad55b127866236c5ffd0872a59f6434ed378fa9dea319a53daedf8f0d0';
  const refs=['communicationsGmailCredentials/communications-founder-gmail',`action_ledger/communications_${id}`,`blueprintCommunications/default/jobs/${id}`];
  const [credential,ledger,job]=await Promise.all(refs.map(ref=>db.doc(ref).get()));
  console.log(JSON.stringify({readonly:true,credentialVersion:credential.data()?.version,scopes:credential.data()?.scopes,founderMailboxMatches:credential.data()?.mailbox==='nijel@tryblueprint.io',ledgerState:ledger.data()?.status,jobState:job.data()?.state,revisionId:ledger.data()?.draft_revision_id,executionAttempts:ledger.data()?.execution_attempts??0,approvalPresent:Boolean(ledger.data()?.approved_by||ledger.data()?.approved_at),writes:0,sends:0}));
} finally { await db.terminate(); }
JS
```

After approval, the exact manual draft-copy request is:

```json
{
  "expectedReviewDigest": "26fecd10fcecd41f900ab4e4b1a0ff73c0002557bc9df00d1819ec546e3bd725",
  "expectedRevisionId": "6554668d42ff72712f4d656afaeaedb0c2590dfb2956afe1fa510faec28d118d",
  "mode": "write"
}
```

It targets `/api/admin/leads/action-queue/communications_8bd2e1ad55b127866236c5ffd0872a59f6434ed378fa9dea319a53daedf8f0d0/gmail-draft`
under existing authenticated admin/CSRF controls; `/api/admin/leads` is the
verified mount in `server/routes.ts`. Draft flag
`BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFTS_ENABLED` defaults off; the separate
`BLUEPRINT_COMMUNICATIONS_GMAIL_DRAFT_APPROVAL_REF` must match the reviewed
compose credential. No flags were installed by this implementation.

The adapter copies the existing transport bytes, checks canonical revision,
research handoff, opt-outs and send receipts, checks relevant prior contact
excluding draft copies, and claims a fenced attempt before Gmail mutation.
Changed canonical input or a manually changed prior Gmail copy refuses an
update. A later explicit revision updates the same confirmed draft ID;
identical replay reads it. SDK write retries are disabled. Unknown create/update
recovery is observation-only, by the stable Blueprint RFC Message-ID or exact
draft ID plus content headers. A writer that genuinely ended needs its exact
attempt and process-ended evidence before observation recovery; no expiry can
admit a second creator.

**Non-scope:** No email send, automatic first contact, other recipient, paid
inference, regeneration of Tony's draft, resumed research/communications
schedule, mailbox-wide content extraction, approval checkbox, evaluation/pilot
agreement, default learning test write or credential transfer. No draft deletion
is part of rollback: stop the draft flag and retain the canonical binding,
uncertain attempt and prior encrypted credential for reconciliation.

Primary API references:
[Draft creation](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/create),
[draft listing](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.drafts/list),
[Google scope definitions](https://developers.google.com/workspace/gmail/api/auth/scopes).
