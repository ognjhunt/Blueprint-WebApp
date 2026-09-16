# Outbound prospects

How Blueprint approaches a site first, and why the machinery stops where it does.

Inbound is a site that found us and filled in the form. Outbound is us
deciding a facility is worth approaching and saying so. They differ in exactly
one way that matters — **who asserted the facts** — and everything after the
reply is deliberately the same code.

## The loop, by hand

Six routes under `/api/admin/outbound-prospects`, all `admin`/`ops` only. One
lists what you have; the other five are the loop below.
There is no UI. Twenty facilities can be chosen by a person and twenty replies
read by a person, and doing it that way first is how you find out what an agent
should eventually do.

| Step | Route | What a person does |
|---|---|---|
| 1 | `POST /` | Record a facility, with a source behind every claim |
| 2 | `POST /:id/draft` | Agent writes the email; nothing is sent |
| 3 | — | **Read it.** Check each sentence against `observations_used` |
| 4 | `POST /:id/send` | Post the approved text back — **this queues it** |
| 4b | `.../action-queue/:ledgerId/approve` | Release it. Now it goes out |
| 5 | `POST /:id/convert` | A reply arrives; record what they actually stated |
| 5b | `POST /:id/close` | Or they said stop, or it bounced |

Step 3 is not a formality. `OUTBOUND_PROSPECT_POLICY` sets
`autoApproveCriteria: () => false` and `alwaysHumanReview: () => true`, so
there is no configuration in which a cold email leaves without a person having
read it.

## `send` does not send

Read this before running a batch. Because the policy always requires review,
`executeAction` writes a ledger entry and returns `pending_approval` rather
than handing anything to the mailer. **Nothing has left yet.**

The route returns `sent: false` and the exact release path:

```
POST /api/admin/leads/action-queue/<ledgerDocId>/approve
```

Two things to know about that step:

- It requires the **`admin`** role. The outbound routes accept `admin` or
  `ops`, so an ops-only operator can draft and queue but cannot release.
- A `202` on its own reads like "sent". It is not. The failure this guards
  against is an operator believing they contacted twenty facilities when they
  contacted none — which looks identical to twenty people ignoring you, and
  would teach exactly the wrong lesson.

`POST .../action-queue/:ledgerId/reject` takes a reason and discards it.

## Why the draft and the send are separate routes

The draft route returns text. The send route takes text **in the request
body**. They are not chained, because one route that drafted and sent would
mean nobody ever saw what went out — which is the single failure mode an
outbound beta exists to avoid.

It also means the operator can edit. The text that ships is the text a person
approved, not the text a model produced and a person skimmed.

## The hard rule: nothing unsourced leaves the building

`guardProspectSend` refuses a send on any of:

| Blocker | Why |
|---|---|
| `email_missing` | No usable address |
| `email_suppressed` | They opted out — **including when the list cannot be read** |
| `prospect_closed` | They asked us to stop |
| `already_contacted` | A beta sends once |
| `hypothesis_missing` | Nothing specific to say; a generic pitch burns the address |
| `no_sourced_observations` | The hypothesis rests on nothing checkable |
| `unsourced_observation` | A claim with no source behind it |

The suppression lookup **fails closed**. Not knowing whether someone opted out
is not permission.

`unsourced_observation` is the one worth dwelling on. The repo already refuses
to publish a public figure without a primary source. An email asserting
something about a stranger's building is the same claim with a higher cost of
being wrong: a hallucinated detail is checkable in one second and never
forgotten. The agent prompt says the same thing, but the guard is what enforces
it — the prompt is the second line of that defence, not the first.

## The draft route runs the guard before it spends a model call

Only `already_contacted` is allowed through, because rewriting a message nobody
approved is legitimate. `prospect_closed` is a **separate blocker for exactly
this reason**: if closing reused `already_contacted`, the draft route's
allowance would let you write to someone who had opted out.

## A guess can start a conversation. It can never qualify a site.

This is the whole safety property.

Outbound gate answers are inferred — we looked at a building type and guessed.
They land in the same `siteTaskGates` map an operator's answers land in, which
is why `client/src/lib/gateProvenance.ts` exists. Without provenance, a guess
is indistinguishable from a statement one function call later, and the thing at
the end of that chain spends money: it sends a capturer to an address or
commits a paid reconstruction.

So `decideCaptureDispatch` holds on `gates_inferred`. Absent provenance means
`operator_stated`, which is correct for every inbound request and everything
stored before outbound existed — shipping the field did not freeze the existing
funnel.

This is the fourth instance of a door the codebase already builds the same way.
`applyNarrativeReview`, `credibleVideoContradictions` and
`clampRecommendationToGates` all move a verdict downward and never upward.

## What `convert` actually tells you

Provenance is **per field**, because a reply corrects some answers and not
others. Someone who writes back "actually we run two shifts" has stated one
gate and left the rest inferred, and treating the whole request as
operator-stated would be the same error at a smaller scale.

So `convert` takes `statedGates` — the gates the operator *actually addressed*
— and returns the real dispatch decision, computed with the same
`triageGateAnswers` and `decideCaptureDispatch` the inbound path uses:

```json
{
  "dispatch": false,
  "holdReason": "gates_inferred",
  "detail": "Still resting on inferred answers: sceneStability, accessWindow. ..."
}
```

That hold reason **is the follow-up email**. Two named questions, not a shrug.
Running the decision rather than describing it also means the preview cannot
disagree with what eventually happens.

The payload is returned rather than posted onward. During the beta a person
carries it into the intake, so the conversion is observed twenty times before
anything does it unattended.

## Closing writes a suppression entry, not just a stage

The footer unsubscribe link handles the person who clicks it. Almost nobody
does. What actually arrives is a one-line reply saying take us off your list,
and without somewhere to put it that request lives in someone's memory until it
does not.

`POST /:id/close` writes the suppression entry **before** the stage, because
the other ordering can leave a prospect looking handled while still being
sendable. If the suppression write fails the route returns `503` and the
prospect stays open.

Scope is `growth_campaign`: we will not approach you again. If the facility
later becomes a customer, the lifecycle mail it has asked for is a different
scope and is untouched.

## The ask is a video, not a meeting

The email asks them to film one work area for about 45 seconds. Not a call, not
a demo, no calendar link.

Self-capture made that the smallest useful ask, and it returns something real —
a reconstruction of their own station and a comparison of which robots can do
the job — without anyone talking first. A booked call is days of calendar
latency in front of a fifteen-minute pipeline.

`serviceArea` is the one gate that does not bind under self-capture (see
`bindsForCaptureModes`), because our service area is a fact about our driving
rather than about their room. Outbound is therefore not restricted to Austin.

## Why the send goes through `executeAction`

Suppression, the CAN-SPAM footer, content checks, the idempotency ledger and
daily caps already live there. Outbound gets them by joining the existing lane,
not by reimplementing them. `idempotencyKey` is
`outbound_prospect_send:<prospectId>`, so a retried request cannot produce a
second email.

## Deliberately absent

Not oversights. Each is a thing that should be built *after* someone has done
it by hand twenty times, because building it first means automating something
nobody has produced once.

| Missing | Why it waits |
|---|---|
| Lead discovery | Nobody has hand-picked twenty facilities yet, so there is no target to learn |
| Sequences / drip | A beta sends once. A follow-up cadence before a single reply is guessing at an objection nobody has raised |
| Reply classification | Twenty replies can be read. Reading them is how you learn what the categories are |
| Bounce ingestion | Handled by `close` for now; worth automating at a volume where nobody can read them |
| A UI | Five routes and twenty rows. A UI now would encode a workflow we have not tested |

## Configuration

| Variable | Effect |
|---|---|
| `OUTBOUND_OUTREACH_MODEL` | Model for the drafting agent, per provider |
| `VITE_PUBLIC_APP_URL` / `APP_URL` | Origin for the unsubscribe link |

Prospects live in the `outboundProspects` Firestore collection. Suppressions
live in `email_suppressions`, shared with every other lane.
