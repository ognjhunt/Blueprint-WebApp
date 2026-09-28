# Robot-team policy integration acceptance scope

Owner: Nijel Hunt. Program: Arm Decision Proof v1.
Backlog: ADP-011 / day 7 admission; ADP-050 / day 28 execution and delivery.

Owner scope update, 2026-09-28: build the integration capabilities and commit
and merge the relevant changes. Separate proof runs, new tests, and unrelated
debugging are deferred at the owner's request. The table below records the
execution evidence needed for later operational claims; it is not an instruction
to perform those runs during the capability build.

| Required path | Completion evidence |
| --- | --- |
| Production private container dispatch | Production account authentication, durable Firestore outbox, KMS-bound single-use registry lease, signed admission, dedicated ephemeral worker, measured sandbox isolation, policy calls, and terminal cleanup receipts |
| Real-task result delivery | Actual task-bound execution evidence, independently derived outcome, retained policy-input frames and trace, immutable delivery digest, authorized result read/download, and denial to another owner |
| Separate HTTPS policy | TLS endpoint queried by the production executor, bounded observation payload, validated returned actions, execution and delivery receipts |
| Model/checkpoint upload | Authenticated private upload, server-computed content digest, compatible approved runner and interface, actual inference, execution, and result delivery |
| Customer-hosted policy | Blueprint retains scene/simulator/scoring; only approved camera frames, robot state, task instruction and opaque request identity leave the boundary; no scene files, mesh, textures, asset links, or scoring internals in the wire payload |
| Simulator controller adapter | Existing controller receives the virtual robot's state and returns commands through a pinned, compatible adapter; actual simulator execution and independent scoring, with schema/unit/timeout rejection coverage |
| High-level skill trace | Preserve ordered intent and its task binding; do not infer motor commands, successful execution, or physical outcomes from a submitted sequence; attach separate execution evidence when available |
| Release closeout | Relevant changes committed, required checks passed or diagnosed against baseline, exact commits merged and deployed, retained proof links and resource teardown |

Existing captured scenes remain `development_only`. A Blueprint-owned synthetic
policy proves integration, not a customer's model quality or physical success.

## Model compatibility decision

Research checked 2026-09-28 against primary documentation:

- [LeRobot policy packaging](https://huggingface.co/docs/lerobot/bring_your_own_policies)
  uses `config.json`, `model.safetensors`, and a policy implementation. Weights
  alone do not describe preprocessing, normalization, embodiment, or actions.
- [OpenPI](https://github.com/Physical-Intelligence/openpi/blob/main/README.md)
  provides its own checkpoint/configuration loading and remote inference; it
  supports JAX and PyTorch workflows.
- [GR00T policy API](https://github.com/NVIDIA/Isaac-GR00T/blob/main/getting_started/policy.md)
  binds a checkpoint to embodiment and modality configuration, with native
  PyTorch inference and an optional accelerated export path.
- [ONNX Runtime](https://onnxruntime.ai/docs/get-started/with-python.html)
  executes exported ONNX graphs. ONNX is a portable option, not a requirement
  for every robotics model and not proof of equivalent behavior after export.

Use named, version-pinned compatibility profiles. The initial small CPU
integration proof can use ONNX float32 state-to-action inference. Native
LeRobot/safetensors, OpenPI and GR00T packages require their own approved
architecture, preprocessing, dependencies and embodiment profiles; retain
their native formats rather than promising that every policy exports to ONNX.
Unrecognized profiles must be refused before execution. Never load a caller's
pickled model or arbitrary Python architecture in the WebApp process.

## Customer-hosted boundary

Customer-hosted inference keeps model weights and private controller code on
the customer's system. Blueprint runs the scene, simulation, and scoring.
The model receives the minimum approved observations and sends actions back.
Describe this as **controlled observation access**: visible frames disclose
scene information. It does not promise that a determined recipient cannot
infer or reconstruct information from observations.

A remote policy cannot simulate a private robot's exact mechanics without
Blueprint having a compatible embodiment description or a separately verified
execution bridge. Keeping the model private does not establish robot physics.

## Plain-English interface meanings

A controller adapter translates between a team's existing control stack and
Blueprint's virtual robot. It can receive joint positions and send a movement
or gripper command. Compatibility includes command units, joint order,
frequency, simulator version and what happens on a timeout. Merely uploading
a plugin does not prove that it drove the robot.

A skill trace is an ordered record such as `find cup → pick cup → place cup on
shelf`. It records intent and order. Joint commands, interventions, and whether
the cup actually reached the shelf need separate, task-bound execution and
outcome evidence. A trace can remain useful even when those are unavailable.

## Capability interfaces

The team form and `/api/agent-team/checkpoints` accept `customer_hosted`,
`controller_adapter`, and `skill_trace` alongside the existing runtimes.
Customer-hosted references use HTTPS. Controller references use an immutable
OCI image with an adapter implementing the approved observation/action wire
interface; uploaded Python plugins never run inside the scene process.
Skill references use `blueprint.skill_trace.v1` JSON with ordered `steps`
containing `skill` and optional `target`. Registration preserves intent only.

Authenticated run owners can POST `{trace, idempotency_key}` to
`/api/task-evaluation-runs/:runId/skill-traces`, then GET the same route to
review traces bound to the frozen task and testbed. A submitted trace carries
no motor actions or inferred success and does not authorize a paid action run.

Model uploads bind private object generation, content digest and an explicit
runner interface. The canonical request carries that server-owned manifest to
the Pipeline builder. The builder checks the frozen task's units and channels,
copies only model bytes and interface metadata into its image, and returns a
digest-pinned image. Graph loading happens inside the isolated worker.

Customer-hosted, controller and model planning require the Pipeline's signed
offer to advertise `controlled_observation_v1`; models additionally require
`onnx_state_mlp_cpu_v1`. Publication is opt-in by the configured executor.
The controlled executor is injected into the existing job orchestrator and
never falls through to legacy manifest export, host Docker, or reference replay.
Production activation still requires a configured trusted simulator adapter
and qualified dedicated sandbox; merging code does not establish those facts.
