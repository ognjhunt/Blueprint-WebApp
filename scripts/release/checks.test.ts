// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { releaseScope } from './checks.mjs';
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
