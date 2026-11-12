---
name: Founder Friday Operating Recap
project: blueprint-executive-ops
assignee: blueprint-chief-of-staff
recurring: true
---

Run the weekly founder operating recap.

Execution rule:

- immediately run `npm exec tsx -- scripts/paperclip/chief-of-staff-founder-report.ts --issue-id <current-issue-id>`
- do not begin with broad queue discovery, repo scanning, or manual artifact drafting unless that script fails
- if the script fails, leave one concise proof-bearing note with the failure reason before doing narrower manual recovery

Each run must:

- ground on `blueprint-manager-state`, the latest analytics weekly output, and the latest ops and growth signals
- consume the latest weekly gaps and daily accountability artifacts when they help explain what actually shipped versus what only moved on paper
- produce one Knowledge artifact tagged for `Founder OS`
- post exactly one Slack digest to `#paperclip-exec`
- use the exact title format `Friday Operating Recap | YYYY-MM-DD | Blueprint`
- use these sections in this exact order:
  - `Shipped`
  - `Improved`
  - `Slipped`
  - `Risks Going Into Next Week`
  - `Next Week's 3 Bets`
- enforce bullet limits:
  - `Shipped`: max 5
  - all other sections: max 3
- keep every bullet concrete, owner-clear, and grounded in real work or real metrics
- if the recap includes a founder decision or permission request, render that line as the founder decision packet from `ops/paperclip/programs/founder-decision-packet-standard.md`

Artifact requirements:

- Knowledge title: `Friday Operating Recap | YYYY-MM-DD | Blueprint`
- Knowledge `Artifact Type`: `Friday Operating Recap`
- Knowledge `Agent Surface` must include `Founder OS`
- include one recap bullet that points at the separate weekly gaps report when it exists
