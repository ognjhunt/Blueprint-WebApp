# Deployment embodiment planning support

Owner direction, October 21, 2026: support the recommended deployment-company
robots in the existing robot setup and policy comparison UI, with an inspectable
handoff to BlueprintCapturePipeline.

The policy-test and team-evaluation pages offer the 16 fixed-base embodiment
options in `client/src/data/deploymentEmbodimentSupport.v1.json`. This file is an
exact mirror of Pipeline's
`src/blueprint_pipeline/_catalog_data/deployment_embodiment_support.v1.json`.
Update both together and verify their canonical catalog digests match. Asset
availability, publisher demonstrations, interface candidates and
customer-supplied contracts remain distinct in the catalog and UI.

The common robot-description fields also allow saving an option and its selected
policy routes. It is stored privately in the existing `users/{uid}/robotSetups`
record as `robotDescription.source = "support_option"`, with `embodimentId`,
`catalogDigest` and `policyRouteIds`. The authenticated
`GET /api/workspace/deployment-embodiments` endpoint exposes the same catalog and
its digest. Saving validates catalog identity and route compatibility, removes
any `executionBindingId`, and preserves the description for older-client saves.
The evaluation request builder refuses these planning descriptions until an
independent, validated execution configuration exists.

The downloaded portable JSON uses
`deployment_embodiment_shortlist.v1`, has `claim_ceiling: "planning_only"`, and
binds the source catalog and selected robot/policy routes with SHA-256 digests.
It contains no runtime preset, checkpoint digest or launch authorization.
Pipeline consumes it with:

```bash
python -m blueprint_pipeline.deployment_embodiment_support \
  --shortlist /path/to/embodiment-shortlist.json --output /path/to/integration-plan.json
```

The contract rejects unknown or duplicate selections, incompatible routes, stale
catalogs and changed handoffs. Exported rows and routes follow catalog order;
object keys use ASCII sorted canonical JSON in both repositories. The output
lists remaining integration artifacts and blockers without launching providers.

Focused local verification:

```bash
npx vitest run client/src/lib/deploymentEmbodimentSupport.test.ts \
  client/tests/components/DeploymentEmbodimentShortlist.test.tsx \
  client/tests/components/PolicyCanarySetup.test.tsx \
  server/tests/workspace-route.test.ts server/tests/team-evaluation-selection.test.ts
npm run check -- --incremental false
```

The tests protect digest/contract portability, explicit planning selections,
private saved setup readback, stale/incompatible choice rejection, the existing
policy-test flow, and refusal to route planning choices through an executable
Franka binding. They do not establish simulator or policy execution.
