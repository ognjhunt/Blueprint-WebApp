import { dbAdmin as db } from '../../client/src/lib/firebaseAdmin';
import { CURRENT_UPDATE_PREFERENCES_VERSION, UPDATE_PREFERENCES_VERSIONS, updatePreferencesInputSchema, type UpdatePreferences,
  type UpdatePreferencesInput } from '../../client/src/types/updatePreferences';
import { accessRecordId } from './robotTeamEarlyAccess';
export function buildUpdatePreferences(input: UpdatePreferencesInput, source: UpdatePreferences['source']): UpdatePreferences {
  return { ...updatePreferencesInputSchema.parse(input), source, updatedAtIso: new Date().toISOString(), version: CURRENT_UPDATE_PREFERENCES_VERSION };
}
export function savedUpdatePreferences(value: unknown): UpdatePreferences | null {
  if (!value || typeof value !== 'object') return null;
  const stored = value as UpdatePreferences;
  const { source, updatedAtIso, version, ...input } = stored;
  const parsed = updatePreferencesInputSchema.safeParse(input);
  if (!parsed.success || !['signup', 'application', 'settings'].includes(source)
    || !(UPDATE_PREFERENCES_VERSIONS as readonly string[]).includes(version) || !Number.isFinite(Date.parse(updatedAtIso))) return null;
  return { ...parsed.data, source, updatedAtIso, version };
}
/**
 * What Settings shows: the job-email switch as it actually stands. Job emails are on unless they were turned off in
 * Settings (`companyWantsJobEmails`, owner 2026-11-20), so a preference saved at application or setup, whose job-email
 * value came from the old bundled box, shows them on. Settings then saves exactly what the person sees.
 */
export function effectiveUpdatePreferences(saved: UpdatePreferences | null): UpdatePreferences | null {
  if (!saved || saved.source === 'settings') return saved;
  return { ...saved, newJobAlerts: true };
}
/** Bind only a verified account's preferences to its existing contact. A signup cannot claim another email. */
export async function bindVerifiedPreferenceAccount(uid: string, email: string) {
  if (!db) return;
  const ref = db.collection('robotTeamAccess').doc(accessRecordId(email));
  await db.runTransaction(async tx => {
    const [contact, user] = await Promise.all([tx.get(ref), tx.get(db!.collection('users').doc(uid))]);
    const preferences = savedUpdatePreferences(user.data()?.updatePreferences);
    if (!contact.exists || !preferences) return;
    if (contact.data()?.preferencesAccountUid === uid && contact.data()?.newJobAlertsOptIn === preferences.newJobAlerts) return;
    tx.update(ref, { preferencesAccountUid: uid, newJobAlertsOptIn: preferences.newJobAlerts });
  });
}
