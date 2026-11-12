---
name: pipeline-repo-operations
description: Operating guidance and validation commands for the BlueprintCapturePipeline repo.
---

# Pipeline Repo Operations

Primary repo:

- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline`

Read first:

- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/AGENTS.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/CLAUDE.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/PLATFORM_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline/WORLD_MODEL_STRATEGY_CONTEXT.md`

Useful commands:

```bash
pytest
python -m blueprint_pipeline.run_e2e
python scripts/run_external_alpha_launch_gate.py
```

Focus areas:

- package materialization
- runtime services
- hosted-session artifacts
- swappable model adapters
- contract stability
