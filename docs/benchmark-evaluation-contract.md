# Benchmark evaluation contract

BlueprintCapturePipeline owns benchmark definitions, private splits, scheduling,
execution, aggregation, confidence intervals, and evidence. Blueprint-WebApp is
the authenticated request and result-display surface. It must never receive a
private split manifest, scenario identifier, seed, initial condition, policy
credential, or policy executable.

## Request option

`robot_eval_job_request.v1` may include
`benchmark_protocol_request.schema_version =
blueprint_benchmark_protocol_request.v1` with either:

- `standard`: the existing scoped operational evaluation path; or
- `benchmark_grade`: requires frozen hidden splits, fixed rollout counts,
  exact checkpoint digests, and confidence intervals.

The Pipeline remains the scheduler and resolves the versioned benchmark spec.
The WebApp does not expand hidden scenarios.

## Result projection

The signed Pipeline callback may include a
`blueprint_webapp_benchmark_projection.v1`. The server validates and allowlists
that projection before storing it. Unknown keys and private-field names are
rejected recursively. Other callback debug fields are not copied into the
stored `pipeline_result`.

The buyer run page can show:

- benchmark/card versions and digests;
- the captured-site representation, physics authority, evaluator version, and
  their immutable environment/runtime digests;
- fixed rollout count and hidden-split counts, never identities;
- full success, partial progress, efficiency, interventions, abstention,
  coverage, and their 95% confidence intervals;
- seen/unseen task, scene, object, camera, lighting, and embodiment summaries;
- digest-bound video, action-trace, and evaluator-output completeness counts,
  plus the private evidence-index digest but never its attempt-level contents;
- externally measured rank-fidelity or rank-concordance metrics with exact
  checkpoint matches and an explicit scope label.

## Validation scope

Same-site real-robot anchors can measure same-site rank fidelity. Different-site
robot results can measure cross-site rank concordance, not validation of the
captured target site. Simulator or world-model references measure
cross-evaluator concordance, not real-world validation.

A captured 3DGS/site-memory representation can provide same-site visual context
and calibrated observation evidence. It does not by itself provide contact
physics. A SimReady USD scene is an optional physics-authority lane, not a
prerequisite for the benchmark protocol and not a substitute for independent
real-robot anchors.

No displayed benchmark or external comparison automatically upgrades a public
performance, safety, deployment-readiness, or real-world claim.
