# The robot-team agent surface

How a robot team's agent finds work, decides what is worth buying, and spends the team's money without a person in the loop.

## What changed, and why

The robot-team side had three holes.

**No way to pay.** `episodeRate`, `quoteScreening` and `episodesForBalance` existed in two files — the pricing module and the pricing page. No ledger, no top-up, no charge. A published revenue model with no collection mechanism, which mattered more the moment the site side went free and robot teams became the only payer.

**No way to be measured.** The intake asked nine questions — payload, cycle time, duty cycle, demonstrated success rate — and then ran 550 episodes measuring those exact things. We were asking teams to predict their own benchmark results, stamping the prediction `self_reported`, and letting it decide who got matched. A team's estimate of its own success rate was the worst data in the system and it was the gate to entering the registry.

**No way to act.** `runSiteMatch` asks "a site arrived, which teams clear it?" That question can only be asked when a site arrives, so a team submitted its intake and then waited indefinitely — while we already held a library of reconstructed scenes.

## The loop

```
operator issues a key        POST /api/admin/robot-teams/:teamId/agent-keys
operator funds the team      POST /api/admin/robot-teams/:teamId/credit
operator sets limits         PUT  /api/admin/robot-teams/:teamId/policy
                             ── from here the agent runs alone ──
agent checks it may act      GET  /api/agent-team/me
agent registers a policy     POST /api/agent-team/checkpoints
agent plans                  POST /api/agent-team/plan
agent buys                   POST /api/agent-team/runs   (confirm: true)
```

Everything before the line needs a person. Everything after it does not.

## Auth: a key, not a session

An autonomous spender is not a person, and should not inherit whatever a founder's account can do. Agent keys are per-team, revocable, and carry only two capabilities: read what the team may read, and commit spend inside the team's own policy.

The key is `bpk_` + 32 random bytes. We store a SHA-256 and **cannot recover the plaintext** — it appears once, in the issue response. A team that loses one issues another. Send it as `Authorization: Bearer bpk_...`.

An agent cannot raise its own limit or top up its own balance. Those routes are operator-only, which is the entire reason the spend policy lives outside the key.

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

## Dry run by default

`POST /runs` without `confirm: true` returns the plan and spends nothing. An agent that forgets the flag pays with a JSON read, not a bill.

Each selected run is authorised **separately** rather than as one lump, so a team that can afford three of five gets three runs and a named reason for the other two — instead of an all-or-nothing refusal that tells the agent nothing about what to try next.

## Checkpoints replace the spec form

Registering a checkpoint asks for a label, a runtime (`policy_endpoint`, `container_image` or `model_artifact`), and a reference. **It asks for no capability figures at all.**

`GRADE_RANK` already put `measured` above `self_reported`, and `mergeCapability` already refused to let a worse grade overwrite a better one — but nothing in the codebase ever wrote `measured`. `recordMeasuredCapability` does. Once a run writes it, the team's own estimate for that field stops winning, permanently, with no migration and no deletion.

Two things are still asked, because no episode measures them: **where they can deploy**, and **whether the hardware exists**. Both are facts about a business rather than a robot.

## What was deliberately not deleted

An earlier first-principles pass proposed deleting the `provisional` match state and the capability-refresh loop. Tracing the code showed both were wrong:

- **`provisional` is load-bearing for the new ranking.** `unknownHardConstraints` is exactly what `evalSelection` scores highest. Deleting it would gut the most valuable signal in the system.
- **`robotCapabilityRefresh` writes `published`-grade evidence as proposals a human promotes**, not direct writes. That is real sourced evidence from spec sheets, and a run supersedes it automatically through the grade ladder. Deleting it would force paid runs to learn what a datasheet already states.

## Still open

- **Settlement is not wired.** Reservations are taken when runs start; nothing calls `settleReservation` when the Pipeline reports a run finished. Until that lands, holds must be released manually via `POST /runs/:reservationId/release`. This is the next thing to build.
- **Funding is operator-only.** `creditTeam` is idempotent and takes an external reference, so the ledger is ready for Stripe. The top-up SKU and its price points are a product decision nobody has made, and shipping a payment flow on an invented price would be worse than an operator crediting a beta team.
- **No end-to-end timing.** Nothing measures how long a run takes from authorisation to result.
