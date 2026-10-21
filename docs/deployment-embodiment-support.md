# Deployment embodiment planning support

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
onboarding refuse it until an explicit validated execution configuration is used.

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
