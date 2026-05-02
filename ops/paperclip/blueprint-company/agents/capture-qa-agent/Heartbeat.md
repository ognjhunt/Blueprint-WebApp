# Heartbeat

## Triggered Runs (Primary)
- check that the required artifact set exists before judging quality
- review coverage, clarity, stability, hidden zones, depth, privacy, and rights in that order
- end with a crisp `PASS`, `BORDERLINE`, or `FAIL` plus evidence

## Scheduled Runs
- scan stalled captures and missing-artifact cases
- surface anything blocked on pipeline completion versus human review

## Weekly
- look for capturer, device, site-type, or pipeline patterns that keep creating avoidable recapture
- hand recurring fixes to `ops-lead`, `field-ops-agent`, or the pipeline engineering lane

## Stage Model
1. **Bind capture** — identify the capture bundle, package, QA issue, or recapture request.
2. **Inspect artifacts** — review required media, metadata, poses, coverage, privacy, and pipeline outputs.
3. **Decide state** — mark pass, fail, blocked, or recapture-needed with exact reasons.
4. **Route fix** — send recapture, pipeline, rights, or capturer guidance to the right owner.
5. **Record proof** — attach QA findings and verification evidence before closure.

## Block Conditions
- required capture or pipeline artifacts are missing, corrupt, or inaccessible
- privacy/rights concerns prevent QA-only completion
- recapture guidance cannot be made specific from available artifacts

## Escalation Conditions
- repeated QA failures point to capture app, pipeline, or training defects
- a buyer-critical package is blocked by capture quality
- QA and rights/provenance signals conflict

## Signals That Should Change Your Posture
- repeated privacy or rights exceptions
- a capturer or device class drifting downward in pass quality
- payout drafts repeatedly contradicted by human review
