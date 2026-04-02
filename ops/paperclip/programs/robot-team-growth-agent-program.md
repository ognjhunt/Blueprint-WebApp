# Robot-Team Growth — Current Focus

## Objective
Maintain Blueprint's reusable robot-team demand playbook so buyer-facing demand work does not restart from zero in every city or conversation.

This program turns demand-intel findings into Blueprint-specific guidance that can be reused across cities, buyer segments, and proof motions.

## Core Questions
1. What is the truthful, compelling value proposition for a robot-team buyer?
2. Which buyer segments should Blueprint prioritize first?
3. What proof pack should exist before a serious buyer conversation?
4. What hosted review motion best reflects current product truth?
5. Which funnel stages should be instrumented before more demand work is added?
6. What should city-demand plans inherit versus customize?

## Required Outputs
- update `ops/paperclip/playbooks/robot-team-demand-playbook.md`
- create or update a Notion Knowledge artifact that summarizes the current reusable robot-team growth guidance
- create or update a Notion Work Queue breadcrumb whenever human review or downstream action is required
- maintain a segment and channel matrix with:
  - buyer role
  - site / workflow need
  - proof requirement
  - evidence level
  - human dependencies
- generate issue-ready action items for:
  - `conversion-agent`
  - `analytics-agent`
  - `intake-agent`
  - `ops-lead`
  - `finance-support-agent`
  - `city-demand-agent`

## Current Priorities
1. Keep the generic robot-team playbook aligned with the live proof-path, intake, ops, and finance-routing surfaces that now exist in the repo.
2. Make sure buyer entry flows and follow-up materials lead with exact-site package value rather than qualification-first framing.
3. Keep city-specific demand planning inherited from the generic playbook without overstating Austin or San Francisco channel confidence before live tagged demand exists.
4. Define what must be measured during buyer demand work:
   - qualified robot-team inbound volume
   - time from qualified inbound to proof-pack delivery
   - time from qualified inbound to hosted review readiness
   - hosted review to follow-up rate
   - exact-site request rate
   - time to human commercial handoff
   - ops burden created by each buyer lane

## Recent Context
- As of 2026-03-30, the buyer signup and contact flows still default important paths toward `qualification`, so this program should explicitly specify the buyer-facing motion that ought to replace that default emphasis.
- As of 2026-03-30, `inboundRequests.ops.proof_path` now carries the authoritative proof-path milestone timestamps, with a mix of auto-stamped and ops-stamped fields.
- As of 2026-03-30, inbound qualification now captures proof-path preference, buyer role, site type, stack-review context, and early human-gated topics.
- As of 2026-03-30, Austin and San Francisco city plans inherit the shared proof-pack and hosted-review system, but live queue review still shows no city-tagged buyer-demand evidence for either city.
- Open downstream execution is already queued in [BLU-170](/BLU/issues/BLU-170), [BLU-175](/BLU/issues/BLU-175), [BLU-176](/BLU/issues/BLU-176), and [BLU-190](/BLU/issues/BLU-190); do not create duplicate issues unless the playbook changes again materially.

## Constraints
- Do not approve spend.
- Do not authorize discounts, pricing, or contract changes.
- Do not promise model capabilities beyond current capture/package/runtime truth.
- Keep all recommendations truthful to current Blueprint product and ops reality.
