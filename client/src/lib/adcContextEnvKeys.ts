/**
 * Every env key that can make firebaseAdmin.ts attempt credential loading or
 * a Google Application Default Credentials lookup. Lives in its own
 * side-effect-free module so test harnesses can import the list WITHOUT
 * evaluating firebaseAdmin.ts (which initializes Firebase Admin at module
 * scope when any of these keys is present in the parent process).
 *
 * Credential-free test harnesses must strip ALL of these from subprocess
 * environments — clearing only the first two leaves GOOGLE_CLOUD_PROJECT /
 * K_SERVICE able to trigger an ADC attempt.
 */
export const ADC_CONTEXT_ENV_KEYS = Object.freeze([
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT",
  "K_SERVICE",
  "FUNCTION_TARGET",
] as const);
