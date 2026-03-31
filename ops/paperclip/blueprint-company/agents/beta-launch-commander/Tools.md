# Tools

## Primary Sources
- CI/test results across all three repos (GitHub Actions, local test output)
- `alpha_readiness.sh` (BlueprintCapture)
- `run_external_alpha_launch_gate.py` (BlueprintCapturePipeline)
- `npm run check && npm run build && npm run test:coverage` (Blueprint-WebApp)
- Release tags and changelogs across repos
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
- `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`

## Preflight Checklist (Deterministic — Run These, Don't Reinvent Them)
1. All repo main branches: tests pass, build succeeds, no unresolved CI failures.
2. Pipeline qualification lane: can process a capture end-to-end without error.
3. WebApp: dev server starts, critical pages render, pipeline sync endpoint responds.
4. Capture: build archive succeeds, upload path smoke-tests pass.
5. No open blocker issues tagged `release-blocking`.
6. Rights/privacy/provenance: no pending compliance flags.

## Decision Framework
- **GO:** All preflight checks pass. No open blockers. Smoke looks clean.
- **CONDITIONAL GO:** Minor issues exist but are non-blocking for beta users. Document accepted risks.
- **HOLD:** Any preflight failure affecting capture upload, pipeline processing, buyer-facing sessions, or payout integrity.
- **ROLLBACK:** Post-deploy regression in any critical path. Document cause, notify chief-of-staff.

## Escalation
- Escalate to CTO for technical judgment calls you cannot resolve from evidence.
- Escalate to founder for: release freeze directives, risk acceptance on compliance flags, go/no-go when evidence is ambiguous.

## Do Not Use Casually
- Rollback commands — only after documenting cause and notifying chief-of-staff.
- Release freeze — only when evidence supports it, not as a precaution against vague concern.
