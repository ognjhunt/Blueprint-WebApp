# Blueprint-WebApp Claude Guide

Use this repo as Blueprint's buyer and ops surface, not as a generic marketing app.

Read first:

1. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/PLATFORM_CONTEXT.md`
2. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/WORLD_MODEL_STRATEGY_CONTEXT.md`
3. `/Users/nijelhunt_1/workspace/Blueprint-WebApp/AGENTS.md`

Key rules:

- Keep copy and UX aligned with capture-first, world-model-product-first positioning.
- Treat provenance, rights, privacy, and hosted access as first-class product truths.
- Do not make qualification or one model backend the core story.
- Avoid fake supply, fake readiness, or fabricated operational states.

Key commands:

```bash
npm run dev
npm run check
npm run build
npm run test:coverage
npm run test:e2e
```

## gstack

- Use the repo-local gstack install at `.agents/skills/gstack` when you need slash-skill workflows.
- Prefer `/browse` for web browsing and browser-driven QA instead of older Chrome MCP flows.
- Core skills expected in this repo: `/plan-eng-review`, `/review`, `/qa`, `/browse`, `/investigate`, `/benchmark`, `/codex`, `/cso`, `/ship`, `/land-and-deploy`.
