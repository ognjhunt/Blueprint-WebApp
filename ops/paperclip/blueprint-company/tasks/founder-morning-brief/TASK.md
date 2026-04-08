---
name: Founder Morning Brief
project: blueprint-executive-ops
assignee: blueprint-chief-of-staff
recurring: true
---

Run the weekday founder awareness brief.

Execution rule:

- immediately run `npm exec tsx -- scripts/paperclip/chief-of-staff-founder-report.ts --issue-id <current-issue-id>`
- do not begin with broad queue discovery, repo scanning, manual artifact drafting, or ad hoc Paperclip API fetches unless that script fails
- if the script fails, leave one concise proof-bearing note with the failure reason before doing narrower manual recovery

Each run must:

- start with `blueprint-manager-state`
- use the freshest available prior `Founder EoD Brief | YYYY-MM-DD | Blueprint` and `Daily Accountability | YYYY-MM-DD | Blueprint` artifacts when they exist
- incorporate the freshest available analytics, ops queue, buyer-risk, and capturer-risk signals
- create or update one Knowledge artifact tagged for `Founder OS`
- post exactly one Slack digest to `#paperclip-exec`
- use the exact title format `Founder Morning Brief | YYYY-MM-DD | Blueprint`
- use these sections in this exact order:
  - `Done Yesterday`
  - `In Motion Today`
  - `Blocked`
  - `Needs Founder`
  - `Top Risks`
  - `Top Opportunities`
- enforce bullet limits:
  - `Done Yesterday`: max 3
  - `In Motion Today`: max 5
  - all other sections: max 3
- format each bullet as `[Lane] statement — owner, next checkpoint`
- avoid raw issue ids unless needed for disambiguation
- avoid links unless a blocker or founder decision truly needs drill-down

Artifact requirements:

- Knowledge title: `Founder Morning Brief | YYYY-MM-DD | Blueprint`
- Knowledge `Artifact Type`: `Morning Founder Brief`
- Knowledge `Agent Surface` must include `Founder OS`
- create or update a Work Queue follow-up only if the brief is blocked on missing evidence or failed delivery
