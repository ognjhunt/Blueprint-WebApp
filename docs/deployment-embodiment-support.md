# Deployment embodiment configuration and planning

Owner direction, October 21, 2026: keep deployment-company embodiment research,
asset preparation, policy adapters and planning handoffs in Pipeline and internal
operator tooling. Customer setup shows the team's actual robot/policy, validation
status and results.

The existing staff-only `/admin/jobs` console has a collapsed **Robot integration
planning** disclosure with the visual 16-robot gallery, compatible policy-route
choices, source evidence, setup requirements and portable handoff export. The
page is protected by the existing admin/ops route requirement. The global
planning export has `source_launch_id: null`; a job request ID is never treated
as a Pipeline launch ID. Customer policy-test, team-evaluation and Settings
pages do not offer the full planning catalog.

`client/src/data/deploymentEmbodimentSupport.v1.json` is an exact mirror of
Pipeline's `src/blueprint_pipeline/_catalog_data/deployment_embodiment_support.v1.json`.
Update both together and verify their canonical catalog digests match. Asset
availability, publisher demonstrations, interface candidates and customer-supplied
contracts remain distinct. Image provenance is separately documented in
`docs/deployment-embodiment-imagery.md`; images do not alter the catalog digest.

The authenticated `GET /api/workspace/deployment-embodiments` endpoint requires
admin/ops authority and returns the catalog and digest with `Cache-Control:
no-store`. New or changed `robotDescription.source = "support_option"` planning
selections likewise require staff authority; they validate catalog identity and
route compatibility and remove any `executionBindingId`. Existing private
`users/{uid}/robotSetups` descriptions preserve their `embodimentId`,
`catalogDigest` and `policyRouteIds` losslessly when unchanged, including a stale
catalog digest. Customer forms display that saved robot identity and a concise
validation status, with hidden fields preserving its descriptor; customers can
switch to their own model or an admitted native configuration. The forms expose
no planning route picker, asset browser or shortlist export. An unchanged saved
planning choice never acquires execution authority. Evaluation and checkpoint
onboarding refuse it until an explicit matching robot manifest is attached.

Within a selected job, the existing `/admin/jobs` console also saves an actual
robot configuration for any listed single-arm or paired variant. The saved
manifest binds the self-contained USD URL/SHA, driven joints, controller and
reset values, tool contacts, camera poses and action timing. V2 adds ordered,
independent named grippers; paired arms require two channels. The existing JSON
manifest upload in Settings remains available to technology teams without
exposing the internal planning catalog.

Save and validate calls the signed Pipeline native-preflight endpoint using
only the operator's saved setup. The exact response is retained with that setup;
its request digest binds the whole configuration, including cameras and controls.
`configured_not_executed` is structural configuration evidence only. It grants
no model rights, scene fit, runtime qualification, scientific pass or spending.
Missing joints, models or interface inputs remain explicit limitations.

The same job disclosure reuses checkpoint registration and its separate encrypted
policy-token input. Choosing a checkpoint requests the normal free evaluation;
the existing admission form still binds its exact policy, configuration license,
qualified method, budget and expiry. A later different checkpoint is refused.
Authenticated, verified Ops can use their own saved setup for Blueprint-managed
evaluation of a private site job under its existing robot-evaluation permission.
This does not publish a team card or grant third-party access. Pauses, withdrawal,
rights holds, task support and proven scene readiness remain required at request
and admission. Technology-team requests retain the existing card/access boundary.

Pipeline must deploy the additive native-preflight/v2 runtime consumer before
this WebApp consumer. No fresh provider execution or physical compatibility is
established by the software fixtures.

The existing Dream protocol settings also survive setup edits and checkpoint
selection. Its v2 manifest can bind independent left/right joint groups and
base/tool/TCP frames; the adapter separately requires its exact account model
and three camera roles. A checkpoint for another model at the same endpoint is
not interchangeable. These declarations still need the matching Pipeline
adapter, licensed account access and actual runtime qualification.

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
  client/tests/pages/AdminJobConsole.test.tsx client/tests/pages/WorkspaceSettings.test.tsx \
  server/tests/workspace-route.test.ts server/tests/team-evaluation-selection.test.ts
npm run check -- --incremental false
```

The tests protect digest/contract portability, explicit planning selections,
internal-only catalog/write authority, preserved private saved setup readback,
stale/incompatible choice rejection, customer/internal audience separation, the existing
policy-test flow, and refusal to route planning choices through an executable
Franka binding. They do not establish simulator or policy execution.
