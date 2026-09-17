# The Pipeline completion-record contract

**Status:** the webapp side is built and tested. The Pipeline side has no
implementation. Until it does, a real evaluation run is released at expiry
rather than billed, and the team never learns what it showed.

This document is the thing to hand whoever owns `BlueprintCapturePipeline`.

## Why this is a document and not a pull request

The execution Pipeline lives in a repository this one cannot change. That is an
ownership problem rather than a product boundary — somebody has to own the whole
transaction — but it does mean the contract has to be written down and agreed
rather than merged.

What this repo owns and has already built:

- `POST /api/internal/pipeline/agent-run-results` — what the run showed
- `POST /api/internal/pipeline/agent-run-settlements` — what the run cost
- `server/utils/pipelineCompletionRecord.ts` — the record's schema and rules
- `server/tests/pipeline-completion-conformance.test.ts` — the release gates

Both routes sit behind the Pipeline sync signature. That is deliberate: if
settlement were on a team's own authenticated surface, an agent could close its
own reservation for zero and get the work free.

## The current state, stated plainly

| Thing | State |
|---|---|
| Endpoints | Live, signed, tested |
| Caller | Does not exist |
| Consequence | Runs execute, holds expire, nothing is billed, no result is delivered |
| Revenue | Structurally zero, even when work happens |

This is the binding constraint on the business. Everything else in the funnel is
downstream of it.

## The record

One event, two views. The Pipeline should not be asked to decide twice what
happened, so it emits one completion record and both routes consume it
idempotently. The authoritative shape is `completionRecordSchema`; the fields
that need justifying:

### `episodes_billable` is separate from `episodes_run`

Because the published billing rule is that a failed attempt is billable and a
failure of ours is not:

> The robot dropping the box is a result, and you pay for it. An environment
> that will not launch is not a result, and you do not.

Only the Pipeline knows which is which. **Do not let us infer it from a count.**
An episode that is both our fault and the team's bill is a contradiction the
contract refuses rather than clamps — if `episodes_billable` plus
`infrastructure_failures` exceeds `episodes_run`, one of those numbers is wrong
and we cannot tell which.

### `infrastructure_failures` is itemised, not counted

So a bad week for our environment does not read as a bad policy. The reason
string per episode is what makes that separable afterwards.

### Three version fields are required

`checkpoint_version`, `scene_version`, `scoring_version`.

A measured capability band belongs to a checkpoint, an embodiment, a scene
version, a task definition and a scoring version — not to a team in general.
A result that cannot name its own inputs cannot be invalidated later when one of
them turns out to have been wrong, and `measured` is the top of the grade ladder:
nothing outranks it, so an unattributable one is permanent.

### `result_manifest_uri` is required

A result that is asserted rather than inspectable is not a deliverable.

## The six release gates

These are **gates, not experiments**. Paid execution must not depend on
discovering afterwards whether settlement works. Each is implemented in
`server/tests/pipeline-completion-conformance.test.ts`.

| # | Case | Required outcome |
|---|---|---|
| 1 | Zero episodes execute | Entire reservation released; explicit non-execution result |
| 2 | 37 valid episodes against a $25 screening quote | $18.50 settled, $6.50 released |
| 3 | The policy fails the task | Failure recorded, valid attempts billed |
| 4 | Blueprint's environment fails | Affected attempts excluded from billing |
| 5 | Completion delivered repeatedly | One financial resolution, one logical result |
| 6 | The team stops calling the API | Reservation still resolves without its return |

Case 2 the cap-and-prorate logic already handled. **Case 5 it did not**, and
that is worth being specific about, because it is the one a reasonable
implementation gets wrong.

## Case 5, in detail

A settlement is keyed on the reservation, so the ledger dedupes a retry of the
*same* call. What was unhandled was a second, *different* resolution of one
reservation: a timeout releasing the hold, and a late completion then settling
it. `deriveBalance` booked every settle unconditionally, so that sequence
charged real money against a hold that had already been handed back — and
`availableUsd` clamps at zero, so the breach surfaced as a balance that stopped
moving rather than as a number anyone could read.

It is now one resolution per reservation, first one wins:

- The late settlement is **absorbed**, not charged. `absorbedUsd` reports what
  we took on rather than dropping it silently.
- The **result is still recorded.** Financial finality and evidence retention
  are different things, and a late result is still a result.
- `overdrawnUsd` reports any excess the clamp would otherwise hide. It should
  always be zero; if it is not, an invariant has failed.

Ledger replay is also ordered now. `readEntries` queries without an `orderBy`,
and Firestore answers those in document-id order — the ids are
`team:kind:reservation`, so for one reservation they sorted `release` before
`reserve` before `settle`. A reservation could be resolved before it was taken.
"First resolution wins" is meaningless without a defined order, so the order is
now stated rather than inherited from a key format.

## What the Pipeline should do, in order

1. Emit a completion record per reservation when a run finishes, valid against
   `completionRecordSchema`.
2. `POST` it to `agent-run-results`, then to `agent-run-settlements`. Either
   order works and both are idempotent; a failure of one must not prevent the
   other, because a run that settles and never reports is billed and invisible,
   while one that reports and never settles is free and visible. Both are
   recoverable and neither can break the other.
3. Retry on failure. The reservation is the idempotency key on both sides, so a
   delivery you never saw acknowledged cannot charge twice.
4. Do not infer completion from elapsed time or a `started` status. An
   authorised adapter reading genuine Pipeline outcome records is acceptable;
   guessing is not.

## What we owe the Pipeline in return

- The reservation id, at dispatch, as the only identifier both sides key on.
- A quote (`quotedUsd`, `quotedEpisodes`) so partial execution can be pro-rated
  rather than argued about.
- A 6-hour reservation TTL, after which we release and mark the run `abandoned`.
  A record arriving after that is still accepted and still recorded; it is the
  money that is final, not the evidence.
