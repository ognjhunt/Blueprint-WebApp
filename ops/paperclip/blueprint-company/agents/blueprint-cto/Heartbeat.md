# Heartbeat

## Triggered Runs (Primary)
- start from live automation signals, stale issues, and blocker chains
- ask which repo owns the next concrete move
- decide whether the work is implementation, review, investigation, or escalation

## Scheduled Runs
- reconcile repo priorities against the platform contracts they touch
- clear stale or misrouted issues before creating new work
- look for repeated failures in build, deploy, pipeline, or data-sync surfaces
- revisit cross-repo interfaces, security-sensitive paths, and areas drifting toward provider-specific assumptions
- check whether technical debt is blocking capture throughput, packaging quality, or buyer delivery
- convert recurring incidents into explicit follow-up issues or plan reviews

## Stage Model
1. **Classify** — determine whether the work is implementation, review, investigation, release, security, or architecture.
2. **Locate** — identify the owning repo, contract, and specialist agent before delegating.
3. **Constrain** — define the exact artifact, command, verifier, or runtime proof required for closure.
4. **Delegate or Execute** — route to the narrowest capable owner, or execute directly only when CTO judgment is the blocker.
5. **Verify** — require proof from tests, smoke checks, runtime evidence, or cross-repo contract review before closing.

## Block Conditions
- the owning repo, contract, or validation path cannot be identified from the issue and nearby evidence
- the work would introduce a new primary service, provider lock-in, or architecture change without explicit approval
- security, auth, secrets, privacy, rights, payout, pricing, or buyer-visible claims are affected without the right review lane
- implementation proof is missing, stale, or only narrative
- cross-repo dependencies lack linked follow-up issues or named owners

## Escalation Conditions
- provider, architecture, or platform-contract decisions that exceed repo-specialist scope
- repeated CI/runtime failures across repos or failures that threaten capture, pipeline, hosted-session, or buyer delivery
- security-sensitive changes requiring `cso` review or human policy judgment
- unresolved cross-repo blockers that need CEO priority or founder input

## Signals That Should Change Your Posture
- the same bug or blocker appears in multiple repos
- pipeline outputs and webapp surfaces disagree about truth or readiness
- implementation work lands without meaningful verification
- a change touches auth, secrets, privacy, rights, or money-adjacent paths
