# The robot-team agent surface

How a robot team's agent finds work, decides what is worth buying, and spends the team's money without a person in the loop.

## What changed, and why

The robot-team side had three holes.

**No way to pay.** `episodeRate`, `quoteScreening` and `episodesForBalance` existed in two files — the pricing module and the pricing page. No ledger, no top-up, no charge. A published revenue model with no collection mechanism, which mattered more the moment the site side went free and robot teams became the only payer.

**No way to be measured.** The intake asked nine questions — payload, cycle time, duty cycle, demonstrated success rate — and then ran 550 episodes measuring those exact things. We were asking teams to predict their own benchmark results, stamping the prediction `self_reported`, and letting it decide who got matched. A team's estimate of its own success rate was the worst data in the system and it was the gate to entering the registry.

**No way to act.** `runSiteMatch` asks "a site arrived, which teams clear it?" That question can only be asked when a site arrives, so a team submitted its intake and then waited indefinitely — while we already held a library of reconstructed scenes.

Closing those three left a fourth, which was the one that actually mattered: **nothing a team did could start without us.** A key came from an operator, funding came from an operator, and the intake asked four qualifying questions before any of it. The agent surface was fully autonomous downstream of three manual steps, which is another way of saying it was not autonomous.

## The loop

```
team registers itself        POST /api/agent-team/register        (no credential)
team registers a policy      POST /api/agent-team/checkpoints     (or inline above)
team sees the offer          POST /api/agent-team/plan            (free, no balance needed)
team funds itself            POST /api/agent-team/funding         (Stripe, face value)
team sets its own limits     PUT  /api/agent-team/policy
agent checks it may act      GET  /api/agent-team/me
agent buys                   POST /api/agent-team/runs            (confirm: true)
agent watches its holds      GET  /api/agent-team/runs
```

**There is no line in this diagram.** Every step is an API call a team's own agent can make, and the only thing that is not an API call is somebody paying — which is a fact about money rather than a queue.

The admin equivalents still exist (`/api/admin/robot-teams/...`) for support, for teams invoiced off-platform, and for fixing our own mistakes. None of them is on the critical path.

## No qualifying questions to register

Registration asks for a team name. That is all.

The intake's four gates — where the hardware is, where they can deploy, engineer capacity, deployment timeline — are every one of them a fact about **deploying a robot at a site**. None is needed to run a policy against a scene we already hold, and running it is what a team came for. Gating evaluation on deployment questions is a category error, and it was the entire delay: a team answered them and still could not act.

They are the right questions for a **pilot**, where somebody is about to commit real weeks. Asked then, they are due diligence. Asked at the front door, they were a queue.

### Answering nothing costs a team nothing

This is worth stating plainly because it is counterintuitive: a team that has told us nothing gets the **most** informative plan, not the worst one.

`evalSelection` scores an unknown hard constraint at 100, above a boundary run at 45, a novel task family at 35, and a plain confirmation at 10. A team we know nothing about is all unknowns, so every candidate ranks in the top band — because one run closes that question for every site that shares the constraint.

Which means the intake was self-defeating. It extracted, up front and for free, exactly the information an evaluation exists to produce and charge for. The form did not just delay the run; it competed with it.

The nine spec answers remain askable and still sharpen ranking. They are no longer a gate.

### What open registration does not grant

Nothing spendable. A registration lands at status `self_registered` with an empty capability, a zero balance and autonomous spend off.

- **The key is an identity, not a credit line.** It cannot credit itself.
- **`self_registered` is outside the matchable set.** Registration is open, so a name typed into a public endpoint must not become supply we tell a site about. A team enters that list when a run has **measured** it — `recordEvaluationOutcome` promotes it, and nothing else does.
- **A name never resolves to an existing team.** Team ids always carry a random suffix, so registering under someone else's name creates a new empty team rather than handing over a working key to theirs.

The first real payment is what proves a counterparty exists, which is why open registration is safe rather than an abuse surface.

## Funding: self-serve, at face value

`POST /api/agent-team/funding` takes `amountUsd` and returns a Stripe Checkout URL. Ask for $100, pay $100, get $100 of balance.

**No price is invented here**, which is what makes it shippable as self-serve. Run prices still come from `episodePricing` and are quoted per run; a top-up is a number the team chose, charged at face value, and that is not a commercial term anybody has to approve. Bounds are $50 (below the cost of any run we sell) to $25,000 (a decimal-point bug should not move six figures in one call).

**The credit lands on the webhook, not on the redirect.** A success URL is just a URL anyone could open; `checkout.session.completed` with `payment_status: "paid"` is the proof. The checkout session id is the idempotency key, so a redelivered event credits once. The amount credited is `amount_total` — what Stripe actually collected — never what the request metadata claimed.

An agent can create the session, hand the link to whoever holds the card, and poll `GET /me` until the balance moves. That matters because an agent running in CI has nowhere to be redirected to.

## Auth: a key, not a session

An autonomous spender is not a person, and should not inherit whatever a founder's account can do. Agent keys are per-team, revocable, and carry only two capabilities: read what the team may read, and commit spend inside the team's own policy.

The key is `bpk_` + 32 random bytes. We store a SHA-256 and **cannot recover the plaintext** — it appears once, in the issue response. A team that loses one issues another. Send it as `Authorization: Bearer bpk_...`.

What bounds an agent is the **balance**, not the policy. The only ledger entry that increases a balance is a `credit`, and a credit comes from a payment that actually landed — so an agent cannot give itself more money to spend by asking. The **policy** is pacing on top of that: a team's own daily and per-run limits, changeable at any time with the same key the agent uses.

That distinction matters because an earlier version of this document said an agent "cannot raise its own limit or top up its own balance", and both halves were wrong. `PUT /api/agent-team/policy` has always been on the agent surface, and funding is now self-serve. Treat the policy as a team pacing itself, and the balance as the thing that cannot be talked up.

## Money: reserve, then settle

The primitive is a reservation, not a charge.

| Movement | Effect |
|---|---|
| `credit` | Adds funds. The only thing that increases what a team can spend. |
| `reserve` | Leaves `available` without being spent. Two agents racing cannot both spend the last dollar. |
| `settle` | Consumes what the run actually used. The rest of the hold returns. |
| `release` | Gives a hold back whole, for a run that never happened. |

Balance is **derived by replaying the ledger**, never stored. A stored total can drift from its own history and be wrong silently; a derived one cannot.

Every entry is keyed by an idempotency key, which for an autonomous spender is not an edge case — an agent that times out and retries must not pay twice. Confirming a spend without one is refused.

This is also what `billingRules` already promised publicly: the quote is shown and reserved before a run starts, and unrun episodes are released.

## A balance is not permission

`DEFAULT_SPEND_POLICY` is off, with a zero daily limit. Funding an account and authorising an autonomous spender are two different decisions, and collapsing them loses the intent — a team funding $5,000 and capping its agent at $100 a day is saying two things.

A team switches its agent off instantly without revoking the key or touching the balance.

Refusals are named, because an agent that cannot tell "you are switched off" from "you are out of money" will retry the wrong one forever:

`agent_spend_disabled` · `no_policy_configured` · `insufficient_balance` · `over_per_run_limit` · `over_daily_limit` · `ledger_unavailable`

The day is keyed in **UTC**, so where an agent runs cannot shift the limit.

## Ranking: what a run teaches, not what it passes

Ask "which sites is this robot most likely to pass?" and you get a list of runs that teach nobody anything. The team already knew the answer and paid for it anyway.

So `evalSelection` ranks by **expected information gain per dollar**:

| Situation | Value | Why |
|---|---|---|
| Unknown hard constraint | highest | One run closes it for every future site sharing that constraint |
| Near the edge of the known envelope | high | The boundary is where a run maps something instead of confirming it |
| First run against this task family | high | Not predictable from results already held |
| Comfortable pass, familiar task | lowest | Close to predictable |
| Already answered for this checkpoint | **refused** | A second copy of a number we have |
| Ruled out on a measured constraint | **refused** | Buying a confirmation of failure |

The last two are refused rather than scored low, because a low score still gets bought on a large budget.

Every selected row carries a `rationale` and every skipped one a named `skipReason`. A team should be able to read its agent's reasoning and disagree with it.

**This is arithmetic, not an agent.** Every input is a number we already hold, and a model asked to rank these would produce a plausible ordering nobody could audit — and would be tempted by exactly the pass-rate heuristic the module exists to reject.

## Settlement: nobody has to remember

A hold used to be attached to a promise rather than to a record. `POST /runs` reserved money and returned reservation ids, and **nothing existed that could conclude a run** — so a hold sat there until a person read the ledger and released it by hand. `teamEvalCandidates` read an `evaluationRuns` collection that nothing wrote, so "already answered" never fired either.

Every unit test involved passed the whole time, because the ledger was never the broken part. Nothing called it.

`agentEvalRuns` closes it in three pieces:

1. **A run record, written when the hold is taken.** Keyed `run_<reservationId>`, so a retried confirm rewrites the same run and the Pipeline can name a run from the only identifier both sides agreed on.
2. **A due time, not a flag.** `settlementDueAtMs` is the expiry when the hold is taken, zero the moment an outcome is reported, and **deleted** once the money has moved. The reconciler's query is a range over that field, so a finished run cannot match it. Scanning `moneyResolved == false` instead would let a hundred young holds crowd out the one that expired an hour ago.
3. **Expiry releases the hold.** A run that reports nothing at all gives its money back and is marked `abandoned`. So the worst case is a team **un-billed** for work we cannot prove happened — which is the right direction for that error to point.

Resolution runs in two places, deliberately:

- **On the team's own next call.** `requireTeam` reconciles that team's due holds before any route reads a balance. The agent short a stale hold is the caller who asks next, so its own call clears it — no clock to switch on, no other system to remember.
- **On a schedule**, as the `agent_run_settlement` lane, for teams whose agents went quiet and where nobody will ask on their behalf.

Both share one idempotency key per reservation, so whichever gets there first wins and the other is a no-op.

### The Pipeline's fast path

`POST /api/internal/pipeline/agent-run-settlements` is how a hold is resolved *promptly* — the Pipeline finishes a run, calls it, and the balance frees within the second. It is no longer what makes resolution *certain*. A Pipeline deploy that forgets this endpoint now costs latency, not money.

It is **Pipeline-signed, not agent-authenticated** — if it sat on the agent surface a team could settle its own reservation for zero and get the work free.

It records the outcome **before** moving any money, so a ledger failure leaves the run durable and due rather than waiting on a retry that may never come.

**It caps the settlement at the quote.** `deriveBalance` books a settle at face value and does not clamp it to the hold, so a wrong `rate_usd` from the Pipeline came out of a team's balance as real spend, past what their agent authorised. The quote is the ceiling: a partial run is pro-rated against it, and no number reported from outside can charge more than was agreed.

It is deliberately separate from the evaluation-run schemas next door. Those carry the *result* of the work; this carries what the work *cost*. Coupled, a change to either schema could silently stop money moving.

The split follows the published rule:

- **Episodes executed** → settled for what they cost, whatever the robot did in them. A robot dropping the box is a result, and results are the product.
- **Nothing executed** → the whole hold is released, not settled at zero, so the ledger records what happened rather than a spend of nothing.
- **Fewer episodes than quoted** → settled for what ran; the rest returns automatically.

Keyed on the reservation rather than the delivery attempt, so a Pipeline retry cannot charge twice.

## Dry run by default

`POST /runs` without `confirm: true` returns the plan and spends nothing. An agent that forgets the flag pays with a JSON read, not a bill.

Each selected run is authorised **separately** rather than as one lump, so a team that can afford three of five gets three runs and a named reason for the other two — instead of an all-or-nothing refusal that tells the agent nothing about what to try next.

## Checkpoints replace the spec form

Registering a checkpoint asks for a label, a runtime (`policy_endpoint`, `container_image` or `model_artifact`), and a reference. **It asks for no capability figures at all.**

`GRADE_RANK` already put `measured` above `self_reported`, and `mergeCapability` already refused to let a worse grade overwrite a better one — but nothing in the codebase ever wrote `measured`. `recordMeasuredCapability` does. Once a run writes it, the team's own estimate for that field stops winning, permanently, with no migration and no deletion.

Two things are still asked, because no episode measures them: **where they can deploy**, and **whether the hardware exists**. Both are facts about a business rather than a robot.

The intake's nine spec questions are now marked for what they are.
`supersededByMeasurement` flags the seven a run establishes better than a team
can — payload, human proximity, cycle time, duty cycle, demonstrated success
rate, lighting and object handling. They stay askable, because a team with no
runs yet has nothing else and a datasheet figure beats no figure, but they are
identifiable as placeholders rather than facts.

The two left unmarked are the two no episode can settle: `budgetBand` is a
commercial fact about the business, and `taskFamily` is a declaration of what
the robot is for. Marking those superseded would promise a measurement we
cannot make.

## What was deliberately not deleted

An earlier first-principles pass proposed deleting the `provisional` match state and the capability-refresh loop. Tracing the code showed both were wrong:

- **`provisional` is load-bearing for the new ranking.** `unknownHardConstraints` is exactly what `evalSelection` scores highest. Deleting it would gut the most valuable signal in the system.
- **`robotCapabilityRefresh` writes `published`-grade evidence as proposals a human promotes**, not direct writes. That is real sourced evidence from spec sheets, and a run supersedes it automatically through the grade ladder. Deleting it would force paid runs to learn what a datasheet already states.

## A correction to an earlier version of this document

It said an agent "cannot raise its own limit or top up its own balance", and both halves were wrong. `PUT /api/agent-team/policy` has always been on the agent surface, and funding is now self-serve too.

The honest framing is in **A balance is not permission** above: the **balance** is the hard ceiling, because the only entry that raises it is a `credit` and a credit needs a payment that actually landed. The **policy** is a team pacing itself, changeable at any moment with the same key its agent uses. Useful precisely because it is not the thing stopping a runaway.

## Still open

- **The Pipeline does not call settlement yet.** It should, and the endpoint is waiting for it. This is no longer a money problem — expiry and the per-call reconciliation resolve every hold without it — but until the Pipeline reports `episodes_run`, a run that really did execute gets released rather than billed. We under-charge instead of locking funds, which is the safe failure but still a wrong one.
- **Nothing on our side schedules a team's agent.** "Give it $100 a day" means the team's own agent runs on its own schedule and our limits bound it. That is deliberate — we should not be driving someone else's compute — but it is worth knowing the loop is theirs.
- **No end-to-end timing.** Nothing measures how long a run takes from authorisation to result.
- **The public robot-team page still reads as a form-first journey.** The mechanism is now checkpoint-first; the copy at `/for-robot-teams` has not caught up, and until it does a team arriving through the website will still fill in gates it no longer needs.
