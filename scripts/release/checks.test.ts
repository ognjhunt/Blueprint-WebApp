// @vitest-environment node
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { publicSurfaceTouched, releaseScope, siteDecisionFiles } from './checks.mjs';
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
describe('job-page and intake decision helpers get the full scope', () => {
  it('runs every browser suite when one of them changes, alone or with other helpers', () => {
    for (const file of ['server/utils/taskPreparationOutcome.ts', 'server/utils/taskStatusProjection.ts',
      'server/utils/websitePreparationStatus.ts', 'server/utils/taskLifecycleNotifications.ts',
      'server/utils/betaPolicyScreeningContract.ts', 'server/utils/betaAbuseCaps.ts', 'server/utils/inviteeAllowlist.ts',
      'server/utils/websiteCaptureWithdrawal.ts', 'client/src/lib/siteCaptureDraft.ts', 'client/src/lib/selfCaptureVideo.ts']) {
      expect(releaseScope([file]), file).toBe('full');
      expect(releaseScope(['server/utils/agentCostTelemetry.ts', file]), file).toBe('full');
    }
  });
  it('keeps other helpers at code scope', () => {
    expect(releaseScope(['server/utils/emailLayout.ts'])).toBe('code');
    expect(releaseScope(['client/src/lib/analytics.ts'])).toBe('code');
  });
  it('names only files that exist', () => {
    for (const file of siteDecisionFiles) expect(fs.existsSync(file), file).toBe(true);
  });
});
