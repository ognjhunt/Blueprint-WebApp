# Platform Context

> Repo-authoritative mirror of Blueprint platform doctrine. Reconcile material changes with Blueprint Knowledge.

<!-- SHARED_PLATFORM_CONTEXT_START -->
## Shared Platform Doctrine

### System framing

- `BlueprintCapture` collects immutable, provenance-linked real-site evidence.
- `BlueprintCapturePipeline` owns the versioned Site-Task Testbed manifest, Decision/Evidence Request, Evidence Plan, Evidence Method Profile, normalized Evidence Result, Decision Envelope, and Physical Outcome Join. It owns method qualification, routing, aggregation, and scientific verdicts.
- `Blueprint-WebApp` owns authenticated intake, request validation, idempotency, entitlement and authorization, durable queue/outbox state, status projection, artifact access, redacted presentation, and operator workflows.
- `BlueprintValidation` remains optional downstream infrastructure.

Blueprint is capture-first and real-site-task first. Raw capture, timestamps, poses, device metadata, rights/privacy records, and provenance remain authoritative. Derived geometry, simulation, generated media, provider output, and runtime artifacts do not silently upgrade the claim.

### One customer-facing product

Blueprint sells one product: **Task Evaluation Run**.

The maintained Site-Task Testbed is the reusable substrate behind runs. Robot teams and site operators are personas using the same service, decision request, workflow, result model, pricing concept, and call to action. Post-training is only a permitted use of qualifying evidence inside a run; it is not a SKU, add-on, navigation item, checkout flow, or delivery promise.

The normal customer describes the site-task, decision, candidates when applicable, claims, thresholds, false-safe consequence, acceptable risk, budget, deadline, available evidence, rights/privacy restrictions, and physical-testing constraints. The WebApp does not ask ordinary users to choose a simulator, world model, or provider.

### Decision and evidence router

Pipeline routes every decision-relevant claim to the least expensive currently qualified combination of fixture data, geometry, real observations, traditional simulation, world models, provider tools, and physical evidence. It escalates only when stronger evidence is required.

A valid run outcome may be:

- bounded positive;
- bounded negative;
- elimination of an incompatible candidate;
- partial decision;
- explicit abstention;
- blocked or failed;
- a request for the next evidence needed.

A run does not guarantee ranking, shortlist, winner, deployment, pilot readiness, physical success, or safety approval. Unknown future states fail closed. An abstained result never implies a winner from raw scores.

### Result contract

Buyer-facing results expose the requested decision, per-claim outcomes, selected methods and selection reasons, measurements, validation envelope, unsupported conditions, coverage, uncertainty, disagreements and correlated-evidence warnings, claim ceiling, next cheapest experiment, physical-evidence requirements, cost/time when available, exact artifact versions and digests, and permitted evidence uses.

An evidence export does not prove training happened or a policy improved. Physical outcome ingestion requires authoritative evidence and exact join identifiers; a user note alone cannot recalibrate a method.

### Product stack

1. supply and truth layer: real-site capture, rights, privacy, and provenance;
2. reusable substrate: maintained Site-Task Testbeds;
3. single buyer product: Task Evaluation Runs;
4. evidence support: geometry, real observations, simulation, world models, provider tools, and physical outcomes;
5. access support: hosted review, licensing, entitlements, and operator workflows.

### Commercial and compatibility rules

- One run is scoped and quoted according to decision, evidence, candidates, scenarios, compute, deadline, rights, and physical requirements.
- The server owns authoritative pricing. The client cannot supply it.
- No new subscription, standalone evidence package, improvement add-on, or vendor submission fee.
- Historical data, URLs, transactions, and entitlements remain readable through explicit compatibility paths.
- Legacy paid or customer-visible intent is never silently reinterpreted.
- Live provider, physical robot, deployment, payment, rights, calibration, and customer claims require proof from the system that owns them.

### Practical rule for agents

Optimize for stronger capture truth, stable versioned testbeds, secure decision intake, Pipeline-authoritative evidence routing, honest decisions or abstentions, explicit claim ceilings, and maintained learning from authoritative physical outcomes. Do not move scientific routing or scoring into WebApp.
<!-- SHARED_PLATFORM_CONTEXT_END -->
