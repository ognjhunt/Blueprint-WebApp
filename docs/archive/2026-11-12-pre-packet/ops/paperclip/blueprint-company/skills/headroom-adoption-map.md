# Headroom Adoption Map

Date: 2026-06-13

Source: `chopratejas/headroom` at upstream HEAD `0b4a4bd4830ecec1bca64c2f62455c4c923d91df`; installed CLI version `0.25.0`.

## Scope

- Codex user config routes through the local Headroom proxy at `http://127.0.0.1:8787/v1`.
- Codex MCP server `headroom` is registered with `headroom mcp serve`.
- Hermes has the `headroom_retrieve` plugin enabled so compressed CCR markers can be resolved without rerunning broad commands.
- Paperclip company agents include the `headroom` company skill in desired skill sync and AGENTS frontmatter.

## Exclusions

- Optional upstream semantic-code MCP add-ons are intentionally not installed, registered, or vendored.
- The vendored repo material under `ops/paperclip/external/headroom/` is limited to Headroom README/spec snippets and the Hermes retrieval plugin needed for this integration.
- Anonymous Headroom telemetry is disabled with `HEADROOM_TELEMETRY=off`, `HEADROOM_TELEMETRY_WARN=off`, and proxy `--no-telemetry`.

## Proof Boundary

Headroom reduces repeated context and large-output waste when the local proxy is healthy. It is not live billing proof, and it does not replace repo-local tests, source-of-truth reads, or Blueprint proof-layer separation.
