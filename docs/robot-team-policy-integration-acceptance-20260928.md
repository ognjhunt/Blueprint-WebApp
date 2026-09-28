# Robot-team policy integration acceptance scope

Owner: Nijel Hunt. Program: Arm Decision Proof v1.
Backlog: ADP-011 / day 7 admission; ADP-050 / day 28 execution and delivery.

This extends the active production proof goal at the owner's request. All of
the following remain required; passing one row does not complete the goal.

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
