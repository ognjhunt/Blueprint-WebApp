# Blueprint Paperclip Integration

This directory contains the local Paperclip package and bootstrap scripts used to run Blueprint's autonomous control plane across:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp`
- `/Users/nijelhunt_1/workspace/BlueprintCapturePipeline`
- `/Users/nijelhunt_1/workspace/BlueprintCapture`

Main entrypoints:

- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-company`: portable Paperclip company package
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/plugins/blueprint-automation`: Blueprint-specific Paperclip plugin package
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/blueprint-automation.config.json`: default plugin config template
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/ops/paperclip/BLUEPRINT_AUTOMATION.md`: setup, architecture, webhook wiring, and operator runbook
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/bootstrap-blueprint-paperclip.sh`: start Paperclip and import the Blueprint company
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/configure-blueprint-paperclip-plugin.sh`: install/build/configure the Blueprint plugin and its secret refs
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/verify-blueprint-paperclip.sh`: run environment checks against the imported local adapters
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/smoke-blueprint-paperclip-automation.sh`: end-to-end smoke for issue creation, dedupe, blocker follow-up, and resolution
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/scripts/paperclip/install-blueprint-paperclip-launchagent.sh`: install a macOS LaunchAgent that re-runs the bootstrap script every 5 minutes and at login

Runtime state is intentionally kept outside the git repo at:

- `/Users/nijelhunt_1/workspace/.paperclip-blueprint`
- optional shared env file: `/Users/nijelhunt_1/workspace/.paperclip-blueprint.env`

Paperclip source is cloned at:

- `/Users/nijelhunt_1/workspace/paperclip`
