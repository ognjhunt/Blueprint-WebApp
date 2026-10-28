# Platform Context

## Read this before the shared block

Owner direction, 2026-10-28: simplify. Blueprint turns a site's video of one
recurring job into a simulation, runs the candidate robot policies and
embodiments in it itself, shows the site a bounded estimate, and then works
alongside a deployment company on the real site. The beta is free. The only
hard stops are privacy, rights and money; everything else is flagged and keeps
going.

The shared block below is generated from
`BlueprintCapturePipeline/doctrine/platform-context.md` and locked by
`contracts/shared-doctrine.lock.json` (`npm run doctrine:verify`). To change it,
edit that fragment and run `python3 scripts/sync_shared_doctrine.py --write`
in the Pipeline checkout; a hand edit here fails the check.

Website notes:

- Say **job** to customers; keep **task** for the technical robot action and
  its contract.
- Public figures come with their source and grade in
  `client/src/data/deploymentMarket.ts`; a figure without a source is dropped.
- Illustrations show example robots of any form; they never imply a completed
  evaluation or physical capability.

<!-- SHARED_PLATFORM_CONTEXT_START -->
## Shared Platform Doctrine

Owner direction, 2026-10-28: simplify. This short block replaces the earlier
long doctrine; git history keeps the old text for reference only.

### What Blueprint Does

A site sends a video of one recurring job. Blueprint turns the video into a
simulation of that site, runs the candidate robot policies and embodiments in
it itself, and shows the site a bounded estimate of what works. Blueprint then
works alongside a deployment company that can deliver the winning approach on
the real site. Blueprint does not rely on robot teams to run evaluations;
a technology provider supplies access or an integration only when Blueprint
cannot run a policy itself.

The journey is four steps:

1. Email and video of the job.
2. Blueprint drafts the brief from the video; the site corrects it if needed.
3. Blueprint prepares the site simulation and evaluates the candidates.
4. The site gets the result: a simulation estimate, or "held — we can't
   simulate this kind of job yet", which is counted as demand for what to
   build next.

The beta is free. Blueprint pays for preparation and evaluation inside a fixed
per-site budget. No job is refused by task kind.

### The Only Hard Stops

Fail closed only for:

- **Privacy:** people in captures are screened, and consent is respected.
- **Rights:** capture permissions, revocation, and dataset or model licenses.
- **Money:** spend stays inside its budget, and paid resources go through the
  canonical allocator.

Everything else keeps going. When something is missing, ambiguous or
unverified, flag it where the person can see it and continue the same job.
Ask at most one question at a time, inside that job. Fixing a failure means
fixing its cause; do not add a new gate, approval step, review stage or
readiness check unless it protects privacy, rights or money.

### Two Truths

- Don't make things up: no invented results, figures, customers, readiness or
  approvals. Unknown stays unknown.
- Simulation results are bounded estimates. They never certify physical
  performance or safety.

### Arm Decision Proof v1

Arm Decision Proof v1 (`arm-decision-proof-v1`) is a separate evidence
program: it tests whether a simulated decision between two frozen candidates
agrees with held-out physical trials on one fixed-arm workcell. Its protocol
lives in `BlueprintCapturePipeline/docs/arm_decision_proof_v1/` and applies
only to that program. It alone may make physical-validation claims; beta
results never enter its evidence. The historical program identifier
`free-beta-evaluated-pilot` stays readable on existing beta records.
<!-- SHARED_PLATFORM_CONTEXT_END -->
