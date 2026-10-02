# Blueprint first-contact outreach rules

Owner direction: 2026-09-30, clarified 2026-10-02. Canonical repo policy for outreach drafts and their
pre-send review. This change authorizes no messages, invitations, or activation.
Existing approval, suppression, sender, recipient, rights, and commercial controls
continue to apply. A passing quality check is never permission to send.

## Five rules

1. Start with a verified connection, introduction, or shared community where
   possible. Record the source and who verified it. Never invent a relationship.
   Shared community membership does not imply familiarity, referral, or endorsement.
   Use a known connection when available; no exhaustive network search is required.
2. For a cold approach, reference one specific public detail and explain why it
   is relevant. Retain the source, confirm it concerns the recipient, and separate
   observed facts from hypotheses. A plausible URL alone does not verify a claim.
3. Introduce "I'm building Blueprint" and briefly explain the honest purpose of
   helping businesses explore where robots could fit into their operations. Use
   a useful concrete observation when supported, or honestly explain what you are
   learning about the workflow. A real offer has a clear scope in natural language.
   Keep detailed evidence limitations, hypotheses and unknowns in internal review
   metadata; do not dump "hypothesis only/cannot establish" disclaimers or offer
   a generic research brief just to fill contract fields. Do not promise
   private research access, robot fit, reconstruction, deployment success, or
   other unsupported capabilities or outcomes.
4. Ask one easy, non-confidential question first. Do not default to a questionnaire,
   meeting, calendar link, upload, video, private operational data, or multi-part
   request. A later capture/intake step requires the recipient's choice to continue.
   Tailor that question to the verified site state: unknown interest → ask whether
   how the task/workflow is handled without assuming manual work or robotics interest; expressed interest → ask
   about the learning goal; pilot → ask about an unresolved uncertainty; existing
   deployment → ask about expansion learning without assuming expansion plans.
   Retain the recipient/site-specific public signal and its source for any claimed
   interest, pilot, or deployment state. Do not invent motivation or status, or ask
   “what prompted your interest” without evidence of expressed interest. These are
   directions, not rigid templates; adapt the question to the site and recipient.
5. Let the recipient decide whether a deeper conversation is worthwhile. Reject
   pressure, invented urgency, implied obligations, or assumed future engagement.

## Agreed discovery-to-outcome approach

Use this approach together with the five first-contact rules:

**Discovery preference:** web research and verified business contact routes lead.
Network mining is stopped. LinkedIn may help verify a role; it is optional and is
never a prerequisite to legitimate cold contact. Only relationships actually
claimed in a message require verified connection evidence. For a cold draft,
`noVerifiedConnectionReason` can simply state that no known verified relationship
is available; it is not evidence that a network search was performed or required.

1. Research the **site, job/task, and robot team jointly**. Lead discovery from a
   site's recurring job while assessing team feasibility in parallel. Record
   public source evidence and the gaps on both sides. Team feasibility can remain
   pending; do not substitute a team marketing claim for a confirmed fit.
2. **Disclose Blueprint identity from first contact:** “I’m building Blueprint.”
   Do not pose as academic research, imply a large established company, approach as an
   independent researcher, or imply a third party endorses Blueprint. Keep the
   actual sender identity and existing sender policy intact.
3. Keep **interest in talking**, **agreement to evaluation participation**, and
   **confirmed deployment capacity** distinct. A reply, useful public research,
   willingness to learn, or consent to evaluate does not establish the others.
4. Offer a bounded **readiness/learning brief** where useful. This is a learning
   artifact, distinct from a qualified match and the qualified-match fee. It
   does not certify readiness, promise deployment, or trigger a match fee merely
   because someone replies, provides information, or participates in evaluation.
5. Build a **progressive job brief**: ask one easy job question first, then gather
   the smallest relevant detail after the recipient chooses to continue. Request
   footage and detailed operating information later, with purpose and limits
   explained. Do not turn first contact into intake or a questionnaire.
6. Obtain **site permission before sharing** a job brief, site identity, footage,
   or operational information with robot teams. Scope consent to the material,
   recipients, and use. Interest in talking or evaluating is not sharing consent.
7. Before promising a qualified match, the **team confirms the actual
   configuration, support, and timing**, alongside the site's requirements and
   permissions. Neither public research nor an advisory brief establishes this.
8. Base evaluation claims on inspectable evidence; make introductions with the
   parties' consent. Gather physical-outcome feedback with consent and provenance
   so later learning reflects what happened. Advisory or simulated results never
   certify a physical outcome. Reject unverified Atlas/pipeline capability claims.

These are research, drafting, and review instructions. This change creates no
matching platform, evaluation runner, CRM, consent datastore, fee collection,
introduction sender, or physical-outcome ingestion feature. Later permissions,
participation, capacity, evaluation, and outcome gates require their existing
owner-system evidence; the first-contact contract cannot grant them.

## Current integration and limits

The existing facility prospect path is:

- [Agent draft](../server/agents/tasks/outbound-outreach.ts): `outbound_outreach`.
- [Ops routes](../server/routes/admin-outbound-prospects.ts):
  `POST /api/admin/outbound-prospects/:prospectId/draft` drafts only;
  `POST /api/admin/outbound-prospects/:prospectId/send` validates and queues edited text.
- [Action executor](../server/agents/action-executor.ts): queue admission,
  `approveAction`, and `retryFailedAction` validate prospect outreach. The existing
  admin-only `POST /api/admin/leads/action-queue/:ledgerId/approve` still releases it.
- [Typed contract and pure validator](../server/agents/outreach-review.ts).

Prospect outreach always requires human approval. The writer's
`requires_human_review` or confidence cannot waive it. Invalid drafts fail before
the prospect route queues them; direct executor callers stay pending. Approval
also requires the separate five-rule and workflow semantic attestation below. Legacy queued
prospect drafts lacking the contract cannot be released. Failed sends require a
stored review that still matches their recipient, text, contract, and evidence.
Prospect scope accepts single-email actions only; campaign or other action types
cannot use one recipient's review to authorize another recipient or channel.

The separate [GTM first-touch review](../server/utils/exactSiteHostedReviewFirstTouch.ts),
[GTM send executor](../server/utils/gtmSendExecutor.ts), and
[city-launch send executor](../server/utils/cityLaunchSendExecutor.ts) do not call
this validator. The policy and agent instructions govern review there; these new
machine checks do **not** enforce those separate lanes. Transactional, support,
intake, permission requests, and recipient-requested follow-up emails are outside
this first-contact integration. No LinkedIn automation is added.

This is a repo implementation with hermetic tests, not proof of deployed/live
enforcement. No runtime, provider configuration, keys, schedules, or send enablement
changes are part of it.

## Draft contract

`outreachReviewContractSchema` defines `blueprint.outreach.v1`:

- `senderIdentity`: body text disclosing the Blueprint affiliation before the offer.
- `opening`: cold detail (`claim`, public `source` URL), `relevance`, and
  `noVerifiedConnectionReason`; or a connection/introduction/community `kind`
  and `claim` matching operator-recorded `connectionEvidence`.
- `value`: an `observation` or `research_brief`, its `offer`, and its `limits`.
- `question`: the single initial question, ending in `?`.
- `recipientChoice`: the explicit choice to continue or leave it there.
- `workflow`: `site_led_discovery`, a `readiness_learning` brief, and a
  `job_brief_question`; parallel team feasibility is `pending` or `public_research`
  with sources matching recorded `teamObservations`.
- `capabilityClaims`: normally empty. Any Atlas/pipeline mention requires the
  exact claim/source in operator-recorded `verifiedCapabilities` with a verification
  source, excerpt, verifier, and timestamp. Metadata cannot verify additional prose.

The sender identity, opening claim, relevance for cold contact, offer, limits, question, and
recipient choice must appear verbatim in the body. Value/scope anchors may be
short natural phrases already in the body, not a required disclaimer paragraph.
The communications brief's seeded learning question is guidance for first contact,
not mandatory wording; the chosen question remains anchored in the contract and
requires semantic review against the known task/site state. The opening precedes the
offer/question. Metadata cannot stand in for language the recipient actually sees.
Warm evidence includes `kind`, `claim`, `source`, `supportingExcerpt`, `verifiedBy`,
and `verifiedAt` (ISO timestamp); operators record this when creating the prospect.
The model cannot add verification to the authoritative prospect record.

### Communications saved-output recovery

The communications API uses its own single return shape and writing guidance;
it does not embed the legacy outreach task's second JSON shape. Definition v2
describes honest Blueprint purpose, specific public detail, supported useful
observation and one contextual workflow question. The exact historical v1
instructions remain in `communications-instructions.ts` for completed turns.
Changing guidance never changes a saved request digest, source/check date or
the recorded meaning of an earlier turn. After review, the runtime owner must
update the saved communications definition and its instructions digest for
future requests; this repository change does not perform that live update.

`communications-output.ts` requires the exact reviewed raw SHA256 before adapting
informational extensions, and only at
`outreachContract` and `outreachContract.opening.publicDetail`. All other schema
errors and control/approval fields still fail. The canonical review contract
retains its existing claim/source/body anchors and required human-review flag.
Extra metadata never upgrades source classification, freshness, consent or
approval. An adapted result always remains a human-reviewed draft; it cannot be
substituted into the automatic first-contact compiler.

The server persists `blueprint.communications-output-source.v1` on the existing
job as `outputSource`: original raw output text, SHA256/byte count, normalized
metadata JSON-pointer paths, stable job/budget-admission IDs, original request
digest, provider session/root-turn/final-item provenance, definition version /
instructions digest and usage digest. Raw JSON preserves every extra field and
its original value. Rejected output keeps the same evidence rather than losing
it. These records are private standard JSON under
`blueprintCommunications/default/jobs/<jobId>` and can be exported using the
existing authorized Admin SDK/company-store path; no new account, credentials,
public ACL or model-provider delivery copy is required.

The existing authenticated admin/CSRF retry route retains the same job, create
claim and attempt budget. For an explicit reviewed artifact, trusted runtime
code can call `recoverSavedCommunicationsDraft(jobId, rawOutputSha256, deps)`
after that retry. Configure the existing `CommunicationsAgentsAPI` with
`allowPaidInference: false` and its existing `recordPaidDraftUsage` callback;
set `reviewedSavedOutputDigest` to the same SHA256 for any metadata adaptation.
Ordinary strict output needs no adaptation; the helper still verifies its hash.
This lane only reads an existing bound session and completed root turn. It
cannot create input, cancel a turn or automatically send, including before
the usual inference deadline. Changed artifact/bindings or incomplete output
remain blocked. All current identity, handoff, source, suppression, used-fact,
body and semantic-review checks remain required. A retry alone does not grant
approval, enable worker spending or release an email.

Completed-turn usage is recorded against the original reservation/request/day
before output parsing. Accounting is idempotent and never fabricates zero cost;
missing usage retains the unresolved reservation. Human approval and any later
send remain separate, with current send-time checks owned by communications.

Offline framing examples, including generic brief/disclaimer and false-claim
negative controls, are in `server/tests/fixtures/communications-writing-evals.json`.
They are semantic review/eval cases, not runtime phrase or length filters. No
paid model comparison is part of this repair. The actual saved artifact must
also be replayed and its private byte hash verified before production recovery.

`POST .../:prospectId/send` accepts `{subject, body, outreachContract}`. Copy the
agent's `outreach_contract` to `outreachContract` and update its anchors for any
text edits. The route takes evidence from the stored prospect, never the send
request. Both draft and queue responses expose `outreachReview`: blockers,
`hardChecksPassed`, a digest, and the five-rule plus workflow review prompts. Use the **queue
response digest** for approval, since it covers the edited text and normalized
recipient. A hard-check pass only means the draft is structurally reviewable.
The existing action-queue GET response also exposes `outreach_review` for prospect
rows, so an approver can recover the current digest and checklist from the ledger.

## Pre-send review

An authorized admin reviews the exact queued subject/body and source records, then
checks the six items in the existing Admin Leads approval card and selects
**Approve outreach**. The card displays the exact recipient/message and evidence,
disables approval for invalid drafts, and resets checks when the draft digest
changes. Other lanes retain their existing approval UI.

For the API workflow, supply this body to the existing action-queue approval route:

```json
{
  "outreachSemanticReview": {
    "digest": "<64-character digest from the queue response>",
    "checks": {
      "connection": "pass",
      "evidence": "pass",
      "boundedValue": "pass",
      "easyQuestion": "pass",
      "recipientChoice": "pass",
      "workflow": "pass"
    }
  }
}
```

Each decision is `pass`, `revise`, or `block`; only all six `pass` decisions permit
the existing approval flow to proceed. Missing, rejected, or stale attestations
leave the item pending without calling the mailer. The authenticated approver and
review time are recorded separately in the ledger; model output cannot supply
these approval fields. The digest changes if the recipient, subject, body,
contract, or recorded evidence changes. Retry checks the stored attestation.

| Code enforces | Authenticated reviewer must establish |
| --- | --- |
| Required typed contract and recorded evidence | Source authenticity, currency, recipient identity, and every factual claim's support |
| Blueprint identity anchor before the offer | Affiliation is clear from first contact and actual sender identity is truthful |
| Cold detail matches a stored observation and has an HTTP(S) URL | Detail is actually public, meaningful, and relevant; hypotheses remain qualified |
| Warm kind/claim matches recorded verification fields | Source proves the connection/introduction/membership and wording implies no endorsement |
| Offer, limits, and recipient-choice text appear in the body | Value is small, useful, task-specific, deliverable, and bounded; choice is unpressured |
| One `?`, an anchored question, and explicit prohibited-pattern checks | One genuinely easy question tailored to verified site state, with public-signal provenance for claimed interest/pilot/deployment; no invented motivation/status, compound ask, confidential request, questionnaire, or default meeting |
| Site-led learning/job-question contract, recorded team research, and exact Atlas/pipeline claim references | Separate talking/evaluation/capacity signals; learning vs qualified-match fee; later site-sharing consent, team configuration/support/timing, evidence-backed evaluation and consensual introduction/outcome feedback |
| All five rule decisions plus workflow review pass, and digest matches | Honest review of the exact message before the existing separate send approval |

Pattern checks reject explicit meeting/questionnaire, video/confidential requests,
pressure/guarantees, unverified connection wording, and shared-community endorsement
wording, plus explicit discovery-stage match/capacity and prior-sharing claims.
They are limited lexical checks: they cannot understand every paraphrase,
prove sources, or detect every unsupported assertion. The mandatory semantic review
is what rejects those failures when the structural checks pass. No paid model/API
grader is used.

## Synthetic example

The following is a test fixture, not a verified prospect or send-ready message:

> Your public careers page describes a packing station. That relates to our
> question about a bounded packing job. I'm building Blueprint. I can share a short packing-job research
> brief. It uses public sources only and cannot establish robot fit. Is packing
> a relevant job to discuss? You can decide whether any deeper conversation is useful.

Keep source evidence internal to the review packet; never include private
verification records in the recipient's message.

## Bounded automatic first-contact exception

The founder authorized a separate routine first-contact category on 1 October
2026. It applies only to the source-QA-approved, verified-US business-site
communications workflow and its compiled public-evidence message. It records
immutable policy/contact/source/payload authority rather than fabricating a
human semantic attestation. Unknown interest is valid; pilot readiness and a
buying signal are not prerequisites. Discovery volume does not establish permission to send.

All other drafts, replies, follow-ups, sensitive/unusual communications,
commitments and pricing retain their existing human review. Robotics-company
contacts remain manual until a separate qualified source/recipient contract is
supported. See [the bounded first-contact policy](agents/automatic-first-contact-policy.md).
