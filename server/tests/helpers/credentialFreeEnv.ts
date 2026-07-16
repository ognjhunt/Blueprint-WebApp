import { ADC_CONTEXT_ENV_KEYS } from "../../../client/src/lib/firebaseAdmin";

/**
 * Build a subprocess environment guaranteed not to trigger Firebase Admin
 * credential loading or a Google Application Default Credentials lookup,
 * regardless of what the parent shell (developer machine, CI runner, cloud
 * sandbox) has configured. Keys are deleted rather than blanked so
 * `?.trim()` presence checks cannot see them at all.
 */
export function credentialFreeSubprocessEnv(
  overrides: Record<string, string> = {},
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ADC_CONTEXT_ENV_KEYS) {
    delete env[key];
  }
  return { ...env, ...overrides };
}

export { ADC_CONTEXT_ENV_KEYS };
