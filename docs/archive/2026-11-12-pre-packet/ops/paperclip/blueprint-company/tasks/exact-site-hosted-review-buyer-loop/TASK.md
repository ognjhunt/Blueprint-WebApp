---
name: Exact-Site Hosted Review Buyer Loop
project: blueprint-webapp
assignee: growth-lead
recurring: true
---

Run the narrow buyer loop that makes the Exact-Site Hosted Review wedge useful during every new city launch.

This is not a broad growth routine. It exists to turn each city launch into real robot-team customer contact density with as little manual interaction as possible.

## Operating Shape

- one wedge: Exact-Site Hosted Review
- one buyer: robot teams evaluating real deployment sites
- one ledger: `ops/paperclip/playbooks/exact-site-hosted-review-gtm-ledger.json`
- one daily dashboard: `npm run gtm:hosted-review:buyer-loop -- --write --allow-blocked`
- one city-launch artifact: `ops/paperclip/reports/city-launch-execution/<city>/latest/city-opening-<city>-buyer-loop.md`
- one manual gate: founder approval for the first recipient-backed buyer send batch

## Required Work

- add or refresh explicit robot-team target rows until the active batch reaches 30-50 target accounts
- finish recipient-backed contact evidence for at least the first 12 targets, then expand toward 30-50
- keep each target row tied to buyer, evidence source, message path, approval state, send receipt, reply state, and next action
- keep 2-3 proof artifacts or capture asks ready before any scale claim
- keep durable reply plumbing visible with `npm run human-replies:audit-durability`
- generate the buyer-loop report after target, contact, approval, send, reply, call, hosted-review, capture-ask, or blocker changes
- during city launch, use the generated buyer-loop artifact as the only sales status page for robot-team demand

## City Launch Integration

Every launch activation must produce:

- city-opening send ledger
- city-opening execution report
- exact-site buyer-loop artifact
- robot-team contact list
- reply-conversion queue

First buyer sends should be drafted automatically and held with `approvalState=pending_first_send_approval`. Agents can research, draft, log, route, and follow up. The founder must approve, edit, or reject the first live buyer send batch so the learning is not abstracted away.

## 14-Day Decision Rule

After 100 recipient-backed touches or day 14, do not extend the same motion by default. Decide whether to continue, change ICP, change offer, change proof artifact, change CTA, or stop.

## Progress That Counts

- target added
- recipient-backed contact added
- founder approval recorded
- send receipt recorded
- reply ingested
- objection classified
- qualified call scheduled or completed
- hosted-review start recorded
- capture ask created
- blocker made explicit with owner and next action

Internal summaries that do not move one of those states do not count.
