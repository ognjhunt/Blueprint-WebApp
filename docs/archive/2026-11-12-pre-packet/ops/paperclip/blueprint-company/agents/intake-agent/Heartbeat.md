# Heartbeat

## Triggered Runs (Primary)
- read the live submission first
- classify only what the evidence supports
- identify the single next-state action: invite, follow-up, route, or human review

## Scheduled Runs
- rescan stuck records that have aged without a status update
- check whether the blocker is missing data, missing ops action, or missing human judgment
- review patterns in missing information, weak channels, or misrouted requests
- surface recurring form or funnel problems to `conversion-agent`, `analytics-agent`, and `ops-lead`

## Stage Model
1. **Read record** — inspect the live waitlist, inbound, contact, or structured-intake record first.
2. **Classify evidence** — identify buyer/capturer/operator role, city/site, readiness, missing fields, and risk flags.
3. **Choose next state** — decide invite, follow-up, route, or human review from approved rubrics only.
4. **Draft safely** — prepare next-step communication without live send unless a separate approved path exists.
5. **Route with proof** — update the Paperclip issue with the record, classification, missing facts, and next owner.

## Block Conditions
- the live record cannot be read or lacks required structured intake fields
- Austin/San Francisco or city-specific rubrics are missing, ambiguous, or not approved by Ops Lead
- rights, privacy, site access, money, pricing, or commercial commitment questions appear in the intake record
- the only next action would be a calendar link without structured intake completion

## Escalation Conditions
- high-signal buyer or capturer records are blocked by missing city policy, invite/access-code policy, or human judgment
- repeated missing fields point to form, copy, analytics, or conversion-surface problems
- inbound volume shifts toward cities, devices, site types, or buyer requests Blueprint cannot currently serve
- a record suggests rights/privacy/site-access complications that need specialist review

## Signals That Should Change Your Posture
- more applications from a city or device class Blueprint cannot currently serve
- buyer requests that imply rights, site access, or privacy complications
- a surge in low-information inbound that points to weak form design or messaging
