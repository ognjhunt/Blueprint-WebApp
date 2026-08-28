# Blueprint's pricing model

Two charges. Both paid by robot teams. The site pays nothing.

| Charge | Amount | Who pays | When |
| --- | --- | --- | --- |
| Evaluation | **$1,000** per site-task | Every robot team that runs a real evaluation | Before the evaluation |
| Selection | **$9,000** more, for a total of **$10,000** | The team selected for the pilot or deployment | On selection |

**A team that loses pays $1,000. A team that wins pays $10,000.** The
evaluation fee is part of the $10,000, not on top of it. Evaluations on tasks a
team does not win are not refunded — they consumed a real captured asset and
real site access.

There is nothing else: no percentage of the contract, no per-robot rate, no
recurring charge, no renewal. Growing a deployment from five robots to fifty
costs nothing further.

Free: anonymous listings, the envelope screen, and everything on the site side.

## Why there is no percentage of contract value

A share of contract value is not reliably collectible unless Blueprint controls
invoicing. A robot company can understate the contract, split hardware,
software and services into separate agreements, or transact off-platform —
and high-value, low-frequency deals are exactly where that pressure is
strongest.

Two flat numbers need no visibility into anyone's contract at all. Nothing in
the fee calculation takes a contract value — or a robot count — as an input.

If a percentage is ever wanted it needs a payment rail first: robot-company
invoices running through something like Stripe Connect, which can withhold an
application fee automatically. Direct charges there also leave refunds and
chargebacks with the robot company rather than with Blueprint. Until that
infrastructure is mandatory, the company is not based on reported contract
value.

## Why the site pays nothing

The site contributes the floor, the operational access and the task data —
the hardest things in this market to get. Charging the scarce side would
suppress the supply the whole market runs on.

The single exception: a site that separately hires Blueprint to run a private,
exclusive procurement. That is a different engagement from the open board and
is priced on its own.

## Why the robot team pays

Blueprint delivered it a qualified revenue opportunity and replaced its
presales and site-scoping work.

The evaluation fee is **not** a compute markup. Raw GPU on a task of this size
is a small fraction of it. What the fee buys is a captured task, a standardised
test, up to 500 episodes, the analysis, and a scored result — on a site
somebody already found, qualified and captured.

## Vendor-funded pilots

A robot team paying the site to host — for access, disruption or data — is
common, fully supported, and separate. Blueprint takes none of it, and it does
not replace Blueprint's fee.

## Settlement

For now the site and the robot team contract and pay each other directly, and
Blueprint invoices its own two fees separately. Blueprint stays out of the
commercial agreement between them.

## Worked example

A warehouse lists three site-tasks.

| Stage | What happens | Money |
| --- | --- | --- |
| Listing | Three site-tasks go on the board | Warehouse pays $0 |
| Evaluation | Four teams each evaluate all three — twelve evaluations | $12,000 to Blueprint |
| Selection | Team A is selected for one task. That task's total is $10,000, and it already paid $1,000 to evaluate it | $9,000 more from Team A |
| Team A's bill | Three evaluations, one win: $10,000 for the task it won, $1,000 each for the two it did not | $12,000 from Team A |
| Afterwards | Team A grows the deployment, renews, and pays the warehouse $20,000 to host | Nothing further |

Blueprint collects **$21,000** in total. The warehouse pays **$0**. Nobody
discloses a contract.

**The tradeoff, stated plainly:** flat numbers mean Blueprint captures nothing
when a deployment scales from five robots to fifty. That is the price of a
model both sides can verify in one sentence, and it is a deliberate choice
rather than an oversight.

## On the numbers

**These are posted starting terms Blueprint intends to test, not market rates,
and no surface may present them as an industry benchmark.**

No independent source establishes a market price for this service. The two
figures usually cited do not support one:

- Robotics-data benchmarks (dataset budgets, per-hour teleoperation rates) are
  published largely by vendors selling data collection services. They show
  robotics data can be expensive; they are not market-clearing prices.
- The customer-paid deployment fee of roughly $20,000–$25,000 comes from
  Agility's June 2026 investor materials and is explicitly illustrative inside
  one company's own model.

Public pilot announcements generally do not disclose who paid. "The robot
company paid to deploy" usually means it absorbed robot time, engineering,
travel, integration and a discounted pilot — not that the facility invoiced it
for access. There is no reliable rule that early teams pay and mature teams get
paid.
