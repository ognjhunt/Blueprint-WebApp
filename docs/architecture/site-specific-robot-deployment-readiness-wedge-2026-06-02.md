# Site-Specific Robot Deployment Readiness Wedge

Date: 2026-06-02

Status: Active PMF wedge doctrine. As of 2026-06-03, the public implementation expresses this wedge as the Real-Site Robot Eval Dataset v0.1 story: Site Card, Task Cards, Scenario Cards, Eval Cards, annotation backlog, and proof boundaries.

## Summary

Blueprint-WebApp's first PMF wedge is a **real-site robot evaluation dataset and workflow** for site-specific robot deployment decisions.

The public buyer question is:

> Before I bring this robot into my facility for a long expensive pilot, how likely is it to hit my required success rate, cycle time, intervention rate, and safety threshold on my actual tasks?

The site may confidently sell this category, workflow, and request path. It must not invent operational robot-readiness proof.

## What Blueprint Sells Publicly

- Site Card, Task Cards, Scenario Cards, Eval Cards, annotation backlog, and proof boundaries for one real facility, task suite, and robot profile.
- Deployment readiness advisories and pre-pilot readiness estimates as support-layer interpretations of the cards.
- Capture-backed site packages that ground the advisory.
- Hosted evaluation and buyer review rooms when entitlement, package, and runtime proof supports them.
- Failure-mode reports, site modification recommendations, training/post-training data requirements, short-pilot protocols, and vendor comparisons when scoped.

## What Remains The Substrate

Readiness does not replace the platform doctrine. It sits on top of:

- lawful indoor capture
- capture provenance, timestamps, poses, device/context metadata, and freshness
- rights, privacy, consent, and restricted-zone boundaries
- site package manifests and export limits
- hosted-session artifacts where available
- explicit missing-proof labels

Blueprint remains capture-first and real-site robot-evaluation/policy-improvement first. The WebApp readiness wedge is a buyer-facing commercial workflow, not a claim that qualification is the universal center of the company.

## Wedge Buyers

- Robot vendors selling into industrial sites.
- Site operators evaluating robots or vendors.
- Integrators helping customers avoid failed pilots.

## First Wedge Use Cases

- Tote transfer.
- Cart-to-conveyor.
- Line-side delivery.
- Shelf/bin interaction.
- Inspection routes.
- Gauge, valve, and equipment-state checks.

Avoid initial public claims around broad general humanoid capability, complex dexterous assembly, high-risk human-adjacent autonomy, medical/surgery, and unrestricted home tasks.

## Public Visual Posture

Use humanoid robot scenes as the default public robot visual for this wedge. Good visuals show a humanoid robot inside a specific indoor site, with the surrounding task, route, obstacles, fixtures, bins, carts, shelves, doors, docks, or equipment visible enough for the buyer to understand what readiness is being evaluated.

Generated humanoid imagery may show the product category and buyer workflow. It must not be presented as live robot-trial proof, safety validation, customer deployment proof, cleared rights, or proof that a specific robot is ready to deploy. Generated readiness dashboards, route maps, score bands, and proof boards are sample/advisory UI unless owner-system evidence exists for that request.

Non-humanoid robot visuals should be scoped to pages that explicitly discuss another robot class. They should not become the default public posture for the readiness wedge.

## Allowed Public Category Claims

- Blueprint helps robot teams and site operators evaluate deployment risk before a costly pilot.
- Blueprint turns capture-grounded site/task evidence into real-site robot eval datasets and card-backed workflows.
- Blueprint structures success-rate, cycle-time, intervention-rate, and safety-threshold questions for a specific site/task.
- Blueprint shows sample Site, Task, Scenario, and Eval Cards when clearly labeled.

## Blocked Unless Owner-System Proof Exists

- This robot is ready to deploy.
- Safety validated.
- Collision, contact, or manipulation validated.
- We ran the buyer's actual robot policy.
- Simulator execution completed.
- Real customer deployment result.
- Guaranteed success rate, cycle time, intervention rate, or safety threshold.
- Rights-cleared, hosted-session available, payment complete, provider run complete, or package access already open without owner proof.

## Safe Language

Use:

- deployment readiness advisory
- pre-pilot readiness estimate
- real-site eval cards for advisory review
- task-specific confidence packet
- evidence-backed recommendation
- confirmed after review
- requires simulator traces, action logs, robot trials, and safety proof for operational readiness

Do not use broad apology copy such as "not launched yet" or "demo only" in hero areas solely because proof is request-specific. Qualify only the specific unsupported claim.

## Evidence Hierarchy

1. Capture and provenance records.
2. Rights/privacy and restricted-zone records.
3. Site package manifest, routes, geometry/depth/assets where available, and export limits.
4. Task suite, robot profile, thresholds, and scenario variations.
5. Hosted review observations or runtime artifacts where available.
6. Simulator traces, action logs, robot trials, and safety review for operational readiness upgrades.
7. Buyer decision: short pilot, site modification, more evidence, vendor comparison, recapture, or hold.

Repo-local tests and samples can prove public wording and guardrail behavior. They do not prove operational robot readiness.
