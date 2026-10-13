// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { publicSurfaceTouched, releaseScope } from './checks.mjs';
describe('public-surface copy contracts', () => {
  it('run for any public copy source even when the release scope is narrower than full', () => {
    expect(releaseScope(['client/src/lib/evaluationPricing.ts'])).toBe('code');
    expect(publicSurfaceTouched(['client/src/lib/evaluationPricing.ts'])).toBe(true);
    expect(publicSurfaceTouched(['client/src/data/deploymentMarket.ts'])).toBe(true);
    expect(publicSurfaceTouched(['e2e/pricing.spec.ts'])).toBe(true);
    expect(publicSurfaceTouched(['server/routes/site-content.ts'])).toBe(true);
    expect(publicSurfaceTouched(['scripts/qa/run-operator-surfaces.ts'])).toBe(true);
    expect(publicSurfaceTouched([])).toBe(true);
  });
  it('skip backend-only changes', () => {
    expect(publicSurfaceTouched(['server/utils/agentCostTelemetry.ts', 'server/tests/x.test.ts'])).toBe(false);
  });
});
describe('release scope fails closed', () => {
  it('bounds content and makes sensitive, mixed and unknown changes full', () => {
    expect(releaseScope(['client/src/data/deploymentMarket.ts'])).toBe('content');
    expect(releaseScope(['server/agents/startup-packs.ts', 'server/tests/startup-pack-versioning.test.ts'])).toBe('code');
    expect(releaseScope(['server/utils/agentCostTelemetry.ts'])).toBe('code');
    expect(releaseScope(['server/agents/communications-draft-budget.ts'])).toBe('code');
    for (const files of [[], ['server/routes/admin-agent.ts'],
      ['client/src/data/deploymentMarket.ts','firestore.rules'], ['package-lock.json'],
      ['.github/workflows/deploy.yml'], ['client/src/pages/Home.tsx']]) {
      expect(releaseScope(files)).toBe('full');
    }
  });
});
