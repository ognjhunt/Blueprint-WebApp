# Blueprint's pricing model

Two charges. Both paid by robot teams. The site pays nothing.

| Charge | Amount | Who pays | When |
| --- | --- | --- | --- |
| Evaluation fee | **$1,000** per site-task | Every robot team that runs a real evaluation | Before the evaluation |
| Deployment fee | **the greater of $10,000 or $2,000 per robot** deployed on that site-task | The winning robot team only | On activation, topped up on expansion |

The evaluation fee for the task a team actually wins is credited against that
team's deployment fee. Evaluations on tasks it does not win are not credited
and not refunded — they consumed a real captured asset and real site access.

Free: anonymous listings, the envelope screen, and everything on the site side.

## Why there is no percentage of contract value

A share of contract value is not reliably collectible unless Blueprint controls
invoicing. A robot company can understate the contract, split hardware,
software and services into separate agreements, or transact off-platform —
and high-value, low-frequency deals are exactly where that pressure is
strongest.

Robot count is different. It is visible in the deployment and acceptance
record, and both the site and Blueprint can verify it independently. Nothing in
the fee calculation takes a contract value as an input.

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
| Award | Team A wins one task, five-robot deployment. Five robots does not clear the floor, so $10,000, less the $1,000 it paid to evaluate that task | $9,000 more from Team A |
| Expansion | Team A grows the same task to twenty robots. 20 × $2,000 = $40,000; the fee tops up rather than restarting | $30,000 more from Team A |
| Side deal | Team A pays the warehouse $20,000 to host the pilot | Blueprint takes none of it |

Blueprint collects **$51,000** across that relationship. The warehouse pays
**$0**. Nobody discloses a contract.

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
