import { dbAdmin as db } from '../../client/src/lib/firebaseAdmin';
import { updatePreferencesInputSchema, type UpdatePreferences, type UpdatePreferencesInput } from '../../client/src/types/updatePreferences';
import { accessRecordId } from './robotTeamEarlyAccess';
export function buildUpdatePreferences(input: UpdatePreferencesInput, source: UpdatePreferences['source']): UpdatePreferences {
  return { ...updatePreferencesInputSchema.parse(input), source, updatedAtIso: new Date().toISOString(), version: 'optional-updates-v1' };
}
export function savedUpdatePreferences(value: unknown): UpdatePreferences | null {
  if (!value || typeof value !== 'object') return null;
  const stored = value as UpdatePreferences;
  const { source, updatedAtIso, version, ...input } = stored;
  const parsed = updatePreferencesInputSchema.safeParse(input);
  if (!parsed.success || !['signup', 'application', 'settings'].includes(source)
    || version !== 'optional-updates-v1' || !Number.isFinite(Date.parse(updatedAtIso))) return null;
  return { ...parsed.data, source, updatedAtIso, version };
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
