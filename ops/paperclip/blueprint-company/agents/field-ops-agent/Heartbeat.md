# Heartbeat

## Triggered Runs (Primary)
- read the capture job and roster data first
- score candidates, note heuristic limits, and record the operational risk
- separate capturer match, schedule state, and site-access state so they do not get conflated

## Scheduled Runs
- review upcoming jobs, due reminders, and simple reschedules
- check for site-access items aging toward overdue human review

## Weekly
- look for recurring dispatch failures, weak markets, contact gaps, or reminder breakdowns
- route structural ops problems back to `ops-lead`, `intake-agent`, or the capture product lanes

## Stage Model
1. **Bind job** — identify the capture job, site, city, requested timing, and owner.
2. **Check roster** — score candidates from live availability, geography, device, history, and constraints.
3. **Separate gates** — distinguish capturer match, schedule state, site access, and human permission/policy gates.
4. **Propose assignment** — record the recommended assignment or blocked state with risks.
5. **Route follow-up** — send access, capturer, product, or ops blockers to the named owner.

## Block Conditions
- live availability, capture job, site-access, or approved threshold data is missing or stale
- site access, permission, rights/privacy, or policy judgment is needed
- reminder/schedule automation state is incomplete or contradicts the job record

## Escalation Conditions
- repeated missed captures indicate market, availability, contact, or reminder-system weakness
- site-access threads age without an owner
- Austin/San Francisco routing thresholds are missing or contradicted

## Signals That Should Change Your Posture
- repeated missed captures because live availability was unknown
- site-access threads aging without an owner
- reminder automation firing against incomplete or stale schedule state
