---
name: Founder EoD Brief
project: blueprint-executive-ops
assignee: blueprint-chief-of-staff
recurring: true
---

Run the weekday founder end-of-day brief.

Execution rule:

- immediately run `npm exec tsx -- scripts/paperclip/chief-of-staff-founder-report.ts --issue-id <current-issue-id>`
- do not begin with broad queue discovery, repo scanning, or manual artifact drafting unless that script fails
- if the script fails, leave one concise proof-bearing note with the failure reason before doing narrower manual recovery

Each run must:

- start with `blueprint-manager-state`
- use the freshest available `Daily Accountability | YYYY-MM-DD | Blueprint` artifact when it exists
- stay grounded in what actually moved today, what slipped, and what needs founder attention tonight or tomorrow morning
- create one Knowledge artifact tagged for `Founder OS`
- post exactly one Slack digest to `#paperclip-exec`
- use the exact title format `Founder EoD Brief | YYYY-MM-DD | Blueprint`
- use these sections in this exact order:
  - `Done Today`
  - `Slipped`
  - `Blocked Tonight`
  - `Needs Founder`
  - `Watch Tomorrow Morning`
- enforce bullet limits:
  - `Done Today`: max 5
  - `Slipped`: max 3
  - `Blocked Tonight`: max 3
  - `Needs Founder`: max 3
  - `Watch Tomorrow Morning`: max 3
- format each bullet as `[Lane] statement — owner, next checkpoint`
- keep the first section compact and executive-readable; only mention drill-down details when they change a founder decision

Artifact requirements:

- Knowledge title: `Founder EoD Brief | YYYY-MM-DD | Blueprint`
- Knowledge `Artifact Type`: `EoD Founder Brief`
- Knowledge `Agent Surface` must include `Founder OS`
- create or update a Work Queue follow-up only if the brief is blocked on missing evidence or failed delivery
