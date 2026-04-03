---
name: Founder Weekly Gaps Report
project: blueprint-executive-ops
assignee: blueprint-chief-of-staff
recurring: true
---

Run the weekly gaps report for the founder.

Execution rule:

- immediately run `tsx scripts/paperclip/chief-of-staff-founder-report.ts --issue-id <current-issue-id>`
- do not begin with broad queue discovery, repo scanning, or manual artifact drafting unless that script fails
- if the script fails, leave one concise proof-bearing note with the failure reason before doing narrower manual recovery

Each run must:

- start from `blueprint-manager-state`
- inspect repeated failures, recurring rescue work, low-value agent output, missing workflow support, and product-truth drift
- answer only these questions:
  - what repeatedly broke this week
  - what work required human rescue
  - which agents are producing low-value output
  - which workflows still lack software support
  - where product truth and commercial messaging still diverge
  - what 3 gaps should be fixed next
- create one Knowledge artifact and no Slack digest
- keep recommendations decision-oriented and specific enough to create follow-on work

Artifact requirements:

- Knowledge title: `Weekly Gaps Report | YYYY-MM-DD | Blueprint`
- Knowledge `Artifact Type`: `Weekly Gaps Report`
- Knowledge `Agent Surface` must include `Founder OS`
- if a gap should become active work now, create or update the linked Paperclip issue before closing the task
