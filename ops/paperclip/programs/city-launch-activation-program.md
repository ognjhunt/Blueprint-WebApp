# City Launch Activation Program

## Mission
Turn the founder-approved playbook for the current focus city into an executable operating harness without adding new primary services or new permanent city-specific agents.

The city launch only counts if both loops are operationally real:

- Supply loop: find local capturers, qualify them, run real first captures, QA them, clear rights/provenance, and publish 1-2 proof-ready city assets.
- Demand loop: identify city-relevant robot-team buyers, deliver proof packs and hosted reviews tied to exact sites, and move a small number of conversations into serious follow-up.

## Activation Rule
Do not activate this program until the founder approves:

1. the current focus city as an active launch
2. the bounded city posture: gated cohort pilot, Exact-Site Hosted Review wedge
3. the spend posture
4. any source-policy exception beyond the approved city channel stack

Before approval, the harness may prepare artifacts and issue bundles, but the org stays in planning mode.

## Autonomy-First Execution Rule

After founder approval, activate every named city lane at once.

Do not treat the following as reasons to leave lanes idle:

- missing source policy packet
- missing ops rubric / trust kit / first-capture thresholds
- missing lawful-access confirmation
- missing proof-motion telemetry
- missing proof-ready assets or hosted reviews

Those are completion dependencies, not start dependencies.

Execution rule:

- every lane must execute all reversible research, drafting, implementation, routing, and internal/external preparation immediately
- lanes stop only at irreversible human gates, external counterparty confirmations, or the absence of a real live signal needed to mark the task complete
- do not fake lawful access, proof assets, hosted reviews, rights clearance, spend approvals, public claims, or non-standard commercial commitments
- do not wait for a different lane's packet to exist before starting the best available approach for the current lane

## Required Repo Artifacts

- `docs/city-launch-system-<city-slug>.md`
- `ops/paperclip/playbooks/city-launch-<city-slug>-execution-issue-bundle.md`
- `ops/paperclip/playbooks/city-capture-target-ledger-<city-slug>.md`
- city launch scorecard from `/api/admin/leads/city-launch-scorecard`
- city deep-research playbook from `npm run city-launch:plan -- --city "<City, ST>"`

## Execution Owners

- `growth-lead`: city source policy, invite/access-code posture, outbound approvals
- `ops-lead`: city intake rubric, trust kit, first-capture thresholds, launch-readiness checklist
- `city-launch-agent`: city supply-side operating packet and dependency map
- `city-demand-agent`: city demand-side operating packet and target ledger
- `capturer-growth-agent`, `intake-agent`, `capturer-success-agent`, `field-ops-agent`, `capture-qa-agent`, `rights-provenance-agent`: supply execution lanes
- `demand-intel-agent`, `robot-team-growth-agent`, `outbound-sales-agent`, `buyer-solutions-agent`, `revenue-ops-pricing-agent`: buyer and commercial execution lanes
- `analytics-agent`: city scorecard and blocker visibility
- `notion-manager-agent`: Notion Knowledge and Work Queue mirrors
- `beta-launch-commander`: switch-on readiness review

## Founder Scope

Founder remains in:

- city go / no-go
- spend envelope
- posture-changing public claims
- rights/privacy exceptions that set precedent
- non-standard commercial commitments

Founder does not stay in routine city invites, access-code issuance, intake approval, first-capture thresholds, proof-pack quality confirmation, or standard buyer-thread handling.
