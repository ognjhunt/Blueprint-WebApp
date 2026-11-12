# Addyosmani Agent Skills Adoption Map

Reference repo:

- `ops/paperclip/external/addyosmani-agent-skills/`

Pinned upstream commit: `d187883b7d761265309cdcc0f202cc76b4b3fb06` from `https://github.com/addyosmani/agent-skills`.

This repository is vendored as source material and installed into local Codex/Hermes skill homes for interactive use. Paperclip agents should use the Blueprint-prefixed wrapper skills in `ops/paperclip/blueprint-company/skills/addy-*`, not bind the upstream skills directly.

## Adoption Rule

The addyosmani skills are workflow helpers. They do not change Blueprint's primary stack, product doctrine, source-of-truth hierarchy, public-claims rules, or Paperclip execution record. If an upstream instruction conflicts with `PLATFORM_CONTEXT.md`, `WORLD_MODEL_STRATEGY_CONTEXT.md`, `AUTONOMOUS_ORG.md`, `docs/ai-skills-governance-2026-04-07.md`, or an agent's local `AGENTS.md`, Blueprint doctrine wins.

## Wrapper Skills

- `addy-api-and-interface-design` -> `ops/paperclip/external/addyosmani-agent-skills/skills/api-and-interface-design/SKILL.md`
- `addy-browser-testing-with-devtools` -> `ops/paperclip/external/addyosmani-agent-skills/skills/browser-testing-with-devtools/SKILL.md`
- `addy-ci-cd-and-automation` -> `ops/paperclip/external/addyosmani-agent-skills/skills/ci-cd-and-automation/SKILL.md`
- `addy-code-review-and-quality` -> `ops/paperclip/external/addyosmani-agent-skills/skills/code-review-and-quality/SKILL.md`
- `addy-code-simplification` -> `ops/paperclip/external/addyosmani-agent-skills/skills/code-simplification/SKILL.md`
- `addy-context-engineering` -> `ops/paperclip/external/addyosmani-agent-skills/skills/context-engineering/SKILL.md`
- `addy-debugging-and-error-recovery` -> `ops/paperclip/external/addyosmani-agent-skills/skills/debugging-and-error-recovery/SKILL.md`
- `addy-deprecation-and-migration` -> `ops/paperclip/external/addyosmani-agent-skills/skills/deprecation-and-migration/SKILL.md`
- `addy-documentation-and-adrs` -> `ops/paperclip/external/addyosmani-agent-skills/skills/documentation-and-adrs/SKILL.md`
- `addy-doubt-driven-development` -> `ops/paperclip/external/addyosmani-agent-skills/skills/doubt-driven-development/SKILL.md`
- `addy-frontend-ui-engineering` -> `ops/paperclip/external/addyosmani-agent-skills/skills/frontend-ui-engineering/SKILL.md`
- `addy-git-workflow-and-versioning` -> `ops/paperclip/external/addyosmani-agent-skills/skills/git-workflow-and-versioning/SKILL.md`
- `addy-idea-refine` -> `ops/paperclip/external/addyosmani-agent-skills/skills/idea-refine/SKILL.md`
- `addy-incremental-implementation` -> `ops/paperclip/external/addyosmani-agent-skills/skills/incremental-implementation/SKILL.md`
- `addy-interview-me` -> `ops/paperclip/external/addyosmani-agent-skills/skills/interview-me/SKILL.md`
- `addy-observability-and-instrumentation` -> `ops/paperclip/external/addyosmani-agent-skills/skills/observability-and-instrumentation/SKILL.md`
- `addy-performance-optimization` -> `ops/paperclip/external/addyosmani-agent-skills/skills/performance-optimization/SKILL.md`
- `addy-planning-and-task-breakdown` -> `ops/paperclip/external/addyosmani-agent-skills/skills/planning-and-task-breakdown/SKILL.md`
- `addy-security-and-hardening` -> `ops/paperclip/external/addyosmani-agent-skills/skills/security-and-hardening/SKILL.md`
- `addy-shipping-and-launch` -> `ops/paperclip/external/addyosmani-agent-skills/skills/shipping-and-launch/SKILL.md`
- `addy-source-driven-development` -> `ops/paperclip/external/addyosmani-agent-skills/skills/source-driven-development/SKILL.md`
- `addy-spec-driven-development` -> `ops/paperclip/external/addyosmani-agent-skills/skills/spec-driven-development/SKILL.md`
- `addy-test-driven-development` -> `ops/paperclip/external/addyosmani-agent-skills/skills/test-driven-development/SKILL.md`
- `addy-using-agent-skills` -> `ops/paperclip/external/addyosmani-agent-skills/skills/using-agent-skills/SKILL.md`

## Recommended Assignments

Engineering implementation and review lanes may use the build, test, API, UI, browser, debugging, quality, security, performance, observability, documentation, source-driven, and launch wrappers.

Security/procurement lanes may use only the source-driven, documentation, and security wrappers unless a concrete issue needs a narrower engineering workflow.

Growth and executive lanes may use idea refinement, interviewing, planning, documentation, and source-driven wrappers only as planning aids; they must not use these skills to invent traction, supply, rights, provider, or readiness claims.

## Non-Adoption

Do not import upstream hooks, slash commands, agent personas, or OpenCode/Claude-specific mandatory-use rules as Blueprint runtime policy. Those files remain reference material only. Blueprint's local agent instructions and Paperclip issue flow remain authoritative.
