---
name: capture-repo-operations
description: Operating guidance and validation commands for the BlueprintCapture repo.
---

# Capture Repo Operations

Primary repo:

- `/Users/nijelhunt_1/workspace/BlueprintCapture`

Read first:

- `/Users/nijelhunt_1/workspace/BlueprintCapture/AGENTS.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapture/CLAUDE.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapture/PLATFORM_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/BlueprintCapture/WORLD_MODEL_STRATEGY_CONTEXT.md`

Useful commands:

```bash
xcodebuild -project BlueprintCapture.xcodeproj -scheme BlueprintCapture -derivedDataPath build/DerivedData
cd cloud/extract-frames && npm test
./scripts/archive_external_alpha.sh --validate-config-only
./scripts/android_alpha_readiness.sh --validate-config-only
```

Focus areas:

- truthful capture flow
- bundle correctness
- upload reliability
- bridge compatibility
- rollout and release validation
