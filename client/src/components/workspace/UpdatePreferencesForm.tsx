import { Field } from './WorkspaceUI';
import { targetingDimensions, type UpdatePreferences, type TargetingCategories, type UpdatePreferencesInput } from '@/types/updatePreferences';
const labels = { roles: 'Roles', regions: 'Regions', industries: 'Industry focus', embodiments: 'Embodiments', policyCategories: 'Policy categories (e.g. WAM, VLA)', taskFamilies: 'Job types', capabilities: 'Capabilities' };
const values = (data: FormData, key: string) => String(data.get(key) ?? '').split(',').map(value => value.trim()).filter(Boolean);
export function UpdatePreferencesForm({ preferences, pending, save }: {
  preferences?: UpdatePreferences | null; pending: boolean; save: (input: UpdatePreferencesInput) => void;
}) {
  return <form className="ws-form ws-section" key={preferences?.updatedAtIso ?? 'none'} onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const categories = (prefix: string): TargetingCategories => Object.fromEntries(targetingDimensions.map(dimension => [dimension, values(data, `${prefix}.${dimension}`)]));
    const days = String(data.get('maxRetentionDays') ?? '').trim();
    save({ newsletter: data.get('newsletter') === 'on', newJobAlerts: data.get('newJobAlerts') === 'on',
      interests: categories('interests'), declaredCategories: categories('declared'), requirements: {
        ...(days ? { maxRetentionDays: Number(days) } : {}), noTraining: data.get('noTraining') === 'on', requiredRightsScopes: values(data, 'rightsScopes'),
      } });
  }}>
    <h2>Optional email updates</h2>
    <label><input type="checkbox" name="newsletter" defaultChecked={preferences?.newsletter ?? false} /> Blueprint news and updates</label>
    <label><input type="checkbox" name="newJobAlerts" defaultChecked={preferences?.newJobAlerts ?? false} /> Relevant new-job alerts</label>
    <p className="ws-muted">Account, application and jobs you are already involved in have separate notices. Unsubscribe anytime. Email suppression takes precedence over these choices.</p>
    <details><summary>Targeting preferences (optional)</summary>
      <p className="ws-muted">Comma-separated exact categories. Leave an interest blank for any value. If a selected category or a hard requirement is unknown, that job will not trigger an alert.</p>
      <div className="ws-fields">{targetingDimensions.map(dimension => <Field key={dimension} label={labels[dimension]}><input name={`interests.${dimension}`} maxLength={2400} defaultValue={preferences?.interests[dimension]?.join(', ') ?? ''} /></Field>)}</div>
      <Field label="Maximum data retention (days)" hint="A hard requirement; blank means no limit specified."><input name="maxRetentionDays" type="number" min={0} max={36500} defaultValue={preferences?.requirements.maxRetentionDays ?? ''} /></Field>
      <label><input type="checkbox" name="noTraining" defaultChecked={preferences?.requirements.noTraining ?? false} /> Require no use of data for training</label>
      <Field label="Required rights scopes" hint="Comma-separated. Preferences never grant access to private evidence."><input name="rightsScopes" maxLength={2400} defaultValue={preferences?.requirements.requiredRightsScopes?.join(', ') ?? ''} /></Field>
    </details>
    <details><summary>Team categories (optional)</summary><p className="ws-muted">Your declared categories for jobs with recipient requirements. Policy categories describe your stack; they do not verify robot performance.</p>
      <div className="ws-fields">{targetingDimensions.filter(d => d !== 'roles').map(dimension => <Field key={dimension} label={`Team ${labels[dimension]}`}><input name={`declared.${dimension}`} maxLength={2400} defaultValue={preferences?.declaredCategories?.[dimension]?.join(', ') ?? ''} /></Field>)}</div>
    </details>
    <button className="ws-primary" disabled={pending}>{pending ? 'Saving…' : 'Save update preferences'}</button>
  </form>;
}
