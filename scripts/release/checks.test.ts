// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { releaseScope } from './checks.mjs';
describe('release scope fails closed', () => {
  it('bounds content and makes sensitive, mixed and unknown changes full', () => {
    expect(releaseScope(['client/src/data/deploymentMarket.ts'])).toBe('content');
    for (const files of [[], ['server/agents/tasks/outreach.ts'], ['server/utils/auth.ts'],
      ['client/src/data/deploymentMarket.ts','firestore.rules'], ['package-lock.json'],
      ['.github/workflows/deploy.yml'], ['client/src/pages/Home.tsx']]) {
      expect(releaseScope(files)).toBe('full');
    }
  });
});
