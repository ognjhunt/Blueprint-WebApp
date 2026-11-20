// The answer-journey harness: the reliability harness's stripped environment,
// plus the video reading switched on against a scripted (synthetic) video model
// and the Auth emulator for deployment-company and staff accounts.
import { launchReliabilityHarness, reliabilityHarnessEnv } from './reliability-local-app.mjs';

const port = Number(process.env.ANSWER_JOURNEY_APP_PORT ?? '4183');
const firestore = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
if (!/^127\.0\.0\.1:[0-9]{1,5}$/.test(firestore)) throw new Error('Core journey requires a loopback Firestore emulator');
const env = reliabilityHarnessEnv({ project: 'demo-blueprint-reliability', port });
Object.assign(env, {
  FIRESTORE_EMULATOR_HOST: firestore,
  // The coverage review reads the video. Its model sits behind the harness's
  // scripted reply; nothing reaches a real provider.
  BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED: '1',
  // A placeholder, never a key: the adapter only checks that one is configured,
  // and every request carrying it is answered inside the harness.
  GEMINI_API_KEY: 'harness-synthetic-not-a-key',
  // Company and staff accounts are real ID tokens from the local Auth emulator, verified by the product's middleware.
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  TASK_EVALUATION_RESULT_DOWNLOAD_SIGNING_SECRET: 'harness-only-company-media-tickets',
});
launchReliabilityHarness('scripts/qa/answer-journey-local-app.ts', env);
