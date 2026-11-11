// The answer-journey harness: the reliability harness's stripped environment,
// plus the video reading switched on against a scripted (synthetic) video model.
import { launchReliabilityHarness, reliabilityHarnessEnv } from './reliability-local-app.mjs';

const port = Number(process.env.ANSWER_JOURNEY_APP_PORT ?? '4183');
const env = reliabilityHarnessEnv({ project: 'demo-blueprint-reliability', port });
Object.assign(env, {
  // The coverage review reads the video. Its model sits behind the harness's
  // scripted reply; nothing reaches a real provider.
  BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED: '1',
  // A placeholder, never a key: the adapter only checks that one is configured,
  // and every request carrying it is answered inside the harness.
  GEMINI_API_KEY: 'harness-synthetic-not-a-key',
});
launchReliabilityHarness('scripts/qa/answer-journey-local-app.ts', env);
