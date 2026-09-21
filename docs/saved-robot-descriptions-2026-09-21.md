# Saved physical robot descriptions

ADP-009D / day-21: a robot team's physical model and policy reference must remain separate inputs to evaluation. The observed blocker is a saved setup containing only an embodiment label, which cannot establish placement or distinguish a custom robot from the executable Franka binding.

The minimal UI reuses the existing Add setup form on the task page and Robots & policies settings. Select an available catalog model or supply a URDF, USD or MJCF HTTPS reference, base type, and optional gripper/camera/mounting details. These are private encrypted workspace inputs. Task details, price ($25), setup selection, start, status and results remain on one task page. Saving never starts compute or charges a customer.

Catalog selections retain the exact configuration digest and are checked again at submission/forwarding. A changed catalog version requires an updated setup. Custom model descriptions remove any executable binding; an older client omitting the new field cannot silently remove this restriction. A supplied URL or AI-interpreted documentation is not qualification.

This change implements registration and execution admission. It does **not** yet fetch or analyze custom model files, implement generic placement/IK, qualify mobile/legged adapters, or execute arbitrary policy endpoints/containers. The current development evaluation continues to use its explicitly displayed frozen policy pair and validated Franka runtime. No claim of general embodiment execution is made.

The subsequent Pipeline integration must consume the exact physical asset version through the existing RobotProfile/catalog seams, retain model-derived dimensions, frames, joint limits and sensors, and validate scene-specific support, reach, collisions and observation/action compatibility. Missing or unsupported properties must remain unresolved. Private policy endpoints may retain weights on the team's infrastructure; a container on Blueprint's host does not conceal its contents from the host operator.

Completion evidence for this change: workspace encryption/validation and execution-admission tests, task-page client tests, typecheck, and mobile/desktop browser tests covering custom-model save, blocked execution and the existing same-page result flow.
