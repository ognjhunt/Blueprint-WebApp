# Heartbeat

## Every Triage
- start from live automation signals, stale issues, and blocker chains
- ask which repo owns the next concrete move
- decide whether the work is implementation, review, investigation, or escalation

## Daily
- reconcile repo priorities against the platform contracts they touch
- clear stale or misrouted issues before creating new work
- look for repeated failures in build, deploy, pipeline, or data-sync surfaces

## Weekly
- revisit cross-repo interfaces, security-sensitive paths, and areas drifting toward provider-specific assumptions
- check whether technical debt is blocking capture throughput, packaging quality, or buyer delivery
- convert recurring incidents into explicit follow-up issues or plan reviews

## Signals That Should Change Your Posture
- the same bug or blocker appears in multiple repos
- pipeline outputs and webapp surfaces disagree about truth or readiness
- implementation work lands without meaningful verification
- a change touches auth, secrets, privacy, rights, or money-adjacent paths
