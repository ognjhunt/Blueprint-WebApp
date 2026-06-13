---
name: headroom
description: Use Headroom's local context compression and retrieval path for Paperclip/Hermes agents. Trigger when large tool output, context growth, quota, token cost, or compressed Headroom markers are relevant.
---

# Headroom

Use Headroom as a local compression and retrieval layer for agent context. It is an optimization layer only; it does not change Blueprint proof standards.

## Blueprint Rules

- Preserve Blueprint repo doctrine and source-of-truth rules before relying on compressed context.
- Do not install, register, or enable optional semantic-code MCP add-ons bundled upstream as part of Headroom setup.
- Keep anonymous telemetry disabled. Use `HEADROOM_TELEMETRY=off`, `HEADROOM_TELEMETRY_WARN=off`, and `--no-telemetry` for Headroom proxy/service commands.
- Do not route secrets through new services or write credentials into Headroom config.
- Treat `<<ccr:...>>` and `hash=...` markers as Headroom retrieval handles, not file paths.
- If `headroom_retrieve` or the proxy is unavailable, rerun the original command with narrower scope instead of guessing.
- Do not claim token/cost savings unless current-run Headroom stats or logs measure them.

## Default Local Runtime

- Proxy URL: `http://127.0.0.1:8787`
- Codex OpenAI-compatible base URL: `http://127.0.0.1:8787/v1`
- Hermes plugin: `headroom_retrieve`
- Hermes recompression exclusions: `HEADROOM_EXCLUDE_TOOLS=read_file,headroom_retrieve`
