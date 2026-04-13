---
name: City Launch Activation
project: blueprint-executive-ops
assignee: blueprint-chief-of-staff
recurring: false
---

Run the selected city launch activation handoff after founder approval.

Each run must:

- verify the founder-approved city posture exists and is still bounded to the selected city
- refresh the execution harness artifacts with `npm run city-launch:activate -- --city "<City, ST>" --founder-approved`
- route the issue bundle into the named city lanes without creating duplicate ownership or dragging routine work back to the founder
- leave one Work Queue breadcrumb and one Notion Knowledge mirror tied to the current city activation state
- keep any blocked metric or missing artifact explicit instead of marking the city as activated by narrative only

Do not:

- widen city planning beyond the selected city
- create a new city-specific agent unless a concrete capability gap is proven
- treat public launch claims, rights/privacy exceptions, or non-standard commercial commitments as routine activation work
