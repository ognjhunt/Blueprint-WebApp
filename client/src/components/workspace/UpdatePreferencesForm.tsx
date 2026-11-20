import type { UpdatePreferences, UpdatePreferencesInput } from '@/types/updatePreferences';
/**
 * The two email switches. The job-email box shows only to a deployment company: sites never get new-job emails. The
 * stored targeting fields (interests, categories, requirements) have no screen and no effect on who is emailed; they are
 * sent back as stored so saving here changes only what the person sees.
 */
export function UpdatePreferencesForm({ preferences, pending, save, jobEmails }: {
  preferences?: UpdatePreferences | null; pending: boolean; save: (input: UpdatePreferencesInput) => void; jobEmails: boolean;
}) {
  return <form className="ws-form ws-section" key={preferences?.updatedAtIso ?? 'none'} onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    save({ newsletter: data.get('newsletter') === 'on',
      newJobAlerts: jobEmails ? data.get('newJobAlerts') === 'on' : preferences?.newJobAlerts ?? true,
      interests: preferences?.interests ?? {}, declaredCategories: preferences?.declaredCategories ?? {},
      requirements: preferences?.requirements ?? {} });
  }}>
    <h2>Emails</h2>
    <label><input type="checkbox" name="newsletter" defaultChecked={preferences?.newsletter ?? false} /> Blueprint news and updates</label>
    {jobEmails && <label><input type="checkbox" name="newJobAlerts" defaultChecked={preferences?.newJobAlerts ?? true} /> Relevant new-job alerts</label>}
    <p className="ws-muted">Emails about your account and your jobs still come. Unsubscribe anytime.</p>
    <button className="ws-primary" disabled={pending}>{pending ? 'Saving…' : 'Save email choices'}</button>
  </form>;
}
